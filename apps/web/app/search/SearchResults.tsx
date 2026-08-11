"use client";

import { buildSearchIndex } from "@fangyu/domain";
import { Card, StatePanel } from "@fangyu/ui";
import Link from "next/link";
import { usePortal } from "@/app/providers";

const index = buildSearchIndex();

export function SearchResults({ query }: { query: string }) {
  const { edition, gameVersion } = usePortal();
  const normalized = query.trim().toLocaleLowerCase();
  const results = index
    .filter(
      (entry) =>
        entry.edition === edition && entry.gameVersionId === gameVersion.id,
    )
    .filter((entry) =>
      (entry.title + " " + entry.subtitle)
        .toLocaleLowerCase()
        .includes(normalized),
    );

  return results.length ? (
    <div className="catalog-grid">
      {results.map((result) => (
        <Link href={result.href} key={result.id}>
          <Card className="item-card">
            <span className="eyebrow">{result.type}</span>
            <h2>{result.title}</h2>
            <p>{result.subtitle}</p>
            <small className="mono">{result.source.sourceKey}</small>
          </Card>
        </Link>
      ))}
    </div>
  ) : (
    <StatePanel state="empty" title="沒有相符資料">
      目前只搜尋明確標示的 fixture。切換 Edition／Version 後會重新過濾。
    </StatePanel>
  );
}
