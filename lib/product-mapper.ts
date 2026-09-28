import type { Product } from "@/lib/types";

export function mapProduct(row: {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  stock: number;
  condition: string;
  size: string | null;
  active: boolean;
  category_id: string | null;
  created_at: string;
  categories: { name: string } | { name: string }[] | null;
}): Product {
  const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
  const conditions: Record<string, string> = {
    neuf: "Neuf",
    excellent: "Excellent état",
    tres_bon: "Très bon état",
    bon: "Bon état",
    occasion: "Occasion",
  };
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    images: row.images ?? [],
    stock: row.stock,
    category: category?.name ?? "Sans catégorie",
    category_id: row.category_id,
    condition: conditions[row.condition] ?? row.condition,
    size: row.size,
    is_active: row.active,
    created_at: row.created_at,
  };
}
