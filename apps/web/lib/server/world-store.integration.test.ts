import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BlockId, createNexusQuestState } from "@fangyu/voxel-engine";

vi.mock("server-only", () => ({}));

const mongoUri = process.env.MONGODB_TEST_URI;
const suite = mongoUri ? describe : describe.skip;
const loadStore = () => import("./world-store");
const loadDatabase = () => import("./mongodb");

suite("MongoDB world ownership and revision integration", () => {
  let store: Awaited<ReturnType<typeof loadStore>>;
  let database: Awaited<ReturnType<typeof loadDatabase>>;

  beforeAll(async () => {
    process.env.MONGODB_URI = mongoUri;
    process.env.MONGODB_DB_NAME = `fangyu_integration_${Date.now()}`;
    store = await loadStore();
    database = await loadDatabase();
  });

  afterAll(async () => {
    if (database) await (await database.getGameDatabase()).dropDatabase();
    delete process.env.MONGODB_URI;
    delete process.env.MONGODB_DB_NAME;
  });

  it("protects ownership, persists deltas/player progress and cascades deletion", async () => {
    const owner = "integration-owner-a";
    const stranger = "integration-owner-b";
    const world = await store.createWorld(owner, {
      name: "Atlas Integration",
      seed: "atlas-deterministic",
      gameMode: "survival",
      edition: "java",
      gameVersion: "original-1",
      renderDistance: 3,
    });
    expect(await store.getOwnedWorld(stranger, world.id)).toBeNull();

    const chunk = await store.saveChunkDelta(owner, world.id, {
      chunkX: 0,
      chunkZ: 0,
      generationVersion: 2,
      chunkVersion: 1,
      modifiedBlocks: [[42, BlockId.Air]],
      entities: [
        {
          id: "persistent-crystal",
          kind: "dropped-item",
          itemId: BlockId.SunShard,
          count: 1,
          position: [1.5, 20, 1.5],
          createdAt: new Date().toISOString(),
        },
      ],
      revision: 0,
    });
    expect(chunk).not.toBeNull();
    expect(await store.getChunkDelta(stranger, world.id, 0, 0)).toBeUndefined();
    expect(
      await store.saveChunkDelta(
        owner,
        world.id,
        {
          chunkX: 0,
          chunkZ: 0,
          generationVersion: 2,
          chunkVersion: 1,
          modifiedBlocks: [[42, BlockId.Slate]],
          entities: [],
          revision: 0,
        },
        999,
      ),
    ).toBe("conflict");

    const quest = createNexusQuestState();
    quest.currentQuestLevel = 17;
    quest.completedQuestIds = Array.from(
      { length: 16 },
      (_, index) => `main-${String(index + 1).padStart(2, "0")}`,
    );
    const player = await store.savePlayerState(owner, world.id, {
      position: [10, 30, -4],
      rotation: [0.2, 1.4],
      health: 18,
      hunger: 13,
      inventory: [{ blockId: BlockId.SunShard, count: 2 }],
      selectedSlot: 0,
      gameMode: "survival",
      spawnPoint: [0.5, 24, 0.5],
      quest,
      revision: 0,
    });
    expect(player).not.toBeNull();
    expect(
      (await store.getPlayerState(owner, world.id))?.quest?.currentQuestLevel,
    ).toBe(17);
    expect(await store.getPlayerState(stranger, world.id)).toBeUndefined();

    expect(await store.deleteOwnedWorld(stranger, world.id)).toBe(false);
    expect(await store.deleteOwnedWorld(owner, world.id)).toBe(true);
    expect(await store.getChunkDelta(owner, world.id, 0, 0)).toBeUndefined();
    expect(await store.getPlayerState(owner, world.id)).toBeUndefined();
  });
});
