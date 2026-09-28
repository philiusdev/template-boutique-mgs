import { demoProducts, HOME_PRODUCT_LIMIT, type Product } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { mapProduct } from "@/lib/product-mapper";

export { mapProduct } from "@/lib/product-mapper";

export { isSupabaseConfigured } from "@/lib/supabase/config";

export async function getProducts(limit = HOME_PRODUCT_LIMIT): Promise<Product[]> {
  if (!isSupabaseConfigured) return demoProducts.slice(0, limit);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id,slug,name,description,price,images,stock,condition,size,active,category_id,created_at,categories(name)")
    .eq("active", true)
    .gt("stock", 0)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Impossible de charger les produits : ${error.message}`);
  return (data ?? []).map(mapProduct);
}

export async function getProduct(slug: string): Promise<Product | null> {
  if (!isSupabaseConfigured) {
    return demoProducts.find((product) => product.slug === slug) ?? null;
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id,slug,name,description,price,images,stock,condition,size,active,category_id,created_at,categories(name)")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (error) throw new Error(`Impossible de charger le produit : ${error.message}`);
  return data ? mapProduct(data) : null;
}

export async function getSellerCityName(): Promise<string> {
  if (!isSupabaseConfigured) return "Bobo-Dioulasso";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cities")
    .select("name")
    .eq("is_seller_city", true)
    .maybeSingle();
  if (error) throw new Error(`Impossible de charger la ville de la boutique : ${error.message}`);
  if (!data?.name) throw new Error("Aucune ville de boutique n'est configurée dans Supabase.");
  return data.name;
}
