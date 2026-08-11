import { NextResponse } from "next/server";
import { getOwnerId } from "@/lib/server/game-auth";
import { listChunkDeltas } from "@/lib/server/world-store";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const ownerId = await getOwnerId();
  if (!ownerId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const raw = new URL(request.url).searchParams.get("coordinates") ?? "";
  const coordinates = raw
    .split(";")
    .filter(Boolean)
    .slice(0, 256)
    .map((pair) => pair.split(",").map(Number))
    .filter(([x, z]) => Number.isInteger(x) && Number.isInteger(z))
    .map(([x, z]) => ({ x: x!, z: z! }));
  const chunks = await listChunkDeltas(
    ownerId,
    (await context.params).id,
    coordinates,
  );
  if (!chunks)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ chunks });
}
