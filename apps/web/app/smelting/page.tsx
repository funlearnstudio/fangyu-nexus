import { SmeltingCalculator } from "./SmeltingCalculator";

export default function SmeltingPage() {
  return (
    <section className="content-page">
      <div className="breadcrumb">HOME / EXPLORE / SMELTING</div>
      <header className="content-header">
        <div>
          <p className="eyebrow">FUEL CAPACITY / BURN TICKS</p>
          <h1>熔煉排程計算器</h1>
          <p>使用燃燒刻、剩餘容量與 deadline 計算，不虛構真實熱力學。</p>
        </div>
      </header>
      <SmeltingCalculator />
    </section>
  );
}
