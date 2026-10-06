"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useStore } from "@/components/store-provider";
import { mapProduct } from "@/lib/product-mapper";
import { makeOrderFromCart, makeSeedOrder } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { formatCfa, type City, type Neighborhood, type PaymentMethod, type TransportCompany } from "@/lib/types";
import { isValidBurkinaPhoneNumber, toBurkinaPhoneNumber, toBurkinaPhoneHref, toSavedBurkinaPhoneNumber } from "@/lib/phone";
import { BurkinaPhoneInput } from "@/components/burkina-phone-input";
import { recordCustomerActivity } from "@/lib/customer-activity";

const checkoutSchema = z.object({
  phone_number: z.string().refine(isValidBurkinaPhoneNumber, "Saisissez les 8 chiffres du numéro après +226."),
  city_id: z.string().uuid("Choisissez une ville."),
  neighborhood_id: z.string().uuid("Choisissez un quartier."),
  delivery_type: z.enum(["local_pickup", "local_delivery", "intercity"]),
  transport_company_id: z.string().optional(),
  delivery_address_note: z.string().max(500, "La précision ne doit pas dépasser 500 caractères.").optional(),
  payment_method_id: z.string().uuid("Choisissez un moyen de paiement."),
  screenshot: z.custom<FileList>((files) => typeof FileList !== "undefined" && files instanceof FileList && files.length > 0, "Ajoutez la capture de votre paiement.")
    .transform((files) => files[0])
    .refine((file) => file.size <= 5 * 1024 * 1024, "La capture doit faire 5 Mo maximum.")
    .refine((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type), "Formats acceptés : JPG, PNG ou WebP."),
});
type CheckoutInput = z.input<typeof checkoutSchema>;
type CheckoutValues = z.output<typeof checkoutSchema>;

function screenshotAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Impossible de lire la capture sélectionnée."));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("La capture sélectionnée est invalide."));
        return;
      }
      const image = new window.Image();
      image.onerror = () => reject(new Error("Impossible de traiter la capture sélectionnée."));
      image.onload = () => {
        const scale = Math.min(1, 900 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Le navigateur ne peut pas traiter cette capture."));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.65));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function CheckoutForm() {
  const router = useRouter();
  const { cart, subtotal, userEmail, clearCart, refreshCartProducts, demoMode, demoReady, demoSession, demoState, updateDemoState } = useStore();
  const [cities, setCities] = useState<City[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [companies, setCompanies] = useState<TransportCompany[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [localFee, setLocalFee] = useState(1000);
  const [shopAddress, setShopAddress] = useState("");
  const [shopHours, setShopHours] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [loadError, setLoadError] = useState("");
  const [pendingOrderId, setPendingOrderId] = useState("");
  const [productsVerified, setProductsVerified] = useState(false);
  const [serverTotals, setServerTotals] = useState<{ subtotal: number; deliveryFee: number; total: number } | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "warning">("error");
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<CheckoutInput, unknown, CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { delivery_type: "intercity", transport_company_id: "", delivery_address_note: "" },
  });
  const { getValues, setValue } = form;
  const selectedCity = useWatch({ control: form.control, name: "city_id" });
  const deliveryType = useWatch({ control: form.control, name: "delivery_type" });
  const paymentMethodId = useWatch({ control: form.control, name: "payment_method_id" });
  const transportCompanyId = useWatch({ control: form.control, name: "transport_company_id" });
  const cartSignature = cart.map(({ product }) => product.id).sort().join(",");
  const syncedCartSignature = useRef("");
  const savedLocationApplied = useRef(false);
  const city = cities.find((item) => item.id === selectedCity);
  const isSellerCity = Boolean(city?.is_seller_city);
  const availableNeighborhoods = useMemo(
    () => neighborhoods.filter((item) => item.city_id === selectedCity),
    [neighborhoods, selectedCity],
  );
  const availableCompanies = companies.filter((item) => item.served_city_ids.includes(selectedCity));
  const selectedCompany = companies.find((item) => item.id === transportCompanyId);
  const deliveryFee = deliveryType === "local_delivery"
    ? localFee
    : deliveryType === "intercity"
      ? selectedCompany?.estimated_price ?? 0
      : 0;
  const total = subtotal + deliveryFee;
  const displaySubtotal = serverTotals?.subtotal ?? subtotal;
  const displayDeliveryFee = serverTotals?.deliveryFee ?? deliveryFee;
  const displayTotal = serverTotals?.total ?? total;
  const cartHasInsufficientStock = cart.some(({ product, quantity }) => quantity > product.stock);

  useEffect(() => {
    if (demoMode) {
      if (!demoReady || !cartSignature) return;
      queueMicrotask(() => {
        const currentProducts = demoState.products.filter((product) => cartSignature.split(",").includes(product.id));
        refreshCartProducts(demoState.products);
        if (currentProducts.length !== cartSignature.split(",").length || currentProducts.some((product) => !product.is_active)) {
          setLoadError("Un ou plusieurs articles du panier ne sont plus disponibles. Retirez-les avant de continuer.");
          setProductsVerified(false);
          return;
        }
        syncedCartSignature.current = cartSignature;
        refreshCartProducts(currentProducts);
        setCities(demoState.cities);
        setNeighborhoods(demoState.neighborhoods);
        setCompanies(demoState.companies.filter((company) => company.active !== false));
        setMethods(demoState.methods.filter((method) => method.is_active));
        setLocalFee(demoState.localFee);
        setShopAddress(demoState.shopAddress);
        setShopHours(demoState.shopHours);
        setShopPhone(demoState.shopPhone);
        if (!getValues("phone_number") && demoState.profile.phone_number) {
          setValue("phone_number", toSavedBurkinaPhoneNumber(demoState.profile.phone_number));
        }
        if (!savedLocationApplied.current) {
          const defaultCityId = demoState.profile.default_city_id;
          const defaultNeighborhoodId = demoState.profile.default_neighborhood_id;
          const savedNeighborhood = demoState.neighborhoods.find((item) =>
            item.id === defaultNeighborhoodId && item.city_id === defaultCityId,
          );
          if (
            !getValues("city_id")
            && demoState.cities.some((item) => item.id === defaultCityId)
            && savedNeighborhood
          ) {
            setValue("city_id", defaultCityId);
            setValue("neighborhood_id", savedNeighborhood.id);
            setValue("delivery_type", demoState.cities.find((item) => item.id === defaultCityId)?.is_seller_city ? "local_pickup" : "intercity");
          }
          savedLocationApplied.current = true;
        }
        setLoadError("");
        setProductsVerified(true);
      });
      return;
    }
    if (!isSupabaseConfigured) return;
    if (!cartSignature) return;
    if (syncedCartSignature.current === cartSignature) return;
    const load = async () => {
      const supabase = createClient();
      const [cityResult, neighborhoodResult, companyResult, methodResult, settingsResult, productsResult, profileResult] = await Promise.all([
        supabase.from("cities").select("id,name,is_seller_city").order("name"),
        supabase.from("neighborhoods").select("id,name,city_id").order("name"),
        supabase.from("transport_companies").select("id,name,served_city_ids,estimated_price,estimated_days,active").eq("active", true).order("name"),
        supabase.from("payment_methods").select("id,name,phone_number,instructions,active,display_order").eq("active", true).order("display_order"),
        supabase.from("settings").select("key,value").in("key", ["local_delivery_fee", "shop_address", "shop_hours", "shop_phone"]),
        supabase.from("products").select("id,slug,name,description,price,images,stock,condition,size,active,category_id,created_at,categories(name)").in("id", cartSignature.split(",")),
        supabase.from("profiles").select("phone_number,default_city_id,default_neighborhood_id").maybeSingle(),
      ]);
      const failed = [cityResult, neighborhoodResult, companyResult, methodResult, settingsResult, productsResult, profileResult].find((result) => result.error);
      if (failed?.error) {
        setLoadError("Impossible de charger les options de commande. Vérifiez votre connexion puis actualisez la page.");
        return;
      }
      const currentProducts = (productsResult.data ?? []).map((row) => mapProduct(row));
      refreshCartProducts(currentProducts);
      if (currentProducts.length !== cartSignature.split(",").length || currentProducts.some((product) => !product.is_active)) {
        setLoadError("Un ou plusieurs articles du panier ne sont plus disponibles. Retirez-les avant de continuer.");
        setProductsVerified(false);
        return;
      }
      syncedCartSignature.current = cartSignature;
      refreshCartProducts(currentProducts);
      const currentCities = (cityResult.data ?? []) as City[];
      const currentNeighborhoods = (neighborhoodResult.data ?? []) as Neighborhood[];
      setCities(currentCities);
      setNeighborhoods(currentNeighborhoods);
      setCompanies((companyResult.data ?? []).map((company) => ({
        ...company,
        estimated_price: company.estimated_price === null ? null : Number(company.estimated_price),
      })) as TransportCompany[]);
      setMethods((methodResult.data ?? []).map((method) => ({
        ...method,
        is_active: method.active,
      })) as PaymentMethod[]);
      const deliverySetting = settingsResult.data?.find((item) => item.key === "local_delivery_fee");
      const settingsValue = deliverySetting?.value as { amount?: number } | undefined;
      if (settingsValue?.amount !== undefined) setLocalFee(Number(settingsValue.amount));
      const addressValue = settingsResult.data?.find((item) => item.key === "shop_address")?.value as { text?: string } | undefined;
      const hoursValue = settingsResult.data?.find((item) => item.key === "shop_hours")?.value as { text?: string } | undefined;
      setShopAddress(addressValue?.text ?? "");
      setShopHours(hoursValue?.text ?? "");
      const shopPhoneValue = settingsResult.data?.find((item) => item.key === "shop_phone")?.value as { text?: string } | undefined;
      setShopPhone(toBurkinaPhoneNumber(shopPhoneValue?.text ?? ""));
      if (!getValues("phone_number") && profileResult.data?.phone_number) {
        setValue("phone_number", toSavedBurkinaPhoneNumber(profileResult.data.phone_number));
      }
      if (!savedLocationApplied.current) {
        const defaultCityId = profileResult.data?.default_city_id ?? "";
        const defaultNeighborhoodId = profileResult.data?.default_neighborhood_id ?? "";
        const savedNeighborhood = currentNeighborhoods.find((item) =>
          item.id === defaultNeighborhoodId && item.city_id === defaultCityId,
        );
        const savedCity = currentCities.find((item) => item.id === defaultCityId);
        if (!getValues("city_id") && savedCity && savedNeighborhood) {
          setValue("city_id", savedCity.id);
          setValue("neighborhood_id", savedNeighborhood.id);
          setValue("delivery_type", savedCity.is_seller_city ? "local_pickup" : "intercity");
        }
        savedLocationApplied.current = true;
      }
      setLoadError("");
      setProductsVerified(true);
    };
    void load();
  }, [cartSignature, demoMode, demoReady, demoState, getValues, refreshCartProducts, setValue]);

  const uploadProof = async (orderId: string, values: CheckoutValues, userId: string) => {
    const supabase = createClient();
    const method = methods.find((item) => item.id === values.payment_method_id);
    if (!method) throw new Error("Choisissez un moyen de paiement valide.");
    const extension = values.screenshot.type === "image/png" ? "png" : values.screenshot.type === "image/webp" ? "webp" : "jpg";
    const path = `${userId}/${orderId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("payment-proofs").upload(path, values.screenshot, { contentType: values.screenshot.type });
    if (uploadError) throw new Error("Impossible d'envoyer la capture. Vérifiez votre connexion et réessayez.");
    const { error: insertError } = await supabase.rpc("submit_payment_proof", {
      p_order_id: orderId,
      p_screenshot_path: path,
      p_payment_method_id: method.id,
    });
    if (insertError) throw new Error("La capture a été envoyée, mais sa preuve n'a pas été enregistrée. Réessayez.");
  };

  const submit = async (values: CheckoutValues) => {
    setMessage("");
    setMessageType("error");
    if (!isSupabaseConfigured && !demoMode) {
      setMessage("La boutique doit être connectée à Supabase pour enregistrer une commande.");
      return;
    }
    if (!cart.length) {
      setMessage("Votre panier est vide.");
      return;
    }
    if (deliveryType === "intercity" && !values.transport_company_id) {
      setMessage("Choisissez une société de transport pour votre ville.");
      return;
    }
    if (demoMode) {
      if (!demoReady || !demoSession) {
        router.push("/connexion?next=/commande");
        return;
      }
      const method = methods.find((item) => item.id === values.payment_method_id);
      if (!method) {
        setMessage("Choisissez un moyen de paiement valide.");
        return;
      }
      setSubmitting(true);
      try {
        updateDemoState((state) => ({
          ...state,
          profile: { ...state.profile, phone_number: values.phone_number },
        }));
        const proofData = await screenshotAsDataUrl(values.screenshot);
        const order = makeOrderFromCart(makeSeedOrder(), demoSession, demoState, {
          cityId: values.city_id,
          neighborhoodId: values.neighborhood_id,
          phoneNumber: values.phone_number,
          deliveryType: values.delivery_type === "local_pickup" ? "store_pickup" : values.delivery_type,
          companyId: values.transport_company_id,
          methodId: values.payment_method_id,
          items: cart.map(({ product, quantity }) => ({ productId: product.id, quantity })),
          proofData,
        });
        updateDemoState((state) => ({
          ...state,
          products: state.products.map((product) => {
            const purchased = cart.find((item) => item.product.id === product.id);
            return purchased ? { ...product, stock: product.stock - purchased.quantity } : product;
          }),
          orders: [order, ...state.orders],
        }));
        clearCart();
        router.push(`/mes-commandes?created=${order.id}`);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "La commande de démonstration n'a pas abouti.");
      } finally {
        setSubmitting(false);
      }
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) {
        router.push("/connexion?next=/commande");
        return;
      }
      const { error: phoneError } = await supabase
        .from("profiles")
        .update({ phone_number: values.phone_number })
        .eq("id", authData.user.id);
      if (phoneError) throw new Error("Votre numéro n'a pas pu être enregistré. Vérifiez votre connexion puis réessayez.");
      let orderId = pendingOrderId;
      if (!orderId) {
        const { data, error } = await supabase.rpc("place_order", {
          p_city_id: values.city_id,
          p_neighborhood_id: values.neighborhood_id,
          p_delivery_type: values.delivery_type === "local_pickup" ? "store_pickup" : values.delivery_type,
          p_transport_company_id: values.delivery_type === "intercity" ? values.transport_company_id : null,
          p_delivery_address_note: values.delivery_type === "local_delivery" ? values.delivery_address_note : null,
          p_items: cart.map(({ product, quantity }) => ({ product_id: product.id, quantity })),
        });
        if (error) throw error;
        if (!data) throw new Error("La commande n'a pas pu être créée. Réessayez.");
        orderId = data as string;
        void recordCustomerActivity({
          type: "commande",
          source_event_id: crypto.randomUUID(),
          order_id: orderId,
        });
        setPendingOrderId(orderId);
        const { data: orderSummary, error: orderError } = await supabase
          .from("orders").select("subtotal,delivery_fee,total")
          .eq("id", orderId).single();
        if (orderError) throw orderError;
        const actualSubtotal = Number(orderSummary.subtotal);
        const actualDeliveryFee = Number(orderSummary.delivery_fee);
        const actualTotal = Number(orderSummary.total);
        setServerTotals({ subtotal: actualSubtotal, deliveryFee: actualDeliveryFee, total: actualTotal });
        if (actualSubtotal !== subtotal || actualDeliveryFee !== deliveryFee) {
          setMessageType("warning");
          setMessage(`Les prix ont changé pendant la commande. Le nouveau total est ${formatCfa(actualTotal)}. Vérifiez le montant du transfert puis renvoyez la preuve.`);
          return;
        }
      }
      const { error: orderContactError } = await supabase.rpc("save_order_contact_phone", {
        p_order_id: orderId,
        p_phone_number: values.phone_number,
      });
      if (orderContactError) throw new Error("Le numéro n'a pas pu être associé à la commande. Réessayez.");
      await uploadProof(orderId, values, authData.user.id);
      void recordCustomerActivity({
        type: "preuve_paiement",
        source_event_id: crypto.randomUUID(),
        order_id: orderId,
      });
      clearCart();
      router.push(`/mes-commandes?created=${orderId}`);
      router.refresh();
    } catch {
      setMessage("La commande n'a pas pu être finalisée. Vérifiez votre connexion et réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!cart.length && !pendingOrderId) {
    return <main className="page-wrap cart-empty"><span className="empty-icon">♡</span><h1>Votre panier est vide</h1><Link className="button button-dark" href="/#collection">Retour à la boutique <span>→</span></Link></main>;
  }

  return (
    <main className="page-wrap checkout-page">
      <div className="breadcrumbs"><Link href="/panier">Panier</Link><span>/</span><span>Commande</span></div>
      <p className="eyebrow">DERNIÈRE ÉTAPE</p>
      <h1>Finaliser ma commande</h1>
      {!userEmail && <div className="checkout-signin">Connectez-vous pour continuer. <Link href="/connexion?next=/commande">Recevoir mon code →</Link></div>}
      {demoMode && <div className="info-callout">Parcours de test : aucun paiement réel ne sera effectué.</div>}
      {!isSupabaseConfigured && !demoMode && <div className="form-message error">Configurez Supabase pour activer les commandes et paiements.</div>}
      {loadError && <div className="form-message error">{loadError}</div>}
      <form className="checkout-layout" onSubmit={form.handleSubmit(submit)}>
        <div className="checkout-sections">
          <section className="checkout-section">
            <div className="checkout-section-title"><span>01</span><div><h2>Comment vous joindre ?</h2><p>La boutique peut vous appeler pour confirmer la commande ou la livraison.</p></div></div>
            <label className="field-label" htmlFor="checkout-phone">Votre numéro de téléphone</label>
            <Controller control={form.control} name="phone_number" render={({ field }) => <BurkinaPhoneInput id="checkout-phone" name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur} />} />
            {form.formState.errors.phone_number && <span className="field-error">{form.formState.errors.phone_number.message}</span>}
            {shopPhone && <p className="field-hint">Besoin d’aide ? Appelez la boutique au <a href={toBurkinaPhoneHref(shopPhone)}>{shopPhone}</a>.</p>}
          </section>
          <section className="checkout-section">
            <div className="checkout-section-title"><span>02</span><div><h2>Où livrer votre commande ?</h2><p>Les options de livraison dépendent de votre ville.</p></div></div>
            <label className="field-label" htmlFor="city">Ville</label>
            <select id="city" className="text-input" disabled={!cities.length || Boolean(pendingOrderId)} {...form.register("city_id", { onChange: (event) => {
              const selected = cities.find((item) => item.id === event.target.value);
              form.setValue("neighborhood_id", "");
              form.setValue("transport_company_id", "");
              form.setValue("delivery_type", selected?.is_seller_city ? "local_pickup" : "intercity");
            } })}>
              <option value="">Choisir une ville</option>{cities.map((item) => <option value={item.id} key={item.id}>{item.name}{item.is_seller_city ? " · Boutique" : ""}</option>)}
            </select>
            {form.formState.errors.city_id && <span className="field-error">{form.formState.errors.city_id.message}</span>}
            <label className="field-label" htmlFor="neighborhood">Quartier</label>
            <select id="neighborhood" className="text-input" disabled={!selectedCity || Boolean(pendingOrderId)} {...form.register("neighborhood_id")}>
              <option value="">Choisir un quartier</option>{availableNeighborhoods.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
            {form.formState.errors.neighborhood_id && <span className="field-error">{form.formState.errors.neighborhood_id.message}</span>}
          </section>
          {selectedCity && (
            <section className="checkout-section">
              <div className="checkout-section-title"><span>03</span><div><h2>Mode de livraison</h2><p>{isSellerCity ? "Votre ville est celle de notre boutique." : "Choisissez votre transporteur préféré."}</p></div></div>
              {isSellerCity ? (
                <div className="choice-list">
                  <label className={`choice-card ${deliveryType === "local_pickup" ? "selected" : ""}`}>
                    <input type="radio" value="local_pickup" disabled={Boolean(pendingOrderId)} {...form.register("delivery_type")} />
                    <span className="choice-radio" /><span className="choice-copy"><strong>Retrait en boutique</strong><small>{shopAddress || `Récupérez votre commande à ${city?.name}`}{shopHours ? ` · ${shopHours}` : ""}</small></span><b>Gratuit</b>
                  </label>
                  <label className={`choice-card ${deliveryType === "local_delivery" ? "selected" : ""}`}>
                    <input type="radio" value="local_delivery" disabled={Boolean(pendingOrderId)} {...form.register("delivery_type")} />
                    <span className="choice-radio" /><span className="choice-copy"><strong>Livraison locale</strong><small>Livraison à l&apos;adresse de votre quartier</small></span><b>{formatCfa(localFee)}</b>
                  </label>
                </div>
              ) : (
                <>
                  <input type="hidden" value="intercity" {...form.register("delivery_type")} />
                  <div className="info-callout">Si un prix est indiqué, il est ajouté au montant à transférer à la boutique. Si le prix n&apos;est pas encore connu, il sera confirmé avec vous et payé séparément.</div>
                  {availableCompanies.length ? (
                    <div className="choice-list">
                      {availableCompanies.map((company) => (
                        <label className={`choice-card ${transportCompanyId === company.id ? "selected" : ""}`} key={company.id}>
                          <input type="radio" value={company.id} disabled={Boolean(pendingOrderId)} {...form.register("transport_company_id")} />
                          <span className="choice-radio" /><span className="choice-copy"><strong>{company.name}</strong><small>Livraison à {city?.name}{company.estimated_days ? ` · arrivée prévue sous environ ${company.estimated_days} jour(s)` : ""}</small></span>
                          <b>{company.estimated_price === null ? "Prix à confirmer" : company.estimated_price === 0 ? "Gratuit" : formatCfa(company.estimated_price)}</b>
                        </label>
                      ))}
                    </div>
                  ) : <div className="info-callout">Aucun transporteur n&apos;est encore configuré pour cette ville. Contactez la boutique pour organiser la livraison.</div>}
                </>
              )}
              {form.formState.errors.transport_company_id && <span className="field-error">{form.formState.errors.transport_company_id.message}</span>}
              {deliveryType === "local_delivery" && (
                <div className="address-note-field">
                  <label className="field-label" htmlFor="delivery-address-note">Précision d&apos;adresse / repère</label>
                  <textarea id="delivery-address-note" className="text-input textarea" rows={2} placeholder="Ex. près du marché, portail vert…" disabled={Boolean(pendingOrderId)} {...form.register("delivery_address_note")} />
                  {form.formState.errors.delivery_address_note && <span className="field-error">{form.formState.errors.delivery_address_note.message}</span>}
                </div>
              )}
            </section>
          )}
          <section className="checkout-section">
            <div className="checkout-section-title"><span>04</span><div><h2>Paiement mobile money</h2><p>Effectuez le transfert puis envoyez la capture d&apos;écran.</p></div></div>
            {methods.length ? (
              <div className="payment-method-list">
                {methods.map((method) => (
                  <label className={`payment-method ${paymentMethodId === method.id ? "selected" : ""}`} key={method.id}>
                    <input type="radio" value={method.id} {...form.register("payment_method_id")} />
                    <span className="choice-radio" /><span className="payment-method-name">{method.name}<small>{method.phone_number}</small></span>
                    {paymentMethodId === method.id && <span className="payment-instructions">{method.instructions}</span>}
                  </label>
                ))}
              </div>
            ) : <div className="info-callout">Les moyens de paiement seront affichés dès qu&apos;ils auront été configurés par la boutique.</div>}
            {form.formState.errors.payment_method_id && <span className="field-error">{form.formState.errors.payment_method_id.message}</span>}
            <label className="field-label upload-label" htmlFor="screenshot">Capture d&apos;écran du paiement</label>
            <input id="screenshot" className="text-input file-input" type="file" accept="image/jpeg,image/png,image/webp" {...form.register("screenshot")} />
            <small className="field-hint">JPG, PNG ou WebP · 5 Mo maximum</small>
            {form.formState.errors.screenshot && <span className="field-error">{form.formState.errors.screenshot.message}</span>}
          </section>
        </div>
        <aside className="order-summary checkout-summary">
          <h2>Votre commande</h2>
          <div className="checkout-mini-items">{cart.map(({ product, quantity }) => (
            <div className="checkout-mini-item" key={product.id}>
              <div className="mini-photo">{product.images[0] && <Image src={product.images[0]} alt="" fill sizes="54px" unoptimized={product.images[0].startsWith("data:")} />}</div>
              <div><strong>{product.name}</strong><small>Qté : {quantity}</small></div>
              <b>{formatCfa(product.price * quantity)}</b>
            </div>
          ))}</div>
          <div className="summary-line"><span>Sous-total</span><strong>{formatCfa(displaySubtotal)}</strong></div>
          <div className="summary-line"><span>Livraison</span><strong>{deliveryType === "local_delivery" ? formatCfa(displayDeliveryFee) : deliveryType === "local_pickup" ? "Gratuit" : selectedCompany?.estimated_price === null || selectedCompany?.estimated_price === undefined ? "À confirmer (non inclus)" : selectedCompany.estimated_price === 0 ? "Gratuit" : `${formatCfa(displayDeliveryFee)} (prix estimé)`}</strong></div>
          <div className="summary-total"><span>{deliveryType === "intercity" && selectedCompany?.estimated_price == null ? "Montant à transférer à la boutique" : "Total à transférer"}</span><strong>{formatCfa(displayTotal)}</strong></div>
          {pendingOrderId && <p className="form-message error">Commande {pendingOrderId.slice(0, 8)} déjà enregistrée. Vérifiez le montant mis à jour, puis envoyez la preuve de paiement pour la finaliser. La ville et le mode de livraison ne peuvent plus être modifiés.</p>}
          {cartHasInsufficientStock && <p className="form-message error">La quantité sélectionnée dépasse le stock disponible. Ajustez le panier avant de commander.</p>}
          {message && <p className={`form-message ${messageType}`} role="alert">{message}</p>}
          <button className="button button-dark full-width" type="submit" disabled={submitting || !userEmail || !methods.length || !cities.length || !productsVerified || cartHasInsufficientStock || Boolean(loadError)}>
            {submitting ? "Envoi en cours…" : "Confirmer et envoyer la preuve"} <span>→</span>
          </button>
          <p className="secure-note">Votre commande sera confirmée après vérification du paiement.</p>
        </aside>
      </form>
    </main>
  );
}
