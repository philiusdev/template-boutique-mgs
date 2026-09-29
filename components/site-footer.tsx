import Link from "next/link";
import { AgencyCredit } from "@/components/agency/AgencyCredit";

/**
 * Pied de page public, rendu côté serveur.
 *
 * Il est séparé de site-shell.tsx (qui est un composant client) précisément pour
 * pouvoir accueillir AgencyCredit : un Server Component, seul à même de lire la
 * variable MGS_WEBSITE_URL, ne peut pas être importé depuis un composant client.
 */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div>
          <Link href="/" className="brand footer-brand">
            <span className="brand-mark">R</span>
            <span className="brand-copy"><strong>Royal Shop</strong><small>La mode pour tous</small></span>
          </Link>
          <p>Des pièces uniques, choisies avec soin.<br />La seconde main qui vous ressemble.</p>
        </div>
        <div>
          <strong>Besoin d&apos;aide ?</strong>
          <p>Écrivez-nous sur WhatsApp<br />Du lundi au samedi, 9h – 18h</p>
        </div>
        <div>
          <strong>Retrouvez-nous</strong>
          <p>Burkina Faso<br />Livraison dans tout le pays</p>
        </div>
      </div>
      <div className="footer-bottom">© 2026 Royal Shop <span>Fait avec soin au Burkina Faso</span></div>
      <AgencyCredit />
    </footer>
  );
}
