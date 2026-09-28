import Link from "next/link";

export default function NotFound() {
  return (
    <main className="cart-empty page-wrap">
      <span className="empty-icon">✳</span>
      <p className="eyebrow">CETTE PIÈCE S&apos;EST ENVOLÉE</p>
      <h1>Introuvable, mais pas irrécupérable.</h1>
      <p>Cette page n&apos;existe pas ou l&apos;article a déjà trouvé sa nouvelle maison.</p>
      <Link className="button button-dark" href="/">Retourner à la boutique <span>→</span></Link>
    </main>
  );
}
