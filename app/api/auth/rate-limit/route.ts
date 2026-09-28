import { isIP } from "node:net";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isDemoMode } from "@/lib/supabase/config";

const requestSchema = z.object({
  email: z.string().trim().email().max(320),
});

async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: NextRequest) {
  if (isDemoMode) return NextResponse.json({ allowed: true });
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Entrez une adresse email valide." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    console.error("URL Supabase absente pour limiter les tentatives de connexion.");
    return NextResponse.json({ error: "Service de connexion indisponible pour le moment." }, { status: 503 });
  }
  if (!serviceKey) {
    console.warn("Clé serveur de limitation absente; les limites natives Supabase protègent les demandes de connexion.");
    return NextResponse.json({ allowed: true, rateLimitFallback: true });
  }

  const trustedIpHeader = process.env.TRUSTED_AUTH_RATE_LIMIT_IP_HEADER?.trim().toLowerCase();
  if (!trustedIpHeader || !/^[a-z0-9][a-z0-9-]*$/.test(trustedIpHeader)) {
    console.warn("Limitation personnalisée désactivée : configurez TRUSTED_AUTH_RATE_LIMIT_IP_HEADER pour un en-tête IP réécrit par votre proxy de confiance; les limites natives Supabase restent actives.");
    return NextResponse.json({ allowed: true, rateLimitFallback: true });
  }
  const configuredIp = request.headers.get(trustedIpHeader)?.trim();
  if (!configuredIp || configuredIp.includes(",") || isIP(configuredIp) === 0) {
    console.warn("Limitation personnalisée désactivée pour cette requête : l'en-tête IP de proxy configuré est absent ou invalide; recours aux limites natives Supabase.");
    return NextResponse.json({ allowed: true, rateLimitFallback: true });
  }
  const [emailHash, ipHash] = await Promise.all([
    digest(parsed.data.email.toLowerCase()),
    digest(configuredIp),
  ]);
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("consume_auth_rate_limit", {
    p_email_hash: emailHash,
    p_ip_hash: ipHash,
  });
  if (error) {
    console.error("Limitation personnalisée indisponible; recours aux limites natives Supabase :", error.message);
    return NextResponse.json({ allowed: true, rateLimitFallback: true });
  }
  if (data !== true) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans 15 minutes." },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }
  return NextResponse.json({ allowed: true });
}
