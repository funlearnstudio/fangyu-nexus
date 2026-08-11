"use client";

import {
  BlockId,
  GENERATION_VERSION,
  addToInventory,
  type GameMode,
  type GameWorldMetadata,
  type PersistedChunkDelta,
  type PlayerWorldState,
} from "@fangyu/voxel-engine";

const DATABASE_NAME = "fangyu-nexus-game";
const DATABASE_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("worlds"))
        db.createObjectStore("worlds", { keyPath: "id" });
      if (!db.objectStoreNames.contains("chunks"))
        db.createObjectStore("chunks", { keyPath: "key" });
      if (!db.objectStoreNames.contains("players"))
        db.createObjectStore("players", { keyPath: "worldId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = action(tx.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
}

export function createWorldMetadata(input: {
  name: string;
  seed: string;
  gameMode: GameMode;
  edition: "java" | "bedrock";
  gameVersion: string;
  renderDistance: number;
}): GameWorldMetadata {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: input.name,
    seed: input.seed || crypto.randomUUID(),
    gameMode: input.gameMode,
    edition: input.edition,
    gameVersion: input.gameVersion,
    generationVersion: GENERATION_VERSION,
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    lastPlayedAt: now,
    timeOfDay: 0.28,
    spawn: [0.5, 40, 0.5],
    worldSettings: {
      renderDistance: input.renderDistance,
      caves: "experimental",
    },
    revision: 1,
  };
}

export async function putLocalWorld(world: GameWorldMetadata): Promise<void> {
  await transaction("worlds", "readwrite", (store) => store.put(world));
}
export async function getLocalWorld(
  id: string,
): Promise<GameWorldMetadata | undefined> {
  return transaction("worlds", "readonly", (store) => store.get(id));
}
export async function listLocalWorlds(): Promise<GameWorldMetadata[]> {
  const worlds = await transaction<GameWorldMetadata[]>(
    "worlds",
    "readonly",
    (store) => store.getAll(),
  );
  return worlds.sort((a, b) => b.lastPlayedAt.localeCompare(a.lastPlayedAt));
}

export async function deleteLocalWorld(id: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(["worlds", "chunks", "players"], "readwrite");
  tx.objectStore("worlds").delete(id);
  tx.objectStore("players").delete(id);
  const request = tx.objectStore("chunks").openCursor();
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    if (String(cursor.key).startsWith(`${id}:`)) cursor.delete();
    cursor.continue();
  };
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

type LocalChunk = PersistedChunkDelta & { key: string };
export async function putLocalChunk(chunk: PersistedChunkDelta): Promise<void> {
  await transaction("chunks", "readwrite", (store) =>
    store.put({
      ...chunk,
      key: `${chunk.worldId}:${chunk.chunkX}:${chunk.chunkZ}`,
    } satisfies LocalChunk),
  );
}
export async function getLocalChunk(
  worldId: string,
  x: number,
  z: number,
): Promise<PersistedChunkDelta | undefined> {
  return transaction<LocalChunk | undefined>("chunks", "readonly", (store) =>
    store.get(`${worldId}:${x}:${z}`),
  );
}
export async function putLocalPlayer(state: PlayerWorldState): Promise<void> {
  await transaction("players", "readwrite", (store) => store.put(state));
}
export async function getLocalPlayer(
  worldId: string,
): Promise<PlayerWorldState | undefined> {
  return transaction("players", "readonly", (store) => store.get(worldId));
}

export function initialPlayerState(world: GameWorldMetadata): PlayerWorldState {
  let inventory = Array(36).fill(null);
  const starter = [
    BlockId.Verdant,
    BlockId.Loam,
    BlockId.Slate,
    BlockId.Dune,
    BlockId.Timber,
    BlockId.Canopy,
    BlockId.CopperBloom,
    BlockId.GlowCrystal,
  ];
  for (const id of starter)
    inventory = addToInventory(
      inventory,
      id,
      world.gameMode === "creative" ? 64 : 8,
    );
  return {
    worldId: world.id,
    position: world.spawn,
    rotation: [0, 0],
    health: 20,
    hunger: 20,
    inventory,
    selectedSlot: 0,
    gameMode: world.gameMode,
    spawnPoint: world.spawn,
    lastPlayedAt: new Date().toISOString(),
    revision: 0,
  };
}

export async function syncWorldToCloud(
  world: GameWorldMetadata,
): Promise<boolean> {
  try {
    const response = await fetch("/api/worlds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: world.id,
        name: world.name,
        seed: world.seed,
        gameMode: world.gameMode,
        edition: world.edition,
        gameVersion: world.gameVersion,
        renderDistance: world.worldSettings.renderDistance,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
