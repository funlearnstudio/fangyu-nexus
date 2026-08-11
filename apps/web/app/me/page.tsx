import { FavoritesPanel } from "@/components/FavoritesPanel";

export default function MePage() {
  return (
    <section className="content-page">
      <div className="breadcrumb">HOME / ME</div>
      <header className="content-header">
        <div>
          <p className="eyebrow">PERSONAL WORKSPACE</p>
          <h1>我的工作區</h1>
          <p>帳號 provider 與資料表已預留；此建置先提供 device-local 收藏。</p>
        </div>
      </header>
      <div className="home-section">
        <FavoritesPanel />
      </div>
    </section>
  );
}
