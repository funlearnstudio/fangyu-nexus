"use client";

import { calculateSmeltingPlan } from "@fangyu/game-rules";
import { Button, Card } from "@fangyu/ui";
import { useMemo, useState } from "react";
import { usePortal } from "@/app/providers";

export function SmeltingCalculator() {
  const { edition, gameVersion } = usePortal();
  const [itemCount, setItemCount] = useState(64);
  const [recipeTicks, setRecipeTicks] = useState(200);
  const [fuelBurnTicks, setFuelBurnTicks] = useState(1600);
  const [deadlineTicks, setDeadlineTicks] = useState(0);
  const [calculated, setCalculated] = useState(false);
  const result = useMemo(
    () =>
      calculateSmeltingPlan({
        itemCount,
        recipeTicks,
        fuelBurnTicks,
        ...(deadlineTicks > 0 ? { deadlineTicks } : {}),
      }),
    [deadlineTicks, fuelBurnTicks, itemCount, recipeTicks],
  );

  return (
    <div className="calculator-layout">
      <Card className="calculator-panel">
        <h2>燃燒刻輸入</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="smelt-count">物品數量</label>
            <input
              id="smelt-count"
              type="number"
              min={1}
              value={itemCount}
              onChange={(event) =>
                setItemCount(Math.max(1, Number(event.target.value) || 1))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="recipe-ticks">每次配方刻數</label>
            <input
              id="recipe-ticks"
              type="number"
              min={1}
              value={recipeTicks}
              onChange={(event) =>
                setRecipeTicks(Math.max(1, Number(event.target.value) || 1))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="fuel-ticks">每單位燃料刻數</label>
            <input
              id="fuel-ticks"
              type="number"
              min={1}
              value={fuelBurnTicks}
              onChange={(event) =>
                setFuelBurnTicks(Math.max(1, Number(event.target.value) || 1))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="deadline-ticks">期限刻數（0 = 不限）</label>
            <input
              id="deadline-ticks"
              type="number"
              min={0}
              value={deadlineTicks}
              onChange={(event) =>
                setDeadlineTicks(Math.max(0, Number(event.target.value) || 0))
              }
            />
          </div>
        </div>
        <p className="fixture-note">
          {edition} · {gameVersion.name} · 參數為使用者輸入的 demo
          計算，不宣稱正式燃料數值。
        </p>
        <Button onClick={() => setCalculated(true)}>計算燃料排程</Button>
      </Card>
      <Card className="calculator-panel">
        <h2>排程結果</h2>
        {calculated ? (
          <div className="result-summary">
            <div>
              <span>作業次數</span>
              <strong>{result.operations}</strong>
            </div>
            <div>
              <span>總刻數</span>
              <strong>{result.totalTicks}</strong>
            </div>
            <div>
              <span>燃料單位</span>
              <strong>{result.fuelUnits}</strong>
            </div>
            <div>
              <span>所需熔爐</span>
              <strong>{result.furnaces}</strong>
            </div>
            <div>
              <span>剩餘燃燒刻</span>
              <strong>{result.remainingFuelTicks}</strong>
            </div>
          </div>
        ) : (
          <p>調整參數後執行計算。</p>
        )}
      </Card>
    </div>
  );
}
