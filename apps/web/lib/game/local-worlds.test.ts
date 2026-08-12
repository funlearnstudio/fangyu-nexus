import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  BlockId,
  GENERATION_VERSION,
  compactModification,
  createNexusQuestState,
  terrainHeight,
  voxelIndex,
} from "@fangyu/voxel-engine";
import {
  createRuntimeId,
  createWorldMetadata,
  deleteLocalWorld,
  getLocalChunk,
  getLocalPlayer,
  getLocalWorld,
  initialPlayerState,
  listLocalWorlds,
  putLocalChunk,
  putLocalPlayer,
  putLocalWorld,
} from "./local-worlds";

describe("IndexedDB local-first world persistence", () => {
  it("creates a portable RFC 4122 identifier", () => {
    expect(createRuntimeId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("persists seed, modified chunk delta, inventory and player position", async () => {
    const world = createWorldMetadata({
      name: "Persistence test",
      seed: "stable-seed-77",
      gameMode: "survival",
      edition: "java",
      gameVersion: "original-1",
      renderDistance: 2,
    });
    const player = initialPlayerState(world);
    expect(world.spawn).toEqual([
      0.5,
      terrainHeight("stable-seed-77", 0, 0) + 1.001,
      0.5,
    ]);
    player.position = [12.5, 31, -4.5];
    player.inventory[0] = { blockId: BlockId.Timber, count: 23 };
    player.quest = {
      ...createNexusQuestState(),
      currentQuestLevel: 12,
      completedQuestIds: Array.from(
        { length: 11 },
        (_, index) => `main-${String(index + 1).padStart(2, "0")}`,
      ),
      tutorialSkipped: true,
    };

    await putLocalWorld(world);
    await putLocalPlayer(player);
    await putLocalChunk({
      worldId: world.id,
      chunkX: -1,
      chunkZ: 2,
      generationVersion: GENERATION_VERSION,
      chunkVersion: 1,
      modifiedBlocks: [compactModification(voxelIndex(3, 22, 4), BlockId.Air)],
      entities: [
        {
          id: "test-crop",
          kind: "crop",
          cropId: "sungrain",
          position: [-12.5, 24, 36.5],
          plantedAt: "2026-08-12T00:00:00.000Z",
          growthSeconds: 120,
        },
        {
          id: "test-chest",
          kind: "container",
          position: [-11.5, 24, 36.5],
          inventory: [{ blockId: BlockId.SunShard, count: 4 }],
          revision: 2,
        },
        {
          id: "test-sheep",
          kind: "creature",
          species: "sheep",
          position: [-10.5, 24, 36.5],
          health: 8,
          maxHealth: 8,
          home: [-10.5, 24, 36.5],
          persistent: true,
          woolly: false,
          woolRegrowsAt: "2026-08-12T00:02:00.000Z",
        },
        {
          id: "test-npc",
          kind: "npc",
          name: "洛禾",
          profession: "farmer",
          position: [-9.5, 24, 36.5],
          home: [-8.5, 24, 36.5],
          work: [-12.5, 24, 36.5],
          scheduleState: "working",
          tradeCount: 3,
          interactionFlags: ["met-player"],
          questStep: 2,
        },
      ],
      updatedAt: new Date().toISOString(),
      revision: 1,
    });

    expect((await getLocalWorld(world.id))?.seed).toBe("stable-seed-77");
    expect((await getLocalPlayer(world.id))?.position).toEqual([
      12.5, 31, -4.5,
    ]);
    expect((await getLocalPlayer(world.id))?.inventory[0]).toEqual({
      blockId: BlockId.Timber,
      count: 23,
    });
    expect((await getLocalPlayer(world.id))?.quest?.currentQuestLevel).toBe(12);
    expect((await getLocalPlayer(world.id))?.quest?.tutorialSkipped).toBe(true);
    expect((await getLocalChunk(world.id, -1, 2))?.modifiedBlocks).toEqual([
      [voxelIndex(3, 22, 4), BlockId.Air],
    ]);
    expect(
      (await listLocalWorlds()).some((entry) => entry.id === world.id),
    ).toBe(true);

    await deleteLocalWorld(world.id);
    expect(await getLocalWorld(world.id)).toBeUndefined();
    expect(await getLocalPlayer(world.id)).toBeUndefined();
    expect(await getLocalChunk(world.id, -1, 2)).toBeUndefined();
  });

  it("reloads crops, containers, livestock and NPC state without resetting", async () => {
    const world = createWorldMetadata({
      name: "Entity persistence",
      seed: "entity-state-22",
      gameMode: "survival",
      edition: "java",
      gameVersion: "original-1",
      renderDistance: 2,
    });
    const chunk = {
      worldId: world.id,
      chunkX: 0,
      chunkZ: 0,
      generationVersion: GENERATION_VERSION,
      chunkVersion: 1,
      modifiedBlocks: [],
      entities: [
        {
          id: "door",
          kind: "door" as const,
          position: [1.5, 20, 1.5] as const,
          open: true,
        },
        {
          id: "processor",
          kind: "processor" as const,
          position: [2.5, 20, 1.5] as const,
          input: [{ blockId: BlockId.RawSunroot, count: 1 }],
          fuel: [{ blockId: BlockId.FuelCell, count: 1 }],
          output: [],
          recipeId: "cook-sunroot",
          startedAt: "2026-08-12T00:00:00.000Z",
          durationSeconds: 12,
          revision: 1,
        },
      ],
      updatedAt: new Date().toISOString(),
      revision: 1,
    };
    await putLocalWorld(world);
    await putLocalChunk(chunk);
    const loaded = await getLocalChunk(world.id, 0, 0);
    expect(loaded?.entities).toEqual(chunk.entities);
    await deleteLocalWorld(world.id);
  });
});
