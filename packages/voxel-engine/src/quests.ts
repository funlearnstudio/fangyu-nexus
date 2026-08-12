import { BlockId, type BlockIdValue } from "./blocks";
import { terrainHeight } from "./world";
import type { Inventory } from "./gameplay";

export const NEXUS_QUEST_VERSION = 2;
export const NEXUS_NODE_CRYSTAL_COST = 3;
export const MAIN_QUEST_LEVELS = 50;

export type QuestObjectiveType =
  | "collect"
  | "mine"
  | "craft"
  | "place"
  | "build"
  | "travel"
  | "discoverBiome"
  | "discoverStructure"
  | "interactNPC"
  | "trade"
  | "harvest"
  | "animalProduct"
  | "repairNode"
  | "activateNexus"
  | "composite";

export interface QuestObjectiveDefinition {
  id: string;
  type: QuestObjectiveType;
  label: string;
  target: number;
  key?: string;
}

export interface QuestReward {
  label: string;
  itemId?: BlockIdValue;
  count?: number;
  unlock?: string;
}

export interface QuestDefinition {
  id: string;
  level: number;
  title: string;
  description: string;
  prerequisites: string[];
  objectives: QuestObjectiveDefinition[];
  rewards: QuestReward[];
  unlocks: string[];
}

export interface GameplayEvent {
  id: string;
  type: QuestObjectiveType;
  key?: string;
  amount?: number;
}

export interface NexusQuestState {
  version: number;
  currentQuestLevel: number;
  completedQuestIds: string[];
  objectiveProgress: Record<string, number>;
  claimedRewards: string[];
  tutorialCompleted: boolean;
  tutorialSkipped: boolean;
  discoveredBiomes: string[];
  discoveredStructures: string[];
  repairedNodeIds: string[];
  processedEventIds: string[];
  postGame: boolean;
  beaconClaimed: boolean;
  completedAt?: string;
}

export interface NexusNode {
  id: "amber" | "azure" | "violet";
  name: string;
  position: readonly [number, number, number];
}

const objective = (
  id: string,
  type: QuestObjectiveType,
  label: string,
  key?: string,
  target = 1,
): QuestObjectiveDefinition => ({
  id,
  type,
  label,
  target,
  ...(key ? { key } : {}),
});

const rawLevels: Array<
  readonly [string, string, QuestObjectiveDefinition[], string, string[]]
> = [
  [
    "Awakening",
    "追蹤沉睡的 Nexus 訊號。",
    [objective("travel", "travel", "離開出生點並定位信標", undefined, 8)],
    "Nexus 方位脈衝",
    ["beacon-signal"],
  ],
  [
    "First Materials",
    "從世界取得第一批建造材料。",
    [
      objective("timber", "collect", "拾取琥珀木", "timber", 2),
      objective("slate", "collect", "拾取深紋岩", "slate", 2),
    ],
    "基礎材料配方",
    ["basic-recipes"],
  ],
  [
    "Tools of the Verge",
    "製作第一件方域工具。",
    [objective("tool", "craft", "製作拓荒工具", "trail-tool")],
    "拓荒工具",
    ["tools"],
  ],
  [
    "A Roof Against Night",
    "用牆面與屋頂建立有效庇護所。",
    [
      objective("walls", "place", "放置牆面方塊", undefined, 12),
      objective("roof", "build", "完成遮蔽空間", "shelter"),
    ],
    "庇護所標記",
    ["shelter"],
  ],
  [
    "First Crystal",
    "發現並親手拾取一枚 Nexus 晶體。",
    [objective("crystal", "collect", "拾取日耀晶或暮影晶", "nexus-crystal")],
    "信標晶槽",
    ["crystal-slot"],
  ],
  [
    "Sustenance",
    "找到能長期維持探索的食物。",
    [objective("food", "collect", "取得可食用物", "food", 3)],
    "簡易烹調",
    ["food"],
  ],
  [
    "Seeds of Tomorrow",
    "耕作並完成第一次收成。",
    [
      objective("plant", "place", "種下作物", "crop", 4),
      objective("harvest", "harvest", "收成成熟作物", "crop", 2),
    ],
    "農耕工具",
    ["farming"],
  ],
  [
    "Living World",
    "觀察生物並取得不傷害牠們的產物。",
    [objective("animal", "animalProduct", "取得蛋、奶或羊毛", undefined, 1)],
    "生物圖誌",
    ["animal-care"],
  ],
  [
    "Beyond Home",
    "跨出出生區域，踏入第二種生態系。",
    [objective("biome", "discoverBiome", "發現第二種生態系", undefined, 2)],
    "遠行羅盤",
    ["exploration"],
  ],
  [
    "The First Node",
    "找到並修復第一座失落節點。",
    [objective("node", "repairNode", "修復一座 Nexus 節點", undefined, 1)],
    "節點傳送座",
    ["node-1"],
  ],
  [
    "Riverbound",
    "沿著水系尋找新路線。",
    [
      objective("river", "discoverBiome", "發現河流", "river"),
      objective("travel", "travel", "沿河行進", undefined, 120),
    ],
    "水域導航",
    ["swimming"],
  ],
  [
    "Forest Memory",
    "從密林採集共鳴植物。",
    [
      objective("forest", "discoverBiome", "發現密林", "dense-forest"),
      objective("plant", "collect", "取得共鳴植物", "forest-plant", 3),
    ],
    "植物纖維配方",
    ["forest-crafting"],
  ],
  [
    "Across the Dunes",
    "穿越沙海並定位一座遺跡。",
    [
      objective("desert", "discoverBiome", "發現沙漠", "desert"),
      objective("ruin", "discoverStructure", "找到沙漠遺跡", "desert-ruin"),
    ],
    "遺跡拓印",
    ["ruin-map"],
  ],
  [
    "Echoes Beneath",
    "進入洞穴深處帶回地下晶體。",
    [
      objective("cave", "discoverStructure", "發現洞穴", "cave"),
      objective("dusk", "collect", "拾取暮影晶", "dusk-shard", 2),
    ],
    "洞穴燈具",
    ["cave-kit"],
  ],
  [
    "Tideglass",
    "抵達海岸並從海域取得潮汐材料。",
    [
      objective("ocean", "discoverBiome", "發現海洋", "ocean"),
      objective("tide", "collect", "取得潮汐玻晶", "tideglass", 2),
    ],
    "潛水補給",
    ["ocean-kit"],
  ],
  [
    "Abandoned Hearth",
    "調查一座被遺忘的房屋。",
    [
      objective("home", "discoverStructure", "找到廢棄房屋", "abandoned-home"),
      objective("cache", "collect", "取回遺留零件", "old-component"),
    ],
    "修復圖紙",
    ["restoration"],
  ],
  [
    "Neighbors",
    "找到聚落並認識第一位居民。",
    [
      objective("village", "discoverStructure", "找到聚落", "village"),
      objective("npc", "interactNPC", "與居民交談", undefined, 1),
    ],
    "聚落聲望",
    ["settlements"],
  ],
  [
    "Fair Exchange",
    "透過交易取得無法獨自製作的零件。",
    [
      objective("trade", "trade", "完成一筆交易", undefined, 1),
      objective("part", "collect", "取得工匠零件", "settler-component"),
    ],
    "交易欄位",
    ["trading"],
  ],
  [
    "Twin Signals",
    "修復第二座節點，校準雙向訊號。",
    [
      objective("node", "repairNode", "累計修復兩座節點", undefined, 2),
      objective("component", "craft", "製作校準器", "node-calibrator"),
    ],
    "雙節點定位",
    ["node-2"],
  ],
  [
    "Three Horizons",
    "連結第三節點並完成探索者階段。",
    [
      objective("node", "repairNode", "累計修復三座節點", undefined, 3),
      objective("biomes", "discoverBiome", "累計發現五種生態系", undefined, 5),
    ],
    "初級 Nexus Network",
    ["network-1"],
  ],
  [
    "Workshop",
    "建立具備儲存與加工能力的工作區。",
    [
      objective("station", "place", "放置工作站", "workstation", 2),
      objective("storage", "place", "放置儲存箱", "chest", 2),
    ],
    "工程工作站",
    ["workshop"],
  ],
  [
    "Refined Matter",
    "加工原礦並製作穩定合金。",
    [objective("process", "craft", "加工三種材料", "refined-material", 3)],
    "精煉爐",
    ["processing"],
  ],
  [
    "Granary",
    "擴建農田並建立糧食儲備。",
    [
      objective("farm", "build", "建造大型農田", "large-farm"),
      objective("harvest", "harvest", "收成兩種作物", undefined, 8),
    ],
    "種子保存箱",
    ["advanced-farming"],
  ],
  [
    "Herdcraft",
    "照料多種動物並取得可再生資源。",
    [objective("products", "animalProduct", "取得三類動物產物", undefined, 3)],
    "牧養設備",
    ["animal-management"],
  ],
  [
    "Roadmaker",
    "建立連接基地與聚落的運輸路線。",
    [
      objective("road", "place", "鋪設道路", "path", 32),
      objective("travel", "travel", "沿路完成遠行", undefined, 300),
    ],
    "路標網路",
    ["transport"],
  ],
  [
    "Settlement Hands",
    "協助居民修復生產設施。",
    [
      objective("npc", "interactNPC", "接受居民委託", undefined, 2),
      objective("repair", "build", "修復聚落設施", "village-workshop"),
    ],
    "工匠折扣",
    ["village-upgrade"],
  ],
  [
    "Nexus Conduit",
    "組合多來源材料製作能量導管。",
    [
      objective("conduit", "craft", "製作 Nexus 導管", "nexus-conduit", 3),
      objective("place", "place", "安裝導管", "nexus-conduit", 3),
    ],
    "導管技術",
    ["conduits"],
  ],
  [
    "Mountain Relay",
    "攀登高山並建立訊號中繼站。",
    [
      objective("mountain", "discoverBiome", "發現高山", "mountain"),
      objective("relay", "build", "建造高山中繼站", "mountain-relay"),
    ],
    "高地訊號",
    ["relay"],
  ],
  [
    "Deep Logistics",
    "把地下資源安全運回地表基地。",
    [
      objective("mine", "discoverStructure", "找到古礦坑", "mine"),
      objective("rare", "collect", "取得深層合金", "deep-alloy", 3),
      objective("travel", "travel", "返回基地", undefined, 500),
    ],
    "運輸箱",
    ["logistics"],
  ],
  [
    "Engineer's Accord",
    "整合農業、加工、交易與節點技術。",
    [
      objective("trade", "trade", "取得研究元件", undefined, 2),
      objective("core", "craft", "製作工程核心", "engineer-core"),
    ],
    "工程師核心",
    ["engineering-complete"],
  ],
  [
    "Far Signal",
    "追蹤第一個遠距世界訊號。",
    [
      objective("travel", "travel", "離出生點遠行", undefined, 800),
      objective("tower", "discoverStructure", "找到 Nexus 塔", "nexus-tower"),
    ],
    "遠距掃描",
    ["network-2"],
  ],
  [
    "Frozen Circuit",
    "在凍原修復低溫節點。",
    [
      objective("tundra", "discoverBiome", "發現凍原", "tundra"),
      objective("node", "repairNode", "修復凍原節點", "tundra-node"),
    ],
    "寒域穩壓器",
    ["cold-node"],
  ],
  [
    "Swamp Lanterns",
    "穿越沼澤並重啟淹沒的訊號柱。",
    [
      objective("swamp", "discoverBiome", "發現沼澤", "swamp"),
      objective("ruin", "discoverStructure", "找到淹沒遺跡", "sunken-ruin"),
      objective("activate", "activateNexus", "啟動訊號柱", "swamp-pylon"),
    ],
    "濕地濾芯",
    ["swamp-pylon"],
  ],
  [
    "Bases Apart",
    "在不同區域建立第二座可用基地。",
    [
      objective("base", "build", "建立遠端基地", "remote-base"),
      objective("storage", "place", "設置遠端儲存", "chest", 3),
    ],
    "基地同步",
    ["multi-base"],
  ],
  [
    "Undercity",
    "探索大型地下遺跡並恢復照明。",
    [
      objective(
        "ruin",
        "discoverStructure",
        "找到地下遺跡",
        "underground-ruin",
      ),
      objective("lights", "place", "恢復遺跡照明", "nexus-light", 6),
    ],
    "地下路標",
    ["undercity"],
  ],
  [
    "Caravan Circuit",
    "完成兩個聚落間的貿易循環。",
    [
      objective(
        "villages",
        "discoverStructure",
        "累計找到兩座聚落",
        "village",
        2,
      ),
      objective("trade", "trade", "在兩地完成交易", undefined, 4),
    ],
    "商旅憑證",
    ["caravan"],
  ],
  [
    "The Fourth Frequency",
    "使用多生態材料校準網路頻率。",
    [
      objective("biomes", "discoverBiome", "累計發現八種生態系", undefined, 8),
      objective("frequency", "craft", "製作頻率核心", "frequency-core"),
    ],
    "第四頻率",
    ["frequency-4"],
  ],
  [
    "Waygate",
    "建造第一座有限資源傳送門。",
    [
      objective("gate", "build", "建造 Waygate", "waygate"),
      objective("fuel", "collect", "準備傳送燃料", "waygate-fuel", 4),
    ],
    "有限快速旅行",
    ["fast-travel"],
  ],
  [
    "Ruin Constellation",
    "連續定位三種古代 Nexus 結構。",
    [
      objective(
        "ruins",
        "discoverStructure",
        "發現三類 Nexus 遺跡",
        "nexus-ruin",
        3,
      ),
    ],
    "遺跡星圖",
    ["ruin-network"],
  ],
  [
    "World Network",
    "使區域節點、聚落與基地形成穩定網路。",
    [
      objective("nodes", "repairNode", "累計修復六座節點", undefined, 6),
      objective("bases", "build", "建立三座基地", "base", 3),
      objective(
        "activate",
        "activateNexus",
        "啟動區域網路",
        "regional-network",
      ),
    ],
    "區域 Network",
    ["network-3"],
  ],
  [
    "Stormproof",
    "為最終遠征建立全天候補給。",
    [
      objective("food", "collect", "準備多類補給", "expedition-food", 12),
      objective("gear", "craft", "製作遠征裝備", "expedition-gear", 3),
    ],
    "遠征套件",
    ["endgame-kit"],
  ],
  [
    "Voices of Five",
    "取得五位不同居民專家的協助。",
    [
      objective("npcs", "interactNPC", "與五種職業居民合作", undefined, 5),
      objective("trades", "trade", "完成專家交易", undefined, 5),
    ],
    "聚落聯盟",
    ["settler-alliance"],
  ],
  [
    "Crystal Spectrum",
    "集齊來自地表、洞穴、海洋與高山的晶體。",
    [objective("spectrum", "collect", "集齊四系晶體", "crystal-spectrum", 4)],
    "光譜核心",
    ["spectrum"],
  ],
  [
    "Ancient Machine",
    "在大型遺跡中修復古代機械。",
    [
      objective(
        "machine",
        "discoverStructure",
        "找到古代機械",
        "ancient-machine",
      ),
      objective("repair", "craft", "製作機械修復組", "machine-kit", 3),
      objective("activate", "activateNexus", "啟動古代機械", "ancient-machine"),
    ],
    "古代能源",
    ["ancient-power"],
  ],
  [
    "Nine Nodes",
    "讓九座節點以相同頻率運作。",
    [
      objective("nodes", "repairNode", "累計修復九座節點", undefined, 9),
      objective("sync", "activateNexus", "同步節點頻率", "nine-node-sync"),
    ],
    "全域同步器",
    ["network-4"],
  ],
  [
    "Worldline Survey",
    "完成跨越所有主要生態系的測繪。",
    [
      objective("biomes", "discoverBiome", "發現十種主要生態系", undefined, 10),
      objective(
        "structures",
        "discoverStructure",
        "記錄八類結構",
        undefined,
        8,
      ),
      objective("travel", "travel", "累計長途探索", undefined, 3000),
    ],
    "完整世界圖",
    ["world-map"],
  ],
  [
    "Core Fragments",
    "從三座高危遺跡回收核心碎片。",
    [
      objective(
        "ruins",
        "discoverStructure",
        "找到三座終局遺跡",
        "endgame-ruin",
        3,
      ),
      objective("fragments", "collect", "回收核心碎片", "core-fragment", 3),
    ],
    "核心座標",
    ["core-location"],
  ],
  [
    "The Last Relay",
    "建立最遠端中繼站並連回所有基地。",
    [
      objective("relay", "build", "建造終端中繼站", "final-relay"),
      objective("network", "activateNexus", "連接所有基地", "base-network"),
    ],
    "最終訊號",
    ["final-signal"],
  ],
  [
    "Threshold",
    "組裝最終遠征所需的多系統設備。",
    [
      objective(
        "components",
        "craft",
        "製作三種終局元件",
        "endgame-component",
        3,
      ),
      objective("alliance", "trade", "取得聚落聯盟授權", "alliance-seal"),
      objective("fuel", "collect", "準備核心燃料", "core-fuel", 6),
    ],
    "核心鑰匙",
    ["core-key"],
  ],
  [
    "The Nexus Core",
    "完成跨世界遠征，修復並啟動 Nexus Core。",
    [
      objective(
        "signals",
        "activateNexus",
        "啟動三個世界級訊號",
        "world-signal",
        3,
      ),
      objective("terminals", "repairNode", "修復終端節點", "terminal-node", 3),
      objective("core", "discoverStructure", "找到 Nexus Core", "nexus-core"),
      objective(
        "restore",
        "activateNexus",
        "完成 Nexus Core 啟動程序",
        "nexus-core",
      ),
    ],
    "NEXUS NETWORK RESTORED",
    ["post-game"],
  ],
];

export const MAIN_QUESTS: readonly QuestDefinition[] = rawLevels.map(
  ([title, description, objectives, reward, unlocks], index) => ({
    id: `main-${String(index + 1).padStart(2, "0")}`,
    level: index + 1,
    title,
    description,
    prerequisites:
      index === 0 ? [] : [`main-${String(index).padStart(2, "0")}`],
    objectives,
    rewards: [
      {
        label: reward,
        ...(unlocks[0] ? { unlock: unlocks[0] } : {}),
      },
    ],
    unlocks,
  }),
);

export function getCurrentQuest(state: NexusQuestState): QuestDefinition {
  return MAIN_QUESTS[
    Math.min(MAIN_QUEST_LEVELS, Math.max(1, state.currentQuestLevel)) - 1
  ]!;
}

export function createNexusQuestState(): NexusQuestState {
  return {
    version: NEXUS_QUEST_VERSION,
    currentQuestLevel: 1,
    completedQuestIds: [],
    objectiveProgress: {},
    claimedRewards: [],
    tutorialCompleted: false,
    tutorialSkipped: false,
    discoveredBiomes: [],
    discoveredStructures: [],
    repairedNodeIds: [],
    processedEventIds: [],
    postGame: false,
    beaconClaimed: false,
  };
}

export function normalizeNexusQuestState(
  state?: Partial<NexusQuestState>,
): NexusQuestState {
  const base = createNexusQuestState();
  return {
    ...base,
    ...state,
    version: NEXUS_QUEST_VERSION,
    currentQuestLevel: Math.min(50, Math.max(1, state?.currentQuestLevel ?? 1)),
    completedQuestIds: Array.from(new Set(state?.completedQuestIds ?? [])),
    objectiveProgress: state?.objectiveProgress ?? {},
    claimedRewards: Array.from(new Set(state?.claimedRewards ?? [])),
    discoveredBiomes: Array.from(new Set(state?.discoveredBiomes ?? [])),
    discoveredStructures: Array.from(
      new Set(state?.discoveredStructures ?? []),
    ),
    repairedNodeIds: Array.from(new Set(state?.repairedNodeIds ?? [])),
    processedEventIds: (state?.processedEventIds ?? []).slice(-128),
  };
}

export function applyGameplayEvent(
  input: NexusQuestState,
  event: GameplayEvent,
): { state: NexusQuestState; completedLevel?: number } {
  const state = reconcilePersistentQuestProgress(
    normalizeNexusQuestState(input),
  );
  if (state.processedEventIds.includes(event.id) || state.postGame)
    return { state };
  const quest = getCurrentQuest(state);
  const progress = { ...state.objectiveProgress };
  for (const entry of quest.objectives) {
    const matchesType = entry.type === event.type;
    const matchesKey = !entry.key || entry.key === event.key;
    if (!matchesType || !matchesKey) continue;
    const progressKey = `${quest.id}:${entry.id}`;
    progress[progressKey] = Math.min(
      entry.target,
      (progress[progressKey] ?? 0) + Math.max(0, event.amount ?? 1),
    );
  }
  const processedEventIds = [...state.processedEventIds, event.id].slice(-128);
  const complete = quest.objectives.every(
    (entry) => (progress[`${quest.id}:${entry.id}`] ?? 0) >= entry.target,
  );
  if (!complete)
    return {
      state: { ...state, objectiveProgress: progress, processedEventIds },
    };
  const completedQuestIds = Array.from(
    new Set([...state.completedQuestIds, quest.id]),
  );
  const claimedRewards = Array.from(
    new Set([...state.claimedRewards, quest.id]),
  );
  const isFinal = quest.level === MAIN_QUEST_LEVELS;
  return {
    completedLevel: quest.level,
    state: {
      ...state,
      currentQuestLevel: isFinal ? MAIN_QUEST_LEVELS : quest.level + 1,
      completedQuestIds,
      claimedRewards,
      objectiveProgress: progress,
      processedEventIds,
      postGame: isFinal,
      ...(isFinal ? { completedAt: new Date().toISOString() } : {}),
    },
  };
}

/**
 * Re-applies durable discoveries to the currently unlocked quest. Players may
 * explore in any order, so a river found before Riverbound unlocks must still
 * count without replaying an old gameplay event.
 */
export function reconcilePersistentQuestProgress(
  input: NexusQuestState,
): NexusQuestState {
  const state = normalizeNexusQuestState(input);
  const quest = getCurrentQuest(state);
  const progress = { ...state.objectiveProgress };
  for (const entry of quest.objectives) {
    let durableProgress: number | undefined;
    if (entry.type === "discoverBiome") {
      durableProgress = entry.key
        ? Number(state.discoveredBiomes.includes(entry.key))
        : state.discoveredBiomes.length;
    } else if (entry.type === "discoverStructure") {
      durableProgress = entry.key
        ? Number(
            state.discoveredStructures.some(
              (id) => id === entry.key || id.startsWith(`${entry.key}-`),
            ),
          )
        : state.discoveredStructures.length;
    } else if (entry.type === "repairNode") {
      durableProgress = entry.key
        ? Number(state.repairedNodeIds.includes(entry.key))
        : state.repairedNodeIds.length;
    } else if (entry.type === "activateNexus" && !entry.key) {
      durableProgress = Number(state.beaconClaimed);
    }
    if (durableProgress === undefined) continue;
    const key = `${quest.id}:${entry.id}`;
    progress[key] = Math.min(
      entry.target,
      Math.max(progress[key] ?? 0, durableProgress),
    );
  }
  return { ...state, objectiveProgress: progress };
}

export function objectiveProgress(
  state: NexusQuestState,
  objective: QuestObjectiveDefinition,
): number {
  return (
    state.objectiveProgress[`${getCurrentQuest(state).id}:${objective.id}`] ?? 0
  );
}

export function getNexusNodes(seed: string): readonly NexusNode[] {
  const points: ReadonlyArray<
    readonly [NexusNode["id"], string, number, number]
  > = [
    ["amber", "琥珀節點", 96, 18],
    ["azure", "蒼藍節點", -144, 117],
    ["violet", "暮紫節點", 72, -188],
  ];
  return points.map(([id, name, x, z]) => ({
    id,
    name,
    position: [x + 0.5, terrainHeight(seed, x, z) + 1.001, z + 0.5],
  }));
}

export function countInventoryItem(
  inventory: Inventory,
  blockId: BlockIdValue,
): number {
  return inventory.reduce(
    (total, stack) => total + (stack?.blockId === blockId ? stack.count : 0),
    0,
  );
}

export function consumeInventoryItem(
  inventory: Inventory,
  blockId: BlockIdValue,
  count: number,
): Inventory | null {
  if (countInventoryItem(inventory, blockId) < count) return null;
  let remaining = count;
  return inventory.map((stack) => {
    if (!stack || stack.blockId !== blockId || remaining === 0)
      return stack ? { ...stack } : null;
    const used = Math.min(stack.count, remaining);
    remaining -= used;
    return stack.count === used
      ? null
      : { ...stack, count: stack.count - used };
  });
}

export function repairNexusNode(
  state: NexusQuestState,
  inventory: Inventory,
  nodeId: string,
  now = new Date().toISOString(),
): { state: NexusQuestState; inventory: Inventory } | null {
  if (state.repairedNodeIds.includes(nodeId)) return null;
  const nextInventory = consumeInventoryItem(
    inventory,
    BlockId.GlowCrystal,
    NEXUS_NODE_CRYSTAL_COST,
  );
  if (!nextInventory) return null;
  return {
    inventory: nextInventory,
    state: {
      ...state,
      repairedNodeIds: [...state.repairedNodeIds, nodeId],
      beaconClaimed: true,
      ...(state.repairedNodeIds.length >= 2 ? { completedAt: now } : {}),
    },
  };
}
