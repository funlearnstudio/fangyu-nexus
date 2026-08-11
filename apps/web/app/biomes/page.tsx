import { ScopedCatalog } from "@/components/ScopedCatalog";

export default function BiomesPage() {
  return (
    <section className="content-page">
      <div className="breadcrumb">HOME / EXPLORE / BIOMES</div>
      <header className="content-header">
        <div>
          <p className="eyebrow">BIOMES</p>
          <h1>生物群系</h1>
          <p>
            目前為 basic catalog；world-generation engine 與 seed map 明確延後。
          </p>
        </div>
      </header>
      <ScopedCatalog kind="biomes" />
    </section>
  );
}
