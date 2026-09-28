"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { isValidBurkinaPhoneNumber, toBurkinaPhoneHref, toSavedBurkinaPhoneNumber } from "@/lib/phone";
import { getNameMonogram } from "@/lib/name";
import { BurkinaPhoneInput } from "@/components/burkina-phone-input";
import { useStore } from "@/components/store-provider";

const profileSchema = z.object({
  full_name: z.string().trim().max(120, "Le nom ne doit pas dépasser 120 caractères."),
  phone_number: z.string().refine(isValidBurkinaPhoneNumber, "Saisissez les 8 chiffres du numéro après +226."),
  default_city_id: z.string().optional(),
  default_neighborhood_id: z.string().optional(),
}).superRefine((values, context) => {
  if (Boolean(values.default_city_id) !== Boolean(values.default_neighborhood_id)) {
    context.addIssue({
      code: "custom",
      path: [values.default_city_id ? "default_neighborhood_id" : "default_city_id"],
      message: "Choisissez une ville et un quartier, ou effacez les deux préférences.",
    });
  }
});
type ProfileValues = z.infer<typeof profileSchema>;
type CityOption = { id: string; name: string };
type NeighborhoodOption = { id: string; name: string; city_id: string };

export function ProfileForm({
  userId,
  email,
  fullName,
  phoneNumber,
  defaultCityId,
  defaultNeighborhoodId,
  cities,
  neighborhoods,
  shopPhone,
}: {
  userId: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  defaultCityId: string;
  defaultNeighborhoodId: string;
  cities: CityOption[];
  neighborhoods: NeighborhoodOption[];
  shopPhone?: string;
}) {
  const router = useRouter();
  const { setUserDisplayName } = useStore();
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: fullName, phone_number: toSavedBurkinaPhoneNumber(phoneNumber), default_city_id: defaultCityId, default_neighborhood_id: defaultNeighborhoodId },
  });
  const currentFullName = useWatch({ control: form.control, name: "full_name" });
  const displayName = currentFullName?.trim() || "";
  const currentPhoneNumber = toSavedBurkinaPhoneNumber(
    useWatch({ control: form.control, name: "phone_number" }),
  );
  const cityId = useWatch({ control: form.control, name: "default_city_id" });
  const cityNeighborhoods = useMemo(() => neighborhoods.filter((item) => item.city_id === cityId), [cityId, neighborhoods]);

  const save = async (values: ProfileValues) => {
    setMessage("");
    setSaving(true);
    try {
      const { error } = await createClient().from("profiles").update({
        full_name: values.full_name || null,
        phone_number: values.phone_number,
        default_city_id: values.default_city_id || null,
        default_neighborhood_id: values.default_city_id ? values.default_neighborhood_id || null : null,
      }).eq("id", userId);
      if (error) throw error;
      setUserDisplayName(values.full_name.trim());
      setMessageType("success");
      setMessage("Votre profil a été enregistré.");
      router.refresh();
    } catch (error) {
      console.error("Impossible d'enregistrer le profil :", error);
      setMessageType("error");
      setMessage("Profil non enregistré. Vérifiez votre connexion puis réessayez.");
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    setMessage("");
    try {
      const { error } = await createClient().auth.signOut();
      if (error) throw error;
      router.push("/");
    } catch (error) {
      console.error("Impossible de déconnecter le compte :", error);
      setMessageType("error");
      setMessage("Déconnexion impossible pour le moment. Réessayez.");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <main className="page-wrap profile-page">
      <p className="eyebrow">VOTRE ESPACE</p>
      <h1>Mon profil</h1>
      <p className="profile-intro">Gérez vos coordonnées et vos préférences de livraison.</p>
      <section className="profile-card">
        <div className="profile-identity">
          <span className="profile-avatar" aria-label={`Monogramme ${displayName || email}`}>{getNameMonogram(displayName, email)}</span>
          <div className="profile-identity-copy">
            <small>MON COMPTE</small>
            <strong className="profile-display-name">{displayName || "Votre compte"}</strong>
            <span className="profile-email-address">{email}</span>
          </div>
        </div>
        <form className="profile-form" autoComplete="off" onSubmit={form.handleSubmit(save)}>
          <div className="profile-section-heading">
            <strong>Informations personnelles</strong>
            <span>Ces informations facilitent le suivi de vos commandes.</span>
          </div>
          <label className="field-group"><span className="field-label">Nom complet</span><input className="text-input" autoComplete="name" placeholder="Ex. Aïcha Traoré" {...form.register("full_name")} />{form.formState.errors.full_name && <span className="field-error">{form.formState.errors.full_name.message}</span>}</label>
          <label className="field-group"><span className="field-label">Téléphone pour votre commande</span><Controller control={form.control} name="phone_number" render={({ field }) => <BurkinaPhoneInput id="profile-phone" name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur} />} />{form.formState.errors.phone_number && <span className="field-error">{form.formState.errors.phone_number.message}</span>}<small className="field-hint">La boutique pourra vous appeler au sujet de la livraison ou du paiement.</small></label>
          <label className="field-group"><span className="field-label">Ville habituelle</span><select className="text-input" {...form.register("default_city_id", { onChange: () => form.setValue("default_neighborhood_id", "") })}><option value="">Aucune préférence</option>{cities.map((city) => <option value={city.id} key={city.id}>{city.name}</option>)}</select>{form.formState.errors.default_city_id && <span className="field-error">{form.formState.errors.default_city_id.message}</span>}</label>
          <label className="field-group"><span className="field-label">Quartier habituel</span><select className="text-input" disabled={!cityId} {...form.register("default_neighborhood_id")}><option value="">Aucune préférence</option>{cityNeighborhoods.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>{form.formState.errors.default_neighborhood_id && <span className="field-error">{form.formState.errors.default_neighborhood_id.message}</span>}</label>
          <button className="button button-dark" type="submit" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer mon profil"} <span>→</span></button>
        </form>
        {message && <p className={`form-message ${messageType}`} role={messageType === "error" ? "alert" : "status"}>{message}</p>}
        <aside className="profile-contact-panel">
          <div className="profile-contact-line">
            <span>Votre numéro pour les commandes</span>
            <strong>{currentPhoneNumber || "Ajoutez un numéro dans le formulaire ci-dessus."}</strong>
          </div>
          {shopPhone && <div className="profile-contact-line">
            <span>Besoin d’aide ? Appelez la boutique</span>
            {toBurkinaPhoneHref(shopPhone) && <a href={toBurkinaPhoneHref(shopPhone)}>{shopPhone}</a>}
          </div>}
        </aside>
        <div className="profile-links"><Link href="/mes-commandes">Voir mes commandes →</Link><button className="text-button" type="button" onClick={() => void signOut()} disabled={signingOut}>{signingOut ? "Déconnexion…" : "Se déconnecter"}</button></div>
      </section>
    </main>
  );
}
