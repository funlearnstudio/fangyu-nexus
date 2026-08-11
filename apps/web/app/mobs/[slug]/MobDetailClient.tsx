"use client";

import Link from "next/link";
import { MOBS } from "@fangyu/domain";
import { Card, EditionBadge, StatePanel, VersionBadge } from "@fangyu/ui";
import { ProvenancePanel } from "../../../components/ProvenancePanel";
import { usePortal } from "../../providers";

export function MobDetailClient({ slug }: { slug: string }) {
  const { edition, gameVersion } = usePortal();
  const mob = MOBS.find(
    (candidate) =>
      candidate.slug === slug &&
      candidate.edition === edition &&
      candidate.gameVersionId === gameVersion.id,
  );

  if (!mob) {
    return (
      <div className="content-stack">
        <StatePanel state="empty" title="此版別／版本找不到這個生物">
          不會跨 Edition 靜默顯示另一筆資料。請切換全域範圍，或返回生物圖鑑。
        </StatePanel>
        <Link className="text-link" href="/mobs">
          ← 返回生物圖鑑
        </Link>
      </div>
    );
  }

  return (
    <div className="content-stack">
      <div className="detail-layout">
        <Card className="detail-card">
          <div className="mob-glyph" aria-hidden="true">
            {mob.name.slice(0, 1)}
          </div>
          <p className="eyebrow">MOB / {mob.category.toUpperCase()}</p>
          <h1>{mob.name}</h1>
          <p>{mob.summary}</p>
          <div className="badge-row">
            <EditionBadge edition={mob.edition} />
            <VersionBadge version={gameVersion.name} />
          </div>
          <dl>
            <div>
              <dt>分類</dt>
              <dd>{mob.category}</dd>
            </div>
            <div>
              <dt>生命值</dt>
              <dd>{mob.health}（示範值）</dd>
            </div>
            <div>
              <dt>有效範圍</dt>
              <dd>
                {mob.validFrom} → {mob.validTo ?? "current fixture"}
              </dd>
            </div>
          </dl>
          <StatePanel state="stale" title="正式戰鬥數值尚未匯入">
            攻擊、掉落、AI 與生成條件不會用猜測值補齊；後續由版本化來源 adapter
            匯入。
          </StatePanel>
        </Card>
        <ProvenancePanel source={mob.source} />
      </div>
      <Link className="text-link" href="/mobs">
        ← 返回生物圖鑑
      </Link>
    </div>
  );
}
