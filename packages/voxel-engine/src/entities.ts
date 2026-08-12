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

export interface CropEntity {
  id: string;
  kind: "crop";
  cropId: "sungrain";
  position: readonly [number, number, number];
  plantedAt: string;
  growthSeconds: number;
}

export type WorldEntity = DroppedItemEntity | CreatureEntity | CropEntity;

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
