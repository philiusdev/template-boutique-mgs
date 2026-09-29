import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { DemoAdminPage } from "@/components/demo-pages";
import { loadAgencySpace } from "@/lib/agency/space";

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

  // L'espace agence est chargé ici, côté serveur : la clé du site ne descend
  // jamais dans le navigateur. En cas de panne de la plateforme, loadAgencySpace
  // renvoie un espace vide et le dashboard reste entièrement utilisable.
  const agencySpace = await loadAgencySpace().catch(() => null);

  return <AdminDashboard email={auth.user.email ?? ""} agencySpace={agencySpace} />;
}
