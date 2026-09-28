"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import type { PaymentMethod } from "@/lib/types";

const proofSchema = z.object({
  payment_method_id: z.string().uuid("Choisissez un moyen de paiement."),
  screenshot: z.custom<FileList>((files) => typeof FileList !== "undefined" && files instanceof FileList && files.length > 0, "Ajoutez la capture de votre paiement.")
    .transform((files) => files[0])
    .refine((file) => file.size <= 5 * 1024 * 1024, "La capture doit faire 5 Mo maximum.")
    .refine((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type), "Formats acceptés : JPG, PNG ou WebP."),
});
type ProofInput = z.input<typeof proofSchema>;
type ProofValues = z.output<typeof proofSchema>;

export function PaymentProofRecovery({ orderId, userId, wasRejected = false }: { orderId: string; userId: string; wasRejected?: boolean }) {
  const router = useRouter();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<ProofInput, unknown, ProofValues>({
    resolver: zodResolver(proofSchema),
  });

  useEffect(() => {
    const loadMethods = async () => {
      try {
        const { data, error } = await createClient()
          .from("payment_methods")
          .select("id,name,phone_number,instructions,active")
          .eq("active", true)
          .order("display_order");
        if (error) throw error;
        setMethods((data ?? []).map((method) => ({
          ...method,
          is_active: method.active,
        })) as PaymentMethod[]);
      } catch {
        setLoadError("Les moyens de paiement sont temporairement indisponibles. Actualisez la page.");
      }
    };
    void loadMethods();
  }, []);

  const submit = async (values: ProofValues) => {
    setSubmitting(true);
    setMessage("");
    try {
      const supabase = createClient();
      const method = methods.find((item) => item.id === values.payment_method_id);
      if (!method) throw new Error("Choisissez un moyen de paiement actif.");
      const extension = values.screenshot.type === "image/png" ? "png" : values.screenshot.type === "image/webp" ? "webp" : "jpg";
      const path = `${userId}/${orderId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(path, values.screenshot, { contentType: values.screenshot.type });
      if (uploadError) throw new Error("Capture non envoyée. Vérifiez votre connexion et réessayez.");
      const { error } = await supabase.rpc("submit_payment_proof", {
        p_order_id: orderId,
        p_screenshot_path: path,
        p_payment_method_id: method.id,
      });
      if (error) throw new Error("Capture envoyée, mais non enregistrée. Réessayez.");
      setMessage("Votre preuve de paiement a été envoyée. Elle sera vérifiée par la boutique.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error && error.message === "Choisissez un moyen de paiement actif."
        ? error.message
        : "Impossible d'envoyer la capture. Vérifiez votre connexion et réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="proof-recovery" onSubmit={form.handleSubmit(submit)}>
      <strong>{wasRejected ? "Renvoyer une preuve de paiement" : "Ajouter la preuve de paiement"}</strong>
      {loadError && <p className="field-error">{loadError}</p>}
      {methods.length ? (
        <>
          <select className="text-input" aria-label="Moyen de paiement" {...form.register("payment_method_id")}>
            <option value="">Choisir le moyen de paiement</option>
            {methods.map((method) => <option key={method.id} value={method.id}>{method.name} · {method.phone_number}</option>)}
          </select>
          {form.formState.errors.payment_method_id && <span className="field-error">{form.formState.errors.payment_method_id.message}</span>}
          <input className="text-input file-input" type="file" accept="image/jpeg,image/png,image/webp" {...form.register("screenshot")} />
          <button className="button button-dark button-small" type="submit" disabled={submitting}>{submitting ? "Envoi en cours…" : "Envoyer la capture"}</button>
        </>
      ) : <p className="field-hint">La boutique n&apos;a pas encore configuré de moyen de paiement.</p>}
      {form.formState.errors.screenshot && <span className="field-error">{form.formState.errors.screenshot.message}</span>}
      {message && <p className="form-message error" role="alert">{message}</p>}
    </form>
  );
}
