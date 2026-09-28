import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/supabase/config";
import { safeInternalPath } from "@/lib/safe-internal-path";

export async function GET(request: NextRequest) {
  const destination = safeInternalPath(request.nextUrl.searchParams.get("next"));
  const loginUrl = (error: string) => {
    const url = new URL("/connexion", request.url);
    url.searchParams.set("error", error);
    if (destination !== "/mes-commandes") url.searchParams.set("next", destination);
    return NextResponse.redirect(url);
  };
  if (isDemoMode) return loginUrl("auth_callback");
  const code = request.nextUrl.searchParams.get("code");
  const providerError = request.nextUrl.searchParams.get("error");
  const providerErrorCode = request.nextUrl.searchParams.get("error_code");
  if (providerError || providerErrorCode) {
    return loginUrl(providerErrorCode === "otp_expired" ? "otp_expired" : providerError === "access_denied" ? "access_denied" : "auth_callback");
  }
  if (!code) return loginUrl("auth_callback");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    if (error) console.error("Échec de l'échange du lien de connexion :", error.message);
    return loginUrl("auth_callback");
  }

  let redirectTo = destination;
  if (destination === "/mes-commandes") {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profileError) {
      console.error("Impossible de vérifier le rôle après connexion :", profileError.message);
    } else if (profile?.role === "admin") {
      redirectTo = "/admin";
    }
  }
  return NextResponse.redirect(new URL(redirectTo, request.url));
}
