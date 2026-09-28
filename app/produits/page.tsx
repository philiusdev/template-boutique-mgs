import { ProductGrid } from "@/components/product-grid";
import { getProducts } from "@/lib/data";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  const products = await getProducts(120);
  const categoryParam = (await searchParams).category;
  const initialCategory = typeof categoryParam === "string" ? categoryParam : undefined;
  return (
    <main className="page-wrap catalog-page">
      <p className="eyebrow">LA SÉLECTION ROYAL SHOP</p>
      <div className="section-heading catalog-page-heading">
        <div><h1>La collection <em>du moment</em></h1></div>
        <p>Chaque pièce est unique, choisie avec soin<br />et prête à rejoindre votre dressing.</p>
      </div>
      {products.length ? (
        <ProductGrid products={products} initialCategory={initialCategory} />
      ) : (
        <div className="empty-catalog"><span>✳</span><h2>La prochaine sélection arrive bientôt</h2><p>De nouvelles pièces arrivent très vite.</p></div>
      )}
    </main>
  );
}
