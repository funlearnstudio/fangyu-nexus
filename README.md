# 方域 Nexus

方域 Nexus 是一個繁體中文優先、Java／Bedrock 嚴格分離、可追蹤資料來源的 Minecraft 綜合工具平台。本專案不是 Mojang 或 Microsoft 的官方產品，也不需要安裝 Minecraft 本體才能啟動基本網站。

> **NOT AN OFFICIAL MINECRAFT PRODUCT/SERVICE. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.**

目前版本包含 Phase 1 Portal 工程基線，以及 Phase 2 原創 voxel sandbox 的第一個可玩 vertical slice。物品、搜尋、版別／版本切換、合成與熔煉計算器可實際操作；遊戲可建立 deterministic 世界、移動、跳躍、挖掘、放置、管理背包及保存本機進度。尚未串接正式 Minecraft 資料的區域會清楚標示 fixture、adapter pending 或 deferred，不會把示範資料冒充正式資料。

## 已落地功能

- 共用 Explore／Build／Play／Community 導覽與全域搜尋
- Java／Bedrock Edition 與 Game Version 全域狀態；資料與計算不跨 Edition fallback
- 版本化物品目錄、物品詳情、收藏與來源追蹤
- 真正的 3×3 合成顯示、目標數量、庫存扣除、批次、遞迴材料展開與 cycle detection
- 熔煉時間、燃料與平行熔爐計算
- 生物、生態域、結構、版本與伺服器基礎目錄
- Three.js／React Three Fiber 3D 皮膚預覽：Steve／Alex、旋轉、縮放、外層、披風掛載、基本動畫、WebGPU → WebGL2 fallback
- NestJS + Fastify API、Swagger UI、Zod 驗證
- PostgreSQL 31-table schema 與 Drizzle migration／demo seed
- Redis／BullMQ 佇列邊界與 MinIO S3-compatible 開發環境
- Server ping SSRF 防護：private、loopback、link-local、metadata、非法埠與 DNS rebinding 防線
- 未信任檔案 quarantine、大小限制、magic-byte 與隔離 worker 架構
- `/play` 世界建立／世界清單、`/play/world` 全螢幕遊戲與 `/play/settings` 設定
- 第一人稱 WASD、Pointer Lock 視角、跳躍、重力、固定步長 AABB collision、衝刺與蹲下架構
- 16×64×16 chunk、Web Worker deterministic terrain、lazy load／unload、face-culling 單一 chunk mesh 與 frustum culling
- 原創程序配色方塊、raycast 挖掘／放置、6-block reach、玩家 AABB 放置保護、selection outline
- 36 格背包、stack count、1–9 hotbar、Survival／Creative、基礎合成、生命／飢餓／墜落傷害／死亡／重生
- 日夜循環、sky、sunlight、fog、basic lighting、程序 oscillator SFX 與 debug overlay
- IndexedDB local-first 存檔：世界 metadata、玩家狀態、背包與 modified chunk deltas；12 秒 autosave
- MongoDB Atlas／local MongoDB hybrid persistence：PostgreSQL 保留 Portal relational data，MongoDB 保存動態世界 delta
- Next Route Handlers 提供 serverless worlds／chunks／player-save API；HttpOnly signed owner cookie 與 ownership filtering
- 原生 Next.js Vercel build；網站與本機遊戲不要求 Docker 或 MongoDB 在線才能開啟

## 需求

- Node.js `22.13.0` 以上
- Corepack（Node 22 內含）與 pnpm `11.16.0`
- Docker Desktop（要啟動 PostgreSQL／Redis／MinIO／MongoDB 時需要）
  - Windows：Windows 11、Docker Desktop、Linux containers／WSL2 backend
  - macOS：現代 macOS；Apple Silicon 與 Intel 均使用 multi-architecture container images

專案核心 scripts 全部以 Node.js API 與 pnpm 實作，不依賴 `rm -rf`、`cp`、`sed`、`grep`、shell 環境變數語法或 PowerShell-only 指令。

## macOS 本機啟動

```text
corepack enable
pnpm install
node -e "require('node:fs').copyFileSync('.env.example','.env')"
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Windows 11 本機啟動

請先啟動 Docker Desktop，再從 PowerShell、Command Prompt 或 Windows Terminal 在 repository 根目錄執行同一組命令：

```text
corepack enable
pnpm install
node -e "require('node:fs').copyFileSync('.env.example','.env')"
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

若公司政策禁止 `corepack enable` 寫入系統 Node 目錄，可改用已安裝的 pnpm 11；repository 的 `packageManager` 欄位會固定預期版本。

啟動後：

- Web：<http://localhost:3000>
- API health：<http://localhost:4000/v1/health>
- OpenAPI／Swagger：<http://localhost:4000/docs>
- MinIO API：<http://localhost:9000>
- MinIO Console：<http://localhost:9001>
- MongoDB：`mongodb://localhost:27017`（不對瀏覽器公開）

`pnpm dev` 讓 Next/Vinext、API 與必要 workers 在 host 上 hot reload；PostgreSQL、Redis、MinIO、MongoDB 留在 Docker 中。網站基本查詢、demo fixture 與 IndexedDB 本機遊戲即使沒有 Minecraft 本體或雲端資料庫也能使用。

## 日常命令

| 命令                | 功能                                                         |
| ------------------- | ------------------------------------------------------------ |
| `pnpm dev`          | 建置 shared packages，啟動 Web、API 與 workers 的 watch mode |
| `pnpm build`        | Turborepo production build，並驗證可部署 Web artifact        |
| `pnpm build:vercel` | 建置 Web 所需 shared packages，再執行原生 `next build`       |
| `pnpm lint`         | ESLint，全 workspace 零 warning                              |
| `pnpm typecheck`    | TypeScript project references 完整檢查                       |
| `pnpm test`         | unit、API、game-rules 與 ping security tests                 |
| `pnpm test:e2e`     | production build 後執行 API E2E tests                        |
| `pnpm db:generate`  | 由 Drizzle schema 產生 SQL migration                         |
| `pnpm db:migrate`   | 執行 PostgreSQL migrations                                   |
| `pnpm db:seed`      | 寫入明確標記的 demo／fixture 資料                            |

停止 infrastructure：

```text
docker compose down
```

此命令不刪除 named volumes。若要刪除本機資料，請自行確認目標後再使用 Docker Desktop UI 管理 volumes。

## Monorepo

```text
apps/
  web/             Next App Router / Vinext / R3F
  api/             NestJS / Fastify / OpenAPI / Drizzle
  worker-ingest/   外部資料 adapter 邊界
  worker-files/    未信任檔案隔離驗證
  worker-ping/     安全 server ping target validator
  worker-render/   重型 3D render job 邊界
packages/
  domain/          Edition、GameVersion、ReleaseChannel、fixture
  game-rules/      純 TypeScript 可測試計算規則
  voxel-engine/    chunk、生成、mesh、physics helpers、背包與存檔 contract
  contracts/       Zod API contracts
  parsers-wasm/    parser/quarantine contract
  ui/              共用 design system
  observability/   structured logging
infra/
  containers/      container 說明
  terraform/       後續 production IaC 邊界
```

此階段採 modular monolith first：Web、API、PostgreSQL、Redis 與少量 workers 可以一起運作；worker packages 先建立可信任邊界，不把所有功能過早拆成獨立 microservices。

## Voxel 遊戲操作

1. 打開 `/play`，輸入世界名稱、Seed 並選擇 Survival 或 Creative。
2. 按「建立並進入」。世界會先寫進 IndexedDB，再在 MongoDB 可用時背景同步。
3. 在 pause menu 按 Resume 取得滑鼠控制。

| 按鍵        | 動作                    |
| ----------- | ----------------------- |
| `W A S D`   | 移動                    |
| Mouse       | 控制視角                |
| `Space`     | 跳躍                    |
| `Shift`     | 衝刺                    |
| `Ctrl`      | 蹲下（experimental）    |
| Left Click  | 攻擊／挖掘              |
| Right Click | 放置所選方塊            |
| `1`–`9`     | 選擇 hotbar             |
| `E`         | 背包與合成              |
| `F3`        | 切換效能 debug overlay  |
| `Esc`       | 釋放 Pointer Lock／暫停 |

遊戲不把 voxel data 放入 React state，也不是一個方塊一個 component。runtime 使用 ref-backed in-memory chunks、固定 60 Hz physics step、worker generation、每個可見 chunk 一個 face-culled mesh；React 只負責低頻 HUD 與 mesh descriptor 更新。

## 世界存檔架構

- 即時操作：in-memory chunk 立即更新，不等待網路。
- 快取／離線：IndexedDB 保存 world、player state 與 compact modified-block tuples。
- 雲端：autosave 批次呼叫 Next Route Handlers，同步至 MongoDB。
- 未修改的 procedural chunk 不會寫進 MongoDB；讀取時使用 `seed + generationVersion + chunk coordinate` 重建 base chunk，再套用 delta。
- `worldChunks` 建立 `(worldId, chunkX, chunkZ)` unique index；documents 帶 `revision`、`schemaVersion`／`generationVersion`。
- Mongo 連線 helper 只存在 server module，使用 global cached `MongoClient` promise，失敗會釋放 cache 供下次 retry。
- MongoDB 暫時不可用時 HUD 顯示 Offline，IndexedDB 存檔仍繼續；不會讓挖掘／放置等待 remote round trip。

目前 ownership v1 使用伺服器簽署的 HttpOnly anonymous owner cookie，每個世界查詢與修改都加入 `ownerId` filter；猜測 world ID 不能跨 owner 讀取。Portal 正式會員登入 adapter 尚未完成，因此跨瀏覽器／跨裝置帳號同步仍標記 deferred，公開上線前應接入正式身份提供者。

## 部署至 Vercel

`apps/web` 是獨立可部署的 Next.js App Router 專案。NestJS/Fastify modular monolith 保留給獨立 backend host；Portal 與 `/play` 不會假設 Vercel 能維持常駐 Nest process，也不依賴 production Docker Compose。

1. 將完整 monorepo push 到 GitHub。
2. 在 Vercel Import Project 選擇該 repository。
3. 將 **Root Directory** 設成 `apps/web`，Framework Preset 選 Next.js。
4. `apps/web/vercel.json` 會使用 `pnpm build:vercel`；此命令先建置 workspace libraries，再執行原生 `next build`。
5. 在 Preview 與 Production environment 都設定以下 server-side variables：

```text
MONGODB_URI=mongodb+srv://<Atlas connection string>
MONGODB_DB_NAME=fangyu_nexus_game
AUTH_SECRET=<long random secret, at least 32 bytes>
```

`MONGODB_URI` 與 `AUTH_SECRET` 絕對不可加 `NEXT_PUBLIC_` prefix。它們只由 `apps/web/lib/server/*` 與 Node.js Route Handlers讀取，不會進 client bundle。`NEXT_PUBLIC_API_URL` 只有在另行部署 Nest Portal API 後才需要設定；本機 voxel 遊戲與 world Route Handlers 不依賴它。

MongoDB Atlas 端還需要建立 database user 與允許 Vercel runtime 連線的 Network Access 規則。Preview 建議使用獨立 database name 或獨立 cluster；不要讓未驗證的 Preview deployment 直接寫 production worlds。

Vercel 不提供 Docker Compose、PostgreSQL、Redis 或 MinIO 常駐容器。這些服務在 local development 繼續由 Docker 提供；production Portal API／worker 可獨立部署。`/play` 的 terrain generation、rendering 與 IndexedDB 離線存檔都在瀏覽器中執行，即使 serverless Mongo API 暫時不可用，頁面仍能建立並遊玩本機世界。

## 資料、Edition 與來源規則

- `Edition`、`GameVersion`、`ReleaseChannel` 是正式 domain model。
- Java 與 Bedrock 使用獨立版本與獨立資料列；所有 catalog、搜尋與 game-rules 輸入都需要 scope。
- 版本資料表支援 `valid_from`／`valid_to`；差異較穩定的欄位使用正規化 column，只有真正演進中的資料使用 JSONB。
- 每個正式資料 adapter 必須提供 `source`、`source_key`、`source_url`、`fetched_at`、`checksum`、`provenance`。
- 現有內容使用 `demo:*` namespace 與 `DEMO` badge，是 synthetic fixture，不代表正式 Minecraft 數值。

## 安全邊界

- 瀏覽器不得直接 ping 使用者輸入的主機，也不得連線 RCON。
- Ping worker 只允許受控埠，解析 DNS 後拒絕非 global unicast 位址，並把已驗證位址釘選到 job payload。
- RCON 尚未實作；未來密碼只允許保存在 server-side secret store，不能進 client bundle。
- NBT、litematic、schematic、datapack、zip 先進 quarantine；Web／API 主程序不做無界解析。
- production upload worker 必須再強制 size、decompression、timeout、magic-byte、掃描與狀態轉移限制。

## 環境變數

完整鍵值請看 `.env.example`。新增的 `MONGODB_URI`、`MONGODB_DB_NAME`、`AUTH_SECRET` 全部是 server-only；`.env`、`.env.local` 與其變體已被 Git 忽略，請勿提交真實密碼、API key 或 production endpoint。

## CI

GitHub Actions 會執行：

- Ubuntu：install、Docker Compose config、lint、typecheck、test、build
- Vercel smoke：shared package build + 原生 Next production build
- PostgreSQL service：migration 與 demo seed
- Windows／macOS／Ubuntu smoke matrix：install、typecheck、test

## 已知 Phase 1 限制

- 正式 Minecraft 全量資料尚未 ingest；目前只有明確標記的 synthetic fixture。
- Modrinth／CurseForge／Mojang adapter 尚未啟用正式網路同步。
- Server ping protocol adapter 尚未發送實際 Minecraft handshake；Phase 1 已完成 target validation 與 queue boundary。
- 進階 seed map、紅石 tick simulator、藍圖 parser、datapack sandbox 與 marketplace 交易仍為明確標示的 skeleton／deferred route。

## 已知遊戲限制

- 水方塊已有 registry／fluid-level metadata 與 collision 邊界，但透明水面 renderer 仍為 experimental。
- 洞穴是 deterministic 基礎生成，尚無洞穴生態、地下光照傳播或完整 ore distribution。
- 一種被動生物與一種敵對生物可生成、移動、偵測、攻擊、受傷與消失；navigation、掉落物實體拾取與 entity persistence 仍是簡化架構。
- Creative flying、music assets、容器、多人同步與 collaborative conflict resolution deferred。
- 目前環境沒有 MongoDB Atlas credentials；Atlas integration 需要部署者提供 `MONGODB_URI`。local integration 使用 Docker Compose 的 `mongo:8`。

## 品牌聲明

方域 Nexus 使用原創品牌與像素風視覺，不使用 Minecraft 官方 Logo，也不聲稱與 Mojang 或 Microsoft 有關。

**NOT AN OFFICIAL MINECRAFT PRODUCT/SERVICE. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.**
