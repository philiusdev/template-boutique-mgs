import { NextResponse } from "next/server";
import { recordCustomerActivitySchema, sendCustomerActivity } from "@/lib/server/customer-activity";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
  }
  if (originUrl.origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
  }

  const parsed = recordCustomerActivitySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Activité invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    if (authError.name === "AuthSessionMissingError" || authError.status === 401) {
      return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
    }
    console.error("[activite-client] Session illisible.", authError.message);
    return NextResponse.json({ error: "Session momentanément indisponible." }, { status: 503 });
  }
  if (!user) {
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name,role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile) {
    console.error("[activite-client] Profil illisible.", profileError?.message);
    return NextResponse.json({ error: "Profil indisponible." }, { status: 503 });
  }

  const actor = {
    actor_id: user.id,
    actor_label: (profile.full_name?.trim() || user.email || "Compte client").slice(0, 120),
    actor_kind: profile.role === "admin" ? "equipe" as const : "client" as const,
  };
  const event = parsed.data;
  const occurredAt = new Date().toISOString();
  const events: Record<string, unknown>[] = [];

  if (event.type === "connexion" || event.type === "deconnexion") {
    events.push({
      ...actor,
      source_event_id: event.source_event_id,
      action: event.type,
      resource: "auth.users",
      resource_id: user.id,
      details: {},
      occurred_at: occurredAt,
    });
  } else if (event.type === "profil") {
    events.push({
      ...actor,
      source_event_id: event.source_event_id,
      action: "modification",
      resource: "profiles",
      resource_id: user.id,
      details: {},
      occurred_at: occurredAt,
    });
  } else {
    if (profile.role === "admin") {
      return NextResponse.json({ error: "Action client non autorisée." }, { status: 403 });
    }
    const orderQuery = supabase
      .from("orders")
      .select("id,status,total")
      .eq("id", event.order_id);
    const scopedOrderQuery = profile.role === "admin"
      ? orderQuery
      : orderQuery.eq("user_id", user.id);
    const { data: order, error: orderError } = await scopedOrderQuery.maybeSingle();
    if (orderError) {
      console.error("[activite-client] Commande illisible.", orderError.message);
      return NextResponse.json({ error: "Commande momentanément indisponible." }, { status: 503 });
    }
    if (!order) {
      return NextResponse.json({ error: "Commande inaccessible." }, { status: 404 });
    }

    if (event.type === "commande") {
      const { data: items, error: itemsError } = await supabase
        .from("order_items")
        .select("id,product_name_snapshot,quantity")
        .eq("order_id", order.id)
        .limit(90);
      if (itemsError || !items) {
        console.error("[activite-client] Articles de commande illisibles.", itemsError?.message);
        return NextResponse.json({ error: "Commande indisponible." }, { status: 503 });
      }
      events.push({
        ...actor,
        source_event_id: event.source_event_id,
        action: "creation",
        resource: "orders",
        resource_id: order.id,
        details: { commande: order.id, statut_apres: order.status, montant: String(order.total) },
        occurred_at: occurredAt,
      });
      for (const item of items) {
        events.push({
          ...actor,
          source_event_id: item.id,
          action: "creation",
          resource: "order_items",
          resource_id: item.id,
          details: { commande: order.id, article: item.product_name_snapshot, quantite: String(item.quantity) },
          occurred_at: occurredAt,
        });
      }
    } else {
      const { data: proof, error: proofError } = await supabase
        .from("payment_proofs")
        .select("id,status")
        .eq("order_id", order.id)
        .maybeSingle();
      if (proofError || !proof) {
        if (proofError) {
          console.error("[activite-client] Paiement illisible.", proofError.message);
          return NextResponse.json({ error: "Paiement momentanément indisponible." }, { status: 503 });
        }
        return NextResponse.json({ error: "Preuve de paiement indisponible." }, { status: 404 });
      }
      events.push({
        ...actor,
        source_event_id: event.source_event_id,
        action: "paiement_envoye",
        resource: "payment_proofs",
        resource_id: proof.id,
        details: { commande: order.id, statut_apres: proof.status },
        occurred_at: occurredAt,
      });
    }
  }

  const sent = await sendCustomerActivity(events);
  if (!sent.ok) {
    return NextResponse.json({ error: sent.error }, { status: sent.status });
  }
  return NextResponse.json({ ok: true });
}
