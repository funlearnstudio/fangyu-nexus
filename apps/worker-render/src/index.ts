export interface RenderJob {
  id: string;
  kind: "skin-thumbnail" | "schematic-preview" | "map-tile";
  sourceObjectKey: string;
  maxPixels: number;
  timeoutMs: number;
}

export const RENDER_WORKER_STATUS = {
  status: "skeleton",
  supported: ["skin-thumbnail"],
  deferred: ["schematic-preview", "map-tile"],
  note: "Heavy rendering is never performed in a request handler.",
} as const;
