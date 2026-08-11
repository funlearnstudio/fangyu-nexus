import { NextResponse } from "next/server";
import { getOwnerId } from "@/lib/server/game-auth";
import {
  deleteOwnedWorld,
  getOwnedWorld,
  patchOwnedWorld,
} from "@/lib/server/world-store";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

async function ownerOrUnauthorized() {
  return getOwnerId();
}

export async function GET(_: Request, context: Context) {
  const ownerId = await ownerOrUnauthorized();
  if (!ownerId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const world = await getOwnedWorld(ownerId, (await context.params).id);
  if (!world) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ world });
}

export async function PATCH(request: Request, context: Context) {
  const ownerId = await ownerOrUnauthorized();
  if (!ownerId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body)
    return NextResponse.json({ error: "invalid_patch" }, { status: 400 });
  const patch: { name?: string; timeOfDay?: number; lastPlayedAt?: string } =
    {};
  if (
    typeof body.name === "string" &&
    body.name.trim() &&
    body.name.length <= 80
  )
    patch.name = body.name.trim();
  if (
    typeof body.timeOfDay === "number" &&
    body.timeOfDay >= 0 &&
    body.timeOfDay <= 1
  )
    patch.timeOfDay = body.timeOfDay;
  if (typeof body.lastPlayedAt === "string")
    patch.lastPlayedAt = body.lastPlayedAt;
  const result = await patchOwnedWorld(
    ownerId,
    (await context.params).id,
    patch,
    typeof body.revision === "number" ? body.revision : undefined,
  );
  if (!result)
    return NextResponse.json(
      { error: "not_found_or_revision_conflict" },
      { status: 409 },
    );
  return NextResponse.json({ world: result });
}

export async function DELETE(_: Request, context: Context) {
  const ownerId = await ownerOrUnauthorized();
  if (!ownerId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const deleted = await deleteOwnedWorld(ownerId, (await context.params).id);
  return deleted
    ? new NextResponse(null, { status: 204 })
    : NextResponse.json({ error: "not_found" }, { status: 404 });
}
