"use client";

import dynamic from "next/dynamic";
import { Badge, Card, StatePanel } from "@fangyu/ui";

const SkinViewer = dynamic(
  () => import("./SkinViewer").then((module) => module.SkinViewer),
  {
    ssr: false,
    loading: () => (
      <StatePanel state="loading" title="正在載入 3D 渲染器">
        Three.js 僅在需要預覽時載入，不會阻塞網站其餘內容。
      </StatePanel>
    ),
  },
);

export function SkinStudioClient() {
  return (
    <div className="content-stack skin-studio-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">BUILD / SKIN STUDIO</p>
          <h1>3D 皮膚工坊</h1>
          <p>
            可操作的 Phase 1
            幾何預覽器。使用原創示範材質，不會冒充玩家正式皮膚；Mojang
            玩家查詢將由後端 adapter 在後續切片接入。
          </p>
        </div>
        <div className="badge-row">
          <Badge tone="success">Phase 1 可用</Badge>
          <Badge tone="source">WebGPU → WebGL2 fallback</Badge>
        </div>
      </header>

      <SkinViewer />

      <Card className="implementation-note">
        <p className="eyebrow">安全與來源</p>
        <h2>目前不連接玩家帳號</h2>
        <p>
          本頁只渲染本地產生的方塊幾何與示範顏色。正式皮膚抓取會經由 server-side
          Mojang adapter、快取與來源紀錄，不讓瀏覽器直接承擔權限或來源判斷。
        </p>
      </Card>
    </div>
  );
}
