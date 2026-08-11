import type { PingTarget } from "@fangyu/contracts";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";

export interface PingTargetValidation {
  allowed: boolean;
  reason: string;
  addresses: string[];
}

export interface TargetValidationDependencies {
  resolve?: (host: string) => Promise<string[]>;
  allowedPorts?: number[];
}

const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".home",
  ".lan",
];

function configuredPorts(): number[] {
  const raw = process.env.PING_ALLOWED_PORTS ?? "25565,19132";
  return raw
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0 && value < 65536);
}

export function isPublicAddress(address: string): boolean {
  try {
    const parsed = ipaddr.parse(address);
    const normalized =
      parsed.kind() === "ipv6" && (parsed as ipaddr.IPv6).isIPv4MappedAddress()
        ? (parsed as ipaddr.IPv6).toIPv4Address()
        : parsed;
    return normalized.range() === "unicast";
  } catch {
    return false;
  }
}

async function defaultResolve(host: string): Promise<string[]> {
  if (isIP(host)) {
    return [host];
  }
  const records = await lookup(host, { all: true, verbatim: true });
  return [...new Set(records.map((record) => record.address))];
}

export async function validatePingTarget(
  target: PingTarget,
  dependencies: TargetValidationDependencies = {},
): Promise<PingTargetValidation> {
  const host = target.host.trim().replace(/\.$/, "").toLocaleLowerCase();
  const allowedPorts = dependencies.allowedPorts ?? configuredPorts();

  if (!allowedPorts.includes(target.port)) {
    return {
      allowed: false,
      reason: "Port is outside the configured Minecraft allowlist.",
      addresses: [],
    };
  }

  if (
    host === "localhost" ||
    host.length > 253 ||
    host.includes("/") ||
    host.includes("\\") ||
    host.includes("@") ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  ) {
    return {
      allowed: false,
      reason: "Host is local, malformed, or explicitly blocked.",
      addresses: [],
    };
  }

  if (!isIP(host) && !host.includes(".")) {
    return {
      allowed: false,
      reason: "Single-label hostnames are not allowed.",
      addresses: [],
    };
  }

  let addresses: string[];
  try {
    addresses = await (dependencies.resolve ?? defaultResolve)(host);
  } catch {
    return {
      allowed: false,
      reason: "DNS resolution failed.",
      addresses: [],
    };
  }

  if (addresses.length === 0 || addresses.length > 8) {
    return {
      allowed: false,
      reason: "DNS returned an unsafe number of addresses.",
      addresses: [],
    };
  }

  if (addresses.some((address) => !isPublicAddress(address))) {
    return {
      allowed: false,
      reason: "Target resolves to a private or reserved address.",
      addresses: [],
    };
  }

  return {
    allowed: true,
    reason:
      "Target resolved to public addresses. Workers must connect to these pinned addresses only.",
    addresses,
  };
}
