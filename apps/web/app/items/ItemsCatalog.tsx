"use client";

import { CATALOG_ITEMS } from "@fangyu/domain";
import { Card, EditionBadge, StatePanel, VersionBadge } from "@fangyu/ui";
import Link from "next/link";
import { useMemo, useState } from "react";
import { usePortal } from "@/app/providers";

export function ItemsCatalog() {
  const { edition, gameVersion } = usePortal();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const items = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return CATALOG_ITEMS.filter(
      (item) =>
        item.edition === edition &&
        item.gameVersionId === gameVersion.id &&
        (kind === "all" || item.kind === kind),
    ).filter((item) =>
      normalized
        ? [item.name, item.englishName, item.namespaceId, ...item.tags]
            .join(" ")
            .toLocaleLowerCase()
            .includes(normalized)
        : true,
    );
  }, [edition, gameVersion.id, kind, query]);

  return (
    <>
      <div className="catalog-toolbar">
        <label className="sr-only" htmlFor="item-query">
          搜尋物品
        </label>
        <input
          id="item-query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜尋名稱、namespaced ID 或 tag"
        />
        <label className="sr-only" htmlFor="item-kind">
          物品類型
        </label>
        <select
          id="item-kind"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        >
          <option value="all">全部類型</option>
          <option value="block">Block</option>
          <option value="item">Item</option>
          <option value="tool">Tool</option>
          <option value="food">Food</option>
        </select>
      </div>
      <div className="catalog-context">
        <EditionBadge edition={edition} />{" "}
        <VersionBadge version={gameVersion.name} />
      </div>
      {items.length > 0 ? (
        <div className="item-grid">
          {items.map((item) => (
            <Link href={"/items/" + item.slug} key={item.id}>
              <Card className="item-card">
                <div className="item-icon" aria-hidden="true">
                  {item.kind.slice(0, 1).toUpperCase()}
                </div>
                <h2>{item.name}</h2>
                <span className="namespace-id">{item.namespaceId}</span>
                <p>{item.description}</p>
                <div className="item-meta">
                  <small>STACK {item.stackSize}</small>
                  <span aria-hidden="true">→</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <StatePanel state="empty" title="這個 context 沒有結果">
          清除搜尋，或切換 Edition／Version。Java 與 Bedrock fixture
          不會互相偷渡。
        </StatePanel>
      )}
    </>
  );
}
