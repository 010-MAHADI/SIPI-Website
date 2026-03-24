import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface OrderItemApi {
    id: number;
    product: number | null;
    product_title: string;
    product_image_url?: string | null;
    color?: string | null;
    size?: string | null;
    shipping_type?: string | null;
    quantity: number;
    price: number | string;
}

export interface Order {
    api_id: number;
    id: string;
    customer_name: string;
    customer_email: string;
    shipping_phone?: string;
    shipping_street?: string;
    shipping_city?: string;
    shipping_state?: string;
    shipping_zip_code?: string;
    shipping_country?: string;
    date: string;
    status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
    payment_status: string;
    subtotal?: number;
    shipping_cost?: number;
    discount?: number;
    total: number;
    paymentMethod: string;
    items: OrderItemApi[];
}

const mapStatus = (status: string): Order["status"] => {
    const normalized = (status || "").toLowerCase();
    if (normalized === "completed" || normalized === "delivered") return "delivered";
    if (normalized === "shipped") return "shipped";
    if (normalized === "processing") return "processing";
    if (normalized === "cancelled") return "cancelled";
    return "pending";
};

export const useOrders = (shopId?: string | number) => {
    return useQuery({
        queryKey: ['admin_orders', shopId],
        queryFn: async (): Promise<Order[]> => {
            try {
                const params = shopId ? { shop: shopId } : {};
                console.log('Fetching orders with params:', params);
                
                const response = await api.get('/orders/orders/', { params });
                console.log('Orders API response:', response);
                
                const data = response.data?.results ?? response.data;
                console.log('Raw orders data:', { data, shopId, params });

                if (!Array.isArray(data)) {
                    console.warn('Orders data is not an array:', data);
                    return [];
                }

                const mappedOrders = data.map((order: any) => {
                    console.log('Mapping order:', { 
                        raw_order: order,
                        order_id: order.order_id, 
                        id: order.id, 
                        items_count: order.items?.length,
                        total_amount: order.total_amount 
                    });
                    
                    return {
                        api_id: Number(order.id) || 0,  // This should be the database ID
                        id: String(order.order_id ?? order.id ?? ""),
                        customer_name: order.customer_name || "Guest",
                        customer_email: order.customer_email || "",
                        shipping_phone: order.shipping_phone || "",
                        shipping_street: order.shipping_street || "",
                        shipping_city: order.shipping_city || "",
                        shipping_state: order.shipping_state || "",
                        shipping_zip_code: order.shipping_zip_code || "",
                        shipping_country: order.shipping_country || "",
                        date: new Date(order.created_at).toLocaleDateString(),
                        status: mapStatus(order.status),
                        payment_status: order.payment_status || "pending",
                        subtotal: parseFloat(order.subtotal) || 0,
                        shipping_cost: parseFloat(order.shipping_cost) || 0,
                        discount: parseFloat(order.discount) || 0,
                        total: parseFloat(order.total_amount) || 0,
                        paymentMethod: order.payment_method || "Unknown",
                        items: Array.isArray(order.items) ? order.items : [],
                    };
                });

                console.log('Mapped orders:', mappedOrders.length, mappedOrders);
                return mappedOrders;
            } catch (err: any) {
                console.error("Failed to fetch orders", err);
                if (err.response) {
                    console.error("Error response:", err.response.status, err.response.data);
                }
                return [];
            }
        },
        enabled: true,  // Always enable for sellers
        staleTime: 30000, // 30 seconds
        refetchOnWindowFocus: false,
    });
};

export const useUpdateOrderStatus = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ orderApiId, status }: { orderApiId: number | string; status: string }) => {
            console.log('Updating order status:', { orderApiId, status, type: typeof orderApiId });
            
            // Ensure we're using the correct ID format
            const id = typeof orderApiId === 'string' ? orderApiId : String(orderApiId);
            console.log('Using ID for API call:', id);
            
            // Convert status to lowercase to match backend expectations
            const normalizedStatus = status.toLowerCase();
            console.log('Normalized status:', normalizedStatus);
            
            const response = await api.patch(`/orders/orders/${id}/`, {
                status: normalizedStatus
            });
            console.log('Order status update response:', response.data);
            return response.data;
        },
        onSuccess: (data, variables) => {
            console.log('Order status update successful:', { data, variables });
            // Invalidate and refetch orders
            queryClient.invalidateQueries({ queryKey: ['admin_orders'] });
        },
        onError: (error: any, variables) => {
            console.error('Failed to update order status:', error);
            console.error('Variables used:', variables);
            console.error('Error details:', error.response?.data);
            console.error('Error status:', error.response?.status);
        }
    });
};
