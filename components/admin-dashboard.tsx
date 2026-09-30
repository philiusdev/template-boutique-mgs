"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { FormEvent, ReactNode } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { mapProduct } from "@/lib/product-mapper";
import { getNameMonogram } from "@/lib/name";
import { BurkinaPhoneInput } from "@/components/burkina-phone-input";
import { getLookbookFeaturedProduct } from "@/lib/storefront";
import { isValidBurkinaPhoneNumber, toBurkinaPhoneNumber, toBurkinaPhoneHref, toSavedBurkinaPhoneNumber } from "@/lib/phone";
import { useStore } from "@/components/store-provider";
import { AgencyBillingBanner } from "@/components/agency/AgencyBillingBanner";
import { AgencyPanel } from "@/components/agency/AgencyPanel";
import type { AgencySpace, IdentiteAgence } from "@/lib/agency/types";
import { formatCfa, HOME_PRODUCT_LIMIT, ORDER_STATUS_LABELS, type Category, type City, type OrderStatus, type PaymentMethod, type Product, type TransportCompany } from "@/lib/types";

type Tab = "overview" | "orders" | "products" | "delivery" | "payments" | "agency";
type AdminOrder = {
  id: string;
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  total: number;
  delivery_type: string;
  contact_phone: string | null;
  created_at: string;
  profiles: { email: string; phone_number: string | null } | null;
  cities: { name: string } | null;
  neighborhoods: { name: string } | null;
  transport_companies: { name: string } | null;
  order_items: { id: string; product_name: string; product_image: string | null; quantity: number; unit_price: number }[];
  payment_proofs: { id: string; screenshot_url: string; payment_method: string; status: string; rejection_reason: string | null }[] | null;
};
type DashboardData = {
  orders: AdminOrder[];
  products: Product[];
  categories: Category[];
  cities: City[];
  neighborhoods: { id: string; name: string; city_id: string }[];
  companies: TransportCompany[];
  methods: PaymentMethod[];
  sellerCityId: string;
  localFee: number;
  shopAddress: string;
  shopHours: string;
  shopPhone: string;
};
type DashboardStats = {
  total_orders: number;
  pending_payments: number;
  approved_revenue: number;
  active_products: number;
  low_stock_products: number;
  best_sellers: { name: string; quantity: number }[];
};

const emptyData: DashboardData = {
  orders: [], products: [], categories: [], cities: [], neighborhoods: [], companies: [], methods: [],
  sellerCityId: "", localFee: 1000, shopAddress: "", shopHours: "", shopPhone: "",
};
const emptyStats: DashboardStats = {
  total_orders: 0,
  pending_payments: 0,
  approved_revenue: 0,
  active_products: 0,
  low_stock_products: 0,
  best_sellers: [],
};

const productSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères."),
  description: z.string().trim().min(5, "Ajoutez une description plus complète."),
  price: z.string().regex(/^[1-9]\d*$/, "Entrez un prix en FCFA supérieur à 0.").transform(Number),
  stock: z.string().regex(/^\d+$/, "Entrez un stock valide.").transform(Number),
  category_id: z.string().uuid("Choisissez une catégorie."),
  condition: z.enum(["neuf", "excellent", "tres_bon", "bon", "occasion"]),
  size: z.string(),
  images: z.custom<FileList | undefined>().optional(),
  active: z.boolean(),
});
const categorySchema = z.object({ name: z.string().trim().min(2, "Le nom de catégorie est trop court.") });
const settingsSchema = z.object({
  sellerCityId: z.string().uuid("Choisissez la ville de la boutique."),
  localDeliveryFee: z.string().regex(/^(0|[1-9]\d*)$/, "Entrez un tarif entier positif en FCFA.")
    .transform(Number)
    .refine(Number.isSafeInteger, "Le tarif dépasse la valeur autorisée."),
  shopAddress: z.string().trim().min(3, "Renseignez l'adresse de la boutique.").max(300),
  shopHours: z.string().trim().min(3, "Renseignez les horaires de la boutique.").max(300),
  shopPhone: z.string().refine((value) => !value || isValidBurkinaPhoneNumber(value), "Saisissez les 8 chiffres du numéro après +226."),
});
type ProductFormInput = z.input<typeof productSchema>;
type ProductFormOutput = z.output<typeof productSchema>;
const citySchema = z.object({ name: z.string().trim().min(2, "Entrez le nom de la ville.") });
const companySchema = z.object({
  name: z.string().trim().min(2, "Entrez le nom du transporteur."),
  served_city_ids: z.array(z.string().uuid()).min(1, "Choisissez au moins une ville desservie."),
  estimated_price: z.string()
    .regex(/^(|0|[1-9]\d*)$/, "Entrez un tarif entier positif ou laissez le champ vide.")
    .transform((value) => value === "" ? null : Number(value))
    .refine((value) => value === null || Number.isSafeInteger(value), "Le tarif dépasse la valeur autorisée."),
  estimated_days: z.string()
    .regex(/^(|[1-9]\d*)$/, "Entrez un délai entier supérieur à zéro ou laissez le champ vide.")
    .transform((value) => value === "" ? null : Number(value))
    .refine((value) => value === null || Number.isSafeInteger(value), "Le délai dépasse la valeur autorisée."),
});
const paymentSchema = z.object({
  name: z.string().trim().min(2, "Entrez le nom du service."),
  phone_number: z.string().trim()
    .refine((value) => {
      if (!/^[+\d\s().-]+$/.test(value) || (value.match(/\+/g)?.length ?? 0) > 1 || (value.includes("+") && !value.trimStart().startsWith("+"))) {
        return false;
      }
      const digits = value.replace(/\D/g, "");
      return digits.length === 8 || (digits.length === 11 && digits.startsWith("226"));
    }, "Saisissez un numéro burkinabè composé de 8 chiffres après +226.")
    .transform(toBurkinaPhoneNumber)
    .refine(isValidBurkinaPhoneNumber, "Saisissez un numéro burkinabè composé de 8 chiffres après +226."),
  instructions: z.string().trim().min(8, "Ajoutez les étapes de paiement."),
});
const rejectionSchema = z.object({
  reason: z.string().trim().min(5, "Précisez le motif du refus (au moins 5 caractères).").max(500, "Le motif ne doit pas dépasser 500 caractères."),
});

function nextOrderStatuses(order: AdminOrder): OrderStatus[] {
  switch (order.status) {
    case "verified":
      return ["preparing", "cancelled"];
    case "preparing":
      return [order.delivery_type === "store_pickup" ? "ready_for_pickup" : "shipped", "cancelled"];
    case "ready_for_pickup":
    case "shipped":
      return ["delivered", "cancelled"];
    default:
      return [];
  }
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function conditionValue(label: string): ProductFormInput["condition"] {
  if (label === "Neuf") return "neuf";
  if (label === "Excellent état") return "excellent";
  if (label === "Bon état") return "bon";
  if (label === "Occasion") return "occasion";
  return "tres_bon";
}

function fileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Impossible de lire cette image."));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Le format de l'image est invalide."));
        return;
      }
      const image = new window.Image();
      image.onerror = () => reject(new Error("Impossible de traiter cette image."));
      image.onload = () => {
        const scale = Math.min(1, 900 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Le navigateur ne peut pas traiter cette image."));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Lien de repli du bandeau de facturation, quand le portail en ligne est fermé.
 *
 * Le bandeau n'affiche « Voir et payer » que si la plateforme l'autorise ET
 * fournit une vraie URL ; sinon il se rabat sur ce lien. On le prend dans
 * l'identité que le CONTRAT a déjà construite et validée (`lien_whatsapp`,
 * `lien_email`) plutôt que de recomposer un lien ici : un lien reconstruit dans
 * le site pourrait pointer ailleurs que ce que l'écran affiche, et le
 * commerçant appellerait alors un numéro qui n'est pas celui de son agence.
 *
 * WhatsApp d'abord : c'est le canal que l'agence publie en priorité, et un
 * contact qui aboutit vaut mieux qu'une adresse que personne ne lit. La
 * reconstruction du lien à partir du numéro brut est INTERDITE ici, pour la même
 * raison — d'où le choix de lire `lien_whatsapp` et non `whatsapp`.
 *
 * Aucune coordonnée, aucune chaîne vide : le bandeau n'affiche alors rien plutôt
 * qu'un lien vide, et `null` est la seule valeur qui le dise honnêtement.
 */
function lienContactAgence(identite: IdentiteAgence | null | undefined): string | null {
  const whatsapp = identite?.lien_whatsapp;
  if (typeof whatsapp === "string" && whatsapp !== "") return whatsapp;
  const courriel = identite?.lien_email;
  return typeof courriel === "string" && courriel !== "" ? courriel : null;
}

export function AdminDashboard({ email, agencySpace }: { email: string; agencySpace: AgencySpace | null }) {
  const router = useRouter();
  const { demoMode, demoReady, demoState, updateDemoState, logoutDemo, resetDemo, userDisplayName } = useStore();
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<DashboardData>(emptyData);
  const dataRef = useRef(data);
  const stockSaveVersions = useRef(new Map<string, number>());
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState<"success" | "error" | "info">("success");
  const [busyId, setBusyId] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [proofUrl, setProofUrl] = useState("");
  const [sellerCityValue, setSellerCityValue] = useState("");
  const [localFeeValue, setLocalFeeValue] = useState("1000");
  const [shopAddress, setShopAddress] = useState("");
  const [shopHours, setShopHours] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const replaceDashboardData = useCallback((nextData: DashboardData) => {
    dataRef.current = nextData;
    setData(nextData);
  }, []);
  const updateProductStock = useCallback((productId: string, stock: number) => {
    stockSaveVersions.current.set(productId, (stockSaveVersions.current.get(productId) ?? 0) + 1);
    const product = dataRef.current.products.find((item) => item.id === productId);
    replaceDashboardData({
      ...dataRef.current,
      products: dataRef.current.products.map((product) =>
        product.id === productId ? { ...product, stock } : product,
      ),
    });
    if (product?.is_active) {
      setStats((current) => ({
        ...current,
        low_stock_products: current.low_stock_products
          + Number(stock <= 2)
          - Number(product.stock <= 2),
      }));
    }
  }, [replaceDashboardData]);

  const load = useCallback(async () => {
    const stockVersionsAtStart = new Map(stockSaveVersions.current);
    if (demoMode) {
      if (!demoReady) return;
      const nextData: DashboardData = {
        orders: demoState.orders.map((order) => ({
          ...order,
          profiles: order.profiles
            ? { email: order.profiles.email, phone_number: order.profiles.phone_number ?? null }
            : null,
          order_items: order.order_items.map((item) => ({
            ...item,
            product_image: item.product_image ?? null,
          })),
        })),
        products: demoState.products,
        categories: demoState.categories,
        cities: demoState.cities,
        neighborhoods: demoState.neighborhoods,
        companies: demoState.companies,
        methods: demoState.methods,
        sellerCityId: demoState.cities.find((city) => city.is_seller_city)?.id ?? "",
        localFee: demoState.localFee,
        shopAddress: demoState.shopAddress,
        shopHours: demoState.shopHours,
        shopPhone: demoState.shopPhone,
      };
      const approvedOrders = demoState.orders.filter((order) =>
        ["verified", "preparing", "ready_for_pickup", "shipped", "delivered"].includes(order.status),
      );
      const bestSellers = new Map<string, number>();
      for (const order of demoState.orders.filter((item) => !["rejected", "cancelled"].includes(item.status))) {
        for (const item of order.order_items) bestSellers.set(item.product_name, (bestSellers.get(item.product_name) ?? 0) + item.quantity);
      }
      replaceDashboardData(nextData);
      setStats({
        total_orders: demoState.orders.length,
        pending_payments: demoState.orders.filter((order) => order.status === "pending_verification").length,
        approved_revenue: approvedOrders.reduce((sum, order) => sum + order.total, 0),
        active_products: demoState.products.filter((product) => product.is_active).length,
        low_stock_products: demoState.products.filter((product) => product.is_active && product.stock <= 2).length,
        best_sellers: Array.from(bestSellers, ([name, quantity]) => ({ name, quantity })).sort((a, b) => b.quantity - a.quantity).slice(0, 5),
      });
      setSellerCityValue(nextData.sellerCityId);
      setLocalFeeValue(String(nextData.localFee));
      setShopAddress(nextData.shopAddress);
      setShopHours(nextData.shopHours);
      setShopPhone(nextData.shopPhone);
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const [ordersResult, productsResult, categoriesResult, citiesResult, neighborhoodsResult, companiesResult, methodsResult, settingsResult, statsResult] = await Promise.all([
      supabase.from("orders").select("id,status,subtotal,delivery_fee,total,delivery_type,contact_phone,created_at,profiles(email,phone_number),cities(name),neighborhoods(name),transport_companies(name),order_items(id,product_name_snapshot,product_image_snapshot,quantity,unit_price_snapshot),payment_proofs(id,screenshot_url,payment_method,status,rejection_reason)").order("created_at", { ascending: false }).limit(100),
      supabase.from("products").select("id,slug,name,description,price,images,stock,condition,size,active,category_id,created_at,categories(name)").order("created_at", { ascending: false }),
      supabase.from("categories").select("id,name,slug").order("name"),
      supabase.from("cities").select("id,name,is_seller_city").order("name"),
      supabase.from("neighborhoods").select("id,name,city_id").order("name"),
      supabase.from("transport_companies").select("id,name,served_city_ids,estimated_price,estimated_days,active").order("name"),
      supabase.from("payment_methods").select("id,name,phone_number,instructions,active,display_order").order("display_order"),
      supabase.from("settings").select("key,value").in("key", ["local_delivery_fee", "shop_address", "shop_hours", "shop_phone"]),
      supabase.rpc("admin_dashboard_stats").maybeSingle(),
    ]);
    const failure = [ordersResult, productsResult, categoriesResult, citiesResult, neighborhoodsResult, companiesResult, methodsResult, settingsResult, statsResult].find((result) => result.error);
    if (failure?.error) {
      console.error("Impossible de charger les données du tableau de bord :", failure.error);
      setLoadError("Impossible de charger le tableau de bord. Réessayez dans quelques instants.");
      setLoading(false);
      return;
    }
    setLoadError("");
    const nextData: DashboardData = {
      orders: (ordersResult.data ?? []).map((row) => {
        const order = row as unknown as Record<string, unknown>;
        return {
          ...order,
          total: Number(order.total),
          order_items: ((order.order_items ?? []) as Record<string, unknown>[]).map((item) => ({
            id: item.id as string,
            product_name: item.product_name_snapshot as string,
            product_image: item.product_image_snapshot as string | null,
            quantity: item.quantity as number,
            unit_price: Number(item.unit_price_snapshot),
          })),
        } as unknown as AdminOrder;
      }),
      products: (productsResult.data ?? []).map((row) => mapProduct(row)),
      categories: (categoriesResult.data ?? []) as Category[],
      cities: (citiesResult.data ?? []) as City[],
      neighborhoods: (neighborhoodsResult.data ?? []) as DashboardData["neighborhoods"],
      companies: (companiesResult.data ?? []).map((company) => ({
        ...company,
        estimated_price: company.estimated_price === null ? null : Number(company.estimated_price),
      })) as TransportCompany[],
      methods: (methodsResult.data ?? []).map((method) => ({
        ...method, is_active: method.active,
      })) as PaymentMethod[],
      sellerCityId: citiesResult.data?.find((city) => city.is_seller_city)?.id ?? "",
      localFee: Number((settingsResult.data?.find((setting) => setting.key === "local_delivery_fee")?.value as { amount?: number } | undefined)?.amount ?? 1000),
      shopAddress: String((settingsResult.data?.find((setting) => setting.key === "shop_address")?.value as { text?: string } | undefined)?.text ?? ""),
      shopHours: String((settingsResult.data?.find((setting) => setting.key === "shop_hours")?.value as { text?: string } | undefined)?.text ?? ""),
      shopPhone: toBurkinaPhoneNumber(String((settingsResult.data?.find((setting) => setting.key === "shop_phone")?.value as { text?: string } | undefined)?.text ?? "")),
    };
    const statsData = statsResult.data as Partial<DashboardStats> | null;
    const reconciledData = {
      ...nextData,
      products: nextData.products.map((product) => {
        if (stockSaveVersions.current.get(product.id) === stockVersionsAtStart.get(product.id)) return product;
        const latest = dataRef.current.products.find((item) => item.id === product.id);
        return latest ? { ...product, stock: latest.stock } : product;
      }),
    };
    replaceDashboardData(reconciledData);
    setStats({
      total_orders: Number(statsData?.total_orders ?? 0),
      pending_payments: Number(statsData?.pending_payments ?? 0),
      approved_revenue: Number(statsData?.approved_revenue ?? 0),
      active_products: Number(statsData?.active_products ?? 0),
      low_stock_products: Number(statsData?.low_stock_products ?? 0),
      best_sellers: statsData?.best_sellers ?? [],
    });
    setSellerCityValue(nextData.sellerCityId);
    setLocalFeeValue(String(nextData.localFee));
    setShopAddress(nextData.shopAddress);
    setShopHours(nextData.shopHours);
    setShopPhone(nextData.shopPhone);
    setLoading(false);
  }, [demoMode, demoReady, demoState, replaceDashboardData]);

  const refreshDashboard = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (error) {
      console.error("Échec de l'actualisation du tableau de bord :", error);
      setLoadError("Impossible d'actualiser les données. Vérifiez votre connexion puis réessayez.");
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    queueMicrotask(() => void refreshDashboard());
  }, [refreshDashboard]);

  useEffect(() => {
    if (demoMode) return;
    void fetch("/api/agency/heartbeat", { method: "POST", cache: "no-store" })
      .then((response) => {
        if (!response.ok) console.info("[mgs-agency] Signal de présence non envoyé.");
      })
      .catch((error: unknown) => {
        console.warn("[mgs-agency] Service agence non joignable.", error);
      });
  }, [demoMode]);

  useEffect(() => {
    if (demoMode) return;
    const supabase = createClient();
    const channel = supabase
      .channel("admin-dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void refreshDashboard())
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_proofs" }, () => void refreshDashboard())
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => void refreshDashboard())
      .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, () => void refreshDashboard())
      .on("postgres_changes", { event: "*", schema: "public", table: "cities" }, () => void refreshDashboard())
      .on("postgres_changes", { event: "*", schema: "public", table: "neighborhoods" }, () => void refreshDashboard())
      .on("postgres_changes", { event: "*", schema: "public", table: "transport_companies" }, () => void refreshDashboard())
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_methods" }, () => void refreshDashboard())
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, () => void refreshDashboard())
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setNotice("Actualisation en direct indisponible. Utilisez le bouton Actualiser pour récupérer les dernières données.");
          setNoticeType("info");
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [demoMode, refreshDashboard]);

  const withNotice = async (action: () => Promise<void>, successMessage: string) => {
    setNotice("");
    try {
      await action();
      setNotice(successMessage);
      setNoticeType("success");
      if (!demoMode) await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "L'opération n'a pas abouti.");
      setNoticeType("error");
    }
  };

  const changeStatus = async (orderId: string, status: OrderStatus) => {
    setBusyId(orderId);
    await withNotice(async () => {
      if (demoMode) {
        updateDemoState((state) => {
          const order = state.orders.find((item) => item.id === orderId);
          return {
            ...state,
            products: status === "cancelled" && order
              ? state.products.map((product) => {
                const quantity = order.order_items.filter((item) => item.product_id === product.id).reduce((sum, item) => sum + item.quantity, 0);
                return quantity ? { ...product, stock: product.stock + quantity } : product;
              })
              : state.products,
            orders: state.orders.map((item) => item.id === orderId ? { ...item, status } : item),
          };
        });
        return;
      }
      const { error } = await createClient().from("orders").update({ status }).eq("id", orderId);
      if (error) throw new Error("Statut non modifié. Vérifiez votre connexion puis réessayez.");
    }, "Statut de commande mis à jour.");
    setBusyId("");
  };

  const reviewProof = async (proofId: string, approved: boolean, reason?: string) => {
    setBusyId(proofId);
    await withNotice(async () => {
      if (demoMode) {
        updateDemoState((state) => {
          const rejectedOrder = !approved ? state.orders.find((order) => order.payment_proofs.some((proof) => proof.id === proofId)) : undefined;
          return {
            ...state,
            products: rejectedOrder
              ? state.products.map((product) => {
                const quantity = rejectedOrder.order_items.filter((item) => item.product_id === product.id).reduce((sum, item) => sum + item.quantity, 0);
                return quantity ? { ...product, stock: product.stock + quantity } : product;
              })
              : state.products,
            orders: state.orders.map((order) => {
              if (!order.payment_proofs.some((proof) => proof.id === proofId)) return order;
              return {
                ...order,
                status: approved ? "verified" : "rejected",
                payment_proofs: order.payment_proofs.map((proof) => proof.id === proofId ? {
                  ...proof,
                  status: approved ? "verified" : "rejected",
                  rejection_reason: approved ? null : reason ?? "Preuve non conforme.",
                } : proof),
              };
            }),
          };
        });
        return;
      }
      const { error } = await createClient().rpc("review_payment_proof", {
        p_proof_id: proofId,
        p_approved: approved,
        p_rejection_reason: approved ? null : reason,
      });
      if (error) throw new Error("La preuve n'a pas pu être traitée. Réessayez.");
    }, approved ? "Paiement validé. La commande passe en paiement vérifié." : "Preuve refusée.");
    setBusyId("");
  };

  const openProof = async (path: string) => {
    setBusyId(path);
    setNotice("");
    if (demoMode) {
      setProofUrl(path);
      setBusyId("");
      return;
    }
    const { data: signed, error } = await createClient().storage.from("payment-proofs").createSignedUrl(path, 300);
    setBusyId("");
    if (error) {
      console.error("Impossible d'ouvrir la capture de paiement :", error);
      setNotice("Impossible d'ouvrir la capture. Réessayez.");
      setNoticeType("error");
    }
    else setProofUrl(signed.signedUrl);
  };

  const signOut = async () => {
    if (demoMode) {
      logoutDemo();
      router.push("/");
      return;
    }
    const { error } = await createClient().auth.signOut();
    if (error) {
      console.error("Impossible de déconnecter le compte administrateur :", error);
      setNotice("Déconnexion impossible. Réessayez.");
      setNoticeType("error");
    }
    else router.push("/");
  };

  const pendingCount = stats.pending_payments;

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Vue d'ensemble" },
    { id: "orders", label: `Commandes${pendingCount ? ` · ${pendingCount}` : ""}` },
    { id: "products", label: "Produits" },
    { id: "delivery", label: "Livraison" },
    { id: "payments", label: "Paiements" },
    ...(agencySpace ? [{ id: "agency" as const, label: "Mon agence" }] : []),
  ];

  return (
    <main className="admin-page" aria-busy={loading || refreshing}>
      <div className="admin-header">
        <div><p className="eyebrow">ROYAL SHOP · BOUTIQUE</p><h1>Tableau de bord</h1></div>
        <div className="admin-user"><span className="admin-avatar">{getNameMonogram(userDisplayName, email)}</span><span>{userDisplayName || email}</span><button className="text-button" onClick={() => void refreshDashboard()} disabled={refreshing} aria-busy={refreshing}>{refreshing ? "Actualisation…" : "Actualiser"}</button>{demoMode && <button className="text-button" onClick={() => { if (window.confirm("Réinitialiser les produits, commandes et réglages de test ?")) resetDemo(); }}>Réinitialiser les tests</button>}<button className="text-button" onClick={signOut}>Déconnexion</button></div>
      </div>
      {agencySpace?.facturation && <AgencyBillingBanner billing={agencySpace.facturation} lienContact={lienContactAgence(agencySpace.identite)} />}
      <nav className="admin-tabs" aria-label="Sections d'administration">
        {tabs.map((item) => <button key={item.id} aria-current={tab === item.id ? "page" : undefined} onClick={() => { setTab(item.id); setNotice(""); setNoticeType("success"); }} className={tab === item.id ? "active" : ""}>{item.label}</button>)}
      </nav>
      {notice && <p className={`admin-notice ${noticeType}`} role={noticeType === "error" ? "alert" : "status"} aria-live={noticeType === "error" ? "assertive" : "polite"}>{notice}</p>}
      {loadError && <div className="admin-load-error" role="alert"><span>{loadError}</span><button className="button button-outline button-small" onClick={() => void refreshDashboard()} disabled={refreshing}>{refreshing ? "Actualisation…" : "Réessayer"}</button></div>}
      {loading ? <div className="loading-panel"><span className="loader" /> Chargement du tableau de bord…</div> : (
        <>
          {tab === "overview" && <Overview orders={data.orders} products={data.products} demoMode={demoMode} stats={stats} onOrders={() => setTab("orders")} onProducts={() => setTab("products")} />}
          {tab === "orders" && <OrdersPanel orders={data.orders} busyId={busyId} onStatus={changeStatus} onReview={reviewProof} onOpenProof={openProof} />}
          {tab === "products" && (
            <ProductsPanel products={data.products} categories={data.categories} editingProduct={editingProduct} showForm={showProductForm} setEditingProduct={setEditingProduct} setShowForm={setShowProductForm} withNotice={withNotice} onStockSaved={updateProductStock} />
          )}
          {tab === "delivery" && (
            <DeliveryPanel data={data} sellerCityValue={sellerCityValue} setSellerCityValue={setSellerCityValue} localFeeValue={localFeeValue} setLocalFeeValue={setLocalFeeValue} shopAddress={shopAddress} setShopAddress={setShopAddress} shopHours={shopHours} setShopHours={setShopHours} shopPhone={shopPhone} setShopPhone={setShopPhone} withNotice={withNotice} />
          )}
          {tab === "payments" && <PaymentsPanel methods={data.methods} withNotice={withNotice} />}
          {tab === "agency" && agencySpace && <AgencyPanel space={agencySpace} requesterEmail={email} routeRevalidation="/api/agency/revalidate" cheminRevalidation="/admin" />}
        </>
      )}
      {proofUrl && <div className="modal-backdrop" role="presentation" onClick={() => setProofUrl("")}><div className="proof-modal" role="dialog" aria-modal="true" aria-label="Preuve de paiement" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setProofUrl("")} aria-label="Fermer">×</button><Image src={proofUrl} alt="Capture de paiement" width={1000} height={1200} unoptimized /></div></div>}
    </main>
  );
}

function Overview({ orders, products, demoMode, stats, onOrders, onProducts }: {
  orders: AdminOrder[];
  products: Product[];
  demoMode: boolean;
  stats: DashboardStats;
  onOrders: () => void;
  onProducts: () => void;
}) {
  const availableProducts = products.filter((product) => product.is_active && product.stock > 0);
  const homeProducts = demoMode ? availableProducts : availableProducts.slice(0, HOME_PRODUCT_LIMIT);
  const featuredProduct = getLookbookFeaturedProduct(homeProducts);

  return (
    <div className="admin-content">
      <div className="stat-grid">
        <article className="stat-card"><span>Commandes totales</span><strong>{stats.total_orders}</strong><small>Toutes les commandes</small><i>↗</i></article>
        <article className="stat-card stat-highlight"><span>À vérifier</span><strong>{stats.pending_payments}</strong><small>Preuves de paiement en attente</small><i>◷</i></article>
        <article className="stat-card"><span>Chiffre d&apos;affaires confirmé</span><strong>{formatCfa(stats.approved_revenue)}</strong><small>Hors attente, refus et annulations</small><i>◉</i></article>
        <article className="stat-card"><span>Produits en ligne</span><strong>{stats.active_products}</strong><small>{stats.low_stock_products} en stock faible (≤ 2)</small><i>✳</i></article>
      </div>
      <section className="admin-storefront-panel">
        <div className="admin-storefront-heading">
          <div><p className="eyebrow">APERÇU DE LA BOUTIQUE</p><h2>Ce que voient vos clients</h2></div>
          <div className="admin-storefront-actions">
            <Link className="button button-outline button-small" href="/">Voir la boutique <span>↗</span></Link>
            <button className="button button-outline button-small" onClick={onProducts}>Gérer les produits <span>→</span></button>
          </div>
        </div>
        <div className="admin-storefront-content">
          {featuredProduct && <div className="admin-lookbook-preview">
            {featuredProduct.images[0] && <div className="admin-lookbook-preview-image">
              <Image
                src={featuredProduct.images[0]}
                alt=""
                fill
                sizes="58px"
                unoptimized={featuredProduct.images[0].startsWith("data:")}
              />
            </div>}
            <div>
              <small>COUVERTURE ACTUELLE</small>
              <strong>{featuredProduct.name}</strong>
              <span>{featuredProduct.category} · {formatCfa(featuredProduct.price)}</span>
            </div>
          </div>}
          <div className="admin-storefront-summary">
            <strong>{homeProducts.length}</strong>
            <span>article{homeProducts.length !== 1 ? "s" : ""} dans la collection</span>
            <small>Les autres articles disponibles apparaissent dans le catalogue sous la couverture.</small>
          </div>
        </div>
      </section>
      <div className="overview-grid">
        <section className="admin-panel">
          <div className="panel-heading"><div><p className="eyebrow">À TRAITER</p><h2>Commandes récentes</h2></div><button className="text-link" onClick={onOrders}>Toutes les commandes →</button></div>
          {orders.slice(0, 5).length ? <div className="recent-orders">
            {orders.slice(0, 5).map((order) => <div className="recent-order-row" key={order.id}><span className="order-dot" /><div><strong>#{order.id.slice(0, 8).toUpperCase()}</strong><small>{order.profiles?.email ?? "Client"} · {new Date(order.created_at).toLocaleDateString("fr-FR")}</small></div><b>{formatCfa(order.total)}</b><span className={`status-badge status-${order.status}`}>{ORDER_STATUS_LABELS[order.status]}</span></div>)}
          </div> : <p className="table-empty">Aucune commande pour le moment.</p>}
        </section>
        <section className="admin-panel">
          <div className="panel-heading"><div><p className="eyebrow">VOS FAVORIS</p><h2>Meilleures ventes</h2></div><span className="panel-sparkle">✳</span></div>
          {stats.best_sellers.length ? <div className="bestsellers-list">{stats.best_sellers.map(({ name, quantity }, index) => <div className="bestseller-row" key={name}><span className="bestseller-rank">0{index + 1}</span><strong>{name}</strong><span>{quantity} vendu{quantity > 1 ? "s" : ""}</span></div>)}</div> : <p className="table-empty">Les ventes apparaîtront ici.</p>}
        </section>
      </div>
    </div>
  );
}

function OrdersPanel({ orders, busyId, onStatus, onReview, onOpenProof }: {
  orders: AdminOrder[];
  busyId: string;
  onStatus: (id: string, status: OrderStatus) => void;
  onReview: (proofId: string, approved: boolean, reason?: string) => void;
  onOpenProof: (path: string) => void;
}) {
  const [rejectingProofId, setRejectingProofId] = useState("");
  const rejectionForm = useForm<z.infer<typeof rejectionSchema>>({
    resolver: zodResolver(rejectionSchema),
    defaultValues: { reason: "" },
  });
  if (!orders.length) return <div className="admin-panel table-empty">Aucune commande reçue.</div>;
  return (
    <section className="admin-panel orders-admin-panel">
      <div className="panel-heading"><div><p className="eyebrow">SUIVI DES VENTES</p><h2>Commandes récentes</h2></div><span>{orders.length} commandes</span></div>
      <div className="admin-order-list">
        {orders.map((order) => {
          const proof = order.payment_proofs?.[0];
          const nextStatuses = nextOrderStatuses(order);
          const customerPhone = toSavedBurkinaPhoneNumber(order.contact_phone || order.profiles?.phone_number);
          return <article className="admin-order" key={order.id}>
            <div className="admin-order-top">
              <div><span className="order-reference">#{order.id.slice(0, 8).toUpperCase()}</span><small>{new Date(order.created_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</small></div>
              <strong>{formatCfa(order.total)}</strong>
              <select className="status-select" value={order.status} disabled={busyId === order.id || nextStatuses.length === 0} onChange={(event) => onStatus(order.id, event.target.value as OrderStatus)} aria-label="Modifier le statut">
                <option value={order.status}>{ORDER_STATUS_LABELS[order.status]}</option>
                {nextStatuses.map((status) => <option key={status} value={status}>{ORDER_STATUS_LABELS[status]}</option>)}
              </select>
            </div>
            <div className="admin-order-detail">
              <div><span>Client</span><strong>{order.profiles?.email ?? "Compte client"}</strong>{customerPhone && <a className="admin-phone-link" href={toBurkinaPhoneHref(customerPhone)}>Appeler {customerPhone}</a>}</div>
              <div><span>Adresse</span><strong>{order.neighborhoods?.name ?? "—"}, {order.cities?.name ?? "—"}</strong></div>
              <div><span>Livraison</span><strong>{order.delivery_type === "store_pickup" ? "Retrait boutique" : order.delivery_type === "local_delivery" ? `Locale · ${formatCfa(order.delivery_fee)}` : order.transport_companies?.name ?? "Interurbain"}</strong></div>
            </div>
            <div className="admin-order-items">{order.order_items.map((item) => <span className="admin-order-item" key={item.id}>{item.product_image && <Image src={item.product_image} alt="" width={42} height={52} unoptimized={item.product_image.startsWith("data:")} />}<span>{item.product_name} <small>× {item.quantity}</small></span></span>)}</div>
            <div className="admin-proof-row">
              {proof ? <>
                <button className="proof-preview-button" onClick={() => onOpenProof(proof.screenshot_url)} disabled={busyId === proof.screenshot_url}>Voir la capture ↗</button>
                <span>{proof.payment_method} · {proof.status === "pending" ? "À vérifier" : proof.status === "verified" ? "Validée" : "Refusée"}</span>
                {proof.status === "pending" && <div className="proof-actions">
                  <button className="button button-small button-green" disabled={busyId === proof.id} onClick={() => onReview(proof.id, true)}>Valider</button>
                  <button className="button button-small button-outline" disabled={busyId === proof.id} onClick={() => { setRejectingProofId(proof.id); rejectionForm.reset({ reason: "" }); }}>Refuser</button>
                </div>}
                {proof.status === "rejected" && proof.rejection_reason && <span className="rejection-reason">Motif : {proof.rejection_reason}</span>}
              </> : <span className="muted">Aucune preuve de paiement téléversée</span>}
            </div>
            {proof?.status === "pending" && rejectingProofId === proof.id && (
              <form className="rejection-form" onSubmit={rejectionForm.handleSubmit(({ reason }) => { onReview(proof.id, false, reason); setRejectingProofId(""); })}>
                <label className="field-label" htmlFor={`rejection-${proof.id}`}>Motif à transmettre au client</label>
                <textarea id={`rejection-${proof.id}`} className="text-input textarea" rows={2} {...rejectionForm.register("reason")} />
                {rejectionForm.formState.errors.reason && <span className="field-error">{rejectionForm.formState.errors.reason.message}</span>}
                <div className="editor-actions"><button className="button button-dark button-small" type="submit">Confirmer le refus</button><button className="button button-outline button-small" type="button" onClick={() => setRejectingProofId("")}>Annuler</button></div>
              </form>
            )}
          </article>;
        })}
      </div>
    </section>
  );
}

function ProductsPanel({ products, categories, editingProduct, showForm, setEditingProduct, setShowForm, withNotice, onStockSaved }: {
  products: Product[];
  categories: Category[];
  editingProduct: Product | null;
  showForm: boolean;
  setEditingProduct: (product: Product | null) => void;
  setShowForm: (show: boolean) => void;
  withNotice: (action: () => Promise<void>, message: string) => Promise<void>;
  onStockSaved: (productId: string, stock: number) => void;
}) {
  const { demoMode, updateDemoState } = useStore();
  const [saving, setSaving] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [productCategory, setProductCategory] = useState("all");
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
  const [stockSaving, setStockSaving] = useState<Record<string, boolean>>({});
  const [stockErrors, setStockErrors] = useState<Record<string, string>>({});
  const [stockSaved, setStockSaved] = useState<Record<string, boolean>>({});
  const stockEditVersions = useRef(new Map<string, number>());
  const [editingCategoryId, setEditingCategoryId] = useState("");
  const categoryForm = useForm<z.infer<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "" },
  });
  const form = useForm<ProductFormInput, unknown, ProductFormOutput>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", description: "", price: "", stock: "1", category_id: categories[0]?.id ?? "", condition: "tres_bon", size: "", images: undefined, active: true },
  });
  const filteredProducts = products.filter((product) => {
    const query = productQuery.trim().toLocaleLowerCase("fr");
    const matchesQuery = !query || `${product.name} ${product.category} ${product.size ?? ""}`.toLocaleLowerCase("fr").includes(query);
    const selectedCategory = categories.find((category) => category.id === productCategory);
    const matchesCategory = productCategory === "all"
      || product.category_id === productCategory
      || (!product.category_id && product.category === selectedCategory?.name);
    return matchesQuery && matchesCategory;
  });
  useEffect(() => {
    form.reset(editingProduct ? {
      name: editingProduct.name, description: editingProduct.description,
      price: String(editingProduct.price), stock: String(editingProduct.stock),
      category_id: editingProduct.category_id ?? "", condition: conditionValue(editingProduct.condition),
      size: editingProduct.size ?? "", images: undefined, active: editingProduct.is_active,
    } : { name: "", description: "", price: "", stock: "1", category_id: categories[0]?.id ?? "", condition: "tres_bon", size: "", images: undefined, active: true });
  }, [categories, editingProduct, form]);

  const closeForm = () => { setShowForm(false); setEditingProduct(null); form.reset(); };
  const saveProduct = async (values: ProductFormOutput) => {
    setSaving(true);
    await withNotice(async () => {
      const images = editingProduct?.images ?? [];
      const uploadedImages: string[] = [];
      const selectedFiles = values.images ? Array.from(values.images).slice(0, 5) : [];
      for (const file of selectedFiles) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
          throw new Error("Chaque photo doit être au format JPG, PNG ou WebP et ne pas dépasser 5 Mo.");
        }
        if (demoMode) {
          uploadedImages.push(await fileAsDataUrl(file));
          continue;
        }
        const supabase = createClient();
        const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
        const path = `products/${crypto.randomUUID()}.${extension}`;
        const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type });
        if (error) throw new Error("Envoi de la photo impossible. Vérifiez le format et réessayez.");
        const { data } = supabase.storage.from("product-images").getPublicUrl(path);
        uploadedImages.push(data.publicUrl);
      }
      const valuesToSave = {
        slug: slugify(values.name),
        name: values.name, description: values.description, price: values.price,
        stock: values.stock, category_id: values.category_id, condition: values.condition,
        size: values.size.trim() || null,
        images: selectedFiles.length ? uploadedImages : images,
        active: values.active,
      };
      if (demoMode) {
        const product: Product = {
          id: editingProduct?.id ?? crypto.randomUUID(),
          ...valuesToSave,
          category: categories.find((category) => category.id === values.category_id)?.name ?? "Sans catégorie",
          category_id: values.category_id,
          condition: values.condition === "neuf" ? "Neuf" : values.condition === "excellent" ? "Excellent état" : values.condition === "tres_bon" ? "Très bon état" : values.condition === "bon" ? "Bon état" : "Occasion",
          is_active: values.active,
          created_at: editingProduct?.created_at ?? new Date().toISOString(),
        };
        updateDemoState((state) => ({
          ...state,
          products: editingProduct
            ? state.products.map((item) => item.id === product.id ? product : item)
            : [product, ...state.products],
        }));
        closeForm();
        return;
      }
      const supabase = createClient();
      const result = editingProduct
        ? await supabase.from("products").update(valuesToSave).eq("id", editingProduct.id)
        : await supabase.from("products").insert(valuesToSave);
      if (result.error) throw new Error("Produit non enregistré. Vérifiez les informations et réessayez.");
      closeForm();
    }, editingProduct ? "Produit modifié." : "Produit ajouté à la boutique.");
    setSaving(false);
  };

  const saveCategory = async (values: z.infer<typeof categorySchema>) => {
    await withNotice(async () => {
      if (demoMode) {
        const category: Category = { id: editingCategoryId || crypto.randomUUID(), name: values.name, slug: slugify(values.name) };
        updateDemoState((state) => ({
          ...state,
          categories: editingCategoryId
            ? state.categories.map((item) => item.id === editingCategoryId ? category : item)
            : [...state.categories, category],
          products: editingCategoryId
            ? state.products.map((product) => product.category_id === editingCategoryId ? { ...product, category: values.name } : product)
            : state.products,
        }));
        categoryForm.reset();
        setEditingCategoryId("");
        return;
      }
      const query = createClient().from("categories");
      const { error } = editingCategoryId
        ? await query.update({ name: values.name, slug: slugify(values.name) }).eq("id", editingCategoryId)
        : await query.insert({
        name: values.name,
        slug: slugify(values.name),
      });
      if (error) throw new Error("Catégorie non enregistrée. Vérifiez son nom et réessayez.");
      categoryForm.reset();
      setEditingCategoryId("");
    }, editingCategoryId ? "Catégorie modifiée." : "Catégorie ajoutée.");
  };

  const removeCategory = async (category: Category) => {
    if (!window.confirm(`Supprimer la catégorie « ${category.name} » ? Les produits resteront dans le catalogue sans catégorie.`)) return;
    await withNotice(async () => {
      if (demoMode) {
        updateDemoState((state) => ({
          ...state,
          categories: state.categories.filter((item) => item.id !== category.id),
          products: state.products.map((product) => product.category_id === category.id
            ? { ...product, category_id: null, category: "Sans catégorie" }
            : product),
        }));
        if (editingCategoryId === category.id) {
          categoryForm.reset();
          setEditingCategoryId("");
        }
        return;
      }
      const { error } = await createClient().from("categories").delete().eq("id", category.id);
      if (error) throw new Error("Catégorie non supprimée. Réessayez.");
      if (editingCategoryId === category.id) {
        categoryForm.reset();
        setEditingCategoryId("");
      }
    }, "Catégorie supprimée.");
  };

  const updateStock = async (product: Product) => {
    const value = stockDrafts[product.id] ?? String(product.stock);
    if (!/^(0|[1-9]\d*)$/.test(value) || !Number.isSafeInteger(Number(value))) {
      setStockErrors((errors) => ({ ...errors, [product.id]: "Entrez un stock entier positif ou nul." }));
      setStockSaved((saved) => ({ ...saved, [product.id]: false }));
      return;
    }
    const stock = Number(value);
    const editVersion = stockEditVersions.current.get(product.id) ?? 0;
    setStockSaving((current) => ({ ...current, [product.id]: true }));
    setStockErrors((errors) => ({ ...errors, [product.id]: "" }));
    try {
      if (demoMode) {
        updateDemoState((state) => ({
          ...state,
          products: state.products.map((item) => item.id === product.id ? { ...item, stock } : item),
        }));
      } else {
        const { error } = await createClient().from("products").update({ stock }).eq("id", product.id);
        if (error) throw error;
      }
      if (stockEditVersions.current.get(product.id) === editVersion) {
        onStockSaved(product.id, stock);
        setStockSaved((saved) => ({ ...saved, [product.id]: true }));
        setStockDrafts((drafts) => {
          const next = { ...drafts };
          delete next[product.id];
          return next;
        });
      }
    } catch (error) {
      if (stockEditVersions.current.get(product.id) === editVersion) {
        console.error(`Impossible d'enregistrer le stock du produit ${product.id} :`, error);
        setStockSaved((saved) => ({ ...saved, [product.id]: false }));
        setStockErrors((errors) => ({ ...errors, [product.id]: "Stock non modifié. Vérifiez votre connexion puis réessayez." }));
      }
    } finally {
      setStockSaving((current) => ({ ...current, [product.id]: false }));
    }
  };

  const removeProduct = async (product: Product) => {
    if (!window.confirm(`Supprimer « ${product.name} » ?`)) return;
    await withNotice(async () => {
      if (demoMode) {
        updateDemoState((state) => ({ ...state, products: state.products.filter((item) => item.id !== product.id) }));
        return;
      }
      const { error } = await createClient().from("products").delete().eq("id", product.id);
      if (error) throw new Error("Produit non supprimé. Réessayez.");
    }, "Produit supprimé.");
  };

  return (
    <section className="admin-panel products-admin-panel">
      <div className="panel-heading"><div><p className="eyebrow">VOTRE CATALOGUE</p><h2>Produits <span className="catalog-item-count">{products.length}</span></h2></div><button className="button button-dark button-small" type="button" onClick={() => { setEditingProduct(null); setShowForm(true); }}>＋ Ajouter un produit</button></div>
      <section className="admin-category-section" aria-labelledby="admin-categories-title">
        <div className="admin-subheading"><h3 id="admin-categories-title">Catégories</h3><span>{categories.length} au total</span></div>
        <form className="inline-add-form category-add-form" onSubmit={categoryForm.handleSubmit(saveCategory)}>
          <input className="text-input" aria-label="Nom de la catégorie" placeholder={editingCategoryId ? "Nom de la catégorie" : "Ex. Vestes, Chemises…"} {...categoryForm.register("name")} />
          <div className="editor-actions">
            <button className="button button-outline button-small" type="submit" disabled={categoryForm.formState.isSubmitting}>{categoryForm.formState.isSubmitting ? "Enregistrement…" : editingCategoryId ? "Enregistrer" : "Ajouter une catégorie"}</button>
            {editingCategoryId && <button className="text-button" type="button" onClick={() => { setEditingCategoryId(""); categoryForm.reset(); }}>Annuler</button>}
          </div>
        </form>
      {categoryForm.formState.errors.name && <span className="field-error">{categoryForm.formState.errors.name.message}</span>}
      {!!categories.length && <div className="category-manage-list">{categories.map((category) => <div className="category-manage-row" key={category.id}>
        <span>{category.name}</span>
        <div className="manage-actions">
          <button className="text-button" type="button" onClick={() => { setEditingCategoryId(category.id); categoryForm.reset({ name: category.name }); }}>Modifier</button>
          <button className="text-button danger-text" type="button" onClick={() => void removeCategory(category)} aria-label={`Supprimer la catégorie ${category.name}`}>Supprimer</button>
        </div>
      </div>)}</div>}
      </section>
      <div className="admin-product-filters">
        <label className="search-box"><span className="visually-hidden">Chercher un produit</span><input value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Chercher un produit…" /></label>
        <label className="admin-product-category-filter"><span className="visually-hidden">Filtrer par catégorie</span><select className="text-input" value={productCategory} onChange={(event) => setProductCategory(event.target.value)}><option value="all">Toutes les catégories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <span className="admin-product-result-count">{filteredProducts.length} produit{filteredProducts.length !== 1 ? "s" : ""}</span>
      </div>
      {showForm && <form className="product-editor" onSubmit={form.handleSubmit(saveProduct)}>
        <div className="editor-heading"><h3>{editingProduct ? "Modifier le produit" : "Nouvelle pièce"}</h3><button className="modal-close inline" type="button" onClick={closeForm} aria-label="Fermer">×</button></div>
        <div className="form-grid">
          <FormField label="Nom du produit" error={form.formState.errors.name?.message}><input className="text-input" {...form.register("name")} /></FormField>
          <FormField label="Catégorie" error={form.formState.errors.category_id?.message}><select className="text-input" {...form.register("category_id")}><option value="">Choisir une catégorie</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></FormField>
          <FormField label="Prix (FCFA)" error={form.formState.errors.price?.message}><input className="text-input" inputMode="numeric" {...form.register("price")} /></FormField>
          <FormField label="Stock" error={form.formState.errors.stock?.message}><input className="text-input" inputMode="numeric" {...form.register("stock")} /></FormField>
          <FormField label="Taille"><input className="text-input" placeholder="Ex. M ou Taille unique" {...form.register("size")} /></FormField>
          <FormField label="État"><select className="text-input" {...form.register("condition")}><option value="neuf">Neuf</option><option value="excellent">Excellent état</option><option value="tres_bon">Très bon état</option><option value="bon">Bon état</option><option value="occasion">Occasion</option></select></FormField>
          <label className="active-check"><input type="checkbox" {...form.register("active")} /> Produit visible dans la boutique</label>
          <FormField label="Description" error={form.formState.errors.description?.message}><textarea className="text-input textarea" rows={3} {...form.register("description")} /></FormField>
          <FormField label={`Photos · JPG, PNG ou WebP · 5 Mo max${editingProduct?.images.length ? ` · ${editingProduct.images.length} photo(s) actuelle(s)` : ""}`}><input className="text-input file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple {...form.register("images")} /></FormField>
        </div>
        <div className="editor-actions"><button className="button button-dark" type="submit" disabled={saving}>{saving ? "Enregistrement…" : editingProduct ? "Enregistrer" : "Ajouter le produit"}</button><button className="button button-outline" type="button" onClick={closeForm}>Annuler</button></div>
      </form>}
      {filteredProducts.length ? <div className="admin-products-grid">{filteredProducts.map((product) => <article className="admin-product" key={product.id}>
        <div className="admin-product-image">{product.images[0] && <Image src={product.images[0]} alt="" fill sizes="100px" unoptimized={product.images[0].startsWith("data:")} />}</div>
        <div className="admin-product-copy"><span className="product-category">{product.category}</span><strong>{product.name}</strong><small>{formatCfa(product.price)} · {product.size ?? "Unique"}</small>{!product.is_active && <span className="muted">Masqué</span>}</div>
        <div className="stock-quick-edit">
          <label htmlFor={`stock-${product.id}`}>Stock</label>
          <input id={`stock-${product.id}`} aria-label={`Stock ${product.name}`} aria-describedby={stockErrors[product.id] ? `stock-error-${product.id}` : stockSaved[product.id] ? `stock-saved-${product.id}` : undefined} type="number" min="0" step="1" value={stockDrafts[product.id] ?? product.stock} disabled={stockSaving[product.id]} onChange={(event) => {
            stockEditVersions.current.set(product.id, (stockEditVersions.current.get(product.id) ?? 0) + 1);
            setStockDrafts((drafts) => ({ ...drafts, [product.id]: event.target.value }));
            setStockErrors((errors) => ({ ...errors, [product.id]: "" }));
            setStockSaved((saved) => ({ ...saved, [product.id]: false }));
          }} />
          <button className="text-button" type="button" disabled={stockSaving[product.id] || stockDrafts[product.id] === undefined || stockDrafts[product.id] === String(product.stock)} onClick={() => void updateStock(product)}>{stockSaving[product.id] ? "Enregistrement…" : "Enregistrer"}</button>
          {stockErrors[product.id] && <span id={`stock-error-${product.id}`} className="field-error" role="alert">{stockErrors[product.id]}</span>}
          {stockSaved[product.id] && <span id={`stock-saved-${product.id}`} className="stock-saved" role="status">Stock enregistré.</span>}
        </div>
        <div className="admin-product-actions"><button className="text-button" onClick={() => { setEditingProduct(product); setShowForm(true); }}>Modifier</button><button className="text-button danger-text" onClick={() => void removeProduct(product)}>Supprimer</button></div>
      </article>)}</div> : products.length ? <div className="admin-empty-state"><strong>Aucun produit trouvé</strong><p>Essayez un autre nom ou choisissez une autre catégorie.</p><button className="button button-outline button-small" type="button" onClick={() => { setProductQuery(""); setProductCategory("all"); }}>Effacer la recherche</button></div> : <div className="admin-empty-state"><strong>Votre catalogue est vide</strong><p>Ajoutez votre premier vêtement ou accessoire pour commencer à vendre.</p><button className="button button-dark button-small" type="button" onClick={() => { setEditingProduct(null); setShowForm(true); }}>＋ Ajouter un produit</button></div>}
    </section>
  );
}

function DeliveryPanel({ data, sellerCityValue, setSellerCityValue, localFeeValue, setLocalFeeValue, shopAddress, setShopAddress, shopHours, setShopHours, shopPhone, setShopPhone, withNotice }: {
  data: DashboardData;
  sellerCityValue: string;
  setSellerCityValue: (value: string) => void;
  localFeeValue: string;
  setLocalFeeValue: (value: string) => void;
  shopAddress: string;
  setShopAddress: (value: string) => void;
  shopHours: string;
  setShopHours: (value: string) => void;
  shopPhone: string;
  setShopPhone: (value: string) => void;
  withNotice: (action: () => Promise<void>, message: string) => Promise<void>;
}) {
  const { demoMode, updateDemoState } = useStore();
  const [editingCityId, setEditingCityId] = useState("");
  const [editingCompanyId, setEditingCompanyId] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const cityForm = useForm<z.infer<typeof citySchema>>({ resolver: zodResolver(citySchema), defaultValues: { name: "" } });
  const companyForm = useForm<z.input<typeof companySchema>, unknown, z.output<typeof companySchema>>({ resolver: zodResolver(companySchema), defaultValues: { name: "", served_city_ids: [], estimated_price: "", estimated_days: "" } });
  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = settingsSchema.safeParse({ sellerCityId: sellerCityValue, localDeliveryFee: localFeeValue, shopAddress, shopHours, shopPhone });
    if (!parsed.success) {
      setSettingsError(parsed.error.issues[0]?.message ?? "Vérifiez les paramètres saisis.");
      return;
    }
    setSettingsError("");
    setSavingSettings(true);
    try {
      await withNotice(async () => {
        if (demoMode) {
          updateDemoState((state) => ({
            ...state,
            cities: state.cities.map((city) => ({ ...city, is_seller_city: city.id === parsed.data.sellerCityId })),
            localFee: parsed.data.localDeliveryFee,
            shopAddress: parsed.data.shopAddress,
            shopHours: parsed.data.shopHours,
            shopPhone: parsed.data.shopPhone,
          }));
          return;
        }
        const { error } = await createClient().rpc("update_store_delivery_settings", {
          p_city_id: parsed.data.sellerCityId,
          p_local_delivery_fee: parsed.data.localDeliveryFee,
          p_shop_address: parsed.data.shopAddress,
          p_shop_hours: parsed.data.shopHours,
          p_shop_phone: parsed.data.shopPhone,
        });
        if (error) throw new Error("Paramètres non enregistrés. Vérifiez les valeurs saisies et réessayez.");
      }, "Réglages de la boutique enregistrés.");
    } finally {
      setSavingSettings(false);
    }
  };
  const addCity = async (values: z.infer<typeof citySchema>) => {
    await withNotice(async () => {
      if (demoMode) {
        updateDemoState((state) => ({
          ...state,
          cities: editingCityId
            ? state.cities.map((city) => city.id === editingCityId ? { ...city, name: values.name } : city)
            : [...state.cities, { id: crypto.randomUUID(), name: values.name, is_seller_city: false }],
        }));
        cityForm.reset();
        setEditingCityId("");
        return;
      }
      const supabase = createClient();
      const result = editingCityId
        ? await supabase.from("cities").update({ name: values.name }).eq("id", editingCityId)
        : await supabase.from("cities").insert({ name: values.name, is_seller_city: false });
      if (result.error) throw new Error("Ville non enregistrée. Vérifiez son nom et réessayez.");
      cityForm.reset();
      setEditingCityId("");
    }, editingCityId ? "Ville modifiée." : "Ville ajoutée.");
  };
  const addCompany = async (values: z.output<typeof companySchema>) => {
    await withNotice(async () => {
      if (demoMode) {
        const company: TransportCompany = {
          id: editingCompanyId ?? crypto.randomUUID(),
          ...values,
          active: editingCompanyId ? data.companies.find((item) => item.id === editingCompanyId)?.active ?? true : true,
        };
        updateDemoState((state) => ({
          ...state,
          companies: editingCompanyId
            ? state.companies.map((item) => item.id === editingCompanyId ? company : item)
            : [...state.companies, company],
        }));
        companyForm.reset({ name: "", served_city_ids: [], estimated_price: "", estimated_days: "" });
        setEditingCompanyId("");
        return;
      }
      const supabase = createClient();
      const result = editingCompanyId
        ? await supabase.from("transport_companies").update(values).eq("id", editingCompanyId)
        : await supabase.from("transport_companies").insert({ ...values, active: true });
      if (result.error) throw new Error("Transporteur non enregistré. Vérifiez les informations et réessayez.");
      companyForm.reset({ name: "", served_city_ids: [], estimated_price: "", estimated_days: "" });
      setEditingCompanyId("");
    }, editingCompanyId ? "Transporteur modifié." : "Transporteur ajouté.");
  };
  const toggleCompany = async (company: TransportCompany) => {
    const active = !(company.active ?? true);
    await withNotice(async () => {
      if (demoMode) {
        updateDemoState((state) => ({
          ...state,
          companies: state.companies.map((item) => item.id === company.id ? { ...item, active } : item),
        }));
        return;
      }
      const { error } = await createClient().from("transport_companies").update({ active }).eq("id", company.id);
      if (error) throw new Error("Disponibilité du transporteur non modifiée. Réessayez.");
    }, active ? "Transporteur activé." : "Transporteur masqué.");
  };
  const removeRow = async (table: "cities" | "transport_companies", id: string) => {
    if (table === "cities" && (data.cities.find((city) => city.id === id)?.is_seller_city || id === data.sellerCityId)) {
      setSettingsError("Choisis d'abord une autre ville pour la boutique.");
      return;
    }
    const label = table === "cities"
      ? data.cities.find((city) => city.id === id)?.name
      : data.companies.find((item) => item.id === id)?.name;
    const kind = table === "cities" ? "ville" : "transporteur";
    if (!window.confirm(`Supprimer ${kind} « ${label ?? ""} » ? Cette action est définitive.`)) return;
    await withNotice(async () => {
      if (demoMode) {
        updateDemoState((state) => {
          if (table === "cities") {
            return {
              ...state,
              cities: state.cities.filter((city) => city.id !== id),
              neighborhoods: state.neighborhoods.filter((item) => item.city_id !== id),
              companies: state.companies.map((company) => ({ ...company, served_city_ids: company.served_city_ids.filter((cityId) => cityId !== id) })),
            };
          }
          return { ...state, companies: state.companies.filter((item) => item.id !== id) };
        });
        return;
      }
      const { error } = await createClient().from(table).delete().eq("id", id);
      if (error) throw new Error("Suppression impossible. Vérifiez les dépendances puis réessayez.");
    }, "Élément supprimé.");
  };

  return <div className="admin-management-grid">
    <section className="admin-panel"><div className="panel-heading"><div><p className="eyebrow">LIVRAISON DANS LA VILLE</p><h2>Réglages de la boutique</h2></div></div>
      <p className="field-hint">Ces informations indiquent aux clients où récupérer leur commande et combien coûte une livraison dans la même ville.</p>
      <form className="inline-settings-form" onSubmit={saveSettings}>
        <FormField label="Ville de la boutique"><select className="text-input" value={sellerCityValue} disabled={!data.cities.length || savingSettings} onChange={(event) => { setSellerCityValue(event.target.value); setSettingsError(""); }}><option value="">Choisir une ville</option>{data.cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></FormField>
        <FormField label="Prix de la livraison dans cette ville (FCFA)"><input className="text-input" inputMode="numeric" value={localFeeValue} disabled={savingSettings} onChange={(event) => { setLocalFeeValue(event.target.value); setSettingsError(""); }} /></FormField>
        <FormField label="Adresse de retrait"><input className="text-input" value={shopAddress} disabled={savingSettings} onChange={(event) => { setShopAddress(event.target.value); setSettingsError(""); }} /></FormField>
        <FormField label="Horaires boutique"><input className="text-input" value={shopHours} disabled={savingSettings} onChange={(event) => { setShopHours(event.target.value); setSettingsError(""); }} /></FormField>
        <FormField label="Téléphone de la boutique"><BurkinaPhoneInput id="shop-phone" name="shop_phone" value={shopPhone} disabled={savingSettings} onChange={(value) => { setShopPhone(value); setSettingsError(""); }} /></FormField>
        <div className="delivery-settings-actions"><span>Ces informations seront visibles par vos clients.</span><button className="button button-dark button-small" type="submit" disabled={savingSettings || !data.cities.length}>{savingSettings ? "Enregistrement…" : "Enregistrer les réglages"}</button></div>
      </form>
      {!data.cities.length && <span className="field-error">Ajoutez d&apos;abord une ville pour choisir où se trouve la boutique.</span>}
      {settingsError && <span className="field-error">{settingsError}</span>}
    </section>
    <section className="admin-panel"><div className="panel-heading"><div><p className="eyebrow">ZONES DESSERVIES</p><h2>Villes</h2></div><span>{data.cities.length}</span></div>
      <form className="inline-add-form" onSubmit={cityForm.handleSubmit(addCity)}><input className="text-input" aria-label="Nom de la ville" placeholder={editingCityId ? "Modifier la ville" : "Nom de la ville"} {...cityForm.register("name")} /><div className="editor-actions"><button className="button button-dark button-small">{editingCityId ? "Enregistrer" : "Ajouter"}</button>{editingCityId && <button className="text-button" type="button" onClick={() => { setEditingCityId(""); cityForm.reset(); }}>Annuler</button>}</div></form>
      {cityForm.formState.errors.name && <span className="field-error">{cityForm.formState.errors.name.message}</span>}
      <div className="manage-list">{data.cities.map((city) => <div className="manage-row" key={city.id}><span>{city.name}{city.id === data.sellerCityId && <small className="seller-label">Boutique</small>}</span><div className="manage-actions"><button className="text-button" onClick={() => { setEditingCityId(city.id); cityForm.reset({ name: city.name }); }}>Modifier</button><button className="text-button danger-text" onClick={() => void removeRow("cities", city.id)} aria-label={`Supprimer ${city.name}`}>×</button></div></div>)}</div>
    </section>
    <section className="admin-panel"><div className="panel-heading"><div><p className="eyebrow">LIVRAISON VERS LES AUTRES VILLES</p><h2>Sociétés de transport</h2></div><span>{data.companies.length}</span></div>
    <p className="field-hint">Ajoutez les sociétés que les clients peuvent choisir pour recevoir leur commande dans une autre ville.</p>
    <form className="stacked-add-form" onSubmit={companyForm.handleSubmit(addCompany)}>
      <FormField label="Nom de la société" error={companyForm.formState.errors.name?.message}><input className="text-input" placeholder="Ex. STAF" {...companyForm.register("name")} /></FormField>
      <fieldset className="service-city-fieldset">
        <legend className="field-label">Villes où cette société livre</legend>
        <div className="service-city-options">{data.cities.filter((city) => city.id !== data.sellerCityId).map((city) => <label key={city.id}><input type="checkbox" value={city.id} {...companyForm.register("served_city_ids")} /><span>{city.name}</span></label>)}</div>
        {companyForm.formState.errors.served_city_ids && <span className="field-error">{companyForm.formState.errors.served_city_ids.message}</span>}
      </fieldset>
      <div className="inline-add-form">
        <FormField label="Prix du transport (FCFA)" error={companyForm.formState.errors.estimated_price?.message}><input className="text-input" inputMode="numeric" placeholder="Ex. 2 500" {...companyForm.register("estimated_price")} /></FormField>
        <FormField label="Durée du trajet (jours)" error={companyForm.formState.errors.estimated_days?.message}><input className="text-input" inputMode="numeric" placeholder="Ex. 2" {...companyForm.register("estimated_days")} /></FormField>
      </div>
      <small className="field-hint">Sans prix, le client verra « Prix à confirmer » et le transport ne sera pas ajouté au montant à transférer.</small>
        <div className="editor-actions">
          <button className="button button-dark button-small">{editingCompanyId ? "Enregistrer" : "Ajouter un transporteur"}</button>
          {editingCompanyId && <button className="button button-outline button-small" type="button" onClick={() => { setEditingCompanyId(""); companyForm.reset({ name: "", served_city_ids: [], estimated_price: "", estimated_days: "" }); }}>Annuler</button>}
        </div>
      </form>
      <div className="manage-list">{data.companies.map((company) => {
        const servedCities = company.served_city_ids.map((id) => data.cities.find((city) => city.id === id)?.name).filter(Boolean);
        return <div className="manage-row carrier-manage-row" key={company.id}>
          <span className="manage-row-detail"><strong>{company.name}</strong><small>{servedCities.length ? `Livre à : ${servedCities.join(", ")}` : "Aucune ville choisie"} · {company.estimated_price !== null && company.estimated_price !== undefined ? `Prix : ${company.estimated_price === 0 ? "Gratuit" : formatCfa(company.estimated_price)}` : "Prix à confirmer"}{company.estimated_days ? ` · Environ ${company.estimated_days} jour(s)` : ""}</small><small>{company.active === false ? "Non proposée aux clients" : "Proposée aux clients"}</small></span>
          <div className="manage-actions">
            <button className="text-button" onClick={() => { setEditingCompanyId(company.id); companyForm.reset({ name: company.name, served_city_ids: company.served_city_ids, estimated_price: company.estimated_price?.toString() ?? "", estimated_days: company.estimated_days?.toString() ?? "" }); }}>Modifier</button>
            <button className="text-button" onClick={() => void toggleCompany(company)}>{company.active === false ? "Proposer aux clients" : "Ne plus proposer"}</button>
            <button className="text-button danger-text" onClick={() => void removeRow("transport_companies", company.id)} aria-label={`Supprimer ${company.name}`}>Supprimer</button>
          </div>
        </div>;
      })}</div>
    </section>
  </div>;
}

function PaymentsPanel({ methods, withNotice }: {
  methods: PaymentMethod[];
  withNotice: (action: () => Promise<void>, message: string) => Promise<void>;
}) {
  const { demoMode, updateDemoState } = useStore();
  const [editingId, setEditingId] = useState("");
  const form = useForm<z.input<typeof paymentSchema>, unknown, z.output<typeof paymentSchema>>({ resolver: zodResolver(paymentSchema), defaultValues: { name: "", phone_number: "", instructions: "" } });
  const paymentPhone = useWatch({ control: form.control, name: "phone_number" });
  const addMethod = async (values: z.output<typeof paymentSchema>) => {
    await withNotice(async () => {
      if (demoMode) {
        const nextMethod: PaymentMethod = {
          id: editingId ?? crypto.randomUUID(),
          ...values,
          is_active: editingId ? methods.find((method) => method.id === editingId)?.is_active ?? true : true,
          active: editingId ? methods.find((method) => method.id === editingId)?.is_active ?? true : true,
          display_order: editingId ? methods.find((method) => method.id === editingId)?.display_order ?? methods.length : methods.length,
        };
        updateDemoState((state) => ({
          ...state,
          methods: editingId
            ? state.methods.map((method) => method.id === editingId ? nextMethod : method)
            : [...state.methods, nextMethod],
        }));
        form.reset();
        setEditingId("");
        return;
      }
      const supabase = createClient();
      const result = editingId
        ? await supabase.from("payment_methods").update(values).eq("id", editingId)
        : await supabase.from("payment_methods").insert({ ...values, active: true, display_order: methods.length });
      if (result.error) throw new Error("Moyen de paiement non enregistré. Vérifiez les informations et réessayez.");
      form.reset();
      setEditingId("");
    }, editingId ? "Moyen de paiement modifié." : "Moyen de paiement ajouté.");
  };
  const toggleMethod = async (method: PaymentMethod) => {
    await withNotice(async () => {
      if (demoMode) {
        updateDemoState((state) => ({
          ...state,
          methods: state.methods.map((item) => item.id === method.id ? { ...item, is_active: !method.is_active, active: !method.is_active } : item),
        }));
        return;
      }
      const { error } = await createClient().from("payment_methods").update({ active: !method.is_active }).eq("id", method.id);
      if (error) throw new Error("Moyen de paiement non modifié. Réessayez.");
    }, "Disponibilité modifiée.");
  };
  const removeMethod = async (id: string) => {
    await withNotice(async () => {
      if (demoMode) {
        updateDemoState((state) => ({ ...state, methods: state.methods.filter((item) => item.id !== id) }));
        return;
      }
      const { error } = await createClient().from("payment_methods").delete().eq("id", id);
      if (error) throw new Error("Moyen de paiement non supprimé. Réessayez.");
    }, "Moyen de paiement supprimé.");
  };
  return <div className="admin-management-grid payment-admin-grid">
    <section className="admin-panel"><div className="panel-heading"><div><p className="eyebrow">PAIEMENT MOBILE</p><h2>Moyens de paiement</h2></div></div>
      <form className="payment-admin-form" onSubmit={form.handleSubmit(addMethod)}>
        <h3 className="form-subheading">{editingId ? "Modifier le moyen de paiement" : "Ajouter un service"}</h3>
        <FormField label="Service" error={form.formState.errors.name?.message}><input className="text-input" placeholder="Orange Money, Wave, Moov Money…" {...form.register("name")} /></FormField>
        <FormField label="Numéro de paiement" error={form.formState.errors.phone_number?.message}><BurkinaPhoneInput id="payment-phone" name="phone_number" value={paymentPhone} disabled={form.formState.isSubmitting} onChange={(value) => form.setValue("phone_number", value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })} onBlur={() => form.setValue("phone_number", form.getValues("phone_number").trim(), { shouldTouch: true, shouldValidate: form.formState.isSubmitted })} /></FormField>
        <FormField label="Instructions à afficher au client" error={form.formState.errors.instructions?.message}><textarea className="text-input textarea" rows={3} placeholder="Composez le code USSD, confirmez le montant…" {...form.register("instructions")} /></FormField>
        <div className="editor-actions"><button className="button button-dark button-small">{editingId ? "Enregistrer" : "Ajouter un moyen de paiement"}</button>{editingId && <button className="button button-outline button-small" type="button" onClick={() => { setEditingId(""); form.reset({ name: "", phone_number: "", instructions: "" }); }}>Annuler</button>}</div>
      </form>
    </section>
    <section className="admin-panel"><div className="panel-heading"><div><p className="eyebrow">ACTIVÉS SUR LE SITE</p><h2>Services configurés</h2></div><span>{methods.filter((method) => method.is_active).length}</span></div>
      <div className="payment-manage-list">{methods.length ? methods.map((method) => <article className="payment-manage-card" key={method.id}><div className="payment-manage-top"><strong>{method.name}</strong><span className={`status-badge ${method.is_active ? "status-delivered" : "status-rejected"}`}>{method.is_active ? "Actif" : "Masqué"}</span></div><p className="payment-number">{method.phone_number}</p><p>{method.instructions}</p><div className="payment-admin-actions"><button className="text-button" onClick={() => { setEditingId(method.id); form.reset({ name: method.name, phone_number: method.phone_number, instructions: method.instructions }); }}>Modifier</button><button className="text-button" onClick={() => void toggleMethod(method)}>{method.is_active ? "Masquer" : "Activer"}</button><button className="text-button danger-text" onClick={() => void removeMethod(method.id)}>Supprimer</button></div></article>) : <p className="table-empty">Aucun paiement configuré.</p>}</div>
    </section>
  </div>;
}

function FormField({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return <label className="field-group"><span className="field-label">{label}</span>{children}{error && <span className="field-error">{error}</span>}</label>;
}
