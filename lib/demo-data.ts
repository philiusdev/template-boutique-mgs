import type { DemoOrder, DemoSession, DemoState, Neighborhood, Product } from "@/lib/types";
import { demoProducts } from "@/lib/types";

const CATEGORIES = [
  { id: "10000000-0000-4000-8000-000000000001", name: "Vestes", slug: "vestes" },
  { id: "10000000-0000-4000-8000-000000000002", name: "Chemises", slug: "chemises" },
  { id: "10000000-0000-4000-8000-000000000003", name: "Robes", slug: "robes" },
  { id: "10000000-0000-4000-8000-000000000004", name: "Pantalons", slug: "pantalons" },
  { id: "10000000-0000-4000-8000-000000000005", name: "Accessoires", slug: "accessoires" },
  { id: "10000000-0000-4000-8000-000000000006", name: "T-shirts", slug: "t-shirts" },
];

const CITIES = [
  { id: "20000000-0000-4000-8000-000000000001", name: "Bobo-Dioulasso", is_seller_city: true },
  { id: "20000000-0000-4000-8000-000000000002", name: "Ouagadougou", is_seller_city: false },
  { id: "20000000-0000-4000-8000-000000000003", name: "Koudougou", is_seller_city: false },
  { id: "20000000-0000-4000-8000-000000000004", name: "Banfora", is_seller_city: false },
  { id: "20000000-0000-4000-8000-000000000005", name: "Ouahigouya", is_seller_city: false },
  { id: "20000000-0000-4000-8000-000000000006", name: "Dédougou", is_seller_city: false },
  { id: "20000000-0000-4000-8000-000000000007", name: "Kaya", is_seller_city: false },
  { id: "20000000-0000-4000-8000-000000000008", name: "Tenkodogo", is_seller_city: false },
  { id: "20000000-0000-4000-8000-000000000009", name: "Fada N'Gourma", is_seller_city: false },
  { id: "20000000-0000-4000-8000-000000000010", name: "Gaoua", is_seller_city: false },
  { id: "20000000-0000-4000-8000-000000000011", name: "Dori", is_seller_city: false },
  { id: "20000000-0000-4000-8000-000000000012", name: "Koupéla", is_seller_city: false },
  { id: "20000000-0000-4000-8000-000000000013", name: "Manga", is_seller_city: false },
  { id: "20000000-0000-4000-8000-000000000014", name: "Ziniaré", is_seller_city: false },
  { id: "20000000-0000-4000-8000-000000000015", name: "Pô", is_seller_city: false },
  { id: "20000000-0000-4000-8000-000000000016", name: "Houndé", is_seller_city: false },
  { id: "20000000-0000-4000-8000-000000000017", name: "Orodara", is_seller_city: false },
  { id: "20000000-0000-4000-8000-000000000018", name: "Boromo", is_seller_city: false },
  { id: "20000000-0000-4000-8000-000000000019", name: "Nouna", is_seller_city: false },
  { id: "20000000-0000-4000-8000-000000000020", name: "Tougan", is_seller_city: false },
  { id: "20000000-0000-4000-8000-000000000021", name: "Kongoussi", is_seller_city: false },
  { id: "20000000-0000-4000-8000-000000000022", name: "Djibo", is_seller_city: false },
  { id: "20000000-0000-4000-8000-000000000023", name: "Réo", is_seller_city: false },
  { id: "20000000-0000-4000-8000-000000000024", name: "Léo", is_seller_city: false },
  { id: "20000000-0000-4000-8000-000000000025", name: "Kombissiri", is_seller_city: false },
  { id: "20000000-0000-4000-8000-000000000026", name: "Pama", is_seller_city: false },
];

function makeNeighborhoods(cityId: string, prefix: number, names: string[]): Neighborhood[] {
  return names.map((name, index) => ({
    id: `21000000-0000-4000-8000-${String(prefix + index).padStart(12, "0")}`,
    name,
    city_id: cityId,
  }));
}

const BOBO_NEIGHBORHOODS = makeNeighborhoods(CITIES[0].id, 1, [
  "Accart-ville", "Belle-Ville", "Bindougousso", "Bolomakoté", "Colsama",
  "Dogona", "Farakan", "Kua", "Kuinima", "Konsa", "Lafiabougou", "Léguéma",
  "Niénéta", "Sarfalao", "Sakaby", "Tounouma", "Yéguéré",
  ...Array.from({ length: 33 }, (_, index) => `Secteur ${index + 1}`),
]);

const OUAGADOUGOU_NEIGHBORHOODS = makeNeighborhoods(CITIES[1].id, 100, [
  "Balkuy", "Bassinko", "Bendogo", "Bissighin", "Bonheur-Ville",
  "Boulmiougou", "Cissin", "Dagnoën", "Dapoya", "Dassasgho",
  "Gounghin", "Karpala", "Katre Yaar", "Kalgondin", "Kilwin",
  "Kossodo", "Koulouba", "Nagrin", "Nioko 1", "Nioko 2", "Nonsin",
  "Ouaga 2000", "Paspanga", "Patte d'Oie", "Pissy", "Rimkièta",
  "Saaba", "Silmiougou", "Somgandé", "Tanghin", "Tampouy",
  "Wayalghin", "Wemtenga", "Zagtouli", "Zogona", "Zone du Bois",
  ...Array.from({ length: 55 }, (_, index) => `Secteur ${index + 1}`),
]);

const DEMO_PROOF = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='700' viewBox='0 0 500 700'%3E%3Crect width='500' height='700' rx='24' fill='%23f3e8df'/%3E%3Ctext x='250' y='250' text-anchor='middle' font-family='sans-serif' font-size='26' fill='%23734c3c'%3ECapture de paiement%3C/text%3E%3Ctext x='250' y='310' text-anchor='middle' font-family='sans-serif' font-size='18' fill='%23734c3c'%3Epreuve fictive - mode demo%3C/text%3E%3C/svg%3E";

function makeDemoOrder(overrides: Partial<DemoOrder> = {}): DemoOrder {
  return {
    id: "30000000-0000-4000-8000-000000000001",
    user_id: "40000000-0000-4000-8000-000000000001",
    status: "pending_verification",
    subtotal: 8500,
    delivery_fee: 0,
    total: 8500,
    contact_phone: null,
    delivery_type: "store_pickup",
    created_at: new Date().toISOString(),
    profiles: { email: "client@atelier-naya.demo" },
    cities: { name: "Bobo-Dioulasso" },
    neighborhoods: { name: "Belle-Ville" },
    transport_companies: null,
    order_items: [{
      id: "50000000-0000-4000-8000-000000000001",
      product_id: demoProducts[0].id,
      product_name: "Veste en denim vintage",
      product_image: demoProducts[0].images[0],
      quantity: 1,
      unit_price: 8500,
    }],
    payment_proofs: [{
      id: "60000000-0000-4000-8000-000000000001",
      screenshot_url: DEMO_PROOF,
      payment_method: "Orange Money",
      status: "pending",
      rejection_reason: null,
    }],
    ...overrides,
  };
}

export function createInitialDemoState(): DemoState {
  const products: Product[] = demoProducts.map((product, index) => ({
    ...product,
    stock: Math.max(3, product.stock),
    category_id: CATEGORIES[index]?.id ?? null,
    created_at: new Date(Date.now() - index * 86_400_000).toISOString(),
  }));
  products[0].stock -= 1;
  return {
    products,
    categories: CATEGORIES,
    cities: CITIES,
    neighborhoods: [
      ...BOBO_NEIGHBORHOODS,
      ...OUAGADOUGOU_NEIGHBORHOODS,
      { id: "21000000-0000-4000-8000-000000000200", name: "Centre-ville", city_id: CITIES[2].id },
      ...CITIES.slice(3).map((city, index) => ({
        id: `21000000-0000-4000-8000-${String(201 + index).padStart(12, "0")}`,
        name: "Centre-ville",
        city_id: city.id,
      })),
    ],
    companies: [
      { id: "22000000-0000-4000-8000-000000000001", name: "STAF", served_city_ids: [CITIES[1].id, CITIES[2].id], estimated_price: 2500, estimated_days: 1, active: true },
      { id: "22000000-0000-4000-8000-000000000002", name: "TSR", served_city_ids: [CITIES[1].id], estimated_price: 3000, estimated_days: 2, active: true },
    ],
    methods: [
      { id: "23000000-0000-4000-8000-000000000001", name: "Orange Money", phone_number: "70 00 00 00", instructions: "Composez *144#, choisissez Transfert, puis envoyez le montant exact.", is_active: true, active: true, display_order: 0 },
      { id: "23000000-0000-4000-8000-000000000002", name: "Wave", phone_number: "76 00 00 00", instructions: "Envoyez le paiement au numéro indiqué et joignez une capture.", is_active: true, active: true, display_order: 1 },
      { id: "23000000-0000-4000-8000-000000000003", name: "Moov Money", phone_number: "60 00 00 00", instructions: "Composez *555#, transférez le montant puis joignez la preuve.", is_active: true, active: true, display_order: 2 },
    ],
    orders: [makeDemoOrder()],
    localFee: 1000,
    shopAddress: "Avenue de la Nation, Bobo-Dioulasso",
    shopHours: "Lun-Sam, 9h-18h",
    shopPhone: "+226 70 00 00 01",
    profile: { full_name: "", phone_number: "", default_city_id: "", default_neighborhood_id: "" },
  };
}

export function makeOrderFromCart(
  order: DemoOrder,
  session: DemoSession,
  state: DemoState,
  input: {
    cityId: string;
    neighborhoodId: string;
    phoneNumber: string;
    deliveryType: DemoOrder["delivery_type"];
    companyId?: string;
    methodId: string;
    items: { productId: string; quantity: number }[];
    proofData?: string;
    rejectionReason?: string;
  },
): DemoOrder {
  const city = state.cities.find((item) => item.id === input.cityId);
  const neighborhood = state.neighborhoods.find((item) => item.id === input.neighborhoodId);
  const company = state.companies.find((item) => item.id === input.companyId);
  const method = state.methods.find((item) => item.id === input.methodId);
  if (!city || !neighborhood || neighborhood.city_id !== city.id || !method?.is_active) {
    throw new Error("Ville, quartier ou moyen de paiement invalide.");
  }
  if (input.deliveryType !== "intercity" && !city.is_seller_city) {
    throw new Error("Le retrait et la livraison locale sont disponibles uniquement dans la ville boutique.");
  }
  if (input.deliveryType === "intercity" && city.is_seller_city) {
    throw new Error("Choisis le retrait en boutique ou la livraison locale dans la ville de la boutique.");
  }
  if (input.deliveryType === "intercity" && (!company?.active || !company.served_city_ids.includes(city.id))) {
    throw new Error("Aucun transporteur actif ne dessert cette ville.");
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("Le panier est vide.");
  }
  const requestedProductIds = new Set<string>();
  const orderItems = input.items.map(({ productId, quantity }) => {
    const product = state.products.find((item) => item.id === productId && item.is_active);
    if (
      !product
      || requestedProductIds.has(productId)
      || !Number.isSafeInteger(quantity)
      || quantity < 1
      || !Number.isSafeInteger(product.stock)
      || product.stock < quantity
    ) {
      throw new Error("Un article n'est plus disponible dans la quantité demandée.");
    }
    requestedProductIds.add(productId);
    return { id: crypto.randomUUID(), product, quantity };
  });
  const subtotal = orderItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const deliveryFee = input.deliveryType === "local_delivery"
    ? state.localFee
    : input.deliveryType === "intercity"
      ? company?.estimated_price ?? 0
      : 0;
  return {
    id: order.id,
    user_id: session.id,
    status: "pending_verification",
    subtotal,
    delivery_fee: deliveryFee,
    total: subtotal + deliveryFee,
    contact_phone: input.phoneNumber,
    delivery_type: input.deliveryType,
    created_at: new Date().toISOString(),
    profiles: { email: session.email, phone_number: input.phoneNumber },
    cities: { name: city.name },
    neighborhoods: { name: neighborhood.name },
    transport_companies: company ? { name: company.name } : null,
    order_items: orderItems.map(({ product, quantity, id }) => ({
      id, product_id: product.id, product_name: product.name, product_image: product.images[0] ?? null, quantity, unit_price: product.price,
    })),
    payment_proofs: [{
      id: crypto.randomUUID(),
      screenshot_url: input.proofData ?? DEMO_PROOF,
      payment_method: method.name,
      status: "pending",
      rejection_reason: null,
    }],
  };
}

export function makeSeedOrder(): DemoOrder {
  const order = makeDemoOrder({ id: crypto.randomUUID() });
  return {
    ...order,
    payment_proofs: order.payment_proofs.map((proof) => ({ ...proof, id: crypto.randomUUID() })),
  };
}
