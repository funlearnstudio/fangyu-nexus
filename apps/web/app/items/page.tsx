import type { Metadata } from "next";
import { ItemsCatalog } from "./ItemsCatalog";

export const metadata: Metadata = {
  title: "物品與方塊",
};

export default function ItemsPage() {
  return (
    <section className="content-page">
      <div className="breadcrumb">HOME / EXPLORE / ITEMS</div>
      <header className="content-header">
        <div>
          <p className="eyebrow">BLOCKS, ITEMS & CRAFTING</p>
          <h1>物品與方塊資料庫</h1>
          <p>
            目前使用可驗證的 synthetic fixture。切換全域 Edition／Version
            後，目錄會即時改變。
          </p>
        </div>
      </header>
      <ItemsCatalog />
    </section>
  );
}
