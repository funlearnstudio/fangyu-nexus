"use client";

import Link from "next/link";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import * as THREE from "three";
import {
  BlockId,
  CHUNK_SIZE,
  GENERATION_VERSION,
  GAME_RECIPES,
  WORLD_HEIGHT,
  addToInventory,
  canPlaceBlock,
  chunkKey,
  collidesWithWorld,
  craftInventory,
  countInventoryItem,
  getNexusNodes,
  getBlockDefinition,
  getChunkBlock,
  playerAabb,
  raycastVoxels,
  removeFromInventory,
  normalizeNexusQuestState,
  repairNexusNode,
  setChunkBlock,
  terrainHeight,
  voxelIndex,
  worldToChunk,
  worldToLocal,
  type BlockIdValue,
  type ChunkData,
  type ChunkMeshData,
  type GameWorldMetadata,
  type Inventory,
  type NexusQuestState,
  type PersistedChunkDelta,
  type PlayerWorldState,
  type RaycastHit,
} from "@fangyu/voxel-engine";
import {
  getLocalChunk,
  getLocalPlayer,
  getLocalWorld,
  initialPlayerState,
  putLocalChunk,
  putLocalPlayer,
  putLocalWorld,
  syncWorldToCloud,
} from "@/lib/game/local-worlds";
import {
  readGameSettings,
  type ClientGameSettings,
} from "../settings/GameSettings";

type SaveStatus = "saved" | "saving" | "offline" | "failed";
type LoadedChunk = {
  data: ChunkData;
  mesh: ChunkMeshData;
  modifications: Map<number, BlockIdValue>;
  dirty: boolean;
  lastTouched: number;
};
type RenderChunk = { key: string; revision: number; mesh: ChunkMeshData };
type HudState = {
  position: [number, number, number];
  chunk: [number, number];
  loaded: number;
  triangles: number;
  calls: number;
  fps: number;
  selected: number;
  inventory: Inventory;
  health: number;
  hunger: number;
  grounded: boolean;
  time: number;
  hit: RaycastHit | null;
  dead: boolean;
  quest: NexusQuestState;
  questMessage: string;
};
type SaveFunction = () => Promise<void>;

const emptyHud: HudState = {
  position: [0, 40, 0],
  chunk: [0, 0],
  loaded: 0,
  triangles: 0,
  calls: 0,
  fps: 0,
  selected: 0,
  inventory: [],
  health: 20,
  hunger: 20,
  grounded: false,
  time: 0.28,
  hit: null,
  dead: false,
  quest: normalizeNexusQuestState(),
  questMessage: "Nexus 信標已同步：尋找節點並修復它們。",
};

function useWorldId(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(
    () => setId(new URLSearchParams(window.location.search).get("id")),
    [],
  );
  return id;
}

export function GameWorldClient() {
  const worldId = useWorldId();
  const [world, setWorld] = useState<GameWorldMetadata | null>(null);
  const [player, setPlayer] = useState<PlayerWorldState | null>(null);
  const [settings, setSettings] = useState<ClientGameSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [paused, setPaused] = useState(true);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [debug, setDebug] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [hud, setHud] = useState(emptyHud);
  const saveRef = useRef<SaveFunction>(async () => undefined);

  useEffect(() => {
    if (!worldId) return;
    void (async () => {
      const localWorld = await getLocalWorld(worldId);
      if (!localWorld) {
        setLoadError("找不到本機世界。請返回 Play 建立或選擇世界。");
        return;
      }
      const localPlayer =
        (await getLocalPlayer(worldId)) ?? initialPlayerState(localWorld);
      setWorld(localWorld);
      setPlayer(localPlayer);
      setSettings(readGameSettings());
      void syncWorldToCloud(localWorld);
    })().catch(() =>
      setLoadError(
        "IndexedDB 存檔無法開啟。請確認瀏覽器沒有封鎖網站儲存空間。",
      ),
    );
  }, [worldId]);

  useEffect(() => {
    const toggle = () => setDebug((value) => !value);
    window.addEventListener("fangyu-debug", toggle);
    return () => window.removeEventListener("fangyu-debug", toggle);
  }, []);

  const resume = useCallback(() => {
    setInventoryOpen(false);
    const canvas =
      document.querySelector<HTMLCanvasElement>(".voxel-game canvas");
    void canvas?.requestPointerLock();
  }, []);

  if (!worldId)
    return (
      <div className="game-load-error">
        <h1>缺少世界 ID</h1>
        <Link href="/play">返回 Play</Link>
      </div>
    );
  if (loadError)
    return (
      <div className="game-load-error">
        <h1>無法進入世界</h1>
        <p>{loadError}</p>
        <Link className="primary-link" href="/play">
          返回 Play
        </Link>
      </div>
    );
  if (!world || !player || !settings)
    return (
      <div className="game-loading">
        <span className="voxel-loader" />
        正在讀取本機世界…
      </div>
    );

  return (
    <div
      className="voxel-game"
      onContextMenu={(event) => event.preventDefault()}
    >
      <Canvas
        camera={{
          fov: settings.fov,
          near: 0.05,
          far: Math.max(180, settings.renderDistance * CHUNK_SIZE * 2.2),
        }}
        gl={{
          antialias: settings.quality !== "low",
          powerPreference: "high-performance",
        }}
        dpr={settings.quality === "high" ? [1, 2] : [1, 1.35]}
      >
        <WorldRuntime
          world={world}
          initialPlayer={player}
          settings={settings}
          paused={paused || inventoryOpen}
          setPaused={setPaused}
          setInventoryOpen={setInventoryOpen}
          onHud={setHud}
          onSaveStatus={setSaveStatus}
          registerSave={(save) => {
            saveRef.current = save;
          }}
        />
      </Canvas>

      <div className="crosshair" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="game-topbar">
        <strong>{world.name}</strong>
        <span className={`save-state ${saveStatus}`}>
          {saveStatus === "saved"
            ? "Saved"
            : saveStatus === "saving"
              ? "Saving…"
              : saveStatus === "offline"
                ? "Offline · local saved"
                : "Sync failed · local safe"}
        </span>
        <button type="button" onClick={() => setDebug((value) => !value)}>
          F3 DEBUG
        </button>
      </div>
      <div className="vitals">
        <div aria-label={`生命 ${hud.health}`}>
          <span>HEALTH</span>
          <i style={{ width: `${hud.health * 5}%` }} />
        </div>
        <div aria-label={`飢餓 ${hud.hunger}`}>
          <span>HUNGER</span>
          <i style={{ width: `${hud.hunger * 5}%` }} />
        </div>
      </div>
      <QuestTracker
        quest={hud.quest}
        inventory={hud.inventory}
        message={hud.questMessage}
      />
      <Hotbar inventory={hud.inventory} selected={hud.selected} />
      <div className="selected-block">
        {
          getBlockDefinition(
            hud.inventory[hud.selected]?.blockId ?? BlockId.Air,
          ).name
        }
      </div>
      {debug && <DebugOverlay hud={hud} />}
      {(paused || inventoryOpen) && (
        <PauseLayer
          world={world}
          inventoryOpen={inventoryOpen}
          hud={hud}
          resume={resume}
          setInventoryOpen={setInventoryOpen}
          save={async () => saveRef.current()}
        />
      )}
      {hud.dead && (
        <div className="death-screen">
          <p>YOU FADED INTO THE NEXUS</p>
          <h2>生命歸零</h2>
          <button
            className="primary-link"
            type="button"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("fangyu-respawn"))
            }
          >
            在出生點重生
          </button>
        </div>
      )}
    </div>
  );
}

function Hotbar({
  inventory,
  selected,
}: {
  inventory: Inventory;
  selected: number;
}) {
  return (
    <div className="hotbar" aria-label="快捷列">
      {Array.from({ length: 9 }, (_, index) => {
        const stack = inventory[index];
        const block = getBlockDefinition(stack?.blockId ?? 0);
        return (
          <div key={index} className={selected === index ? "selected" : ""}>
            <kbd>{index + 1}</kbd>
            {stack ? (
              <>
                <span
                  className="block-swatch"
                  style={{
                    background: `rgb(${block.color.map((value) => Math.round(value * 255)).join(",")})`,
                  }}
                />
                <small>{stack.count}</small>
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function QuestTracker({
  quest,
  inventory,
  message,
}: {
  quest: NexusQuestState;
  inventory: Inventory;
  message: string;
}) {
  const crystals = countInventoryItem(inventory, BlockId.GlowCrystal);
  const complete = quest.repairedNodeIds.length === 3;
  return (
    <aside className={`quest-tracker${complete ? " complete" : ""}`}>
      <strong>{complete ? "NEXUS RESTORED" : "NEXUS BEACON"}</strong>
      <span>
        {complete ? "三座節點已重新連線。" : "蒐集輝晶，修復散落的節點。"}
      </span>
      <b>輝晶 {crystals} / 3</b>
      <b>節點 {quest.repairedNodeIds.length} / 3</b>
      <small>{message}</small>
    </aside>
  );
}

function DebugOverlay({ hud }: { hud: HudState }) {
  return (
    <aside className="debug-overlay">
      <strong>FANGYU VOXEL DEBUG</strong>
      <span>FPS {hud.fps}</span>
      <span>
        XYZ {hud.position.map((value) => value.toFixed(2)).join(" / ")}
      </span>
      <span>CHUNK {hud.chunk.join(" / ")}</span>
      <span>LOADED {hud.loaded}</span>
      <span>TRIANGLES {hud.triangles.toLocaleString()}</span>
      <span>DRAW CALLS {hud.calls}</span>
      <span>GROUNDED {String(hud.grounded)}</span>
      <span>
        MEM ~
        {Math.round(
          (hud.loaded * CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE) / 1024,
        )}{" "}
        KiB voxels
      </span>
    </aside>
  );
}

function PauseLayer({
  world,
  inventoryOpen,
  hud,
  resume,
  setInventoryOpen,
  save,
}: {
  world: GameWorldMetadata;
  inventoryOpen: boolean;
  hud: HudState;
  resume: () => void;
  setInventoryOpen: (open: boolean) => void;
  save: () => Promise<void>;
}) {
  const [craftMessage, setCraftMessage] = useState("");
  return (
    <div className="game-modal-backdrop">
      <section className="pause-menu">
        <p className="eyebrow">
          {inventoryOpen ? "INVENTORY / CRAFTING" : "GAME PAUSED"}
        </p>
        <h2>{inventoryOpen ? "背包與合成" : world.name}</h2>
        {inventoryOpen ? (
          <>
            <div className="inventory-grid">
              {hud.inventory.map((stack, index) => {
                const block = getBlockDefinition(stack?.blockId ?? 0);
                return (
                  <div key={index}>
                    {stack ? (
                      <>
                        <span
                          className="block-swatch"
                          style={{
                            background: `rgb(${block.color.map((value) => Math.round(value * 255)).join(",")})`,
                          }}
                        />
                        <b>{block.name}</b>
                        <small>× {stack.count}</small>
                      </>
                    ) : (
                      <small>EMPTY</small>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="recipe-list">
              {GAME_RECIPES.map((recipe) => (
                <button
                  type="button"
                  key={recipe.id}
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("fangyu-craft", { detail: recipe.id }),
                    );
                    setCraftMessage(`已嘗試製作：${recipe.name}`);
                  }}
                >
                  {recipe.name}
                  <small>
                    {recipe.inputs
                      .map(
                        (input) =>
                          `${getBlockDefinition(input.blockId).name}×${input.count}`,
                      )
                      .join(" + ")}
                  </small>
                </button>
              ))}
            </div>
            {craftMessage && <p className="craft-message">{craftMessage}</p>}
            <button className="primary-link" type="button" onClick={resume}>
              返回遊戲
            </button>
          </>
        ) : (
          <div className="pause-actions">
            <button className="primary-link" type="button" onClick={resume}>
              Resume
            </button>
            <button type="button" onClick={() => setInventoryOpen(true)}>
              Inventory / Crafting
            </button>
            <Link href="/play/settings">Settings</Link>
            <button type="button" onClick={() => void save()}>
              Save World
            </button>
            <Link href="/play">Exit to Portal</Link>
          </div>
        )}
        <div className="controls-help">
          <strong>控制</strong>
          <span>WASD 移動</span>
          <span>Mouse 視角</span>
          <span>Space 跳躍</span>
          <span>Shift 衝刺</span>
          <span>Ctrl 蹲下（experimental）</span>
          <span>左鍵挖掘</span>
          <span>右鍵放置</span>
          <span>1–9 快捷列</span>
          <span>E 背包</span>
          <span>F 修復 Nexus 節點（3 輝晶）</span>
          <span>F3 Debug</span>
          <span>Esc 暫停</span>
        </div>
      </section>
    </div>
  );
}

function ChunkMesh({ chunk }: { chunk: RenderChunk }) {
  const geometry = useMemo(() => {
    const value = new THREE.BufferGeometry();
    value.setAttribute(
      "position",
      new THREE.BufferAttribute(chunk.mesh.positions, 3),
    );
    value.setAttribute(
      "normal",
      new THREE.BufferAttribute(chunk.mesh.normals, 3),
    );
    value.setAttribute(
      "color",
      new THREE.BufferAttribute(chunk.mesh.colors, 3),
    );
    value.setIndex(new THREE.BufferAttribute(chunk.mesh.indices, 1));
    value.computeBoundingSphere();
    return value;
  }, [chunk]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} frustumCulled castShadow={false} receiveShadow>
      <meshLambertMaterial vertexColors />
    </mesh>
  );
}

function SelectionOutline({ hit }: { hit: RaycastHit | null }) {
  if (!hit) return null;
  return (
    <mesh position={[hit.block.x + 0.5, hit.block.y + 0.5, hit.block.z + 0.5]}>
      <boxGeometry args={[1.012, 1.012, 1.012]} />
      <meshBasicMaterial color="#62d8e8" wireframe transparent opacity={0.85} />
    </mesh>
  );
}

function NexusNodeField({
  nodes,
  repairedNodeIds,
}: {
  nodes: readonly { id: string; position: readonly [number, number, number] }[];
  repairedNodeIds: readonly string[];
}) {
  return (
    <group>
      {nodes.map((node, index) => {
        const repaired = repairedNodeIds.includes(node.id);
        const color = ["#e3ad54", "#4cc9e8", "#b87be9"][index] ?? "#62d8e8";
        return (
          <group key={node.id} position={node.position}>
            <mesh position={[0, -0.48, 0]}>
              <cylinderGeometry args={[1.1, 1.35, 0.35, 6]} />
              <meshLambertMaterial color={repaired ? "#3f625a" : "#26353b"} />
            </mesh>
            <mesh position={[0, 0.48, 0]} rotation={[0.25, 0.55, 0]}>
              <octahedronGeometry args={[0.48, 0]} />
              <meshStandardMaterial
                color={repaired ? "#74e5ac" : color}
                emissive={repaired ? "#2f9966" : color}
                emissiveIntensity={repaired ? 1.1 : 0.5}
              />
            </mesh>
            <pointLight
              color={repaired ? "#70e6af" : color}
              intensity={repaired ? 1.7 : 0.65}
              distance={11}
            />
          </group>
        );
      })}
    </group>
  );
}

function WorldRuntime({
  world,
  initialPlayer,
  settings,
  paused,
  setPaused,
  setInventoryOpen,
  onHud,
  onSaveStatus,
  registerSave,
}: {
  world: GameWorldMetadata;
  initialPlayer: PlayerWorldState;
  settings: ClientGameSettings;
  paused: boolean;
  setPaused: (paused: boolean) => void;
  setInventoryOpen: (open: boolean) => void;
  onHud: (hud: HudState) => void;
  onSaveStatus: (status: SaveStatus) => void;
  registerSave: (save: SaveFunction) => void;
}) {
  const { camera, gl } = useThree();
  const chunks = useRef(new Map<string, LoadedChunk>()),
    pending = useRef(new Set<string>()),
    requestedModifications = useRef(
      new Map<string, Map<number, BlockIdValue>>(),
    ),
    worker = useRef<Worker | null>(null),
    requestId = useRef(0);
  const [renderChunks, setRenderChunks] = useState<RenderChunk[]>([]);
  const position = useRef(new THREE.Vector3(...initialPlayer.position)),
    velocity = useRef(new THREE.Vector3()),
    yaw = useRef(initialPlayer.rotation[0]),
    pitch = useRef(initialPlayer.rotation[1]);
  const keys = useRef(new Set<string>()),
    grounded = useRef(false),
    inventory = useRef(initialPlayer.inventory),
    selected = useRef(initialPlayer.selectedSlot),
    health = useRef(initialPlayer.health),
    hunger = useRef(initialPlayer.hunger),
    dead = useRef(false);
  const quest = useRef(normalizeNexusQuestState(initialPlayer.quest)),
    questMessage = useRef("Nexus 信標已同步：尋找節點並修復它們。"),
    nexusNodes = useMemo(() => getNexusNodes(world.seed), [world.seed]);
  const timeOfDay = useRef(world.timeOfDay),
    hit = useRef<RaycastHit | null>(null),
    accumulator = useRef(0),
    lastChunkScan = useRef(0),
    lastHud = useRef(0),
    fpsFrames = useRef(0),
    fpsTime = useRef(0),
    fps = useRef(0),
    saveTimer = useRef(0),
    audio = useRef<AudioContext | null>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const safeSpawn = useMemo<readonly [number, number, number]>(
    () => [0.5, terrainHeight(world.seed, 0, 0) + 1.001, 0.5],
    [world.seed],
  );

  const lookup = useCallback(
    (x: number, y: number, z: number): BlockIdValue => {
      if (y < 0) return BlockId.Slate;
      if (y >= WORLD_HEIGHT) return BlockId.Air;
      const coordinate = worldToChunk(x, z),
        local = worldToLocal(x, z),
        chunk = chunks.current.get(chunkKey(coordinate.x, coordinate.z));
      return chunk
        ? getChunkBlock(chunk.data, local.x, y, local.z)
        : BlockId.Air;
    },
    [],
  );

  const publishChunks = useCallback(
    () =>
      setRenderChunks(
        Array.from(chunks.current, ([key, chunk]) => ({
          key,
          revision: chunk.data.revision,
          mesh: chunk.mesh,
        })),
      ),
    [],
  );

  const requestChunk = useCallback(
    async (x: number, z: number, existing?: LoadedChunk) => {
      const key = chunkKey(x, z);
      if (pending.current.has(key)) return;
      pending.current.add(key);
      const local = existing
        ? null
        : await getLocalChunk(world.id, x, z).catch(() => undefined);
      const modifications = existing
        ? Array.from(existing.modifications)
        : (local?.modifiedBlocks ?? []);
      requestedModifications.current.set(key, new Map(modifications));
      worker.current?.postMessage({
        type: "generate",
        requestId: ++requestId.current,
        seed: world.seed,
        chunkX: x,
        chunkZ: z,
        modifications,
      });
    },
    [world.id, world.seed],
  );

  useEffect(() => {
    const generator = new Worker(
      new URL("./world.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.current = generator;
    generator.onmessage = (
      event: MessageEvent<{
        chunkX: number;
        chunkZ: number;
        blocks: ArrayBuffer;
        positions: ArrayBuffer;
        normals: ArrayBuffer;
        colors: ArrayBuffer;
        indices: ArrayBuffer;
        triangles: number;
      }>,
    ) => {
      const message = event.data,
        key = chunkKey(message.chunkX, message.chunkZ),
        previous = chunks.current.get(key);
      const data: ChunkData = {
        x: message.chunkX,
        z: message.chunkZ,
        blocks: new Uint8Array(message.blocks),
        revision: (previous?.data.revision ?? 0) + 1,
      };
      chunks.current.set(key, {
        data,
        mesh: {
          positions: new Float32Array(message.positions),
          normals: new Float32Array(message.normals),
          colors: new Float32Array(message.colors),
          indices: new Uint32Array(message.indices),
          triangles: message.triangles,
        },
        modifications:
          previous?.modifications ??
          requestedModifications.current.get(key) ??
          new Map(),
        dirty:
          previous?.dirty ??
          (requestedModifications.current.get(key)?.size ?? 0) > 0,
        lastTouched: performance.now(),
      });
      pending.current.delete(key);
      publishChunks();
    };
    return () => generator.terminate();
  }, [publishChunks]);

  const beep = useCallback(
    (frequency: number) => {
      if (settings.sfx <= 0) return;
      const context = audio.current ?? new AudioContext();
      audio.current = context;
      const oscillator = context.createOscillator(),
        gain = context.createGain();
      oscillator.type = "square";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(settings.sfx * 0.045, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        context.currentTime + 0.075,
      );
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.08);
    },
    [settings.sfx],
  );

  const changeBlock = useCallback(
    (button: number) => {
      if (!document.pointerLockElement || dead.current) return;
      const current = hit.current;
      if (!current) return;
      if (button === 0) {
        window.dispatchEvent(new CustomEvent("fangyu-attack"));
        const coordinate = worldToChunk(current.block.x, current.block.z),
          local = worldToLocal(current.block.x, current.block.z),
          chunk = chunks.current.get(chunkKey(coordinate.x, coordinate.z));
        if (!chunk) return;
        setChunkBlock(
          chunk.data,
          local.x,
          current.block.y,
          local.z,
          BlockId.Air,
        );
        chunk.modifications.set(
          voxelIndex(local.x, current.block.y, local.z),
          BlockId.Air,
        );
        chunk.dirty = true;
        if (world.gameMode === "survival")
          inventory.current = addToInventory(
            inventory.current,
            getBlockDefinition(current.blockId).drop ?? current.blockId,
            1,
          );
        void requestChunk(coordinate.x, coordinate.z, chunk);
        beep(132);
      } else if (button === 2) {
        const stack = inventory.current[selected.current];
        if (!stack) return;
        if (
          !canPlaceBlock(
            current.previous,
            playerAabb(
              [position.current.x, position.current.y, position.current.z],
              keys.current.has("ControlLeft"),
            ),
            lookup,
          )
        )
          return;
        const coordinate = worldToChunk(current.previous.x, current.previous.z),
          local = worldToLocal(current.previous.x, current.previous.z),
          chunk = chunks.current.get(chunkKey(coordinate.x, coordinate.z));
        if (!chunk) return;
        setChunkBlock(
          chunk.data,
          local.x,
          current.previous.y,
          local.z,
          stack.blockId,
        );
        chunk.modifications.set(
          voxelIndex(local.x, current.previous.y, local.z),
          stack.blockId,
        );
        chunk.dirty = true;
        if (world.gameMode === "survival")
          inventory.current =
            removeFromInventory(inventory.current, selected.current, 1) ??
            inventory.current;
        void requestChunk(coordinate.x, coordinate.z, chunk);
        beep(196);
      }
    },
    [beep, lookup, requestChunk, world.gameMode],
  );

  const repairNearestNode = useCallback(() => {
    if (!document.pointerLockElement || dead.current) return;
    const nearest = nexusNodes
      .filter((node) => !quest.current.repairedNodeIds.includes(node.id))
      .map((node) => ({
        node,
        distance: Math.hypot(
          position.current.x - node.position[0],
          position.current.y - node.position[1],
          position.current.z - node.position[2],
        ),
      }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (!nearest || nearest.distance > 4.6) {
      questMessage.current = "沒有可互動的 Nexus 節點；靠近未修復節點後按 F。";
      return;
    }
    const repaired = repairNexusNode(
      quest.current,
      inventory.current,
      nearest.node.id,
    );
    if (!repaired) {
      questMessage.current = `需要 ${3} 顆輝晶才能修復 ${nearest.node.name}。`;
      beep(92);
      return;
    }
    quest.current = repaired.state;
    inventory.current = repaired.inventory;
    questMessage.current = repaired.state.completedAt
      ? "Nexus 主線完成：三座節點已恢復連線。"
      : `${nearest.node.name} 已修復。尋找下一座節點。`;
    beep(660);
  }, [beep, nexusNodes]);

  const save = useCallback(async () => {
    onSaveStatus("saving");
    const now = new Date().toISOString(),
      dirty = Array.from(chunks.current.values()).filter(
        (chunk) => chunk.dirty,
      );
    try {
      const state: PlayerWorldState = {
        worldId: world.id,
        position: [position.current.x, position.current.y, position.current.z],
        rotation: [yaw.current, pitch.current],
        health: health.current,
        hunger: hunger.current,
        inventory: inventory.current,
        selectedSlot: selected.current,
        gameMode: world.gameMode,
        spawnPoint: safeSpawn,
        quest: quest.current,
        lastPlayedAt: now,
        revision: initialPlayer.revision,
      };
      await putLocalPlayer(state);
      for (const chunk of dirty) {
        const delta: PersistedChunkDelta = {
          worldId: world.id,
          chunkX: chunk.data.x,
          chunkZ: chunk.data.z,
          generationVersion: GENERATION_VERSION,
          chunkVersion: 1,
          modifiedBlocks: Array.from(chunk.modifications),
          entities: [],
          updatedAt: now,
          revision: 0,
        };
        await putLocalChunk(delta);
      }
      const updatedWorld = {
        ...world,
        timeOfDay: timeOfDay.current,
        lastPlayedAt: now,
        updatedAt: now,
      };
      await putLocalWorld(updatedWorld);
      const cloudReady = await syncWorldToCloud(updatedWorld);
      if (cloudReady) {
        const requests: Promise<Response>[] = dirty.map((chunk) =>
          fetch(
            `/api/worlds/${world.id}/chunks/${chunk.data.x}/${chunk.data.z}`,
            {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                modifiedBlocks: Array.from(chunk.modifications),
                chunkVersion: 1,
              }),
            },
          ),
        );
        requests.push(
          fetch(`/api/worlds/${world.id}/save`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(state),
          }),
        );
        const results = await Promise.all(requests);
        const synced = results.every((result) => result.ok);
        if (synced) dirty.forEach((chunk) => (chunk.dirty = false));
        onSaveStatus(synced ? "saved" : "failed");
      } else onSaveStatus("offline");
    } catch {
      onSaveStatus("failed");
    }
  }, [initialPlayer.revision, onSaveStatus, safeSpawn, world]);

  useEffect(() => {
    registerSave(save);
  }, [registerSave, save]);

  useEffect(() => {
    const canvas = gl.domElement;
    const onLock = () => setPaused(document.pointerLockElement !== canvas);
    const onKeyDown = (event: KeyboardEvent) => {
      keys.current.add(event.code);
      if (/^Digit[1-9]$/.test(event.code))
        selected.current = Number(event.code.slice(5)) - 1;
      if (event.code === "KeyE") {
        event.preventDefault();
        document.exitPointerLock();
        setInventoryOpen(true);
      }
      if (event.code === "KeyF") {
        event.preventDefault();
        repairNearestNode();
      }
      if (event.code === "F3") {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("fangyu-debug"));
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keys.current.delete(event.code);
    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      yaw.current -= event.movementX * settings.sensitivity;
      pitch.current = Math.max(
        -Math.PI / 2 + 0.02,
        Math.min(
          Math.PI / 2 - 0.02,
          pitch.current - event.movementY * settings.sensitivity,
        ),
      );
    };
    const onMouseDown = (event: MouseEvent) => changeBlock(event.button);
    const onCraft = (event: Event) => {
      const recipe = GAME_RECIPES.find(
        (entry) => entry.id === (event as CustomEvent<string>).detail,
      );
      if (!recipe) return;
      const result = craftInventory(inventory.current, recipe);
      if (result) {
        inventory.current = result;
        beep(440);
      }
    };
    const onRespawn = () => {
      position.current.set(...safeSpawn);
      velocity.current.set(0, 0, 0);
      health.current = 20;
      hunger.current = 20;
      dead.current = false;
    };
    document.addEventListener("pointerlockchange", onLock);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("fangyu-craft", onCraft);
    window.addEventListener("fangyu-respawn", onRespawn);
    return () => {
      document.removeEventListener("pointerlockchange", onLock);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("fangyu-craft", onCraft);
      window.removeEventListener("fangyu-respawn", onRespawn);
    };
  }, [
    beep,
    changeBlock,
    gl.domElement,
    safeSpawn,
    setInventoryOpen,
    setPaused,
    settings.sensitivity,
    repairNearestNode,
  ]);

  useEffect(() => {
    const handler = () => {
      void save();
    };
    window.addEventListener("pagehide", handler);
    const id = window.setInterval(() => void save(), 12_000);
    return () => {
      window.removeEventListener("pagehide", handler);
      clearInterval(id);
    };
  }, [save]);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    fpsFrames.current += 1;
    fpsTime.current += delta;
    if (fpsTime.current >= 0.5) {
      fps.current = Math.round(fpsFrames.current / fpsTime.current);
      fpsFrames.current = 0;
      fpsTime.current = 0;
    }
    lastChunkScan.current += delta;
    if (lastChunkScan.current > 0.35) {
      lastChunkScan.current = 0;
      const center = worldToChunk(position.current.x, position.current.z),
        radius = Math.min(settings.renderDistance, 6);
      const wanted = new Set<string>();
      for (let z = center.z - radius; z <= center.z + radius; z += 1)
        for (let x = center.x - radius; x <= center.x + radius; x += 1) {
          const key = chunkKey(x, z);
          wanted.add(key);
          if (!chunks.current.has(key)) void requestChunk(x, z);
        }
      for (const [key, chunk] of chunks.current)
        if (!wanted.has(key)) {
          if (chunk.dirty) void save();
          chunks.current.delete(key);
        }
      publishChunks();
    }
    const ready = chunks.current.has(
      chunkKey(
        worldToChunk(position.current.x, position.current.z).x,
        worldToChunk(position.current.x, position.current.z).z,
      ),
    );
    if (!paused && ready && !dead.current) {
      accumulator.current = Math.min(0.15, accumulator.current + delta);
      while (accumulator.current >= 1 / 60) {
        const dt = 1 / 60,
          forward =
            Number(keys.current.has("KeyW")) - Number(keys.current.has("KeyS")),
          strafe =
            Number(keys.current.has("KeyD")) - Number(keys.current.has("KeyA"));
        const length = Math.hypot(forward, strafe) || 1,
          sprint =
            keys.current.has("ShiftLeft") || keys.current.has("ShiftRight"),
          speed =
            (sprint ? 7.2 : 4.5) * (keys.current.has("ControlLeft") ? 0.45 : 1);
        const sin = Math.sin(yaw.current),
          cos = Math.cos(yaw.current);
        velocity.current.x = ((-sin * forward + cos * strafe) / length) * speed;
        velocity.current.z = ((-cos * forward - sin * strafe) / length) * speed;
        if (keys.current.has("Space") && grounded.current) {
          velocity.current.y = 8;
          grounded.current = false;
          beep(260);
        }
        velocity.current.y -= 22 * dt;
        const oldFall = velocity.current.y;
        for (const axis of ["x", "z", "y"] as const) {
          const amount = velocity.current[axis] * dt;
          position.current[axis] += amount;
          if (
            collidesWithWorld(
              playerAabb(
                [position.current.x, position.current.y, position.current.z],
                keys.current.has("ControlLeft"),
              ),
              lookup,
            )
          ) {
            position.current[axis] -= amount;
            if (axis === "y") {
              if (velocity.current.y < 0) {
                grounded.current = true;
                if (oldFall < -13 && world.gameMode === "survival")
                  health.current = Math.max(
                    0,
                    health.current - Math.floor(Math.abs(oldFall) - 10),
                  );
              }
              velocity.current.y = 0;
            }
          } else if (axis === "y") grounded.current = false;
        }
        if (world.gameMode === "survival" && sprint && (forward || strafe))
          hunger.current = Math.max(0, hunger.current - dt * 0.015);
        if (position.current.y < -8 || health.current <= 0) dead.current = true;
        accumulator.current -= dt;
      }
    }
    camera.rotation.order = "YXZ";
    camera.rotation.set(pitch.current, yaw.current, 0);
    camera.position.set(
      position.current.x,
      position.current.y + (keys.current.has("ControlLeft") ? 1.35 : 1.62),
      position.current.z,
    );
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    hit.current = raycastVoxels(
      lookup,
      [camera.position.x, camera.position.y, camera.position.z],
      [direction.x, direction.y, direction.z],
      6,
    );
    timeOfDay.current = (timeOfDay.current + delta / 900) % 1;
    const angle = timeOfDay.current * Math.PI * 2,
      daylight = Math.max(0.08, Math.sin(angle) * 0.7 + 0.35);
    if (sun.current) {
      sun.current.position.set(Math.cos(angle) * 80, Math.sin(angle) * 80, 25);
      sun.current.intensity = daylight * 1.5;
    }
    const sky = new THREE.Color().setHSL(0.57, 0.42, 0.08 + daylight * 0.5);
    state.scene.background = sky;
    state.scene.fog = new THREE.Fog(
      sky,
      settings.renderDistance * CHUNK_SIZE * 0.75,
      settings.renderDistance * CHUNK_SIZE * 1.65,
    );
    lastHud.current += delta;
    saveTimer.current += delta;
    if (lastHud.current > 0.12) {
      lastHud.current = 0;
      const coordinate = worldToChunk(position.current.x, position.current.z);
      onHud({
        position: [position.current.x, position.current.y, position.current.z],
        chunk: [coordinate.x, coordinate.z],
        loaded: chunks.current.size,
        triangles: renderChunks.reduce(
          (sum, chunk) => sum + chunk.mesh.triangles,
          0,
        ),
        calls: state.gl.info.render.calls,
        fps: fps.current,
        selected: selected.current,
        inventory: inventory.current,
        health: health.current,
        hunger: hunger.current,
        grounded: grounded.current,
        time: timeOfDay.current,
        hit: hit.current,
        dead: dead.current,
        quest: quest.current,
        questMessage: questMessage.current,
      });
    }
  });

  const spawnY = safeSpawn[1];
  useEffect(() => {
    if (
      initialPlayer.position[1] >= WORLD_HEIGHT ||
      initialPlayer.position[1] <= 0 ||
      // Repair worlds created by the early fixed-height spawn implementation.
      initialPlayer.position[1] > spawnY + 6
    )
      position.current.set(...safeSpawn);
  }, [initialPlayer.position, safeSpawn, spawnY]);

  return (
    <>
      <hemisphereLight intensity={0.45} color="#bdefff" groundColor="#18201c" />
      <directionalLight ref={sun} intensity={1.2} position={[40, 70, 30]} />
      {renderChunks.map((chunk) => (
        <ChunkMesh key={`${chunk.key}:${chunk.revision}`} chunk={chunk} />
      ))}
      <SelectionOutline hit={hit.current} />
      <NexusNodeField
        nodes={nexusNodes}
        repairedNodeIds={quest.current.repairedNodeIds}
      />
      <CreatureField
        player={position}
        paused={paused}
        passiveY={terrainHeight(world.seed, 5, 5) + 1}
        hostileY={terrainHeight(world.seed, -6, -6) + 1}
        damage={(amount) => {
          if (world.gameMode === "survival")
            health.current = Math.max(0, health.current - amount);
        }}
      />
    </>
  );
}

function CreatureField({
  player,
  paused,
  passiveY,
  hostileY,
  damage,
}: {
  player: RefObject<THREE.Vector3>;
  paused: boolean;
  passiveY: number;
  hostileY: number;
  damage: (amount: number) => void;
}) {
  const { camera } = useThree();
  const passive = useRef<THREE.Mesh>(null),
    hostile = useRef<THREE.Mesh>(null),
    passiveHealth = useRef(6),
    hostileHealth = useRef(8),
    attackClock = useRef(0);
  const [passiveAlive, setPassiveAlive] = useState(true),
    [hostileAlive, setHostileAlive] = useState(true);

  useEffect(() => {
    const attack = () => {
      const targets = [passive.current, hostile.current].filter(
        (target): target is THREE.Mesh => Boolean(target?.visible),
      );
      const raycaster = new THREE.Raycaster();
      raycaster.far = 4.5;
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const target = raycaster.intersectObjects(targets, false)[0]?.object;
      if (target === passive.current) {
        passiveHealth.current -= 3;
        if (passiveHealth.current <= 0) setPassiveAlive(false);
      }
      if (target === hostile.current) {
        hostileHealth.current -= 3;
        if (hostileHealth.current <= 0) setHostileAlive(false);
      }
    };
    window.addEventListener("fangyu-attack", attack);
    return () => window.removeEventListener("fangyu-attack", attack);
  }, [camera]);
  useFrame((_, delta) => {
    if (paused) return;
    if (passive.current && passiveAlive) {
      passive.current.position.x = 5 + Math.sin(performance.now() / 1800) * 2;
      passive.current.rotation.y += delta * 0.4;
    }
    if (hostile.current && hostileAlive && hostileHealth.current > 0) {
      const target = player.current,
        dx = target.x - hostile.current.position.x,
        dz = target.z - hostile.current.position.z,
        distance = Math.hypot(dx, dz);
      if (distance < 14 && distance > 1) {
        hostile.current.position.x += (dx / distance) * delta * 1.45;
        hostile.current.position.z += (dz / distance) * delta * 1.45;
        hostile.current.lookAt(target.x, hostile.current.position.y, target.z);
      }
      attackClock.current -= delta;
      if (distance < 1.5 && attackClock.current <= 0) {
        damage(2);
        attackClock.current = 1.2;
      }
    }
  });
  return (
    <group>
      <mesh ref={passive} visible={passiveAlive} position={[5, passiveY, 5]}>
        <boxGeometry args={[0.9, 0.75, 1.2]} />
        <meshLambertMaterial color="#e7b653" />
        <mesh position={[0, 0.38, 0.42]}>
          <boxGeometry args={[0.48, 0.45, 0.45]} />
          <meshLambertMaterial color="#f6d37d" />
        </mesh>
      </mesh>
      <mesh ref={hostile} visible={hostileAlive} position={[-6, hostileY, -6]}>
        <boxGeometry args={[0.8, 1.35, 0.8]} />
        <meshLambertMaterial color="#7d4ab2" emissive="#27103b" />
      </mesh>
    </group>
  );
}
