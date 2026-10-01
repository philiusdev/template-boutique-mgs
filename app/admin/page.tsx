import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { DemoAdminPage } from "@/components/demo-pages";
import { AgencyFloatingButton } from "@/components/agency/AgencyFloatingButton";
import { chargerEspaceAgenceAdmin } from "@/lib/agency-bouton-flottant";

/**
 * Le tableau de bord du commerçant, et le seul endroit du site où l'espace
 * « Mon agence » est monté.
 *
 * POINT DE MONTAGE — pourquoi ici, et pas dans le layout racine :
 *
 * Un bouton flottant d'agence n'a de sens que pour l'ADMINISTRATEUR du site :
 * c'est lui qui est le client de l'agence, lui qui a une formule, des factures,
 * des demandes en cours. Un visiteur n'a aucun abonnement à voir, et n'a aucun
 * droit à le voir. Le layout racine, lui, sert tout le monde, visiteurs
 * anonymes compris : y charger l'espace revenait à publier le dossier commercial
 * du commerçant dans le HTML de chaque page publique, lisible dans l'inspecteur
 * sans un clic. Voir `app/layout.tsx` pour le détail de cette fuite et de la
 * preuve.
 *
 * Cette page est le point de montage cohérent avec la demande d'origine —
 * « quand le client rentre dans le dashboard, un bouton flottant apparaît » —
 * et il est déjà protégé : `getUser()` pour l'identité, `profiles.role` pour le
 * droit, `redirect` pour les deux refus. Le bouton flotte au-dessus du tableau
 * de bord, pas de la boutique, et il n'existe pour personne d'autre.
 *
 * L'ordre de rendu est respecté : le bouton vient APRÈS le tableau de bord. Il
 * est en `position: fixed`, il ne pousse donc rien, mais il reste après le
 * contenu dans l'ordre du document : au clavier, un lecteur d'écran parcourt la
 * page, puis la zone de dialogue — jamais l'inverse.
 *
 * DEUX GARDS ICI, ET LE RISQUE QUE CHACUNE FERME :
 *
 *  - `if (!isSupabaseConfigured) return <DemoAdminPage />` part AVANT tout. En
 *    démonstration, il n'y a ni session, ni base, ni rôle : `DemoAdminPage` rend
 *    `AdminDashboard` avec `agencySpace: null`, donc ni onglet « Mon agence », ni
 *    bandeau de facturation, ni bouton flottant. Sans ce retour anticipé, la
 *    démo afficherait un tiroir rempli de coordonnées de repli
 *    (`MGS_AGENCY_*`) qui feraient croire à une agence réelle et à un
 *    abonnement que le site de démonstration n'a pas.
 *
 *  - `if (profile?.role !== "admin") redirect("/")` ferme la page elle-même. Le
 *    compte client qui tombe sur `/admin` revient à l'accueil sans jamais avoir
 *    atteint la ligne de chargement. Elle ne suffit pas à elle seule — c'est
 *    pourquoi `chargerEspaceAgenceAdmin` revérifie le rôle de son côté — mais
 *    elle reste la garde visible : une redirection, pas une page vide.
 *
 * La clé du site ne descend jamais dans le navigateur : l'espace est chargé ici,
 * côté serveur, et passé au tableau de bord par prop. En cas de panne de la
 * plateforme, `chargerEspaceAgenceAdmin` renvoie `null` et le tableau de bord
 * reste entièrement utilisable — commandes, produits, livraison, paiements.
 *
 * Les deux props de revalidation sont passées explicitement, et non laissées à
 * leur valeur par défaut. `/api/agency/revalidate` est la route du connecteur,
 * réservée à l'administrateur du site : le bouton ne l'appelle qu'en étant dans
 * le tableau de bord, donc par construction par quelqu'un qui a le droit. Le
 * chemin revalidé est `/admin` et non `/` : depuis le déplacement du bouton,
 * c'est la seule page qui embarque l'espace — revalider `/` ne rafraîchirait plus
 * rien et coûterait un rendu de page pour rien.
 */
export default async function AdminPage() {
  if (!isSupabaseConfigured) return <DemoAdminPage />;
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error("Impossible de vérifier la session administrateur :", authError);
    throw new Error("Impossible de vérifier la session. Réessayez dans quelques instants.");
  }
  if (!auth.user) redirect("/connexion?next=/admin");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error) {
    console.error("Impossible de vérifier les autorisations administrateur :", error);
    throw new Error("Impossible de vérifier vos autorisations. Réessayez dans quelques instants.");
  }
  if (profile?.role !== "admin") redirect("/");

  // L'espace n'est chargé qu'après les deux gardes ci-dessus, et la fonction
  // appelée revérifie encore le rôle : elle est la seule porte du dépôt vers
  // `loadAgencySpace()` pour une page, et elle refuse tout appelant qui n'est
  // pas administrateur. Voir `lib/agency-bouton-flottant.ts`.
  const agencySpace = await chargerEspaceAgenceAdmin();
  const email = auth.user.email ?? "";

  return (
    <>
      <AdminDashboard email={email} agencySpace={agencySpace} />
      <AgencyFloatingButton
        space={agencySpace}
        requesterEmail={email}
        routeRevalidation="/api/agency/revalidate"
        cheminRevalidation="/admin"
      />
    </>
  );
}
