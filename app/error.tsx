"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="cart-empty page-wrap">
      <span className="empty-icon">✳</span>
      <p className="eyebrow">UN PETIT CONTRETEMPS</p>
      <h1>La page ne s&apos;est pas chargée.</h1>
      <p>Un problème technique est survenu. Réessayez dans quelques instants ou revenez à la boutique.</p>
      <button className="button button-dark" onClick={reset}>Réessayer <span>→</span></button>
    </main>
  );
}
