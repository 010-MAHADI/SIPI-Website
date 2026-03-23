import { Link, useParams } from "react-router-dom";
import { Package, MapPin, CreditCard, Copy, ArrowLeft, Truck, Tag, RotateCcw, Star, XCircle } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useOrders } from "@/context/OrderContext";
import { generateProductUrl } from "@/lib/slugify";
import { toast } from "sonner";
import { useState } from "react";
import TakaSign from "@/components/TakaSign";

const paymentLabels: Record<string, string> = {
  cod: "Cash on Delivery",
  cash_on_delivery: "Cash on Delivery",
  bkash: "bKash",
  nagad: "Nagad",
  card: "Credit / Debit Card",
  credit_card: "Credit / Debit Card",
};

const statusColorMap: Record<string, string> = {
  pending: "text-amber-600",
  processing: "text-primary",
  shipped: "text-secondary",
  delivered: "text-[hsl(142,71%,45%)]",
  cancelled: "text-destructive",
};

const OrderDetail = () => {
  const { orderId } = useParams();
  const { orders, cancelOrder } = useOrders();
  const [cancelling, setCancelling] = useState(false);
  const order = orders.find((o) => o.order_id === orderId);

  if (!order) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-[1440px] mx-auto px-4 py-20 text-center">
          <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2">Order not found</h2>
          <p className="text-muted-foreground text-sm mb-6">We couldn't find this order.</p>
          <Link to="/orders" className="text-primary font-medium hover:underline">Back to Orders</Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const handleCopy = () => navigator.clipboard.writeText(order.order_id);
  const canTrack = order.status === "processing" || order.status === "shipped";
  const statusColor = statusColorMap[order.status] || "text-muted-foreground";

  const handleCancelOrder = async () => {
    if (!confirm('Are you sure you want to cancel this order? This action cannot be undone.')) {
      return;
    }

    setCancelling(true);
    try {
      const success = await cancelOrder(order.order_id);
      if (success) {
        toast.success('Order cancelled successfully');
      } else {
        toast.error('Failed to cancel order. Please try again.');
      }
    } catch (error) {
      toast.error('Failed to cancel order. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  const subtotal = parseFloat(order.subtotal || "0");
  const shipping = parseFloat(order.shipping_cost || "0");
  const discount = parseFloat(order.discount || "0");
  const total = parseFloat(order.total_amount || "0");

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader />
      <main className="max-w-[900px] mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 sm:pb-6">
        <Link to="/orders" className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4 hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Orders
        </Link>

        <div className="bg-card rounded-xl border border-border p-4 sm:p-6 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold">Order Details</h1>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${statusColor} bg-current/10 capitalize`}>
                  {order.status}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">Order ID:</span>
                <span className="text-sm font-mono font-bold">{order.order_id}</span>
                <button onClick={handleCopy} className="text-muted-foreground hover:text-foreground">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Placed on {new Date(order.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <div className="flex gap-2">
              {/* Cancel Order Button - Only show for pending orders */}
              {order.status === "pending" && (
                <button
                  onClick={handleCancelOrder}
                  disabled={cancelling}
                  className="text-center text-sm font-bold py-2.5 px-6 rounded-lg border-2 border-destructive text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {cancelling ? (
                    <>
                      <div className="w-4 h-4 border border-destructive border-t-transparent rounded-full animate-spin"></div>
                      Cancelling...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      Cancel Order
                    </>
                  )}
                </button>
              )}
              
              {canTrack && (
                <Link
                  to={`/track-order/${order.order_id}`}
                  className="text-center text-sm font-bold py-2.5 px-6 rounded-lg bg-primary text-primary-foreground hover:opacity-90"
                >
                  <Truck className="w-4 h-4 inline mr-1.5" />Track Order
                </Link>
              )}
              {(order.status === "delivered" || order.status === "shipped") && (
                <Link
                  to={`/return-request/${order.order_id}`}
                  className="text-center text-sm font-bold py-2.5 px-6 rounded-lg border-2 border-primary text-primary hover:bg-primary/5 transition-colors"
                >
                  <RotateCcw className="w-4 h-4 inline mr-1.5" />Request Return
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-[1fr_300px] gap-4">
          <div className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-5 h-5 text-primary" />
                <h3 className="font-bold">Items ({order.items.length})</h3>
              </div>
              <div className="space-y-3">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex gap-3 items-center p-3 bg-muted/40 rounded-lg">
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0 border border-border">
                      <img
                        src={item.product_details?.image_url || item.product_image_url || item.product_details?.image || "/placeholder.svg"}
                        alt={item.product_title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        to={item.product_details ? generateProductUrl(item.product_details) : `/product/${item.product}`}
                        className="text-sm font-medium line-clamp-1 hover:text-primary"
                      >
                        {item.product_details?.title || item.product_title}
                      </Link>
                      <div className="flex gap-2 mt-0.5">
                        {item.color && <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">{item.color}</span>}
                        {item.size && <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">{item.size}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">Qty: {item.quantity}</p>
                      {(order.status === "delivered" || order.status === "shipped") && (
                        <Link
                          to={`/write-review/${order.order_id}/${item.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline mt-2 cursor-pointer"
                        >
                          <Star className="w-3 h-3" />
                          Write Review
                        </Link>
                      )}
                    </div>
                    <span className="text-sm font-bold whitespace-nowrap"><TakaSign />{(parseFloat(item.price || "0") * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-5 h-5 text-primary" />
                <h3 className="font-bold">Shipping Address</h3>
              </div>
              <div className="text-sm text-muted-foreground space-y-0.5">
                <p className="text-foreground font-medium">{order.shipping_full_name}</p>
                <p>{order.shipping_phone}</p>
                <p>{order.shipping_street}</p>
                <p>{order.shipping_city}{order.shipping_state ? `, ${order.shipping_state}` : ""} {order.shipping_zip_code}</p>
                <p>{order.shipping_country}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
              <h3 className="font-bold mb-3">Order Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span><TakaSign />{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className={shipping === 0 ? "text-[hsl(142,71%,45%)]" : ""}>
                    {shipping === 0 ? "Free" : <><TakaSign />{shipping.toLocaleString()}</>}
                  </span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-[hsl(142,71%,45%)]">
                    <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{order.coupon_code || "Discount"}</span>
                    <span>-<TakaSign />{discount.toLocaleString()}</span>
                  </div>
                )}
                <div className="border-t border-border pt-2 flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span className="text-primary"><TakaSign />{total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-5 h-5 text-primary" />
                <h3 className="font-bold">Payment</h3>
              </div>
              <p className="text-sm text-muted-foreground">{paymentLabels[order.payment_method] || order.payment_method}</p>
              <p className="text-xs text-muted-foreground mt-1 capitalize">Status: {order.payment_status}</p>
            </div>

            <div className="bg-muted/50 border border-border rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground">Estimated Delivery</p>
              <p className="text-sm font-bold mt-1">7 - 15 Business Days</p>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default OrderDetail;
