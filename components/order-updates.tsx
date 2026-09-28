"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function OrderUpdates({ userId }: { userId: string }) {
  const router = useRouter();
  const [live, setLive] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`customer-orders-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${userId}` },
        () => router.refresh(),
      )
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router, userId]);

  return (
    <div className="order-updates">
      <span role="status">{live ? "Suivi en direct activé" : "Actualisez pour voir le dernier statut"}</span>
      <button className="text-link" type="button" onClick={() => router.refresh()}>Actualiser mes commandes ↻</button>
    </div>
  );
}
