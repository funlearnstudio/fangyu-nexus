import { describe, expect, it } from "vitest";
import { signOwnerValue, verifyOwnerValue } from "./game-auth-core";

describe("private world owner cookie", () => {
  it("accepts the signed owner and rejects tampering or another secret", () => {
    const signed = signOwnerValue(
      "owner-a",
      "test-secret-at-least-32-characters",
    );
    expect(verifyOwnerValue(signed, "test-secret-at-least-32-characters")).toBe(
      "owner-a",
    );
    expect(
      verifyOwnerValue(
        signed.replace("owner-a", "owner-b"),
        "test-secret-at-least-32-characters",
      ),
    ).toBeNull();
    expect(
      verifyOwnerValue(signed, "different-secret-at-least-32-characters"),
    ).toBeNull();
  });
});
