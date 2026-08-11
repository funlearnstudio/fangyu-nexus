import { NextResponse } from "next/server";
import {
  GENERATION_VERSION,
  type BlockIdValue,
  type ChunkModification,
} from "@fangyu/voxel-engine";
import { getOwnerId } from "@/lib/server/game-auth";
import { getChunkDelta, saveChunkDelta } from "@/lib/server/world-store";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; x: string; z: string }> };

function coordinates(params: { x: string; z: string }) {
  const x = Number(params.x),
    z = Number(params.z);
  return Number.isInteger(x) &&
    Number.isInteger(z) &&
    Math.abs(x) <= 1_000_000 &&
    Math.abs(z) <= 1_000_000
    ? { x, z }
    : null;
}

export async function GET(_: Request, context: Context) {
  const ownerId = await getOwnerId();
  if (!ownerId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const params = await context.params,
    point = coordinates(params);
  if (!point)
    return NextResponse.json({ error: "invalid_coordinates" }, { status: 400 });
  const chunk = await getChunkDelta(ownerId, params.id, point.x, point.z);
  if (chunk === undefined)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ chunk });
}

export async function PUT(request: Request, context: Context) {
  const ownerId = await getOwnerId();
  if (!ownerId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const params = await context.params,
    point = coordinates(params),
    body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
  if (
    !point ||
    !body ||
    !Array.isArray(body.modifiedBlocks) ||
    body.modifiedBlocks.length > 16_384
  )
    return NextResponse.json({ error: "invalid_chunk" }, { status: 400 });
  const modifiedBlocks: ChunkModification[] = [];
  for (const entry of body.modifiedBlocks) {
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      !Number.isInteger(entry[0]) ||
      entry[0] < 0 ||
      entry[0] >= 16 * 64 * 16 ||
      !Number.isInteger(entry[1]) ||
      entry[1] < 0 ||
      entry[1] > 9
    )
      return NextResponse.json({ error: "invalid_delta" }, { status: 400 });
    modifiedBlocks.push([entry[0], entry[1] as BlockIdValue]);
  }
  const result = await saveChunkDelta(
    ownerId,
    params.id,
    {
      chunkX: point.x,
      chunkZ: point.z,
      generationVersion: GENERATION_VERSION,
      chunkVersion: Number(body.chunkVersion) || 1,
      modifiedBlocks,
      entities: [],
      revision: Number(body.revision) || 0,
    },
    typeof body.expectedRevision === "number"
      ? body.expectedRevision
      : undefined,
  );
  if (result === null)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (result === "conflict")
    return NextResponse.json({ error: "revision_conflict" }, { status: 409 });
  return NextResponse.json({ chunk: result });
}
