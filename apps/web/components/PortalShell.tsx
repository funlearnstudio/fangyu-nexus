import type { ReactNode } from "react";
import { PortalFooter } from "./PortalFooter";
import { PortalHeader } from "./PortalHeader";

export function PortalShell({ children }: { children: ReactNode }) {
  return (
    <div className="portal-shell">
      <PortalHeader />
      <main className="page-shell">{children}</main>
      <PortalFooter />
    </div>
  );
}
