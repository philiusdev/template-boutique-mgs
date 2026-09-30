import { loadAgencySpace } from "@/lib/agency/space";
import type { AgencySpace } from "@/lib/agency/types";
import { isDemoMode } from "@/lib/supabase/config";

/**
 * L'espace « Mon agence » destiné au bouton flottant du site public.
 *
 * Ce fichier vit HORS de `lib/agency/`, volontairement : `lib/agency/` est la
 * copie mot pour mot du connecteur `mgs-agency-connector/`, et le `diff -r` qui
 * prouve que deux sites ne peuvent pas diverger ne doit porter que sur des
 * fichiers copiés. Un fichier d'intégration ajouté dans ce dossier ferait
 * échouer la preuve et finirait, un jour, par diverger lui-même.
 *
 * Il existe pour une seule raison : `loadAgencySpace()` ne lève jamais de
 * lui-même, mais il ne connaît ni le mode démonstration, ni le fait qu'on est
 * dans un rendu de layout — deux contextes où l'appeler serait une faute. C'est ici
 * qu'on décide UNE fois pour toutes ce qui a le droit d'appeler la plateforme
 * depuis une page de boutique.
 *
 * Trois règles, et le risque que chacune ferme :
 *
 *  - LE MODE DÉMONSTRATION NE JOUE AUCUN RÔLE. `isDemoMode` est vrai dès que
 *    `NEXT_PUBLIC_DEMO_MODE` n'est pas exactement `false`, et aussi quand les
 *    identifiants Supabase manquent — donc par défaut sur un modèle neuf. Sans
 *    cette garde, un site de démonstration irait interroger une plateforme pour
 *    laquelle il n'a ni clé ni raison de le faire : trois allers-retours par
 *    rendu, un risque de dépasser le quota de 60 requêtes/minute de la boutique,
 *    et un espace « Mon agence » entièrement composé de coordonnées de repli
 *    (`MGS_AGENCY_*`) qui feraient croire à une agence réelle. Le site de
 *    démonstration est déjà sans onglet « Mon agence » — `app/admin/page.tsx`
 *    rend `DemoAdminPage` — le bouton doit donc être absent aussi, sinon la
 *    démo dirait une chose et le site en dirait une autre.
 *
 *  - AUCUNE EXCEPTION NE REMONTE. `loadAgencySpace` dégrade déjà, mais le
 *    `catch` ferme la dernière porte : une exception levée ici interromprait le
 *    rendu du layout racine, c'est-à-dire TOUTES les pages du site, y compris le
 *    panier et la commande. Pour un problème d'agence, qui par définition ne
 *    concerne que l'agence, ce serait transformer une panne tierce en boutique
 *    blanche. Le `catch` est donc redondant à dessein : il est la garantie que
 *    la règle du projet ne repose pas sur le comportement d'un fichier qui
 *    appartient à un autre dépôt et peut évoluer sans préavis.
 *
 *  - AUCUNE IDENTITÉ N'EST LUE ICI. Le layout racine est rendu pour tout le
 *    monde, y compris les visiteurs anonymes ; lire les cookies de session
 *    rendrait chaque page dynamique et supprimerait le rendu statique de la
 *    boutique entière pour une information qui ne sert qu'à pré-remplir un
 *    champ de formulaire. Le demandeur est donc repris de la session par
 *    `/api/agency/request` (`lireSession`), côté serveur, au moment de l'envoi :
 *    c'est la seule source d'identité qui ne peut pas être choisie par
 *    l'appelant.
 *
 * Coût en temps de rendu, à connaître : à chaque rendu, `loadAgencySpace` fait
 * trois lectures parallèles, mises en cache 60 s par `callAgency`. Site
 * joignable, le cache rend l'appel gratuit et la page reste statique (les
 * lectures portent `next: { revalidate }`, elles ne déclassent pas le rendu).
 * Plateforme muette, `callAgency` coupe les lectures pendant 20 s et borne
 * l'attente à 4 s : le premier rendu après une fenêtre de 20 s peut donc
 * s'allonger de 4 s, jamais de plus, et le site reste servable. C'est le prix
 * d'un bouton présent sur toutes les pages, et il est borné à dessein.
 */
export async function chargerEspaceAgence(): Promise<AgencySpace | null> {
  if (isDemoMode) return null;
  return await loadAgencySpace().catch(() => null);
}