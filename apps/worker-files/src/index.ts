import { createLogger } from "@fangyu/observability";
import { validateMagicBytes } from "@fangyu/parsers-wasm";

const logger = createLogger("worker-files");

export function validateQuarantinedPrefix(base64Prefix: string) {
  const prefix = Uint8Array.from(Buffer.from(base64Prefix, "base64"));
  return validateMagicBytes(prefix);
}

logger.info(
  "File worker package loaded. Deep parsing remains disabled until an isolated container profile is enabled.",
);
