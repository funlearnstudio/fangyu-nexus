import { createHmac, timingSafeEqual } from "node:crypto";

export function signOwnerValue(ownerId: string, secret: string): string {
  const signature = createHmac("sha256", secret)
    .update(ownerId)
    .digest("base64url");
  return `${ownerId}.${signature}`;
}

export function verifyOwnerValue(
  value: string | undefined,
  secret: string,
): string | null {
  if (!value) return null;
  const split = value.lastIndexOf(".");
  if (split <= 0) return null;
  const ownerId = value.slice(0, split);
  const supplied = Buffer.from(value.slice(split + 1));
  const expected = Buffer.from(
    signOwnerValue(ownerId, secret).slice(split + 1),
  );
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return null;
  return ownerId;
}
