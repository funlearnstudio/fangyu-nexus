export type QuarantineStatus =
  | "quarantined"
  | "metadata_valid"
  | "rejected"
  | "ready_for_isolated_worker";

export interface FileValidationPolicy {
  maxBytes: number;
  maxDecompressedBytes: number;
  timeoutMs: number;
  allowedExtensions: string[];
}

export interface FileValidationResult {
  status: QuarantineStatus;
  reason: string;
  detectedFormat?: "gzip" | "zip" | "nbt" | "unknown";
}

export const DEFAULT_FILE_POLICY: FileValidationPolicy = {
  maxBytes: 10 * 1024 * 1024,
  maxDecompressedBytes: 50 * 1024 * 1024,
  timeoutMs: 5000,
  allowedExtensions: [".nbt", ".litematic", ".schematic", ".zip"],
};

export function validateMagicBytes(bytes: Uint8Array): FileValidationResult {
  if (bytes.length < 2) {
    return { status: "rejected", reason: "File is too short." };
  }

  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    return {
      status: "ready_for_isolated_worker",
      reason: "Gzip container detected; deep parsing remains quarantined.",
      detectedFormat: "gzip",
    };
  }

  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return {
      status: "ready_for_isolated_worker",
      reason: "ZIP container detected; decompression requires isolated worker.",
      detectedFormat: "zip",
    };
  }

  if (bytes[0] === 0x0a) {
    return {
      status: "ready_for_isolated_worker",
      reason: "Possible uncompressed NBT; deep parsing remains quarantined.",
      detectedFormat: "nbt",
    };
  }

  return {
    status: "rejected",
    reason: "Magic bytes do not match an allowed Phase 1 format.",
    detectedFormat: "unknown",
  };
}
