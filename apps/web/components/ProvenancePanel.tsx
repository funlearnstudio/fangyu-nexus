import type { Provenance } from "@fangyu/domain";
import { SourceBadge } from "@fangyu/ui";

export function ProvenancePanel({ source }: { source: Provenance }) {
  return (
    <section className="provenance-panel" aria-label="資料來源">
      <div>
        <span className="eyebrow">SOURCE / PROVENANCE</span>
        <h2>這筆資料從哪裡來？</h2>
      </div>
      <SourceBadge label={source.label} isDemo={source.isDemo} />
      <dl>
        <div>
          <dt>Source key</dt>
          <dd>{source.sourceKey}</dd>
        </div>
        <div>
          <dt>Fetched</dt>
          <dd>{source.fetchedAt}</dd>
        </div>
        <div>
          <dt>Checksum</dt>
          <dd className="checksum">{source.checksum}</dd>
        </div>
      </dl>
      <p>{source.note}</p>
    </section>
  );
}
