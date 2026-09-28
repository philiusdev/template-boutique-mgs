import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product-detail";
import { getProduct } from "@/lib/data";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();
  return <ProductDetail product={product} />;
}
