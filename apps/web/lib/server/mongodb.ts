import "server-only";
import { MongoClient, type Db } from "mongodb";

declare global {
  var __fangyuMongoClientPromise: Promise<MongoClient> | undefined;
  var __fangyuMongoIndexesPromise: Promise<void> | undefined;
}

function connectionPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_UNAVAILABLE");
  if (!globalThis.__fangyuMongoClientPromise) {
    globalThis.__fangyuMongoClientPromise = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 0,
      maxIdleTimeMS: 30_000,
      serverSelectionTimeoutMS: 4_000,
    })
      .connect()
      .catch((error) => {
        globalThis.__fangyuMongoClientPromise = undefined;
        throw error;
      });
  }
  return globalThis.__fangyuMongoClientPromise;
}

async function ensureIndexes(db: Db): Promise<void> {
  if (!globalThis.__fangyuMongoIndexesPromise) {
    globalThis.__fangyuMongoIndexesPromise = Promise.all([
      db.collection("gameWorlds").createIndex({ id: 1 }, { unique: true }),
      db.collection("gameWorlds").createIndex({ ownerId: 1, lastPlayedAt: -1 }),
      db
        .collection("worldChunks")
        .createIndex({ worldId: 1, chunkX: 1, chunkZ: 1 }, { unique: true }),
      db
        .collection("playerWorldStates")
        .createIndex({ worldId: 1, ownerId: 1 }, { unique: true }),
      db
        .collection("gameSessions")
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ])
      .then(() => undefined)
      .catch((error) => {
        globalThis.__fangyuMongoIndexesPromise = undefined;
        throw error;
      });
  }
  await globalThis.__fangyuMongoIndexesPromise;
}

export async function getGameDatabase(): Promise<Db> {
  const client = await connectionPromise();
  const db = client.db(process.env.MONGODB_DB_NAME || "fangyu_nexus_game");
  await ensureIndexes(db);
  return db;
}

export function isMongoConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI);
}
