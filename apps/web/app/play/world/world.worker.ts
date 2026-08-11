/// <reference lib="webworker" />

import {
  buildChunkMesh,
  generateChunk,
  type ChunkModification,
} from "@fangyu/voxel-engine";

interface GenerateRequest {
  type: "generate";
  requestId: number;
  seed: string;
  chunkX: number;
  chunkZ: number;
  modifications: ChunkModification[];
}

self.onmessage = (event: MessageEvent<GenerateRequest>) => {
  const request = event.data;
  if (request.type !== "generate") return;
  const chunk = generateChunk(
    request.seed,
    request.chunkX,
    request.chunkZ,
    request.modifications,
  );
  const mesh = buildChunkMesh(chunk);
  self.postMessage(
    {
      type: "generated",
      requestId: request.requestId,
      chunkX: request.chunkX,
      chunkZ: request.chunkZ,
      revision: chunk.revision,
      blocks: chunk.blocks.buffer,
      positions: mesh.positions.buffer,
      normals: mesh.normals.buffer,
      colors: mesh.colors.buffer,
      indices: mesh.indices.buffer,
      triangles: mesh.triangles,
    },
    {
      transfer: [
        chunk.blocks.buffer,
        mesh.positions.buffer,
        mesh.normals.buffer,
        mesh.colors.buffer,
        mesh.indices.buffer,
      ],
    },
  );
};

export {};
