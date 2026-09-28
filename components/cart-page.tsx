"use client";

import Image from "next/image";
import Link from "next/link";
import { useStore } from "@/components/store-provider";
import { formatCfa } from "@/lib/types";

export function CartPage() {
  const { cart, subtotal, updateQuantity, removeFromCart } = useStore();
  const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
  if (!cart.length) {
    return (
      <main className="page-wrap cart-empty">
        <span className="empty-icon">♡</span>
        <p className="eyebrow">Votre sélection</p>
        <h1>Votre panier est encore vide</h1>
        <p>De belles trouvailles vous attendent dans notre collection.</p>
        <Link className="button button-dark" href="/#collection">Découvrir la collection <span>→</span></Link>
      </main>
    );
  }
  return (
    <main className="page-wrap cart-page">
      <p className="eyebrow">Votre sélection</p>
      <h1>Mon panier <span className="muted">({itemCount} pièce{itemCount === 1 ? "" : "s"})</span></h1>
      <div className="cart-layout">
        <div className="cart-items">
          {cart.map(({ product, quantity }) => (
            <article className="cart-item" key={product.id}>
              <Link href={`/produits/${product.slug}`} className="cart-photo">
                {product.images[0] && <Image src={product.images[0]} alt={product.name} fill sizes="110px" unoptimized={product.images[0].startsWith("data:")} />}
              </Link>
              <div className="cart-product-copy">
                <span className="product-category">{product.category}</span>
                <h2>{product.name}</h2>
                <p>Taille {product.size ?? "unique"} · {product.condition}</p>
                <div className="quantity-control">
                  <button onClick={() => updateQuantity(product.id, quantity - 1)} aria-label="Retirer un article">−</button>
                  <span>{quantity}</span>
                  <button onClick={() => updateQuantity(product.id, quantity + 1)} aria-label={`Ajouter un article ${product.name}`} disabled={quantity >= product.stock}>＋</button>
                </div>
              </div>
              <div className="cart-item-end"><strong>{formatCfa(product.price * quantity)}</strong><button className="text-button" onClick={() => removeFromCart(product.id)}>Retirer</button></div>
            </article>
          ))}
          <Link className="back-link" href="/produits">← Continuer mes achats</Link>
        </div>
        <aside className="order-summary">
          <h2>Récapitulatif</h2>
          <div className="summary-line"><span>Sous-total</span><strong>{formatCfa(subtotal)}</strong></div>
          <div className="summary-line"><span>Livraison</span><span className="muted">Calculée à l&apos;étape suivante</span></div>
          <div className="summary-total"><span>Total</span><strong>{formatCfa(subtotal)}</strong></div>
          <Link href="/commande" className="button button-dark full-width">Passer commande <span>→</span></Link>
          <p className="secure-note">Paiement sécurisé par Orange Money, Wave ou Moov Money</p>
        </aside>
      </div>
    </main>
  );
}
