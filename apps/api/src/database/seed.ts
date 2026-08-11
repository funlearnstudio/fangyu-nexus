import { createHash } from "node:crypto";
import {
  CATALOG_ITEMS,
  DEMO_SOURCE,
  GAME_VERSIONS,
  RECIPES,
} from "@fangyu/domain";
import { createDatabaseClient } from "./client";
import {
  gameVersions,
  itemVersions,
  items,
  recipeInputs,
  recipes,
  sources,
} from "./schema";

function uuidFor(value: string): string {
  const hash = createHash("sha256").update(value).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "4" + hash.slice(13, 16),
    "8" + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join("-");
}

async function main() {
  const { db, sql } = createDatabaseClient();
  try {
    const sourceId = uuidFor(DEMO_SOURCE.sourceKey);
    await db
      .insert(sources)
      .values({
        id: sourceId,
        provider: "fixture",
        sourceKey: DEMO_SOURCE.sourceKey,
        sourceUrl: DEMO_SOURCE.sourceUrl,
        fetchedAt: new Date(DEMO_SOURCE.fetchedAt),
        checksum: DEMO_SOURCE.checksum,
        provenance: { note: DEMO_SOURCE.note },
        isDemo: true,
      })
      .onConflictDoNothing();

    for (const version of GAME_VERSIONS) {
      await db
        .insert(gameVersions)
        .values({
          id: uuidFor(version.id),
          edition: version.edition,
          versionName: version.name,
          channel: version.channel,
          releasedAt: new Date(version.releasedAt + "T00:00:00.000Z"),
          isSupported: version.isSupported,
          isDemo: true,
          sourceId,
        })
        .onConflictDoNothing();
    }

    for (const item of CATALOG_ITEMS) {
      const itemId = uuidFor(item.edition + ":" + item.namespaceId);
      await db
        .insert(items)
        .values({
          id: itemId,
          namespaceId: item.edition + ":" + item.namespaceId,
          kind: item.kind,
          defaultName: item.englishName,
        })
        .onConflictDoNothing();

      await db
        .insert(itemVersions)
        .values({
          id: uuidFor(item.id),
          itemId,
          gameVersionId: uuidFor(item.gameVersionId),
          validFrom: item.validFrom,
          validTo: item.validTo,
          nameKey: item.namespaceId,
          displayName: item.name,
          stackSize: item.stackSize,
          durability: item.durability,
          properties: {
            description: item.description,
            tags: item.tags,
            fixture: true,
          },
          sourceId,
        })
        .onConflictDoNothing();
    }

    for (const recipe of RECIPES) {
      await db
        .insert(recipes)
        .values({
          id: uuidFor(recipe.id),
          edition: recipe.edition,
          gameVersionId: uuidFor(recipe.gameVersionId),
          validFrom: recipe.validFrom,
          validTo: recipe.validTo,
          type: recipe.type,
          outputItemVersionId: uuidFor(recipe.outputItemId),
          outputCount: recipe.outputCount,
          ticks: recipe.ticks,
          pattern: recipe.pattern,
          sourceId,
        })
        .onConflictDoNothing();

      for (const [inputIndex, ingredient] of recipe.ingredients.entries()) {
        await db
          .insert(recipeInputs)
          .values({
            id: uuidFor(recipe.id + ":" + inputIndex),
            recipeId: uuidFor(recipe.id),
            slotIndex: ingredient.slot,
            ingredientItemVersionId: uuidFor(ingredient.itemId),
            count: ingredient.count,
          })
          .onConflictDoNothing();
      }
    }

    console.log(
      "Demo fixture seed completed. No production Minecraft data was inserted.",
    );
  } finally {
    await sql.end();
  }
}

void main();
