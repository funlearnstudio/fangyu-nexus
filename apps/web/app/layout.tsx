import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PortalShell } from "@/components/PortalShell";
import { PortalProvider } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "方域 Nexus",
    template: "%s · 方域 Nexus",
  },
  description: "非官方、跨版本的 Minecraft 知識、工具、作品與社群平台。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  other: {
    "codex-preview": "development",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant" data-theme="dark" suppressHydrationWarning>
      <body>
        <PortalProvider>
          <PortalShell>{children}</PortalShell>
        </PortalProvider>
      </body>
    </html>
  );
}
