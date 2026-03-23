import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export interface CustomerOrderPreview {
  id: number;
  order_id: string;
  status: string;
  payment_method: string;
  payment_status: string;
  total_amount: number;
  created_at: string;
  items_count: number;
  items_preview: { title: string; quantity: number; price: number }[];
}

export interface CustomerDetail {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  date_joined: string;
  last_login: string | null;
  is_active: boolean;
  status: "Active" | "Blocked";
  admin_note: string;
  last_address: {
    full_name: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    zip_code: string;
    country: string;
  } | null;
  stats: {
    total_orders: number;
    total_spent: number;
    delivered_count: number;
    cancelled_count: number;
    return_refund_count: number;
    avg_order_value: number;
  };
  recent_orders: CustomerOrderPreview[];
}

export const useCustomerDetail = (customerId: number | null) =>
  useQuery({
    queryKey: ["customer_detail", customerId],
    queryFn: async (): Promise<CustomerDetail> => {
      const res = await api.get(`/seller/customers/${customerId}/`);
      return res.data;
    },
    enabled: customerId !== null,
  });
