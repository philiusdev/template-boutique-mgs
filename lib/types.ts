export const HOME_PRODUCT_LIMIT = 48;

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  stock: number;
  category: string;
  category_id: string | null;
  condition: string;
  size: string | null;
  is_active: boolean;
  created_at?: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
};

export type City = {
  id: string;
  name: string;
  is_seller_city: boolean;
};

export type Neighborhood = {
  id: string;
  name: string;
  city_id: string;
};

export type TransportCompany = {
  id: string;
  name: string;
  served_city_ids: string[];
  estimated_price: number | null;
  estimated_days: number | null;
  active?: boolean;
};

export type PaymentMethod = {
  id: string;
  name: string;
  phone_number: string;
  instructions: string;
  is_active: boolean;
  active?: boolean;
  display_order?: number;
};

export type CartItem = {
  product: Product;
  quantity: number;
};

export type OrderStatus =
  | "pending_payment"
  | "pending_verification"
  | "verified"
  | "preparing"
  | "ready_for_pickup"
  | "shipped"
  | "delivered"
  | "rejected"
  | "cancelled";

export type DemoOrder = {
  id: string;
  user_id: string;
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  total: number;
  contact_phone: string | null;
  delivery_type: "store_pickup" | "local_delivery" | "intercity";
  created_at: string;
  profiles: { email: string; phone_number?: string | null } | null;
  cities: { name: string } | null;
  neighborhoods: { name: string } | null;
  transport_companies: { name: string } | null;
  order_items: { id: string; product_id?: string; product_name: string; product_image?: string | null; quantity: number; unit_price: number }[];
  payment_proofs: {
    id: string;
    screenshot_url: string;
    payment_method: string;
    status: "pending" | "verified" | "rejected";
    rejection_reason: string | null;
  }[];
};

export type DemoState = {
  products: Product[];
  categories: Category[];
  cities: City[];
  neighborhoods: Neighborhood[];
  companies: TransportCompany[];
  methods: PaymentMethod[];
  orders: DemoOrder[];
  localFee: number;
  shopAddress: string;
  shopHours: string;
  shopPhone: string;
  profile: { full_name: string; phone_number: string; default_city_id: string; default_neighborhood_id: string };
};

export type DemoSession = {
  id: string;
  email: string;
  role: "client" | "admin";
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "En attente de paiement",
  pending_verification: "En attente de vérification",
  verified: "Paiement vérifié",
  preparing: "En préparation",
  ready_for_pickup: "Prête au retrait",
  shipped: "Expédiée",
  delivered: "Livrée",
  rejected: "Paiement refusé",
  cancelled: "Annulée",
};

export const formatCfa = (amount: number) =>
  new Intl.NumberFormat("fr-FR").format(amount) + " FCFA";

export const demoProducts: Product[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    slug: "veste-denim-vintage",
    name: "Veste en denim vintage",
    description:
      "Une pièce intemporelle en denim épais, sélectionnée avec soin. Coupe droite et très bon état.",
    price: 8500,
    images: [
      "https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=1000&q=80",
    ],
    stock: 1,
    category: "Vestes",
    category_id: null,
    condition: "Très bon état",
    size: "M",
    is_active: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    slug: "chemise-legere-lin",
    name: "Chemise légère en lin",
    description:
      "Chemise douce et respirante, parfaite pour les journées ensoleillées. Une pièce unique.",
    price: 6000,
    images: [
      "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=1000&q=80",
    ],
    stock: 1,
    category: "Chemises",
    category_id: null,
    condition: "Excellent état",
    size: "L",
    is_active: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    slug: "robe-fleurie-ete",
    name: "Robe fleurie d'été",
    description:
      "Une robe fluide aux couleurs douces, agréable à porter et facile à accessoiriser.",
    price: 7500,
    images: [
      "https://images.unsplash.com/photo-1612336307429-8a898d10e223?auto=format&fit=crop&w=1000&q=80",
    ],
    stock: 1,
    category: "Robes",
    category_id: null,
    condition: "Très bon état",
    size: "S",
    is_active: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    slug: "pantalon-chino-beige",
    name: "Pantalon chino beige",
    description:
      "Un essentiel polyvalent à la coupe confortable. Sélectionné en très bon état.",
    price: 6500,
    images: [
      "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=1000&q=80",
    ],
    stock: 1,
    category: "Pantalons",
    category_id: null,
    condition: "Très bon état",
    size: "M",
    is_active: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000005",
    slug: "sac-main-structure",
    name: "Sac à main structuré",
    description:
      "Sac seconde main à la silhouette élégante, en excellent état. Intérieur propre.",
    price: 9500,
    images: [
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80",
    ],
    stock: 1,
    category: "Accessoires",
    category_id: null,
    condition: "Excellent état",
    size: null,
    is_active: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000006",
    slug: "t-shirt-coton-premium",
    name: "T-shirt coton premium",
    description:
      "T-shirt au coton doux et à la coupe décontractée. Un indispensable du quotidien.",
    price: 4000,
    images: [
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1000&q=80",
    ],
    stock: 1,
    category: "T-shirts",
    category_id: null,
    condition: "Très bon état",
    size: "L",
    is_active: true,
  },
];
