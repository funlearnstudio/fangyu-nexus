import { describe, expect, it } from "vitest";
import { isPublicAddress, validatePingTarget } from "./index";

describe("server ping target validation", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "192.168.1.10",
    "::1",
    "fc00::1",
    "fe80::1",
  ])("blocks private or metadata address %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it("accepts a pinned public result on an allowed port", async () => {
    const result = await validatePingTarget(
      { host: "play.example.com", port: 25565, edition: "java" },
      {
        resolve: async () => ["203.0.113.25"],
        allowedPorts: [25565],
      },
    );
    expect(result.allowed).toBe(false);
  });

  it("accepts a globally routable address", async () => {
    const result = await validatePingTarget(
      { host: "play.example.com", port: 25565, edition: "java" },
      {
        resolve: async () => ["8.8.8.8"],
        allowedPorts: [25565],
      },
    );
    expect(result.allowed).toBe(true);
    expect(result.addresses).toEqual(["8.8.8.8"]);
  });

  it("blocks arbitrary ports before DNS", async () => {
    const result = await validatePingTarget(
      { host: "play.example.com", port: 22, edition: "java" },
      {
        resolve: async () => ["8.8.8.8"],
        allowedPorts: [25565],
      },
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("allowlist");
  });

  it("blocks DNS rebinding to private space", async () => {
    const result = await validatePingTarget(
      { host: "play.example.com", port: 25565, edition: "java" },
      {
        resolve: async () => ["8.8.8.8", "127.0.0.1"],
        allowedPorts: [25565],
      },
    );
    expect(result.allowed).toBe(false);
  });
});
