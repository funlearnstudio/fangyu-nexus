import { describe, expect, it } from "vitest";
import {
  CATALOG_ITEMS,
  DEMO_SOURCE,
  RECIPES,
  type Recipe,
} from "@fangyu/domain";
import {
  RecipeCycleError,
  calculateCraftingPlan,
  calculateSmeltingPlan,
} from "./index";

describe("calculateCraftingPlan", () => {
  it("recursively expands a Java fixture recipe", () => {
    const plan = calculateCraftingPlan({
      edition: "java",
      gameVersionId: "java-demo-1",
      outputItemId: "java-demo-wooden-pickaxe",
      targetQuantity: 2,
      recipes: RECIPES,
      items: CATALOG_ITEMS,
    });

    expect(plan.baseMaterials["java-demo-oak-log"]).toBe(2);
    expect(
      plan.steps.some((step) => step.recipeId === "java-demo-sticks"),
    ).toBe(true);
  });

  it("uses inventory before expanding materials", () => {
    const plan = calculateCraftingPlan({
      edition: "java",
      gameVersionId: "java-demo-1",
      outputItemId: "java-demo-crafting-table",
      targetQuantity: 1,
      inventory: { "java-demo-oak-planks": 2 },
      recipes: RECIPES,
      items: CATALOG_ITEMS,
    });

    expect(plan.inventoryUsed["java-demo-oak-planks"]).toBe(2);
    expect(plan.baseMaterials["java-demo-oak-log"]).toBe(1);
  });

  it("never crosses edition boundaries", () => {
    expect(() =>
      calculateCraftingPlan({
        edition: "java",
        gameVersionId: "java-demo-1",
        outputItemId: "bedrock-demo-signal-lamp",
        targetQuantity: 1,
        recipes: RECIPES,
        items: CATALOG_ITEMS,
      }),
    ).toThrow("outside the selected edition/version");
  });

  it("detects a cycle", () => {
    const cyclic: Recipe[] = [
      {
        edition: "java",
        gameVersionId: "java-demo-1",
        validFrom: "java-demo-1",
        id: "cycle-a",
        type: "crafting_shapeless",
        outputItemId: "java-demo-oak-log",
        outputCount: 1,
        ingredients: [{ itemId: "java-demo-oak-planks", count: 1 }],
        source: DEMO_SOURCE,
      },
      {
        edition: "java",
        gameVersionId: "java-demo-1",
        validFrom: "java-demo-1",
        id: "cycle-b",
        type: "crafting_shapeless",
        outputItemId: "java-demo-oak-planks",
        outputCount: 1,
        ingredients: [{ itemId: "java-demo-oak-log", count: 1 }],
        source: DEMO_SOURCE,
      },
    ];

    expect(() =>
      calculateCraftingPlan({
        edition: "java",
        gameVersionId: "java-demo-1",
        outputItemId: "java-demo-oak-log",
        targetQuantity: 1,
        recipes: cyclic,
        items: CATALOG_ITEMS,
      }),
    ).toThrow(RecipeCycleError);
  });
});

describe("calculateSmeltingPlan", () => {
  it("tracks fuel remainder and deadline furnace count", () => {
    expect(
      calculateSmeltingPlan({
        itemCount: 10,
        recipeTicks: 200,
        fuelBurnTicks: 1600,
        deadlineTicks: 1000,
      }),
    ).toEqual({
      operations: 10,
      totalTicks: 2000,
      fuelUnits: 2,
      furnaces: 2,
      remainingFuelTicks: 1200,
    });
  });
});
