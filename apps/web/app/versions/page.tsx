import { VersionTimeline } from "@/components/VersionTimeline";

export default function VersionsPage() {
  return (
    <section className="content-page">
      <div className="breadcrumb">HOME / EXPLORE / VERSIONS</div>
      <header className="content-header">
        <div>
          <p className="eyebrow">VERSION TIMELINE</p>
          <h1>版本時間軸</h1>
          <p>Java 與 Bedrock 分軌；正式 ingestion 未啟用前只顯示 fixture。</p>
        </div>
      </header>
      <VersionTimeline />
    </section>
  );
}
