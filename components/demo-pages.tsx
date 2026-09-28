"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminDashboard } from "@/components/admin-dashboard";
import { ProductDetail } from "@/components/product-detail";
import { Reveal } from "@/components/reveal";
import { useStore } from "@/components/store-provider";
import { formatCfa, ORDER_STATUS_LABELS, type DemoState } from "@/lib/types";
import { BurkinaPhoneInput } from "@/components/burkina-phone-input";
import { getNameMonogram } from "@/lib/name";
import { isValidBurkinaPhoneNumber, toBurkinaPhoneNumber, toBurkinaPhoneHref, toSavedBurkinaPhoneNumber } from "@/lib/phone";

export function DemoAdminPage() {
  const { role, userEmail, demoReady } = useStore();
  if (!demoReady) return <main className="page-wrap"><p>Chargement de la démo…</p></main>;
  if (role !== "admin") return <main className="cart-empty page-wrap">
    <p className="eyebrow">ESPACE ADMIN · MODE DÉMO</p>
    <h1>Connecte-toi à l’administration de démonstration.</h1>
    <p>Utilise le bouton « Tester l’administration » en haut de page ou choisis un profil ci-dessous.</p>
    <Link className="button button-dark" href="/connexion?next=/admin">Choisir un profil de démo <span>→</span></Link>
  </main>;
  return <AdminDashboard email={userEmail ?? "admin@atelier-naya.demo"} />;
}

export function DemoProductDetail({ slug }: { slug: string }) {
  const { demoReady, demoState } = useStore();
  if (!demoReady) return <main className="page-wrap"><p>Chargement de la pièce…</p></main>;
  const product = demoState.products.find((item) => item.slug === slug && item.is_active);
  if (!product) return <main className="cart-empty page-wrap"><p className="eyebrow">COLLECTION</p><h1>Cette pièce n’est pas disponible.</h1><Link className="button button-dark" href="/produits">Voir la collection <span>→</span></Link></main>;
  const similar = demoState.products.filter((item) => item.category_id === product.category_id && item.id !== product.id && item.is_active).slice(0, 4);
  return <><ProductDetail product={product} />{similar.length > 0 && <section className="page-wrap similar-products"><div className="section-heading"><div><p className="eyebrow">À DÉCOUVRIR AUSSI</p><h2>Des pièces <em>dans le même esprit</em></h2></div></div><Reveal className="catalog-reveal"><div className="product-grid">{similar.map((item) => <article className="product-card" key={item.id}><Link href={`/produits/${item.slug}`} className="product-photo">{item.images[0] && <Image src={item.images[0]} alt={item.name} fill sizes="(max-width: 600px) 48vw, 23vw" unoptimized={item.images[0].startsWith("data:")} />}<span className="condition-tag">{item.condition}</span></Link><div className="product-info"><span className="product-category">{item.category}</span><Link href={`/produits/${item.slug}`}><h3>{item.name}</h3></Link><strong>{formatCfa(item.price)}</strong></div></article>)}</div></Reveal></section>}</>;
}

export function DemoOrdersPage() {
  const { demoReady, demoState, userEmail, role, loginDemo } = useStore();
  if (!demoReady) return <main className="page-wrap"><p>Chargement des commandes de démo…</p></main>;
  if (!userEmail) return <main className="cart-empty page-wrap">
    <p className="eyebrow">SUIVI DES COMMANDES · MODE DÉMO</p>
    <h1>Connecte-toi pour suivre tes commandes.</h1>
    <button className="button button-dark" onClick={() => loginDemo("client@atelier-naya.demo", "client")}>Continuer comme cliente <span>→</span></button>
    <p><Link href="/connexion?next=/mes-commandes">Ou choisir un autre profil de démo</Link></p>
  </main>;
  const orders = demoState.orders.filter((order) => order.profiles?.email === userEmail);
  return <main className="page-wrap orders-page">
    <p className="eyebrow">VOTRE ESPACE · MODE DÉMO</p>
    <h1>Mes commandes</h1>
    <p className="orders-welcome">Connectée en tant que <strong>{userEmail}</strong></p>
    {orders.length ? <div className="orders-list">{orders.map((order) => <article className="order-card" key={order.id}>
      <div className="order-card-head">
        <div><span className="order-reference">Commande #{order.id.slice(0, 8).toUpperCase()}</span><small>{new Date(order.created_at).toLocaleDateString("fr-FR", { dateStyle: "long" })}</small></div>
        <span className={`status-badge status-${order.status}`}>{ORDER_STATUS_LABELS[order.status]}</span>
      </div>
      <div className="order-card-content">
        <div className="order-lines">{order.order_items.map((item) => <div className="order-line" key={item.id}><span className="order-item-copy">{item.product_image && <Image src={item.product_image} alt="" width={48} height={58} unoptimized={item.product_image.startsWith("data:")} />}<span>{item.product_name} <small>× {item.quantity}</small></span></span><strong>{formatCfa(item.unit_price * item.quantity)}</strong></div>)}</div>
        <div className="order-meta">
          <div><span>Livraison à</span><strong>{order.neighborhoods?.name}, {order.cities?.name}</strong></div>
          <div><span>Mode</span><strong>{order.delivery_type === "store_pickup" ? "Retrait en boutique" : order.delivery_type === "local_delivery" ? "Livraison locale" : order.transport_companies?.name ?? "Transport interurbain"}</strong></div>
          {order.payment_proofs[0] && <div><span>Paiement</span><strong>{order.payment_proofs[0].payment_method}</strong></div>}
        </div>
        {(toSavedBurkinaPhoneNumber(order.contact_phone) || toSavedBurkinaPhoneNumber(demoState.shopPhone)) && <div className="order-contact-section">
          <small>NOUS CONTACTER EN CAS DE BESOIN</small>
          <div className="order-contact-numbers">
          {toSavedBurkinaPhoneNumber(order.contact_phone) && <div><span>Numéro laissé pour cette commande</span><a href={toBurkinaPhoneHref(order.contact_phone)}>{toSavedBurkinaPhoneNumber(order.contact_phone)}</a></div>}
          {toSavedBurkinaPhoneNumber(demoState.shopPhone) && <div><span>Appeler la boutique</span><a href={toBurkinaPhoneHref(demoState.shopPhone)}>{toSavedBurkinaPhoneNumber(demoState.shopPhone)}</a></div>}
          </div>
        </div>}
      </div>
      <div className="order-card-foot"><span>Total de la commande</span><strong>{formatCfa(order.total)}</strong></div>
      {order.payment_proofs[0] && <div className="proof-link"><Image src={order.payment_proofs[0].screenshot_url} alt="Preuve de paiement fictive" width={88} height={88} unoptimized />Preuve de démonstration</div>}
      {order.payment_proofs[0]?.status === "rejected" && order.payment_proofs[0].rejection_reason && <p className="form-message error">Preuve refusée : {order.payment_proofs[0].rejection_reason}</p>}
      {order.status === "rejected" && <DemoProofResend orderId={order.id} />}
    </article>)}</div> : <div className="empty-catalog orders-empty"><span>♡</span><h2>Pas encore de commande</h2><p>Ajoute un article au panier pour tester le tunnel.</p><Link className="button button-dark" href="/produits">Découvrir la collection <span>→</span></Link></div>}
    {role === "admin" && <p className="demo-note">Tu es connectée au profil admin. Utilise le bouton d’administration en haut de page pour traiter les commandes.</p>}
  </main>;
}

function DemoProofResend({ orderId }: { orderId: string }) {
  const { demoState, updateDemoState } = useStore();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const order = demoState.orders.find((item) => item.id === orderId);
  if (!order) return null;
  return <div className="proof-recovery">
    <strong>Renvoyer une preuve de démonstration</strong>
    <button className="button button-dark button-small" disabled={sent} onClick={() => {
      const insufficientStock = order.order_items.some((item) => {
        const product = demoState.products.find((candidate) => candidate.id === item.product_id);
        return !product || product.stock < item.quantity;
      });
      if (insufficientStock) {
        setError("Le stock disponible ne suffit plus pour renvoyer cette commande.");
        return;
      }
      updateDemoState((state) => ({
        ...state,
        products: state.products.map((product) => {
          const quantity = order.order_items.filter((item) => item.product_id === product.id).reduce((sum, item) => sum + item.quantity, 0);
          return quantity ? { ...product, stock: product.stock - quantity } : product;
        }),
        orders: state.orders.map((item) => item.id === orderId ? {
          ...item,
          status: "pending_verification",
          payment_proofs: item.payment_proofs.map((proof) => ({
            ...proof,
            id: crypto.randomUUID(),
            status: "pending",
            rejection_reason: null,
          })),
        } : item),
      }));
      setSent(true);
      setError("");
    }}>{sent ? "Preuve renvoyée" : "Simuler l’envoi d’une nouvelle preuve"}</button>
    {error && <span className="field-error">{error}</span>}
  </div>;
}

export function DemoProfilePage() {
  const router = useRouter();
  const { demoReady, demoState, updateDemoState, userEmail, loginDemo, logoutDemo } = useStore();
  if (!demoReady) return <main className="page-wrap"><p>Chargement du profil de démo…</p></main>;
  if (!userEmail) return <main className="cart-empty page-wrap"><p className="eyebrow">VOTRE ESPACE</p><h1>Connecte-toi pour voir ton profil.</h1><button className="button button-dark" onClick={() => loginDemo("client@atelier-naya.demo", "client")}>Continuer comme cliente <span>→</span></button></main>;
  return <DemoProfileEditor demoState={demoState} updateDemoState={updateDemoState} userEmail={userEmail} onSignOut={() => { logoutDemo(); router.push("/"); }} />;
}

function DemoProfileEditor({
  demoState,
  updateDemoState,
  userEmail,
  onSignOut,
}: {
  demoState: DemoState;
  updateDemoState: ReturnType<typeof useStore>["updateDemoState"];
  userEmail: string;
  onSignOut: () => void;
}) {
  const [notice, setNotice] = useState("");
  const [fullName, setFullName] = useState(demoState.profile.full_name);
  const [phoneNumberOverride, setPhoneNumberOverride] = useState<string | null>(null);
  const phoneNumber = phoneNumberOverride ?? toBurkinaPhoneNumber(demoState.profile.phone_number);
  const [cityId, setCityId] = useState(demoState.profile.default_city_id);
  const [neighborhoodId, setNeighborhoodId] = useState(demoState.profile.default_neighborhood_id);
  return <main className="page-wrap profile-page">
    <p className="eyebrow">VOTRE ESPACE · MODE DÉMO</p><h1>Mon profil</h1><p className="profile-intro">Gérez vos coordonnées et vos préférences de livraison.</p>
    <section className="profile-card">
      <div className="profile-identity">
        <span className="profile-avatar" aria-label={`Monogramme ${fullName || userEmail}`}>{getNameMonogram(fullName, userEmail)}</span>
        <div className="profile-identity-copy"><small>MON COMPTE</small><strong className="profile-display-name">{fullName.trim() || "Votre compte"}</strong><span className="profile-email-address">{userEmail}</span></div>
      </div>
      <form className="profile-form" autoComplete="off" onSubmit={(event) => {
        event.preventDefault();
        if (!isValidBurkinaPhoneNumber(phoneNumber)) {
          setNotice("Saisissez les 8 chiffres de votre numéro après +226.");
          return;
        }
        if (Boolean(cityId) !== Boolean(neighborhoodId) || (neighborhoodId && !demoState.neighborhoods.some((item) => item.id === neighborhoodId && item.city_id === cityId))) {
          setNotice("Choisis une ville et un quartier correspondant, ou efface les deux préférences.");
          return;
        }
        updateDemoState((state) => ({ ...state, profile: { ...state.profile, full_name: fullName.trim(), phone_number: phoneNumber, default_city_id: cityId, default_neighborhood_id: neighborhoodId } }));
        setNotice("Profil de démonstration enregistré sur cet appareil.");
      }}>
        <div className="profile-section-heading"><strong>Informations personnelles</strong><span>Ces informations facilitent le suivi de vos commandes.</span></div>
        <label className="field-group"><span className="field-label">Nom complet</span><input className="text-input" name="full_name" autoComplete="name" placeholder="Ex. Aïcha Traoré" value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
        <label className="field-group"><span className="field-label">Téléphone</span><BurkinaPhoneInput id="demo-profile-phone" name="phone_number" value={phoneNumber} onChange={setPhoneNumberOverride} required /></label>
        <label className="field-group"><span className="field-label">Ville habituelle</span><select className="text-input" name="city_id" value={cityId} onChange={(event) => { setCityId(event.target.value); setNeighborhoodId(""); }}><option value="">Aucune préférence</option>{demoState.cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label>
        <label className="field-group"><span className="field-label">Quartier habituel</span><select className="text-input" name="neighborhood_id" value={neighborhoodId} disabled={!cityId} onChange={(event) => setNeighborhoodId(event.target.value)}><option value="">Aucune préférence</option>{demoState.neighborhoods.filter((item) => item.city_id === cityId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <button className="button button-dark" type="submit">Enregistrer mon profil <span>→</span></button>
      </form>
      {notice && <p className="form-message success" role="status">{notice}</p>}
      <aside className="profile-contact-panel">
        <div className="profile-contact-line">
          <span>Votre numéro pour les commandes</span>
          <strong>{toSavedBurkinaPhoneNumber(phoneNumber) || "Ajoutez un numéro dans le formulaire ci-dessus."}</strong>
        </div>
        {toSavedBurkinaPhoneNumber(demoState.shopPhone) && <div className="profile-contact-line">
          <span>Besoin d’aide ? Appelez la boutique</span>
          {toBurkinaPhoneHref(demoState.shopPhone) && <a href={toBurkinaPhoneHref(demoState.shopPhone)}>{toSavedBurkinaPhoneNumber(demoState.shopPhone)}</a>}
        </div>}
      </aside>
      <div className="profile-links"><Link href="/mes-commandes">Voir mes commandes →</Link><button className="text-button" onClick={onSignOut}>Se déconnecter</button></div>
    </section>
  </main>;
}
