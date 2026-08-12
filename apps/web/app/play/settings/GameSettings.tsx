"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export interface ClientGameSettings {
  renderDistance: number;
  sensitivity: number;
  fov: number;
  music: number;
  sfx: number;
  quality: "low" | "balanced" | "high";
}
export const DEFAULT_GAME_SETTINGS: ClientGameSettings = {
  renderDistance: 3,
  sensitivity: 0.0022,
  fov: 75,
  music: 0,
  sfx: 0.35,
  quality: "balanced",
};
export function readGameSettings(): ClientGameSettings {
  try {
    return {
      ...DEFAULT_GAME_SETTINGS,
      ...JSON.parse(localStorage.getItem("fangyu-game-settings") || "{}"),
    };
  } catch {
    return DEFAULT_GAME_SETTINGS;
  }
}

export function GameSettings() {
  const [settings, setSettings] = useState(DEFAULT_GAME_SETTINGS);
  const [saved, setSaved] = useState(false);
  useEffect(() => setSettings(readGameSettings()), []);
  function update<K extends keyof ClientGameSettings>(
    key: K,
    value: ClientGameSettings[K],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }
  return (
    <div className="settings-page content-stack">
      <div className="section-heading">
        <div>
          <p className="eyebrow">GAME SETTINGS</p>
          <h1>遊戲設定</h1>
        </div>
        <Link href="/play">← 返回 Play</Link>
      </div>
      <section className="settings-card">
        <label>
          <span>Render Distance</span>
          <strong>{settings.renderDistance} chunks</strong>
          <input
            type="range"
            min="2"
            max="8"
            value={settings.renderDistance}
            onChange={(event) =>
              update("renderDistance", Number(event.target.value))
            }
          />
        </label>
        <label>
          <span>Mouse Sensitivity</span>
          <strong>{settings.sensitivity.toFixed(4)}</strong>
          <input
            type="range"
            min="0.0008"
            max="0.005"
            step="0.0002"
            value={settings.sensitivity}
            onChange={(event) =>
              update("sensitivity", Number(event.target.value))
            }
          />
        </label>
        <label>
          <span>Field of View</span>
          <strong>{settings.fov}°</strong>
          <input
            type="range"
            min="60"
            max="100"
            value={settings.fov}
            onChange={(event) => update("fov", Number(event.target.value))}
          />
        </label>
        <label>
          <span>Music（audio architecture）</span>
          <strong>{Math.round(settings.music * 100)}%</strong>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.music}
            onChange={(event) => update("music", Number(event.target.value))}
          />
        </label>
        <label>
          <span>Procedural SFX</span>
          <strong>{Math.round(settings.sfx * 100)}%</strong>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.sfx}
            onChange={(event) => update("sfx", Number(event.target.value))}
          />
        </label>
        <label>
          <span>Graphics Quality</span>
          <select
            value={settings.quality}
            onChange={(event) =>
              update(
                "quality",
                event.target.value as ClientGameSettings["quality"],
              )
            }
          >
            <option value="low">Low</option>
            <option value="balanced">Balanced</option>
            <option value="high">High</option>
          </select>
        </label>
        <button
          className="primary-link"
          type="button"
          onClick={() => {
            localStorage.setItem(
              "fangyu-game-settings",
              JSON.stringify(settings),
            );
            setSaved(true);
          }}
        >
          {saved ? "已儲存 ✓" : "儲存設定"}
        </button>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem("fangyu-replay-tutorial", "1");
            window.location.href = "/play";
          }}
        >
          Replay Tutorial（下次進入世界播放）
        </button>
      </section>
    </div>
  );
}
