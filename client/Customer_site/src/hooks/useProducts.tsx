import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface Product {
    id: number;
    title: string;
    price: number;
    originalPrice: number;
    discount: number;
    rating: number;
    reviews: number;
    sold: string;
    image: string;
    image_gallery: string[];
    video_gallery: string[];
    badges: string[];
    freeShipping: boolean;
    welcomeDeal: boolean;
    store: string;
    category: string;
    category_id?: number;
    category_name?: string;
    description?: string;
    short_description?: string;
    return_policy?: string;
    warranty?: string;
    weight?: number;
    weight_unit?: string;
    stock?: number;
    meta_title?: string;
    variants?: {
        hasSizes?: boolean;
        hasColors?: boolean;
        selectedColors?: string[];
        sizeStocks?: Array<{ size: string; stock: number }>;
        shippingOptions?: Array<any>;
        specifications?: Array<{ key: string; value: string }>;
        guides?: Array<{ name: string; type: string }>;
    };
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://54.169.101.239/api/';
const mediaBaseUrl = import.meta.env.VITE_MEDIA_URL || 'http://54.169.101.239/media';

const normalizeImageUrl = (image: string | null | undefined): string => {
    if (!image) return '/placeholder.svg';
    if (image.startsWith('http://') || image.startsWith('https://')) return image;
    if (image.startsWith('/media/')) return `${mediaBaseUrl.replace('/media', '')}${image}`;
    if (image.startsWith('/')) return `${mediaBaseUrl}${image}`;
    return `${mediaBaseUrl}/${image}`;
};

const normalizeProduct = (p: any): Product => ({
    id: Number(p?.id ?? 0),
    title: p?.title || "Untitled Product",
    // price = regular price, originalPrice = discount price (seller form convention)
    // For display: show discount price as main, regular price as crossed-out
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
    category: p?.category_name || p?.shop_category || (typeof p?.shop === "object" && p?.shop?.category ? p.shop.category : "products"),
    category_id: p?.category ? Number(p.category) : undefined,
    category_name: p?.category_name || undefined,
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

export const useProducts = () => {
    return useQuery({
        queryKey: ['products'],
        queryFn: async (): Promise<Product[]> => {
            const response = await api.get('/products/');
            const data = response.data?.results ?? response.data;
            if (!Array.isArray(data)) return [];
            return data.map(normalizeProduct);
        },
    });
};

export const useProduct = (id: number | string) => {
    return useQuery({
        queryKey: ['product', id],
        queryFn: async (): Promise<Product> => {
            const response = await api.get(`/products/${id}/`);
            return normalizeProduct(response.data);
        },
        enabled: !!id,
    });
};

export const useProductByPath = (category: string, slug: string) => {
    return useQuery({
        queryKey: ['product-by-path', category, slug],
        queryFn: async (): Promise<Product> => {
            const response = await api.get('/products/resolve/', {
                params: { category, slug },
            });
            return normalizeProduct(response.data);
        },
        enabled: !!category && !!slug,
    });
};
