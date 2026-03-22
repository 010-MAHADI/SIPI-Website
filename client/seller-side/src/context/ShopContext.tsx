import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export interface Shop {
  id: string;
  name: string;
  logo: string;
  category: string;
  description: string;
  senderName?: string;
  senderMobileNo?: string;
  senderVillage?: string;
  senderPostOffice?: string;
  senderPostCode?: string;
  senderUpazila?: string;
  senderZilla?: string;
  status: "active" | "inactive";
  createdAt: string;
}

interface ShopContextType {
  shops: Shop[];
  currentShop: Shop | null;
  isLoading: boolean;
  setCurrentShop: (shop: Shop) => void;
  replaceShops: (shops: Shop[]) => void;
  addShop: (shop: Shop) => void;
  updateShop: (id: string, shop: Partial<Shop>) => void;
  deleteShop: (id: string) => void;
  refreshShops: () => Promise<void>;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

const mapShop = (shop: any): Shop => ({
  id: String(shop?.id ?? ""),
  name: shop?.name || "Shop",
  logo: "🏪",
  category: shop?.category || "General",
  description: shop?.description || "",
  senderName: shop?.sender_name || "",
  senderMobileNo: shop?.sender_mobile_no || "",
  senderVillage: shop?.sender_village || "",
  senderPostOffice: shop?.sender_post_office || "",
  senderPostCode: shop?.sender_post_code || "",
  senderUpazila: shop?.sender_upazila || "",
  senderZilla: shop?.sender_zilla || "",
  status: shop?.status === "inactive" ? "inactive" : "active",
  createdAt: shop?.createdDate || new Date().toISOString(),
});

export function ShopProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [currentShop, setCurrentShopState] = useState<Shop | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const currentShopStorageKey = user ? `current_shop_${user.id}` : "";

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setShops([]);
      setCurrentShopState(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const fetchShops = async () => {
      try {
        const response = await api.get("/products/shops/mine/");
        const payload = response.data?.results || response.data;
        const fetchedShops = Array.isArray(payload) ? payload.map(mapShop) : [];

        if (cancelled) {
          return;
        }

        setShops(fetchedShops);
        const savedCurrentRaw = localStorage.getItem(currentShopStorageKey);
        let savedCurrentId: string | null = null;

        if (savedCurrentRaw) {
          try {
            const parsed = JSON.parse(savedCurrentRaw);
            savedCurrentId = parsed?.id ? String(parsed.id) : null;
          } catch {
            savedCurrentId = null;
          }
        }

        if (savedCurrentId) {
          const matched = fetchedShops.find((shop) => shop.id === savedCurrentId);
          setCurrentShopState(matched || fetchedShops[0] || null);
        } else {
          setCurrentShopState(fetchedShops[0] || null);
        }
      } catch {
        if (!cancelled) {
          setShops([]);
          setCurrentShopState(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchShops();

    return () => {
      cancelled = true;
    };
  }, [currentShopStorageKey, isAuthenticated, user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    if (currentShop) {
      localStorage.setItem(currentShopStorageKey, JSON.stringify(currentShop));
    } else {
      localStorage.removeItem(currentShopStorageKey);
    }
  }, [currentShop, currentShopStorageKey, user]);

  useEffect(() => {
    if (currentShop && !shops.some((shop) => shop.id === currentShop.id)) {
      setCurrentShopState(shops[0] || null);
    }
  }, [currentShop, shops]);

  const setCurrentShop = (shop: Shop) => {
    setCurrentShopState(shop);
  };

  const replaceShops = (nextShops: Shop[]) => {
    const normalized = Array.isArray(nextShops) ? nextShops : [];
    setShops(normalized);
    setCurrentShopState((prev) => {
      if (prev && normalized.some((shop) => shop.id === prev.id)) {
        return prev;
      }
      return normalized[0] || null;
    });
  };

  const addShop = (shop: Shop) => {
    setShops((prev) => [...prev, shop]);
    setCurrentShopState((prev) => prev || shop);
  };

  const updateShop = (id: string, updatedShop: Partial<Shop>) => {
    setShops((prev) =>
      prev.map((shop) => (shop.id === id ? { ...shop, ...updatedShop } : shop))
    );
    setCurrentShopState((prev) =>
      prev?.id === id ? { ...prev, ...updatedShop } : prev
    );
  };

  const deleteShop = (id: string) => {
    setShops((prev) => {
      const next = prev.filter((shop) => shop.id !== id);
      setCurrentShopState((current) => {
        if (current?.id === id) return next[0] || null;
        return current;
      });
      return next;
    });
  };

  const refreshShops = async () => {
    try {
      const response = await api.get("/products/shops/mine/");
      const payload = response.data?.results || response.data;
      const fetchedShops = Array.isArray(payload) ? payload.map(mapShop) : [];
      setShops(fetchedShops);
      setCurrentShopState((prev) => {
        if (!prev) return fetchedShops[0] || null;
        const matched = fetchedShops.find((s) => s.id === prev.id);
        return matched || fetchedShops[0] || null;
      });
    } catch {
      // silently ignore refresh errors
    }
  };

  return (
    <ShopContext.Provider
      value={{
        shops,
        currentShop,
        isLoading,
        setCurrentShop,
        replaceShops,
        addShop,
        updateShop,
        deleteShop,
        refreshShops,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  const context = useContext(ShopContext);
  if (context === undefined) {
    throw new Error("useShop must be used within a ShopProvider");
  }
  return context;
}
