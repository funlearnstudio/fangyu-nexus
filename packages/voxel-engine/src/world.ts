import { BlockId, type BlockIdValue, getBlockDefinition } from "./blocks";

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 64;
export const GENERATION_VERSION = 1;

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

export function terrainHeight(
  seedText: string,
  worldX: number,
  worldZ: number,
): number {
  const seed = hashSeed(seedText);
  const broad = valueNoise(seed, worldX, worldZ, 48, 101);
  const detail = valueNoise(seed, worldX, worldZ, 13, 211);
  return Math.max(
    8,
    Math.min(WORLD_HEIGHT - 10, Math.floor(14 + broad * 18 + detail * 5)),
  );
}

function isCave(seed: number, x: number, y: number, z: number): boolean {
  const a = valueNoise(seed ^ Math.imul(y, 911), x, z, 10, 307);
  const b = random2(seed ^ Math.imul(y, 1597), x, z, 401);
  return y > 3 && a > 0.72 && b > 0.68;
}

export function generateChunk(
  seedText: string,
  chunkX: number,
  chunkZ: number,
  modifications: readonly ChunkModification[] = [],
): ChunkData {
  const blocks = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
  const seed = hashSeed(seedText);
  const seaLevel = 19;

  for (let z = 0; z < CHUNK_SIZE; z += 1) {
    for (let x = 0; x < CHUNK_SIZE; x += 1) {
      const worldX = chunkX * CHUNK_SIZE + x;
      const worldZ = chunkZ * CHUNK_SIZE + z;
      const height = terrainHeight(seedText, worldX, worldZ);
      const beach = height <= seaLevel + 1;
      for (let y = 0; y < WORLD_HEIGHT; y += 1) {
        let id: BlockIdValue = BlockId.Air;
        if (y <= height) {
          if (y < height - 4 && isCave(seed, worldX, y, worldZ))
            id = BlockId.Air;
          else if (y === height) id = beach ? BlockId.Dune : BlockId.Verdant;
          else if (y > height - 4) id = beach ? BlockId.Dune : BlockId.Loam;
          else {
            const ore = random2(seed ^ Math.imul(y, 541), worldX, worldZ, 509);
            id =
              ore > 0.986
                ? BlockId.GlowCrystal
                : ore > 0.955
                  ? BlockId.CopperBloom
                  : BlockId.Slate;
          }
        } else if (y <= seaLevel) id = BlockId.Water;
        blocks[voxelIndex(x, y, z)] = id;
      }

      const treeChance = random2(seed, worldX, worldZ, 613);
      if (
        !beach &&
        height + 6 < WORLD_HEIGHT &&
        treeChance > 0.992 &&
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
        if (id === BlockId.Air || id === BlockId.Water) continue;
        const definition = getBlockDefinition(id);
        for (const face of faces) {
          const nx = face.normal[0],
            ny = face.normal[1],
            nz = face.normal[2];
          const adjacent = lookup
            ? lookup(originX + x + nx, y + ny, originZ + z + nz)
            : getChunkBlock(chunk, x + nx, y + ny, z + nz);
          const adjacentDefinition = getBlockDefinition(adjacent);
          if (adjacent !== BlockId.Air && !adjacentDefinition.transparent)
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
