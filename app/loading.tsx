export default function Loading() {
  return (
    <main className="route-loading" role="status" aria-live="polite">
      <span className="route-loading-mark">R</span>
      <span>Royal Shop s&apos;ouvre…</span>
      <span className="loader" />
    </main>
  );
}
