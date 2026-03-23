import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Package, Truck, CheckCircle2, MapPin, Box } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useOrders } from "@/context/OrderContext";
import TakaSign from "@/components/TakaSign";

const STEPS = [
  { key: "placed", label: "Order Placed", desc: "Your order has been placed successfully", icon: Box },
  { key: "confirmed", label: "Order Confirmed", desc: "Seller has confirmed your order", icon: CheckCircle2 },
  { key: "shipped", label: "Shipped", desc: "Your order has been shipped", icon: Truck },
  { key: "out", label: "Out for Delivery", desc: "Your package is out for delivery", icon: MapPin },
  { key: "delivered", label: "Delivered", desc: "Package has been delivered", icon: Package },
];

const getActiveStep = (status: string) => {
  switch ((status || "").toLowerCase()) {
    case "processing":
      return 1;
    case "shipped":
      return 2;
    case "delivered":
      return 4;
    default:
      return 0;
  }
};

const TrackOrder = () => {
  const { orderId } = useParams();
  const { orders } = useOrders();
  const order = orders.find((o) => o.order_id === orderId);

  if (!order) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-[1440px] mx-auto px-4 py-20 text-center">
          <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2">Order not found</h2>
          <Link to="/orders" className="text-primary font-medium hover:underline">Back to Orders</Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const activeStep = getActiveStep(order.status);
  const orderDate = new Date(order.created_at);

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader />
      <main className="max-w-[700px] mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 sm:pb-6">
        <Link to={`/order/${order.order_id}`} className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4 hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Order Details
        </Link>

        <div className="bg-card rounded-xl border border-border p-4 sm:p-6 mb-4">
          <h1 className="text-lg sm:text-xl font-bold mb-1">Track Order</h1>
          <p className="text-sm text-muted-foreground">
            Order <span className="font-mono font-bold text-foreground">{order.order_id}</span>
          </p>
          <div className="mt-3 bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-3">
              {order.items[0] && (
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 border border-border">
                  <img
                    src={order.items[0].product_details?.image_url || order.items[0].product_image_url || order.items[0].product_details?.image || "/placeholder.svg"}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-1">
                  {order.items[0]?.product_details?.title || order.items[0]?.product_title}
                  {order.items.length > 1 && <span className="text-muted-foreground"> +{order.items.length - 1} more</span>}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Total: <TakaSign />{parseFloat(order.total_amount || "0").toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
          <h2 className="font-bold mb-6">Shipping Progress</h2>
          <div className="relative">
            {STEPS.map((step, idx) => {
              const isCompleted = idx <= activeStep;
              const isCurrent = idx === activeStep;
              const StepIcon = step.icon;

              const stepDate = new Date(orderDate);
              stepDate.setDate(stepDate.getDate() + idx * 2);

              return (
                <div key={step.key} className="flex gap-4 pb-8 last:pb-0 relative">
                  {idx < STEPS.length - 1 && (
                    <div className={`absolute left-[19px] top-10 w-0.5 h-[calc(100%-28px)] ${
                      idx < activeStep ? "bg-primary" : "bg-border"
                    }`} />
                  )}

                  <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                    isCurrent
                      ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                      : isCompleted
                        ? "bg-primary/10 text-primary border-primary"
                        : "bg-muted text-muted-foreground border-border"
                  }`}>
                    <StepIcon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0 pt-1.5">
                    <p className={`text-sm font-medium ${isCompleted ? "text-foreground" : "text-muted-foreground"}`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                    {isCompleted && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {stepDate.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4 sm:p-5 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-5 h-5 text-primary" />
            <h3 className="font-bold">Delivery Address</h3>
          </div>
          <div className="text-sm text-muted-foreground space-y-0.5">
            <p className="text-foreground font-medium">{order.shipping_full_name}</p>
            <p>{order.shipping_street}, {order.shipping_city}</p>
            <p>{order.shipping_country}</p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default TrackOrder;
