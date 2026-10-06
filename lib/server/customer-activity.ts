import { z } from "zod";

export const recordCustomerActivitySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("connexion"), source_event_id: z.string().uuid() }).strict(),
  z.object({ type: z.literal("deconnexion"), source_event_id: z.string().uuid() }).strict(),
  z.object({ type: z.literal("profil"), source_event_id: z.string().uuid() }).strict(),
  z.object({ type: z.literal("commande"), source_event_id: z.string().uuid(), order_id: z.string().uuid() }).strict(),
  z.object({ type: z.literal("preuve_paiement"), source_event_id: z.string().uuid(), order_id: z.string().uuid() }).strict(),
]);

export async function sendCustomerActivity(events: Record<string, unknown>[]) {
  const platformUrl = process.env.MGS_PLATFORM_URL?.trim().replace(/\/+$/, "");
  const siteKey = process.env.MGS_SITE_KEY?.trim();
  const siteSecret = process.env.MGS_SITE_SECRET;
  if (!platformUrl || !siteKey || !siteSecret) {
    console.error("[activite-client] Identifiants serveur MGS absents.");
    return { ok: false as const, status: 503, error: "Relais d’activité non configuré." };
  }

  let endpoint: URL;
  try {
    const platform = new URL(platformUrl);
    if (platform.pathname !== "/" || platform.search || platform.hash || platform.username || platform.password) {
      return { ok: false as const, status: 503, error: "Adresse de plateforme invalide." };
    }
    endpoint = new URL("/api/v1/activity", platform);
  } catch {
    console.error("[activite-client] URL de plateforme invalide.");
    return { ok: false as const, status: 503, error: "Relais d’activité indisponible." };
  }
  if (endpoint.protocol !== "https:" && endpoint.hostname !== "localhost") {
    return { ok: false as const, status: 503, error: "Le relais exige une connexion sécurisée." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Site-Key": siteKey,
        Authorization: `Bearer ${siteSecret}`,
      },
      body: JSON.stringify({ events }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error("[activite-client] La plateforme a refusé le relais.", response.status);
      return { ok: false as const, status: 503, error: "Activité non transmise à la plateforme." };
    }
    return { ok: true as const };
  } catch (error) {
    console.error("[activite-client] Échec du relais.", error instanceof Error ? error.name : "Erreur inconnue");
    return { ok: false as const, status: 503, error: "Plateforme momentanément inaccessible." };
  } finally {
    clearTimeout(timeout);
  }
}
