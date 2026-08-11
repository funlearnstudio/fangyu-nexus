export const EDITIONS = ["java", "bedrock"] as const;
export type Edition = (typeof EDITIONS)[number];

export const RELEASE_CHANNELS = [
  "release",
  "snapshot",
  "preview",
  "historical",
] as const;
export type ReleaseChannel = (typeof RELEASE_CHANNELS)[number];

export interface Provenance {
  id: string;
  label: string;
  sourceKey: string;
  sourceUrl: string;
  fetchedAt: string;
  checksum: string;
  isDemo: boolean;
  note: string;
}

export interface VersionScope {
  edition: Edition;
  gameVersionId: string;
  validFrom: string;
  validTo?: string;
}

export interface GameVersion {
  id: string;
  edition: Edition;
  name: string;
  channel: ReleaseChannel;
  dataVersion?: number;
  releasedAt: string;
  isSupported: boolean;
  isDemo: boolean;
}

export interface CatalogItem extends VersionScope {
  id: string;
  slug: string;
  namespaceId: string;
  name: string;
  englishName: string;
  description: string;
  kind: "block" | "item" | "tool" | "food";
  stackSize: number;
  durability?: number;
  tags: string[];
  source: Provenance;
}

export interface RecipeIngredient {
  itemId: string;
  count: number;
  slot?: number;
}

export interface Recipe extends VersionScope {
  id: string;
  type: "crafting_shaped" | "crafting_shapeless" | "smelting";
  outputItemId: string;
  outputCount: number;
  ingredients: RecipeIngredient[];
  pattern?: string[];
  ticks?: number;
  source: Provenance;
}

export interface MobEntry extends VersionScope {
  id: string;
  slug: string;
  name: string;
  category: "passive" | "neutral" | "hostile";
  summary: string;
  health: number;
  source: Provenance;
}

export interface BiomeEntry extends VersionScope {
  id: string;
  slug: string;
  name: string;
  climate: string;
  summary: string;
  source: Provenance;
}

export interface StructureEntry extends VersionScope {
  id: string;
  slug: string;
  name: string;
  summary: string;
  source: Provenance;
}

export interface ServerListing {
  id: string;
  slug: string;
  name: string;
  edition: Edition;
  host: string;
  port: number;
  region: string;
  status: "demo" | "queued" | "online" | "offline";
  source: Provenance;
}

export interface SearchEntry {
  id: string;
  type: "item" | "mob" | "biome" | "structure" | "server";
  slug: string;
  title: string;
  subtitle: string;
  href: string;
  edition: Edition;
  gameVersionId?: string;
  source: Provenance;
}

export const DEMO_SOURCE: Provenance = Object.freeze({
  id: "fixture-source-v1",
  label: "方域 Nexus Demo Fixture",
  sourceKey: "fixture:fangyu-nexus:v1",
  sourceUrl: "/about/demo-data",
  fetchedAt: "2026-08-12T00:00:00.000Z",
  checksum: "6a0c488dfc6396769e48961ebc6e07fb89393bca89cd2e899bf4bc40b728ba3d",
  isDemo: true,
  note: "此資料僅供開發與測試，不代表正式 Minecraft 數值。",
});

export const GAME_VERSIONS: GameVersion[] = [
  {
    id: "java-demo-1",
    edition: "java",
    name: "Java Demo Fixture 1",
    channel: "release",
    releasedAt: "2026-08-12",
    isSupported: true,
    isDemo: true,
  },
  {
    id: "bedrock-demo-1",
    edition: "bedrock",
    name: "Bedrock Demo Fixture 1",
    channel: "release",
    releasedAt: "2026-08-12",
    isSupported: true,
    isDemo: true,
  },
];

const javaScope = {
  edition: "java" as const,
  gameVersionId: "java-demo-1",
  validFrom: "java-demo-1",
};

const bedrockScope = {
  edition: "bedrock" as const,
  gameVersionId: "bedrock-demo-1",
  validFrom: "bedrock-demo-1",
};

export const CATALOG_ITEMS: CatalogItem[] = [
  {
    ...javaScope,
    id: "java-demo-oak-log",
    slug: "oak-log",
    namespaceId: "demo:oak_log",
    name: "示範橡木原木",
    englishName: "Demo Oak Log",
    description: "合成鏈的基礎材料。這是明確標示的測試資料。",
    kind: "block",
    stackSize: 64,
    tags: ["demo:logs", "demo:renewable"],
    source: DEMO_SOURCE,
  },
  {
    ...javaScope,
    id: "java-demo-oak-planks",
    slug: "oak-planks",
    namespaceId: "demo:oak_planks",
    name: "示範橡木材",
    englishName: "Demo Oak Planks",
    description: "可繼續加工成木棒、工作台與示範工具。",
    kind: "block",
    stackSize: 64,
    tags: ["demo:planks", "demo:building"],
    source: DEMO_SOURCE,
  },
  {
    ...javaScope,
    id: "java-demo-stick",
    slug: "stick",
    namespaceId: "demo:stick",
    name: "示範木棒",
    englishName: "Demo Stick",
    description: "示範配方中的中間材料。",
    kind: "item",
    stackSize: 64,
    tags: ["demo:rod"],
    source: DEMO_SOURCE,
  },
  {
    ...javaScope,
    id: "java-demo-crafting-table",
    slug: "crafting-table",
    namespaceId: "demo:crafting_table",
    name: "示範工作台",
    englishName: "Demo Crafting Table",
    description: "用於展示 2×2 shaped recipe 與批量計算。",
    kind: "block",
    stackSize: 64,
    tags: ["demo:stations"],
    source: DEMO_SOURCE,
  },
  {
    ...javaScope,
    id: "java-demo-wooden-pickaxe",
    slug: "wooden-pickaxe",
    namespaceId: "demo:wooden_pickaxe",
    name: "示範木鎬",
    englishName: "Demo Wooden Pickaxe",
    description: "用來驗證遞迴展開與庫存扣除的測試工具。",
    kind: "tool",
    stackSize: 1,
    durability: 20,
    tags: ["demo:tools"],
    source: DEMO_SOURCE,
  },
  {
    ...javaScope,
    id: "java-demo-iron-ore",
    slug: "iron-ore",
    namespaceId: "demo:iron_ore",
    name: "示範鐵礦",
    englishName: "Demo Iron Ore",
    description: "熔煉計算器的測試輸入。",
    kind: "block",
    stackSize: 64,
    tags: ["demo:ores"],
    source: DEMO_SOURCE,
  },
  {
    ...javaScope,
    id: "java-demo-iron-ingot",
    slug: "iron-ingot",
    namespaceId: "demo:iron_ingot",
    name: "示範鐵錠",
    englishName: "Demo Iron Ingot",
    description: "熔煉計算器的測試輸出。",
    kind: "item",
    stackSize: 64,
    tags: ["demo:ingots"],
    source: DEMO_SOURCE,
  },
  {
    ...bedrockScope,
    id: "bedrock-demo-oak-log",
    slug: "oak-log",
    namespaceId: "demo:oak_log",
    name: "基岩版示範橡木原木",
    englishName: "Bedrock Demo Oak Log",
    description: "獨立於 Java fixture 的 Bedrock 測試資料。",
    kind: "block",
    stackSize: 64,
    tags: ["demo:logs"],
    source: DEMO_SOURCE,
  },
  {
    ...bedrockScope,
    id: "bedrock-demo-oak-planks",
    slug: "oak-planks",
    namespaceId: "demo:oak_planks",
    name: "基岩版示範橡木材",
    englishName: "Bedrock Demo Oak Planks",
    description: "使用獨立 synthetic output count 驗證版別隔離。",
    kind: "block",
    stackSize: 64,
    tags: ["demo:planks"],
    source: DEMO_SOURCE,
  },
  {
    ...bedrockScope,
    id: "bedrock-demo-signal-lamp",
    slug: "signal-lamp",
    namespaceId: "demo:signal_lamp",
    name: "基岩版示範訊號燈",
    englishName: "Bedrock Demo Signal Lamp",
    description: "只存在於 Bedrock fixture 的合成輸出。",
    kind: "block",
    stackSize: 16,
    tags: ["demo:redstone"],
    source: DEMO_SOURCE,
  },
];

export const RECIPES: Recipe[] = [
  {
    ...javaScope,
    id: "java-demo-planks",
    type: "crafting_shapeless",
    outputItemId: "java-demo-oak-planks",
    outputCount: 4,
    ingredients: [{ itemId: "java-demo-oak-log", count: 1, slot: 0 }],
    source: DEMO_SOURCE,
  },
  {
    ...javaScope,
    id: "java-demo-sticks",
    type: "crafting_shaped",
    outputItemId: "java-demo-stick",
    outputCount: 4,
    ingredients: [
      { itemId: "java-demo-oak-planks", count: 1, slot: 1 },
      { itemId: "java-demo-oak-planks", count: 1, slot: 4 },
    ],
    pattern: [" P ", " P ", "   "],
    source: DEMO_SOURCE,
  },
  {
    ...javaScope,
    id: "java-demo-table",
    type: "crafting_shaped",
    outputItemId: "java-demo-crafting-table",
    outputCount: 1,
    ingredients: [
      { itemId: "java-demo-oak-planks", count: 1, slot: 0 },
      { itemId: "java-demo-oak-planks", count: 1, slot: 1 },
      { itemId: "java-demo-oak-planks", count: 1, slot: 3 },
      { itemId: "java-demo-oak-planks", count: 1, slot: 4 },
    ],
    pattern: ["PP ", "PP ", "   "],
    source: DEMO_SOURCE,
  },
  {
    ...javaScope,
    id: "java-demo-pickaxe",
    type: "crafting_shaped",
    outputItemId: "java-demo-wooden-pickaxe",
    outputCount: 1,
    ingredients: [
      { itemId: "java-demo-oak-planks", count: 1, slot: 0 },
      { itemId: "java-demo-oak-planks", count: 1, slot: 1 },
      { itemId: "java-demo-oak-planks", count: 1, slot: 2 },
      { itemId: "java-demo-stick", count: 1, slot: 4 },
      { itemId: "java-demo-stick", count: 1, slot: 7 },
    ],
    pattern: ["PPP", " S ", " S "],
    source: DEMO_SOURCE,
  },
  {
    ...javaScope,
    id: "java-demo-iron-smelting",
    type: "smelting",
    outputItemId: "java-demo-iron-ingot",
    outputCount: 1,
    ingredients: [{ itemId: "java-demo-iron-ore", count: 1 }],
    ticks: 200,
    source: DEMO_SOURCE,
  },
  {
    ...bedrockScope,
    id: "bedrock-demo-planks",
    type: "crafting_shapeless",
    outputItemId: "bedrock-demo-oak-planks",
    outputCount: 3,
    ingredients: [{ itemId: "bedrock-demo-oak-log", count: 1, slot: 0 }],
    source: DEMO_SOURCE,
  },
  {
    ...bedrockScope,
    id: "bedrock-demo-signal-lamp",
    type: "crafting_shaped",
    outputItemId: "bedrock-demo-signal-lamp",
    outputCount: 1,
    ingredients: [
      { itemId: "bedrock-demo-oak-planks", count: 1, slot: 1 },
      { itemId: "bedrock-demo-oak-planks", count: 1, slot: 3 },
      { itemId: "bedrock-demo-oak-planks", count: 1, slot: 4 },
      { itemId: "bedrock-demo-oak-planks", count: 1, slot: 5 },
      { itemId: "bedrock-demo-oak-planks", count: 1, slot: 7 },
    ],
    pattern: [" P ", "PPP", " P "],
    source: DEMO_SOURCE,
  },
];

export const MOBS: MobEntry[] = [
  {
    ...javaScope,
    id: "java-demo-grove-sprite",
    slug: "grove-sprite",
    name: "示範林地精靈",
    category: "neutral",
    summary: "Synthetic fixture mob；用來驗證圖鑑與 Edition filter。",
    health: 12,
    source: DEMO_SOURCE,
  },
  {
    ...bedrockScope,
    id: "bedrock-demo-cave-skipper",
    slug: "cave-skipper",
    name: "基岩版示範洞穴躍獸",
    category: "passive",
    summary: "Synthetic fixture mob；不是正式 Minecraft 生物。",
    health: 8,
    source: DEMO_SOURCE,
  },
];

export const BIOMES: BiomeEntry[] = [
  {
    ...javaScope,
    id: "java-demo-mossy-grove",
    slug: "mossy-grove",
    name: "示範苔蘚林",
    climate: "temperate",
    summary: "Synthetic fixture biome；正式 world generation 尚未接入。",
    source: DEMO_SOURCE,
  },
  {
    ...bedrockScope,
    id: "bedrock-demo-crystal-shore",
    slug: "crystal-shore",
    name: "基岩版示範水晶岸",
    climate: "coastal",
    summary: "Synthetic fixture biome；只用於版別隔離測試。",
    source: DEMO_SOURCE,
  },
];

export const STRUCTURES: StructureEntry[] = [
  {
    ...javaScope,
    id: "java-demo-workshop",
    slug: "workshop",
    name: "示範工坊遺跡",
    summary: "Synthetic fixture structure；尚未提供 seed 定位。",
    source: DEMO_SOURCE,
  },
];

export const SERVERS: ServerListing[] = [
  {
    id: "demo-server-java",
    slug: "demo-java",
    name: "Java Fixture Server",
    edition: "java",
    host: "example.invalid",
    port: 25565,
    region: "Demo",
    status: "demo",
    source: DEMO_SOURCE,
  },
];

export function getItemsForScope(
  edition: Edition,
  gameVersionId: string,
): CatalogItem[] {
  return CATALOG_ITEMS.filter(
    (item) => item.edition === edition && item.gameVersionId === gameVersionId,
  );
}

export function getRecipesForScope(
  edition: Edition,
  gameVersionId: string,
): Recipe[] {
  return RECIPES.filter(
    (recipe) =>
      recipe.edition === edition && recipe.gameVersionId === gameVersionId,
  );
}

export function buildSearchIndex(): SearchEntry[] {
  const items: SearchEntry[] = CATALOG_ITEMS.map((item) => ({
    id: item.id,
    type: "item",
    slug: item.slug,
    title: item.name,
    subtitle: item.namespaceId,
    href: "/items/" + item.slug,
    edition: item.edition,
    gameVersionId: item.gameVersionId,
    source: item.source,
  }));

  const mobs: SearchEntry[] = MOBS.map((mob) => ({
    id: mob.id,
    type: "mob",
    slug: mob.slug,
    title: mob.name,
    subtitle: mob.summary,
    href: "/mobs/" + mob.slug,
    edition: mob.edition,
    gameVersionId: mob.gameVersionId,
    source: mob.source,
  }));

  const biomes: SearchEntry[] = BIOMES.map((biome) => ({
    id: biome.id,
    type: "biome",
    slug: biome.slug,
    title: biome.name,
    subtitle: biome.climate,
    href: "/biomes?focus=" + biome.slug,
    edition: biome.edition,
    gameVersionId: biome.gameVersionId,
    source: biome.source,
  }));

  return [...items, ...mobs, ...biomes];
}
