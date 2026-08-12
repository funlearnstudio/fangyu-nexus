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
  isShelterComplete,
  craftInventory,
  GAME_RECIPES,
  BIOMES,
  generateChunk,
  getChunkBlock,
  getBiomeAt,
  playerAabb,
  raycastVoxels,
  setChunkBlock,
  terrainHeight,
  getBlockLoot,
  pickupDroppedItem,
  cropGrowthStage,
  isCropMature,
  countInventoryItem,
  createNexusQuestState,
  applyGameplayEvent,
  getCurrentQuest,
  MAIN_QUESTS,
  normalizeNexusQuestState,
  reconcilePersistentQuestProgress,
  getNexusNodes,
  getWorldLandmarks,
  getWeatherAt,
  repairNexusNode,
  voxelIndex,
  worldToChunk,
  worldToLocal,
} from "./index";

describe("voxel world", () => {
  it("generates all ten deterministic visual biome families", () => {
    const discovered = new Set<string>();
    for (let z = -1800; z <= 1800; z += 48)
      for (let x = -1800; x <= 1800; x += 48)
        discovered.add(getBiomeAt("biome-test", x, z).id);
    expect(discovered).toEqual(new Set(BIOMES.map((biome) => biome.id)));
    expect(getBiomeAt("biome-test", 0, 0).id).toBe("plains");
  });

  it("generates deterministic chunks and seed-specific terrain", () => {
    const first = generateChunk("aurora-42", -2, 3);
    const second = generateChunk("aurora-42", -2, 3);
    expect(first.blocks).toEqual(second.blocks);
    expect(terrainHeight("aurora-42", 80, -21)).not.toBe(
      terrainHeight("different", 80, -21),
    );
  });

  it("places deterministic villages and exploration landmarks", () => {
    const landmarks = getWorldLandmarks("settlement-seed");
    expect(landmarks).toEqual(getWorldLandmarks("settlement-seed"));
    expect(landmarks.map((entry) => entry.type)).toEqual([
      "village",
      "abandoned-home",
      "camp",
      "ruin",
      "mine",
      "nexus-tower",
    ]);
    const village = landmarks[0]!;
    const coordinate = worldToChunk(village.x, village.z);
    const chunk = generateChunk("settlement-seed", coordinate.x, coordinate.z);
    expect(Array.from(chunk.blocks)).toContain(BlockId.Timber);
  });

  it("keeps weather biome appropriate", () => {
    const seed = "weather-seed";
    for (let time = 0; time < 1; time += 0.02) {
      const weather = getWeatherAt(seed, time, 0, 0);
      expect(["clear", "rain", "fog", "snow"]).toContain(weather);
    }
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

  it("recognizes a roof and enclosing walls as a real shelter", () => {
    const blocks = new Set<string>();
    for (let z = -1; z <= 1; z += 1)
      for (let x = -1; x <= 1; x += 1) blocks.add(`${x}:4:${z}`);
    blocks.add("2:2:0");
    blocks.add("-2:2:0");
    blocks.add("0:2:2");
    const lookup = (x: number, y: number, z: number) =>
      blocks.has(`${x}:${y}:${z}`) ? BlockId.Timber : BlockId.Air;
    expect(isShelterComplete([0.5, 1, 0.5], lookup)).toBe(true);
    blocks.delete("0:2:2");
    expect(isShelterComplete([0.5, 1, 0.5], lookup)).toBe(false);
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

  it("meshes visible water while keeping it non-solid", () => {
    const chunk = generateChunk("water-mesh", 0, 0);
    chunk.blocks.fill(BlockId.Air);
    setChunkBlock(chunk, 4, 10, 4, BlockId.Water);
    expect(buildChunkMesh(chunk).triangles).toBe(12);
    expect(
      collidesWithWorld(playerAabb([4.5, 10, 4.5]), (x, y, z) =>
        x === 4 && y === 10 && z === 4 ? BlockId.Water : BlockId.Air,
      ),
    ).toBe(false);
  });
});

describe("inventory and crafting", () => {
  it("stacks to 64 and uses another slot", () => {
    const inventory = addToInventory(Array(9).fill(null), BlockId.Slate, 70);
    expect(inventory[0]).toEqual({ blockId: BlockId.Slate, count: 64 });
    expect(inventory[1]).toEqual({ blockId: BlockId.Slate, count: 6 });
  });

  it("crafts only when ingredients exist", () => {
    const recipe = GAME_RECIPES.find((entry) => entry.id === "timber-to-loam")!;
    const inventory = addToInventory(Array(9).fill(null), BlockId.Timber, 1);
    const result = craftInventory(inventory, recipe);
    expect(
      result?.some(
        (stack) => stack?.blockId === BlockId.Loam && stack.count === 4,
      ),
    ).toBe(true);
    expect(craftInventory(Array(9).fill(null), recipe)).toBeNull();
  });
});

describe("drop and pickup persistence primitives", () => {
  it("uses the shared loot pipeline for renewable field seeds", () => {
    expect(getBlockLoot(BlockId.Canopy)).toContainEqual({
      itemId: BlockId.FieldSeed,
      count: 1,
    });
  });

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

describe("persistent farming", () => {
  const crop = {
    id: "crop-1",
    kind: "crop" as const,
    cropId: "sungrain" as const,
    position: [1, 2, 3] as const,
    plantedAt: "2026-01-01T00:00:00.000Z",
    growthSeconds: 120,
  };
  it("calculates offline crop growth from its saved timestamp", () => {
    expect(cropGrowthStage(crop, Date.parse(crop.plantedAt) + 31_000)).toBe(1);
    expect(isCropMature(crop, Date.parse(crop.plantedAt) + 121_000)).toBe(true);
  });
});

describe("Nexus world quest", () => {
  it("defines fifty sequential main levels without skipping prerequisites", () => {
    expect(MAIN_QUESTS).toHaveLength(50);
    expect(MAIN_QUESTS[0]?.prerequisites).toEqual([]);
    expect(MAIN_QUESTS[49]?.prerequisites).toEqual(["main-49"]);
  });

  it("only unlocks the next level and ignores duplicate gameplay events", () => {
    const initial = createNexusQuestState();
    const first = applyGameplayEvent(initial, {
      id: "walk-1",
      type: "travel",
      amount: 8,
    });
    expect(first.completedLevel).toBe(1);
    expect(first.state.currentQuestLevel).toBe(2);
    expect(first.state.completedQuestIds).toEqual(["main-01"]);
    expect(first.state.completedQuestIds).not.toContain("main-03");

    const duplicate = applyGameplayEvent(first.state, {
      id: "walk-1",
      type: "travel",
      amount: 8,
    });
    expect(duplicate.state).toEqual(first.state);
    expect(duplicate.state.claimedRewards).toEqual(["main-01"]);
  });

  it("preserves objective progress and tutorial skip does not skip level one", () => {
    const partial = applyGameplayEvent(createNexusQuestState(), {
      id: "walk-2",
      type: "travel",
      amount: 3,
    }).state;
    const restored = normalizeNexusQuestState({
      ...partial,
      tutorialSkipped: true,
    });
    expect(restored.currentQuestLevel).toBe(1);
    expect(restored.objectiveProgress["main-01:travel"]).toBe(3);
    expect(getCurrentQuest(restored).id).toBe("main-01");
  });

  it("reconciles discoveries made before their quest unlocks", () => {
    const restored = reconcilePersistentQuestProgress(
      normalizeNexusQuestState({
        currentQuestLevel: 9,
        completedQuestIds: MAIN_QUESTS.slice(0, 8).map((quest) => quest.id),
        discoveredBiomes: ["plains", "forest"],
      }),
    );
    expect(restored.objectiveProgress["main-09:biome"]).toBe(2);
    const advanced = applyGameplayEvent(restored, {
      id: "persistent-reconcile",
      type: "travel",
      amount: 0,
    });
    expect(advanced.completedLevel).toBe(9);
    expect(advanced.state.currentQuestLevel).toBe(10);
  });

  it("enters post-game only after completing level fifty", () => {
    const finalState = normalizeNexusQuestState({
      currentQuestLevel: 50,
      completedQuestIds: MAIN_QUESTS.slice(0, 49).map((quest) => quest.id),
    });
    const events = [
      {
        id: "signal",
        type: "activateNexus" as const,
        key: "world-signal",
        amount: 3,
      },
      {
        id: "terminal",
        type: "repairNode" as const,
        key: "terminal-node",
        amount: 3,
      },
      {
        id: "core-found",
        type: "discoverStructure" as const,
        key: "nexus-core",
      },
      { id: "core-on", type: "activateNexus" as const, key: "nexus-core" },
    ];
    const completed = events.reduce(
      (state, event) => applyGameplayEvent(state, event).state,
      finalState,
    );
    expect(completed.postGame).toBe(true);
    expect(completed.currentQuestLevel).toBe(50);
    expect(completed.completedQuestIds).toContain("main-50");
  });

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
