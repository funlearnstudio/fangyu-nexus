import Link from "next/link";
import {
  BIOMES,
  CATALOG_ITEMS,
  GAME_VERSIONS,
  MOBS,
  RECIPES,
} from "@fangyu/domain";
import { Badge, Card } from "@fangyu/ui";
import { GlobalSearch } from "@/components/GlobalSearch";

const featureCards = [
  {
    href: "/items",
    code: "01",
    title: "物品與合成",
    copy: "依 Edition／Version 查 ID、屬性、配方與來源。",
    stat: CATALOG_ITEMS.length + " fixture items",
  },
  {
    href: "/crafting/calculator",
    code: "02",
    title: "遞迴合成計算",
    copy: "目標數量、庫存扣除、批量展開與 cycle detection。",
    stat: RECIPES.length + " tested recipes",
  },
  {
    href: "/mobs",
    code: "03",
    title: "生物與群系",
    copy: "分離 Java／Bedrock 的基礎圖鑑與 provenance。",
    stat: MOBS.length + BIOMES.length + " entries",
  },
  {
    href: "/servers",
    code: "04",
    title: "安全伺服器目錄",
    copy: "Server-side validation、IP range blocking 與 port allowlist。",
    stat: "RCON disabled",
  },
] as const;

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <Badge tone="warning">PHASE 1 · ENGINEERING BUILD</Badge>
          <p className="eyebrow">VERSION-AWARE MINECRAFT TOOLING</p>
          <h1>
            你的世界，
            <br />
            <span>有一套共同座標。</span>
          </h1>
          <p className="hero-description">
            方域 Nexus 把物品、配方、生物、版本與伺服器工具放進同一個
            Edition／Version context。現在展示的是明確標示的 fixture，
            不會拿猜測數值假裝正式資料。
          </p>
          <GlobalSearch />
          <div className="hero-actions">
            <Link className="primary-link play-cta" href="/play">
              開始遊戲 <span>▶</span>
            </Link>
            <Link className="primary-link" href="/crafting/calculator">
              開啟合成計算器 <span>→</span>
            </Link>
            <Link className="secondary-link" href="/items">
              瀏覽物品目錄
            </Link>
          </div>
        </div>

        <div className="hero-visual" aria-label="方域 Nexus 系統狀態">
          <div className="grid-sphere" aria-hidden="true">
            <span className="cube cube-a" />
            <span className="cube cube-b" />
            <span className="cube cube-c" />
          </div>
          <div className="system-card">
            <span className="pulse" />
            <span>CONTEXT ENGINE ONLINE</span>
            <strong>{GAME_VERSIONS.length} scoped fixture versions</strong>
          </div>
          <div className="coordinate-card">
            <span>X</span>
            <b>Edition</b>
            <strong>Java / Bedrock</strong>
            <span>Y</span>
            <b>Version</b>
            <strong>Always explicit</strong>
            <span>Z</span>
            <b>Source</b>
            <strong>Traceable</strong>
          </div>
        </div>
      </section>

      <section className="status-strip" aria-label="平台狀態">
        <div>
          <span>DATA MODE</span>
          <strong>DEMO FIXTURE</strong>
        </div>
        <div>
          <span>API</span>
          <strong>NEST + FASTIFY</strong>
        </div>
        <div>
          <span>DATABASE</span>
          <strong>POSTGRESQL</strong>
        </div>
        <div>
          <span>SECURITY</span>
          <strong>QUARANTINE FIRST</strong>
        </div>
      </section>

      <section className="home-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">CORE VERTICAL SLICES</p>
            <h2>不是工具大雜燴，是同一個世界系統。</h2>
          </div>
          <Link href="/versions">查看版本時間軸 →</Link>
        </div>
        <div className="feature-grid">
          {featureCards.map((feature) => (
            <Link href={feature.href} key={feature.href}>
              <Card className="feature-card">
                <span className="feature-code">{feature.code}</span>
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
                <div>
                  <small>{feature.stat}</small>
                  <span aria-hidden="true">↗</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="demo-warning">
        <div className="warning-icon" aria-hidden="true">
          !
        </div>
        <div>
          <p className="eyebrow">DATA INTEGRITY NOTICE</p>
          <h2>Fixture 就是 fixture，不穿正式資料的苦力怕裝。</h2>
          <p>
            正式 Minecraft ingestion adapter 尚未啟用。所有範例都有 source
            key、擷取時間與 checksum；切換 Edition 時資料會真正分離。
          </p>
        </div>
        <Link href="/about/demo-data">閱讀資料限制</Link>
      </section>
    </>
  );
}
