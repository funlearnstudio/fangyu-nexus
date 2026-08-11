import { ItemDetailClient } from "./ItemDetailClient";

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <section className="content-page">
      <div className="breadcrumb">HOME / EXPLORE / ITEMS / {slug}</div>
      <ItemDetailClient slug={slug} />
    </section>
  );
}
