import type { Metadata } from "next";
import { GameWorldClient } from "./GameWorldClient";

export const metadata: Metadata = { title: "Voxel World" };
export default function WorldPage() {
  return <GameWorldClient />;
}
