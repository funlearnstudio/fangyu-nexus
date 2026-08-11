import { NextResponse } from "next/server";
import type { GameMode, Inventory } from "@fangyu/voxel-engine";
import { getOwnerId } from "@/lib/server/game-auth";
import { getPlayerState, savePlayerState } from "@/lib/server/world-store";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const ownerId = await getOwnerId();
  if (!ownerId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const state = await getPlayerState(ownerId, (await context.params).id);
  if (state === undefined)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ state });
}

export async function POST(request: Request, context: Context) {
  const ownerId = await getOwnerId();
  if (!ownerId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body)
    return NextResponse.json(
      { error: "invalid_player_state" },
      { status: 400 },
    );
  const position = body?.position,
    rotation = body?.rotation,
    inventory = body?.inventory;
  if (
    !Array.isArray(position) ||
    position.length !== 3 ||
    !position.every(Number.isFinite) ||
    !Array.isArray(rotation) ||
    rotation.length !== 2 ||
    !rotation.every(Number.isFinite) ||
    !Array.isArray(inventory) ||
    inventory.length > 36
  )
    return NextResponse.json(
      { error: "invalid_player_state" },
      { status: 400 },
    );
  const result = await savePlayerState(
    ownerId,
    (await context.params).id,
    {
      position: position as [number, number, number],
      rotation: rotation as [number, number],
      health: Math.max(0, Math.min(20, Number(body.health) || 0)),
      hunger: Math.max(0, Math.min(20, Number(body.hunger) || 0)),
      inventory: inventory as Inventory,
      selectedSlot: Math.max(0, Math.min(8, Number(body.selectedSlot) || 0)),
      gameMode: (body.gameMode === "creative"
        ? "creative"
        : "survival") as GameMode,
      spawnPoint:
        Array.isArray(body.spawnPoint) && body.spawnPoint.length === 3
          ? (body.spawnPoint as [number, number, number])
          : [0.5, 38, 0.5],
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
  return NextResponse.json({ state: result });
}
