import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, CreditCard, Truck, ShieldCheck, Plus, X, Tag, CheckCircle, Loader2 } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useCart } from "@/context/CartContext";
import { useAddress } from "@/context/AddressContext";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import api from "@/lib/api";

interface PaymentMethods {
  cash_on_delivery: boolean;
  bkash: boolean;
  nagad: boolean;
  credit_card: boolean;
}

const Checkout = () => {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const { selectedItems, selectedTotal, selectedCount, buyNowItem, setBuyNowItem, clearCart, removeFromCart } = useCart();
  const { addresses, defaultAddress, addAddress } = useAddress();

  // Redirect to login if not authenticated
  if (!isLoggedIn) {
    navigate("/auth");
    return null;
  }

  const isBuyNow = !!buyNowItem;
  const checkoutItems = isBuyNow
    ? [{ product: buyNowItem!.product, quantity: buyNowItem!.quantity, color: buyNowItem!.color, size: buyNowItem!.size, shippingType: buyNowItem!.shippingType }]
    : selectedItems.map((i) => ({ product: i.product, quantity: i.quantity, color: i.color, size: i.size, shippingType: i.shippingType }));

  const checkoutTotal = isBuyNow
    ? buyNowItem!.product.price * buyNowItem!.quantity
    : selectedTotal;
  const checkoutCount = isBuyNow ? buyNowItem!.quantity : selectedCount;

  // Calculate shipping costs from products
  const calculateShipping = () => {
    let totalShipping = 0;
    const shippingDetails: Array<{ method: string; cost: number; time: string }> = [];

    checkoutItems.forEach((item) => {
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

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(defaultAddress?.id || null);
  const [showNewForm, setShowNewForm] = useState(addresses.length === 0);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [newAddr, setNewAddr] = useState({ full_name: "", phone: "", street: "", city: "", state: "", zip_code: "", country: "Bangladesh" });
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number; type: "percent" | "fixed" | "shipping" } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethods | null>(null);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(true);

  const handleApplyCoupon = async () => {
    setCouponError("");
    const code = couponCode.trim().toUpperCase();
    if (!code) { 
      setCouponError("Please enter a coupon code."); 
      return; 
    }

    setValidatingCoupon(true);
    
    try {
      // Prepare cart items for validation
      const cartItems = checkoutItems.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity
      }));

      const response = await api.post('/orders/orders/validate_coupon/', {
        coupon_code: code,
        cart_items: cartItems
      });

      if (response.data.valid) {
        const couponData = response.data.coupon;
        setAppliedCoupon({ 
          code: couponData.code, 
          discount: couponData.discount_amount,  // Use the calculated discount_amount from backend
          type: couponData.discount_type 
        });
        setCouponCode("");
        toast({ 
          title: "Coupon applied!", 
          description: `${couponData.code} has been applied to your order.` 
        });
      } else {
        setCouponError(response.data.error || "Invalid coupon code");
      }
    } catch (error: any) {
      console.error('Coupon validation error:', error);
      const errorMessage = error?.response?.data?.error || 
                          error?.response?.data?.detail || 
                          "Failed to validate coupon. Please try again.";
      setCouponError(errorMessage);
    } finally {
      setValidatingCoupon(false);
    }
  };

  // Fetch payment methods from backend
  useEffect(() => {
    const fetchPaymentMethods = async () => {
      try {
        const response = await api.get('/orders/payment-methods/');
        console.log('Payment methods from API:', response.data);
        setPaymentMethods(response.data);
        
        // Set default payment method to first available
        if (response.data.cash_on_delivery) {
          setPaymentMethod('cod');
        } else if (response.data.bkash) {
          setPaymentMethod('bkash');
        } else if (response.data.nagad) {
          setPaymentMethod('nagad');
        } else if (response.data.credit_card) {
          setPaymentMethod('card');
        }
      } catch (error) {
        console.error('Failed to fetch payment methods:', error);
        // Default to all disabled if fetch fails
        setPaymentMethods({
          cash_on_delivery: false,
          bkash: false,
          nagad: false,
          credit_card: false,
        });
      } finally {
        setLoadingPaymentMethods(false);
      }
    };

    fetchPaymentMethods();
  }, []);

  const handleRemoveCoupon = () => { setAppliedCoupon(null); };

  const couponDiscount = appliedCoupon
    ? appliedCoupon.type === "shipping"
      ? Math.min(totalShipping, appliedCoupon.discount)  // For shipping coupons, use the discount value but cap at shipping cost
      : appliedCoupon.discount  // For percent and fixed coupons, use the pre-calculated discount_amount from backend
    : 0;
  const finalTotal = Math.max(0, checkoutTotal + totalShipping - couponDiscount);

  // Auto-select default address when addresses change
  useEffect(() => {
    if (defaultAddress && !selectedAddressId) {
      setSelectedAddressId(defaultAddress.id);
    }
  }, [defaultAddress]);

  const selectedAddr = addresses.find((a) => a.id === selectedAddressId);

  if (checkoutItems.length === 0) {
    navigate("/cart");
    return null;
  }

  const handleSaveNewAddress = async () => {
    if (!newAddr.full_name || !newAddr.phone || !newAddr.street || !newAddr.city) {
      toast({ title: "Missing info", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    try {
      await addAddress(newAddr, true);
      setNewAddr({ full_name: "", phone: "", street: "", city: "", state: "", zip_code: "", country: "Bangladesh" });
      setShowNewForm(false);
      setSelectedAddressId(null);
    } catch (error) {
      toast({ title: "Error", description: "Failed to save address", variant: "destructive" });
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddr && !showNewForm) {
      toast({ title: "No address", description: "Please select or add a shipping address.", variant: "destructive" });
      return;
    }
    if (showNewForm) {
      await handleSaveNewAddress();
      return;
    }

    try {
      setPlacing(true);

      // Prepare order data for backend
      const orderData = {
        shipping_full_name: selectedAddr!.full_name,
        shipping_phone: selectedAddr!.phone,
        shipping_street: selectedAddr!.street,
        shipping_city: selectedAddr!.city,
        shipping_state: selectedAddr!.state || '',
        shipping_zip_code: selectedAddr!.zip_code || '',
        shipping_country: selectedAddr!.country,
        payment_method: paymentMethod,
        coupon_code: appliedCoupon?.code || '',
        items: checkoutItems.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          color: item.color || '',
          size: item.size || '',
        })),
      };

      // Create order via API
      const response = await api.post('/orders/orders/', orderData);
      const createdOrder = response.data;

      toast({ 
        title: "Order placed!", 
        description: `Order ${createdOrder.order_id} has been created successfully.` 
      });

      // Clear cart
      if (isBuyNow) {
        setBuyNowItem(null);
      } else {
        // Remove selected items from cart using their cart item IDs
        for (const item of selectedItems) {
          if (item.id) {
            await removeFromCart(item.id);
          }
        }
      }

      // Navigate to order confirmation
      navigate(`/order-confirmation/${createdOrder.order_id}`, { 
        state: { 
          order: createdOrder,
          fromCheckout: true 
        } 
      });
    } catch (error: any) {
      console.error('Order creation failed:', error);
      
      // Better error message extraction
      let errorMsg = 'Failed to place order. Please try again.';
      
      if (error.response?.data) {
        const data = error.response.data;
        
        // Check for specific field errors
        if (data.payment_method && Array.isArray(data.payment_method)) {
          errorMsg = data.payment_method[0];
        } else if (data.items && Array.isArray(data.items)) {
          errorMsg = data.items[0];
        } else if (data.detail) {
          errorMsg = data.detail;
        } else if (data.error) {
          errorMsg = data.error;
        } else if (typeof data === 'string') {
          errorMsg = data;
        } else if (data.non_field_errors && Array.isArray(data.non_field_errors)) {
          errorMsg = data.non_field_errors[0];
        }
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      // If it's a 500 error, provide more helpful message
      if (error.response?.status === 500) {
        errorMsg = 'Server error occurred. Your order may have been created. Please check your orders page or contact support.';
      }
      
      toast({ 
        title: "Order failed", 
        description: errorMsg, 
        variant: "destructive" 
      });
    } finally {
      setPlacing(false);
    }
  };

  // Available payment methods based on backend configuration
  const availablePaymentMethods = [
    { value: "cod", label: "Cash on Delivery", desc: "Pay when you receive", enabled: paymentMethods?.cash_on_delivery ?? false },
    { value: "bkash", label: "bKash", desc: "Mobile payment", enabled: paymentMethods?.bkash ?? false },
    { value: "nagad", label: "Nagad", desc: "Digital payment", enabled: paymentMethods?.nagad ?? false },
    { value: "card", label: "Credit / Debit Card", desc: "Visa, Mastercard, etc.", enabled: paymentMethods?.credit_card ?? false },
  ].filter(method => method.enabled);

  console.log('Available payment methods:', availablePaymentMethods);
  console.log('Payment methods state:', paymentMethods);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-[1440px] mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 sm:pb-6">
        <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Checkout</h1>

        <div className="grid lg:grid-cols-[1fr_400px] gap-4 sm:gap-8">
          <div className="space-y-4 sm:space-y-6">
            {/* Shipping Address */}
            <div className="border border-border rounded-xl p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold">Shipping Address</h3>
              </div>

              {/* Selected address display */}
              {selectedAddr && !showNewForm && (
                <div className="border border-primary rounded-lg p-3 sm:p-4 bg-primary/5 mb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm">{selectedAddr.full_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{selectedAddr.phone}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {selectedAddr.street}, {selectedAddr.city}
                        {selectedAddr.state ? `, ${selectedAddr.state}` : ""} {selectedAddr.zip_code}
                      </p>
                      <p className="text-xs text-muted-foreground">{selectedAddr.country}</p>
                    </div>
                    {selectedAddr.is_default && (
                      <span className="text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded flex-shrink-0">DEFAULT</span>
                    )}
                  </div>
                  <div className="flex gap-3 mt-3">
                    {addresses.length > 1 && (
                      <button onClick={() => setShowAddressPicker(!showAddressPicker)} className="text-xs text-primary font-medium hover:underline">
                        Change address
                      </button>
                    )}
                    <button onClick={() => { setShowNewForm(true); setSelectedAddressId(null); }} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Use new address
                    </button>
                  </div>
                </div>
              )}

              {/* Address picker dropdown */}
              {showAddressPicker && !showNewForm && (
                <div className="space-y-2 mb-3">
                  {addresses.filter((a) => a.id !== selectedAddressId).map((addr) => (
                    <button
                      key={addr.id}
                      onClick={() => { setSelectedAddressId(addr.id); setShowAddressPicker(false); }}
                      className="w-full text-left border border-border rounded-lg p-3 hover:border-primary hover:bg-primary/5 transition-colors"
                    >
                      <p className="font-medium text-sm">{addr.full_name} · {addr.phone}</p>
                      <p className="text-xs text-muted-foreground">{addr.street}, {addr.city}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* No addresses + new form */}
              {(showNewForm || addresses.length === 0) && (
                <div className="space-y-3">
                  {addresses.length > 0 && (
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-medium">New Address</h4>
                      <button onClick={() => { setShowNewForm(false); setSelectedAddressId(defaultAddress?.id || null); }} className="text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1">Full Name *</Label>
                      <Input value={newAddr.full_name} onChange={(e) => setNewAddr({ ...newAddr, full_name: e.target.value })} placeholder="John Doe" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1">Phone Number *</Label>
                      <Input value={newAddr.phone} onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })} placeholder="+880 1XXX-XXXXXX" />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs text-muted-foreground mb-1">Street Address *</Label>
                      <Input value={newAddr.street} onChange={(e) => setNewAddr({ ...newAddr, street: e.target.value })} placeholder="House #, Road #, Area" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1">City *</Label>
                      <Input value={newAddr.city} onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })} placeholder="Dhaka" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1">State / Division</Label>
                      <Input value={newAddr.state} onChange={(e) => setNewAddr({ ...newAddr, state: e.target.value })} placeholder="Dhaka Division" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1">Zip Code</Label>
                      <Input value={newAddr.zip_code} onChange={(e) => setNewAddr({ ...newAddr, zip_code: e.target.value })} placeholder="1200" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1">Country</Label>
                      <Input value={newAddr.country} onChange={(e) => setNewAddr({ ...newAddr, country: e.target.value })} />
                    </div>
                    <div className="sm:col-span-2">
                      <button onClick={handleSaveNewAddress} className="bg-primary text-primary-foreground font-medium px-6 py-2.5 rounded-lg hover:opacity-90 text-sm w-full sm:w-auto">
                        Save & Use This Address
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div className="border border-border rounded-xl p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold">Payment Method</h3>
              </div>
              
              {loadingPaymentMethods ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : availablePaymentMethods.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No payment methods available at the moment.</p>
                  <p className="text-xs mt-1">Please contact support.</p>
                </div>
              ) : (
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
                  {availablePaymentMethods.map((method) => (
                    <div key={method.value} className="flex items-center gap-3 border border-border rounded-lg p-3 hover:bg-muted/50 cursor-pointer">
                      <RadioGroupItem value={method.value} id={method.value} />
                      <Label htmlFor={method.value} className="flex-1 cursor-pointer">
                        <div className="font-medium text-sm">{method.label}</div>
                        <div className="text-xs text-muted-foreground">{method.desc}</div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </div>

            {/* Shipping */}
            <div className="border border-border rounded-xl p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <Truck className="w-5 h-5 text-success" />
                <h3 className="text-lg font-bold">Shipping</h3>
              </div>
              <div className="space-y-2">
                {shippingDetails.map((detail, index) => (
                  <div key={index} className="flex items-center justify-between text-sm p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">{detail.method}</p>
                      <p className="text-xs text-muted-foreground">Estimated delivery: {detail.time}</p>
                    </div>
                    <span className={detail.cost === 0 ? "text-success font-bold" : "font-bold"}>
                      {detail.cost === 0 ? 'Free' : `৳${detail.cost.toLocaleString()}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <div className="space-y-4">
            <div className="border border-border rounded-xl p-4 sm:p-5 sticky top-24">
              <h3 className="text-lg font-bold mb-4">Order Summary</h3>

              <div className="space-y-3 max-h-[300px] overflow-y-auto mb-4">
                {checkoutItems.map((item) => (
                  <div key={item.product.id} className="flex gap-3">
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      <img src={item.product.image} alt={item.product.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold line-clamp-2 text-foreground">{item.product.title}</p>
                      <div className="flex gap-1 mt-1">
                        {item.color && <span className="text-xs text-muted-foreground">{item.color}</span>}
                        {item.size && <span className="text-xs text-muted-foreground">· {item.size}</span>}
                      </div>
                      <div className="flex justify-between mt-2">
                        <span className="text-xs text-muted-foreground">Qty: {item.quantity}</span>
                        <span className="text-sm font-bold text-primary">৳{(item.product.price * item.quantity).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal ({checkoutCount} items)</span>
                  <span>৳{checkoutTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className={totalShipping === 0 ? "text-success font-medium" : ""}>
                    {totalShipping === 0 ? 'Free' : `৳${totalShipping.toLocaleString()}`}
                  </span>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between text-success">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      Coupon ({appliedCoupon.code})
                    </span>
                    <span>-৳{couponDiscount.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Coupon Section */}
              <div className="border-t border-border pt-3 mt-3">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between bg-success/10 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-success" />
                      <span className="text-xs font-medium text-success">{appliedCoupon.code} applied</span>
                    </div>
                    <button onClick={handleRemoveCoupon} className="text-xs text-destructive font-medium hover:underline">Remove</button>
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <Input
                        value={couponCode}
                        onChange={(e) => { setCouponCode(e.target.value); setCouponError(""); }}
                        placeholder="Enter coupon code"
                        className="text-sm h-9"
                        onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                      />
                      <button
                        onClick={handleApplyCoupon}
                        disabled={validatingCoupon}
                        className="bg-foreground text-background text-sm font-medium px-4 rounded-lg hover:opacity-90 transition-opacity flex-shrink-0 h-9 disabled:opacity-50 flex items-center gap-2"
                      >
                        {validatingCoupon ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Validating...
                          </>
                        ) : (
                          'Apply'
                        )}
                      </button>
                    </div>
                    {couponError && <p className="text-xs text-destructive mt-1.5">{couponError}</p>}
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-3 mt-3">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-primary">৳{finalTotal.toLocaleString()}</span>
                </div>
                {couponDiscount > 0 && (
                  <p className="text-xs text-success font-medium mt-0.5">You save ৳{couponDiscount.toLocaleString()}!</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">Tax excluded</p>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={placing || availablePaymentMethods.length === 0}
                className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-lg mt-4 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {placing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Placing Order...
                  </>
                ) : (
                  'Place Order'
                )}
              </button>

              <div className="flex items-center gap-1.5 justify-center mt-3 text-xs text-muted-foreground">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Secure checkout</span>
              </div>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Checkout;
