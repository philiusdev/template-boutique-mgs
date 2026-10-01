import { loadAgencySpace } from "@/lib/agency/space";
import type { AgencySpace } from "@/lib/agency/types";
import { isDemoMode } from "@/lib/supabase/config";
import { lireSessionAdmin } from "@/app/api/agency/_interne/securite";

/**
 * L'unique porte d'entrée de l'espace « Mon agence » d'une page de boutique.
 *
 * MODULE SERVEUR UNIQUEMENT, et il doit le rester. Il lit `process.env` par
 * l'intermédiaire de `lib/agency/client.ts` et la session par l'intermédiaire
 * de `lireSessionAdmin`. Importé depuis un composant client, il ne fuiterait pas
 * la clé du site — `process.env` est vide dans le navigateur — mais il
 *_emporterait_ la tentation de charger l'espace depuis le navigateur, ce qui est
 * précisément la fuite que ce module existe pour fermer. Le point de montage
 * décide donc de QUI on rend le composant, et ce module décide de QUI on
 * charge la donnée : les deux contrôles sont séparés, et c'est volontaire.
 *
 * Ce fichier vit HORS de `lib/agency/`, volontairement : `lib/agency/` est la
 * copie mot pour mot du connecteur `mgs-agency-connector/`, et le `diff -r` qui
 * prouve que deux sites ne peuvent pas diverger ne doit porter que sur des
 * fichiers copiés. Un fichier d'intégration ajouté dans ce dossier ferait
 * échouer la preuve et finirait, un jour, par diverger lui-même.
 *
 * Il importe `lireSessionAdmin` de `app/api/agency/_interne/securite.ts` — un
 * fichier situé sous `app/`, ce qui est inhabituel et assumé. C'est la même
 * fonction, et donc le même `ROLES_ADMINISTRATION`, que celle qui protège déjà
 * `GET /api/agency/requests`, `POST /api/agency/revalidate` et
 * `POST /api/agency/heartbeat`. Dupliquer le test de rôle ici créerait une
 * deuxième définition de « administrateur du site », et c'est exactement le
 * genre de définition qui finit par diverger : `_interne` est le dossier prévu
 * pour du code partagé entre routes et hors routes.
 *
 * Il porte aussi le nom de l'ancien montage — le bouton flottant sur toutes les
 * pages — parce que c'est ce bouton qui a fait naître le besoin de cette porte,
 * et que renommer le fichier ferait diverger les références des autres agents
 * pour un gain de nommage. Ce qu'il garantit, en revanche, est bien plus large
 * qu'un bouton.
 *
 * LE PRINCIPE : c'est ICI, et nulle part ailleurs, qu'on décide qui peut charger
 * l'espace de l'agence. `loadAgencySpace()` ne lève jamais et ne connaît ni le
 * rôle, ni le mode démonstration — deux contextes où l'appeler serait une
 * faute. Une fonction qui charge une donnée commerciale doit donc passer par
 * cette porte, et cette porte refuse.
 *
 * Trois règles, et le risque que chacune ferme :
 *
 *  - LE MODE DÉMONSTRATION NE JOIE AUCUN RÔLE, ET PASSE EN PREMIER. `isDemoMode`
 *    est vrai dès que `NEXT_PUBLIC_DEMO_MODE` n'est pas exactement `false`, et
 *    aussi quand les identifiants Supabase manquent — donc par défaut sur un
 *    modèle neuf. Sans cette garde, un site de démonstration irait interroger une
 *    plateforme pour laquelle il n'a ni clé ni raison de le faire : trois
 *    allers-retours par rendu, un risque de dépasser le quota de 60
 *    requêtes/minute de la boutique, et un espace « Mon agence » entièrement
 *    composé de coordonnées de repli (`MGS_AGENCY_*`) qui feraient croire à une
 *    agence réelle. La démo montre déjà un tableau de bord sans onglet
 *    « Mon agence » (`DemoAdminPage` rend `AdminDashboard` avec
 *    `agencySpace: null`) : y ajouter un bouton dirait deux choses opposées.
 *    Elle est testée AVANT la session parce qu'une démo n'a pas de session à
 *    lire, et qu'un refus « non connecté » sur une démo serait un faux
 *    diagnostic.
 *
 *  - AUCUN ADMINISTRATEUR, PAS DE DONNÉE. C'est LA garde du critère n°1.
 *    `lireSessionAdmin` lit l'identité par `getUser()` — la session vérifiée
 *    par le serveur, jamais un jeton que l'appelant pourrait choisir — puis le
 *    rôle dans `profiles`, et n'accepte que `ROLES_ADMINISTRATION` (`admin`).
 *    Sans ce `if (!session.ok) return null`, un visiteur anonyme, ou un compte
 *    client connecté, obtiendrait le dossier du commerçant : sa formule
 *    d'abonnement, son tarif, ses factures impayées et le suivi de ses demandes.
 *    Le mal fait est déjà fait à ce niveau : l'espace étant renvoyé au
 *    navigateur par prop, il serait écrit dans le HTML de la page, lisible dans
 *    l'inspecteur sans un seul clic. Masquer l'affichage ne fermerait rien — il
 *    faut ne pas charger.
 *
 *  - AUCUNE EXCEPTION NE REMONTE. `loadAgencySpace` dégrade déjà, mais le
 *    `catch` ferme la dernière porte : une exception levée ici interromprait le
 *    rendu d'une page, y compris le panier et la commande. Pour un problème
 *    d'agence, qui par définition ne concerne que l'agence, ce serait
 *    transformer une panne tierce en boutique blanche. Le `catch` est donc
 *    redondant à dessein : il est la garantie que la règle du projet ne repose
 *    pas sur le comportement d'un fichier qui appartient à un autre dépôt et
 *    peut évoluer sans préavis.
 *
 * GARDE STRUCTURELLE, À NE PAS OUBLIER. Cette fonction appelle `lireSessionAdmin`
 * → `createClient()` → `cookies()`. Tout rendu qui produit un espace est donc
 * dynamique PAR CONSTRUCTION : Next ne peut pas le figer dans un fichier HTML
 * statique servi à tout le monde. C'est pourquoi il ne faut pas « simplifier »
 * cette porte en lui passant un rôle déjà vérifié par l'appelant : le contrôle
 * de rôle est aussi le contrôle de rendu dynamique, et le retirer rouvrirait la
 * fuite par le cache de pages, pas seulement par le code.
 *
 * Coût en temps de rendu, à connaître : quand l'appelant est un administrateur,
 * `lireSessionAdmin` coûte deux lectures (session, puis rôle), et `loadAgencySpace`
 * trois lectures parallèles mises en cache 60 s par `callAgency`. Site joignable,
 * le cache rend les trois lectures gratuites. Plateforme muette, `callAgency`
 * coupe les lectures pendant 20 s et borne l'attente à 4 s. Tout cela ne pèse
 * que sur `/admin`, que son administrateur visite seul, et qui interroge déjà
 * neuf tables en parallèle.
 */
export async function chargerEspaceAgenceAdmin(): Promise<AgencySpace | null> {
  if (isDemoMode) return null;
  const session = await lireSessionAdmin();
  if (!session.ok) return null;
  return await loadAgencySpace().catch(() => null);
}