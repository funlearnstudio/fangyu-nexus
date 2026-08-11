import type { CatalogItem, Edition, Provenance, Recipe } from "@fangyu/domain";

export class RecipeCycleError extends Error {
  constructor(public readonly cycle: string[]) {
    super("Recipe cycle detected: " + cycle.join(" -> "));
    this.name = "RecipeCycleError";
  }
}

export interface CraftingStep {
  itemId: string;
  requested: number;
  operations: number;
  produced: number;
  recipeId: string;
}

export interface CraftingPlan {
  edition: Edition;
  gameVersionId: string;
  outputItemId: string;
  targetQuantity: number;
  baseMaterials: Record<string, number>;
  inventoryUsed: Record<string, number>;
  surplus: Record<string, number>;
  steps: CraftingStep[];
  sources: Provenance[];
}

export interface CraftingPlanInput {
  edition: Edition;
  gameVersionId: string;
  outputItemId: string;
  targetQuantity: number;
  inventory?: Record<string, number>;
  recipes: Recipe[];
  items: CatalogItem[];
}

export function calculateCraftingPlan(input: CraftingPlanInput): CraftingPlan {
  if (!Number.isInteger(input.targetQuantity) || input.targetQuantity < 1) {
    throw new Error("targetQuantity must be a positive integer");
  }

  const scopedRecipes = input.recipes.filter(
    (recipe) =>
      recipe.edition === input.edition &&
      recipe.gameVersionId === input.gameVersionId,
  );
  const scopedItems = input.items.filter(
    (item) =>
      item.edition === input.edition &&
      item.gameVersionId === input.gameVersionId,
  );
  const itemIds = new Set(scopedItems.map((item) => item.id));

  if (!itemIds.has(input.outputItemId)) {
    throw new Error("Output item is outside the selected edition/version");
  }

  const recipeByOutput = new Map<string, Recipe>();
  for (const recipe of scopedRecipes) {
    if (!recipeByOutput.has(recipe.outputItemId)) {
      recipeByOutput.set(recipe.outputItemId, recipe);
    }
  }

  const remainingInventory = { ...(input.inventory ?? {}) };
  const baseMaterials: Record<string, number> = {};
  const inventoryUsed: Record<string, number> = {};
  const surplus: Record<string, number> = {};
  const steps: CraftingStep[] = [];
  const sourceById = new Map<string, Provenance>();

  function consumeInventory(itemId: string, quantity: number): number {
    const available = remainingInventory[itemId] ?? 0;
    const used = Math.min(available, quantity);
    if (used > 0) {
      remainingInventory[itemId] = available - used;
      inventoryUsed[itemId] = (inventoryUsed[itemId] ?? 0) + used;
    }
    return quantity - used;
  }

  function expand(itemId: string, quantity: number, stack: string[]): void {
    if (!itemIds.has(itemId)) {
      throw new Error("Recipe references an item outside the selected scope");
    }

    let needed = consumeInventory(itemId, quantity);
    const availableSurplus = surplus[itemId] ?? 0;
    const surplusUsed = Math.min(availableSurplus, needed);
    needed -= surplusUsed;
    surplus[itemId] = availableSurplus - surplusUsed;

    if (needed === 0) {
      return;
    }

    if (stack.includes(itemId)) {
      throw new RecipeCycleError([...stack, itemId]);
    }

    const recipe = recipeByOutput.get(itemId);
    if (!recipe) {
      baseMaterials[itemId] = (baseMaterials[itemId] ?? 0) + needed;
      return;
    }

    sourceById.set(recipe.source.id, recipe.source);
    const operations = Math.ceil(needed / recipe.outputCount);
    const produced = operations * recipe.outputCount;
    surplus[itemId] = (surplus[itemId] ?? 0) + produced - needed;
    steps.push({
      itemId,
      requested: needed,
      operations,
      produced,
      recipeId: recipe.id,
    });

    const ingredientTotals = new Map<string, number>();
    for (const ingredient of recipe.ingredients) {
      ingredientTotals.set(
        ingredient.itemId,
        (ingredientTotals.get(ingredient.itemId) ?? 0) +
          ingredient.count * operations,
      );
    }

    for (const [ingredientId, ingredientQuantity] of ingredientTotals) {
      expand(ingredientId, ingredientQuantity, [...stack, itemId]);
    }
  }

  expand(input.outputItemId, input.targetQuantity, []);

  return {
    edition: input.edition,
    gameVersionId: input.gameVersionId,
    outputItemId: input.outputItemId,
    targetQuantity: input.targetQuantity,
    baseMaterials,
    inventoryUsed,
    surplus,
    steps,
    sources: [...sourceById.values()],
  };
}

export interface SmeltingPlanInput {
  itemCount: number;
  recipeTicks: number;
  fuelBurnTicks: number;
  deadlineTicks?: number;
}

export interface SmeltingPlan {
  operations: number;
  totalTicks: number;
  fuelUnits: number;
  furnaces: number;
  remainingFuelTicks: number;
}

export function calculateSmeltingPlan(input: SmeltingPlanInput): SmeltingPlan {
  const values = [input.itemCount, input.recipeTicks, input.fuelBurnTicks];
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error("Smelting inputs must be positive numbers");
  }

  const operations = Math.ceil(input.itemCount);
  const totalTicks = operations * input.recipeTicks;
  const fuelUnits = Math.ceil(totalTicks / input.fuelBurnTicks);
  const furnaces = input.deadlineTicks
    ? Math.max(1, Math.ceil(totalTicks / input.deadlineTicks))
    : 1;

  return {
    operations,
    totalTicks,
    fuelUnits,
    furnaces,
    remainingFuelTicks: fuelUnits * input.fuelBurnTicks - totalTicks,
  };
}
