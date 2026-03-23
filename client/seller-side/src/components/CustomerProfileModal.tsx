import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Clock,
  ShoppingBag,
  TrendingUp,
  RotateCcw,
  XCircle,
  CheckCircle,
  Package,
} from "lucide-react";
import { useCustomerDetail } from "@/hooks/useCustomerDetail";

interface Props {
  customerId: number | null;
  onClose: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  refunded: "bg-purple-100 text-purple-800",
};

function fmt(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function CustomerProfileModal({ customerId, onClose }: Props) {
  const { data: customer, isLoading } = useCustomerDetail(customerId);
  const [note, setNote] = useState("");

  // Sync note when customer loads
  const displayNote = customer ? (note || customer.admin_note || "") : note;

  const fullName =
    customer
      ? [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
        customer.username
      : "";

  return (
    <Dialog open={customerId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-lg font-semibold">Customer Profile</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="p-6 space-y-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-lg" />
            ))}
          </div>
        ) : customer ? (
          <div className="p-6 space-y-6">

            {/* Admin note from previous view */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                Admin Note (visible only to you)
              </p>
              <Textarea
                className="bg-white text-sm resize-none min-h-[72px]"
                placeholder="Add a private note about this customer..."
                value={displayNote}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            {/* Basic info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow icon={<User className="h-4 w-4" />} label="Name" value={fullName} />
              <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={customer.email} />
              <InfoRow
                icon={<User className="h-4 w-4" />}
                label="Username"
                value={`@${customer.username}`}
              />
              <InfoRow
                icon={<Phone className="h-4 w-4" />}
                label="Phone"
                value={customer.phone || "—"}
              />
              <InfoRow
                icon={<Calendar className="h-4 w-4" />}
                label="Account Created"
                value={fmt(customer.date_joined)}
              />
              <InfoRow
                icon={<Clock className="h-4 w-4" />}
                label="Last Login"
                value={customer.last_login ? fmt(customer.last_login) : "Never"}
              />
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground text-sm">Status</span>
                <Badge
                  className={
                    customer.is_active
                      ? "bg-green-100 text-green-800 hover:bg-green-100"
                      : "bg-red-100 text-red-800 hover:bg-red-100"
                  }
                >
                  {customer.status}
                </Badge>
              </div>
            </div>

            {/* Last shipping address */}
            {customer.last_address && (
              <div className="rounded-xl border p-4 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Last Shipping Address
                </p>
                <p className="text-sm font-medium">{customer.last_address.full_name}</p>
                <p className="text-sm text-muted-foreground">
                  {[
                    customer.last_address.street,
                    customer.last_address.city,
                    customer.last_address.state,
                    customer.last_address.zip_code,
                    customer.last_address.country,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {customer.last_address.phone && (
                  <p className="text-sm text-muted-foreground">{customer.last_address.phone}</p>
                )}
              </div>
            )}

            {/* Account stats */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Account Overview
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard
                  icon={<ShoppingBag className="h-4 w-4 text-blue-500" />}
                  label="Total Orders"
                  value={customer.stats.total_orders}
                />
                <StatCard
                  icon={<TrendingUp className="h-4 w-4 text-green-500" />}
                  label="Total Spent"
                  value={`৳${customer.stats.total_spent.toFixed(2)}`}
                />
                <StatCard
                  icon={<TrendingUp className="h-4 w-4 text-purple-500" />}
                  label="Avg Order Value"
                  value={`৳${customer.stats.avg_order_value.toFixed(2)}`}
                />
                <StatCard
                  icon={<CheckCircle className="h-4 w-4 text-green-500" />}
                  label="Delivered"
                  value={customer.stats.delivered_count}
                />
                <StatCard
                  icon={<XCircle className="h-4 w-4 text-red-500" />}
                  label="Cancelled"
                  value={customer.stats.cancelled_count}
                />
                <StatCard
                  icon={<RotateCcw className="h-4 w-4 text-orange-500" />}
                  label="Returns / Refunds"
                  value={customer.stats.return_refund_count}
                />
              </div>
            </div>

            {/* Recent orders */}
            {customer.recent_orders.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Recent Orders
                </p>
                <div className="space-y-2">
                  {customer.recent_orders.map((order) => (
                    <div
                      key={order.id}
                      className="rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="flex items-start gap-3">
                        <Package className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold">{order.order_id}</p>
                          <p className="text-xs text-muted-foreground">
                            {fmt(order.created_at)} · {order.items_count} item
                            {order.items_count !== 1 ? "s" : ""}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {order.items_preview.map((i) => i.title).join(", ")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {order.status}
                        </span>
                        <span className="text-sm font-semibold">
                          ৳{order.total_amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-center text-muted-foreground">Customer not found.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border p-3 flex items-center gap-3">
      <span className="shrink-0">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}
