import { Card, StatePanel } from "@fangyu/ui";
import { ScopedCatalog } from "@/components/ScopedCatalog";

export default function ServersPage() {
  return (
    <section className="content-page">
      <div className="breadcrumb">HOME / PLAY / SERVERS</div>
      <header className="content-header">
        <div>
          <p className="eyebrow">SERVER DIRECTORY / SAFE PING</p>
          <h1>伺服器目錄</h1>
          <p>
            瀏覽器不會直接連任意主機；Ping 只能進入 server-side validation 與
            worker queue。
          </p>
        </div>
      </header>
      <div className="feature-skeleton">
        <div>
          <ScopedCatalog kind="servers" />
        </div>
        <Card>
          <h2>安全邊界</h2>
          <div className="status-list">
            <div className="status-row">
              <span>Private IP blocking</span>
              <span>IMPLEMENTED</span>
            </div>
            <div className="status-row">
              <span>Port allowlist</span>
              <span>IMPLEMENTED</span>
            </div>
            <div className="status-row">
              <span>DNS rebind validation</span>
              <span>IMPLEMENTED</span>
            </div>
            <div className="status-row">
              <span>Protocol ping adapter</span>
              <span>DEFERRED</span>
            </div>
            <div className="status-row">
              <span>RCON</span>
              <span>DISABLED</span>
            </div>
          </div>
          <StatePanel state="stale" title="Validation-only">
            Phase 1 worker 會重新驗證並 pin 公開 IP；尚未對外發出真正 Minecraft
            protocol ping。
          </StatePanel>
        </Card>
      </div>
    </section>
  );
}
