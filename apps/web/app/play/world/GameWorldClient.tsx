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
  WATER_RENDER_STATE,
  canPlaceBlock,
  canCultivateSurface,
  canPlantCropOn,
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
  PROCESSING_RECIPES,
  startProcessor,
  finishProcessor,
  collectProcessorOutput,
  transferInventoryStack,
  damageTool,
  miningSeconds,
  nextSwimmingVelocityY,
  raycastVoxels,
  removeFromInventory,
  moveInventoryStack,
  normalizeNexusQuestState,
  objectiveProgress,
  applyGameplayEvent,
  acceptSideQuest,
  buildChunkMesh,
  MAIN_QUESTS,
  SIDE_QUESTS,
  repairNexusNode,
  setChunkBlock,
  terrainHeight,
  voxelIndex,
  worldToChunk,
  worldToLocal,
  type BlockIdValue,
  type ChunkData,
  type ChunkMeshLayerData,
  type ChunkMeshData,
  type CropEntity,
  type CreatureEntity,
  type ContainerEntity,
  type ProcessorEntity,
  type DoorEntity,
  type NpcEntity,
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
  type WorldBlockLookup,
} from "@fangyu/voxel-engine";
import {
  createRuntimeId,
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
  meshRevision: number;
  modifications: Map<number, BlockIdValue>;
  entities: WorldEntity[];
  dirty: boolean;
  lastTouched: number;
  serverRevision: number;
};
type RenderChunk = { key: string; revision: number; mesh: ChunkMeshData };
type RenderDrop = DroppedItemEntity & { key: string };
type RenderCrop = CropEntity & { key: string };
type RenderDoor = DoorEntity & { key: string };
type RenderNpc = NpcEntity & { key: string };
type RenderCreature = CreatureEntity & { key: string };
type InteractiveEntity = ContainerEntity | ProcessorEntity;
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
  const [networkOpen, setNetworkOpen] = useState(false);
  const [tutorialPage, setTutorialPage] = useState<number | null>(null);
  const [activeStation, setActiveStation] = useState<InteractiveEntity | null>(
    null,
  );
  const [debug, setDebug] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [rendererAvailable, setRendererAvailable] = useState<boolean | null>(
    null,
  );
  const [hud, setHud] = useState(emptyHud);
  const saveRef = useRef<SaveFunction>(async () => undefined);

  useEffect(() => {
    const probe = document.createElement("canvas");
    setRendererAvailable(
      Boolean(probe.getContext("webgl2") || probe.getContext("webgl")),
    );
  }, []);

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

  useEffect(() => {
    const openStation = (event: Event) => {
      document.exitPointerLock();
      setActiveStation((event as CustomEvent<InteractiveEntity>).detail);
    };
    const updateStation = (event: Event) =>
      setActiveStation((event as CustomEvent<InteractiveEntity>).detail);
    window.addEventListener("fangyu-station-open", openStation);
    window.addEventListener("fangyu-station-update", updateStation);
    return () => {
      window.removeEventListener("fangyu-station-open", openStation);
      window.removeEventListener("fangyu-station-update", updateStation);
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
      {rendererAvailable === null && (
        <div className="renderer-fallback">正在檢查 3D renderer…</div>
      )}
      {rendererAvailable === false && (
        <div className="renderer-fallback" role="alert">
          <strong>此瀏覽器無法建立 WebGL renderer</strong>
          <p>
            世界存檔仍然安全。請開啟瀏覽器的硬體加速，或改用支援 WebGL2 的最新版
            Chrome、Edge、Firefox 或 Safari。
          </p>
          <Link className="primary-link" href="/play/settings">
            返回遊戲設定
          </Link>
        </div>
      )}
      {rendererAvailable && (
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
            paused={paused || inventoryOpen || Boolean(activeStation)}
            setPaused={setPaused}
            setInventoryOpen={setInventoryOpen}
            onHud={setHud}
            onSaveStatus={setSaveStatus}
            registerSave={(save) => {
              saveRef.current = save;
            }}
          />
        </Canvas>
      )}

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
      {(paused || inventoryOpen) &&
        tutorialPage === null &&
        !questOpen &&
        !networkOpen && (
          <PauseLayer
            world={world}
            inventoryOpen={inventoryOpen}
            hud={hud}
            resume={resume}
            setInventoryOpen={setInventoryOpen}
            openQuest={() => setQuestOpen(true)}
            openNetwork={() => setNetworkOpen(true)}
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
      {networkOpen && (
        <NexusNetworkModal
          seed={world.seed}
          quest={hud.quest}
          inventory={hud.inventory}
          close={() => setNetworkOpen(false)}
        />
      )}
      {tutorialPage !== null && (
        <TutorialOverlay
          page={tutorialPage}
          setPage={setTutorialPage}
          finish={(skipped) => void finishTutorial(skipped)}
        />
      )}
      {activeStation && (
        <StationModal
          station={activeStation}
          playerInventory={hud.inventory}
          close={() => setActiveStation(null)}
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
          <div
            key={index}
            className={selected === index ? "selected" : ""}
            title={
              stack
                ? `${block.name} × ${stack.count}${stack.maxDurability ? ` · 耐久 ${stack.durability ?? stack.maxDurability}/${stack.maxDurability}` : ""}`
                : "空格"
            }
          >
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
                {stack.maxDurability && (
                  <i className="tool-durability">
                    <span
                      style={{
                        width: `${Math.max(0, ((stack.durability ?? stack.maxDurability) / stack.maxDurability) * 100)}%`,
                      }}
                    />
                  </i>
                )}
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
            {quest.acceptedSideQuestIds.length === 0 && (
              <p>與聚落居民交談可接受多階段支線任務。</p>
            )}
            {SIDE_QUESTS.filter((entry) =>
              quest.acceptedSideQuestIds.includes(entry.id),
            ).map((entry) => {
              const done = quest.completedSideQuestIds.includes(entry.id);
              const current = entry.objectives.find(
                (objective) =>
                  (quest.sideQuestProgress[`${entry.id}:${objective.id}`] ??
                    0) < objective.target,
              );
              return (
                <p key={entry.id} className={done ? "done" : ""}>
                  {done ? "✓" : "◆"} {entry.title}
                  {current
                    ? ` — ${current.label} ${quest.sideQuestProgress[`${entry.id}:${current.id}`] ?? 0}/${current.target}`
                    : " — 完成"}
                </p>
              );
            })}
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

function StationModal({
  station,
  playerInventory,
  close,
}: {
  station: InteractiveEntity;
  playerInventory: Inventory;
  close: () => void;
}) {
  const slotButton = (
    stack: Inventory[number],
    index: number,
    direction: "to-container" | "to-player",
  ) => (
    <button
      type="button"
      key={`${direction}-${index}`}
      disabled={!stack}
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent("fangyu-container-transfer", {
            detail: { id: station.id, direction, slot: index },
          }),
        )
      }
    >
      {stack
        ? `${getBlockDefinition(stack.blockId).name} × ${stack.count}`
        : "EMPTY"}
    </button>
  );
  const stationInventory =
    station.kind === "container" ? station.inventory : station.output;
  const elapsed =
    station.kind === "processor" && station.startedAt
      ? Math.max(0, (Date.now() - Date.parse(station.startedAt)) / 1000)
      : 0;
  const progress =
    station.kind === "processor" && station.durationSeconds
      ? Math.min(100, (elapsed / station.durationSeconds) * 100)
      : 0;
  return (
    <div className="game-modal-backdrop">
      <section
        className="pause-menu station-modal"
        role="dialog"
        aria-modal="true"
      >
        <p className="eyebrow">
          {station.kind === "container" ? "STORAGE" : "PROCESSOR"}
        </p>
        <h2>{station.kind === "container" ? "方域儲存箱" : "脈熱加工站"}</h2>
        <h3>玩家背包（點擊移入）</h3>
        <div className="station-slot-grid">
          {playerInventory.map((stack, index) =>
            slotButton(stack, index, "to-container"),
          )}
        </div>
        <h3>{station.kind === "container" ? "箱內物品" : "加工輸出"}</h3>
        <div className="station-slot-grid">
          {stationInventory.map((stack, index) =>
            slotButton(stack, index, "to-player"),
          )}
        </div>
        {station.kind === "processor" && (
          <>
            <div className="processor-materials">
              <div>
                <h3>投入材料</h3>
                <p>
                  {station.input[0]
                    ? `${getBlockDefinition(station.input[0].blockId).name} × ${station.input[0].count}`
                    : "尚未投入"}
                </p>
              </div>
              <div>
                <h3>能源槽</h3>
                <p>
                  {station.fuel[0]
                    ? `${getBlockDefinition(station.fuel[0].blockId).name} × ${station.fuel[0].count}`
                    : "尚未投入"}
                </p>
              </div>
            </div>
            <div
              className="processor-progress"
              aria-label={`加工進度 ${Math.round(progress)}%`}
            >
              <i style={{ width: `${progress}%` }} />
            </div>
            <div className="recipe-list">
              {PROCESSING_RECIPES.map((recipe) => (
                <button
                  type="button"
                  key={recipe.id}
                  disabled={Boolean(station.recipeId)}
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("fangyu-processor-start", {
                        detail: { id: station.id, recipeId: recipe.id },
                      }),
                    )
                  }
                >
                  {recipe.name}
                  <small>{recipe.durationSeconds}s · 需要脈熱燃芯</small>
                </button>
              ))}
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("fangyu-processor-collect", {
                      detail: { id: station.id },
                    }),
                  )
                }
              >
                收取完成品
              </button>
            </div>
          </>
        )}
        <button className="primary-link" type="button" onClick={close}>
          關閉
        </button>
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

function NexusNetworkModal({
  seed,
  quest,
  inventory,
  close,
}: {
  seed: string;
  quest: NexusQuestState;
  inventory: Inventory;
  close: () => void;
}) {
  const nodes = getNexusNodes(seed);
  const fuel = countInventoryItem(inventory, BlockId.WaygateFuel);
  return (
    <div className="game-modal-backdrop">
      <section
        className="pause-menu network-modal"
        role="dialog"
        aria-modal="true"
      >
        <p className="eyebrow">NEXUS NETWORK</p>
        <h2>節點快速旅行</h2>
        <p>只可前往已修復的節點；每次消耗 1 枚遠行燃料。現有燃料：{fuel}</p>
        <div className="recipe-list">
          {nodes.map((node) => {
            const repaired = quest.repairedNodeIds.includes(node.id);
            return (
              <button
                type="button"
                key={node.id}
                disabled={!repaired || fuel < 1}
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("fangyu-fast-travel", {
                      detail: { nodeId: node.id },
                    }),
                  );
                  close();
                }}
              >
                {repaired ? "◆" : "◇"} {node.name}
                <small>{repaired ? "已連線 · 消耗 1 燃料" : "尚未修復"}</small>
              </button>
            );
          })}
        </div>
        <button className="primary-link" type="button" onClick={close}>
          關閉
        </button>
      </section>
    </div>
  );
}

function PauseLayer({
  world,
  inventoryOpen,
  hud,
  resume,
  setInventoryOpen,
  openQuest,
  openNetwork,
  save,
}: {
  world: GameWorldMetadata;
  inventoryOpen: boolean;
  hud: HudState;
  resume: () => void;
  setInventoryOpen: (open: boolean) => void;
  openQuest: () => void;
  openNetwork: () => void;
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
                        <small>
                          × {stack.count}
                          {stack.maxDurability
                            ? ` · 耐久 ${stack.durability ?? stack.maxDurability}/${stack.maxDurability}`
                            : ""}
                        </small>
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
            <button type="button" onClick={openNetwork}>
              Nexus Network
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
  const createGeometry = useCallback((layer: ChunkMeshLayerData) => {
    const value = new THREE.BufferGeometry();
    value.setAttribute(
      "position",
      new THREE.BufferAttribute(layer.positions, 3),
    );
    value.setAttribute("normal", new THREE.BufferAttribute(layer.normals, 3));
    value.setAttribute("color", new THREE.BufferAttribute(layer.colors, 3));
    value.setIndex(new THREE.BufferAttribute(layer.indices, 1));
    value.computeBoundingSphere();
    return value;
  }, []);
  const geometry = useMemo(
    () => createGeometry(chunk.mesh),
    [chunk.mesh, createGeometry],
  );
  const waterGeometry = useMemo(
    () => createGeometry(chunk.mesh.water),
    [chunk.mesh, createGeometry],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      waterGeometry.dispose();
    },
    [geometry, waterGeometry],
  );
  return (
    <group>
      <mesh geometry={geometry} frustumCulled castShadow={false} receiveShadow>
        <meshLambertMaterial vertexColors />
      </mesh>
      {chunk.mesh.water.triangles > 0 && (
        <mesh
          geometry={waterGeometry}
          frustumCulled
          castShadow={false}
          receiveShadow={false}
          renderOrder={1}
        >
          <meshLambertMaterial
            vertexColors
            transparent={WATER_RENDER_STATE.transparent}
            opacity={WATER_RENDER_STATE.opacity}
            depthWrite={WATER_RENDER_STATE.depthWrite}
            depthTest={WATER_RENDER_STATE.depthTest}
            side={
              WATER_RENDER_STATE.side === "front"
                ? THREE.FrontSide
                : THREE.DoubleSide
            }
          />
        </mesh>
      )}
    </group>
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
      mesh.current!.setColorAt(
        index,
        new THREE.Color(
          crop.cropId === "sungrain"
            ? stage >= 3
              ? "#e5bf45"
              : "#83a93a"
            : stage >= 3
              ? "#d97536"
              : "#688f38",
        ),
      );
    });
    mesh.current.count = crops.length;
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor)
      mesh.current.instanceColor.needsUpdate = true;
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
      <meshLambertMaterial vertexColors />
    </instancedMesh>
  );
}

function DoorField({ doors }: { doors: readonly RenderDoor[] }) {
  return doors.map((door) => (
    <mesh
      key={`${door.key}:${door.id}`}
      position={[
        door.position[0] + (door.open ? 0.42 : 0),
        door.position[1] + 0.9,
        door.position[2] + (door.open ? -0.42 : 0),
      ]}
      rotation={[0, door.open ? Math.PI / 2 : 0, 0]}
    >
      <boxGeometry args={[0.82, 1.8, 0.14]} />
      <meshLambertMaterial color="#87552b" />
    </mesh>
  ));
}

function createVillageNpcs(seed: string, village: WorldLandmark): NpcEntity[] {
  const definitions = [
    ["Mira", "farmer", -10, -9, -2, 9],
    ["Tor", "crafter", 10, -8, 3, -2],
    ["Sela", "trader", -9, 10, 0, 0],
    ["Ivo", "explorer", 11, 9, 7, 3],
    ["Nara", "researcher", 11, 9, -5, -3],
  ] as const;
  return definitions.map(([name, profession, hx, hz, wx, wz], index) => {
    const home = [
      village.x + hx,
      terrainHeight(seed, village.x + hx, village.z + hz) + 1,
      village.z + hz,
    ] as const;
    const work = [
      village.x + wx,
      terrainHeight(seed, village.x + wx, village.z + wz) + 1,
      village.z + wz,
    ] as const;
    return {
      id: `${village.id}:settler-${index}`,
      kind: "npc",
      name,
      profession,
      position: home,
      home,
      work,
      scheduleState: "home",
      tradeCount: 0,
      interactionFlags: [],
      questStep: 0,
    };
  });
}

function createSettlementCreatures(seed: string): CreatureEntity[] {
  const entries = [
    ["chicken", 7, 6, 6],
    ["cow", 11, 4, 12],
    ["pig", -8, 7, 10],
    ["sheep", -11, -5, 8],
    ["rabbit", 4, -10, 5],
  ] as const;
  return entries.map(([species, x, z, health], index) => ({
    id: `home-${species}-${index}`,
    kind: "creature",
    species,
    position: [x, terrainHeight(seed, x, z) + 0.55, z],
    health,
    maxHealth: health,
    persistent: true,
    home: [x, terrainHeight(seed, x, z) + 0.55, z],
    state: "idle",
    ...(species === "sheep" ? { woolly: true } : {}),
  }));
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
    requestedRevisions = useRef(new Map<string, number>()),
    worker = useRef<Worker | null>(null),
    requestId = useRef(0);
  const [renderChunks, setRenderChunks] = useState<RenderChunk[]>([]);
  const [renderDrops, setRenderDrops] = useState<RenderDrop[]>([]);
  const [renderCrops, setRenderCrops] = useState<RenderCrop[]>([]);
  const [renderDoors, setRenderDoors] = useState<RenderDoor[]>([]);
  const [renderNpcs, setRenderNpcs] = useState<RenderNpc[]>([]);
  const [renderCreatures, setRenderCreatures] = useState<RenderCreature[]>([]);
  const position = useRef(new THREE.Vector3(...initialPlayer.position)),
    velocity = useRef(new THREE.Vector3()),
    yaw = useRef(initialPlayer.rotation[0]),
    pitch = useRef(initialPlayer.rotation[1]);
  const keys = useRef(new Set<string>()),
    mouseButtons = useRef(new Set<number>()),
    miningProgress = useRef<{ key: string; seconds: number } | null>(null),
    grounded = useRef(false),
    inventory = useRef(initialPlayer.inventory),
    selected = useRef(initialPlayer.selectedSlot),
    playerServerRevision = useRef(initialPlayer.revision),
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
      const door = chunk?.entities.find(
        (entity): entity is DoorEntity =>
          entity.kind === "door" &&
          Math.floor(entity.position[0]) === x &&
          Math.floor(entity.position[1]) === y &&
          Math.floor(entity.position[2]) === z,
      );
      if (door) return door.open ? BlockId.Air : BlockId.FieldDoor;
      return chunk
        ? getChunkBlock(chunk.data, local.x, y, local.z)
        : BlockId.Air;
    },
    [],
  );

  // Chunks arrive independently. Rebuilding this small five-chunk cross after
  // each arrival removes provisional boundary faces (especially water-water
  // faces) as soon as the adjacent chunk is available.
  const remeshLoadedChunk = useCallback(
    (x: number, z: number) => {
      const chunk = chunks.current.get(chunkKey(x, z));
      if (!chunk) return;
      chunk.mesh = buildChunkMesh(chunk.data, lookup);
      chunk.meshRevision += 1;
    },
    [lookup],
  );

  const publishChunks = useCallback(() => {
    setRenderChunks(
      Array.from(chunks.current, ([key, chunk]) => ({
        key,
        revision: chunk.meshRevision,
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
    setRenderDoors(
      Array.from(chunks.current, ([key, chunk]) =>
        chunk.entities
          .filter((entity): entity is DoorEntity => entity.kind === "door")
          .map((entity) => ({ ...entity, key })),
      ).flat(),
    );
    setRenderNpcs(
      Array.from(chunks.current, ([key, chunk]) =>
        chunk.entities
          .filter((entity): entity is NpcEntity => entity.kind === "npc")
          .map((entity) => ({ ...entity, key })),
      ).flat(),
    );
    const nextCreatures = Array.from(chunks.current, ([key, chunk]) =>
      chunk.entities
        .filter(
          (entity): entity is CreatureEntity => entity.kind === "creature",
        )
        .map((entity) => ({ ...entity, key })),
    ).flat();
    setRenderCreatures((previous) => {
      const before = previous
        .map(
          (entry) =>
            `${entry.id}:${entry.health}:${entry.lastProductAt ?? ""}:${entry.woolly ?? ""}`,
        )
        .join("|");
      const after = nextCreatures
        .map(
          (entry) =>
            `${entry.id}:${entry.health}:${entry.lastProductAt ?? ""}:${entry.woolly ?? ""}`,
        )
        .join("|");
      return before === after ? previous : nextCreatures;
    });
  }, []);

  const requestChunk = useCallback(
    async (x: number, z: number, existing?: LoadedChunk) => {
      const key = chunkKey(x, z);
      if (pending.current.has(key)) return;
      pending.current.add(key);
      let local = existing
        ? null
        : await getLocalChunk(world.id, x, z).catch(() => undefined);
      if (!existing && !local) {
        const remote = await fetch(`/api/worlds/${world.id}/chunks/${x}/${z}`, {
          cache: "no-store",
        }).catch(() => null);
        if (remote?.ok) {
          const payload = (await remote.json()) as {
            chunk?: PersistedChunkDelta | null;
          };
          if (payload.chunk) {
            local = payload.chunk;
            await putLocalChunk(payload.chunk).catch(() => undefined);
          }
        }
      }
      const modifications = existing
        ? Array.from(existing.modifications)
        : (local?.modifiedBlocks ?? []);
      requestedModifications.current.set(key, new Map(modifications));
      requestedEntities.current.set(
        key,
        existing?.entities ?? local?.entities ?? [],
      );
      requestedRevisions.current.set(
        key,
        existing?.serverRevision ?? local?.revision ?? 0,
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
        waterPositions: ArrayBuffer;
        waterNormals: ArrayBuffer;
        waterColors: ArrayBuffer;
        waterIndices: ArrayBuffer;
        waterTriangles: number;
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
      let entities =
        previous?.entities ?? requestedEntities.current.get(key) ?? [];
      const village = landmarks.find((landmark) => {
        if (landmark.type !== "village") return false;
        const coordinate = worldToChunk(landmark.x, landmark.z);
        return (
          coordinate.x === message.chunkX && coordinate.z === message.chunkZ
        );
      });
      if (village && !entities.some((entity) => entity.kind === "npc"))
        entities = [...entities, ...createVillageNpcs(world.seed, village)];
      if (
        message.chunkX === 0 &&
        message.chunkZ === 0 &&
        !entities.some((entity) => entity.kind === "creature")
      )
        entities = [...entities, ...createSettlementCreatures(world.seed)];
      chunks.current.set(key, {
        data,
        mesh: {
          positions: new Float32Array(message.positions),
          normals: new Float32Array(message.normals),
          colors: new Float32Array(message.colors),
          indices: new Uint32Array(message.indices),
          water: {
            positions: new Float32Array(message.waterPositions),
            normals: new Float32Array(message.waterNormals),
            colors: new Float32Array(message.waterColors),
            indices: new Uint32Array(message.waterIndices),
            triangles: message.waterTriangles,
          },
          triangles: message.triangles,
        },
        meshRevision: (previous?.meshRevision ?? 0) + 1,
        modifications:
          previous?.modifications ??
          requestedModifications.current.get(key) ??
          new Map(),
        entities,
        dirty:
          previous?.dirty ??
          ((requestedModifications.current.get(key)?.size ?? 0) > 0 ||
            Boolean(
              village &&
                !(requestedEntities.current.get(key) ?? []).some(
                  (entity) => entity.kind === "npc",
                ),
            ) ||
            Boolean(
              message.chunkX === 0 &&
                message.chunkZ === 0 &&
                !(requestedEntities.current.get(key) ?? []).some(
                  (entity) => entity.kind === "creature",
                ),
            )),
        lastTouched: performance.now(),
        serverRevision:
          previous?.serverRevision ?? requestedRevisions.current.get(key) ?? 0,
      });
      remeshLoadedChunk(message.chunkX, message.chunkZ);
      remeshLoadedChunk(message.chunkX - 1, message.chunkZ);
      remeshLoadedChunk(message.chunkX + 1, message.chunkZ);
      remeshLoadedChunk(message.chunkX, message.chunkZ - 1);
      remeshLoadedChunk(message.chunkX, message.chunkZ + 1);
      pending.current.delete(key);
      publishChunks();
    };
    return () => generator.terminate();
  }, [landmarks, publishChunks, remeshLoadedChunk, world.seed]);

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
      if (
        event.type === "activateNexus" &&
        event.key &&
        !quest.current.activatedNodeIds.includes(event.key)
      )
        quest.current = {
          ...quest.current,
          activatedNodeIds: [...quest.current.activatedNodeIds, event.key],
        };
      const previousSideQuests = new Set(quest.current.completedSideQuestIds);
      const result = applyGameplayEvent(quest.current, {
        ...event,
        id:
          event.id ??
          `${world.id}:${Date.now()}:${++questEventSequence.current}`,
      });
      quest.current = result.state;
      for (const completedId of result.state.completedSideQuestIds) {
        if (previousSideQuests.has(completedId)) continue;
        const reward = SIDE_QUESTS.find(
          (entry) => entry.id === completedId,
        )?.reward;
        if (reward?.itemId && reward.count) {
          const granted = addToInventoryWithRemainder(
            inventory.current,
            reward.itemId,
            reward.count,
          );
          if (granted.remaining === 0) {
            inventory.current = granted.inventory;
            quest.current = {
              ...quest.current,
              claimedSideQuestRewards: Array.from(
                new Set([
                  ...quest.current.claimedSideQuestRewards,
                  completedId,
                ]),
              ),
              pendingSideQuestRewards:
                quest.current.pendingSideQuestRewards.filter(
                  (id) => id !== completedId,
                ),
            };
            questMessage.current = `支線完成：${reward.label} 已加入背包。`;
          } else {
            quest.current = {
              ...quest.current,
              pendingSideQuestRewards: Array.from(
                new Set([
                  ...quest.current.pendingSideQuestRewards,
                  completedId,
                ]),
              ),
            };
            questMessage.current =
              "支線完成，但背包空間不足；獎勵已保留，整理後再與委託居民交談。";
          }
        }
      }
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
    (button: number, overrideHit?: RaycastHit, bypassPointerLock = false) => {
      if ((!bypassPointerLock && !document.pointerLockElement) || dead.current)
        return;
      const current = overrideHit ?? hit.current;
      if (!current) return;
      if (button === 0) {
        window.dispatchEvent(new CustomEvent("fangyu-attack"));
        const coordinate = worldToChunk(current.block.x, current.block.z),
          local = worldToLocal(current.block.x, current.block.z),
          chunk = chunks.current.get(chunkKey(coordinate.x, coordinate.z));
        if (!chunk) return;
        const attached = chunk.entities.filter(
          (entity) =>
            "position" in entity &&
            Math.floor(entity.position[0]) === current.block.x &&
            Math.floor(entity.position[1]) === current.block.y &&
            Math.floor(entity.position[2]) === current.block.z,
        );
        chunk.entities = chunk.entities.filter(
          (entity) => !attached.includes(entity),
        );
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
          for (const entity of attached)
            if (entity.kind === "container")
              for (const stored of entity.inventory)
                if (stored)
                  chunk.entities.push({
                    id: createRuntimeId(),
                    kind: "dropped-item",
                    itemId: stored.blockId,
                    count: stored.count,
                    position: [
                      current.block.x + 0.5,
                      current.block.y + 0.55,
                      current.block.z + 0.5,
                    ],
                    createdAt: new Date().toISOString(),
                  });
          for (const loot of getBlockLoot(current.blockId))
            chunk.entities.push({
              id: createRuntimeId(),
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
        if (inventory.current[selected.current]?.maxDurability)
          inventory.current = damageTool(inventory.current, selected.current);
        void requestChunk(coordinate.x, coordinate.z, chunk);
        publishChunks();
        beep(132);
      } else if (button === 2) {
        const currentCoordinate = worldToChunk(
            current.block.x,
            current.block.z,
          ),
          currentChunk = chunks.current.get(
            chunkKey(currentCoordinate.x, currentCoordinate.z),
          );
        const interactive = currentChunk?.entities.find(
          (entity) =>
            (entity.kind === "door" ||
              entity.kind === "container" ||
              entity.kind === "processor") &&
            Math.floor(entity.position[0]) === current.block.x &&
            Math.floor(entity.position[1]) === current.block.y &&
            Math.floor(entity.position[2]) === current.block.z,
        );
        if (interactive?.kind === "door") {
          interactive.open = !interactive.open;
          currentChunk!.dirty = true;
          publishChunks();
          beep(interactive.open ? 260 : 210);
          return;
        }
        if (
          interactive?.kind === "container" ||
          interactive?.kind === "processor"
        ) {
          window.dispatchEvent(
            new CustomEvent("fangyu-station-open", { detail: interactive }),
          );
          return;
        }
        if (!interactive) {
          const nearbyDoor = Array.from(chunks.current.values())
            .flatMap((entry) =>
              entry.entities
                .filter(
                  (entity): entity is DoorEntity =>
                    entity.kind === "door" && entity.open,
                )
                .map((entity) => ({ chunk: entry, entity })),
            )
            .find(
              ({ entity }) =>
                Math.hypot(
                  entity.position[0] - (current.previous.x + 0.5),
                  entity.position[1] - current.previous.y,
                  entity.position[2] - (current.previous.z + 0.5),
                ) < 1.1,
            );
          if (nearbyDoor) {
            nearbyDoor.entity.open = false;
            nearbyDoor.chunk.dirty = true;
            publishChunks();
            beep(210);
            return;
          }
        }
        if (
          current.blockId === BlockId.CraftStation ||
          current.blockId === BlockId.NexusWorkbench
        ) {
          document.exitPointerLock();
          setInventoryOpen(true);
          return;
        }
        const cultivationTool = inventory.current[selected.current] ?? null;
        if (canCultivateSurface(current.blockId, cultivationTool)) {
          const coordinate = worldToChunk(current.block.x, current.block.z),
            local = worldToLocal(current.block.x, current.block.z),
            chunk = chunks.current.get(chunkKey(coordinate.x, coordinate.z));
          if (!chunk) return;
          setChunkBlock(
            chunk.data,
            local.x,
            current.block.y,
            local.z,
            BlockId.CultivatedLoam,
          );
          chunk.modifications.set(
            voxelIndex(local.x, current.block.y, local.z),
            BlockId.CultivatedLoam,
          );
          chunk.dirty = true;
          inventory.current = damageTool(inventory.current, selected.current);
          emitQuestEvent({ type: "place", key: "cultivated-field" });
          publishChunks();
          questMessage.current = "土地已整理為培田土，可播下日穗或日根種子。";
          beep(250);
          return;
        }
        if (current.blockId === BlockId.FarmStation) {
          const withoutSeed = consumeInventoryItem(
            inventory.current,
            BlockId.FieldSeed,
            1,
          );
          const withoutSoil = withoutSeed
            ? consumeInventoryItem(withoutSeed, BlockId.Loam, 1)
            : null;
          if (!withoutSoil) {
            questMessage.current = "育種台需要 1 日穗種子與 1 壤土。";
            return;
          }
          inventory.current = addToInventoryWithRemainder(
            withoutSoil,
            BlockId.RootSeed,
            2,
          ).inventory;
          questMessage.current = "育種完成：取得 2 枚日根種子。";
          beep(420);
          return;
        }
        const stack = inventory.current[selected.current];
        if (!stack) return;
        if (
          stack.blockId === BlockId.FieldSeed ||
          stack.blockId === BlockId.RootSeed
        ) {
          const target = current.previous;
          const soil = lookup(target.x, target.y - 1, target.z);
          if (!canPlantCropOn(soil)) {
            questMessage.current = "種子只能播在以拓荒鑿整好的培田土上。";
            return;
          }
          const coordinate = worldToChunk(target.x, target.z),
            chunk = chunks.current.get(chunkKey(coordinate.x, coordinate.z));
          if (!chunk) return;
          chunk.entities.push({
            id: createRuntimeId(),
            kind: "crop",
            cropId:
              stack.blockId === BlockId.FieldSeed ? "sungrain" : "sunroot",
            position: [target.x + 0.5, target.y, target.z + 0.5],
            plantedAt: new Date().toISOString(),
            growthSeconds: stack.blockId === BlockId.FieldSeed ? 120 : 180,
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
          stack.blockId === BlockId.MeadowMilk ||
          stack.blockId === BlockId.CookedSunroot
        ) {
          if (hunger.current >= 20) return;
          inventory.current =
            removeFromInventory(inventory.current, selected.current, 1) ??
            inventory.current;
          hunger.current = Math.min(
            20,
            hunger.current +
              (stack.blockId === BlockId.TrailRation
                ? 8
                : stack.blockId === BlockId.CookedSunroot
                  ? 5
                  : 3),
          );
          beep(330);
          return;
        }
        if (
          stack.blockId === BlockId.MachineKit ||
          stack.blockId === BlockId.NexusDevice ||
          stack.blockId === BlockId.NodeCalibrator
        ) {
          const nearestLandmark = landmarks
            .map((landmark) => ({
              landmark,
              distance: Math.hypot(
                position.current.x - landmark.x,
                position.current.z - landmark.z,
              ),
            }))
            .sort((a, b) => a.distance - b.distance)[0];
          const valid =
            nearestLandmark &&
            nearestLandmark.distance <= 18 &&
            ((stack.blockId === BlockId.MachineKit &&
              nearestLandmark.landmark.type === "ancient-machine") ||
              (stack.blockId === BlockId.NexusDevice &&
                nearestLandmark.landmark.type === "nexus-core") ||
              (stack.blockId === BlockId.NodeCalibrator &&
                nearestLandmark.landmark.type === "sunken-ruin"));
          if (!valid) {
            questMessage.current = "此裝置必須在對應的 Nexus 遺址中安裝。";
            return;
          }
          inventory.current =
            removeFromInventory(inventory.current, selected.current, 1) ??
            inventory.current;
          const key =
            stack.blockId === BlockId.MachineKit
              ? "ancient-machine"
              : stack.blockId === BlockId.NexusDevice
                ? "nexus-core"
                : "swamp-pylon";
          emitQuestEvent({ type: "activateNexus", key });
          questMessage.current = `${nearestLandmark.landmark.name} 已完成啟動程序。`;
          beep(760);
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
        const customDoor = stack.blockId === BlockId.FieldDoor;
        setChunkBlock(
          chunk.data,
          local.x,
          current.previous.y,
          local.z,
          customDoor ? BlockId.Air : stack.blockId,
        );
        chunk.modifications.set(
          voxelIndex(local.x, current.previous.y, local.z),
          customDoor ? BlockId.Air : stack.blockId,
        );
        if (customDoor)
          chunk.entities.push({
            id: createRuntimeId(),
            kind: "door",
            position: [
              current.previous.x + 0.5,
              current.previous.y,
              current.previous.z + 0.5,
            ],
            open: false,
          });
        if (stack.blockId === BlockId.StorageChest)
          chunk.entities.push({
            id: createRuntimeId(),
            kind: "container",
            position: [
              current.previous.x + 0.5,
              current.previous.y,
              current.previous.z + 0.5,
            ],
            inventory: Array(27).fill(null),
            revision: 0,
          });
        if (stack.blockId === BlockId.ProcessorStation)
          chunk.entities.push({
            id: createRuntimeId(),
            kind: "processor",
            position: [
              current.previous.x + 0.5,
              current.previous.y,
              current.previous.z + 0.5,
            ],
            input: [],
            fuel: [],
            output: Array(3).fill(null),
            revision: 0,
          });
        chunk.dirty = true;
        emitQuestEvent({
          type: "place",
          key: getBlockDefinition(stack.blockId).key,
        });
        if (
          stack.blockId === BlockId.CraftStation ||
          stack.blockId === BlockId.ProcessorStation ||
          stack.blockId === BlockId.FarmStation ||
          stack.blockId === BlockId.NexusWorkbench
        )
          emitQuestEvent({ type: "place", key: "workstation" });
        if (
          stack.blockId === BlockId.StorageChest &&
          Math.hypot(position.current.x, position.current.z) > 180
        ) {
          emitQuestEvent({ type: "build", key: "remote-base" });
          emitQuestEvent({ type: "build", key: "base" });
        }
        if (stack.blockId === BlockId.FarmStation) {
          emitQuestEvent({ type: "build", key: "large-farm" });
          emitQuestEvent({ type: "build", key: "village-workshop" });
        }
        if (stack.blockId === BlockId.NexusWorkbench) {
          const nearNode = nexusNodes.some(
            (node) =>
              quest.current.repairedNodeIds.includes(node.id) &&
              Math.hypot(
                current.previous.x - node.position[0],
                current.previous.z - node.position[2],
              ) <= 7,
          );
          if (nearNode) emitQuestEvent({ type: "build", key: "waygate" });
        }
        if (stack.blockId === BlockId.NexusConduit) {
          const biome = getBiomeAt(
            world.seed,
            current.previous.x,
            current.previous.z,
          );
          if (biome.id === "mountain")
            emitQuestEvent({ type: "build", key: "mountain-relay" });
          if (Math.hypot(current.previous.x, current.previous.z) > 350)
            emitQuestEvent({ type: "build", key: "final-relay" });
        }
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
    [
      beep,
      emitQuestEvent,
      landmarks,
      nexusNodes,
      lookup,
      publishChunks,
      requestChunk,
      world.gameMode,
      world.seed,
    ],
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
    if (nearest.node.id === "swamp-node")
      emitQuestEvent({ type: "activateNexus", key: "swamp-pylon" });
    if (nearest.node.id.startsWith("terminal-node-"))
      emitQuestEvent({ type: "activateNexus", key: "world-signal" });
    if (quest.current.repairedNodeIds.length >= 6)
      emitQuestEvent({ type: "activateNexus", key: "regional-network" });
    if (quest.current.repairedNodeIds.length >= 9) {
      emitQuestEvent({ type: "activateNexus", key: "nine-node-sync" });
      emitQuestEvent({ type: "activateNexus", key: "base-network" });
    }
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
      const cropItem =
        crop.cropId === "sungrain" ? BlockId.Sungrain : BlockId.RawSunroot;
      const seedItem =
        crop.cropId === "sungrain" ? BlockId.FieldSeed : BlockId.RootSeed;
      const grain = addToInventoryWithRemainder(inventory.current, cropItem, 2);
      const seeds = addToInventoryWithRemainder(grain.inventory, seedItem, 2);
      if (grain.remaining > 0 || seeds.remaining > 0) {
        questMessage.current = "背包已滿，無法收成。";
        return;
      }
      inventory.current = seeds.inventory;
      chunk.entities = chunk.entities.filter((entity) => entity.id !== crop.id);
      chunk.dirty = true;
      publishChunks();
      emitQuestEvent({ type: "harvest", key: "crop", amount: 1 });
      emitQuestEvent({ type: "harvest", key: crop.cropId, amount: 1 });
      questMessage.current =
        crop.cropId === "sungrain"
          ? "收成日穗與新種子。"
          : "收成生日根與新種子。";
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
        revision: playerServerRevision.current,
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
          revision: chunk.serverRevision,
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
                expectedRevision:
                  chunk.serverRevision > 0 ? chunk.serverRevision : undefined,
              }),
            },
          ),
        );
        requests.push(
          fetch(`/api/worlds/${world.id}/save`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              ...state,
              expectedRevision:
                playerServerRevision.current > 0
                  ? playerServerRevision.current
                  : undefined,
            }),
          }),
        );
        const results = await Promise.all(requests);
        const synced = results.every((result) => result.ok);
        if (synced) {
          for (let index = 0; index < dirty.length; index += 1) {
            const payload = (await results[index]!.json()) as {
              chunk?: { revision?: number };
            };
            dirty[index]!.serverRevision =
              payload.chunk?.revision ?? dirty[index]!.serverRevision;
            dirty[index]!.dirty = false;
            await putLocalChunk({
              worldId: world.id,
              chunkX: dirty[index]!.data.x,
              chunkZ: dirty[index]!.data.z,
              generationVersion: GENERATION_VERSION,
              chunkVersion: 1,
              modifiedBlocks: Array.from(dirty[index]!.modifications),
              entities: dirty[index]!.entities,
              updatedAt: now,
              revision: dirty[index]!.serverRevision,
            });
          }
          const playerPayload = (await results.at(-1)!.json()) as {
            state?: { revision?: number };
          };
          playerServerRevision.current =
            playerPayload.state?.revision ?? playerServerRevision.current;
          await putLocalPlayer({
            ...state,
            revision: playerServerRevision.current,
          });
        }
        onSaveStatus(synced ? "saved" : "failed");
      } else onSaveStatus("offline");
    } catch {
      onSaveStatus("failed");
    }
  }, [onSaveStatus, safeSpawn, world]);

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
    const onMouseDown = (event: MouseEvent) => {
      mouseButtons.current.add(event.button);
      if (event.button !== 0) changeBlock(event.button);
    };
    const onMouseUp = (event: MouseEvent) => {
      mouseButtons.current.delete(event.button);
      if (event.button === 0) miningProgress.current = null;
    };
    const onCraft = (event: Event) => {
      const recipe = GAME_RECIPES.find(
        (entry) => entry.id === (event as CustomEvent<string>).detail,
      );
      if (!recipe) return;
      const result = craftInventory(inventory.current, recipe);
      if (result) {
        inventory.current = result;
        emitQuestEvent({
          type: "craft",
          key: recipe.id,
          amount: recipe.output.count,
        });
        emitQuestEvent({
          type: "collect",
          key: getBlockDefinition(recipe.output.blockId).key,
          amount: recipe.output.count,
        });
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
    const findStation = (id: string) => {
      for (const chunk of chunks.current.values()) {
        const entity = chunk.entities.find(
          (entry): entry is InteractiveEntity =>
            (entry.kind === "container" || entry.kind === "processor") &&
            entry.id === id,
        );
        if (entity) return { chunk, entity };
      }
      return null;
    };
    const publishStation = (station: InteractiveEntity) => {
      publishChunks();
      window.dispatchEvent(
        new CustomEvent("fangyu-station-update", {
          detail: structuredClone(station),
        }),
      );
    };
    const onContainerTransfer = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          id: string;
          direction: "to-container" | "to-player";
          slot: number;
        }>
      ).detail;
      const found = findStation(detail.id);
      if (!found) return;
      const stationInventory =
        found.entity.kind === "container"
          ? found.entity.inventory
          : found.entity.output;
      const result =
        detail.direction === "to-container"
          ? transferInventoryStack(
              inventory.current,
              stationInventory,
              detail.slot,
            )
          : transferInventoryStack(
              stationInventory,
              inventory.current,
              detail.slot,
            );
      if (result.moved === 0) return;
      if (detail.direction === "to-container") {
        inventory.current = result.source;
        if (found.entity.kind === "container")
          found.entity.inventory = result.destination;
        else found.entity.output = result.destination;
      } else {
        inventory.current = result.destination;
        if (found.entity.kind === "container")
          found.entity.inventory = result.source;
        else found.entity.output = result.source;
      }
      found.entity.revision += 1;
      found.chunk.dirty = true;
      publishStation(found.entity);
      beep(330);
    };
    const onProcessorStart = (event: Event) => {
      const { id, recipeId } = (
        event as CustomEvent<{ id: string; recipeId: string }>
      ).detail;
      const found = findStation(id);
      if (!found || found.entity.kind !== "processor") return;
      const started = startProcessor(found.entity, inventory.current, recipeId);
      if (!started) {
        questMessage.current = "材料或脈熱燃芯不足，無法開始加工。";
        beep(95);
        return;
      }
      inventory.current = started.inventory;
      Object.assign(found.entity, started.processor);
      found.chunk.dirty = true;
      publishStation(found.entity);
      beep(390);
    };
    const onProcessorCollect = (event: Event) => {
      const { id } = (event as CustomEvent<{ id: string }>).detail;
      const found = findStation(id);
      if (!found || found.entity.kind !== "processor") return;
      const ready = finishProcessor(found.entity);
      const outputItem = ready.output.find(Boolean);
      const collected = collectProcessorOutput(ready, inventory.current);
      if (collected.moved === 0) {
        questMessage.current = "加工尚未完成，或背包沒有空間。";
        return;
      }
      inventory.current = collected.inventory;
      Object.assign(found.entity, collected.processor);
      found.chunk.dirty = true;
      emitQuestEvent({
        type: "craft",
        key: "refined-material",
        amount: collected.moved,
      });
      if (outputItem)
        emitQuestEvent({
          type: "collect",
          key: getBlockDefinition(outputItem.blockId).key,
          amount: collected.moved,
        });
      publishStation(found.entity);
      beep(540);
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
    const onFastTravel = (event: Event) => {
      const nodeId = (event as CustomEvent<{ nodeId: string }>).detail.nodeId;
      const node = nexusNodes.find((entry) => entry.id === nodeId);
      if (!node || !quest.current.repairedNodeIds.includes(nodeId)) {
        questMessage.current = "該節點尚未修復，無法建立安全通道。";
        return;
      }
      const paid = consumeInventoryItem(
        inventory.current,
        BlockId.WaygateFuel,
        1,
      );
      if (!paid) {
        questMessage.current = "快速旅行需要 1 枚遠行燃料。";
        return;
      }
      inventory.current = paid;
      position.current.set(...node.position);
      velocity.current.set(0, 0, 0);
      quest.current = {
        ...quest.current,
        activatedNodeIds: Array.from(
          new Set([...quest.current.activatedNodeIds, nodeId]),
        ),
      };
      emitQuestEvent({ type: "activateNexus", key: "waygate" });
      questMessage.current = `通道穩定：已抵達 ${node.name}。`;
      beep(700);
      void save();
    };
    const onE2eMine = (event: Event) => {
      if (!new URLSearchParams(window.location.search).has("e2e")) return;
      const item = (event as CustomEvent<{ crystal: "sun" | "dusk" }>).detail
        .crystal;
      const x = Math.floor(position.current.x) + 2,
        z = Math.floor(position.current.z),
        y = Math.floor(position.current.y + 0.2),
        coordinate = worldToChunk(x, z),
        local = worldToLocal(x, z),
        chunk = chunks.current.get(chunkKey(coordinate.x, coordinate.z));
      if (!chunk) return;
      const blockId =
        item === "sun" ? BlockId.SunShardOre : BlockId.DuskShardOre;
      setChunkBlock(chunk.data, local.x, y, local.z, blockId);
      chunk.modifications.set(voxelIndex(local.x, y, local.z), blockId);
      changeBlock(
        0,
        {
          block: { x, y, z },
          previous: { x: x - 1, y, z },
          blockId,
          distance: 2,
        },
        true,
      );
      position.current.set(x + 0.5, y, z + 0.5);
    };
    document.addEventListener("pointerlockchange", onLock);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mouseup", onMouseUp);
    window.addEventListener("fangyu-craft", onCraft);
    window.addEventListener("fangyu-inventory-move", onInventoryMove);
    window.addEventListener("fangyu-container-transfer", onContainerTransfer);
    window.addEventListener("fangyu-processor-start", onProcessorStart);
    window.addEventListener("fangyu-processor-collect", onProcessorCollect);
    window.addEventListener("fangyu-tutorial", onTutorial);
    window.addEventListener("fangyu-respawn", onRespawn);
    window.addEventListener("fangyu-fast-travel", onFastTravel);
    window.addEventListener("fangyu-e2e-mine", onE2eMine);
    return () => {
      document.removeEventListener("pointerlockchange", onLock);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("fangyu-craft", onCraft);
      window.removeEventListener("fangyu-inventory-move", onInventoryMove);
      window.removeEventListener(
        "fangyu-container-transfer",
        onContainerTransfer,
      );
      window.removeEventListener("fangyu-processor-start", onProcessorStart);
      window.removeEventListener(
        "fangyu-processor-collect",
        onProcessorCollect,
      );
      window.removeEventListener("fangyu-tutorial", onTutorial);
      window.removeEventListener("fangyu-respawn", onRespawn);
      window.removeEventListener("fangyu-fast-travel", onFastTravel);
      window.removeEventListener("fangyu-e2e-mine", onE2eMine);
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
    nexusNodes,
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
    if (
      !paused &&
      document.pointerLockElement === gl.domElement &&
      mouseButtons.current.has(0) &&
      hit.current
    ) {
      const currentHit = hit.current;
      const key = `${currentHit.block.x}:${currentHit.block.y}:${currentHit.block.z}`;
      if (!miningProgress.current || miningProgress.current.key !== key)
        miningProgress.current = { key, seconds: 0 };
      miningProgress.current.seconds += delta;
      const required = miningSeconds(
        currentHit.blockId,
        inventory.current[selected.current] ?? null,
      );
      if (miningProgress.current.seconds >= required) {
        miningProgress.current = null;
        changeBlock(0);
      }
    } else if (!mouseButtons.current.has(0)) miningProgress.current = null;
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
          velocity.current.y = nextSwimmingVelocityY(
            velocity.current.y,
            keys.current.has("Space"),
            keys.current.has("ControlLeft"),
            dt,
          );
        } else if (keys.current.has("Space") && grounded.current) {
          velocity.current.y = 8;
          grounded.current = false;
          beep(260);
        }
        if (!inWater) velocity.current.y -= 22 * dt;
        const eyeHeight = keys.current.has("ControlLeft") ? 1.35 : 1.62;
        const headUnderwater =
          lookup(
            Math.floor(position.current.x),
            Math.floor(position.current.y + eyeHeight),
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
    const cameraUnderwater =
      lookup(
        Math.floor(camera.position.x),
        Math.floor(camera.position.y),
        Math.floor(camera.position.z),
      ) === BlockId.Water;
    const underwaterSky = new THREE.Color("#123a57");
    // This is a camera/scene effect, never a quad placed in front of the
    // camera. It is only active when the actual camera voxel contains water.
    state.scene.background = cameraUnderwater ? underwaterSky : sky;
    state.scene.fog = new THREE.Fog(
      cameraUnderwater ? underwaterSky : sky,
      cameraUnderwater ? 1.5 : settings.renderDistance * CHUNK_SIZE * 0.75,
      cameraUnderwater
        ? Math.min(34, settings.renderDistance * CHUNK_SIZE * 0.9)
        : settings.renderDistance * CHUNK_SIZE * 1.65,
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
        id: createRuntimeId(),
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
    (creatureId: string, species: "cow" | "sheep" | "pig") => {
      let saved: { chunk: LoadedChunk; entity: CreatureEntity } | null = null;
      for (const chunk of chunks.current.values()) {
        const entity = chunk.entities.find(
          (entry): entry is CreatureEntity =>
            entry.kind === "creature" && entry.id === creatureId,
        );
        if (entity) {
          saved = { chunk, entity };
          break;
        }
      }
      if (!saved) return false;
      if (species === "pig") {
        const fed = consumeInventoryItem(
          inventory.current,
          BlockId.FieldSeed,
          1,
        );
        if (!fed) {
          questMessage.current = "星紋豬喜歡日穗種子。";
          return false;
        }
        inventory.current = fed;
        saved.entity.health = Math.min(
          saved.entity.maxHealth ?? 10,
          saved.entity.health + 2,
        );
        saved.entity.lastProductAt = new Date().toISOString();
        saved.chunk.dirty = true;
        emitQuestEvent({ type: "animalProduct", key: "pig-care" });
        questMessage.current = "星紋豬已進食並恢復生命。";
        beep(460);
        return true;
      }
      const cooldown = species === "cow" ? 45_000 : 120_000;
      if (
        saved.entity.lastProductAt &&
        Date.now() - Date.parse(saved.entity.lastProductAt) < cooldown
      ) {
        questMessage.current = "這隻動物需要休息一段時間。";
        return false;
      }
      if (
        species === "sheep" &&
        saved.entity.woolly === false &&
        (!saved.entity.woolRegrowsAt ||
          Date.parse(saved.entity.woolRegrowsAt) > Date.now())
      ) {
        questMessage.current = "雲絨仍在重新生長。";
        return false;
      }
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
        saved.entity.lastProductAt = new Date().toISOString();
        saved.chunk.dirty = true;
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
      saved.entity.lastProductAt = new Date().toISOString();
      saved.entity.woolly = false;
      saved.entity.woolRegrowsAt = new Date(Date.now() + 120_000).toISOString();
      saved.chunk.dirty = true;
      const shearsSlot = inventory.current.findIndex(
        (stack) => stack?.blockId === BlockId.FiberShears,
      );
      if (shearsSlot >= 0)
        inventory.current = damageTool(inventory.current, shearsSlot);
      emitQuestEvent({ type: "animalProduct", key: "wool" });
      questMessage.current = "取得雲絨；牠會隨時間重新長出毛層。";
      beep(480);
      return true;
    },
    [beep, emitQuestEvent],
  );

  const interactNpc = useCallback(
    (id: string, profession: NpcEntity["profession"], name: string) => {
      quest.current = acceptSideQuest(quest.current, profession);
      const pendingQuest = SIDE_QUESTS.find(
        (entry) =>
          entry.profession === profession &&
          quest.current.pendingSideQuestRewards.includes(entry.id) &&
          !quest.current.claimedSideQuestRewards.includes(entry.id),
      );
      if (
        pendingQuest?.reward.itemId !== undefined &&
        pendingQuest.reward.count
      ) {
        const granted = addToInventoryWithRemainder(
          inventory.current,
          pendingQuest.reward.itemId,
          pendingQuest.reward.count,
        );
        if (granted.remaining === 0) {
          inventory.current = granted.inventory;
          quest.current = {
            ...quest.current,
            claimedSideQuestRewards: Array.from(
              new Set([
                ...quest.current.claimedSideQuestRewards,
                pendingQuest.id,
              ]),
            ),
            pendingSideQuestRewards:
              quest.current.pendingSideQuestRewards.filter(
                (entry) => entry !== pendingQuest.id,
              ),
          };
          questMessage.current = `${name}：已補領 ${pendingQuest.reward.label}。`;
          beep(690);
          return;
        }
      }
      for (const chunk of chunks.current.values()) {
        const npc = chunk.entities.find(
          (entity): entity is NpcEntity =>
            entity.kind === "npc" && entity.id === id,
        );
        if (!npc) continue;
        npc.tradeCount += 1;
        npc.interactionFlags = Array.from(
          new Set([...npc.interactionFlags, "met-player"]),
        );
        npc.questStep = Math.max(npc.questStep, 1);
        chunk.dirty = true;
        break;
      }
      emitQuestEvent({ type: "interactNPC", key: profession });
      if (profession === "trader") {
        const withoutParts = consumeInventoryItem(
          inventory.current,
          BlockId.SettlerComponent,
          3,
        );
        const alliancePaid = withoutParts
          ? consumeInventoryItem(withoutParts, BlockId.FrequencyCore, 1)
          : null;
        if (alliancePaid) {
          const seal = addToInventoryWithRemainder(
            alliancePaid,
            BlockId.AllianceSeal,
            1,
          );
          if (seal.remaining === 0) {
            inventory.current = seal.inventory;
            emitQuestEvent({ type: "trade", key: "alliance-seal" });
            emitQuestEvent({ type: "trade", key: "trader" });
            emitQuestEvent({ type: "collect", key: "alliance-seal" });
            questMessage.current = `${name}：各聚落已共同簽發聯盟印記。`;
            beep(680);
            return;
          }
        }
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
            emitQuestEvent({ type: "trade", key: "trader" });
            questMessage.current = `${name}：交易完成，2 星砂換得 2 日穗種子。`;
            beep(610);
            return;
          }
        }
        questMessage.current = `${name}：準備 2 星砂並保留背包空間，我能交換日穗種子。`;
        return;
      }
      if (profession === "crafter") {
        const withoutPart = consumeInventoryItem(
          inventory.current,
          BlockId.OldComponent,
          1,
        );
        const paid = withoutPart
          ? consumeInventoryItem(withoutPart, BlockId.CopperBloom, 1)
          : null;
        if (paid) {
          const received = addToInventoryWithRemainder(
            paid,
            BlockId.SettlerComponent,
            1,
          );
          if (received.remaining === 0) {
            inventory.current = received.inventory;
            emitQuestEvent({ type: "trade", key: "settler-component" });
            emitQuestEvent({ type: "trade", key: "crafter" });
            emitQuestEvent({ type: "collect", key: "settler-component" });
            questMessage.current = `${name}：遺留零件已重製成工匠元件。`;
            beep(590);
            return;
          }
        }
        questMessage.current = `${name}：帶來 1 遺留零件與 1 銅花礦，我可以重製它。`;
        return;
      }
      if (profession === "explorer") {
        const paid = consumeInventoryItem(
          inventory.current,
          BlockId.ResonantPlant,
          2,
        );
        if (paid) {
          const received = addToInventoryWithRemainder(
            paid,
            BlockId.WaygateFuel,
            1,
          );
          if (received.remaining === 0) {
            inventory.current = received.inventory;
            emitQuestEvent({ type: "trade", key: "waygate-fuel" });
            emitQuestEvent({ type: "trade", key: "explorer" });
            emitQuestEvent({ type: "collect", key: "waygate-fuel" });
            questMessage.current = `${name}：共鳴植物已換成一枚遠行燃料。`;
            beep(620);
            return;
          }
        }
        questMessage.current = `${name}：2 株共鳴植物可以交換 1 枚遠行燃料。`;
        return;
      }
      if (profession === "farmer") {
        const paid = consumeInventoryItem(
          inventory.current,
          BlockId.Sungrain,
          2,
        );
        if (paid) {
          const received = addToInventoryWithRemainder(
            paid,
            BlockId.RootSeed,
            2,
          );
          if (received.remaining === 0) {
            inventory.current = received.inventory;
            emitQuestEvent({ type: "trade", key: "farmer" });
            questMessage.current = `${name}：日穗已交換成 2 枚日根種子。`;
            beep(580);
            return;
          }
        }
        questMessage.current = `${name}：2 份日穗可以交換 2 枚日根種子。`;
        return;
      }
      if (profession === "researcher") {
        const withoutSun = consumeInventoryItem(
          inventory.current,
          BlockId.SunShard,
          1,
        );
        const paid = withoutSun
          ? consumeInventoryItem(withoutSun, BlockId.DuskShard, 1)
          : null;
        if (paid) {
          const received = addToInventoryWithRemainder(
            paid,
            BlockId.RefinedAlloy,
            1,
          );
          if (received.remaining === 0) {
            inventory.current = received.inventory;
            emitQuestEvent({ type: "trade", key: "researcher" });
            emitQuestEvent({ type: "collect", key: "refined-material" });
            questMessage.current = `${name}：雙相晶樣已穩定成穩相合金。`;
            beep(650);
            return;
          }
        }
        questMessage.current = `${name}：日耀晶與暮影晶各 1 枚可交換穩相合金。`;
        return;
      }
      questMessage.current = `${name}（${profession}）：支線任務已記入 Journal。`;
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
      <DoorField doors={renderDoors} />
      <SelectionOutline hit={hit.current} />
      <NexusNodeField
        nodes={nexusNodes}
        repairedNodeIds={quest.current.repairedNodeIds}
      />
      <CreatureField
        seed={world.seed}
        lookup={lookup}
        persistedCreatures={renderCreatures}
        player={position}
        paused={paused}
        onDrop={spawnWorldDrop}
        onProduct={obtainAnimalProduct}
        onPersist={(id, nextPosition, nextHealth, alive) => {
          for (const chunk of chunks.current.values()) {
            const entity = chunk.entities.find(
              (entry): entry is CreatureEntity =>
                entry.kind === "creature" && entry.id === id,
            );
            if (!entity) continue;
            if (!alive)
              chunk.entities = chunk.entities.filter(
                (entry) => entry.id !== id,
              );
            else {
              entity.position = nextPosition;
              entity.health = nextHealth;
              entity.state = "wander";
              if (
                entity.species === "sheep" &&
                entity.woolly === false &&
                entity.woolRegrowsAt &&
                Date.parse(entity.woolRegrowsAt) <= Date.now()
              ) {
                entity.woolly = true;
                delete entity.woolRegrowsAt;
              }
            }
            chunk.dirty = true;
            break;
          }
        }}
        damage={(amount) => {
          if (world.gameMode === "survival")
            health.current = Math.max(0, health.current - amount);
        }}
      />
      <NpcVillageField
        npcs={renderNpcs}
        seed={world.seed}
        player={position}
        paused={paused}
        timeOfDay={timeOfDay}
        onInteract={interactNpc}
        onPersist={(id, nextPosition, scheduleState) => {
          for (const chunk of chunks.current.values()) {
            const npc = chunk.entities.find(
              (entity): entity is NpcEntity =>
                entity.kind === "npc" && entity.id === id,
            );
            if (!npc) continue;
            npc.position = nextPosition;
            npc.scheduleState = scheduleState;
            chunk.dirty = true;
            break;
          }
        }}
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
  lookup,
  persistedCreatures,
  player,
  paused,
  onDrop,
  onProduct,
  onPersist,
  damage,
}: {
  seed: string;
  lookup: WorldBlockLookup;
  persistedCreatures: readonly RenderCreature[];
  player: RefObject<THREE.Vector3>;
  paused: boolean;
  onDrop: (
    itemId: BlockIdValue,
    position: readonly [number, number, number],
  ) => boolean;
  onProduct: (id: string, species: "cow" | "sheep" | "pig") => boolean;
  onPersist: (
    id: string,
    position: readonly [number, number, number],
    health: number,
    alive: boolean,
  ) => void;
  damage: (amount: number) => void;
}) {
  const { camera } = useThree();
  const [, redraw] = useState(0);
  const persistClock = useRef(0);
  const creatures = useMemo(() => {
    const ocean = findBiomeSpot(seed, "ocean");
    const colors: Record<string, string> = {
      chicken: "#e6bd57",
      cow: "#9b6a43",
      pig: "#d98586",
      sheep: "#d9e4df",
      rabbit: "#b89b79",
      fish: "#48a9c9",
      riftling: "#7d4ab2",
    };
    const entries = [
      ...persistedCreatures.map((entity) => ({
        id: entity.id,
        species: entity.species,
        health: entity.health,
        position: entity.position,
        persistent: true,
      })),
      {
        id: "transient-fish",
        species: "fish",
        health: 4,
        position: [ocean[0], SEA_LEVEL - 1.2, ocean[1]] as const,
        persistent: false,
      },
      {
        id: "transient-riftling",
        species: "riftling",
        health: 9,
        position: [-7, terrainHeight(seed, -7, -8) + 0.7, -8] as const,
        persistent: false,
      },
    ];
    return entries.map((entry, index) => ({
      ...entry,
      color: colors[entry.species] ?? "#cccccc",
      alive: true,
      mesh: null as THREE.Group | null,
      position: new THREE.Vector3(...entry.position),
      heading: index * 0.83,
      think: 1.4 + index * 0.6,
      eggClock: entry.species === "chicken" ? 70 : Infinity,
      attackClock: 0,
    }));
  }, [persistedCreatures, seed]);

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
      if (target.persistent)
        onPersist(
          target.id,
          [target.position.x, target.position.y, target.position.z],
          0,
          false,
        );
      redraw((value) => value + 1);
    };
    const interact = () => {
      const nearest = creatures
        .filter(
          (creature) =>
            creature.alive &&
            (creature.species === "cow" ||
              creature.species === "sheep" ||
              creature.species === "pig"),
        )
        .map((creature) => ({
          creature,
          distance: creature.position.distanceTo(player.current),
        }))
        .sort((a, b) => a.distance - b.distance)[0];
      if (!nearest || nearest.distance > 3.2) return;
      const species = nearest.creature.species as "cow" | "sheep" | "pig";
      onProduct(nearest.creature.id, species);
    };
    window.addEventListener("fangyu-attack", attack);
    window.addEventListener("fangyu-creature-interact", interact);
    return () => {
      window.removeEventListener("fangyu-attack", attack);
      window.removeEventListener("fangyu-creature-interact", interact);
    };
  }, [camera, creatures, onDrop, onPersist, onProduct, player]);
  useFrame((_, delta) => {
    if (paused) return;
    persistClock.current += delta;
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
        const nextX =
            creature.position.x + Math.sin(creature.heading) * delta * 0.55,
          nextZ =
            creature.position.z + Math.cos(creature.heading) * delta * 0.55;
        if (
          lookup(Math.floor(nextX), SEA_LEVEL - 1, Math.floor(nextZ)) ===
          BlockId.Water
        ) {
          creature.position.x = nextX;
          creature.position.z = nextZ;
        } else creature.heading += Math.PI * 0.65;
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
        const nextX =
            creature.position.x + Math.sin(creature.heading) * delta * speed,
          nextZ =
            creature.position.z + Math.cos(creature.heading) * delta * speed,
          blocked = getBlockDefinition(
            lookup(
              Math.floor(nextX),
              Math.floor(creature.position.y + 0.7),
              Math.floor(nextZ),
            ),
          ).solid;
        if (blocked) creature.heading += Math.PI * (0.45 + delta);
        else {
          creature.position.x = nextX;
          creature.position.z = nextZ;
        }
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
    if (persistClock.current >= 5) {
      persistClock.current = 0;
      for (const creature of creatures)
        if (creature.persistent)
          onPersist(
            creature.id,
            [creature.position.x, creature.position.y, creature.position.z],
            creature.health,
            creature.alive,
          );
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
  npcs,
  seed,
  player,
  paused,
  timeOfDay,
  onInteract,
  onPersist,
}: {
  npcs: readonly RenderNpc[];
  seed: string;
  player: RefObject<THREE.Vector3>;
  paused: boolean;
  timeOfDay: RefObject<number>;
  onInteract: (
    id: string,
    profession: NpcEntity["profession"],
    name: string,
  ) => void;
  onPersist: (
    id: string,
    position: readonly [number, number, number],
    scheduleState: NpcEntity["scheduleState"],
  ) => void;
}) {
  const villagers = useMemo(() => {
    const colors: Record<NpcEntity["profession"], string> = {
      farmer: "#71ad56",
      crafter: "#c77b4e",
      trader: "#d5b64d",
      explorer: "#4e9fc7",
      researcher: "#a46dcc",
    };
    return npcs.map((npc) => {
      const home = new THREE.Vector3(...npc.home);
      const work = new THREE.Vector3(...npc.work);
      return {
        id: npc.id,
        name: npc.name,
        role: npc.profession,
        color: colors[npc.profession],
        home,
        work,
        position: new THREE.Vector3(...npc.position),
        scheduleState: npc.scheduleState,
        mesh: null as THREE.Group | null,
      };
    });
  }, [npcs]);
  const persistClock = useRef(0);

  useEffect(() => {
    const interact = () => {
      const nearest = villagers
        .map((villager) => ({
          villager,
          distance: villager.position.distanceTo(player.current),
        }))
        .sort((a, b) => a.distance - b.distance)[0];
      if (nearest && nearest.distance <= 3.2)
        onInteract(
          nearest.villager.id,
          nearest.villager.role,
          nearest.villager.name,
        );
    };
    window.addEventListener("fangyu-creature-interact", interact);
    return () =>
      window.removeEventListener("fangyu-creature-interact", interact);
  }, [onInteract, player, villagers]);

  useFrame((_, delta) => {
    if (paused) return;
    persistClock.current += delta;
    const day = timeOfDay.current >= 0.18 && timeOfDay.current <= 0.72;
    for (const [index, villager] of villagers.entries()) {
      if (!villager.mesh) continue;
      const distance = villager.position.distanceTo(player.current);
      villager.mesh.visible = distance < 72;
      if (distance >= 72) continue;
      const target = day ? villager.work : villager.home;
      villager.scheduleState = day ? "working" : "home";
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
    if (persistClock.current >= 5) {
      persistClock.current = 0;
      for (const villager of villagers)
        onPersist(
          villager.id,
          [villager.position.x, villager.position.y, villager.position.z],
          villager.scheduleState,
        );
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
