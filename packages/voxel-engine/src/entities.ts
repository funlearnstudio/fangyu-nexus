import type { BlockIdValue } from "./blocks";
import { addToInventoryWithRemainder, type Inventory } from "./gameplay";

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
}

export type WorldEntity = DroppedItemEntity | CreatureEntity;

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
