import type { Product } from "@/lib/types";

export function getLookbookFeaturedProduct(products: Product[]): Product | undefined {
  return products.find((product) => product.is_active && product.stock > 0 && product.images[0])
    ?? products.find((product) => product.is_active && product.stock > 0);
}
