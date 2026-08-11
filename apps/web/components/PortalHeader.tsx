"use client";

import Link from "next/link";
import { usePortal } from "@/app/providers";
import { GlobalSearch } from "./GlobalSearch";

const navigation = [
  {
    label: "Explore",
    items: [
      ["/items", "物品與方塊"],
      ["/mobs", "生物圖鑑"],
      ["/biomes", "群系"],
      ["/versions", "版本時間軸"],
    ],
  },
  {
    label: "Build",
    items: [
      ["/crafting/calculator", "合成計算器"],
      ["/redstone", "紅石實驗室"],
      ["/commands", "指令工作室"],
      ["/skins/studio", "皮膚工坊"],
    ],
  },
  {
    label: "Play",
    items: [
      ["/play", "開始遊戲"],
      ["/play/settings", "遊戲設定"],
      ["/servers", "伺服器"],
      ["/mods", "模組"],
      ["/schematics", "藍圖"],
      ["/modpacks/resolver", "模組包解算"],
    ],
  },
  {
    label: "Community",
    items: [
      ["/community", "社群"],
      ["/marketplace", "作品中心"],
      ["/me", "我的工作區"],
      ["/admin", "管理中心"],
    ],
  },
] as const;

export function PortalHeader() {
  const {
    edition,
    gameVersion,
    versions,
    language,
    theme,
    setEdition,
    setGameVersionId,
    setLanguage,
    setTheme,
  } = usePortal();

  return (
    <header className="portal-header">
      <div className="header-main">
        <Link href="/" className="brand" aria-label="方域 Nexus 首頁">
          <span className="brand-mark" aria-hidden="true">
            方
          </span>
          <span>
            <strong>方域</strong>
            <small>NEXUS</small>
          </span>
        </Link>

        <nav className="desktop-nav" aria-label="主要導覽">
          {navigation.map((group) => (
            <details key={group.label}>
              <summary>{group.label}</summary>
              <div className="nav-menu">
                {group.items.map(([href, label]) => (
                  <Link href={href} key={href}>
                    {label}
                  </Link>
                ))}
              </div>
            </details>
          ))}
        </nav>

        <GlobalSearch compact />

        <div className="header-actions">
          <button
            className="icon-button"
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={theme === "dark" ? "切換淺色模式" : "切換深色模式"}
          >
            {theme === "dark" ? "☀" : "◐"}
          </button>
          <Link href="/me" className="avatar-link" aria-label="我的工作區">
            S
          </Link>
        </div>
      </div>

      <div className="context-bar">
        <span className="context-label">WORLD CONTEXT</span>
        <div className="segmented-control" aria-label="Edition">
          <button
            type="button"
            className={edition === "java" ? "active" : ""}
            onClick={() => setEdition("java")}
          >
            Java
          </button>
          <button
            type="button"
            className={edition === "bedrock" ? "active" : ""}
            onClick={() => setEdition("bedrock")}
          >
            Bedrock
          </button>
        </div>
        <label>
          <span className="sr-only">Game Version</span>
          <select
            value={gameVersion.id}
            onChange={(event) => setGameVersionId(event.target.value)}
          >
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                {version.name}
              </option>
            ))}
          </select>
        </label>
        <span className="fixture-chip">DEMO FIXTURE</span>
        <button
          className="language-button"
          type="button"
          onClick={() => setLanguage(language === "zh-TW" ? "en" : "zh-TW")}
        >
          {language === "zh-TW" ? "繁中" : "EN"}
        </button>
      </div>
    </header>
  );
}
