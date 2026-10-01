import type { Metadata, Viewport } from "next";
import "./globals.css";
import "../components/agency.css";
import { NetworkNotice, SiteHeader } from "@/components/site-shell";
import { SiteFooter } from "@/components/site-footer";
import { StoreProvider } from "@/components/store-provider";

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
 * Le layout racine n'est plus `async` : il ne lit plus rien.
 *
 * POINT DE MONTAGE — pourquoi l'espace « Mon agence » est INTERDIT ici, et
 * pourquoi il vit dans `app/admin/page.tsx` :
 *
 * Ce fichier enveloppe TOUTES les pages du site, y compris celles qu'un
 * visiteur anonyme ouvre sans se connecter : l'accueil, le catalogue, une fiche
 * produit, le panier, la commande. Or `AgencySpace` n'est pas une page publique
 * de l'agence : c'est le DOSSIER COMMERCIAL DU COMMERCÇANT. Il contient son
 * nom d'agence, sa formule d'abonnement, son tarif, ses avantages, ses
 * factures impayées (numéro, montant, échéance), et le suivi de ses demandes
 * avec l'objet, le devis et les coordonnées du demandeur. Le commerçant est le
 * SEUL client de l'agence — c'est son abonnement et ses factures. Un visiteur
 * n'a aucun abonnement à voir et n'a aucun droit à le voir.
 *
 * Une seule ligne suffisait à ouvrir la fuite :
 *
 *     const espaceAgence = await chargerEspaceAgence();
 *
 * Elle interrogeait la plateforme pour TOUT LE MONDE, et le composant client
 * recevait l'espace par prop — donc le HTML prérendu de la page PUBLIQUE
 * embarquait la facture, le numéro de facture et la formule, en clair dans la
 * charge utile RSC. L'inspecteur suffisait à les lire : aucun clic, aucune
 * requête, aucune course. Une condition côté client (`if (!admin)` dans le
 * composant) n'aurait rien fermé, parce que la donnée était déjà partie avant
 * qu'il ait à décider quoi que ce soit. C'est pourquoi le correctif n'est pas
 * « cacher le bouton » : c'est « ne jamais charger la donnée hors du tableau de
 * bord ».
 *
 * Le même raisonnement interdit de monter ici un composant intermédiaire qui
 * lirait la session : `cookies()` dans le layout racine déclasserait les pages
 * du site en rendu dynamique. On perdrait les 10 pages `○ Static` du modèle pour
 * une information qui ne concerne qu'une page. `/admin` lit déjà la session —
 * il en a besoin pour `profiles.role` — donc `/admin` est déjà dynamique en
 * boutique réelle, et le vérifier ne coûte rien : c'est le même aller-retour.
 *
 * Ce qui reste public, et pourquoi ce n'est pas une fuite : `AgencyCredit`, dans
 * `SiteFooter`. C'est une ATTRIBUTION — « Site créé par MindGraphixSolution » et
 * un lien vers la vitrine publique de l'agence — pas une donnée commerciale. Elle
 * ne lit ni abonnement, ni facture, ni demande, ni coordonnées de demandeur :
 * seulement `MGS_WEBSITE_URL`, par `agencyWebsiteUrl()`. C'est la seule chose que
 * l'agence publie volontairement sur le site qu'elle construit, et c'est ainsi
 * qu'elle se fait créditer. La retirer au public lui ferait perdre son crédit
 * pour protéger une information qu'elle a choisi de publier.
 *
 * `agency.css` reste importé ici : c'est lui qui porte `.agency-credit`, lu par
 * le pied de page ci-dessous. Le reste de cette feuille sert au tiroir, monté
 * dans `/admin`, et ne coûte rien d'être présente.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="fr"><body className="streetwear-site"><StoreProvider><NetworkNotice /><SiteHeader />{children}<SiteFooter /></StoreProvider></body></html>;
}
