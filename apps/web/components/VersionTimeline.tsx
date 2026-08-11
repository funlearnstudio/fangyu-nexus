"use client";

import { GAME_VERSIONS } from "@fangyu/domain";
import { Badge, Card } from "@fangyu/ui";
import { usePortal } from "@/app/providers";

export function VersionTimeline() {
  const { edition } = usePortal();
  const versions = GAME_VERSIONS.filter(
    (version) => version.edition === edition,
  );
  return (
    <div className="timeline">
      {versions.map((version) => (
        <Card className="timeline-entry" key={version.id}>
          <span className="timeline-node" aria-hidden="true" />
          <div>
            <Badge tone="warning">DEMO VERSION</Badge>
            <h2>{version.name}</h2>
            <p>
              {version.edition.toUpperCase()} · {version.channel} ·{" "}
              {version.releasedAt}
            </p>
            <small>
              Fixture-only version record. Official release ingestion is not
              configured.
            </small>
          </div>
        </Card>
      ))}
    </div>
  );
}
