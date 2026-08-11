import Link from "next/link";
import { Badge, Card, StatePanel } from "@fangyu/ui";

type DeliveryState = "partial" | "skeleton" | "deferred";

interface RouteDefinition {
  eyebrow: string;
  title: string;
  summary: string;
  state: DeliveryState;
  available: string[];
  pending: string[];
  security?: string;
  links?: Array<{ href: string; label: string }>;
}

const definitions: Record<string, RouteDefinition> = {
  brewing: {
    eyebrow: "EXPLORE / BREWING",
    title: "釀造計算器",
    summary:
      "Phase 1 已建立配方、時間與來源的 domain 邊界；正式藥水資料尚待可驗證來源匯入。",
    state: "skeleton",
    available: [
      "Edition／Version 全域範圍",
      "資料來源與 fixture 狀態呈現",
      "計算器版面與 adapter 邊界",
    ],
    pending: [
      "正式釀造資料集",
      "燃料與時間規則",
      "Java／Bedrock 差異 golden tests",
    ],
    links: [{ href: "/smelting", label: "使用已完成的熔煉計算器" }],
  },
  "combat-calculator": {
    eyebrow: "EXPLORE / COMBAT",
    title: "戰鬥傷害計算器",
    summary:
      "傷害規則會放入 game-rules package；目前未用未驗證數值冒充正式結果。",
    state: "skeleton",
    available: [
      "輸入驗證架構",
      "版本範圍 context",
      "可測試的純函式 package 邊界",
    ],
    pending: ["護甲／韌性", "附魔減傷", "難度與 Edition 差異"],
    links: [{ href: "/mobs", label: "瀏覽生物目錄" }],
  },
  seeds: {
    eyebrow: "EXPLORE / SEEDS",
    title: "種子碼探索器",
    summary:
      "種子分享資料模型與地圖 renderer 邊界已保留；世界生成尚未在主執行緒中實作。",
    state: "deferred",
    available: [
      "路由與資訊架構",
      "Edition／Version scope",
      "地圖分塊與 LOD 設計邊界",
    ],
    pending: ["隔離式 seed worker", "地圖 tile cache", "結構座標驗證"],
    security:
      "世界生成與大型 parser 不會放在 React main thread 或 API request handler。",
  },
  redstone: {
    eyebrow: "BUILD / REDSTONE",
    title: "紅石實驗室",
    summary:
      "已提供模組入口與模擬器契約位置，Phase 1 暫不聲稱完成電路 tick 模擬。",
    state: "skeleton",
    available: [
      "藍圖／模擬分離架構",
      "版本相容性 context",
      "效能預算與 worker 邊界",
    ],
    pending: ["邏輯閘教學資料", "簡化 tick engine", "農場效率計算"],
    links: [{ href: "/schematics", label: "前往藍圖安全管線" }],
  },
  schematics: {
    eyebrow: "BUILD / SCHEMATICS",
    title: "藍圖分享庫",
    summary:
      "上傳 metadata、隔離狀態、大小與 magic-byte 驗證骨架已在 API／worker 建立。",
    state: "partial",
    available: [
      "quarantine 狀態",
      "檔案大小上限",
      "magic-byte 驗證契約",
      "隔離 worker package",
    ],
    pending: [
      "實際物件儲存 presigned upload",
      "litematic／schematic parser",
      "分層 3D 預覽",
    ],
    security:
      "未信任的 NBT、litematic、schematic、zip 不在 Web／API 主程序解析。",
  },
  commands: {
    eyebrow: "BUILD / COMMANDS",
    title: "指令生成器",
    summary:
      "已保留版本化 schema 與輸出預覽位置；正式 command grammar 將由版本 adapter 提供。",
    state: "skeleton",
    available: ["版本 scope", "表單與 preview 邊界", "可擴充的驗證層"],
    pending: ["/give", "/summon", "/tellraw", "Edition 專屬語法"],
    links: [{ href: "/datapacks/studio", label: "開啟資料包工作室" }],
  },
  "datapacks/studio": {
    eyebrow: "BUILD / DATAPACKS",
    title: "資料包工作室",
    summary:
      "Phase 1 聚焦安全上傳流程與 schema boundary，不在瀏覽器執行未信任內容。",
    state: "skeleton",
    available: ["upload quarantine API", "檔案驗證 package", "worker 任務邊界"],
    pending: ["Loot Table 生成器", "Custom Model Data", "沙箱測試執行器"],
    security:
      "zip 解壓上限、解析 timeout 與隔離執行將由 worker 強制，未完成前不接受正式執行。",
  },
  servers: {
    eyebrow: "PLAY / SERVER DETAIL",
    title: "伺服器詳情",
    summary:
      "伺服器清單可用；詳情頁目前呈現安全 ping 管線狀態，不會從瀏覽器連到任意主機。",
    state: "partial",
    available: [
      "server-side target validator",
      "允許埠策略",
      "private／loopback／link-local 阻擋",
      "DNS rebinding 測試",
    ],
    pending: ["Minecraft protocol adapter", "歷史狀態圖", "公開清單審核流程"],
    security:
      "RCON 未實作，密碼不會進 client bundle；任何 ping 都只能由受限 worker 執行。",
    links: [{ href: "/servers", label: "返回伺服器清單" }],
  },
  mods: {
    eyebrow: "PLAY / MODS",
    title: "模組索引",
    summary:
      "已建立 ingest worker 與 Modrinth adapter interface；目前只顯示明確標記的 fixture 狀態。",
    state: "partial",
    available: [
      "adapter interface",
      "來源與 checksum 契約",
      "版本／loader 交叉篩選模型",
    ],
    pending: [
      "正式 Modrinth 同步",
      "依賴圖持久化",
      "CurseForge API key adapter",
    ],
    links: [{ href: "/modpacks/resolver", label: "查看依賴解析器狀態" }],
  },
  assets: {
    eyebrow: "PLAY / ASSET DETAIL",
    title: "資源詳情",
    summary:
      "資源、版本、依賴與授權的資料表已建立；此詳情頁等待正式來源 adapter 匯入。",
    state: "skeleton",
    available: [
      "assets／asset_versions schema",
      "asset_dependencies 關聯",
      "license 外鍵",
    ],
    pending: ["來源同步", "相容版本矩陣", "安全下載掃描"],
    security: "任何第三方下載在來源、授權與掃描狀態不明時，都不會標示為安全。",
  },
  "modpacks/resolver": {
    eyebrow: "PLAY / MODPACKS",
    title: "模組包依賴解析器",
    summary:
      "已建立依賴資料表與 adapter boundary，求解器尚未接收未驗證的正式模組資料。",
    state: "skeleton",
    available: [
      "有向依賴圖 schema",
      "Edition／Version／loader 維度",
      "cycle test 參考架構",
    ],
    pending: ["版本範圍求交", "衝突解釋", "跨 loader 限制"],
    links: [{ href: "/mods", label: "返回模組索引" }],
  },
  players: {
    eyebrow: "PLAY / PLAYER",
    title: "玩家公開資料",
    summary:
      "玩家名稱路由與 Mojang adapter 位置已保留；目前不發出外部請求，也不顯示假玩家資料。",
    state: "skeleton",
    available: [
      "公開資料頁路由",
      "server-side adapter 邊界",
      "快取與 provenance 設計",
    ],
    pending: ["Mojang API adapter", "正式皮膚 URL 驗證", "名稱歷史權限策略"],
    links: [{ href: "/skins/studio", label: "使用本地 3D 皮膚預覽器" }],
  },
  compare: {
    eyebrow: "EXPLORE / VERSION COMPARE",
    title: "版本差異比較",
    summary:
      "正式 diff 需有可追蹤的版本來源；目前可先從時間軸切換 Edition，沒有捏造 changelog。",
    state: "skeleton",
    available: [
      "GameVersion／ReleaseChannel domain",
      "Java／Bedrock 分離",
      "valid_from／valid_to schema",
    ],
    pending: ["snapshot ingestion", "欄位級差異", "來源引用"],
    links: [{ href: "/versions", label: "查看版本時間軸" }],
  },
  community: {
    eyebrow: "COMMUNITY / HUB",
    title: "社群中心",
    summary:
      "文章、留言、投票、檢舉、成就與稽核資料表已就位；Phase 1 尚未開放公開發文。",
    state: "partial",
    available: [
      "posts／comments／votes schema",
      "reports moderation queue",
      "achievement 關聯",
      "audit log",
    ],
    pending: ["登入流程", "發文編輯器", "通知與反濫用限制"],
    links: [{ href: "/me", label: "查看本機個人區架構" }],
  },
  questions: {
    eyebrow: "COMMUNITY / Q&A",
    title: "問題討論",
    summary: "此動態問題路由已可解析，但沒有用不存在的 fixture 偽造討論內容。",
    state: "skeleton",
    available: ["問題 URL", "post／comment／vote schema", "report 關聯"],
    pending: ["查詢 API", "登入授權", "回答排序"],
    links: [{ href: "/community", label: "返回社群中心" }],
  },
  marketplace: {
    eyebrow: "COMMUNITY / MARKETPLACE",
    title: "作品市集",
    summary:
      "授權資料模型已建立；付款與真實交易不在 Phase 1 內，因此目前不顯示虛構商品。",
    state: "deferred",
    available: ["license schema", "asset／owner 關聯邊界", "檢舉與稽核模型"],
    pending: ["作品上架審核", "贊助 provider", "下載授權紀錄"],
    security: "交易功能會在身分、授權、退款與內容審核流程完成後才開放。",
  },
  creations: {
    eyebrow: "COMMUNITY / CREATION",
    title: "作品詳情",
    summary:
      "動態作品路由存在，但沒有正式來源、授權與作者資料時不提供下載按鈕。",
    state: "skeleton",
    available: ["動態詳情路由", "license／asset schema", "來源狀態位置"],
    pending: ["作品 API", "作者頁", "掃描後下載"],
    links: [{ href: "/marketplace", label: "返回作品市集" }],
  },
  admin: {
    eyebrow: "OPERATIONS / ADMIN",
    title: "管理與審核中心",
    summary:
      "API 已有 authorization guard 與測試；UI 只呈現架構狀態，不提供假的管理權限。",
    state: "partial",
    available: [
      "admin guard",
      "report／audit_log schema",
      "未授權 API 測試",
      "quarantine 狀態",
    ],
    pending: ["OIDC session", "角色權限矩陣", "審核操作 API", "稽核查詢"],
    security:
      "未登入使用者不會獲得管理操作；正式 RBAC 完成前，本頁沒有可寫入的管理按鈕。",
  },
  "about/demo-data": {
    eyebrow: "ABOUT / DATA PROVENANCE",
    title: "示範資料說明",
    summary:
      "網站目前的內容資料是專為驗證 Edition／Version、搜尋與計算流程建立的 fixture。",
    state: "partial",
    available: [
      "每筆 fixture 的 source／source_key／fetched_at／checksum",
      "DEMO badge",
      "Java／Bedrock 分離",
    ],
    pending: ["官方／社群授權來源 adapter", "定期 ingest", "來源健康度監控"],
    security:
      "示範 namespace 使用 demo:*；未經驗證的 Minecraft 數值不會冒充正式資料。",
    links: [{ href: "/items", label: "查看示範物品資料" }],
  },
};

function findDefinition(path: string): RouteDefinition | undefined {
  if (definitions[path]) return definitions[path];
  const firstSegment = path.split("/")[0] ?? path;
  return definitions[firstSegment];
}

function stateLabel(state: DeliveryState) {
  if (state === "partial") return "Phase 1 部分可用";
  if (state === "deferred") return "Phase 3 延後";
  return "可操作骨架";
}

export default async function PlannedRoutePage({
  params,
}: {
  params: Promise<{ segments: string[] }>;
}) {
  const { segments } = await params;
  const path = segments.join("/");
  const definition = findDefinition(path) ?? {
    eyebrow: "NEXUS / ROUTE",
    title: "模組入口",
    summary: "此路由已由平台接管，但不在目前 Phase 1 驗收範圍。",
    state: "skeleton" as const,
    available: ["共用導航", "Edition／Version context", "響應式狀態頁"],
    pending: ["產品需求確認", "domain model", "實作與測試"],
  };

  return (
    <div className="content-stack planned-route-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">{definition.eyebrow}</p>
          <h1>{definition.title}</h1>
          <p>{definition.summary}</p>
        </div>
        <Badge tone={definition.state === "partial" ? "success" : "warning"}>
          {stateLabel(definition.state)}
        </Badge>
      </header>

      <div className="delivery-grid">
        <Card>
          <p className="eyebrow">AVAILABLE NOW</p>
          <h2>目前已落地</h2>
          <ul className="check-list">
            {definition.available.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
        <Card>
          <p className="eyebrow">NEXT SLICE</p>
          <h2>尚未完成</h2>
          <ul className="pending-list">
            {definition.pending.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
      </div>

      {definition.security ? (
        <StatePanel state="unsafe" title="安全邊界">
          {definition.security}
        </StatePanel>
      ) : (
        <StatePanel state="stale" title="資料狀態">
          此模組不會把 fixture 或尚未串接的外部服務標示成正式完成。
        </StatePanel>
      )}

      {definition.links?.length ? (
        <nav className="route-actions" aria-label="相關已實作功能">
          {definition.links.map((link) => (
            <Link className="text-link" href={link.href} key={link.href}>
              {link.label} →
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
