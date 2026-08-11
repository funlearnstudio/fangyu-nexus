import "server-only";
import { randomUUID } from "node:crypto";
import type { Filter } from "mongodb";
import {
  GENERATION_VERSION,
  type GameMode,
  type GameWorldMetadata,
  type PersistedChunkDelta,
  type PlayerWorldState,
} from "@fangyu/voxel-engine";
import { getGameDatabase } from "./mongodb";

export type StoredWorld = GameWorldMetadata & { ownerId: string };
export type StoredPlayerState = PlayerWorldState & { ownerId: string };

function worlds() {
  return getGameDatabase().then((db) =>
    db.collection<StoredWorld>("gameWorlds"),
  );
}
function chunks() {
  return getGameDatabase().then((db) =>
    db.collection<PersistedChunkDelta>("worldChunks"),
  );
}
function states() {
  return getGameDatabase().then((db) =>
    db.collection<StoredPlayerState>("playerWorldStates"),
  );
}

export async function listWorlds(ownerId: string): Promise<StoredWorld[]> {
  return (await worlds())
    .find({ ownerId })
    .sort({ lastPlayedAt: -1 })
    .limit(100)
    .toArray();
}

export async function createWorld(
  ownerId: string,
  input: {
    id?: string;
    name: string;
    seed: string;
    gameMode: GameMode;
    edition: "java" | "bedrock";
    gameVersion: string;
    renderDistance: number;
  },
): Promise<StoredWorld> {
  const now = new Date().toISOString();
  const world: StoredWorld = {
    id: input.id ?? randomUUID(),
    ownerId,
    name: input.name,
    seed: input.seed,
    gameMode: input.gameMode,
    edition: input.edition,
    gameVersion: input.gameVersion,
    generationVersion: GENERATION_VERSION,
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    lastPlayedAt: now,
    timeOfDay: 0.28,
    spawn: [0.5, 38, 0.5],
    worldSettings: {
      renderDistance: input.renderDistance,
      caves: "experimental",
    },
    revision: 1,
  };
  await (await worlds()).insertOne(world);
  return world;
}

export async function getOwnedWorld(
  ownerId: string,
  worldId: string,
): Promise<StoredWorld | null> {
  return (await worlds()).findOne({ id: worldId, ownerId });
}

export async function patchOwnedWorld(
  ownerId: string,
  worldId: string,
  patch: Partial<
    Pick<StoredWorld, "name" | "timeOfDay" | "lastPlayedAt" | "worldSettings">
  >,
  expectedRevision?: number,
): Promise<StoredWorld | null> {
  const filter: Filter<StoredWorld> = { id: worldId, ownerId };
  if (expectedRevision !== undefined) filter.revision = expectedRevision;
  return (await worlds()).findOneAndUpdate(
    filter,
    {
      $set: { ...patch, updatedAt: new Date().toISOString() },
      $inc: { revision: 1 },
    },
    { returnDocument: "after" },
  );
}

export async function deleteOwnedWorld(
  ownerId: string,
  worldId: string,
): Promise<boolean> {
  const result = await (await worlds()).deleteOne({ id: worldId, ownerId });
  if (!result.deletedCount) return false;
  await Promise.all([
    (await chunks()).deleteMany({ worldId }),
    (await states()).deleteMany({ worldId, ownerId }),
  ]);
  return true;
}

export async function listChunkDeltas(
  ownerId: string,
  worldId: string,
  coordinates: Array<{ x: number; z: number }>,
): Promise<PersistedChunkDelta[] | null> {
  if (!(await getOwnedWorld(ownerId, worldId))) return null;
  if (coordinates.length === 0) return [];
  return (await chunks())
    .find({
      worldId,
      $or: coordinates.map(({ x, z }) => ({ chunkX: x, chunkZ: z })),
    })
    .limit(256)
    .toArray();
}

export async function getChunkDelta(
  ownerId: string,
  worldId: string,
  x: number,
  z: number,
): Promise<PersistedChunkDelta | null | undefined> {
  if (!(await getOwnedWorld(ownerId, worldId))) return undefined;
  return (await chunks()).findOne({ worldId, chunkX: x, chunkZ: z });
}

export async function saveChunkDelta(
  ownerId: string,
  worldId: string,
  delta: Omit<PersistedChunkDelta, "worldId" | "updatedAt">,
  expectedRevision?: number,
): Promise<PersistedChunkDelta | "conflict" | null> {
  if (!(await getOwnedWorld(ownerId, worldId))) return null;
  const now = new Date().toISOString();
  const filter: Filter<PersistedChunkDelta> = {
    worldId,
    chunkX: delta.chunkX,
    chunkZ: delta.chunkZ,
  };
  if (expectedRevision !== undefined) filter.revision = expectedRevision;
  try {
    const result = await (
      await chunks()
    ).findOneAndUpdate(
      filter,
      {
        $set: {
          generationVersion: delta.generationVersion,
          chunkVersion: delta.chunkVersion,
          modifiedBlocks: delta.modifiedBlocks,
          entities: delta.entities,
          updatedAt: now,
        },
        $setOnInsert: { worldId, chunkX: delta.chunkX, chunkZ: delta.chunkZ },
        $inc: { revision: 1 },
      },
      { upsert: expectedRevision === undefined, returnDocument: "after" },
    );
    return result ?? "conflict";
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as Error & { code: number }).code === 11000
    )
      return "conflict";
    throw error;
  }
}

export async function savePlayerState(
  ownerId: string,
  worldId: string,
  state: Omit<PlayerWorldState, "worldId" | "lastPlayedAt">,
  expectedRevision?: number,
): Promise<StoredPlayerState | "conflict" | null> {
  if (!(await getOwnedWorld(ownerId, worldId))) return null;
  const filter: Filter<StoredPlayerState> = { worldId, ownerId };
  if (expectedRevision !== undefined) filter.revision = expectedRevision;
  const result = await (
    await states()
  ).findOneAndUpdate(
    filter,
    {
      $set: { ...state, lastPlayedAt: new Date().toISOString() },
      $setOnInsert: { worldId, ownerId },
      $inc: { revision: 1 },
    },
    { upsert: expectedRevision === undefined, returnDocument: "after" },
  );
  return result ?? "conflict";
}

export async function getPlayerState(
  ownerId: string,
  worldId: string,
): Promise<StoredPlayerState | null | undefined> {
  if (!(await getOwnedWorld(ownerId, worldId))) return undefined;
  return (await states()).findOne({ worldId, ownerId });
}
