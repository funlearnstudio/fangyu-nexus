import { BlockId, type BlockIdValue } from "./blocks";
import { terrainHeight } from "./world";
import type { Inventory } from "./gameplay";

/** Versioned, seed-deterministic story layer for the original Fangyu world. */
export const NEXUS_QUEST_VERSION = 1;
export const NEXUS_NODE_CRYSTAL_COST = 3;

export interface NexusNode {
  id: "amber" | "azure" | "violet";
  name: string;
  position: readonly [number, number, number];
}

export interface NexusQuestState {
  version: number;
  beaconClaimed: boolean;
  repairedNodeIds: string[];
  completedAt?: string;
}

export function createNexusQuestState(): NexusQuestState {
  return {
    version: NEXUS_QUEST_VERSION,
    beaconClaimed: true,
    repairedNodeIds: [],
  };
}

export function normalizeNexusQuestState(
  state?: Partial<NexusQuestState>,
): NexusQuestState {
  return {
    version: NEXUS_QUEST_VERSION,
    beaconClaimed: state?.beaconClaimed ?? true,
    repairedNodeIds: Array.from(new Set(state?.repairedNodeIds ?? [])).filter(
      (id) => ["amber", "azure", "violet"].includes(id),
    ),
    ...(state?.completedAt ? { completedAt: state.completedAt } : {}),
  };
}

export function getNexusNodes(seed: string): readonly NexusNode[] {
  const points: ReadonlyArray<
    readonly [NexusNode["id"], string, number, number]
  > = [
    ["amber", "琥珀節點", 34, 2],
    ["azure", "蒼藍節點", -28, 31],
    ["violet", "暮紫節點", 4, -39],
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
  const repairedNodeIds = [...state.repairedNodeIds, nodeId];
  return {
    inventory: nextInventory,
    state: {
      ...state,
      repairedNodeIds,
      ...(repairedNodeIds.length >= 3 ? { completedAt: now } : {}),
    },
  };
}
