import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface Product {
    id: number;
    name: string;
    sku: string;
    category: string;
    price: number;
    stock: number;
    status: "Active" | "Draft" | "Out of Stock";
    image: string | null;
    sold?: number;
    views?: number;
    rating?: number;
    revenue?: number;
    trend?: number;
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://52.221.195.134/api/';
const mediaBaseUrl = import.meta.env.VITE_MEDIA_URL || 'http://52.221.195.134/media';

const normalizeMediaUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/media/')) return `${mediaBaseUrl.replace('/media', '')}${url}`;
    if (url.startsWith('/')) return `${mediaBaseUrl}${url}`;
    return `${mediaBaseUrl}/${url}`;
};

export const useProductsAdmin = (shopId?: string) => {
    return useQuery({
        queryKey: ['admin_products', shopId],
        queryFn: async (): Promise<Product[]> => {
            try {
                // Technically this should be a seller-specific call or admin call depending on role,
                // using the public products endpoint for now and pretending.
                const params = shopId ? { shop: shopId } : {};
                const response = await api.get('/products/', { params });
                
                // Handle paginated response
                const products = response.data.results || response.data;
                
                // Check if products is an array
                if (!Array.isArray(products)) {
                    console.error("API response is not an array:", response.data);
                    return [];
                }
                
                return products.map((p: any) => ({
                    id: p.id,
                    name: p.title || p.name || 'Untitled Product',
                    sku: p.sku || `SKU-${p.id}`,
                    category: p.category || p.shop_category || "Uncategorized",
                    price: parseFloat(p.price) || 0,
                    stock: p.stock || 100, // Mocking stock as it doesn't exist in current models
                    status: p.status || "Active",
                    image: normalizeMediaUrl(p.image_url || p.image),
                    sold: p.sold_count || 0,
                    views: (p.reviews_count || 0) * 5,
                    rating: p.rating || 0,
                    revenue: (parseFloat(p.price) || 0) * (p.sold_count || 0),
                    trend: p.discount || 0
                }));
            } catch (err) {
                console.error("Failed to fetch admin products", err);
                return [];
            }
        },
        enabled: !!shopId,
    });
};
