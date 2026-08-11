import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  BlockId,
  GENERATION_VERSION,
  compactModification,
  terrainHeight,
  voxelIndex,
} from "@fangyu/voxel-engine";
import {
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

    await putLocalWorld(world);
    await putLocalPlayer(player);
    await putLocalChunk({
      worldId: world.id,
      chunkX: -1,
      chunkZ: 2,
      generationVersion: GENERATION_VERSION,
      chunkVersion: 1,
      modifiedBlocks: [compactModification(voxelIndex(3, 22, 4), BlockId.Air)],
      entities: [],
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
});
