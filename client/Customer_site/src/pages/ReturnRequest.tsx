import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, RotateCcw, Check, AlertCircle } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useOrders } from "@/context/OrderContext";
import { useSubmitReturn, useReturns } from "@/hooks/useReturns";
import { toast } from "@/hooks/use-toast";
import TakaSign from "@/components/TakaSign";

const RETURN_REASONS = [
  "Defective / Damaged product",
  "Wrong item received",
  "Item not as described",
  "Size doesn't fit",
  "Changed my mind",
  "Quality not satisfactory",
  "Other",
];

const ReturnRequest = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { orders } = useOrders();
  const submitReturn = useSubmitReturn();
  const { data: existingReturns } = useReturns();
  const order = orders.find((o) => o.order_id === orderId);

  const [selectedItems, setSelectedItems] = useState<Record<number, number>>({});
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");

  // Calculate available quantities for each item
  const itemAvailability = useMemo(() => {
    if (!order || !existingReturns) return {};
    
    const availability: Record<number, { available: number; returned: number; total: number }> = {};
    
    // Get all return items for this order (excluding rejected)
    const orderReturns = existingReturns.filter(
      r => r.order_id === order.order_id && r.status !== 'rejected'
    );
    
    order.items.forEach(item => {
      const totalReturned = orderReturns.reduce((sum, returnReq) => {
        const returnItem = returnReq.items.find(ri => ri.order_item === item.id);
        return sum + (returnItem?.quantity || 0);
      }, 0);
      
      availability[item.id] = {
        total: item.quantity,
        returned: totalReturned,
        available: item.quantity - totalReturned
      };
    });
    
    return availability;
  }, [order, existingReturns]);

  if (!order || order.status !== "delivered") {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-[900px] mx-auto px-4 py-20 text-center">
          <RotateCcw className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2">Can't process return</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Only delivered orders are eligible for returns.
          </p>
          <Link to="/orders" className="text-primary font-medium hover:underline">Back to Orders</Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const toggleItem = (itemId: number, maxQty: number) => {
    setSelectedItems((prev) => {
      if (prev[itemId]) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: maxQty };
    });
  };

  const updateQty = (itemId: number, qty: number) => {
    setSelectedItems((prev) => ({ ...prev, [itemId]: qty }));
  };

  const handleSubmit = async () => {
    if (Object.keys(selectedItems).length === 0) {
      toast({ title: "Select items", description: "Please select at least one item to return.", variant: "destructive" });
      return;
    }
    if (!reason) {
      toast({ title: "Select reason", description: "Please select a return reason.", variant: "destructive" });
      return;
    }

    try {
      await submitReturn.mutateAsync({
        order_id: order.order_id,
        reason,
        description: description.trim(),
        items: Object.entries(selectedItems).map(([id, qty]) => ({
          order_item_id: Number(id),
          quantity: qty,
        })),
      });
      toast({ title: "Return submitted", description: "Your return request has been submitted successfully." });
      navigate("/returns");
    } catch {
      toast({ title: "Failed to submit", description: "Something went wrong. Please try again.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteHeader />
      <main className="max-w-[700px] mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 sm:pb-6">
        <Link to={`/order/${orderId}`} className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4 hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Order
        </Link>

        <div className="bg-card rounded-xl border border-border p-4 sm:p-6 mb-4">
          <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-primary" /> Request Return
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Order #{order.order_id}</p>
        </div>

        {/* Select items */}
        <div className="bg-card rounded-xl border border-border p-4 sm:p-5 mb-4">
          <h3 className="font-bold mb-3">Select items to return</h3>
          
          {/* Warning for pending returns */}
          {existingReturns && existingReturns.some(r => r.order_id === order.order_id && r.status === 'pending') && (
            <div className="mb-3 p-3 bg-warning/10 border border-warning/30 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
              <div className="text-xs">
                <p className="font-medium text-warning">Pending Return Request</p>
                <p className="text-muted-foreground mt-0.5">
                  You have a pending return request for this order. Items already requested for return cannot be selected again.
                </p>
              </div>
            </div>
          )}
          
          <div className="space-y-3">
            {order.items.map((item) => {
              const availability = itemAvailability[item.id];
              const isFullyReturned = availability && availability.available === 0;
              const isSelected = !!selectedItems[item.id];
              const maxAvailable = availability?.available || item.quantity;
              
              return (
                <div
                  key={item.id}
                  onClick={() => !isFullyReturned && toggleItem(item.id, maxAvailable)}
                  className={`flex gap-3 items-center p-3 rounded-lg border-2 transition-all ${
                    isFullyReturned 
                      ? "border-muted bg-muted/30 opacity-60 cursor-not-allowed" 
                      : isSelected 
                        ? "border-primary bg-primary/5 cursor-pointer" 
                        : "border-border hover:border-muted-foreground cursor-pointer"
                  }`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    isFullyReturned
                      ? "border-muted bg-muted"
                      : isSelected 
                        ? "border-primary bg-primary text-primary-foreground" 
                        : "border-border"
                  }`}>
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 border border-border">
                    <img
                      src={item.product_details?.image_url || item.product_image_url || "/placeholder.svg"}
                      alt={item.product_title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-1">{item.product_title}</p>
                    <p className="text-xs text-muted-foreground">
                      {isFullyReturned ? (
                        <span className="text-destructive font-medium">Already returned</span>
                      ) : availability && availability.returned > 0 ? (
                        <>Qty: {maxAvailable} available ({availability.returned} returned) · <TakaSign />{parseFloat(item.price).toLocaleString()}</>
                      ) : (
                        <>Qty: {item.quantity} · <TakaSign />{parseFloat(item.price).toLocaleString()}</>
                      )}
                    </p>
                  </div>
                  {isSelected && maxAvailable > 1 && (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={selectedItems[item.id]}
                        onChange={(e) => updateQty(item.id, Number(e.target.value))}
                        className="text-xs border border-border rounded px-2 py-1 bg-background"
                      >
                        {Array.from({ length: maxAvailable }, (_, i) => i + 1).map((q) => (
                          <option key={q} value={q}>{q}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Reason */}
        <div className="bg-card rounded-xl border border-border p-4 sm:p-5 mb-4">
          <h3 className="font-bold mb-3">Reason for return</h3>
          <div className="space-y-2">
            {RETURN_REASONS.map((r) => (
              <label
                key={r}
                onClick={() => setReason(r)}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  reason === r ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
                }`}
              >
                <input
                  type="radio"
                  name="return-reason"
                  value={r}
                  checked={reason === r}
                  onChange={(e) => setReason(e.target.value)}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  reason === r ? "border-primary" : "border-border"
                }`}>
                  {reason === r && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <span className="text-sm">{r}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="bg-card rounded-xl border border-border p-4 sm:p-5 mb-4">
          <h3 className="font-bold mb-3">Additional details (optional)</h3>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue in more detail..."
            maxLength={500}
            className="w-full border border-border rounded-lg p-3 text-sm bg-background resize-none h-24 focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground mt-1 text-right">{description.length}/500</p>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitReturn.isPending}
          className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {submitReturn.isPending ? "Submitting..." : "Submit Return Request"}
        </button>
      </main>
      <SiteFooter />
    </div>
  );
};

export default ReturnRequest;
