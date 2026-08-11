import type { Metadata } from "next";
import { PlayLobby } from "./PlayLobby";

export const metadata: Metadata = { title: "開始遊戲" };
export default function PlayPage() {
  return <PlayLobby />;
}
