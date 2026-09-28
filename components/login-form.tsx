"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { useStore } from "@/components/store-provider";
import { safeInternalPath } from "@/lib/safe-internal-path";

const emailSchema = z.object({ email: z.string().trim().email("Entrez une adresse email valide.") });
const codeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Le code doit contenir 6 chiffres.") });
type EmailValues = z.infer<typeof emailSchema>;
type CodeValues = z.infer<typeof codeSchema>;

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  auth_callback: "Le lien de connexion est invalide ou a expiré. Demandez un nouveau lien ou un nouveau code.",
  access_denied: "La connexion a été interrompue. Vous pouvez demander un nouvel email de connexion.",
  otp_expired: "Ce code ou lien a expiré. Demandez un nouvel email de connexion.",
};

export function LoginForm({ destination, authError }: { destination: string; authError?: string }) {
  const router = useRouter();
  const { demoMode, loginDemo } = useStore();
  const safeDestination = safeInternalPath(destination);
  const [step, setStep] = useState<"email" | "code">("email");
  const [delivery, setDelivery] = useState<"otp" | "magic_link">("otp");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(authError ? AUTH_ERROR_MESSAGES[authError] ?? AUTH_ERROR_MESSAGES.auth_callback : "");
  const [submitting, setSubmitting] = useState(false);
  const emailForm = useForm<EmailValues>({ resolver: zodResolver(emailSchema), defaultValues: { email: "" } });
  const codeForm = useForm<CodeValues>({ resolver: zodResolver(codeSchema), defaultValues: { code: "" } });

  const requestCode = async ({ email: submittedEmail }: EmailValues) => {
    setMessage("");
    const enteredEmail = submittedEmail.trim().toLowerCase();
    if (demoMode) {
      setEmail(enteredEmail);
      if (delivery === "magic_link") {
        const role = enteredEmail.toLowerCase() === "admin@atelier-naya.demo" ? "admin" : "client";
        loginDemo(enteredEmail, role);
        setMessage("Mode démonstration : aucun e-mail n’est envoyé, la session de test est ouverte.");
        router.push(role === "admin" ? "/admin" : safeDestination);
      } else {
        setStep("code");
        setMessage("Code de test : 123456. Aucun email n'est envoyé.");
      }
      return;
    }
    if (!isSupabaseConfigured) {
      setMessage("La boutique doit être connectée à Supabase pour envoyer un code de connexion.");
      return;
    }
    setSubmitting(true);
    try {
      const rateLimitResponse = await fetch("/api/auth/rate-limit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: enteredEmail }),
        cache: "no-store",
      });
      if (!rateLimitResponse.ok) {
        const result = await rateLimitResponse.json() as { error?: string };
        setMessage(result.error ?? "Trop de tentatives. Réessayez dans quelques minutes.");
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: enteredEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: delivery === "magic_link"
            ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeDestination)}`
            : undefined,
        },
      });
      if (error) throw error;
      setEmail(enteredEmail);
      if (delivery === "magic_link") {
        setMessage("Votre lien de connexion vient d'être envoyé. Consultez votre boîte de réception.");
      } else {
        setStep("code");
        setMessage("Un code de connexion à 6 chiffres vient d'être envoyé à votre adresse.");
      }
    } catch {
      setMessage("Impossible d'envoyer le code pour le moment. Vérifiez votre adresse et réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  const verifyCode = async ({ code }: CodeValues) => {
    setMessage("");
    if (demoMode) {
      if (code !== "123456") {
        setMessage("Code de test incorrect. Utilise 123456.");
        return;
      }
      const role = email.toLowerCase() === "admin@atelier-naya.demo" ? "admin" : "client";
      loginDemo(email, role);
      router.push(role === "admin" ? "/admin" : safeDestination);
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: authData, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
      if (error) throw error;
      if (!authData.user) throw new Error("La session n'a pas pu être créée. Demandez un nouveau code.");
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .maybeSingle();
      const nextPath = profile?.role === "admin" && safeDestination === "/mes-commandes"
        ? "/admin"
        : safeDestination;
      router.replace(nextPath);
    } catch {
      setMessage("Code invalide ou expiré, ou connexion momentanément indisponible. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  const startDemoSession = (role: "client" | "admin") => {
    const demoEmail = role === "admin" ? "admin@atelier-naya.demo" : "client@atelier-naya.demo";
    loginDemo(demoEmail, role);
    router.push(role === "admin" ? "/admin" : safeDestination);
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <span className="auth-icon">✳</span>
        <p className="eyebrow">BIENVENUE CHEZ ROYAL SHOP</p>
        <h1>{step === "email" ? "Ravie de vous retrouver." : "Vérifiez votre email."}</h1>
        {demoMode && <div className="demo-login">
          <strong>Tester sans compte ni email</strong>
          <p>Accès test : code OTP <b>123456</b>, ou boutons rapides ci-dessous.</p>
          <button className="button button-dark full-width" type="button" onClick={() => startDemoSession("client")}>Continuer comme cliente <span>→</span></button>
          <button className="button button-outline full-width" type="button" onClick={() => startDemoSession("admin")}>Entrer dans l’administration</button>
        </div>}
        <p className="auth-intro">{step === "email" ? "Connectez-vous simplement avec votre adresse email. Pas de mot de passe à retenir." : <>Nous avons envoyé un code à <strong>{email}</strong>.</>}</p>
        {step === "email" ? (
          <>
            <div className="auth-method-choice" role="group" aria-label="Méthode de connexion">
              <button type="button" className={delivery === "otp" ? "active" : ""} onClick={() => setDelivery("otp")}>Recevoir un code</button>
              <button type="button" className={delivery === "magic_link" ? "active" : ""} onClick={() => setDelivery("magic_link")}>Recevoir un lien</button>
            </div>
            <form className="form-stack" onSubmit={emailForm.handleSubmit(requestCode)}>
              <label className="field-label" htmlFor="email">Votre adresse email</label>
              <input id="email" className="text-input" type="email" autoComplete="email" placeholder="vous@exemple.com" {...emailForm.register("email")} />
              {emailForm.formState.errors.email && <span className="field-error">{emailForm.formState.errors.email.message}</span>}
              <button className="button button-dark full-width" type="submit" disabled={submitting}>{submitting ? "Envoi en cours…" : delivery === "magic_link" ? "Recevoir mon lien" : "Recevoir mon code"} <span>→</span></button>
            </form>
          </>
        ) : (
          <form className="form-stack" onSubmit={codeForm.handleSubmit(verifyCode)}>
            <label className="field-label" htmlFor="code">Code à 6 chiffres</label>
            <input id="code" className="text-input code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••" {...codeForm.register("code")} />
            {codeForm.formState.errors.code && <span className="field-error">{codeForm.formState.errors.code.message}</span>}
            <button className="button button-dark full-width" type="submit" disabled={submitting}>{submitting ? "Vérification…" : "Se connecter"} <span>→</span></button>
            <button type="button" className="text-button centered" onClick={() => { setStep("email"); setMessage(""); }}>Utiliser une autre adresse</button>
          </form>
        )}
        {message && <p className={`form-message ${message.startsWith("Un code") || message.startsWith("Votre lien") ? "success" : "error"}`} role="status">{message}</p>}
        <div className="auth-divider"><span>✳</span></div>
        <p className="auth-footnote">Vos données restent confidentielles et ne sont jamais partagées.</p>
        <Link className="back-link" href="/">← Retour à la boutique</Link>
      </section>
    </main>
  );
}
