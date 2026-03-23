import { useState, useEffect } from "react";
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
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Save,
  Loader2,
  Store,
} from "lucide-react";
import { useCustomerDetail } from "@/hooks/useCustomerDetail";
import api from "@/lib/api";

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

const CUSTOMER_SITE = import.meta.env.VITE_CUSTOMER_URL || "http://52.221.195.134";
const MEDIA_URL = import.meta.env.VITE_MEDIA_URL || "http://52.221.195.134/media";

function fmt(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtDateTime(date: string) {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveImage(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("/media/")) return `${MEDIA_URL.replace(/\/media\/?$/, "")}${url}`;
  return `${MEDIA_URL}/${url.replace(/^\//, "")}`;
}

export default function CustomerProfileModal({ customerId, onClose }: Props) {
  const { data: customer, isLoading, refetch } = useCustomerDetail(customerId);
  const [note, setNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  // Sync note when customer loads
  useEffect(() => {
    if (customer) setNote(customer.admin_note || "");
  }, [customer?.id]);

  const saveNote = async () => {
    if (!customerId) return;
    setNoteSaving(true);
    try {
      await api.patch(`/seller/customers/${customerId}/`, { admin_note: note });
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    } catch (e) {
      console.error("Failed to save note", e);
    } finally {
      setNoteSaving(false);
    }
  };

  const fullName = customer
    ? [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.username
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

            {/* Admin note */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                Admin Note (visible only to you)
              </p>
              <Textarea
                className="bg-white text-sm resize-none min-h-[72px]"
                placeholder="Add a private note about this customer..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex justify-end">
                <button
                  onClick={saveNote}
                  disabled={noteSaving}
                  className="flex items-center gap-1.5 text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 disabled:opacity-60 transition-colors"
                >
                  {noteSaving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : noteSaved ? (
                    <CheckCircle className="h-3 w-3" />
                  ) : (
                    <Save className="h-3 w-3" />
                  )}
                  {noteSaved ? "Saved" : "Update Note"}
                </button>
              </div>
            </div>

            {/* Basic info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow icon={<User className="h-4 w-4" />} label="Name" value={fullName} />
              <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={customer.email} />
              <InfoRow icon={<User className="h-4 w-4" />} label="Username" value={`@${customer.username}`} />
              <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={customer.phone || "—"} />
              <InfoRow icon={<Calendar className="h-4 w-4" />} label="Account Created" value={fmt(customer.date_joined)} />
              <InfoRow
                icon={<Clock className="h-4 w-4" />}
                label="Last Login"
                value={customer.last_login ? fmtDateTime(customer.last_login) : "Never"}
              />
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground text-sm">Status</span>
                <Badge className={customer.is_active ? "bg-green-100 text-green-800 hover:bg-green-100" : "bg-red-100 text-red-800 hover:bg-red-100"}>
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
                  {[customer.last_address.street, customer.last_address.city, customer.last_address.state, customer.last_address.zip_code, customer.last_address.country].filter(Boolean).join(", ")}
                </p>
                {customer.last_address.phone && (
                  <p className="text-sm text-muted-foreground">{customer.last_address.phone}</p>
                )}
              </div>
            )}

            {/* Stats */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Account Overview</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard icon={<ShoppingBag className="h-4 w-4 text-blue-500" />} label="Total Orders" value={customer.stats.total_orders} />
                <StatCard icon={<TrendingUp className="h-4 w-4 text-green-500" />} label="Total Spent" value={`৳${customer.stats.total_spent.toFixed(2)}`} />
                <StatCard icon={<TrendingUp className="h-4 w-4 text-purple-500" />} label="Avg Order Value" value={`৳${customer.stats.avg_order_value.toFixed(2)}`} />
                <StatCard icon={<CheckCircle className="h-4 w-4 text-green-500" />} label="Delivered" value={customer.stats.delivered_count} />
                <StatCard icon={<XCircle className="h-4 w-4 text-red-500" />} label="Cancelled" value={customer.stats.cancelled_count} />
                <StatCard icon={<RotateCcw className="h-4 w-4 text-orange-500" />} label="Returns / Refunds" value={customer.stats.return_refund_count} />
              </div>
            </div>

            {/* Recent orders */}
            {customer.recent_orders.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Recent Orders</p>
                <div className="space-y-2">
                  {customer.recent_orders.map((order) => (
                    <div key={order.id} className="rounded-xl border overflow-hidden">
                      {/* Order header row */}
                      <button
                        className="w-full text-left p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-muted/40 transition-colors"
                        onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                      >
                        <div className="flex items-start gap-3">
                          <Package className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold">{order.order_id}</p>
                            <p className="text-xs text-muted-foreground">
                              {fmt(order.created_at)} · {order.items_count} item{order.items_count !== 1 ? "s" : ""}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {order.items_preview.map((i) => i.title).join(", ")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-700"}`}>
                            {order.status}
                          </span>
                          <span className="text-sm font-semibold">৳{order.total_amount.toFixed(2)}</span>
                          {expandedOrder === order.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </button>

                      {/* Expanded order detail */}
                      {expandedOrder === order.id && (
                        <div className="border-t bg-muted/20 p-4 space-y-4">
                          {/* Items */}
                          <div className="space-y-3">
                            {(order as any).items?.map((item: any) => {
                              const imgSrc = resolveImage(item.image);
                              const productUrl = item.product_id
                                ? item.category_slug && item.product_slug
                                  ? `${CUSTOMER_SITE}/${item.category_slug}/${item.product_slug}`
                                  : `${CUSTOMER_SITE}/product/${item.product_id}`
                                : null;
                              return (
                                <div key={item.id} className="flex items-start gap-3">
                                  {imgSrc ? (
                                    <img src={imgSrc} alt={item.title} className="w-14 h-14 rounded-lg object-cover border flex-shrink-0" />
                                  ) : (
                                    <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                      <Package className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-sm font-medium leading-tight">{item.title}</p>
                                      {productUrl && (
                                        <a href={productUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:opacity-70 flex-shrink-0" title="View on site">
                                          <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                      )}
                                    </div>
                                    {item.shop_name && (
                                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                        <Store className="h-3 w-3" /> {item.shop_name}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                      {item.color && <span className="text-xs bg-muted px-1.5 py-0.5 rounded">Color: {item.color}</span>}
                                      {item.size && <span className="text-xs bg-muted px-1.5 py-0.5 rounded">Size: {item.size}</span>}
                                      <span className="text-xs text-muted-foreground">Qty: {item.quantity}</span>
                                      <span className="text-xs font-medium">৳{item.total.toFixed(2)}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Shipping info */}
                          {(order as any).shipping && (
                            <div className="rounded-lg border bg-card p-3 space-y-1">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> Shipping Info
                              </p>
                              <p className="text-sm font-medium">{(order as any).shipping.full_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {[(order as any).shipping.street, (order as any).shipping.city, (order as any).shipping.state, (order as any).shipping.zip_code, (order as any).shipping.country].filter(Boolean).join(", ")}
                              </p>
                              {(order as any).shipping.phone && (
                                <p className="text-xs text-muted-foreground">{(order as any).shipping.phone}</p>
                              )}
                            </div>
                          )}

                          {/* Order totals */}
                          <div className="rounded-lg border bg-card p-3 space-y-1 text-sm">
                            <div className="flex justify-between text-muted-foreground">
                              <span>Subtotal</span><span>৳{(order as any).subtotal?.toFixed(2) ?? "—"}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                              <span>Shipping</span><span>৳{(order as any).shipping_cost?.toFixed(2) ?? "0.00"}</span>
                            </div>
                            {(order as any).discount > 0 && (
                              <div className="flex justify-between text-green-600">
                                <span>Discount</span><span>-৳{(order as any).discount?.toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                              <span>Total</span><span>৳{order.total_amount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground pt-1">
                              <span>Payment</span>
                              <span className="capitalize">{order.payment_method} · <span className={order.payment_status === 'paid' ? 'text-green-600' : 'text-yellow-600'}>{order.payment_status}</span></span>
                            </div>
                          </div>
                        </div>
                      )}
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

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
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
