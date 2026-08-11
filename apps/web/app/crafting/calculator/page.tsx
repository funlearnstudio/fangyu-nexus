import type { Metadata } from "next";
import { CraftingCalculator } from "./CraftingCalculator";

export const metadata: Metadata = {
  title: "合成計算器",
};

export default function CraftingCalculatorPage() {
  return (
    <section className="content-page">
      <div className="breadcrumb">HOME / BUILD / CRAFTING CALCULATOR</div>
      <header className="content-header">
        <div>
          <p className="eyebrow">RECURSIVE RECIPE ENGINE</p>
          <h1>合成與物料計算器</h1>
          <p>
            真正執行批量計算、庫存扣除、遞迴材料展開、剩餘產出與 cycle
            detection。所有結果保留 Edition／Version／Source。
          </p>
        </div>
      </header>
      <CraftingCalculator />
    </section>
  );
}
