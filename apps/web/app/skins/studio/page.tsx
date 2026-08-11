import type { Metadata } from "next";
import { SkinStudioClient } from "./SkinStudioClient";

export const metadata: Metadata = {
  title: "3D 皮膚工坊｜方域 Nexus",
  description: "Steve／Alex 幾何、外層、披風與動畫架構的瀏覽器 3D 預覽。",
};

export default function SkinStudioPage() {
  return <SkinStudioClient />;
}
