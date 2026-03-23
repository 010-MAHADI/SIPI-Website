import { Link, useLocation } from "react-router-dom";
import { CheckCircle, Package, MapPin, CreditCard } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import TakaSign from "@/components/TakaSign";

const OrderConfirmation = () => {
  const { state } = useLocation();

  if (!state || !state.order) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-[1440px] mx-auto px-4 py-20 text-center">
          <p className="text-muted-foreground mb-4">No order information found.</p>
          <Link to="/" className="text-primary font-medium hover:underline">Go to Homepage</Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const { order } = state;
  const items = order.items || [];

  const paymentLabels: Record<string, string> = {
    cod: "Cash on Delivery",
    cash_on_delivery: "Cash on Delivery",
    bkash: "bKash",
    nagad: "Nagad",
    card: "Credit / Debit Card",
    credit_card: "Credit / Debit Card",
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-[800px] mx-auto px-4 py-10">
        {/* Success */}
        <div className="text-center mb-8">
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Order Placed Successfully!</h1>
          <p className="text-muted-foreground">Thank you for your order. Your order ID is:</p>
          <p className="text-lg font-bold text-primary mt-1">{order.order_id}</p>
        </div>

        {/* Order Details */}
        <div className="space-y-4">
          {/* Items */}
          <div className="border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-primary" />
              <h3 className="font-bold">Order Items</h3>
            </div>
            <div className="space-y-3">
              {items.map((item: any) => (
                <div key={item.id} className="flex gap-3 items-center">
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    <img 
                      src={item.product_details?.image || item.product_image_url || '/placeholder.svg'} 
                      alt={item.product_title} 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-1">{item.product_title}</p>
                    <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                    {item.color && <p className="text-xs text-muted-foreground">Color: {item.color}</p>}
                    {item.size && <p className="text-xs text-muted-foreground">Size: {item.size}</p>}
                  </div>
                  <span className="text-sm font-bold"><TakaSign />{parseFloat(item.total_price).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border mt-3 pt-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span><TakaSign />{parseFloat(order.subtotal).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Shipping</span>
                <span><TakaSign />{parseFloat(order.shipping_cost).toLocaleString()}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-sm text-success">
                  <span>Discount</span>
                  <span>-<TakaSign />{parseFloat(order.discount).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-bold pt-2 border-t">
                <span>Total</span>
                <span className="text-primary"><TakaSign />{parseFloat(order.total_amount).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="border border-border rounded-xl p-5">
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

          {/* Payment */}
          <div className="border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-5 h-5 text-primary" />
              <h3 className="font-bold">Payment</h3>
            </div>
            <p className="text-sm text-muted-foreground">{paymentLabels[order.payment_method] || order.payment_method}</p>
            <p className="text-xs text-muted-foreground mt-1">Status: {order.payment_status}</p>
          </div>

          {/* Estimated delivery */}
          <div className="bg-muted/50 border border-border rounded-xl p-5 text-center">
            <p className="text-sm text-muted-foreground">Estimated Delivery</p>
            <p className="text-lg font-bold text-foreground mt-1">7 - 15 Business Days</p>
          </div>
        </div>

        <div className="flex gap-3 justify-center mt-8">
          <Link to="/" className="bg-primary text-primary-foreground font-bold px-8 py-3 rounded-lg hover:opacity-90">
            Continue Shopping
          </Link>
          <Link to="/orders" className="border-2 border-foreground text-foreground font-bold px-8 py-3 rounded-lg hover:bg-muted">
            View Orders
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default OrderConfirmation;
