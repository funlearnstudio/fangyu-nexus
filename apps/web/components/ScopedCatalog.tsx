"use client";

import { BIOMES, MOBS, SERVERS, STRUCTURES } from "@fangyu/domain";
import { Card, EditionBadge, StatePanel, VersionBadge } from "@fangyu/ui";
import Link from "next/link";
import { usePortal } from "@/app/providers";

type CatalogKind = "mobs" | "biomes" | "structures" | "servers";

export function ScopedCatalog({ kind }: { kind: CatalogKind }) {
  const { edition, gameVersion } = usePortal();
  const entries =
    kind === "mobs"
      ? MOBS.filter(
          (entry) =>
            entry.edition === edition && entry.gameVersionId === gameVersion.id,
        )
      : kind === "biomes"
        ? BIOMES.filter(
            (entry) =>
              entry.edition === edition &&
              entry.gameVersionId === gameVersion.id,
          )
        : kind === "structures"
          ? STRUCTURES.filter(
              (entry) =>
                entry.edition === edition &&
                entry.gameVersionId === gameVersion.id,
            )
          : SERVERS.filter((entry) => entry.edition === edition);

  return (
    <>
      <div className="catalog-toolbar">
        <EditionBadge edition={edition} />
        <VersionBadge version={gameVersion.name} />
      </div>
      {entries.length ? (
        <div className="catalog-grid">
          {entries.map((entry) => {
            const href =
              kind === "mobs"
                ? "/mobs/" + entry.slug
                : kind === "servers"
                  ? "/servers/" + entry.slug
                  : "/" + kind + "?focus=" + entry.slug;
            const summary =
              "summary" in entry
                ? entry.summary
                : "region" in entry
                  ? entry.region + " · " + entry.status
                  : "Fixture entry";
            return (
              <Link href={href} key={entry.id}>
                <Card className="item-card">
                  <div className="item-icon" aria-hidden="true">
                    {kind.slice(0, 1).toUpperCase()}
                  </div>
                  <h2>{entry.name}</h2>
                  <span className="namespace-id">{entry.slug}</span>
                  <p>{summary}</p>
                  <div className="item-meta">
                    <small>DEMO FIXTURE</small>
                    <span aria-hidden="true">→</span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <StatePanel state="empty" title="這個 Context 尚無 fixture">
          內容不會從另一個 Edition 自動借來。請切換版別，或等待正式 ingestion
          adapter。
        </StatePanel>
      )}
    </>
  );
}
