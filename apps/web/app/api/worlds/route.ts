import { NextResponse } from "next/server";
import { getOwnerId, issueOwner } from "@/lib/server/game-auth";
import { isMongoConfigured } from "@/lib/server/mongodb";
import {
  createWorld,
  getOwnedWorld,
  listWorlds,
} from "@/lib/server/world-store";

export const runtime = "nodejs";

export async function GET() {
  if (!isMongoConfigured())
    return NextResponse.json({ available: false, worlds: [] }, { status: 503 });
  const ownerId = await getOwnerId();
  if (!ownerId) return NextResponse.json({ available: true, worlds: [] });
  return NextResponse.json({
    available: true,
    worlds: await listWorlds(ownerId),
  });
}

export async function POST(request: Request) {
  if (!isMongoConfigured())
    return NextResponse.json(
      { error: "cloud_persistence_unavailable" },
      { status: 503 },
    );
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (
    !body ||
    typeof body.name !== "string" ||
    body.name.trim().length < 1 ||
    body.name.length > 80 ||
    typeof body.seed !== "string" ||
    body.seed.length > 128 ||
    !["creative", "survival"].includes(String(body.gameMode)) ||
    !["java", "bedrock"].includes(String(body.edition))
  ) {
    return NextResponse.json({ error: "invalid_world" }, { status: 400 });
  }
  const response = NextResponse.json({ ok: true });
  const ownerId = (await getOwnerId()) ?? issueOwner(response);
  const clientId =
    typeof body.clientId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      body.clientId,
    )
      ? body.clientId
      : undefined;
  if (clientId) {
    const existing = await getOwnedWorld(ownerId, clientId);
    if (existing) {
      const existingResponse = NextResponse.json({ ok: true, world: existing });
      for (const cookie of response.cookies.getAll())
        existingResponse.cookies.set(cookie);
      return existingResponse;
    }
  }
  const world = await createWorld(ownerId, {
    ...(clientId ? { id: clientId } : {}),
    name: body.name.trim(),
    seed: body.seed || crypto.randomUUID(),
    gameMode: body.gameMode as "creative" | "survival",
    edition: body.edition as "java" | "bedrock",
    gameVersion:
      typeof body.gameVersion === "string" ? body.gameVersion : "original-1",
    renderDistance: Number.isInteger(body.renderDistance)
      ? Math.max(2, Math.min(8, Number(body.renderDistance)))
      : 3,
  });
  const finalResponse = NextResponse.json({ ok: true, world });
  for (const cookie of response.cookies.getAll())
    finalResponse.cookies.set(cookie);
  return finalResponse;
}
