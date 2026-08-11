import { ScopedCatalog } from "@/components/ScopedCatalog";

export default function StructuresPage() {
  return (
    <section className="content-page">
      <div className="breadcrumb">HOME / EXPLORE / STRUCTURES</div>
      <header className="content-header">
        <div>
          <p className="eyebrow">STRUCTURES</p>
          <h1>遺跡與結構</h1>
          <p>Phase 1 basic catalog。結構座標不會在缺少正式演算法時亂猜。</p>
        </div>
      </header>
      <ScopedCatalog kind="structures" />
    </section>
  );
}
