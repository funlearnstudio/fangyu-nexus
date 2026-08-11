"use client";

import { buildSearchIndex } from "@fangyu/domain";
import Link from "next/link";
import { useMemo, useState } from "react";
import { usePortal } from "@/app/providers";

const searchIndex = buildSearchIndex();

export function GlobalSearch({ compact = false }: { compact?: boolean }) {
  const { edition, gameVersion, language } = usePortal();
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase();
  const results = useMemo(
    () =>
      normalized
        ? searchIndex
            .filter(
              (entry) =>
                entry.edition === edition &&
                entry.gameVersionId === gameVersion.id,
            )
            .filter((entry) =>
              (entry.title + " " + entry.subtitle)
                .toLocaleLowerCase()
                .includes(normalized),
            )
            .slice(0, 6)
        : [],
    [edition, gameVersion.id, normalized],
  );

  return (
    <div className={compact ? "global-search compact" : "global-search"}>
      <form action="/search" role="search">
        <label
          className="sr-only"
          htmlFor={compact ? "nav-search" : "hero-search"}
        >
          {language === "zh-TW" ? "搜尋全站" : "Search the portal"}
        </label>
        <span aria-hidden="true" className="search-glyph">
          ◈
        </span>
        <input
          id={compact ? "nav-search" : "hero-search"}
          name="q"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={
            language === "zh-TW"
              ? "搜尋物品、ID、生物、群系…"
              : "Search items, IDs, mobs, biomes…"
          }
        />
        <input type="hidden" name="edition" value={edition} />
        <input type="hidden" name="version" value={gameVersion.id} />
        <kbd>/</kbd>
      </form>
      {normalized ? (
        <div className="search-results" role="listbox" aria-label="搜尋結果">
          <div className="search-context">
            {edition === "java" ? "Java" : "Bedrock"} · {gameVersion.name}
          </div>
          {results.length > 0 ? (
            results.map((result) => (
              <Link
                href={result.href}
                key={result.id}
                className="search-result"
                onClick={() => setQuery("")}
              >
                <span className="result-type">{result.type}</span>
                <span>
                  <strong>{result.title}</strong>
                  <small>{result.subtitle}</small>
                </span>
              </Link>
            ))
          ) : (
            <p className="search-empty">這個版別／版本沒有相符的 fixture。</p>
          )}
          <Link
            className="search-all"
            href={
              "/search?q=" +
              encodeURIComponent(query) +
              "&edition=" +
              edition +
              "&version=" +
              encodeURIComponent(gameVersion.id)
            }
          >
            查看完整搜尋結果 →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
