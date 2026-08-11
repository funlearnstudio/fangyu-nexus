import { z } from "zod";

export const editionSchema = z.enum(["java", "bedrock"]);
export const releaseChannelSchema = z.enum([
  "release",
  "snapshot",
  "preview",
  "historical",
]);

export const scopeSchema = z.object({
  edition: editionSchema,
  gameVersionId: z.string().min(1).max(80),
});

export const searchQuerySchema = scopeSchema.extend({
  q: z.string().trim().max(120).default(""),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const craftingRequestSchema = scopeSchema.extend({
  outputItemId: z.string().min(1).max(160),
  targetQuantity: z.number().int().min(1).max(100000),
  inventory: z.record(z.string(), z.number().int().min(0)).default({}),
});

export const pingTargetSchema = z.object({
  host: z.string().trim().min(1).max(253),
  port: z.number().int().min(1).max(65535),
  edition: editionSchema,
});

export const uploadMetadataSchema = z.object({
  fileName: z.string().min(1).max(255),
  byteLength: z.number().int().min(1),
  mimeType: z.string().min(1).max(160),
  declaredType: z.enum(["nbt", "litematic", "schematic", "datapack", "zip"]),
});

export type CraftingRequest = z.infer<typeof craftingRequestSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type PingTarget = z.infer<typeof pingTargetSchema>;
export type UploadMetadata = z.infer<typeof uploadMetadataSchema>;
