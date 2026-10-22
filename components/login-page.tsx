import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/safe-internal-path";

export async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const destination = safeInternalPath(next);

  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error("Impossible de vérifier la session avant la connexion :", authError);
      throw new Error("Impossible de vérifier votre session. Réessayez dans quelques instants.");
    }

    if (auth.user) {
      let redirectTo = destination;
      if (destination === "/mes-commandes") {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", auth.user.id)
          .maybeSingle();
        if (profileError) {
          console.error("Impossible de vérifier le rôle avant la redirection de connexion :", profileError);
          throw new Error("Impossible de vérifier votre espace pour le moment. Réessayez dans quelques instants.");
        }
        if (profile?.role === "admin") redirectTo = "/admin";
      }
      redirect(redirectTo);
    }
  }

  return <LoginForm destination={destination} authError={error} />;
}
