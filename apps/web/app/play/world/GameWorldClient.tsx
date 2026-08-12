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
  SEA_LEVEL,
  WORLD_HEIGHT,
  canPlaceBlock,
  addToInventoryWithRemainder,
  chunkKey,
  collidesWithWorld,
  countInventoryItem,
  craftInventory,
  consumeInventoryItem,
  getBlockLoot,
  getBiomeAt,
  getCurrentQuest,
  getNexusNodes,
  getWorldLandmarks,
  getWeatherAt,
  getBlockDefinition,
  getChunkBlock,
  playerAabb,
  pickupDroppedItem,
  cropGrowthStage,
  isCropMature,
  isShelterComplete,
  raycastVoxels,
  removeFromInventory,
  moveInventoryStack,
  normalizeNexusQuestState,
  objectiveProgress,
  applyGameplayEvent,
  MAIN_QUESTS,
  repairNexusNode,
  setChunkBlock,
  terrainHeight,
  voxelIndex,
  worldToChunk,
  worldToLocal,
  type BlockIdValue,
  type ChunkData,
  type ChunkMeshData,
  type CropEntity,
  type DroppedItemEntity,
  type GameWorldMetadata,
  type GameplayEvent,
  type Inventory,
  type NexusQuestState,
  type PersistedChunkDelta,
  type PlayerWorldState,
  type RaycastHit,
  type WorldEntity,
  type WorldLandmark,
  type WeatherType,
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
  entities: WorldEntity[];
  dirty: boolean;
  lastTouched: number;
};
type RenderChunk = { key: string; revision: number; mesh: ChunkMeshData };
type RenderDrop = DroppedItemEntity & { key: string };
type RenderCrop = CropEntity & { key: string };
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
  oxygen: number;
  biome: string;
  weather: WeatherType;
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
  oxygen: 20,
  biome: "青風平原",
  weather: "clear",
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
  const [questOpen, setQuestOpen] = useState(false);
  const [tutorialPage, setTutorialPage] = useState<number | null>(null);
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
      const replay = localStorage.getItem("fangyu-replay-tutorial") === "1";
      if (replay) localStorage.removeItem("fangyu-replay-tutorial");
      if (
        replay ||
        (!localPlayer.quest?.tutorialCompleted &&
          !localPlayer.quest?.tutorialSkipped)
      )
        setTutorialPage(0);
      void syncWorldToCloud(localWorld);
    })().catch(() =>
      setLoadError(
        "IndexedDB 存檔無法開啟。請確認瀏覽器沒有封鎖網站儲存空間。",
      ),
    );
  }, [worldId]);

  useEffect(() => {
    const toggle = () => setDebug((value) => !value);
    const journal = () => {
      document.exitPointerLock();
      setQuestOpen((value) => !value);
    };
    window.addEventListener("fangyu-debug", toggle);
    window.addEventListener("fangyu-journal", journal);
    return () => {
      window.removeEventListener("fangyu-debug", toggle);
      window.removeEventListener("fangyu-journal", journal);
    };
  }, []);

  const resume = useCallback(() => {
    setInventoryOpen(false);
    const canvas =
      document.querySelector<HTMLCanvasElement>(".voxel-game canvas");
    void canvas?.requestPointerLock();
  }, []);

  const finishTutorial = useCallback(
    async (skipped: boolean) => {
      if (!player) return;
      const next: PlayerWorldState = {
        ...player,
        quest: {
          ...normalizeNexusQuestState(player.quest),
          tutorialCompleted: !skipped,
          tutorialSkipped: skipped,
        },
        revision: player.revision + 1,
        lastPlayedAt: new Date().toISOString(),
      };
      setPlayer(next);
      await putLocalPlayer(next);
      window.dispatchEvent(
        new CustomEvent("fangyu-tutorial", {
          detail: skipped ? "skip" : "complete",
        }),
      );
      setTutorialPage(null);
    },
    [player],
  );

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
        {hud.oxygen < 20 && (
          <div className="oxygen" aria-label={`氧氣 ${hud.oxygen}`}>
            <span>OXYGEN</span>
            <i style={{ width: `${hud.oxygen * 5}%` }} />
          </div>
        )}
      </div>
      <div className="biome-indicator">
        {hud.biome} · {hud.weather.toUpperCase()}
      </div>
      <QuestTracker
        quest={hud.quest}
        message={hud.questMessage}
        openJournal={() => {
          document.exitPointerLock();
          setQuestOpen(true);
        }}
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
      {(paused || inventoryOpen) && tutorialPage === null && !questOpen && (
        <PauseLayer
          world={world}
          inventoryOpen={inventoryOpen}
          hud={hud}
          resume={resume}
          setInventoryOpen={setInventoryOpen}
          openQuest={() => setQuestOpen(true)}
          save={async () => saveRef.current()}
        />
      )}
      {questOpen && (
        <QuestJournal
          quest={hud.quest}
          close={() => {
            setQuestOpen(false);
            resume();
          }}
        />
      )}
      {tutorialPage !== null && (
        <TutorialOverlay
          page={tutorialPage}
          setPage={setTutorialPage}
          finish={(skipped) => void finishTutorial(skipped)}
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
  message,
  openJournal,
}: {
  quest: NexusQuestState;
  message: string;
  openJournal: () => void;
}) {
  const current = getCurrentQuest(quest);
  const complete = quest.postGame;
  return (
    <aside className={`quest-tracker${complete ? " complete" : ""}`}>
      <button type="button" onClick={openJournal}>
        <strong>{complete ? "NEXUS NETWORK RESTORED" : "NEXUS JOURNEY"}</strong>
        <b>LEVEL {current.level} / 50</b>
        <span>{current.title}</span>
        {current.objectives.slice(0, 4).map((entry) => {
          const progress = objectiveProgress(quest, entry);
          const done = progress >= entry.target;
          return (
            <small key={entry.id} className={done ? "done" : ""}>
              {done ? "✓" : "□"} {entry.label} {progress}/{entry.target}
            </small>
          );
        })}
      </button>
      <small>{message}</small>
    </aside>
  );
}

function QuestJournal({
  quest,
  close,
}: {
  quest: NexusQuestState;
  close: () => void;
}) {
  const current = getCurrentQuest(quest);
  return (
    <div className="game-modal-backdrop quest-journal-backdrop">
      <section className="quest-journal" role="dialog" aria-modal="true">
        <header>
          <div>
            <p className="eyebrow">NEXUS JOURNEY</p>
            <h2>
              LEVEL {current.level} / 50 · {current.title}
            </h2>
            <p>{current.description}</p>
          </div>
          <button type="button" onClick={close}>
            關閉
          </button>
        </header>
        <div className="quest-journal-layout">
          <nav aria-label="主線關卡">
            {MAIN_QUESTS.map((entry) => {
              const done = quest.completedQuestIds.includes(entry.id);
              const active = entry.id === current.id;
              return (
                <span
                  key={entry.id}
                  className={`${done ? "done" : ""}${active ? " active" : ""}`}
                >
                  {done ? "✓" : active ? "◆" : "·"} {entry.level}. {entry.title}
                </span>
              );
            })}
          </nav>
          <main>
            <h3>目前目標</h3>
            {current.objectives.map((entry) => {
              const progress = objectiveProgress(quest, entry);
              return (
                <p key={entry.id}>
                  {progress >= entry.target ? "✓" : "□"} {entry.label} —{" "}
                  {progress}/{entry.target}
                </p>
              );
            })}
            <h3>獎勵</h3>
            {current.rewards.map((reward) => (
              <p key={reward.label}>{reward.label}</p>
            ))}
            <h3>Nexus Network</h3>
            <p>已修復節點：{quest.repairedNodeIds.length}</p>
            <p>已發現生態系：{quest.discoveredBiomes.length}</p>
            <p>已發現地標：{quest.discoveredStructures.length}</p>
            <h3>Side Quests</h3>
            <p>目前沒有已接受的支線任務。</p>
          </main>
        </div>
      </section>
    </div>
  );
}

const TUTORIAL_PAGES = [
  [
    "Welcome to 方域 Nexus",
    "這是一個可永久探索、建築與生存的原創 voxel 世界。Nexus Journey 提供方向，但不限制你的沙盒自由。",
  ],
  [
    "Movement",
    "WASD 移動、滑鼠環視、Space 跳躍、Shift 衝刺。Esc 可釋放滑鼠並暫停。",
  ],
  [
    "Mining",
    "用準星對準方塊並按左鍵。破壞後的材料會掉在世界中，靠近即可拾取。",
  ],
  [
    "Building",
    "選擇快捷列物品並按右鍵放置。系統會阻止你把方塊放進自己的碰撞箱。",
  ],
  ["Inventory", "按 E 開啟 36 格背包與 9 格快捷列；按 1–9 選擇欄位。"],
  [
    "Crafting",
    "背包中的配方會消耗材料並立即產生新物品。後續主線會解鎖更多原創方域設備。",
  ],
  [
    "Health / Hunger",
    "高處落下與敵對生物會降低生命；衝刺會消耗飢餓。生命歸零後可在安全出生點重生。",
  ],
  [
    "Animals",
    "世界生物有自己的移動、生命與掉落架構。動物照料會成為主線的一部分。",
  ],
  [
    "Farming",
    "農耕系統會讓你建立可持續的食物來源，作物成長會納入世界存檔時間。",
  ],
  [
    "Villages",
    "遠方聚落將提供居民互動、交易與支線任務，主線不會強迫你立刻離開自己的基地。",
  ],
  [
    "Nexus Journey",
    "主線共有 50 關並依序解鎖。按 J 開啟任務日誌；跳過教學不會跳過 Level 1。",
  ],
] as const;

function TutorialOverlay({
  page,
  setPage,
  finish,
}: {
  page: number;
  setPage: (page: number) => void;
  finish: (skipped: boolean) => void;
}) {
  const entry = TUTORIAL_PAGES[page]!;
  const last = page === TUTORIAL_PAGES.length - 1;
  return (
    <div className="game-modal-backdrop tutorial-backdrop">
      <section className="tutorial-panel" role="dialog" aria-modal="true">
        <p className="eyebrow">
          FIELD GUIDE · {page + 1} / {TUTORIAL_PAGES.length}
        </p>
        <h2>{entry[0]}</h2>
        <p>{entry[1]}</p>
        <div className="tutorial-progress">
          {TUTORIAL_PAGES.map((_, index) => (
            <i key={index} className={index <= page ? "active" : ""} />
          ))}
        </div>
        <div className="tutorial-actions">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            BACK
          </button>
          <button
            type="button"
            className="primary-link"
            onClick={() => (last ? finish(false) : setPage(page + 1))}
          >
            {last ? "ENTER WORLD" : "NEXT"}
          </button>
          <button type="button" onClick={() => finish(true)}>
            SKIP TUTORIAL
          </button>
        </div>
      </section>
    </div>
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
  openQuest,
  save,
}: {
  world: GameWorldMetadata;
  inventoryOpen: boolean;
  hud: HudState;
  resume: () => void;
  setInventoryOpen: (open: boolean) => void;
  openQuest: () => void;
  save: () => Promise<void>;
}) {
  const [craftMessage, setCraftMessage] = useState("");
  const [dragSource, setDragSource] = useState<number | null>(null);
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
                  <div
                    key={index}
                    draggable={Boolean(stack)}
                    aria-label={
                      stack ? `${block.name} × ${stack.count}` : "空格"
                    }
                    onDragStart={() => setDragSource(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (dragSource === null) return;
                      window.dispatchEvent(
                        new CustomEvent("fangyu-inventory-move", {
                          detail: { from: dragSource, to: index },
                        }),
                      );
                      setDragSource(null);
                    }}
                    onDragEnd={() => setDragSource(null)}
                  >
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
            <button type="button" onClick={openQuest}>
              Quest Journal
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
          <span>R 與動物互動</span>
          <span>H 收成成熟作物</span>
          <span>J 任務日誌</span>
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

function DroppedItemField({ drops }: { drops: readonly RenderDrop[] }) {
  return (
    <group>
      {drops.map((drop) => {
        const color = getBlockDefinition(drop.itemId).color;
        return (
          <mesh
            key={drop.id}
            position={drop.position}
            rotation={[0.3, 0.55, 0.1]}
          >
            <octahedronGeometry args={[0.17, 0]} />
            <meshStandardMaterial
              color={new THREE.Color(...color)}
              emissive={new THREE.Color(...color)}
              emissiveIntensity={0.18}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function CropField({ crops }: { crops: readonly RenderCrop[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const elapsed = useRef(1);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const update = useCallback(() => {
    if (!mesh.current) return;
    crops.forEach((crop, index) => {
      const stage = cropGrowthStage(crop);
      const height = 0.22 + stage * 0.2;
      dummy.position.set(
        crop.position[0],
        crop.position[1] + height / 2,
        crop.position[2],
      );
      dummy.scale.set(1 + stage * 0.12, height, 1 + stage * 0.12);
      dummy.rotation.y = index * 1.7;
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(index, dummy.matrix);
    });
    mesh.current.count = crops.length;
    mesh.current.instanceMatrix.needsUpdate = true;
  }, [crops, dummy]);
  useEffect(update, [update]);
  useFrame((_, delta) => {
    elapsed.current += delta;
    if (elapsed.current > 2) {
      elapsed.current = 0;
      update();
    }
  });
  if (crops.length === 0) return null;
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, crops.length]}>
      <boxGeometry args={[0.28, 1, 0.28]} />
      <meshLambertMaterial color="#d7b540" />
    </instancedMesh>
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
    requestedEntities = useRef(new Map<string, WorldEntity[]>()),
    worker = useRef<Worker | null>(null),
    requestId = useRef(0);
  const [renderChunks, setRenderChunks] = useState<RenderChunk[]>([]);
  const [renderDrops, setRenderDrops] = useState<RenderDrop[]>([]);
  const [renderCrops, setRenderCrops] = useState<RenderCrop[]>([]);
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
    oxygen = useRef(20),
    dead = useRef(false);
  const quest = useRef(normalizeNexusQuestState(initialPlayer.quest)),
    questMessage = useRef("Nexus 信標已同步：尋找節點並修復它們。"),
    nexusNodes = useMemo(() => getNexusNodes(world.seed), [world.seed]),
    landmarks = useMemo(() => getWorldLandmarks(world.seed), [world.seed]);
  const timeOfDay = useRef(world.timeOfDay),
    hit = useRef<RaycastHit | null>(null),
    accumulator = useRef(0),
    lastChunkScan = useRef(0),
    lastHud = useRef(0),
    fpsFrames = useRef(0),
    fpsTime = useRef(0),
    fps = useRef(0),
    saveTimer = useRef(0),
    questTravelTimer = useRef(0),
    questEventSequence = useRef(0),
    lastQuestPosition = useRef(position.current.clone()),
    currentBiome = useRef(
      getBiomeAt(world.seed, position.current.x, position.current.z),
    ),
    currentWeather = useRef<WeatherType>("clear"),
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

  const publishChunks = useCallback(() => {
    setRenderChunks(
      Array.from(chunks.current, ([key, chunk]) => ({
        key,
        revision: chunk.data.revision,
        mesh: chunk.mesh,
      })),
    );
    setRenderDrops(
      Array.from(chunks.current, ([key, chunk]) =>
        chunk.entities
          .filter(
            (entity): entity is DroppedItemEntity =>
              entity.kind === "dropped-item",
          )
          .map((entity) => ({ ...entity, key })),
      ).flat(),
    );
    setRenderCrops(
      Array.from(chunks.current, ([key, chunk]) =>
        chunk.entities
          .filter((entity): entity is CropEntity => entity.kind === "crop")
          .map((entity) => ({ ...entity, key })),
      ).flat(),
    );
  }, []);

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
      requestedEntities.current.set(
        key,
        existing?.entities ?? local?.entities ?? [],
      );
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
        entities:
          previous?.entities ?? requestedEntities.current.get(key) ?? [],
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

  const emitQuestEvent = useCallback(
    (event: Omit<GameplayEvent, "id"> & { id?: string }) => {
      const result = applyGameplayEvent(quest.current, {
        ...event,
        id:
          event.id ??
          `${world.id}:${Date.now()}:${++questEventSequence.current}`,
      });
      quest.current = result.state;
      if (result.completedLevel) {
        const next = getCurrentQuest(result.state);
        questMessage.current = result.state.postGame
          ? "NEXUS NETWORK RESTORED · 世界進入永久 post-game 沙盒。"
          : `Level ${result.completedLevel} 完成 · Level ${next.level} ${next.title} 已解鎖。`;
        beep(740);
      }
    },
    [beep, world.id],
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
        emitQuestEvent({
          type: "mine",
          key: getBlockDefinition(current.blockId).key,
        });
        if (world.gameMode === "survival") {
          for (const loot of getBlockLoot(current.blockId))
            chunk.entities.push({
              id: crypto.randomUUID(),
              kind: "dropped-item",
              itemId: loot.itemId,
              count: loot.count,
              position: [
                current.block.x + 0.5,
                current.block.y + 0.55,
                current.block.z + 0.5,
              ],
              createdAt: new Date().toISOString(),
            });
        }
        void requestChunk(coordinate.x, coordinate.z, chunk);
        publishChunks();
        beep(132);
      } else if (button === 2) {
        const stack = inventory.current[selected.current];
        if (!stack) return;
        if (stack.blockId === BlockId.FieldSeed) {
          const target = current.previous;
          const soil = lookup(target.x, target.y - 1, target.z);
          if (soil !== BlockId.Loam && soil !== BlockId.Verdant) return;
          const coordinate = worldToChunk(target.x, target.z),
            chunk = chunks.current.get(chunkKey(coordinate.x, coordinate.z));
          if (!chunk) return;
          chunk.entities.push({
            id: crypto.randomUUID(),
            kind: "crop",
            cropId: "sungrain",
            position: [target.x + 0.5, target.y, target.z + 0.5],
            plantedAt: new Date().toISOString(),
            growthSeconds: 120,
          });
          chunk.dirty = true;
          inventory.current =
            removeFromInventory(inventory.current, selected.current, 1) ??
            inventory.current;
          emitQuestEvent({ type: "place", key: "crop" });
          publishChunks();
          beep(285);
          return;
        }
        if (
          stack.blockId === BlockId.TrailRation ||
          stack.blockId === BlockId.MeadowMilk
        ) {
          if (hunger.current >= 20) return;
          inventory.current =
            removeFromInventory(inventory.current, selected.current, 1) ??
            inventory.current;
          hunger.current = Math.min(
            20,
            hunger.current + (stack.blockId === BlockId.TrailRation ? 8 : 3),
          );
          beep(330);
          return;
        }
        if (!getBlockDefinition(stack.blockId).solid) return;
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
        emitQuestEvent({
          type: "place",
          key: getBlockDefinition(stack.blockId).key,
        });
        if (
          isShelterComplete(
            [position.current.x, position.current.y, position.current.z],
            lookup,
          )
        )
          emitQuestEvent({
            id: `shelter:${world.id}`,
            type: "build",
            key: "shelter",
          });
        if (world.gameMode === "survival")
          inventory.current =
            removeFromInventory(inventory.current, selected.current, 1) ??
            inventory.current;
        void requestChunk(coordinate.x, coordinate.z, chunk);
        beep(196);
      }
    },
    [beep, emitQuestEvent, lookup, publishChunks, requestChunk, world.gameMode],
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
    emitQuestEvent({ type: "repairNode", key: nearest.node.id });
    questMessage.current = `${nearest.node.name} 已修復。Nexus Journey 已記錄進度。`;
    beep(660);
  }, [beep, emitQuestEvent, nexusNodes]);

  const harvestNearestCrop = useCallback(() => {
    for (const chunk of chunks.current.values()) {
      const crop = chunk.entities
        .filter((entity): entity is CropEntity => entity.kind === "crop")
        .map((entity) => ({
          entity,
          distance: Math.hypot(
            entity.position[0] - position.current.x,
            entity.position[1] - position.current.y,
            entity.position[2] - position.current.z,
          ),
        }))
        .filter((entry) => entry.distance <= 2.4)
        .sort((a, b) => a.distance - b.distance)[0]?.entity;
      if (!crop) continue;
      if (!isCropMature(crop)) {
        questMessage.current = `日穗尚未成熟（階段 ${cropGrowthStage(crop) + 1}/4）。`;
        return;
      }
      const grain = addToInventoryWithRemainder(
        inventory.current,
        BlockId.Sungrain,
        2,
      );
      const seeds = addToInventoryWithRemainder(
        grain.inventory,
        BlockId.FieldSeed,
        2,
      );
      if (grain.remaining > 0 || seeds.remaining > 0) {
        questMessage.current = "背包已滿，無法收成。";
        return;
      }
      inventory.current = seeds.inventory;
      chunk.entities = chunk.entities.filter((entity) => entity.id !== crop.id);
      chunk.dirty = true;
      publishChunks();
      emitQuestEvent({ type: "harvest", key: "crop", amount: 1 });
      questMessage.current = "收成日穗與新種子。";
      beep(590);
      return;
    }
    questMessage.current = "附近沒有可收成的作物。";
  }, [beep, emitQuestEvent, publishChunks]);

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
          entities: chunk.entities,
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
                entities: chunk.entities,
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
      if (event.code === "KeyJ") {
        event.preventDefault();
        document.exitPointerLock();
        window.dispatchEvent(new CustomEvent("fangyu-journal"));
      }
      if (event.code === "KeyR") {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("fangyu-creature-interact"));
      }
      if (event.code === "KeyH") {
        event.preventDefault();
        harvestNearestCrop();
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
        emitQuestEvent({ type: "craft", key: recipe.id });
        if (recipe.output.blockId === BlockId.TrailRation)
          emitQuestEvent({
            type: "collect",
            key: "food",
            amount: recipe.output.count,
          });
        beep(440);
      }
    };
    const onInventoryMove = (event: Event) => {
      const detail = (event as CustomEvent<{ from: number; to: number }>)
        .detail;
      inventory.current = moveInventoryStack(
        inventory.current,
        detail.from,
        detail.to,
      );
      beep(300);
    };
    const onTutorial = (event: Event) => {
      const action = (event as CustomEvent<"skip" | "complete">).detail;
      quest.current = {
        ...quest.current,
        tutorialCompleted: action === "complete",
        tutorialSkipped: action === "skip",
      };
      void save();
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
    window.addEventListener("fangyu-inventory-move", onInventoryMove);
    window.addEventListener("fangyu-tutorial", onTutorial);
    window.addEventListener("fangyu-respawn", onRespawn);
    return () => {
      document.removeEventListener("pointerlockchange", onLock);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("fangyu-craft", onCraft);
      window.removeEventListener("fangyu-inventory-move", onInventoryMove);
      window.removeEventListener("fangyu-tutorial", onTutorial);
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
    harvestNearestCrop,
    emitQuestEvent,
    save,
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
          inWater =
            lookup(
              Math.floor(position.current.x),
              Math.floor(position.current.y + 0.8),
              Math.floor(position.current.z),
            ) === BlockId.Water,
          speed = inWater
            ? 2.7
            : (sprint ? 7.2 : 4.5) *
              (keys.current.has("ControlLeft") ? 0.45 : 1);
        const sin = Math.sin(yaw.current),
          cos = Math.cos(yaw.current);
        velocity.current.x = ((-sin * forward + cos * strafe) / length) * speed;
        velocity.current.z = ((-cos * forward - sin * strafe) / length) * speed;
        if (inWater) {
          velocity.current.y *= 0.82;
          velocity.current.y +=
            (Number(keys.current.has("Space")) -
              Number(keys.current.has("ControlLeft"))) *
            7.5 *
            dt;
        } else if (keys.current.has("Space") && grounded.current) {
          velocity.current.y = 8;
          grounded.current = false;
          beep(260);
        }
        velocity.current.y -= (inWater ? 3.2 : 22) * dt;
        const headUnderwater =
          lookup(
            Math.floor(position.current.x),
            Math.floor(position.current.y + 1.62),
            Math.floor(position.current.z),
          ) === BlockId.Water;
        oxygen.current = headUnderwater
          ? Math.max(0, oxygen.current - dt * 1.2)
          : Math.min(20, oxygen.current + dt * 5);
        if (oxygen.current <= 0 && world.gameMode === "survival")
          health.current = Math.max(0, health.current - dt * 0.8);
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
    questTravelTimer.current += delta;
    if (questTravelTimer.current >= 1) {
      const travelled = position.current.distanceTo(lastQuestPosition.current);
      if (travelled > 0.15)
        emitQuestEvent({ type: "travel", amount: travelled });
      lastQuestPosition.current.copy(position.current);
      questTravelTimer.current = 0;
      const biome = getBiomeAt(
        world.seed,
        position.current.x,
        position.current.z,
      );
      currentBiome.current = biome;
      currentWeather.current = getWeatherAt(
        world.seed,
        timeOfDay.current,
        position.current.x,
        position.current.z,
      );
      if (!quest.current.discoveredBiomes.includes(biome.id)) {
        quest.current = {
          ...quest.current,
          discoveredBiomes: [...quest.current.discoveredBiomes, biome.id],
        };
        emitQuestEvent({
          id: `biome:${biome.id}`,
          type: "discoverBiome",
          key: biome.id,
        });
        questMessage.current = `發現生態系：${biome.name}`;
      }
      for (const landmark of landmarks) {
        if (
          quest.current.discoveredStructures.includes(landmark.id) ||
          Math.hypot(
            position.current.x - landmark.x,
            position.current.z - landmark.z,
          ) > 20
        )
          continue;
        quest.current = {
          ...quest.current,
          discoveredStructures: [
            ...quest.current.discoveredStructures,
            landmark.id,
          ],
        };
        emitQuestEvent({
          id: `structure:${landmark.id}`,
          type: "discoverStructure",
          key: landmark.type,
        });
        questMessage.current = `發現地標：${landmark.name}`;
      }
    }
    // Item pickup is simulation-rate limited by the HUD cadence, not a React rerender.
    if (lastHud.current > 0.1) {
      let changed = false;
      for (const chunk of chunks.current.values()) {
        const remaining: WorldEntity[] = [];
        for (const entity of chunk.entities) {
          if (entity.kind !== "dropped-item") {
            remaining.push(entity);
            continue;
          }
          const distance = Math.hypot(
            entity.position[0] - position.current.x,
            entity.position[1] - (position.current.y + 0.8),
            entity.position[2] - position.current.z,
          );
          if (distance > 1.35 || dead.current) {
            remaining.push(entity);
            continue;
          }
          const picked = pickupDroppedItem(inventory.current, entity);
          inventory.current = picked.inventory;
          if (picked.remaining) remaining.push(picked.remaining);
          if (picked.pickedUp > 0) {
            const itemKey = getBlockDefinition(entity.itemId).key;
            emitQuestEvent({
              type: "collect",
              key: itemKey,
              amount: picked.pickedUp,
              id: `pickup:${entity.id}:${entity.count - (picked.remaining?.count ?? 0)}`,
            });
            if (
              entity.itemId === BlockId.SunShard ||
              entity.itemId === BlockId.DuskShard ||
              entity.itemId === BlockId.GlowCrystal
            )
              emitQuestEvent({
                type: "collect",
                key: "nexus-crystal",
                amount: picked.pickedUp,
                id: `pickup-crystal:${entity.id}:${entity.count - (picked.remaining?.count ?? 0)}`,
              });
            if (entity.itemId === BlockId.SunEgg)
              emitQuestEvent({
                type: "animalProduct",
                key: "egg",
                amount: picked.pickedUp,
                id: `pickup-egg:${entity.id}:${entity.count - (picked.remaining?.count ?? 0)}`,
              });
            if (
              entity.itemId === BlockId.SunEgg ||
              entity.itemId === BlockId.Sungrain ||
              entity.itemId === BlockId.TrailRation ||
              entity.itemId === BlockId.MeadowMilk
            )
              emitQuestEvent({
                type: "collect",
                key: "food",
                amount: picked.pickedUp,
                id: `pickup-food:${entity.id}:${entity.count - (picked.remaining?.count ?? 0)}`,
              });
            changed = true;
            chunk.dirty = true;
            beep(355);
          }
        }
        chunk.entities = remaining;
      }
      if (changed) publishChunks();
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
        oxygen: oxygen.current,
        biome: currentBiome.current.name,
        weather: currentWeather.current,
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

  const spawnWorldDrop = useCallback(
    (itemId: BlockIdValue, dropPosition: readonly [number, number, number]) => {
      const coordinate = worldToChunk(dropPosition[0], dropPosition[2]);
      const chunk = chunks.current.get(chunkKey(coordinate.x, coordinate.z));
      if (!chunk) return false;
      chunk.entities.push({
        id: crypto.randomUUID(),
        kind: "dropped-item",
        itemId,
        count: 1,
        position: dropPosition,
        createdAt: new Date().toISOString(),
      });
      chunk.dirty = true;
      publishChunks();
      return true;
    },
    [publishChunks],
  );

  const obtainAnimalProduct = useCallback(
    (species: "cow" | "sheep") => {
      if (species === "cow") {
        const withoutFlask = consumeInventoryItem(
          inventory.current,
          BlockId.EmptyFlask,
          1,
        );
        if (!withoutFlask) {
          questMessage.current = "需要空野行瓶才能取得牧野乳。";
          return false;
        }
        const filled = addToInventoryWithRemainder(
          withoutFlask,
          BlockId.MeadowMilk,
          1,
        );
        if (filled.remaining > 0) return false;
        inventory.current = filled.inventory;
        emitQuestEvent({ type: "animalProduct", key: "milk" });
        emitQuestEvent({ type: "collect", key: "food" });
        questMessage.current = "取得牧野乳。";
        beep(520);
        return true;
      }
      if (countInventoryItem(inventory.current, BlockId.FiberShears) < 1) {
        questMessage.current = "需要纖維剪才能取得雲絨。";
        return false;
      }
      const wool = addToInventoryWithRemainder(
        inventory.current,
        BlockId.CloudWool,
        1,
      );
      if (wool.remaining > 0) return false;
      inventory.current = wool.inventory;
      emitQuestEvent({ type: "animalProduct", key: "wool" });
      questMessage.current = "取得雲絨；牠會隨時間重新長出毛層。";
      beep(480);
      return true;
    },
    [beep, emitQuestEvent],
  );

  const interactNpc = useCallback(
    (role: string, name: string) => {
      emitQuestEvent({ type: "interactNPC", key: role });
      if (role === "trader") {
        const paid = consumeInventoryItem(inventory.current, BlockId.Dune, 2);
        if (paid) {
          const received = addToInventoryWithRemainder(
            paid,
            BlockId.FieldSeed,
            2,
          );
          if (received.remaining === 0) {
            inventory.current = received.inventory;
            emitQuestEvent({ type: "trade", key: "field-seed" });
            questMessage.current = `${name}：交易完成，2 星砂換得 2 日穗種子。`;
            beep(610);
            return;
          }
        }
        questMessage.current = `${name}：準備 2 星砂並保留背包空間，我能交換日穗種子。`;
        return;
      }
      questMessage.current = `${name}（${role}）：聚落今天也在運作。`;
      beep(410);
    },
    [beep, emitQuestEvent],
  );

  return (
    <>
      <hemisphereLight intensity={0.45} color="#bdefff" groundColor="#18201c" />
      <directionalLight ref={sun} intensity={1.2} position={[40, 70, 30]} />
      {renderChunks.map((chunk) => (
        <ChunkMesh key={`${chunk.key}:${chunk.revision}`} chunk={chunk} />
      ))}
      <DroppedItemField drops={renderDrops} />
      <CropField crops={renderCrops} />
      <SelectionOutline hit={hit.current} />
      <NexusNodeField
        nodes={nexusNodes}
        repairedNodeIds={quest.current.repairedNodeIds}
      />
      <CreatureField
        seed={world.seed}
        player={position}
        paused={paused}
        onDrop={spawnWorldDrop}
        onProduct={obtainAnimalProduct}
        damage={(amount) => {
          if (world.gameMode === "survival")
            health.current = Math.max(0, health.current - amount);
        }}
      />
      <NpcVillageField
        village={landmarks.find((landmark) => landmark.type === "village")!}
        seed={world.seed}
        player={position}
        paused={paused}
        timeOfDay={timeOfDay}
        onInteract={interactNpc}
      />
      <AtmosphereField
        seed={world.seed}
        player={position}
        timeOfDay={timeOfDay}
      />
    </>
  );
}

function CreatureField({
  seed,
  player,
  paused,
  onDrop,
  onProduct,
  damage,
}: {
  seed: string;
  player: RefObject<THREE.Vector3>;
  paused: boolean;
  onDrop: (
    itemId: BlockIdValue,
    position: readonly [number, number, number],
  ) => boolean;
  onProduct: (species: "cow" | "sheep") => boolean;
  damage: (amount: number) => void;
}) {
  const { camera } = useThree();
  const [, redraw] = useState(0);
  const creatures = useMemo(() => {
    const ocean = findBiomeSpot(seed, "ocean");
    const entries = [
      ["chicken", 7, 6, 6, "#e6bd57"],
      ["cow", 11, 4, 12, "#9b6a43"],
      ["pig", -8, 7, 10, "#d98586"],
      ["sheep", -11, -5, 8, "#d9e4df"],
      ["rabbit", 4, -10, 5, "#b89b79"],
      ["fish", ocean[0], ocean[1], 4, "#48a9c9"],
      ["riftling", -7, -8, 9, "#7d4ab2"],
    ] as const;
    return entries.map(([species, x, z, health, color], index) => ({
      id: `${species}-${index}`,
      species,
      color,
      health,
      alive: true,
      mesh: null as THREE.Group | null,
      position: new THREE.Vector3(
        x,
        species === "fish" ? SEA_LEVEL - 1.2 : terrainHeight(seed, x, z) + 0.55,
        z,
      ),
      heading: index * 0.83,
      think: 1.4 + index * 0.6,
      productReadyAt: 0,
      eggClock: species === "chicken" ? 70 : Infinity,
      attackClock: 0,
    }));
  }, [seed]);

  useEffect(() => {
    const attack = () => {
      const targets = creatures
        .filter((creature) => creature.alive && creature.mesh)
        .map((creature) => creature.mesh!);
      const raycaster = new THREE.Raycaster();
      raycaster.far = 4.5;
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const hitObject = raycaster.intersectObjects(targets, true)[0]?.object;
      const creatureId = hitObject?.userData.creatureId as string | undefined;
      const target = creatures.find((creature) => creature.id === creatureId);
      if (!target) return;
      target.health -= 3;
      if (target.health > 0) return;
      target.alive = false;
      const drop =
        target.species === "chicken"
          ? BlockId.SunEgg
          : target.species === "sheep"
            ? BlockId.CloudWool
            : BlockId.TrailRation;
      onDrop(drop, [target.position.x, target.position.y, target.position.z]);
      redraw((value) => value + 1);
    };
    const interact = () => {
      const nearest = creatures
        .filter(
          (creature) =>
            creature.alive &&
            (creature.species === "cow" || creature.species === "sheep"),
        )
        .map((creature) => ({
          creature,
          distance: creature.position.distanceTo(player.current),
        }))
        .sort((a, b) => a.distance - b.distance)[0];
      if (!nearest || nearest.distance > 3.2) return;
      const species = nearest.creature.species as "cow" | "sheep";
      if (performance.now() < nearest.creature.productReadyAt) return;
      if (onProduct(species))
        nearest.creature.productReadyAt =
          performance.now() + (species === "cow" ? 45_000 : 120_000);
    };
    window.addEventListener("fangyu-attack", attack);
    window.addEventListener("fangyu-creature-interact", interact);
    return () => {
      window.removeEventListener("fangyu-attack", attack);
      window.removeEventListener("fangyu-creature-interact", interact);
    };
  }, [camera, creatures, onDrop, onProduct, player]);
  useFrame((_, delta) => {
    if (paused) return;
    for (const creature of creatures) {
      if (!creature.alive || !creature.mesh) continue;
      const distanceToPlayer = creature.position.distanceTo(player.current);
      if (distanceToPlayer > 52) {
        creature.mesh.visible = false;
        continue;
      }
      creature.mesh.visible = true;
      if (creature.species === "fish") {
        creature.heading += delta * 0.12;
        creature.position.x += Math.sin(creature.heading) * delta * 0.55;
        creature.position.z += Math.cos(creature.heading) * delta * 0.55;
        creature.position.y =
          SEA_LEVEL - 1.5 + Math.sin(performance.now() / 900) * 0.35;
      } else if (creature.species === "riftling") {
        const target = player.current,
          dx = target.x - creature.position.x,
          dz = target.z - creature.position.z,
          distance = Math.hypot(dx, dz);
        if (distance < 14 && distance > 1) {
          creature.position.x += (dx / distance) * delta * 1.45;
          creature.position.z += (dz / distance) * delta * 1.45;
        }
        creature.attackClock -= delta;
        if (distance < 1.5 && creature.attackClock <= 0) {
          damage(2);
          creature.attackClock = 1.2;
        }
        creature.position.y =
          terrainHeight(seed, creature.position.x, creature.position.z) + 0.7;
      } else {
        creature.think -= delta;
        if (creature.think <= 0) {
          creature.heading += 0.8 + Math.sin(performance.now() * 0.00031);
          creature.think = 2.5 + (creature.id.length % 4);
        }
        if (distanceToPlayer < 3.2)
          creature.heading = Math.atan2(
            creature.position.x - player.current.x,
            creature.position.z - player.current.z,
          );
        const speed =
          creature.species === "rabbit"
            ? 1.45
            : distanceToPlayer < 3.2
              ? 1.2
              : 0.42;
        creature.position.x += Math.sin(creature.heading) * delta * speed;
        creature.position.z += Math.cos(creature.heading) * delta * speed;
        creature.position.y =
          terrainHeight(seed, creature.position.x, creature.position.z) +
          (creature.species === "rabbit" ? 0.32 : 0.55);
        if (creature.species === "rabbit")
          creature.position.y +=
            Math.abs(Math.sin(performance.now() / 260)) * 0.35;
        if (creature.species === "chicken") {
          creature.eggClock -= delta;
          if (creature.eggClock <= 0) {
            if (
              onDrop(BlockId.SunEgg, [
                creature.position.x,
                creature.position.y,
                creature.position.z,
              ])
            )
              creature.eggClock = 75 + (creature.id.length % 20);
          }
        }
      }
      creature.mesh.position.copy(creature.position);
      creature.mesh.rotation.y = creature.heading;
    }
  });
  return (
    <group>
      {creatures.map((creature) => (
        <group
          key={creature.id}
          ref={(node) => {
            creature.mesh = node;
          }}
          visible={creature.alive}
          position={creature.position}
        >
          <mesh userData={{ creatureId: creature.id }}>
            <boxGeometry
              args={
                creature.species === "rabbit"
                  ? [0.55, 0.5, 0.7]
                  : creature.species === "fish"
                    ? [0.75, 0.35, 0.35]
                    : creature.species === "chicken"
                      ? [0.65, 0.65, 0.8]
                      : creature.species === "riftling"
                        ? [0.8, 1.35, 0.8]
                        : [1.15, 0.9, 1.5]
              }
            />
            <meshLambertMaterial
              color={creature.color}
              emissive={creature.species === "riftling" ? "#27103b" : "#000000"}
            />
          </mesh>
          {creature.species !== "fish" && creature.species !== "riftling" && (
            <mesh
              position={[0, creature.species === "rabbit" ? 0.2 : 0.2, 0.58]}
              userData={{ creatureId: creature.id }}
            >
              <boxGeometry args={[0.55, 0.5, 0.5]} />
              <meshLambertMaterial color={creature.color} />
            </mesh>
          )}
          {creature.species === "rabbit" && (
            <>
              <mesh position={[-0.16, 0.55, 0.5]}>
                <boxGeometry args={[0.13, 0.55, 0.13]} />
                <meshLambertMaterial color={creature.color} />
              </mesh>
              <mesh position={[0.16, 0.55, 0.5]}>
                <boxGeometry args={[0.13, 0.55, 0.13]} />
                <meshLambertMaterial color={creature.color} />
              </mesh>
            </>
          )}
        </group>
      ))}
    </group>
  );
}

function findBiomeSpot(
  seed: string,
  biomeId: string,
): readonly [number, number] {
  for (let radius = 32; radius <= 320; radius += 16)
    for (let step = 0; step < 24; step += 1) {
      const angle = (step / 24) * Math.PI * 2;
      const x = Math.round(Math.cos(angle) * radius);
      const z = Math.round(Math.sin(angle) * radius);
      if (getBiomeAt(seed, x, z).id === biomeId) return [x, z];
    }
  return [160, 160];
}

function NpcVillageField({
  village,
  seed,
  player,
  paused,
  timeOfDay,
  onInteract,
}: {
  village: WorldLandmark;
  seed: string;
  player: RefObject<THREE.Vector3>;
  paused: boolean;
  timeOfDay: RefObject<number>;
  onInteract: (role: string, name: string) => void;
}) {
  const villagers = useMemo(() => {
    const definitions = [
      ["Mira", "farmer", -10, -9, -2, 9, "#71ad56"],
      ["Tor", "crafter", 10, -8, 3, -2, "#c77b4e"],
      ["Sela", "trader", -9, 10, 0, 0, "#d5b64d"],
      ["Ivo", "explorer", 11, 9, 7, 3, "#4e9fc7"],
      ["Nara", "nexus-researcher", 11, 9, -5, -3, "#a46dcc"],
    ] as const;
    return definitions.map(([name, role, hx, hz, wx, wz, color], index) => {
      const home = new THREE.Vector3(
        village.x + hx,
        terrainHeight(seed, village.x + hx, village.z + hz) + 1,
        village.z + hz,
      );
      const work = new THREE.Vector3(
        village.x + wx,
        terrainHeight(seed, village.x + wx, village.z + wz) + 1,
        village.z + wz,
      );
      return {
        id: `settler-${index}`,
        name,
        role,
        color,
        home,
        work,
        position: home.clone(),
        mesh: null as THREE.Group | null,
      };
    });
  }, [seed, village.x, village.z]);

  useEffect(() => {
    const interact = () => {
      const nearest = villagers
        .map((villager) => ({
          villager,
          distance: villager.position.distanceTo(player.current),
        }))
        .sort((a, b) => a.distance - b.distance)[0];
      if (nearest && nearest.distance <= 3.2)
        onInteract(nearest.villager.role, nearest.villager.name);
    };
    window.addEventListener("fangyu-creature-interact", interact);
    return () =>
      window.removeEventListener("fangyu-creature-interact", interact);
  }, [onInteract, player, villagers]);

  useFrame((_, delta) => {
    if (paused) return;
    const day = timeOfDay.current >= 0.18 && timeOfDay.current <= 0.72;
    for (const [index, villager] of villagers.entries()) {
      if (!villager.mesh) continue;
      const distance = villager.position.distanceTo(player.current);
      villager.mesh.visible = distance < 72;
      if (distance >= 72) continue;
      const target = day ? villager.work : villager.home;
      const sway = new THREE.Vector3(
        Math.sin(performance.now() / 2400 + index) * 1.6,
        0,
        Math.cos(performance.now() / 2700 + index) * 1.6,
      );
      const destination = target.clone().add(day ? sway : new THREE.Vector3());
      const direction = destination.sub(villager.position);
      if (direction.lengthSq() > 0.12) {
        direction.normalize();
        villager.position.addScaledVector(direction, delta * 0.75);
        villager.position.y =
          terrainHeight(seed, villager.position.x, villager.position.z) + 1;
        villager.mesh.rotation.y = Math.atan2(direction.x, direction.z);
      }
      villager.mesh.position.copy(villager.position);
    }
  });

  return (
    <group>
      {villagers.map((villager) => (
        <group
          key={villager.id}
          ref={(node) => {
            villager.mesh = node;
          }}
          position={villager.position}
        >
          <mesh position={[0, 0.72, 0]}>
            <boxGeometry args={[0.58, 1.05, 0.48]} />
            <meshLambertMaterial color={villager.color} />
          </mesh>
          <mesh position={[0, 1.48, 0]}>
            <boxGeometry args={[0.52, 0.48, 0.48]} />
            <meshLambertMaterial color="#c99872" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function AtmosphereField({
  seed,
  player,
  timeOfDay,
}: {
  seed: string;
  player: RefObject<THREE.Vector3>;
  timeOfDay: RefObject<number>;
}) {
  const stars = useRef<THREE.Points>(null);
  const precipitation = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const drops = useRef(
    Array.from({ length: 72 }, (_, index) => ({
      x: Math.sin(index * 91.17) * 18,
      y: 2 + ((index * 7.13) % 18),
      z: Math.cos(index * 47.31) * 18,
    })),
  );
  const starPositions = useMemo(() => {
    const values = new Float32Array(180 * 3);
    for (let index = 0; index < 180; index += 1) {
      const angle = index * 2.399;
      const height = 45 + ((index * 17) % 35);
      values[index * 3] = Math.cos(angle) * height;
      values[index * 3 + 1] = 28 + ((index * 29) % 48);
      values[index * 3 + 2] = Math.sin(angle) * height;
    }
    return values;
  }, []);
  useFrame((_, delta) => {
    const time = timeOfDay.current;
    if (stars.current) {
      stars.current.visible = time < 0.09 || time > 0.66;
      stars.current.position.set(player.current.x, 0, player.current.z);
    }
    if (!precipitation.current) return;
    const weather = getWeatherAt(
      seed,
      time,
      player.current.x,
      player.current.z,
    );
    precipitation.current.visible = weather !== "clear";
    if (weather === "clear") return;
    drops.current.forEach((drop, index) => {
      drop.y -=
        delta * (weather === "rain" ? 14 : weather === "snow" ? 2.3 : 0.4);
      if (drop.y < -1) drop.y = 20;
      dummy.position.set(
        player.current.x + drop.x,
        player.current.y + drop.y,
        player.current.z + drop.z,
      );
      dummy.scale.set(
        weather === "fog" ? 2.5 : weather === "snow" ? 0.12 : 0.045,
        weather === "rain" ? 1.2 : weather === "fog" ? 0.2 : 0.12,
        weather === "fog" ? 2.5 : weather === "snow" ? 0.12 : 0.045,
      );
      dummy.updateMatrix();
      precipitation.current!.setMatrixAt(index, dummy.matrix);
    });
    precipitation.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <points ref={stars} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[starPositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial color="#d8f4ff" size={0.42} sizeAttenuation />
      </points>
      <instancedMesh
        ref={precipitation}
        args={[undefined, undefined, drops.current.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#b9dce8" transparent opacity={0.55} />
      </instancedMesh>
    </group>
  );
}
