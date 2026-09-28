import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product-detail";
import { getProduct, getProducts } from "@/lib/data";
import { ProductGrid } from "@/components/product-grid";
import { isDemoMode } from "@/lib/supabase/config";
import { DemoProductDetail } from "@/components/demo-pages";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [product, products] = await Promise.all([getProduct(slug), getProducts(48)]);
  if (!product && isDemoMode) return <DemoProductDetail slug={slug} />;
  if (!product) notFound();
  const similar = products.filter((item) => item.category_id === product.category_id && item.id !== product.id).slice(0, 4);
  return (
    <>
      <ProductDetail product={product} />
      {similar.length > 0 && <section className="page-wrap similar-products">
        <div className="section-heading"><div><p className="eyebrow">À DÉCOUVRIR AUSSI</p><h2>Des pièces <em>dans le même esprit</em></h2></div></div>
        <ProductGrid products={similar} />
      </section>}
    </>
  );
}
