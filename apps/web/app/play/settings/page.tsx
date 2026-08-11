import type { Metadata } from "next";
import { GameSettings } from "./GameSettings";
export const metadata: Metadata = { title: "遊戲設定" };
export default function SettingsPage() {
  return <GameSettings />;
}
