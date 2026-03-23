import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useCart } from "@/context/CartContext";
import { Checkbox } from "@/components/ui/checkbox";
import { generateProductUrl } from "@/lib/slugify";
import TakaSign from "@/components/TakaSign";

const Cart = () => {
  const { items, updateQuantity, removeFromCart, toggleSelect, selectAll, selectedTotal, selectedCount, loading, selectedItems } = useCart();
  const navigate = useNavigate();

  const allSelected = items.length > 0 && items.every((i) => i.selected);

  // Calculate shipping costs from selected products
  const calculateShipping = () => {
    let totalShipping = 0;
    const shippingDetails: Array<{ method: string; cost: number; time: string }> = [];

    selectedItems.forEach((item) => {
      const product = item.product;
      
      // Check if product has free shipping
      if (product.freeShipping) {
        if (shippingDetails.length === 0 || !shippingDetails.some(s => s.cost === 0)) {
          shippingDetails.push({ method: 'Free Shipping', cost: 0, time: '7-15 business days' });
        }
        return;
      }

      // Get shipping options from product variants
      const shippingOptions = product.variants?.shippingOptions || [];
      
      if (shippingOptions.length > 0) {
        // Try to find the shipping option that was selected by the user
        let selectedOption = null;
        
        // Check if item has a selected shipping type
        if (item.shippingType) {
          selectedOption = shippingOptions.find((opt: any) => 
            opt.enabled && opt.type.toLowerCase() === item.shippingType.toLowerCase()
          );
        }
        
        // If no selected option or not found, use first enabled option
        if (!selectedOption) {
          selectedOption = shippingOptions.find((opt: any) => opt.enabled);
        }
        
        if (selectedOption) {
          const cost = parseFloat(selectedOption.price) || 0;
          totalShipping += cost * item.quantity;
          
          const existingMethod = shippingDetails.find(s => s.method === selectedOption.type);
          if (!existingMethod) {
            shippingDetails.push({
              method: selectedOption.type,
              cost: cost,
              time: `${selectedOption.estimatedDelivery || '7-15'} business days`
            });
          }
        } else {
          // No enabled option, assume free
          if (shippingDetails.length === 0 || !shippingDetails.some(s => s.cost === 0)) {
            shippingDetails.push({ method: 'Standard Shipping', cost: 0, time: '7-15 business days' });
          }
        }
      } else {
        // No shipping options defined, assume free
        if (shippingDetails.length === 0 || !shippingDetails.some(s => s.cost === 0)) {
          shippingDetails.push({ method: 'Standard Shipping', cost: 0, time: '7-15 business days' });
        }
      }
    });

    return { totalShipping, shippingDetails };
  };

  const { totalShipping, shippingDetails } = calculateShipping();
  const finalTotal = selectedTotal + totalShipping;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-[1440px] mx-auto px-3 sm:px-4 py-12 sm:py-20 text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading cart...</p>
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="max-w-[1440px] mx-auto px-3 sm:px-4 py-12 sm:py-20 text-center">
          <ShoppingCart className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mx-auto mb-3 sm:mb-4" />
          <h2 className="text-lg sm:text-xl font-bold mb-2">Your cart is empty</h2>
          <p className="text-sm text-muted-foreground mb-5 sm:mb-6">Looks like you haven't added anything yet.</p>
          <Link to="/" className="inline-block bg-primary text-primary-foreground font-bold px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg hover:opacity-90 text-sm sm:text-base">
            Continue Shopping
          </Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const handleCheckout = () => {
    if (selectedCount > 0) {
      navigate("/checkout");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-[1440px] mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-32 lg:pb-6">
        <h1 className="text-lg sm:text-2xl font-bold mb-3 sm:mb-6">
          Shopping Cart ({items.reduce((s, i) => s + i.quantity, 0)})
        </h1>

        <div className="grid lg:grid-cols-[1fr_350px] gap-4 sm:gap-8">
          <div>
            {/* Select all */}
            <div className="flex items-center gap-3 mb-3 sm:mb-4 pb-3 border-b border-border">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) => selectAll(!!checked)}
              />
              <span className="text-xs sm:text-sm font-medium">Select All ({items.length})</span>
            </div>

            <div className="space-y-3 sm:space-y-4">
              {items.map(({ id, product, quantity, selected, color, size }) => (
                <div
                  key={id || product.id}
                  className={`border rounded-xl p-3 sm:p-4 transition-colors ${
                    selected ? "border-primary/50 bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex gap-2.5 sm:gap-4">
                    {/* Checkbox */}
                    <div className="flex items-start pt-1 flex-shrink-0">
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => id && toggleSelect(id)}
                      />
                    </div>

                    {/* Image */}
                    <Link to={generateProductUrl(product)} className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                      <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
                    </Link>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <Link to={generateProductUrl(product)} className="text-xs sm:text-sm font-medium text-foreground hover:text-primary line-clamp-2">
                        {product.title}
                      </Link>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {color && <span className="text-[10px] sm:text-xs text-muted-foreground bg-muted px-1.5 sm:px-2 py-0.5 rounded">{color}</span>}
                        {size && <span className="text-[10px] sm:text-xs text-muted-foreground bg-muted px-1.5 sm:px-2 py-0.5 rounded">{size}</span>}
                      </div>

                      {/* Price + controls row */}
                      <div className="flex items-center justify-between mt-2 sm:mt-3 gap-2">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <button
                            onClick={() => id && updateQuantity(id, quantity - 1)}
                            className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted active:scale-95"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs sm:text-sm font-medium w-5 sm:w-6 text-center">{quantity}</span>
                          <button
                            onClick={() => id && updateQuantity(id, quantity + 1)}
                            className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted active:scale-95"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4">
                          <span className="font-bold text-xs sm:text-base text-foreground"><TakaSign />{(product.price * quantity).toLocaleString()}</span>
                          <button onClick={() => id && removeFromCart(id)} className="text-muted-foreground hover:text-destructive active:scale-95">
                            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order summary - desktop */}
          <div className="hidden lg:block border border-border rounded-xl p-5 h-fit sticky top-24">
            <h3 className="text-lg font-bold mb-4">Order Summary</h3>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Selected ({selectedCount} items)</span>
                <span className="font-medium"><TakaSign />{selectedTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span className={totalShipping === 0 ? "text-success font-medium" : "font-medium"}>
                  {totalShipping === 0 ? 'Free' : <><TakaSign />{totalShipping.toLocaleString()}</>}
                </span>
              </div>
              {shippingDetails.length > 0 && totalShipping > 0 && (
                <div className="text-xs text-muted-foreground pl-2">
                  {shippingDetails.map((detail, index) => (
                    <div key={index}>
                      {detail.method}: <TakaSign />{detail.cost.toLocaleString()}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-border pt-3 mb-4">
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span className="text-primary"><TakaSign />{finalTotal.toLocaleString()}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Tax excluded</p>
            </div>
            <button
              onClick={handleCheckout}
              disabled={selectedCount === 0}
              className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Checkout ({selectedCount})
            </button>
            {selectedCount === 0 && (
              <p className="text-xs text-muted-foreground text-center mt-2">Select items to proceed</p>
            )}
          </div>
        </div>
      </main>

      {/* Mobile sticky bottom bar */}
      <div className="lg:hidden fixed bottom-14 left-0 right-0 bg-background border-t border-border px-3 py-3 z-40 flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">
            {selectedCount > 0 ? `${selectedCount} selected` : "No items selected"}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-primary"><TakaSign />{finalTotal.toLocaleString()}</span>
            {totalShipping > 0 && (
              <span className="text-xs text-muted-foreground">
                (incl. <TakaSign />{totalShipping.toLocaleString()} shipping)
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleCheckout}
          disabled={selectedCount === 0}
          className="bg-primary text-primary-foreground font-bold py-3 px-5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] text-sm whitespace-nowrap"
        >
          Checkout
        </button>
      </div>

      <SiteFooter />
    </div>
  );
};

export default Cart;
