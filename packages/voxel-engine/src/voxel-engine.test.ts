import { describe, expect, it } from "vitest";
import type { Inventory } from "./gameplay";
import {
  BlockId,
  addToInventory,
  addToInventoryWithRemainder,
  buildChunkMesh,
  nextSwimmingVelocityY,
  WATER_RENDER_STATE,
  canPlaceBlock,
  canCultivateSurface,
  canPlantCropOn,
  chunkKey,
  collidesWithWorld,
  isShelterComplete,
  moveInventoryStack,
  transferInventoryStack,
  damageTool,
  miningSeconds,
  startProcessor,
  finishProcessor,
  findWaterExitStep,
  collectProcessorOutput,
  isPersistableWorldEntity,
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
  SIDE_QUESTS,
  acceptSideQuest,
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
    const types = landmarks.map((entry) => entry.type);
    expect(types).toContain("village");
    expect(types).toContain("desert-ruin");
    expect(types).toContain("sunken-ruin");
    expect(types).toContain("underground-ruin");
    expect(types).toContain("ancient-machine");
    expect(types).toContain("nexus-core");
    expect(types.filter((type) => type === "village")).toHaveLength(2);
    expect(types.filter((type) => type === "nexus-ruin")).toHaveLength(3);
    const village = landmarks[0]!;
    const coordinate = worldToChunk(village.x, village.z);
    const chunk = generateChunk("settlement-seed", coordinate.x, coordinate.z);
    expect(Array.from(chunk.blocks)).toContain(BlockId.Timber);
  });

  it("keeps final devices craft-only while distributing enough ruin components", () => {
    const seed = "quest-resource-seed";
    const landmarks = getWorldLandmarks(seed);
    let oldComponents = 0;
    let coreFragments = 0;
    for (const landmark of landmarks) {
      const coordinate = worldToChunk(landmark.x, landmark.z);
      const local = worldToLocal(landmark.x, landmark.z);
      const chunk = generateChunk(seed, coordinate.x, coordinate.z);
      const base = terrainHeight(seed, landmark.x, landmark.z) + 1;
      for (let y = base; y <= Math.min(63, base + 12); y += 1)
        for (let offset = -3; offset <= 3; offset += 1) {
          const localOffset = worldToLocal(landmark.x + offset, landmark.z);
          if (worldToChunk(landmark.x + offset, landmark.z).x !== coordinate.x)
            continue;
          const block = getChunkBlock(chunk, localOffset.x, y, local.z);
          oldComponents += Number(block === BlockId.OldComponent);
          coreFragments += Number(block === BlockId.CoreFragment);
          expect(block).not.toBe(BlockId.NexusDevice);
          expect(block).not.toBe(BlockId.MachineKit);
        }
    }
    expect(oldComponents).toBeGreaterThanOrEqual(9);
    expect(coreFragments).toBeGreaterThanOrEqual(3);
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
    const mesh = buildChunkMesh(chunk);
    expect(mesh.triangles).toBe(12);
    expect(mesh.water.triangles).toBe(12);
    expect(mesh.indices).toHaveLength(0);
    expect(
      collidesWithWorld(playerAabb([4.5, 10, 4.5]), (x, y, z) =>
        x === 4 && y === 10 && z === 4 ? BlockId.Water : BlockId.Air,
      ),
    ).toBe(false);
  });

  it("gives an upward swim impulse strong enough to clear a shoreline", () => {
    expect(
      nextSwimmingVelocityY(0, true, false, 1 / 60),
    ).toBeGreaterThanOrEqual(4.8);
    expect(nextSwimmingVelocityY(2, false, true, 1 / 60)).toBeLessThanOrEqual(
      -3.6,
    );
    expect(nextSwimmingVelocityY(0, false, false, 1 / 60)).toBeLessThan(0);
  });

  it("resolves a one-block water-to-land step repeatedly without creating a collision wall", () => {
    const shoreline = (x: number, y: number, z: number) =>
      x >= 1 && y === 0 && z === 0 ? BlockId.Slate : BlockId.Water;
    for (let cycle = 0; cycle < 10; cycle += 1) {
      expect(
        findWaterExitStep([1.05, 0, 0.5], false, shoreline),
      ).not.toBeNull();
      expect(collidesWithWorld(playerAabb([1.05, 1, 0.5]), shoreline)).toBe(
        false,
      );
    }
  });

  it("never creates internal water faces, including across a chunk boundary", () => {
    const chunk = generateChunk("water-boundary-mesh", 0, 0);
    chunk.blocks.fill(BlockId.Air);
    setChunkBlock(chunk, 14, 10, 4, BlockId.Water);
    setChunkBlock(chunk, 15, 10, 4, BlockId.Water);
    const local = buildChunkMesh(chunk);
    // Two touching water cubes expose ten faces, not twelve.
    expect(local.water.triangles).toBe(20);

    chunk.blocks.fill(BlockId.Air);
    setChunkBlock(chunk, 15, 10, 4, BlockId.Water);
    const withoutNeighbour = buildChunkMesh(chunk);
    const withWaterNeighbour = buildChunkMesh(chunk, (x, y, z) =>
      x === 16 && y === 10 && z === 4 ? BlockId.Water : BlockId.Air,
    );
    expect(withoutNeighbour.water.triangles).toBe(12);
    expect(withWaterNeighbour.water.triangles).toBe(10);
    expect(withWaterNeighbour.water.positions).toHaveLength(20 * 3);
  });

  it("keeps water in a transparent, non-depth-writing render pass", () => {
    expect(WATER_RENDER_STATE).toMatchObject({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: "front",
    });
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

  it("provides a normal crafting path for the four-domain spectrum objective", () => {
    const recipe = GAME_RECIPES.find(
      (entry) => entry.id === "spectrum-crystal",
    )!;
    let inventory: Inventory = Array(9).fill(null);
    for (const blockId of [
      BlockId.SunShard,
      BlockId.DuskShard,
      BlockId.Tideglass,
      BlockId.GlowCrystal,
    ])
      inventory = addToInventory(inventory, blockId, 1);
    const crafted = craftInventory(inventory, recipe)!;
    expect(countInventoryItem(crafted, BlockId.SpectrumCrystal)).toBe(4);
  });

  it("moves, merges and swaps inventory stacks without item loss", () => {
    const inventory: Inventory = [
      { blockId: BlockId.Slate, count: 50 },
      { blockId: BlockId.Slate, count: 20 },
      { blockId: BlockId.Timber, count: 3 },
      null,
    ];
    const merged = moveInventoryStack(inventory, 1, 0);
    expect(merged[0]).toEqual({ blockId: BlockId.Slate, count: 64 });
    expect(merged[1]).toEqual({ blockId: BlockId.Slate, count: 6 });
    const swapped = moveInventoryStack(merged, 1, 2);
    expect(swapped[1]).toEqual({ blockId: BlockId.Timber, count: 3 });
    expect(swapped[2]).toEqual({ blockId: BlockId.Slate, count: 6 });
    const moved = moveInventoryStack(swapped, 2, 3);
    expect(moved[2]).toBeNull();
    expect(moved[3]).toEqual({ blockId: BlockId.Slate, count: 6 });
  });

  it("transfers stacks to containers and preserves overflow", () => {
    const source: Inventory = [{ blockId: BlockId.Slate, count: 64 }];
    const destination: Inventory = [{ blockId: BlockId.Slate, count: 60 }];
    const moved = transferInventoryStack(source, destination, 0);
    expect(moved.moved).toBe(4);
    expect(moved.source[0]?.count).toBe(60);
    expect(moved.destination[0]?.count).toBe(64);
  });

  it("applies tool efficiency and removes a broken durable tool", () => {
    const tool = {
      blockId: BlockId.TrailTool,
      count: 1,
      durability: 1,
      maxDurability: 96,
    };
    expect(miningSeconds(BlockId.Slate, tool)).toBeLessThan(
      miningSeconds(BlockId.Slate, null),
    );
    expect(damageTool([tool], 0)[0]).toBeNull();
  });

  it("runs processor input, fuel, offline completion and output collection", () => {
    const processor = {
      id: "processor-1",
      kind: "processor" as const,
      position: [0.5, 2, 0.5] as const,
      input: [],
      fuel: [],
      output: Array(3).fill(null),
      revision: 0,
    };
    let inventory = addToInventory(Array(9).fill(null), BlockId.RawSunroot, 1);
    inventory = addToInventory(inventory, BlockId.FuelCell, 1);
    const started = startProcessor(
      processor,
      inventory,
      "cook-sunroot",
      "2026-01-01T00:00:00.000Z",
    )!;
    const ready = finishProcessor(
      started.processor,
      Date.parse("2026-01-01T00:00:20.000Z"),
    );
    expect(ready.output[0]).toEqual({
      blockId: BlockId.CookedSunroot,
      count: 1,
    });
    const collected = collectProcessorOutput(ready, started.inventory);
    expect(countInventoryItem(collected.inventory, BlockId.CookedSunroot)).toBe(
      1,
    );
    expect(isPersistableWorldEntity(collected.processor)).toBe(true);
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

  it("requires an excavator and cultivated soil for the farming loop", () => {
    const tool = {
      blockId: BlockId.TrailTool,
      count: 1,
      durability: 12,
      maxDurability: 12,
    };
    expect(canCultivateSurface(BlockId.Verdant, tool)).toBe(true);
    expect(canCultivateSurface(BlockId.Loam, tool)).toBe(true);
    expect(canCultivateSurface(BlockId.Slate, tool)).toBe(false);
    expect(canCultivateSurface(BlockId.Verdant, null)).toBe(false);
    expect(canPlantCropOn(BlockId.CultivatedLoam)).toBe(true);
    expect(canPlantCropOn(BlockId.Loam)).toBe(false);
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

  it("counts every keyed deterministic structure during durable reconciliation", () => {
    const restored = reconcilePersistentQuestProgress(
      normalizeNexusQuestState({
        currentQuestLevel: 39,
        discoveredStructures: [
          "nexus-ruin-10",
          "nexus-ruin-11",
          "nexus-ruin-12",
        ],
      }),
    );
    expect(restored.objectiveProgress["main-39:ruins"]).toBe(3);
  });

  it("requires all five resident professions and their distinct exchanges", () => {
    let state = normalizeNexusQuestState({ currentQuestLevel: 42 });
    const professions = [
      "farmer",
      "crafter",
      "trader",
      "explorer",
      "researcher",
    ];
    state = applyGameplayEvent(state, {
      id: "same-farmer-many-times",
      type: "interactNPC",
      key: "farmer",
      amount: 99,
    }).state;
    expect(getCurrentQuest(state).level).toBe(42);
    for (const profession of professions) {
      state = applyGameplayEvent(state, {
        id: `meet-${profession}`,
        type: "interactNPC",
        key: profession,
      }).state;
      state = applyGameplayEvent(state, {
        id: `trade-${profession}`,
        type: "trade",
        key: profession,
      }).state;
    }
    expect(getCurrentQuest(state).level).toBe(43);
  });

  it("has gameplay backing for every keyed main objective", () => {
    const capabilities: Partial<Record<string, Set<string>>> = {
      collect: new Set([
        "timber",
        "slate",
        "nexus-crystal",
        "food",
        "forest-plant",
        "dusk-shard",
        "tideglass",
        "old-component",
        "settler-component",
        "deep-alloy",
        "waygate-fuel",
        "expedition-food",
        "crystal-spectrum",
        "core-fragment",
        "core-fuel",
        "alliance-seal",
      ]),
      craft: new Set([
        "trail-tool",
        "node-calibrator",
        "refined-material",
        "nexus-conduit",
        "engineer-core",
        "frequency-core",
        "expedition-gear",
        "machine-kit",
        "endgame-component",
      ]),
      place: new Set([
        "crop",
        "workstation",
        "chest",
        "path",
        "nexus-conduit",
        "nexus-light",
      ]),
      build: new Set([
        "shelter",
        "large-farm",
        "village-workshop",
        "mountain-relay",
        "remote-base",
        "waygate",
        "base",
        "final-relay",
      ]),
      harvest: new Set(["crop", "sungrain", "sunroot"]),
      animalProduct: new Set(["egg", "milk", "wool"]),
      interactNPC: new Set([
        "farmer",
        "crafter",
        "trader",
        "explorer",
        "researcher",
      ]),
      trade: new Set([
        "farmer",
        "crafter",
        "trader",
        "explorer",
        "researcher",
        "alliance-seal",
      ]),
      activateNexus: new Set([
        "swamp-pylon",
        "regional-network",
        "nine-node-sync",
        "base-network",
        "world-signal",
        "ancient-machine",
        "nexus-core",
      ]),
      repairNode: new Set(["tundra-node", "terminal-node"]),
    };
    const biomeIds = new Set(BIOMES.map((entry) => entry.id));
    const structureIds = new Set(
      getWorldLandmarks("quest-backing").map((entry) => entry.type),
    );
    for (const quest of MAIN_QUESTS)
      for (const objective of quest.objectives) {
        if (!objective.key) continue;
        if (objective.type === "discoverBiome")
          expect(biomeIds, `${quest.level}:${objective.key}`).toContain(
            objective.key,
          );
        else if (objective.type === "discoverStructure")
          expect(structureIds, `${quest.level}:${objective.key}`).toContain(
            objective.key,
          );
        else
          expect(
            capabilities[objective.type],
            `${quest.level}:${objective.type}:${objective.key}`,
          )?.toContain(objective.key);
      }
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

  it("can traverse every objective from level one through post-game in order", () => {
    let state = createNexusQuestState();
    let sequence = 0;
    while (!state.postGame && sequence < 500) {
      const quest = getCurrentQuest(state);
      for (const objective of quest.objectives) {
        const result = applyGameplayEvent(state, {
          id: `acceptance-${quest.level}-${objective.id}-${sequence++}`,
          type: objective.type,
          ...(objective.key ? { key: objective.key } : {}),
          amount: objective.target,
        });
        state = result.state;
        if (state.currentQuestLevel !== quest.level) break;
      }
    }
    expect(state.postGame).toBe(true);
    expect(state.completedQuestIds).toHaveLength(50);
    expect(state.completedQuestIds[0]).toBe("main-01");
    expect(state.completedQuestIds[49]).toBe("main-50");
  });

  it("runs resident side quests sequentially and preserves their progress", () => {
    let state = acceptSideQuest(createNexusQuestState(), "farmer");
    expect(state.acceptedSideQuestIds).toEqual(["side-farmer-fields"]);
    state = applyGameplayEvent(state, {
      id: "too-early",
      type: "place",
      key: "crop",
      amount: 4,
    }).state;
    expect(state.sideQuestProgress["side-farmer-fields:field"] ?? 0).toBe(0);
    state = applyGameplayEvent(state, {
      id: "harvest",
      type: "harvest",
      key: "crop",
      amount: 2,
    }).state;
    state = applyGameplayEvent(state, {
      id: "seeds",
      type: "collect",
      key: "field-seed",
      amount: 4,
    }).state;
    expect(
      normalizeNexusQuestState(state).sideQuestProgress[
        "side-farmer-fields:seeds"
      ],
    ).toBe(4);
    expect(SIDE_QUESTS).toHaveLength(4);
  });

  it("reconciles terminal repairs and network activation into endgame progress", () => {
    const state = reconcilePersistentQuestProgress(
      normalizeNexusQuestState({
        currentQuestLevel: 50,
        repairedNodeIds: [
          "terminal-node-a",
          "terminal-node-b",
          "terminal-node-c",
        ],
        discoveredStructures: ["nexus-core-prime"],
        activatedNodeIds: ["nexus-core"],
      }),
    );
    const quest = getCurrentQuest(state);
    expect(
      quest.objectives.map(
        (entry) => state.objectiveProgress[`${quest.id}:${entry.id}`],
      ),
    ).toEqual([3, 3, 1, 1]);
  });

  it("keeps portal node locations deterministic for a seed", () => {
    expect(getNexusNodes("quest-seed")).toEqual(getNexusNodes("quest-seed"));
    expect(getNexusNodes("quest-seed")).toHaveLength(9);
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
