"use client";

import { CATALOG_ITEMS, RECIPES } from "@fangyu/domain";
import {
  RecipeCycleError,
  calculateCraftingPlan,
  type CraftingPlan,
} from "@fangyu/game-rules";
import { Button, Card, StatePanel } from "@fangyu/ui";
import { useEffect, useMemo, useState } from "react";
import { usePortal } from "@/app/providers";
import { ProvenancePanel } from "@/components/ProvenancePanel";

export function CraftingCalculator() {
  const { edition, gameVersion } = usePortal();
  const scopedItems = useMemo(
    () =>
      CATALOG_ITEMS.filter(
        (item) =>
          item.edition === edition && item.gameVersionId === gameVersion.id,
      ),
    [edition, gameVersion.id],
  );
  const scopedRecipes = useMemo(
    () =>
      RECIPES.filter(
        (recipe) =>
          recipe.edition === edition &&
          recipe.gameVersionId === gameVersion.id &&
          recipe.type !== "smelting",
      ),
    [edition, gameVersion.id],
  );
  const outputItems = scopedItems.filter((item) =>
    scopedRecipes.some((recipe) => recipe.outputItemId === item.id),
  );
  const [outputItemId, setOutputItemId] = useState(outputItems[0]?.id ?? "");
  const [targetQuantity, setTargetQuantity] = useState(1);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [plan, setPlan] = useState<CraftingPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOutputItemId(outputItems[0]?.id ?? "");
    setInventory({});
    setPlan(null);
    setError(null);
  }, [edition, gameVersion.id]);

  const selectedRecipe = scopedRecipes.find(
    (recipe) => recipe.outputItemId === outputItemId,
  );
  const itemById = new Map(scopedItems.map((item) => [item.id, item]));

  function calculate() {
    try {
      const nextPlan = calculateCraftingPlan({
        edition,
        gameVersionId: gameVersion.id,
        outputItemId,
        targetQuantity,
        inventory,
        recipes: RECIPES,
        items: CATALOG_ITEMS,
      });
      setPlan(nextPlan);
      setError(null);
    } catch (caught) {
      setPlan(null);
      if (caught instanceof RecipeCycleError) {
        setError("偵測到循環配方：" + caught.cycle.join(" → "));
      } else {
        setError(caught instanceof Error ? caught.message : "未知計算錯誤");
      }
    }
  }

  return (
    <div className="calculator-layout">
      <Card className="calculator-panel">
        <h2>輸入目標與庫存</h2>
        <div className="form-grid">
          <div className="select-field wide">
            <label htmlFor="craft-output">輸出物品</label>
            <select
              id="craft-output"
              value={outputItemId}
              onChange={(event) => {
                setOutputItemId(event.target.value);
                setPlan(null);
              }}
            >
              {outputItems.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name} · {item.namespaceId}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="target-quantity">目標數量</label>
            <input
              id="target-quantity"
              type="number"
              min={1}
              max={100000}
              value={targetQuantity}
              onChange={(event) =>
                setTargetQuantity(Math.max(1, Number(event.target.value) || 1))
              }
            />
          </div>
          <div className="field">
            <label>目前 Context</label>
            <input
              readOnly
              value={
                (edition === "java" ? "Java" : "Bedrock") +
                " · " +
                gameVersion.name
              }
            />
          </div>
        </div>

        <p className="eyebrow">3×3 CRAFTING LAYOUT</p>
        <div className="crafting-grid" aria-label="3×3 合成排列">
          {Array.from({ length: 9 }, (_, slot) => {
            const ingredient = selectedRecipe?.ingredients.find(
              (entry) => entry.slot === slot,
            );
            const item = ingredient
              ? itemById.get(ingredient.itemId)
              : undefined;
            return (
              <div
                className={"crafting-slot" + (item ? " filled" : "")}
                key={slot}
              >
                {item ? item.name : "·"}
              </div>
            );
          })}
        </div>

        <p className="eyebrow">INVENTORY</p>
        <div className="inventory-list">
          {scopedItems.map((item) => (
            <label key={item.id}>
              <span>{item.name}</span>
              <input
                aria-label={item.name + " 庫存"}
                type="number"
                min={0}
                value={inventory[item.id] ?? 0}
                onChange={(event) =>
                  setInventory((current) => ({
                    ...current,
                    [item.id]: Math.max(0, Number(event.target.value) || 0),
                  }))
                }
              />
            </label>
          ))}
        </div>
        <Button
          className="calculate-button"
          onClick={calculate}
          disabled={!outputItemId}
        >
          計算遞迴材料
        </Button>
      </Card>

      <Card className="calculator-panel">
        <h2>計算結果</h2>
        {error ? (
          <StatePanel state="error" title="計算停止">
            {error}
          </StatePanel>
        ) : plan ? (
          <>
            <div className="result-summary">
              <div>
                <span>目標數量</span>
                <strong>{plan.targetQuantity}</strong>
              </div>
              <div>
                <span>製作步驟</span>
                <strong>{plan.steps.length}</strong>
              </div>
              <div>
                <span>基礎材料種類</span>
                <strong>{Object.keys(plan.baseMaterials).length}</strong>
              </div>
            </div>
            <p className="eyebrow">BASE MATERIALS</p>
            <ul className="material-list">
              {Object.entries(plan.baseMaterials).map(([itemId, quantity]) => (
                <li key={itemId}>
                  <span>{itemById.get(itemId)?.name ?? itemId}</span>
                  <strong>× {quantity}</strong>
                </li>
              ))}
            </ul>
            <p className="eyebrow">CRAFTING STEPS</p>
            <ol className="material-list">
              {plan.steps.map((step, index) => (
                <li key={step.recipeId + ":" + index}>
                  <span>
                    {itemById.get(step.itemId)?.name ?? step.itemId}
                    <small> · {step.operations} operations</small>
                  </span>
                  <strong>{step.produced}</strong>
                </li>
              ))}
            </ol>
            {plan.sources[0] ? (
              <ProvenancePanel source={plan.sources[0]} />
            ) : null}
          </>
        ) : (
          <StatePanel state="empty" title="等待輸入">
            選擇成品、調整庫存，再執行計算。邏輯位於 @fangyu/game-rules，不在
            React component 裡硬寫。
          </StatePanel>
        )}
      </Card>
    </div>
  );
}
