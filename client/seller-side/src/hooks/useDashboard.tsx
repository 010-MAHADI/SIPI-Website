import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export interface DashboardStats {
    stats: {
        totalRevenue: string;
        totalOrders: number;
        totalCustomers?: number;
        totalSellers?: number;
        activeProducts: number;
    };
    recentOrders: {
        id: number | string;
        customer: string;
        product?: string;
        amount: number | string;
        status: string;
        date: string;
    }[];
}

export const useDashboard = (shopId?: string) => {
    return useQuery({
        queryKey: ['dashboard_stats', shopId],
        queryFn: async (): Promise<DashboardStats> => {
            try {
                const params = shopId ? { shop: shopId } : {};
                console.log('Fetching dashboard stats with params:', params);
                
                const response = await api.get('/users/dashboard/stats/', { params });
                console.log('Dashboard API response:', response);
                
                const payload = response.data || {};

                const recentOrders = Array.isArray(payload.recentOrders)
                    ? payload.recentOrders.map((order: any) => ({
                        id: order.id,
                        customer: order.customer || order.customer__username || "Guest",
                        product: order.product,
                        amount: order.amount ?? order.total_amount ?? 0,
                        status: typeof order.status === "string"
                            ? order.status.charAt(0).toUpperCase() + order.status.slice(1)
                            : "Pending",
                        date: order.date
                            ? new Date(order.date).toLocaleDateString()
                            : order.created_at
                                ? new Date(order.created_at).toLocaleDateString()
                                : "-",
                    }))
                    : [];

                const stats = {
                    totalRevenue: payload?.stats?.totalRevenue ?? "$0.00",
                    totalOrders: payload?.stats?.totalOrders ?? 0,
                    totalCustomers: payload?.stats?.totalCustomers,
                    totalSellers: payload?.stats?.totalSellers,
                    activeProducts: payload?.stats?.activeProducts ?? 0,
                };

                console.log('Dashboard stats:', stats);
                console.log('Recent orders:', recentOrders);

                return {
                    stats,
                    recentOrders,
                };
            } catch (err) {
                console.error("Failed to fetch dashboard stats", err);
                if (err.response) {
                    console.error("Dashboard error response:", err.response.status, err.response.data);
                }
                // Fallback dummy structure if backend fails to ensure UI doesn't crash completely
                return {
                    stats: {
                        totalRevenue: "$0.00",
                        totalOrders: 0,
                        activeProducts: 0
                    },
                    recentOrders: []
                };
            }
        },
        enabled: true,  // Always enable for sellers
    });
};
