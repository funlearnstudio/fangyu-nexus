"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { GameMode, GameWorldMetadata } from "@fangyu/voxel-engine";
import { usePortal } from "@/app/providers";
import {
  createWorldMetadata,
  deleteLocalWorld,
  listLocalWorlds,
  hydrateCloudWorlds,
  putLocalWorld,
  syncWorldToCloud,
} from "@/lib/game/local-worlds";

export function PlayLobby() {
  const { edition, gameVersion } = usePortal();
  const [worlds, setWorlds] = useState<GameWorldMetadata[]>([]);
  const [name, setName] = useState("我的方域");
  const [seed, setSeed] = useState("");
  const [gameMode, setGameMode] = useState<GameMode>("survival");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void listLocalWorlds().then(setWorlds);
    void hydrateCloudWorlds().then(setWorlds);
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    const world = createWorldMetadata({
      name: name.trim() || "未命名方域",
      seed,
      gameMode,
      edition,
      gameVersion: gameVersion.name,
      renderDistance: 3,
    });
    await putLocalWorld(world);
    void syncWorldToCloud(world);
    window.location.assign(`/play/world?id=${encodeURIComponent(world.id)}`);
  }

  return (
    <div className="play-lobby content-stack">
      <section className="play-intro">
        <div>
          <p className="eyebrow">ORIGINAL VOXEL SURVIVAL · NEXUS JOURNEY</p>
          <h1>進入一個會被記住的方域。</h1>
          <p>
            程序生成地形、真正的 chunk mesh、第一人稱物理與離線 IndexedDB
            存檔。所有視覺素材均為原創程序配色。
          </p>
        </div>
        <Link className="secondary-link" href="/play/settings">
          遊戲設定
        </Link>
      </section>

      <section className="play-lobby-grid">
        <form className="world-create-card" onSubmit={create}>
          <p className="eyebrow">CREATE WORLD</p>
          <h2>建立世界</h2>
          <label>
            <span>世界名稱</span>
            <input
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label>
            <span>Seed（留空自動產生）</span>
            <input
              value={seed}
              maxLength={128}
              onChange={(event) => setSeed(event.target.value)}
              placeholder="aurora-42"
            />
          </label>
          <fieldset>
            <legend>遊戲模式</legend>
            <label className="mode-option">
              <input
                type="radio"
                checked={gameMode === "survival"}
                onChange={() => setGameMode("survival")}
              />{" "}
              Survival <small>有限背包、生命、飢餓與掉落</small>
            </label>
            <label className="mode-option">
              <input
                type="radio"
                checked={gameMode === "creative"}
                onChange={() => setGameMode("creative")}
              />{" "}
              Creative <small>無限方塊、無墜落傷害</small>
            </label>
          </fieldset>
          <div className="world-context-summary">
            <span>{edition.toUpperCase()}</span>
            <span>{gameVersion.name}</span>
            <span>LOCAL-FIRST</span>
          </div>
          <button className="primary-link" type="submit" disabled={creating}>
            {creating ? "建立中…" : "建立並進入 →"}
          </button>
        </form>

        <div className="world-list-card">
          <p className="eyebrow">LOCAL WORLDS</p>
          <h2>我的世界</h2>
          {worlds.length === 0 ? (
            <div className="play-empty">
              還沒有本機世界。建立後，即使 MongoDB 暫時離線仍可遊玩。
            </div>
          ) : (
            <div className="world-list">
              {worlds.map((world) => (
                <article key={world.id}>
                  <div>
                    <h3>{world.name}</h3>
                    <p>
                      {world.gameMode} · seed {world.seed.slice(0, 22)}
                    </p>
                    <small>
                      {new Date(world.lastPlayedAt).toLocaleString("zh-TW")}
                    </small>
                  </div>
                  <div>
                    <Link
                      className="primary-link compact-link"
                      href={`/play/world?id=${world.id}`}
                    >
                      進入
                    </Link>
                    <button
                      type="button"
                      className="text-button danger"
                      onClick={async () => {
                        if (
                          !window.confirm(`刪除「${world.name}」的本機存檔？`)
                        )
                          return;
                        await deleteLocalWorld(world.id);
                        setWorlds(await listLocalWorlds());
                        void fetch(`/api/worlds/${world.id}`, {
                          method: "DELETE",
                        });
                      }}
                    >
                      刪除
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
      <section className="implementation-note">
        <strong>世界內容：</strong> 50 關 Nexus
        Journey、十種生態系、水域、洞穴、
        生物、農耕、聚落居民、支線、加工、儲存與有限 Nexus 快速旅行。
        <br />
        世界採 local-first 存檔；網路暫時離線時仍可遊玩，恢復後再批次同步。
      </section>
    </div>
  );
}
