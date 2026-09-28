import { StreetwearHome } from "@/components/streetwear-home";
import { getProducts, getSellerCityName } from "@/lib/data";

export default async function Home() {
  const [products, sellerCity] = await Promise.all([getProducts(), getSellerCityName()]);
  return <StreetwearHome products={products} sellerCity={sellerCity} />;
}
