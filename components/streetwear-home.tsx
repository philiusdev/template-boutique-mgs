"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ProductGrid } from "@/components/product-grid";
import { useStore } from "@/components/store-provider";
import { getLookbookFeaturedProduct } from "@/lib/storefront";
import { formatCfa, type Product } from "@/lib/types";

type StreetwearHomeProps = {
  products: Product[];
  sellerCity: string;
};

export function StreetwearHome({ products, sellerCity }: StreetwearHomeProps) {
  const { demoMode, demoState } = useStore();
  const availableProducts = demoMode
    ? demoState.products.filter((product) => product.is_active && product.stock > 0)
    : products;
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const featuredProduct = availableProducts.find((product) => product.id === selectedProductId)
    ?? getLookbookFeaturedProduct(availableProducts);
  const featuredIndex = featuredProduct
    ? availableProducts.findIndex((product) => product.id === featuredProduct.id) + 1
    : 0;
  const featuredChoices = availableProducts.filter((product) => product.images[0]).slice(0, 4);
  const displayCity = demoMode
    ? demoState.cities.find((city) => city.is_seller_city)?.name ?? sellerCity
    : sellerCity;

  return (
    <main className="streetwear-page">
      <section className="streetwear-cover page-wrap" aria-labelledby="streetwear-title">
        <div className="streetwear-topline">
          <p>ROYAL SHOP <span>/</span> {displayCity}</p>
          <span>SECOND HAND · FIRST CHOICE</span>
        </div>
        {featuredProduct ? (
          <div className="streetwear-feature">
            <Link className="streetwear-photo" href={`/produits/${featuredProduct.slug}`} aria-label={`Voir ${featuredProduct.name}`}>
              {featuredProduct.images[0] ? <Image
                src={featuredProduct.images[0]}
                alt={featuredProduct.name}
                fill
                priority
                sizes="(max-width: 760px) 100vw, 64vw"
                quality={80}
                unoptimized={featuredProduct.images[0].startsWith("data:")}
              /> : <span className="streetwear-no-photo">{featuredProduct.category}</span>}
              <span className="streetwear-photo-index">{String(featuredIndex).padStart(2, "0")} <i>/</i> {String(availableProducts.length).padStart(2, "0")}</span>
              <span className="streetwear-image-copy">
                <small>PIÈCE UNIQUE · {featuredProduct.category.toUpperCase()}</small>
                <strong>{featuredProduct.name}</strong>
              </span>
            </Link>
            <div className="streetwear-product-copy">
              <p>DROP EN COURS <span>·</span> {displayCity.toUpperCase()}</p>
              <h1 id="streetwear-title">{featuredProduct.name}</h1>
              <span className="streetwear-condition">{featuredProduct.condition} <i /> Taille {featuredProduct.size ?? "unique"}</span>
              <strong className="streetwear-price">{formatCfa(featuredProduct.price)}</strong>
              <Link className="streetwear-link" href={`/produits/${featuredProduct.slug}`}>Voir la pièce <span aria-hidden="true">↗</span></Link>
              {featuredChoices.length > 1 && <div className="streetwear-choices" aria-label="Choisir la pièce mise en avant">
                {featuredChoices.map((product) => <div className="streetwear-choice" key={product.id}>
                  <button
                    type="button"
                    className="streetwear-thumb"
                    aria-label={`Afficher ${product.name}`}
                    aria-pressed={featuredProduct.id === product.id}
                    onClick={() => setSelectedProductId(product.id)}
                  >
                    <Image
                      src={product.images[0]}
                      alt=""
                      fill
                      sizes="72px"
                      quality={65}
                      unoptimized={product.images[0].startsWith("data:")}
                    />
                  </button>
                  <span>{product.category}</span>
                  <small>{formatCfa(product.price)}</small>
                </div>)}
              </div>}
            </div>
          </div>
        ) : (
          <div className="streetwear-empty">
            <p>ROYAL SHOP <span>/</span> {displayCity}</p>
            <h1 id="streetwear-title">Prochain drop en préparation.</h1>
            <p>Les nouvelles pièces apparaîtront ici dès leur mise en ligne.</p>
            <Link className="streetwear-link" href="/produits">Parcourir le catalogue <span aria-hidden="true">↗</span></Link>
          </div>
        )}
      </section>

      <section className="streetwear-collection page-wrap" id="collection">
        <div className="streetwear-collection-heading">
          <div><p>DISPONIBLE MAINTENANT</p><h2>Le vestiaire</h2></div>
          <Link href="/produits">Tout le stock <span aria-hidden="true">→</span></Link>
        </div>
        <ProductGrid products={products} />
      </section>
    </main>
  );
}
