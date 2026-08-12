import { BlockId, type BlockIdValue, getBlockDefinition } from "./blocks";

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 64;
export const GENERATION_VERSION = 2;
export const SEA_LEVEL = 19;

export type BiomeId =
  | "plains"
  | "forest"
  | "dense-forest"
  | "desert"
  | "beach"
  | "ocean"
  | "river"
  | "mountain"
  | "tundra"
  | "swamp";

export interface BiomeDefinition {
  id: BiomeId;
  name: string;
  treeDensity: number;
  surface: BlockIdValue;
}

export type LandmarkType =
  | "village"
  | "abandoned-home"
  | "camp"
  | "desert-ruin"
  | "mine"
  | "nexus-tower"
  | "cave"
  | "sunken-ruin"
  | "underground-ruin"
  | "nexus-ruin"
  | "ancient-machine"
  | "endgame-ruin"
  | "nexus-core";

export interface WorldLandmark {
  id: string;
  type: LandmarkType;
  name: string;
  x: number;
  z: number;
}

export type WeatherType = "clear" | "rain" | "fog" | "snow";

export const BIOMES: readonly BiomeDefinition[] = [
  {
    id: "plains",
    name: "青風平原",
    treeDensity: 0.004,
    surface: BlockId.Verdant,
  },
  {
    id: "forest",
    name: "琥珀森林",
    treeDensity: 0.026,
    surface: BlockId.Verdant,
  },
  {
    id: "dense-forest",
    name: "深冠密林",
    treeDensity: 0.055,
    surface: BlockId.Verdant,
  },
  { id: "desert", name: "星砂荒漠", treeDensity: 0, surface: BlockId.Dune },
  { id: "beach", name: "潮痕海灘", treeDensity: 0, surface: BlockId.Dune },
  { id: "ocean", name: "蔚藍外海", treeDensity: 0, surface: BlockId.Dune },
  { id: "river", name: "鏡脈河川", treeDensity: 0, surface: BlockId.Loam },
  {
    id: "mountain",
    name: "斷層高山",
    treeDensity: 0.002,
    surface: BlockId.Slate,
  },
  {
    id: "tundra",
    name: "霜原凍土",
    treeDensity: 0.001,
    surface: BlockId.Slate,
  },
  { id: "swamp", name: "暮霧沼澤", treeDensity: 0.018, surface: BlockId.Loam },
] as const;

export interface ChunkCoordinate {
  x: number;
  z: number;
}
export interface VoxelCoordinate {
  x: number;
  y: number;
  z: number;
}
export type ChunkModification = readonly [index: number, blockId: BlockIdValue];

export interface ChunkData {
  x: number;
  z: number;
  blocks: Uint8Array;
  revision: number;
}

export interface ChunkMeshData {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
  triangles: number;
}

export function floorDiv(value: number, divisor: number): number {
  return Math.floor(value / divisor);
}

export function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

export function worldToChunk(x: number, z: number): ChunkCoordinate {
  return { x: floorDiv(x, CHUNK_SIZE), z: floorDiv(z, CHUNK_SIZE) };
}

export function worldToLocal(x: number, z: number): ChunkCoordinate {
  return { x: positiveModulo(x, CHUNK_SIZE), z: positiveModulo(z, CHUNK_SIZE) };
}

export function chunkKey(x: number, z: number): string {
  return `${x}:${z}`;
}

export function voxelIndex(x: number, y: number, z: number): number {
  return y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x;
}

export function decodeVoxelIndex(index: number): VoxelCoordinate {
  const y = Math.floor(index / (CHUNK_SIZE * CHUNK_SIZE));
  const rest = index - y * CHUNK_SIZE * CHUNK_SIZE;
  return { x: rest % CHUNK_SIZE, y, z: Math.floor(rest / CHUNK_SIZE) };
}

export function getChunkBlock(
  chunk: ChunkData,
  x: number,
  y: number,
  z: number,
): BlockIdValue {
  if (
    x < 0 ||
    z < 0 ||
    y < 0 ||
    x >= CHUNK_SIZE ||
    z >= CHUNK_SIZE ||
    y >= WORLD_HEIGHT
  )
    return BlockId.Air;
  return (chunk.blocks[voxelIndex(x, y, z)] ?? BlockId.Air) as BlockIdValue;
}

export function setChunkBlock(
  chunk: ChunkData,
  x: number,
  y: number,
  z: number,
  blockId: BlockIdValue,
): boolean {
  if (
    x < 0 ||
    z < 0 ||
    y < 0 ||
    x >= CHUNK_SIZE ||
    z >= CHUNK_SIZE ||
    y >= WORLD_HEIGHT
  )
    return false;
  const index = voxelIndex(x, y, z);
  if (chunk.blocks[index] === blockId) return false;
  chunk.blocks[index] = blockId;
  chunk.revision += 1;
  return true;
}

function hash32(value: number): number {
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return (value ^ (value >>> 16)) >>> 0;
}

export function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function random2(seed: number, x: number, z: number, salt = 0): number {
  return (
    hash32(seed ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ salt) /
    0xffffffff
  );
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function valueNoise(
  seed: number,
  x: number,
  z: number,
  scale: number,
  salt: number,
): number {
  const fx = x / scale;
  const fz = z / scale;
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const tx = smoothstep(fx - x0);
  const tz = smoothstep(fz - z0);
  const a = random2(seed, x0, z0, salt);
  const b = random2(seed, x0 + 1, z0, salt);
  const c = random2(seed, x0, z0 + 1, salt);
  const d = random2(seed, x0 + 1, z0 + 1, salt);
  return a + (b - a) * tx + (c + (d - c) * tx - (a + (b - a) * tx)) * tz;
}

export function getBiomeAt(
  seedText: string,
  worldX: number,
  worldZ: number,
): BiomeDefinition {
  if (Math.hypot(worldX, worldZ) < 28) return BIOMES[0]!;
  const seed = hashSeed(seedText);
  const continental = valueNoise(seed, worldX, worldZ, 118, 701);
  const temperature = valueNoise(seed, worldX, worldZ, 92, 709);
  const moisture = valueNoise(seed, worldX, worldZ, 78, 719);
  const ridge = valueNoise(seed, worldX, worldZ, 66, 727);
  const river = Math.abs(valueNoise(seed, worldX, worldZ, 54, 733) - 0.5);
  if (continental < 0.25) return BIOMES[5]!;
  if (continental < 0.31) return BIOMES[4]!;
  if (river < 0.025 && continental < 0.72) return BIOMES[6]!;
  if (ridge > 0.76) return BIOMES[7]!;
  if (temperature < 0.27) return BIOMES[8]!;
  if (temperature > 0.64 && moisture < 0.38) return BIOMES[3]!;
  if (moisture > 0.75 && continental < 0.62) return BIOMES[9]!;
  if (moisture > 0.65) return BIOMES[2]!;
  if (moisture > 0.49) return BIOMES[1]!;
  return BIOMES[0]!;
}

function findBiomeLocation(
  seedText: string,
  allowed: readonly BiomeId[],
  minimum: number,
  maximum: number,
  phase: number,
): readonly [number, number] {
  for (let radius = minimum; radius <= maximum; radius += 8)
    for (let step = 0; step < 32; step += 1) {
      const angle = (step / 32) * Math.PI * 2 + phase;
      const x = Math.round(Math.cos(angle) * radius);
      const z = Math.round(Math.sin(angle) * radius);
      if (allowed.includes(getBiomeAt(seedText, x, z).id)) return [x, z];
    }
  return [
    Math.round(Math.cos(phase) * minimum),
    Math.round(Math.sin(phase) * minimum),
  ];
}

export function getWorldLandmarks(seedText: string): readonly WorldLandmark[] {
  const seed = hashSeed(seedText);
  const phase = (seed % 628) / 100;
  const specs = [
    ["village", "風徑聚落", ["plains", "forest"], 44, 88, 0],
    ["village", "潮岸聚落", ["beach", "plains"], 180, 270, 0.45],
    ["abandoned-home", "遺忘居所", ["forest", "dense-forest"], 72, 140, 0.9],
    ["camp", "遠行者營地", ["plains", "desert"], 100, 180, 1.8],
    ["desert-ruin", "斷響遺跡", ["desert"], 130, 230, 2.7],
    ["mine", "深紋礦口", ["mountain", "tundra"], 150, 260, 3.6],
    ["nexus-tower", "Nexus 遙塔", ["plains", "mountain"], 190, 310, 4.5],
    ["cave", "回聲洞口", ["mountain", "forest"], 110, 210, 5.1],
    ["sunken-ruin", "沉沒訊號柱", ["swamp", "river"], 220, 340, 5.7],
    ["underground-ruin", "地底方城", ["mountain"], 280, 400, 0.7],
    ["nexus-ruin", "琥珀古站", ["desert"], 320, 440, 1.4],
    ["nexus-ruin", "潮藍古站", ["beach", "ocean"], 360, 480, 2.1],
    ["nexus-ruin", "霜紫古站", ["tundra"], 400, 520, 2.8],
    ["ancient-machine", "古代脈輪機", ["mountain"], 450, 580, 3.5],
    ["endgame-ruin", "終局遺址一", ["desert"], 520, 680, 4.2],
    ["endgame-ruin", "終局遺址二", ["swamp"], 560, 720, 4.9],
    ["endgame-ruin", "終局遺址三", ["tundra"], 600, 760, 5.6],
    ["nexus-core", "Nexus Core", ["mountain"], 720, 880, 0.2],
  ] as const;
  return specs.map(([type, name, biomes, min, max, offset], index) => {
    const [x, z] = findBiomeLocation(
      seedText,
      biomes,
      min,
      max,
      phase + offset,
    );
    return { id: `${type}-${index}`, type, name, x, z };
  });
}

export function getWeatherAt(
  seedText: string,
  timeOfDay: number,
  worldX: number,
  worldZ: number,
): WeatherType {
  const biome = getBiomeAt(seedText, worldX, worldZ).id;
  if (biome === "desert" || biome === "beach") return "clear";
  const cycle =
    (Math.floor((((timeOfDay % 1) + 1) % 1) * 36) + hashSeed(seedText)) % 13;
  if (biome === "swamp" && (cycle === 2 || cycle === 3)) return "fog";
  if (cycle !== 5 && cycle !== 6 && cycle !== 7) return "clear";
  return biome === "tundra" || biome === "mountain" ? "snow" : "rain";
}

export function terrainHeight(
  seedText: string,
  worldX: number,
  worldZ: number,
): number {
  const seed = hashSeed(seedText);
  const broad = valueNoise(seed, worldX, worldZ, 48, 101);
  const detail = valueNoise(seed, worldX, worldZ, 13, 211);
  const biome = getBiomeAt(seedText, worldX, worldZ).id;
  const base =
    biome === "ocean"
      ? 10 + broad * 5
      : biome === "beach"
        ? 17 + broad * 3
        : biome === "river"
          ? 15 + broad * 2
          : biome === "mountain"
            ? 32 + broad * 19 + detail * 5
            : biome === "swamp"
              ? 17 + broad * 4
              : biome === "desert"
                ? 18 + broad * 8 + detail * 2
                : biome === "tundra"
                  ? 21 + broad * 10 + detail * 2
                  : 14 + broad * 18 + detail * 5;
  return Math.max(8, Math.min(WORLD_HEIGHT - 10, Math.floor(base)));
}

function isCave(seed: number, x: number, y: number, z: number): boolean {
  const a = valueNoise(seed ^ Math.imul(y, 911), x, z, 10, 307);
  const b = random2(seed ^ Math.imul(y, 1597), x, z, 401);
  return y > 3 && a > 0.72 && b > 0.68;
}

function applyLandmarkBlocks(
  seedText: string,
  chunkX: number,
  chunkZ: number,
  blocks: Uint8Array,
): void {
  const setWorld = (
    worldX: number,
    y: number,
    worldZ: number,
    id: BlockIdValue,
  ) => {
    const localX = worldX - chunkX * CHUNK_SIZE;
    const localZ = worldZ - chunkZ * CHUNK_SIZE;
    if (
      localX < 0 ||
      localX >= CHUNK_SIZE ||
      localZ < 0 ||
      localZ >= CHUNK_SIZE ||
      y < 0 ||
      y >= WORLD_HEIGHT
    )
      return;
    blocks[voxelIndex(localX, y, localZ)] = id;
  };
  const house = (centerX: number, centerZ: number, width = 7, depth = 6) => {
    const base = terrainHeight(seedText, centerX, centerZ) + 1;
    for (let z = -Math.floor(depth / 2); z <= Math.floor(depth / 2); z += 1)
      for (let x = -Math.floor(width / 2); x <= Math.floor(width / 2); x += 1) {
        setWorld(centerX + x, base, centerZ + z, BlockId.Timber);
        const edge =
          Math.abs(x) === Math.floor(width / 2) ||
          Math.abs(z) === Math.floor(depth / 2);
        if (edge)
          for (let y = 1; y <= 3; y += 1)
            setWorld(
              centerX + x,
              base + y,
              centerZ + z,
              x === 0 && z === Math.floor(depth / 2) && y < 3
                ? BlockId.Air
                : BlockId.Timber,
            );
        setWorld(centerX + x, base + 4, centerZ + z, BlockId.Canopy);
      }
  };
  for (const landmark of getWorldLandmarks(seedText)) {
    if (landmark.type === "village") {
      for (let offset = -22; offset <= 22; offset += 1) {
        const yX = terrainHeight(seedText, landmark.x + offset, landmark.z);
        const yZ = terrainHeight(seedText, landmark.x, landmark.z + offset);
        setWorld(landmark.x + offset, yX, landmark.z, BlockId.Dune);
        setWorld(landmark.x, yZ, landmark.z + offset, BlockId.Dune);
      }
      house(landmark.x - 10, landmark.z - 9);
      house(landmark.x + 10, landmark.z - 8);
      house(landmark.x - 9, landmark.z + 10);
      house(landmark.x + 11, landmark.z + 9, 9, 7);
      for (let z = 4; z <= 12; z += 1)
        for (let x = -3; x <= 3; x += 1) {
          const wx = landmark.x + x;
          const wz = landmark.z + z;
          setWorld(wx, terrainHeight(seedText, wx, wz), wz, BlockId.Loam);
        }
    } else if (
      landmark.type === "nexus-tower" ||
      landmark.type === "ancient-machine" ||
      landmark.type === "nexus-core"
    ) {
      const base = terrainHeight(seedText, landmark.x, landmark.z) + 1;
      for (let y = 0; y < 12; y += 1)
        for (let z = -2; z <= 2; z += 1)
          for (let x = -2; x <= 2; x += 1)
            if (Math.abs(x) === 2 || Math.abs(z) === 2)
              setWorld(
                landmark.x + x,
                base + y,
                landmark.z + z,
                y > 8 ? BlockId.GlowCrystal : BlockId.Slate,
              );
      if (landmark.type === "ancient-machine")
        setWorld(landmark.x, base + 2, landmark.z, BlockId.NexusConduit);
      if (landmark.type === "nexus-core")
        setWorld(landmark.x, base + 12, landmark.z, BlockId.NexusLight);
    } else if (
      landmark.type === "desert-ruin" ||
      landmark.type === "mine" ||
      landmark.type === "underground-ruin" ||
      landmark.type === "nexus-ruin" ||
      landmark.type === "endgame-ruin" ||
      landmark.type === "sunken-ruin" ||
      landmark.type === "cave"
    ) {
      const base = terrainHeight(seedText, landmark.x, landmark.z) + 1;
      for (let x = -5; x <= 5; x += 5)
        for (let z = -4; z <= 4; z += 4)
          for (let y = 0; y < 3 + ((x + z + 12) % 4); y += 1)
            setWorld(landmark.x + x, base + y, landmark.z + z, BlockId.Slate);
      if (landmark.type === "endgame-ruin")
        setWorld(landmark.x, base + 1, landmark.z, BlockId.CoreFragment);
      else if (landmark.type === "sunken-ruin")
        setWorld(landmark.x, base + 1, landmark.z, BlockId.Tideglass);
      else {
        setWorld(landmark.x, base + 1, landmark.z, BlockId.OldComponent);
        setWorld(landmark.x + 2, base + 1, landmark.z, BlockId.OldComponent);
      }
    } else if (landmark.type === "camp") {
      house(landmark.x, landmark.z, 5, 4);
      const base = terrainHeight(seedText, landmark.x, landmark.z) + 2;
      setWorld(landmark.x, base, landmark.z, BlockId.OldComponent);
    } else {
      house(landmark.x, landmark.z);
      if (landmark.type === "abandoned-home") {
        const base = terrainHeight(seedText, landmark.x, landmark.z) + 2;
        setWorld(landmark.x, base, landmark.z, BlockId.OldComponent);
      }
    }
  }
}

export function generateChunk(
  seedText: string,
  chunkX: number,
  chunkZ: number,
  modifications: readonly ChunkModification[] = [],
): ChunkData {
  const blocks = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
  const seed = hashSeed(seedText);
  const seaLevel = SEA_LEVEL;

  for (let z = 0; z < CHUNK_SIZE; z += 1) {
    for (let x = 0; x < CHUNK_SIZE; x += 1) {
      const worldX = chunkX * CHUNK_SIZE + x;
      const worldZ = chunkZ * CHUNK_SIZE + z;
      const height = terrainHeight(seedText, worldX, worldZ);
      const biome = getBiomeAt(seedText, worldX, worldZ);
      const sandy =
        biome.id === "beach" || biome.id === "ocean" || biome.id === "desert";
      for (let y = 0; y < WORLD_HEIGHT; y += 1) {
        let id: BlockIdValue = BlockId.Air;
        if (y <= height) {
          if (y < height - 4 && isCave(seed, worldX, y, worldZ))
            id = BlockId.Air;
          else if (y === height) id = biome.surface;
          else if (y > height - 4) id = sandy ? BlockId.Dune : BlockId.Loam;
          else {
            const ore = random2(seed ^ Math.imul(y, 541), worldX, worldZ, 509);
            id =
              ore > 0.993
                ? BlockId.DuskShardOre
                : ore > 0.989
                  ? BlockId.SunShardOre
                  : ore > 0.986
                    ? BlockId.GlowCrystal
                    : ore > 0.955
                      ? BlockId.CopperBloom
                      : BlockId.Slate;
          }
        } else if (y <= seaLevel) id = BlockId.Water;
        blocks[voxelIndex(x, y, z)] = id;
      }

      const treeChance = random2(seed, worldX, worldZ, 613);
      const resourceChance = random2(seed, worldX, worldZ, 977);
      if (
        biome.id === "dense-forest" &&
        resourceChance > 0.965 &&
        height + 1 < WORLD_HEIGHT
      )
        blocks[voxelIndex(x, height + 1, z)] = BlockId.ResonantPlant;
      if (biome.id === "ocean" && resourceChance > 0.94)
        blocks[voxelIndex(x, height, z)] = BlockId.Tideglass;
      if (
        biome.treeDensity > 0 &&
        height + 6 < WORLD_HEIGHT &&
        treeChance > 1 - biome.treeDensity &&
        x > 2 &&
        x < 13 &&
        z > 2 &&
        z < 13
      ) {
        for (let y = height + 1; y <= height + 4; y += 1)
          blocks[voxelIndex(x, y, z)] = BlockId.Timber;
        for (let oz = -2; oz <= 2; oz += 1)
          for (let ox = -2; ox <= 2; ox += 1)
            for (let oy = 3; oy <= 6; oy += 1) {
              if (Math.abs(ox) + Math.abs(oz) + Math.max(0, oy - 5) <= 4)
                blocks[voxelIndex(x + ox, height + oy, z + oz)] =
                  BlockId.Canopy;
            }
      }
    }
  }

  applyLandmarkBlocks(seedText, chunkX, chunkZ, blocks);

  for (const [index, blockId] of modifications)
    if (index >= 0 && index < blocks.length) blocks[index] = blockId;
  return { x: chunkX, z: chunkZ, blocks, revision: 0 };
}

const faces = [
  {
    normal: [1, 0, 0],
    corners: [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
    ],
    shade: 0.82,
  },
  {
    normal: [-1, 0, 0],
    corners: [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
      [0, 0, 0],
    ],
    shade: 0.7,
  },
  {
    normal: [0, 1, 0],
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
    shade: 1.05,
  },
  {
    normal: [0, -1, 0],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    shade: 0.58,
  },
  {
    normal: [0, 0, 1],
    corners: [
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
      [0, 0, 1],
    ],
    shade: 0.9,
  },
  {
    normal: [0, 0, -1],
    corners: [
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ],
    shade: 0.76,
  },
] as const;

export type WorldBlockLookup = (
  x: number,
  y: number,
  z: number,
) => BlockIdValue;

export function buildChunkMesh(
  chunk: ChunkData,
  lookup?: WorldBlockLookup,
): ChunkMeshData {
  const positions: number[] = [],
    normals: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const originX = chunk.x * CHUNK_SIZE,
    originZ = chunk.z * CHUNK_SIZE;
  for (let y = 0; y < WORLD_HEIGHT; y += 1)
    for (let z = 0; z < CHUNK_SIZE; z += 1)
      for (let x = 0; x < CHUNK_SIZE; x += 1) {
        const id = getChunkBlock(chunk, x, y, z);
        if (id === BlockId.Air) continue;
        const definition = getBlockDefinition(id);
        for (const face of faces) {
          const nx = face.normal[0],
            ny = face.normal[1],
            nz = face.normal[2];
          const adjacent = lookup
            ? lookup(originX + x + nx, y + ny, originZ + z + nz)
            : getChunkBlock(chunk, x + nx, y + ny, z + nz);
          const adjacentDefinition = getBlockDefinition(adjacent);
          if (
            (adjacent === id && definition.transparent) ||
            (adjacent !== BlockId.Air && !adjacentDefinition.transparent)
          )
            continue;
          const base = positions.length / 3;
          const variation =
            0.92 + (hash32(voxelIndex(x, y, z) ^ (id * 101)) % 13) / 100;
          for (const corner of face.corners) {
            positions.push(
              originX + x + corner[0],
              y + corner[1],
              originZ + z + corner[2],
            );
            normals.push(nx, ny, nz);
            colors.push(
              Math.min(1, definition.color[0] * face.shade * variation),
              Math.min(1, definition.color[1] * face.shade * variation),
              Math.min(1, definition.color[2] * face.shade * variation),
            );
          }
          indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
    indices: new Uint32Array(indices),
    triangles: indices.length / 3,
  };
}
