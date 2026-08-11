import type { Metadata } from "next";
import { MobDetailClient } from "./MobDetailClient";

export const metadata: Metadata = {
  title: "生物詳情｜方域 Nexus",
};

export default async function MobDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <MobDetailClient slug={slug} />;
}
