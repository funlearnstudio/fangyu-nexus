import { Injectable, NotFoundException } from "@nestjs/common";
import {
  CATALOG_ITEMS,
  GAME_VERSIONS,
  buildSearchIndex,
  getItemsForScope,
  type Edition,
} from "@fangyu/domain";

@Injectable()
export class CatalogService {
  listVersions() {
    return GAME_VERSIONS;
  }

  listItems(edition: Edition, gameVersionId: string, query = "") {
    const normalized = query.trim().toLocaleLowerCase();
    const items = getItemsForScope(edition, gameVersionId);
    return normalized
      ? items.filter((item) =>
          [item.name, item.englishName, item.namespaceId, ...item.tags]
            .join(" ")
            .toLocaleLowerCase()
            .includes(normalized),
        )
      : items;
  }

  getItem(edition: Edition, gameVersionId: string, slug: string) {
    const item = CATALOG_ITEMS.find(
      (candidate) =>
        candidate.edition === edition &&
        candidate.gameVersionId === gameVersionId &&
        candidate.slug === slug,
    );
    if (!item) {
      throw new NotFoundException("Item does not exist in selected scope.");
    }
    return item;
  }

  search(edition: Edition, gameVersionId: string, query: string) {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) {
      return [];
    }
    return buildSearchIndex()
      .filter(
        (entry) =>
          entry.edition === edition && entry.gameVersionId === gameVersionId,
      )
      .filter((entry) =>
        (entry.title + " " + entry.subtitle)
          .toLocaleLowerCase()
          .includes(normalized),
      )
      .slice(0, 20);
  }
}
