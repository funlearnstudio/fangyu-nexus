"use client";

import { CATALOG_ITEMS, RECIPES } from "@fangyu/domain";
import {
  Button,
  Card,
  EditionBadge,
  StatePanel,
  VersionBadge,
} from "@fangyu/ui";
import { usePortal } from "@/app/providers";
import { ProvenancePanel } from "@/components/ProvenancePanel";

export function ItemDetailClient({ slug }: { slug: string }) {
  const { edition, gameVersion, favorites, toggleFavorite } = usePortal();
  const item = CATALOG_ITEMS.find(
    (candidate) =>
      candidate.edition === edition &&
      candidate.gameVersionId === gameVersion.id &&
      candidate.slug === slug,
  );

  if (!item) {
    return (
      <StatePanel state="empty" title="此版別／版本找不到這個物品">
        這不是靜默 fallback。請切換 Edition／Version，或返回物品目錄。
      </StatePanel>
    );
  }

  const outputRecipes = RECIPES.filter(
    (recipe) =>
      recipe.edition === edition &&
      recipe.gameVersionId === gameVersion.id &&
      recipe.outputItemId === item.id,
  );
  const usedByRecipes = RECIPES.filter(
    (recipe) =>
      recipe.edition === edition &&
      recipe.gameVersionId === gameVersion.id &&
      recipe.ingredients.some((ingredient) => ingredient.itemId === item.id),
  );

  return (
    <div className="detail-layout">
      <Card className="detail-card">
        <div className="item-icon" aria-hidden="true">
          {item.kind.slice(0, 1).toUpperCase()}
        </div>
        <p className="eyebrow">{item.namespaceId}</p>
        <h1>{item.name}</h1>
        <p>{item.description}</p>
        <div className="badge-row">
          <EditionBadge edition={item.edition} />
          <VersionBadge version={gameVersion.name} />
        </div>
        <Button
          variant={favorites.has(item.id) ? "secondary" : "primary"}
          onClick={() => toggleFavorite(item.id)}
        >
          {favorites.has(item.id) ? "已收藏 · 移除" : "加入收藏"}
        </Button>
        <dl>
          <div>
            <dt>Namespaced ID</dt>
            <dd className="mono">{item.namespaceId}</dd>
          </div>
          <div>
            <dt>Kind</dt>
            <dd>{item.kind}</dd>
          </div>
          <div>
            <dt>Stack size</dt>
            <dd>{item.stackSize}</dd>
          </div>
          <div>
            <dt>Durability</dt>
            <dd>{item.durability ?? "—"}</dd>
          </div>
          <div>
            <dt>Tags</dt>
            <dd>{item.tags.join(", ")}</dd>
          </div>
          <div>
            <dt>Output recipes</dt>
            <dd>{outputRecipes.length}</dd>
          </div>
          <div>
            <dt>Used by recipes</dt>
            <dd>{usedByRecipes.length}</dd>
          </div>
          <div>
            <dt>Valid range</dt>
            <dd>
              {item.validFrom} → {item.validTo ?? "current fixture"}
            </dd>
          </div>
        </dl>
      </Card>
      <ProvenancePanel source={item.source} />
    </div>
  );
}
