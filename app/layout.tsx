import type { Metadata, Viewport } from "next";
import "./globals.css";
import "../components/agency.css";
import { NetworkNotice, SiteHeader } from "@/components/site-shell";
import { SiteFooter } from "@/components/site-footer";
import { StoreProvider } from "@/components/store-provider";
import { AgencyFloatingButton } from "@/components/agency/AgencyFloatingButton";
import { chargerEspaceAgence } from "@/lib/agency-bouton-flottant";

export const metadata: Metadata = {
  title: "Royal Shop — La mode pour tous",
  description:
    "Vêtements et accessoires choisis avec soin au Burkina Faso. Livraison partout dans le pays.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#171916",
};

/**
 * Le layout racine porte le bouton flottant de l'agence.
 *
 * POINT DE MONTAGE — pourquoi ici, et nulle part ailleurs :
 *
 * Le bouton doit exister sur TOUTES les pages : accueil, catalogue, fiche
 * produit, panier, commande, connexion, espace client, tableau de bord. Le layout
 * racine est le seul endroit du routeur Next dont c'est la définition même : il
 * enveloppe chaque page, présente ou future, sans qu'aucune d'elle ait à
 * s'en souvenir. Le monter dans `site-shell.tsx` aurait demandé d'y penser à
 * chaque nouvelle page ; le monter dans `app/admin/page.tsx` l'aurait borné au
 * dashboard. Une page ajoutée dans six mois porterait le bouton parce que le
 * layout le porte, et non parce qu'un développeur s'en est souvenu.
 *
 * L'ordre de rendu est respecté : le composant vient APRÈS `{children}` et après
 * le pied de page. Il est en `position: fixed`, il ne pousse donc rien, mais il
 * reste après le contenu dans l'ordre du document : au clavier, un lecteur
 * d'écran parcourt la page, puis la zone de dialogue — jamais l'inverse.
 *
 * Le layout devient `async` à cause de cette seule ligne. C'est sans
 * conséquence sur le rendu statique : les trois lectures de l'agence portent
 * `next: { revalidate }` (`lib/agency/client.ts`), elles sont mises en cache et
 * ne déclassent donc aucune page en rendu dynamique. Le site reste statique, et
 * ne paie la plateforme qu'une fois par fenêtre de 60 s. Voir
 * `lib/agency-bouton-flottant.ts` pour le coût exact quand la plateforme est
 * muette, et pour les deux gardes qui ferment la règle.
 *
 * `space` à `null` n'est pas un cas dégradé : c'est le mode normal d'un site
 * sans identifiants MGS, et le composant rend alors `null`. Aucun onglet vide,
 * aucun bouton fantôme, aucune erreur — la règle d'or du projet.
 *
 * Aucune identité n'est passée : le layout sert aussi les visiteurs anonymes, et
 * lire la session ici rendrait toute la boutique dynamique. Le demandeur est
 * repris côté serveur, au moment de l'envoi, par `/api/agency/request`.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const espaceAgence = await chargerEspaceAgence();
  return <html lang="fr"><body className="streetwear-site"><StoreProvider><NetworkNotice /><SiteHeader />{children}<SiteFooter /><AgencyFloatingButton space={espaceAgence} /></StoreProvider></body></html>;
}
