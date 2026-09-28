import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { DemoProfilePage } from "@/components/demo-pages";
import { toSavedBurkinaPhoneNumber } from "@/lib/phone";

export default async function ProfilePage() {
  if (!isSupabaseConfigured) return <DemoProfilePage />;
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error("Impossible de vérifier la session du profil :", authError);
    throw new Error("Impossible de vérifier la session. Réessayez dans quelques instants.");
  }
  if (!auth.user) redirect("/connexion?next=/profil");
  const [{ data: profile, error: profileError }, { data: cities, error: citiesError }, { data: shopPhoneSetting, error: settingsError }] = await Promise.all([
    supabase.from("profiles").select("full_name,phone_number,default_city_id,default_neighborhood_id").eq("id", auth.user.id).single(),
    supabase.from("cities").select("id,name").order("name"),
    supabase.from("settings").select("value").eq("key", "shop_phone").maybeSingle(),
  ]);
  if (profileError) {
    console.error("Impossible de charger le profil client :", profileError);
    throw new Error("Impossible de charger votre profil pour le moment. Réessayez dans quelques instants.");
  }
  if (citiesError) {
    console.error("Impossible de charger les villes du profil :", citiesError);
    throw new Error("Impossible de charger les villes pour le moment. Réessayez dans quelques instants.");
  }
  if (settingsError) {
    console.error("Impossible de charger le numéro de contact de la boutique :", settingsError);
    throw new Error("Impossible de charger les informations de contact pour le moment.");
  }
  const { data: neighborhoods, error: neighborhoodsError } = await supabase
    .from("neighborhoods").select("id,name,city_id").order("name");
  if (neighborhoodsError) {
    console.error("Impossible de charger les quartiers du profil :", neighborhoodsError);
    throw new Error("Impossible de charger les quartiers pour le moment. Réessayez dans quelques instants.");
  }
  return <ProfileForm
    userId={auth.user.id}
    email={auth.user.email ?? ""}
    fullName={profile.full_name ?? ""}
    phoneNumber={profile.phone_number ?? ""}
    defaultCityId={profile.default_city_id ?? ""}
    defaultNeighborhoodId={profile.default_neighborhood_id ?? ""}
    cities={cities ?? []}
    neighborhoods={neighborhoods ?? []}
    shopPhone={toSavedBurkinaPhoneNumber(
      (shopPhoneSetting?.value as { text?: string } | null)?.text,
    )}
  />;
}
