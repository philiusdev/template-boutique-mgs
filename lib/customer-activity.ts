export type CustomerActivityEvent =
  | { type: "connexion"; source_event_id: string }
  | { type: "deconnexion"; source_event_id: string }
  | { type: "profil"; source_event_id: string }
  | { type: "commande"; source_event_id: string; order_id: string }
  | { type: "preuve_paiement"; source_event_id: string; order_id: string };

export async function recordCustomerActivity(event: CustomerActivityEvent): Promise<void> {
  try {
    const response = await fetch("/api/client-activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      credentials: "same-origin",
      keepalive: true,
    });
    if (!response.ok) {
      console.warn("[activite-client] Relais non confirme.", response.status);
    }
  } catch (error) {
    console.warn(
      "[activite-client] Relais indisponible.",
      error instanceof Error ? error.name : "Erreur inconnue",
    );
  }
}
