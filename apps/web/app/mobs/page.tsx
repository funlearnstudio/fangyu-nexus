import { ScopedCatalog } from "@/components/ScopedCatalog";

export default function MobsPage() {
  return (
    <section className="content-page">
      <div className="breadcrumb">HOME / EXPLORE / MOBS</div>
      <header className="content-header">
        <div>
          <p className="eyebrow">MOB BESTIARY</p>
          <h1>生物圖鑑</h1>
          <p>
            基礎 catalog 已連上 Edition／Version
            context；正式戰鬥規則仍待資料匯入。
          </p>
        </div>
      </header>
      <ScopedCatalog kind="mobs" />
    </section>
  );
}
