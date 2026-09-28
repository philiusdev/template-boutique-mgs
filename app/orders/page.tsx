import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PaymentProofRecovery } from "@/components/payment-proof-recovery";
import { OrderUpdates } from "@/components/order-updates";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { formatCfa, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/types";
import { DemoOrdersPage } from "@/components/demo-pages";
import { toBurkinaPhoneHref, toSavedBurkinaPhoneNumber } from "@/lib/phone";

type OrderRecord = {
  id: string;
  status: OrderStatus;
  total: number;
  subtotal: number;
  delivery_fee: number;
  delivery_type: string;
  contact_phone: string | null;
  created_at: string;
  cities: { name: string } | null;
  neighborhoods: { name: string } | null;
  transport_companies: { name: string } | null;
  order_items: { id: string; product_name: string; product_image: string | null; quantity: number; unit_price: number }[];
  payment_proofs: { screenshot_url: string; payment_method: string; status: string; rejection_reason: string | null }[] | null;
};

export default async function OrdersPage() {
  if (!isSupabaseConfigured) return <DemoOrdersPage />;
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error("Impossible de vérifier la session client :", authError);
    throw new Error("Impossible de vérifier la session. Réessayez dans quelques instants.");
  }
  if (!auth.user) redirect("/connexion?next=/mes-commandes");

  const [{ data, error }, { data: shopPhoneSetting, error: settingsError }] = await Promise.all([
    supabase
      .from("orders")
      .select("id,status,total,subtotal,delivery_fee,delivery_type,contact_phone,created_at,cities(name),neighborhoods(name),transport_companies(name),order_items(id,product_name_snapshot,product_image_snapshot,quantity,unit_price_snapshot),payment_proofs(screenshot_url,payment_method,status,rejection_reason)")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false }),
    supabase.from("settings").select("value").eq("key", "shop_phone").maybeSingle(),
  ]);
  if (error) {
    console.error("Impossible de charger les commandes du client :", error);
    throw new Error("Impossible de charger vos commandes pour le moment. Réessayez dans quelques instants.");
  }
  if (settingsError) {
    console.error("Impossible de charger le numéro de contact de la boutique :", settingsError);
    throw new Error("Impossible de charger les informations de contact pour le moment.");
  }
  const orders = (data ?? []).map((row) => {
    const item = row as unknown as {
      id: string; status: OrderStatus; total: number; subtotal: number; delivery_fee: number;
      delivery_type: string; contact_phone: string | null; created_at: string; cities: { name: string } | null;
      neighborhoods: { name: string } | null; transport_companies: { name: string } | null;
      order_items: { id: string; product_name_snapshot: string; product_image_snapshot: string | null; quantity: number; unit_price_snapshot: number }[];
      payment_proofs: OrderRecord["payment_proofs"];
    };
    return {
      ...item,
      total: Number(item.total),
      contact_phone: toSavedBurkinaPhoneNumber(item.contact_phone) || null,
      order_items: item.order_items.map((orderItem) => ({
        id: orderItem.id,
        product_name: orderItem.product_name_snapshot,
        product_image: orderItem.product_image_snapshot,
        quantity: orderItem.quantity,
        unit_price: Number(orderItem.unit_price_snapshot),
      })),
      payment_proofs: item.payment_proofs,
    } as OrderRecord;
  });
  const shopPhone = toSavedBurkinaPhoneNumber(
    (shopPhoneSetting?.value as { text?: string } | null)?.text,
  );

  return (
    <main className="page-wrap orders-page">
      <p className="eyebrow">VOTRE ESPACE</p>
      <h1>Mes commandes</h1>
      <p className="orders-welcome">Connectée en tant que <strong>{auth.user.email}</strong></p>
      <OrderUpdates userId={auth.user.id} />
      {orders.length ? (
        <div className="orders-list">
          {orders.map((order) => (
            <article className="order-card" key={order.id}>
              <div className="order-card-head">
                <div><span className="order-reference">Commande #{order.id.slice(0, 8).toUpperCase()}</span><small>{new Date(order.created_at).toLocaleDateString("fr-FR", { dateStyle: "long" })}</small></div>
                <span className={`status-badge status-${order.status}`}>{ORDER_STATUS_LABELS[order.status] ?? order.status}</span>
              </div>
              <div className="order-card-content">
                <div className="order-lines">{order.order_items.map((item) => (
                  <div className="order-line" key={item.id}><span className="order-item-copy">{item.product_image && <Image src={item.product_image} alt="" width={48} height={58} unoptimized={item.product_image.startsWith("data:")} />}<span>{item.product_name} <small>× {item.quantity}</small></span></span><strong>{formatCfa(item.unit_price * item.quantity)}</strong></div>
                ))}</div>
                <div className="order-meta">
                  <div><span>Livraison à</span><strong>{order.neighborhoods?.name}, {order.cities?.name}</strong></div>
                  <div><span>Mode</span><strong>{order.delivery_type === "store_pickup" ? "Retrait en boutique" : order.delivery_type === "local_delivery" ? "Livraison locale" : order.transport_companies?.name ?? "Transport interurbain"}</strong></div>
                  {order.payment_proofs?.[0] && <div><span>Paiement</span><strong>{order.payment_proofs[0].payment_method}</strong></div>}
                </div>
                {(order.contact_phone || shopPhone) && <div className="order-contact-section">
                  <small>NOUS CONTACTER EN CAS DE BESOIN</small>
                  <div className="order-contact-numbers">
                    {order.contact_phone && <div><span>Numéro laissé pour cette commande</span><a href={toBurkinaPhoneHref(order.contact_phone)}>{order.contact_phone}</a></div>}
                    {shopPhone && <div><span>Appeler la boutique</span><a href={toBurkinaPhoneHref(shopPhone)}>{shopPhone}</a></div>}
                  </div>
                </div>}
              </div>
              <div className="order-card-foot">
                <span>Total de la commande</span><strong>{formatCfa(order.total)}</strong>
              </div>
              {order.payment_proofs?.[0]?.screenshot_url && (
                <PaymentProof path={order.payment_proofs[0].screenshot_url} />
              )}
              {order.payment_proofs?.[0]?.status === "rejected" && order.payment_proofs[0].rejection_reason && (
                <p className="form-message error">Preuve refusée : {order.payment_proofs[0].rejection_reason}</p>
              )}
              {order.status === "pending_payment" && !order.payment_proofs?.length && (
                <PaymentProofRecovery orderId={order.id} userId={auth.user.id} />
              )}
              {order.status === "rejected" && order.payment_proofs?.length ? (
                <PaymentProofRecovery orderId={order.id} userId={auth.user.id} wasRejected />
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-catalog orders-empty"><span>♡</span><h2>Pas encore de commande</h2><p>Votre prochaine belle trouvaille vous attend.</p><Link className="button button-dark" href="/#collection">Découvrir la collection <span>→</span></Link></div>
      )}
    </main>
  );
}

async function PaymentProof({ path }: { path: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 300);
  if (error) {
    return <p className="form-message error">La capture de paiement ne peut pas être affichée pour le moment.</p>;
  }
  return <a className="proof-link" href={data.signedUrl} target="_blank" rel="noreferrer"><Image src={data.signedUrl} alt="Capture de paiement envoyée" width={88} height={88} />Voir ma preuve de paiement ↗</a>;
}
