import { BlockId, type BlockIdValue } from "./blocks";
import {
  addToInventoryWithRemainder,
  transferInventoryStack,
  type Inventory,
} from "./gameplay";

function takeInventoryItem(
  inventory: Inventory,
  itemId: BlockIdValue,
  count: number,
): Inventory | null {
  const total = inventory.reduce(
    (sum, stack) => sum + (stack?.blockId === itemId ? stack.count : 0),
    0,
  );
  if (total < count) return null;
  let remaining = count;
  return inventory.map((stack) => {
    if (!stack || stack.blockId !== itemId || remaining === 0)
      return stack ? { ...stack } : null;
    const used = Math.min(stack.count, remaining);
    remaining -= used;
    return used === stack.count
      ? null
      : { ...stack, count: stack.count - used };
  });
}

export interface DroppedItemEntity {
  id: string;
  kind: "dropped-item";
  itemId: BlockIdValue;
  count: number;
  position: readonly [number, number, number];
  createdAt: string;
}

export interface CreatureEntity {
  id: string;
  kind: "creature";
  species: string;
  position: readonly [number, number, number];
  health: number;
  maxHealth?: number;
  persistent?: boolean;
  home?: readonly [number, number, number];
  state?: "idle" | "wander" | "flee" | "sleep";
  woolly?: boolean;
  woolRegrowsAt?: string;
  lastProductAt?: string;
}

export interface CropEntity {
  id: string;
  kind: "crop";
  cropId: "sungrain" | "sunroot";
  position: readonly [number, number, number];
  plantedAt: string;
  growthSeconds: number;
}

export interface DoorEntity {
  id: string;
  kind: "door";
  position: readonly [number, number, number];
  open: boolean;
}

export interface ContainerEntity {
  id: string;
  kind: "container";
  position: readonly [number, number, number];
  inventory: Inventory;
  revision: number;
}

export interface ProcessorEntity {
  id: string;
  kind: "processor";
  position: readonly [number, number, number];
  input: Inventory;
  fuel: Inventory;
  output: Inventory;
  recipeId?: string;
  startedAt?: string;
  durationSeconds?: number;
  revision: number;
}

export interface NpcEntity {
  id: string;
  kind: "npc";
  name: string;
  profession: "farmer" | "crafter" | "trader" | "explorer" | "researcher";
  position: readonly [number, number, number];
  home: readonly [number, number, number];
  work: readonly [number, number, number];
  scheduleState: "home" | "walking" | "working" | "resting";
  tradeCount: number;
  interactionFlags: string[];
  questStep: number;
}

export type WorldEntity =
  | DroppedItemEntity
  | CreatureEntity
  | CropEntity
  | DoorEntity
  | ContainerEntity
  | ProcessorEntity
  | NpcEntity;

export function cropGrowthStage(
  crop: CropEntity,
  now = Date.now(),
): 0 | 1 | 2 | 3 {
  const age = Math.max(0, now - Date.parse(crop.plantedAt)) / 1000;
  return Math.min(3, Math.floor((age / crop.growthSeconds) * 4)) as
    | 0
    | 1
    | 2
    | 3;
}

export function isCropMature(crop: CropEntity, now = Date.now()): boolean {
  return cropGrowthStage(crop, now) === 3;
}

export interface ProcessingRecipe {
  id: string;
  name: string;
  input: { itemId: BlockIdValue; count: number };
  fuel: { itemId: BlockIdValue; count: number };
  output: { itemId: BlockIdValue; count: number };
  durationSeconds: number;
}

export const PROCESSING_RECIPES: readonly ProcessingRecipe[] = [
  {
    id: "cook-sunroot",
    name: "烘烤日根",
    input: { itemId: BlockId.RawSunroot, count: 1 },
    fuel: { itemId: BlockId.FuelCell, count: 1 },
    output: { itemId: BlockId.CookedSunroot, count: 1 },
    durationSeconds: 12,
  },
  {
    id: "refine-alloy",
    name: "精煉穩相合金",
    input: { itemId: BlockId.CopperBloom, count: 2 },
    fuel: { itemId: BlockId.FuelCell, count: 1 },
    output: { itemId: BlockId.RefinedAlloy, count: 1 },
    durationSeconds: 18,
  },
  {
    id: "stabilize-crystal",
    name: "穩定 Nexus 晶體",
    input: { itemId: BlockId.DuskShard, count: 1 },
    fuel: { itemId: BlockId.FuelCell, count: 1 },
    output: { itemId: BlockId.SpectrumCrystal, count: 1 },
    durationSeconds: 24,
  },
  {
    id: "forge-deep-alloy",
    name: "鍛造深層合金",
    input: { itemId: BlockId.RefinedAlloy, count: 2 },
    fuel: { itemId: BlockId.FuelCell, count: 2 },
    output: { itemId: BlockId.DeepAlloy, count: 1 },
    durationSeconds: 30,
  },
] as const;

export function finishProcessor(
  processor: ProcessorEntity,
  now = Date.now(),
): ProcessorEntity {
  if (!processor.recipeId || !processor.startedAt) return processor;
  const recipe = PROCESSING_RECIPES.find(
    (entry) => entry.id === processor.recipeId,
  );
  if (!recipe) {
    const {
      recipeId: _,
      startedAt: __,
      durationSeconds: ___,
      ...rest
    } = processor;
    return rest;
  }
  const elapsed = (now - Date.parse(processor.startedAt)) / 1000;
  if (elapsed < (processor.durationSeconds ?? recipe.durationSeconds))
    return processor;
  const added = addToInventoryWithRemainder(
    processor.output,
    recipe.output.itemId,
    recipe.output.count,
  );
  if (added.remaining > 0) return processor;
  const {
    recipeId: _,
    startedAt: __,
    durationSeconds: ___,
    ...rest
  } = processor;
  return {
    ...rest,
    output: added.inventory,
    revision: processor.revision + 1,
  };
}

export function startProcessor(
  processor: ProcessorEntity,
  playerInventory: Inventory,
  recipeId: string,
  startedAt = new Date().toISOString(),
): { processor: ProcessorEntity; inventory: Inventory } | null {
  if (processor.recipeId) return null;
  const recipe = PROCESSING_RECIPES.find((entry) => entry.id === recipeId);
  if (!recipe) return null;
  const afterInput = takeInventoryItem(
    playerInventory,
    recipe.input.itemId,
    recipe.input.count,
  );
  if (!afterInput) return null;
  const afterFuel = takeInventoryItem(
    afterInput,
    recipe.fuel.itemId,
    recipe.fuel.count,
  );
  if (!afterFuel) return null;
  return {
    inventory: afterFuel,
    processor: {
      ...processor,
      input: [{ blockId: recipe.input.itemId, count: recipe.input.count }],
      fuel: [{ blockId: recipe.fuel.itemId, count: recipe.fuel.count }],
      recipeId,
      startedAt,
      durationSeconds: recipe.durationSeconds,
      revision: processor.revision + 1,
    },
  };
}

export function collectProcessorOutput(
  processor: ProcessorEntity,
  playerInventory: Inventory,
): { processor: ProcessorEntity; inventory: Inventory; moved: number } {
  const ready = finishProcessor(processor);
  const result = transferInventoryStack(ready.output, playerInventory, 0);
  return {
    processor: {
      ...ready,
      input: result.moved > 0 ? [] : ready.input,
      fuel: result.moved > 0 ? [] : ready.fuel,
      output: result.source,
      revision: ready.revision + Number(result.moved > 0),
    },
    inventory: result.destination,
    moved: result.moved,
  };
}

export function pickupDroppedItem(
  inventory: Inventory,
  entity: DroppedItemEntity,
): {
  inventory: Inventory;
  pickedUp: number;
  remaining: DroppedItemEntity | null;
} {
  const result = addToInventoryWithRemainder(
    inventory,
    entity.itemId,
    entity.count,
  );
  return {
    inventory: result.inventory,
    pickedUp: entity.count - result.remaining,
    remaining:
      result.remaining > 0 ? { ...entity, count: result.remaining } : null,
  };
}

const finitePosition = (value: unknown): value is [number, number, number] =>
  Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);

export function isPersistableWorldEntity(value: unknown): value is WorldEntity {
  if (!value || typeof value !== "object") return false;
  const entity = value as Record<string, unknown>;
  if (typeof entity.id !== "string" || !finitePosition(entity.position))
    return false;
  if (entity.kind === "dropped-item")
    return (
      Number.isInteger(entity.itemId) &&
      Number.isInteger(entity.count) &&
      Number(entity.count) >= 1 &&
      Number(entity.count) <= 64 &&
      typeof entity.createdAt === "string"
    );
  if (entity.kind === "crop")
    return (
      (entity.cropId === "sungrain" || entity.cropId === "sunroot") &&
      typeof entity.plantedAt === "string" &&
      typeof entity.growthSeconds === "number" &&
      entity.growthSeconds >= 30
    );
  if (entity.kind === "door") return typeof entity.open === "boolean";
  if (entity.kind === "container")
    return Array.isArray(entity.inventory) && entity.inventory.length <= 36;
  if (entity.kind === "processor")
    return (
      Array.isArray(entity.input) &&
      Array.isArray(entity.fuel) &&
      Array.isArray(entity.output) &&
      entity.input.length <= 9 &&
      entity.fuel.length <= 9 &&
      entity.output.length <= 9
    );
  if (entity.kind === "creature")
    return typeof entity.species === "string" && Number(entity.health) >= 0;
  if (entity.kind === "npc")
    return (
      typeof entity.name === "string" &&
      typeof entity.profession === "string" &&
      finitePosition(entity.home) &&
      finitePosition(entity.work) &&
      Array.isArray(entity.interactionFlags)
    );
  return false;
}
