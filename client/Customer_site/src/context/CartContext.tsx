import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { Product } from "@/hooks/useProducts";
import api from "@/lib/api";
import { useAuth } from "./AuthContext";

export interface CartItem {
  id?: number; // Backend cart item ID
  product: Product;
  quantity: number;
  selected: boolean;
  color?: string;
  size?: string;
  shippingType?: string;
}

export interface BuyNowItem {
  product: Product;
  quantity: number;
  color?: string;
  size?: string;
  shippingType?: string;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, qty?: number, color?: string, size?: string, shippingType?: string) => Promise<void>;
  removeFromCart: (productId: number) => Promise<void>;
  updateQuantity: (itemId: number, qty: number) => Promise<void>;
  toggleSelect: (itemId: number) => Promise<void>;
  selectAll: (selected: boolean) => Promise<void>;
  clearCart: () => Promise<void>;
  totalItems: number;
  totalPrice: number;
  selectedItems: CartItem[];
  selectedTotal: number;
  selectedCount: number;
  buyNowItem: BuyNowItem | null;
  setBuyNowItem: (item: BuyNowItem | null) => void;
  loading: boolean;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | null>(null);

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};

// Helper function to normalize image URLs
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://54.169.101.239/api/';
const backendOrigin = apiBaseUrl.replace(/\/api\/?$/, '');

const normalizeImageUrl = (image: string | null | undefined): string => {
  if (!image) return '/placeholder.svg';
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  if (image.startsWith('/')) return `${backendOrigin}${image}`;
  return `${backendOrigin}/${image}`;
};

const normalizeProduct = (p: any): Product => ({
  id: Number(p?.id ?? 0),
  title: p?.title || "Untitled Product",
  price: Number(p?.originalPrice ?? p?.price ?? 0),       // discounted (main) price
  originalPrice: Number(p?.price ?? 0),                   // regular (crossed-out) price
  discount: Number(p?.discount ?? 0),
  rating: Number(p?.rating ?? 0),
  reviews: Number(p?.reviews_count ?? 0),
  sold: `${Number(p?.sold_count ?? 0)}+`,
  image: normalizeImageUrl(p?.image_url || p?.image),
  image_gallery: Array.isArray(p?.image_gallery) ? p.image_gallery.map(normalizeImageUrl) : [normalizeImageUrl(p?.image_url || p?.image)],
  video_gallery: Array.isArray(p?.video_gallery) ? p.video_gallery.map(normalizeImageUrl) : [],
  badges: Array.isArray(p?.badges) ? p.badges : [],
  freeShipping: Boolean(p?.freeShipping),
  welcomeDeal: Boolean(p?.welcomeDeal),
  store: p?.shop_name || (typeof p?.shop === "object" && p?.shop?.name ? p.shop.name : "Official Store"),
  category: p?.category || p?.shop_category || (typeof p?.shop === "object" && p?.shop?.category ? p.shop.category : "products"),
  description: p?.description || "",
  short_description: p?.short_description || "",
  return_policy: p?.return_policy || "",
  warranty: p?.warranty || "",
  weight: p?.weight ? Number(p.weight) : undefined,
  weight_unit: p?.weight_unit || "kg",
  stock: p?.stock ? Number(p.stock) : undefined,
  meta_title: p?.meta_title || "",
  variants: p?.variants || undefined,
});

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [buyNowItem, setBuyNowItem] = useState<BuyNowItem | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Fetch cart from backend
  const fetchCart = async () => {
    if (!user) {
      setItems([]);
      return;
    }

    try {
      setLoading(true);
      const response = await api.get('/cart/');
      const cartData = response.data;
      
      // Transform backend data to frontend format with normalized product data
      const transformedItems: CartItem[] = cartData.items.map((item: any) => ({
        id: item.id,
        product: normalizeProduct(item.product),
        quantity: item.quantity,
        selected: item.selected,
        color: item.color || undefined,
        size: item.size || undefined,
        shippingType: item.shipping_type || undefined,
      }));
      
      setItems(transformedItems);
    } catch (error) {
      console.error('Failed to fetch cart:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Load cart on mount and when user changes
  useEffect(() => {
    fetchCart();
  }, [user]);

  const addToCart = async (product: Product, qty = 1, color?: string, size?: string, shippingType?: string) => {
    if (!user) {
      alert('Please login to add items to cart');
      return;
    }

    try {
      await api.post('/cart/add/', {
        product_id: product.id,
        quantity: qty,
        color: color || '',
        size: size || '',
        shipping_type: shippingType || '',
      });
      
      await fetchCart(); // Refresh cart
    } catch (error) {
      console.error('Failed to add to cart:', error);
      throw error;
    }
  };

  const removeFromCart = async (itemId: number) => {
    if (!user) return;

    try {
      await api.delete(`/cart/remove_item/?item_id=${itemId}`);
      await fetchCart();
    } catch (error) {
      console.error('Failed to remove from cart:', error);
      throw error;
    }
  };

  const updateQuantity = async (itemId: number, qty: number) => {
    if (!user) return;

    try {
      await api.patch('/cart/update_item/', {
        item_id: itemId,
        quantity: qty,
      });
      await fetchCart();
    } catch (error) {
      console.error('Failed to update quantity:', error);
      throw error;
    }
  };

  const toggleSelect = async (itemId: number) => {
    if (!user) return;

    const item = items.find(i => i.id === itemId);
    if (!item) return;

    try {
      await api.patch('/cart/update_item/', {
        item_id: itemId,
        selected: !item.selected,
      });
      await fetchCart();
    } catch (error) {
      console.error('Failed to toggle select:', error);
      throw error;
    }
  };

  const selectAll = async (selected: boolean) => {
    if (!user) return;

    try {
      await api.post('/cart/select_all/', { selected });
      await fetchCart();
    } catch (error) {
      console.error('Failed to select all:', error);
      throw error;
    }
  };

  const clearCart = async () => {
    if (!user) return;

    try {
      await api.post('/cart/clear/');
      setItems([]);
    } catch (error) {
      console.error('Failed to clear cart:', error);
      throw error;
    }
  };

  const refreshCart = async () => {
    await fetchCart();
  };

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const selectedItems = items.filter((i) => i.selected);
  const selectedTotal = selectedItems.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const selectedCount = selectedItems.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartContext.Provider value={{ 
      items, 
      addToCart, 
      removeFromCart, 
      updateQuantity, 
      toggleSelect, 
      selectAll, 
      clearCart, 
      totalItems, 
      totalPrice, 
      selectedItems, 
      selectedTotal, 
      selectedCount, 
      buyNowItem, 
      setBuyNowItem,
      loading,
      refreshCart
    }}>
      {children}
    </CartContext.Provider>
  );
};
