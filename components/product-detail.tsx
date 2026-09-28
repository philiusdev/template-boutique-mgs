"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/components/store-provider";
import { formatCfa, type Product } from "@/lib/types";

export function ProductDetail({ product }: { product: Product }) {
  const router = useRouter();
  const { addToCart, demoMode, demoState } = useStore();
  const currentProduct = demoMode
    ? demoState.products.find((item) => item.slug === product.slug) ?? product
    : product;
  const [added, setAdded] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const images = currentProduct.images.length ? currentProduct.images : [""];
  return (
    <main className="page-wrap product-detail-page">
      <div className="breadcrumbs"><Link href="/">Accueil</Link><span>/</span><Link href="/produits">Collection</Link><span>/</span><span>{currentProduct.name}</span></div>
      <div className="product-detail-layout">
        <div className="detail-gallery">
          <div className="detail-main-image">
            {images[selectedImage] ? <Image src={images[selectedImage]} alt={currentProduct.name} fill priority sizes="(max-width: 760px) 100vw, 55vw" unoptimized={images[selectedImage].startsWith("data:")} /> : <div className="image-placeholder">Royal Shop</div>}
            <span className="condition-tag">{currentProduct.condition}</span>
          </div>
          {images.length > 1 && <div className="detail-thumbnails">{images.map((image, index) => <button className={selectedImage === index ? "active" : ""} key={image} onClick={() => setSelectedImage(index)} aria-label={`Voir la photo ${index + 1}`}><Image src={image} alt="" fill sizes="80px" unoptimized={image.startsWith("data:")} /></button>)}</div>}
        </div>
        <div className="detail-info">
          <p className="eyebrow">{currentProduct.category} <span>·</span> {currentProduct.condition}</p>
          <h1>{currentProduct.name}</h1>
          <strong className="detail-price">{formatCfa(currentProduct.price)}</strong>
          <div className="detail-divider" />
          <p className="detail-description">{currentProduct.description}</p>
          <div className="detail-specs">
            <div><span>Taille</span><strong>{currentProduct.size ?? "Taille unique"}</strong></div>
            <div><span>État</span><strong>{currentProduct.condition}</strong></div>
            <div><span>Disponibilité</span><strong>{currentProduct.stock > 0 ? "En stock" : "Indisponible"}</strong></div>
          </div>
          <div className="detail-purchase-actions">
            <button className="button button-outline detail-buy-button" disabled={currentProduct.stock < 1} onClick={() => { addToCart(currentProduct); router.push("/commande"); }}>
              Acheter maintenant <span>→</span>
            </button>
            <button className="button button-dark detail-add-button" disabled={currentProduct.stock < 1} onClick={() => { addToCart(currentProduct); setAdded(true); }}>
              {added ? "Ajouté au panier ✓" : "Ajouter au panier"}
            </button>
          </div>
          <p className="detail-note">✳ Chaque pièce est unique — premier arrivé, premier servi.</p>
          <Link href="/panier" className="text-link">Voir mon panier <span>→</span></Link>
        </div>
      </div>
    </main>
  );
}
