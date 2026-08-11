"use client";

import { CATALOG_ITEMS } from "@fangyu/domain";
import { Card, StatePanel } from "@fangyu/ui";
import Link from "next/link";
import { usePortal } from "@/app/providers";

export function FavoritesPanel() {
  const { favorites, edition, gameVersion } = usePortal();
  const items = CATALOG_ITEMS.filter(
    (item) =>
      favorites.has(item.id) &&
      item.edition === edition &&
      item.gameVersionId === gameVersion.id,
  );

  return items.length ? (
    <div className="catalog-grid">
      {items.map((item) => (
        <Link href={"/items/" + item.slug} key={item.id}>
          <Card className="item-card">
            <h2>{item.name}</h2>
            <span className="namespace-id">{item.namespaceId}</span>
            <p>{item.description}</p>
          </Card>
        </Link>
      ))}
    </div>
  ) : (
    <StatePanel state="empty" title="這個 Context 還沒有收藏">
      到物品詳情頁加入收藏。收藏目前儲存在此裝置，正式帳號同步尚未啟用。
    </StatePanel>
  );
}
