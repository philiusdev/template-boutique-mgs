"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { createInitialDemoState } from "@/lib/demo-data";
import { toSavedBurkinaPhoneNumber } from "@/lib/phone";
import { isDemoMode, isSupabaseConfigured } from "@/lib/supabase/config";
import type { CartItem, DemoSession, DemoState, Product } from "@/lib/types";

type StoreContextValue = {
  cart: CartItem[];
  cartCount: number;
  subtotal: number;
  userEmail: string | null;
  userDisplayName: string;
  setUserDisplayName: (name: string) => void;
  role: string | null;
  demoMode: boolean;
  demoReady: boolean;
  demoState: DemoState;
  demoSession: DemoSession | null;
  updateDemoState: (updater: (state: DemoState) => DemoState) => void;
  loginDemo: (email: string, role: "client" | "admin") => void;
  logoutDemo: () => void;
  resetDemo: () => void;
  addToCart: (product: Product, quantity?: number) => void;
  refreshCartProducts: (products: Product[]) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);
const CART_KEY = "atelier-naya-cart";
const EMPTY_CART: CartItem[] = [];
const DEMO_STATE_KEY = "atelier-naya-demo-state-v2";
const DEMO_SESSION_KEY = "atelier-naya-demo-session";
let cartSnapshot: CartItem[] | null = null;
const cartListeners = new Set<() => void>();

function isValidProductSnapshot(value: unknown): value is Product {
  if (!value || typeof value !== "object") return false;
  const product = value as Partial<Product>;
  return typeof product.id === "string"
    && product.id.length > 0
    && typeof product.slug === "string"
    && product.slug.length > 0
    && typeof product.name === "string"
    && typeof product.description === "string"
    && Number.isSafeInteger(product.price)
    && (product.price ?? 0) > 0
    && Array.isArray(product.images)
    && product.images.every((image) => typeof image === "string")
    && Number.isSafeInteger(product.stock)
    && (product.stock ?? -1) >= 0
    && typeof product.category === "string"
    && (typeof product.category_id === "string" || product.category_id === null)
    && typeof product.condition === "string"
    && (typeof product.size === "string" || product.size === null)
    && typeof product.is_active === "boolean";
}

function normalizeCart(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const validItems = value.filter((item): item is CartItem => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Partial<CartItem>;
    if (
      !isValidProductSnapshot(candidate.product)
      || !Number.isSafeInteger(candidate.quantity)
      || (candidate.quantity ?? 0) <= 0
      || seen.has(candidate.product.id)
    ) return false;
    seen.add(candidate.product.id);
    return true;
  });
  return validItems.map(({ product, quantity }) => ({
    quantity,
    product: {
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      price: product.price,
      images: product.images,
      stock: product.stock,
      category: product.category,
      category_id: product.category_id,
      condition: product.condition,
      size: product.size,
      is_active: product.is_active,
      created_at: product.created_at,
    },
  }));
}

function getCartSnapshot() {
  if (typeof window === "undefined") return EMPTY_CART;
  if (cartSnapshot) return cartSnapshot;
  try {
    const saved = localStorage.getItem(CART_KEY);
    if (!saved) {
      cartSnapshot = EMPTY_CART;
      return cartSnapshot;
    }
    const parsed: unknown = JSON.parse(saved);
    cartSnapshot = normalizeCart(parsed);
    if (!Array.isArray(parsed) || JSON.stringify(parsed) !== JSON.stringify(cartSnapshot)) {
      if (cartSnapshot.length) localStorage.setItem(CART_KEY, JSON.stringify(cartSnapshot));
      else localStorage.removeItem(CART_KEY);
    }
  } catch {
    cartSnapshot = EMPTY_CART;
    try {
      localStorage.removeItem(CART_KEY);
    } catch {
      return cartSnapshot;
    }
  }
  return cartSnapshot;
}

function subscribeToCart(listener: () => void) {
  cartListeners.add(listener);
  return () => {
    cartListeners.delete(listener);
  };
}

function saveCart(nextCart: CartItem[]) {
  cartSnapshot = normalizeCart(nextCart);
  try {
    if (cartSnapshot.length) localStorage.setItem(CART_KEY, JSON.stringify(cartSnapshot));
    else localStorage.removeItem(CART_KEY);
  } catch (error) {
    console.error("Impossible d'enregistrer le panier localement :", error);
  }
  cartListeners.forEach((listener) => listener());
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const cart = useSyncExternalStore(subscribeToCart, getCartSnapshot, () => EMPTY_CART);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [demoState, setDemoState] = useState<DemoState>(createInitialDemoState);
  const [demoSession, setDemoSession] = useState<DemoSession | null>(null);
  const [demoReady, setDemoReady] = useState(!isDemoMode);

  useEffect(() => {
    if (!isDemoMode) return;
    queueMicrotask(() => {
      try {
        const savedState = localStorage.getItem(DEMO_STATE_KEY);
        const savedSession = localStorage.getItem(DEMO_SESSION_KEY);
        const initial = createInitialDemoState();
        let profileName = initial.profile.full_name.trim();
        if (savedState) {
          const saved = JSON.parse(savedState) as DemoState;
          profileName = saved.profile?.full_name?.trim() ?? profileName;
          setDemoState({
            ...initial,
            ...saved,
            shopPhone: saved.shopPhone ?? initial.shopPhone,
            profile: {
              ...initial.profile,
              ...saved.profile,
              phone_number: toSavedBurkinaPhoneNumber(saved.profile?.phone_number ?? ""),
            },
          });
        }
        if (savedSession) {
          const session = JSON.parse(savedSession) as DemoSession;
          setDemoSession(session);
          setUserEmail(session.email);
          setRole(session.role);
          setUserDisplayName(profileName);
        }
      } catch (error) {
        console.error("Impossible de charger les données de démonstration :", error);
      } finally {
        setDemoReady(true);
      }
    });
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== CART_KEY) return;
      cartSnapshot = null;
      cartListeners.forEach((listener) => listener());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    let active = true;
    let syncSequence = 0;
    let currentUserId: string | null = null;
    const syncProfile = async (user: { id: string; email?: string } | null) => {
      if (!active) return;
      const sequence = ++syncSequence;
      const nextUserId = user?.id ?? null;
      if (nextUserId !== currentUserId) {
        setRole(null);
        setUserDisplayName("");
      }
      currentUserId = nextUserId;
      setUserEmail(user?.email ?? null);
      if (!user) {
        setRole(null);
        setUserDisplayName("");
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role,full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (profileError) {
        if (active && sequence === syncSequence) setRole("client");
        return;
      }
      if (active && sequence === syncSequence) {
        setRole(profile?.role ?? "client");
        setUserDisplayName(profile?.full_name?.trim() ?? "");
      }
    };
    void supabase.auth.getUser().then(({ data, error }) => {
      if (error) {
        return;
      }
      void syncProfile(data.user);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => void syncProfile(session?.user ?? null));
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const updateDemoState = useCallback((updater: (state: DemoState) => DemoState) => {
    setDemoState((current) => {
      const next = updater(current);
      try {
        localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(next));
      } catch (error) {
        console.error("Impossible d'enregistrer les données de démonstration :", error);
      }
      return next;
    });
  }, []);

  const loginDemo = useCallback((email: string, nextRole: "client" | "admin") => {
    const session: DemoSession = {
      id: nextRole === "admin" ? "40000000-0000-4000-8000-000000000002" : "40000000-0000-4000-8000-000000000001",
      email,
      role: nextRole,
    };
    setDemoSession(session);
    setUserEmail(session.email);
    setRole(session.role);
    setUserDisplayName(demoState.profile.full_name.trim());
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
  }, [demoState.profile.full_name]);

  const logoutDemo = useCallback(() => {
    setDemoSession(null);
    setUserEmail(null);
    setRole(null);
    setUserDisplayName("");
    localStorage.removeItem(DEMO_SESSION_KEY);
  }, []);

  const resetDemo = useCallback(() => {
    const initial = createInitialDemoState();
    setDemoState(initial);
    localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(initial));
    logoutDemo();
    saveCart([]);
  }, [logoutDemo]);

  const addToCart = useCallback((product: Product, quantity = 1) => {
    if (
      !isValidProductSnapshot(product)
      || !Number.isSafeInteger(quantity)
      || quantity <= 0
      || !product.is_active
      || product.stock <= 0
    ) return;
    const items = getCartSnapshot();
    const existing = items.find((item) => item.product.id === product.id);
    if (existing) {
      saveCart(items.map((item) =>
        item.product.id === product.id
          ? { ...item, quantity: Math.min(item.quantity + quantity, product.stock) }
          : item,
      ));
      return;
    }
    saveCart([...items, { product, quantity: Math.min(quantity, product.stock) }]);
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity === 0) {
      saveCart(getCartSnapshot().filter((item) => item.product.id !== productId));
      return;
    }
    if (!Number.isSafeInteger(quantity) || quantity < 0) return;
    saveCart(getCartSnapshot().map((item) =>
        item.product.id === productId
          ? { ...item, quantity: Math.min(quantity, item.product.stock) }
          : item,
    ));
  }, []);

  const refreshCartProducts = useCallback((products: Product[]) => {
    const byId = new Map(products.map((product) => [product.id, product]));
    saveCart(getCartSnapshot().flatMap((item) => {
      const product = byId.get(item.product.id);
      return product && product.is_active && product.stock > 0
        ? [{ ...item, product }]
        : [];
    }));
  }, []);

  const removeFromCart = useCallback(
    (productId: string) => updateQuantity(productId, 0),
    [updateQuantity],
  );
  const clearCart = useCallback(() => saveCart([]), []);
  const currentUserDisplayName = isDemoMode && demoSession
    ? demoState.profile.full_name.trim()
    : userDisplayName;

  const value = useMemo(
    () => ({
      cart,
      cartCount: cart.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: cart.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0,
      ),
      userEmail,
      userDisplayName: currentUserDisplayName,
      setUserDisplayName,
      role,
      demoMode: isDemoMode,
      demoReady,
      demoState,
      demoSession,
      updateDemoState,
      loginDemo,
      logoutDemo,
      resetDemo,
      addToCart,
      refreshCartProducts,
      updateQuantity,
      removeFromCart,
      clearCart,
    }),
    [addToCart, cart, clearCart, currentUserDisplayName, demoReady, demoSession, demoState, loginDemo, logoutDemo, refreshCartProducts, removeFromCart, resetDemo, role, setUserDisplayName, updateDemoState, updateQuantity, userEmail],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore doit être utilisé dans StoreProvider");
  return context;
}
