import { SearchResults } from "./SearchResults";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  return (
    <section className="content-page">
      <div className="breadcrumb">HOME / SEARCH</div>
      <header className="content-header">
        <div>
          <p className="eyebrow">GLOBAL SEARCH</p>
          <h1>搜尋：{q || "—"}</h1>
          <p>精確 namespaced ID 與當前 Edition／Version 優先。</p>
        </div>
      </header>
      <div className="home-section">
        <SearchResults query={q} />
      </div>
    </section>
  );
}
