import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { uploadMetadataSchema } from "@fangyu/contracts";
import { DEFAULT_FILE_POLICY } from "@fangyu/parsers-wasm";
import { randomUUID } from "node:crypto";

@Controller("uploads")
export class UploadsController {
  @Post("quarantine")
  quarantine(@Body() body: unknown) {
    const parsed = uploadMetadataSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const maxBytes = Number(
      process.env.UPLOAD_MAX_BYTES ?? DEFAULT_FILE_POLICY.maxBytes,
    );
    if (parsed.data.byteLength > maxBytes) {
      throw new BadRequestException("File exceeds the quarantine size limit.");
    }

    return {
      data: {
        uploadId: randomUUID(),
        status: "quarantined",
        metadata: parsed.data,
        nextStep: "isolated-worker-magic-byte-validation",
        expiresInSeconds: 900,
      },
      limits: {
        maxBytes,
        maxDecompressedBytes: Number(
          process.env.UPLOAD_MAX_DECOMPRESSED_BYTES ??
            DEFAULT_FILE_POLICY.maxDecompressedBytes,
        ),
        timeoutMs: Number(
          process.env.UPLOAD_VALIDATION_TIMEOUT_MS ??
            DEFAULT_FILE_POLICY.timeoutMs,
        ),
      },
    };
  }
}
