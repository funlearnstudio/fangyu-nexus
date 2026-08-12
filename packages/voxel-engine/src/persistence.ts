import type { BlockIdValue } from "./blocks";
import type { ChunkModification } from "./world";
import type { Inventory } from "./gameplay";
import type { NexusQuestState } from "./quests";
import type { WorldEntity } from "./entities";

export type GameMode = "creative" | "survival";

export interface GameWorldMetadata {
  id: string;
  ownerId?: string;
  name: string;
  seed: string;
  gameMode: GameMode;
  edition: "java" | "bedrock";
  gameVersion: string;
  generationVersion: number;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  lastPlayedAt: string;
  timeOfDay: number;
  spawn: readonly [number, number, number];
  worldSettings: { renderDistance: number; caves: "experimental" };
  revision: number;
}

export interface PersistedChunkDelta {
  worldId: string;
  chunkX: number;
  chunkZ: number;
  generationVersion: number;
  chunkVersion: number;
  modifiedBlocks: ChunkModification[];
  entities: WorldEntity[];
  updatedAt: string;
  revision: number;
}

export interface PlayerWorldState {
  worldId: string;
  position: readonly [number, number, number];
  rotation: readonly [number, number];
  health: number;
  hunger: number;
  inventory: Inventory;
  selectedSlot: number;
  gameMode: GameMode;
  spawnPoint: readonly [number, number, number];
  /** Optional for safe migration of worlds created before the quest update. */
  quest?: NexusQuestState;
  lastPlayedAt: string;
  revision: number;
}

export function compactModification(
  index: number,
  blockId: BlockIdValue,
): ChunkModification {
  return [index, blockId];
}
