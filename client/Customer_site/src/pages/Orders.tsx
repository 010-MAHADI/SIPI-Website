import { useState } from "react";
import { Link } from "react-router-dom";
import { Package, Copy, ChevronDown, RotateCcw, XCircle } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useOrders, Order } from "@/context/OrderContext";
import { toast } from "sonner";
import TakaSign from "@/components/TakaSign";

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
] as const;

type TabKey = typeof STATUS_TABS[number]["key"];

const Orders = () => {
  const { orders, loading, cancelOrder } = useOrders();
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [cancellingOrder, setCancellingOrder] = useState<string | null>(null);

  const filteredOrders = orders
    .filter((o) => activeTab === "all" || o.status === activeTab)
    .sort((a, b) => {
      const dA = new Date(a.created_at).getTime();
      const dB = new Date(b.created_at).getTime();
      return sortOrder === "newest" ? dB - dA : dA - dB;
    });

  const getTabCount = (key: TabKey) => {
    if (key === "all") return orders.length;
    return orders.filter((o) => o.status === key).length;
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order? This action cannot be undone.')) {
      return;
    }

    setCancellingOrder(orderId);
    try {
      const success = await cancelOrder(orderId);
      if (success) {
        toast.success('Order cancelled successfully');
      } else {
        toast.error('Failed to cancel order. Please try again.');
      }
    } catch (error) {
      toast.error('Failed to cancel order. Please try again.');
    } finally {
      setCancellingOrder(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <SiteHeader />
        <main className="max-w-[1440px] mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="text-center py-16">
            <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading orders...</p>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader />
      <main className="max-w-[1440px] mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 sm:pb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl sm:text-2xl font-bold">Orders</h1>
          <Link to="/returns" className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
            <RotateCcw className="w-3.5 h-3.5" /> Returns
          </Link>
        </div>

        {/* Status Tabs */}
        <div className="bg-card rounded-t-xl border border-border border-b-0 overflow-x-auto">
          <div className="flex">
            {STATUS_TABS.map((tab) => {
              const count = getTabCount(tab.key);
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative flex-shrink-0 px-4 sm:px-5 py-3 text-sm font-medium transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      {count}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-t" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sort & Filter bar */}
        <div className="bg-card border border-border border-t-0 px-4 py-2.5 flex items-center justify-between rounded-b-xl mb-4">
          <button
            onClick={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {sortOrder === "newest" ? "Newest Order" : "Oldest Order"}
            <ChevronDown className="w-3 h-3" />
          </button>
          <span className="text-xs text-muted-foreground">
            {filteredOrders.length} order{filteredOrders.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border">
            <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-2">
              {activeTab === "all" ? "No orders yet" : `No ${STATUS_TABS.find(t => t.key === activeTab)?.label.toLowerCase()} orders`}
            </h2>
            <p className="text-muted-foreground text-sm mb-6">
              {activeTab === "all" ? "When you place orders, they'll appear here." : "Orders with this status will appear here."}
            </p>
            <Link to="/" className="inline-block bg-primary text-primary-foreground font-bold px-8 py-3 rounded-lg hover:opacity-90 text-sm">
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <OrderCard 
                key={order.id} 
                order={order} 
                onCopyId={handleCopyId}
                onCancelOrder={handleCancelOrder}
                cancellingOrder={cancellingOrder}
              />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

const OrderCard = ({ 
  order, 
  onCopyId, 
  onCancelOrder, 
  cancellingOrder 
}: { 
  order: Order; 
  onCopyId: (id: string) => void;
  onCancelOrder: (orderId: string) => void;
  cancellingOrder: string | null;
}) => {
  const statusColor = {
    pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    processing: "bg-primary/10 text-primary border-primary/20",
    shipped: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    delivered: "bg-green-500/10 text-green-600 border-green-500/20",
    cancelled: "bg-destructive/10 text-destructive border-destructive/20",
    refunded: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  }[order.status] || "bg-muted text-muted-foreground";

  const paymentMethodLabels: Record<string, string> = {
    cod: "COD",
    cash_on_delivery: "COD",
    bkash: "bKash",
    nagad: "Nagad",
    card: "Card",
    credit_card: "Card",
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Order header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Order Number:</span>
          <span className="text-sm font-bold">{order.order_id}</span>
          <button onClick={() => onCopyId(order.order_id)} className="text-muted-foreground hover:text-foreground">
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {order.payment_method && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-primary/30 text-primary uppercase">
              {paymentMethodLabels[order.payment_method] || order.payment_method}
            </span>
          )}
          {order.coupon_code && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-secondary/30 text-secondary">
              {order.coupon_code}
            </span>
          )}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusColor} capitalize`}>
            {order.status}
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="px-4 py-3">
        <div className="bg-muted/50 rounded-lg p-3 space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex gap-3 items-center">
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0 border border-border">
                <img 
                  src={item.product_details?.image || item.product_image_url || '/placeholder.svg'} 
                  alt={item.product_title} 
                  className="w-full h-full object-cover" 
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-1">{item.product_title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">x {item.quantity}</p>
                {item.color && <p className="text-xs text-muted-foreground">Color: {item.color}</p>}
                {item.size && <p className="text-xs text-muted-foreground">Size: {item.size}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Order footer */}
      <div className="px-4 pb-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total Purchase</span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold"><TakaSign />{parseFloat(order.total_amount).toLocaleString()}</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {new Date(order.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
          <span>{order.shipping_city}, {order.shipping_country}</span>
        </div>

        <div className="flex gap-2 pt-1">
          <Link
            to={`/order/${order.order_id}`}
            className="flex-1 text-center text-sm font-medium py-2.5 rounded-lg border-2 border-primary text-primary hover:bg-primary/5 transition-colors"
          >
            View Details
          </Link>
          
          {/* Cancel Order Button - Only show for pending orders */}
          {order.status === "pending" && (
            <button
              onClick={() => onCancelOrder(order.order_id)}
              disabled={cancellingOrder === order.order_id}
              className="flex-1 text-center text-sm font-medium py-2.5 rounded-lg border-2 border-destructive text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
            >
              {cancellingOrder === order.order_id ? (
                <>
                  <div className="w-3 h-3 border border-destructive border-t-transparent rounded-full animate-spin"></div>
                  Cancelling...
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5" />
                  Cancel Order
                </>
              )}
            </button>
          )}
          
          {(order.status === "processing" || order.status === "shipped") && (
            <Link to={`/track-order/${order.order_id}`} className="flex-1 text-center text-sm font-bold py-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
              Track Order
            </Link>
          )}
          {(order.status === "delivered" || order.status === "shipped") && order.items.length === 1 && (
            <Link 
              to={`/write-review/${order.order_id}/${order.items[0].id}`} 
              className="flex-1 text-center text-sm font-bold py-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Write Review
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default Orders;
