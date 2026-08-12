import { BlockId, type BlockIdValue, getBlockDefinition } from "./blocks";
import type { VoxelCoordinate, WorldBlockLookup } from "./world";

export interface RaycastHit {
  block: VoxelCoordinate;
  previous: VoxelCoordinate;
  blockId: BlockIdValue;
  distance: number;
}

/**
 * Water has no solid collision, so swimming needs enough upward momentum to
 * clear a one-block shoreline. The minimum impulse also prevents drag from
 * pinning the player against a bank while Space is held.
 */
export function nextSwimmingVelocityY(
  currentVelocity: number,
  swimUp: boolean,
  dive: boolean,
  dt: number,
): number {
  const damped = currentVelocity * 0.88;
  if (swimUp) return Math.max(4.8, damped + 8 * dt);
  if (dive) return Math.min(-3.6, damped - 8 * dt);
  return damped - 3.2 * dt;
}

export function raycastVoxels(
  lookup: WorldBlockLookup,
  origin: readonly [number, number, number],
  direction: readonly [number, number, number],
  reach = 6,
): RaycastHit | null {
  const length = Math.hypot(direction[0], direction[1], direction[2]);
  if (length === 0) return null;
  const dir = [
    direction[0] / length,
    direction[1] / length,
    direction[2] / length,
  ] as const;
  let x = Math.floor(origin[0]),
    y = Math.floor(origin[1]),
    z = Math.floor(origin[2]);
  let previous = { x, y, z };
  const stepX = Math.sign(dir[0]),
    stepY = Math.sign(dir[1]),
    stepZ = Math.sign(dir[2]);
  const deltaX = dir[0] === 0 ? Infinity : Math.abs(1 / dir[0]);
  const deltaY = dir[1] === 0 ? Infinity : Math.abs(1 / dir[1]);
  const deltaZ = dir[2] === 0 ? Infinity : Math.abs(1 / dir[2]);
  let maxX =
    dir[0] === 0 ? Infinity : ((stepX > 0 ? x + 1 : x) - origin[0]) / dir[0];
  let maxY =
    dir[1] === 0 ? Infinity : ((stepY > 0 ? y + 1 : y) - origin[1]) / dir[1];
  let maxZ =
    dir[2] === 0 ? Infinity : ((stepZ > 0 ? z + 1 : z) - origin[2]) / dir[2];
  let distance = 0;
  while (distance <= reach) {
    const id = lookup(x, y, z);
    if (id !== BlockId.Air && id !== BlockId.Water)
      return { block: { x, y, z }, previous, blockId: id, distance };
    previous = { x, y, z };
    if (maxX < maxY && maxX < maxZ) {
      x += stepX;
      distance = maxX;
      maxX += deltaX;
    } else if (maxY < maxZ) {
      y += stepY;
      distance = maxY;
      maxY += deltaY;
    } else {
      z += stepZ;
      distance = maxZ;
      maxZ += deltaZ;
    }
  }
  return null;
}

export interface Aabb {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

export function playerAabb(
  position: readonly [number, number, number],
  crouching = false,
): Aabb {
  const half = 0.3,
    height = crouching ? 1.5 : 1.8;
  return {
    minX: position[0] - half,
    minY: position[1],
    minZ: position[2] - half,
    maxX: position[0] + half,
    maxY: position[1] + height,
    maxZ: position[2] + half,
  };
}

export function aabbIntersectsBlock(
  box: Aabb,
  x: number,
  y: number,
  z: number,
): boolean {
  return (
    box.maxX > x &&
    box.minX < x + 1 &&
    box.maxY > y &&
    box.minY < y + 1 &&
    box.maxZ > z &&
    box.minZ < z + 1
  );
}

export function collidesWithWorld(
  box: Aabb,
  lookup: WorldBlockLookup,
): boolean {
  for (let y = Math.floor(box.minY); y <= Math.floor(box.maxY - 0.0001); y += 1)
    for (
      let z = Math.floor(box.minZ);
      z <= Math.floor(box.maxZ - 0.0001);
      z += 1
    )
      for (
        let x = Math.floor(box.minX);
        x <= Math.floor(box.maxX - 0.0001);
        x += 1
      )
        if (getBlockDefinition(lookup(x, y, z)).solid) return true;
  return false;
}

export function canPlaceBlock(
  position: VoxelCoordinate,
  playerBox: Aabb,
  lookup: WorldBlockLookup,
): boolean {
  return (
    lookup(position.x, position.y, position.z) === BlockId.Air &&
    !aabbIntersectsBlock(playerBox, position.x, position.y, position.z)
  );
}

/** A lightweight, deterministic shelter rule used by the quest engine. */
export function isShelterComplete(
  playerPosition: readonly [number, number, number],
  lookup: WorldBlockLookup,
): boolean {
  const centerX = Math.floor(playerPosition[0]);
  const feetY = Math.floor(playerPosition[1]);
  const centerZ = Math.floor(playerPosition[2]);
  let roof = 0;
  for (let z = centerZ - 1; z <= centerZ + 1; z += 1)
    for (let x = centerX - 1; x <= centerX + 1; x += 1)
      if (getBlockDefinition(lookup(x, feetY + 3, z)).solid) roof += 1;
  const directions = [
    [2, 0],
    [-2, 0],
    [0, 2],
    [0, -2],
  ] as const;
  let walls = 0;
  for (const [dx, dz] of directions)
    if (getBlockDefinition(lookup(centerX + dx, feetY + 1, centerZ + dz)).solid)
      walls += 1;
  return roof >= 5 && walls >= 3;
}

export interface InventoryStack {
  blockId: BlockIdValue;
  count: number;
  durability?: number;
  maxDurability?: number;
}
export type Inventory = Array<InventoryStack | null>;

export function addToInventory(
  inventory: Inventory,
  blockId: BlockIdValue,
  count: number,
  maxStack = 64,
): Inventory {
  const next = inventory.map((stack) => (stack ? { ...stack } : null));
  let remaining = count;
  for (const stack of next)
    if (
      stack?.blockId === blockId &&
      stack.durability === undefined &&
      stack.count < maxStack
    ) {
      const added = Math.min(maxStack - stack.count, remaining);
      stack.count += added;
      remaining -= added;
      if (remaining === 0) return next;
    }
  for (let index = 0; index < next.length && remaining > 0; index += 1)
    if (!next[index]) {
      const added = Math.min(maxStack, remaining);
      next[index] = { blockId, count: added };
      remaining -= added;
    }
  return next;
}

/** Adds as much as fits. The remainder is deliberately returned so no loot is lost. */
export function addToInventoryWithRemainder(
  inventory: Inventory,
  blockId: BlockIdValue,
  count: number,
  maxStack = 64,
): { inventory: Inventory; remaining: number } {
  const next = inventory.map((stack) => (stack ? { ...stack } : null));
  let remaining = count;
  for (const stack of next)
    if (
      stack?.blockId === blockId &&
      stack.durability === undefined &&
      stack.count < maxStack
    ) {
      const added = Math.min(maxStack - stack.count, remaining);
      stack.count += added;
      remaining -= added;
      if (remaining === 0) return { inventory: next, remaining };
    }
  for (let index = 0; index < next.length && remaining > 0; index += 1)
    if (!next[index]) {
      const added = Math.min(maxStack, remaining);
      next[index] = { blockId, count: added };
      remaining -= added;
    }
  return { inventory: next, remaining };
}

export function removeFromInventory(
  inventory: Inventory,
  slot: number,
  count = 1,
): Inventory | null {
  const stack = inventory[slot];
  if (!stack || stack.count < count) return null;
  const next = inventory.map((item) => (item ? { ...item } : null));
  const target = next[slot]!;
  target.count -= count;
  if (target.count === 0) next[slot] = null;
  return next;
}

export function moveInventoryStack(
  inventory: Inventory,
  from: number,
  to: number,
  maxStack = 64,
): Inventory {
  if (
    from === to ||
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < 0 ||
    from >= inventory.length ||
    to >= inventory.length ||
    !inventory[from]
  )
    return inventory.map((stack) => (stack ? { ...stack } : null));
  const next = inventory.map((stack) => (stack ? { ...stack } : null));
  const source = next[from]!;
  const target = next[to];
  if (!target) {
    next[to] = source;
    next[from] = null;
    return next;
  }
  if (
    target.blockId === source.blockId &&
    target.durability === source.durability &&
    target.count < maxStack
  ) {
    const moved = Math.min(maxStack - target.count, source.count);
    target.count += moved;
    source.count -= moved;
    if (source.count === 0) next[from] = null;
    return next;
  }
  next[from] = target;
  next[to] = source;
  return next;
}

export function transferInventoryStack(
  source: Inventory,
  destination: Inventory,
  sourceSlot: number,
): { source: Inventory; destination: Inventory; moved: number } {
  const stack = source[sourceSlot];
  if (!stack) return { source, destination, moved: 0 };
  const added = addToInventoryWithRemainder(
    destination,
    stack.blockId,
    stack.count,
  );
  const moved = stack.count - added.remaining;
  if (moved === 0) return { source, destination, moved: 0 };
  return {
    source: removeFromInventory(source, sourceSlot, moved) ?? source,
    destination: added.inventory,
    moved,
  };
}

export interface GameRecipe {
  id: string;
  name: string;
  inputs: readonly InventoryStack[];
  output: InventoryStack;
}

export type ToolCategory = "excavator" | "shears";
export function toolCategory(
  stack: InventoryStack | null,
): ToolCategory | null {
  if (stack?.blockId === BlockId.TrailTool) return "excavator";
  if (stack?.blockId === BlockId.FiberShears) return "shears";
  return null;
}

export function canCultivateSurface(
  blockId: BlockIdValue,
  stack: InventoryStack | null,
): boolean {
  return (
    toolCategory(stack) === "excavator" &&
    (blockId === BlockId.Verdant || blockId === BlockId.Loam)
  );
}

export function canPlantCropOn(blockId: BlockIdValue): boolean {
  return blockId === BlockId.CultivatedLoam;
}

export function miningSeconds(
  blockId: BlockIdValue,
  stack: InventoryStack | null,
): number {
  const block = getBlockDefinition(blockId);
  const category = toolCategory(stack);
  const multiplier = category === "excavator" && block.hardness >= 1 ? 0.38 : 1;
  return Math.max(0.12, block.hardness * multiplier);
}

export function damageTool(
  inventory: Inventory,
  slot: number,
  amount = 1,
): Inventory {
  const next = inventory.map((stack) => (stack ? { ...stack } : null));
  const stack = next[slot];
  if (!stack || stack.maxDurability === undefined) return next;
  stack.durability = (stack.durability ?? stack.maxDurability) - amount;
  if (stack.durability <= 0) next[slot] = null;
  return next;
}
export const GAME_RECIPES: readonly GameRecipe[] = [
  {
    id: "trail-tool",
    name: "拓荒鑿",
    inputs: [
      { blockId: BlockId.Timber, count: 2 },
      { blockId: BlockId.Slate, count: 3 },
    ],
    output: { blockId: BlockId.TrailTool, count: 1 },
  },
  {
    id: "timber-to-loam",
    name: "培養土",
    inputs: [{ blockId: BlockId.Timber, count: 1 }],
    output: { blockId: BlockId.Loam, count: 4 },
  },
  {
    id: "crystal-lamp",
    name: "晶光塊",
    inputs: [
      { blockId: BlockId.GlowCrystal, count: 2 },
      { blockId: BlockId.Slate, count: 2 },
    ],
    output: { blockId: BlockId.GlowCrystal, count: 1 },
  },
  {
    id: "field-flask",
    name: "空野行瓶",
    inputs: [
      { blockId: BlockId.CopperBloom, count: 1 },
      { blockId: BlockId.Dune, count: 2 },
    ],
    output: { blockId: BlockId.EmptyFlask, count: 1 },
  },
  {
    id: "fiber-shears",
    name: "纖維剪",
    inputs: [
      { blockId: BlockId.CopperBloom, count: 2 },
      { blockId: BlockId.Timber, count: 1 },
    ],
    output: { blockId: BlockId.FiberShears, count: 1 },
  },
  {
    id: "trail-ration",
    name: "遠行糧",
    inputs: [
      { blockId: BlockId.Sungrain, count: 2 },
      { blockId: BlockId.MeadowMilk, count: 1 },
    ],
    output: { blockId: BlockId.TrailRation, count: 2 },
  },
  {
    id: "field-door",
    name: "風木門",
    inputs: [{ blockId: BlockId.Timber, count: 4 }],
    output: { blockId: BlockId.FieldDoor, count: 1 },
  },
  {
    id: "storage-chest",
    name: "方域儲存箱",
    inputs: [{ blockId: BlockId.Timber, count: 6 }],
    output: { blockId: BlockId.StorageChest, count: 1 },
  },
  {
    id: "craft-station",
    name: "組構台",
    inputs: [
      { blockId: BlockId.Timber, count: 4 },
      { blockId: BlockId.Slate, count: 2 },
    ],
    output: { blockId: BlockId.CraftStation, count: 1 },
  },
  {
    id: "processor-station",
    name: "脈熱加工站",
    inputs: [
      { blockId: BlockId.Slate, count: 6 },
      { blockId: BlockId.CopperBloom, count: 2 },
    ],
    output: { blockId: BlockId.ProcessorStation, count: 1 },
  },
  {
    id: "nexus-workbench",
    name: "Nexus 工程台",
    inputs: [
      { blockId: BlockId.Timber, count: 4 },
      { blockId: BlockId.GlowCrystal, count: 2 },
    ],
    output: { blockId: BlockId.NexusWorkbench, count: 1 },
  },
  {
    id: "farm-station",
    name: "育種台",
    inputs: [
      { blockId: BlockId.Timber, count: 3 },
      { blockId: BlockId.Loam, count: 4 },
      { blockId: BlockId.FieldSeed, count: 1 },
    ],
    output: { blockId: BlockId.FarmStation, count: 1 },
  },
  {
    id: "fuel-cell",
    name: "脈熱燃芯",
    inputs: [
      { blockId: BlockId.Timber, count: 1 },
      { blockId: BlockId.Canopy, count: 1 },
    ],
    output: { blockId: BlockId.FuelCell, count: 2 },
  },
  {
    id: "trail-path",
    name: "星砂路磚",
    inputs: [
      { blockId: BlockId.Dune, count: 2 },
      { blockId: BlockId.Slate, count: 1 },
    ],
    output: { blockId: BlockId.TrailPath, count: 4 },
  },
  {
    id: "nexus-light",
    name: "Nexus 光標",
    inputs: [
      { blockId: BlockId.GlowCrystal, count: 1 },
      { blockId: BlockId.Timber, count: 1 },
    ],
    output: { blockId: BlockId.NexusLight, count: 2 },
  },
  {
    id: "node-calibrator",
    name: "節點校準器",
    inputs: [
      { blockId: BlockId.CopperBloom, count: 2 },
      { blockId: BlockId.GlowCrystal, count: 1 },
    ],
    output: { blockId: BlockId.NodeCalibrator, count: 1 },
  },
  {
    id: "nexus-conduit",
    name: "Nexus 導管",
    inputs: [
      { blockId: BlockId.RefinedAlloy, count: 1 },
      { blockId: BlockId.GlowCrystal, count: 1 },
    ],
    output: { blockId: BlockId.NexusConduit, count: 3 },
  },
  {
    id: "engineer-core",
    name: "工程核心",
    inputs: [
      { blockId: BlockId.RefinedAlloy, count: 2 },
      { blockId: BlockId.SettlerComponent, count: 1 },
      { blockId: BlockId.GlowCrystal, count: 2 },
    ],
    output: { blockId: BlockId.FrequencyCore, count: 1 },
  },
  {
    id: "frequency-core",
    name: "多域頻率核心",
    inputs: [
      { blockId: BlockId.Tideglass, count: 1 },
      { blockId: BlockId.DuskShard, count: 1 },
      { blockId: BlockId.SunShard, count: 1 },
      { blockId: BlockId.RefinedAlloy, count: 1 },
    ],
    output: { blockId: BlockId.FrequencyCore, count: 1 },
  },
  {
    id: "waygate-fuel",
    name: "躍遷燃料",
    inputs: [
      { blockId: BlockId.ResonantPlant, count: 2 },
      { blockId: BlockId.GlowCrystal, count: 1 },
    ],
    output: { blockId: BlockId.WaygateFuel, count: 2 },
  },
  {
    id: "expedition-food",
    name: "遠征補給箱",
    inputs: [
      { blockId: BlockId.TrailRation, count: 2 },
      { blockId: BlockId.CookedSunroot, count: 2 },
      { blockId: BlockId.SunEgg, count: 1 },
    ],
    output: { blockId: BlockId.ExpeditionFood, count: 4 },
  },
  {
    id: "expedition-gear",
    name: "遠征裝備",
    inputs: [
      { blockId: BlockId.DeepAlloy, count: 1 },
      { blockId: BlockId.CloudWool, count: 2 },
      { blockId: BlockId.Tideglass, count: 1 },
    ],
    output: { blockId: BlockId.ExpeditionGear, count: 1 },
  },
  {
    id: "machine-kit",
    name: "機械修復組",
    inputs: [
      { blockId: BlockId.RefinedAlloy, count: 1 },
      { blockId: BlockId.NodeCalibrator, count: 1 },
      { blockId: BlockId.OldComponent, count: 1 },
    ],
    output: { blockId: BlockId.MachineKit, count: 1 },
  },
  {
    id: "spectrum-crystal",
    name: "四域光譜晶簇",
    inputs: [
      { blockId: BlockId.SunShard, count: 1 },
      { blockId: BlockId.DuskShard, count: 1 },
      { blockId: BlockId.Tideglass, count: 1 },
      { blockId: BlockId.GlowCrystal, count: 1 },
    ],
    output: { blockId: BlockId.SpectrumCrystal, count: 4 },
  },
  {
    id: "endgame-component",
    name: "終局元件",
    inputs: [
      { blockId: BlockId.CoreFragment, count: 1 },
      { blockId: BlockId.SpectrumCrystal, count: 1 },
      { blockId: BlockId.DeepAlloy, count: 1 },
    ],
    output: { blockId: BlockId.EndgameComponent, count: 1 },
  },
  {
    id: "core-fuel",
    name: "核心燃料",
    inputs: [
      { blockId: BlockId.WaygateFuel, count: 1 },
      { blockId: BlockId.SunShard, count: 1 },
      { blockId: BlockId.DuskShard, count: 1 },
    ],
    output: { blockId: BlockId.CoreFuel, count: 2 },
  },
  {
    id: "nexus-device",
    name: "Nexus 終端裝置",
    inputs: [
      { blockId: BlockId.EndgameComponent, count: 3 },
      { blockId: BlockId.FrequencyCore, count: 1 },
      { blockId: BlockId.AllianceSeal, count: 1 },
      { blockId: BlockId.CoreFuel, count: 6 },
    ],
    output: { blockId: BlockId.NexusDevice, count: 1 },
  },
];

export function craftInventory(
  inventory: Inventory,
  recipe: GameRecipe,
): Inventory | null {
  const totals = new Map<number, number>();
  for (const stack of inventory)
    if (stack)
      totals.set(stack.blockId, (totals.get(stack.blockId) ?? 0) + stack.count);
  if (
    recipe.inputs.some(
      (input) => (totals.get(input.blockId) ?? 0) < input.count,
    )
  )
    return null;
  let next = inventory.map((stack) => (stack ? { ...stack } : null));
  for (const input of recipe.inputs) {
    let needed = input.count;
    for (let slot = 0; slot < next.length && needed > 0; slot += 1) {
      const stack = next[slot];
      if (stack?.blockId !== input.blockId) continue;
      const used = Math.min(stack.count, needed);
      stack.count -= used;
      needed -= used;
      if (stack.count === 0) next[slot] = null;
    }
  }
  next = addToInventory(next, recipe.output.blockId, recipe.output.count);
  if (recipe.output.blockId === BlockId.TrailTool) {
    const slot = next.findIndex(
      (stack) => stack?.blockId === BlockId.TrailTool && !stack.maxDurability,
    );
    if (slot >= 0)
      next[slot] = { ...next[slot]!, durability: 96, maxDurability: 96 };
  }
  if (recipe.output.blockId === BlockId.FiberShears) {
    const slot = next.findIndex(
      (stack) => stack?.blockId === BlockId.FiberShears && !stack.maxDurability,
    );
    if (slot >= 0)
      next[slot] = { ...next[slot]!, durability: 64, maxDurability: 64 };
  }
  return next;
}
