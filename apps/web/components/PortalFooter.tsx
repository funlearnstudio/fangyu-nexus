import Link from "next/link";

export function PortalFooter() {
  return (
    <footer className="portal-footer">
      <div>
        <strong>方域 Nexus</strong>
        <p>跨版本知識、工具與創作空間。Phase 1 engineering build。</p>
      </div>
      <nav aria-label="頁尾導覽">
        <Link href="/about/demo-data">Demo Data</Link>
        <Link href="/versions">Sources</Link>
        <Link href="/community">Community</Link>
        <Link href="/admin">Moderation</Link>
      </nav>
      <p className="legal-disclaimer">
        NOT AN OFFICIAL MINECRAFT PRODUCT/SERVICE. NOT APPROVED BY OR ASSOCIATED
        WITH MOJANG OR MICROSOFT.
      </p>
    </footer>
  );
}
