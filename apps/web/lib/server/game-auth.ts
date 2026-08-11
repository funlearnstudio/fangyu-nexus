import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { signOwnerValue, verifyOwnerValue } from "./game-auth-core";

const COOKIE_NAME = "fangyu_game_owner";

function secret(): string {
  const configured = process.env.AUTH_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production")
    throw new Error("AUTH_SECRET_REQUIRED");
  return "fangyu-local-development-owner-cookie-only";
}

export async function getOwnerId(): Promise<string | null> {
  return verifyOwnerValue((await cookies()).get(COOKIE_NAME)?.value, secret());
}

export function issueOwner(
  response: NextResponse,
  existingOwnerId?: string,
): string {
  const ownerId = existingOwnerId ?? randomUUID();
  response.cookies.set(COOKIE_NAME, signOwnerValue(ownerId, secret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return ownerId;
}
