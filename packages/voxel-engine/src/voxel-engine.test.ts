import { describe, expect, it } from "vitest";
import type { Inventory } from "./gameplay";
import {
  BlockId,
  addToInventory,
  addToInventoryWithRemainder,
  buildChunkMesh,
  canPlaceBlock,
  chunkKey,
  collidesWithWorld,
  craftInventory,
  GAME_RECIPES,
  generateChunk,
  getChunkBlock,
  playerAabb,
  raycastVoxels,
  setChunkBlock,
  terrainHeight,
  getBlockLoot,
  pickupDroppedItem,
  countInventoryItem,
  createNexusQuestState,
  getNexusNodes,
  repairNexusNode,
  voxelIndex,
  worldToChunk,
  worldToLocal,
} from "./index";

describe("voxel world", () => {
  it("generates deterministic chunks and seed-specific terrain", () => {
    const first = generateChunk("aurora-42", -2, 3);
    const second = generateChunk("aurora-42", -2, 3);
    expect(first.blocks).toEqual(second.blocks);
    expect(terrainHeight("aurora-42", 80, -21)).not.toBe(
      terrainHeight("different", 80, -21),
    );
  });

  it("converts negative world coordinates consistently", () => {
    expect(worldToChunk(-1, -17)).toEqual({ x: -1, z: -2 });
    expect(worldToLocal(-1, -17)).toEqual({ x: 15, z: 15 });
    expect(chunkKey(-1, 2)).toBe("-1:2");
  });

  it("places, breaks and reapplies a compact delta", () => {
    const chunk = generateChunk("save", 0, 0);
    expect(setChunkBlock(chunk, 2, 50, 3, BlockId.Timber)).toBe(true);
    expect(getChunkBlock(chunk, 2, 50, 3)).toBe(BlockId.Timber);
    const loaded = generateChunk("save", 0, 0, [
      [voxelIndex(2, 50, 3), BlockId.Timber],
    ]);
    expect(getChunkBlock(loaded, 2, 50, 3)).toBe(BlockId.Timber);
  });

  it("raycasts the first solid voxel and prevents trapping the player", () => {
    const lookup = (x: number, y: number, z: number) =>
      x === 3 && y === 2 && z === 0 ? BlockId.Slate : BlockId.Air;
    expect(raycastVoxels(lookup, [0.5, 2.5, 0.5], [1, 0, 0], 6)?.block).toEqual(
      { x: 3, y: 2, z: 0 },
    );
    expect(
      canPlaceBlock(
        { x: 0, y: 1, z: 0 },
        playerAabb([0.5, 1, 0.5]),
        () => BlockId.Air,
      ),
    ).toBe(false);
    expect(
      collidesWithWorld(playerAabb([0.5, 1, 0.5]), (x, y, z) =>
        x === 0 && y === 1 && z === 0 ? BlockId.Slate : BlockId.Air,
      ),
    ).toBe(true);
  });

  it("culls internal faces into one compact chunk mesh", () => {
    const chunk = generateChunk("mesh-test", 0, 0);
    chunk.blocks.fill(BlockId.Air);
    setChunkBlock(chunk, 2, 20, 2, BlockId.Slate);
    setChunkBlock(chunk, 3, 20, 2, BlockId.Slate);
    const mesh = buildChunkMesh(chunk);
    expect(mesh.triangles).toBe(20);
    expect(mesh.positions).toBeInstanceOf(Float32Array);
    expect(mesh.indices).toBeInstanceOf(Uint32Array);
  });
});

describe("inventory and crafting", () => {
  it("stacks to 64 and uses another slot", () => {
    const inventory = addToInventory(Array(9).fill(null), BlockId.Slate, 70);
    expect(inventory[0]).toEqual({ blockId: BlockId.Slate, count: 64 });
    expect(inventory[1]).toEqual({ blockId: BlockId.Slate, count: 6 });
  });

  it("crafts only when ingredients exist", () => {
    const inventory = addToInventory(Array(9).fill(null), BlockId.Timber, 1);
    const result = craftInventory(inventory, GAME_RECIPES[0]!);
    expect(
      result?.some(
        (stack) => stack?.blockId === BlockId.Loam && stack.count === 4,
      ),
    ).toBe(true);
    expect(craftInventory(Array(9).fill(null), GAME_RECIPES[0]!)).toBeNull();
  });
});

describe("drop and pickup persistence primitives", () => {
  it("generates distinct yellow and purple crystal loot", () => {
    expect(getBlockLoot(BlockId.SunShardOre)).toEqual([
      { itemId: BlockId.SunShard, count: 1 },
    ]);
    expect(getBlockLoot(BlockId.DuskShardOre)).toEqual([
      { itemId: BlockId.DuskShard, count: 1 },
    ]);
  });

  it("keeps a dropped item when inventory is full and picks it up after space exists", () => {
    const full: Inventory = Array.from({ length: 36 }, () => ({
      blockId: BlockId.Slate,
      count: 64,
    }));
    const drop = {
      id: "drop-1",
      kind: "dropped-item" as const,
      itemId: BlockId.SunShard,
      count: 1,
      position: [1, 2, 3] as const,
      createdAt: "now",
    };
    expect(pickupDroppedItem(full, drop).remaining).toEqual(drop);
    const room = [...full];
    room[35] = null;
    const picked = pickupDroppedItem(room, drop);
    expect(picked.remaining).toBeNull();
    expect(picked.inventory[35]).toEqual({
      blockId: BlockId.SunShard,
      count: 1,
    });
    expect(
      addToInventoryWithRemainder(full, BlockId.DuskShard, 1).remaining,
    ).toBe(1);
  });
});

describe("Nexus world quest", () => {
  it("keeps portal node locations deterministic for a seed", () => {
    expect(getNexusNodes("quest-seed")).toEqual(getNexusNodes("quest-seed"));
    expect(getNexusNodes("quest-seed")).toHaveLength(3);
  });

  it("consumes three glow crystals only when repairing a new node", () => {
    const inventory = addToInventory(
      Array(9).fill(null),
      BlockId.GlowCrystal,
      3,
    );
    const result = repairNexusNode(
      createNexusQuestState(),
      inventory,
      "amber",
      "now",
    );
    expect(result?.state.repairedNodeIds).toEqual(["amber"]);
    expect(countInventoryItem(result!.inventory, BlockId.GlowCrystal)).toBe(0);
    expect(
      repairNexusNode(result!.state, result!.inventory, "amber"),
    ).toBeNull();
  });
});
