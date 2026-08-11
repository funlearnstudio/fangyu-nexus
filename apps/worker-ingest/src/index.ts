import type { Provenance } from "@fangyu/domain";

export interface SourceAdapter<TExternal, TNormalized> {
  fetchSince(cursor?: string): Promise<{
    records: TExternal[];
    nextCursor?: string;
  }>;
  fetchById(id: string): Promise<TExternal | null>;
  normalize(record: TExternal): TNormalized;
  validate(record: TNormalized): Promise<void>;
  provenance(record: TExternal): Provenance;
}

export interface AdapterRuntimePolicy {
  timeoutMs: number;
  retryBudget: number;
  quotaBudgetPerMinute: number;
  schemaVersion: string;
}

export const MODRINTH_ADAPTER_STATUS = {
  status: "skeleton",
  authentication: "not-configured",
  dataMode: "fixtures-only",
  note: "No external API data is presented as production data.",
} as const;
