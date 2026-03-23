import { useParams, Link, useNavigate } from "react-router-dom";
import { Star, Heart, Share2, Truck, ShieldCheck, RotateCcw, ChevronRight, Minus, Plus, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useProduct, useProductByPath, useProducts } from "@/hooks/useProducts";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ProductCard from "@/components/ProductCard";
import ProductReviews from "@/components/ProductReviews";
import ProductSpecifications from "@/components/ProductSpecifications";
import ProductDescription from "@/components/ProductDescription";
import ProductCoupons from "@/components/ProductCoupons";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";
import { extractProductId, generateProductUrl, slugify } from "@/lib/slugify";
import TakaSign from "@/components/TakaSign";

const ProductDetail = () => {
  const { id, category, slug } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();

  const legacyProductId = !id ? extractProductId(window.location.pathname)?.toString() : null;
  const categorySlug = category ? slugify(category) : "";
  const productSlug = slug ? slugify(slug) : "";
  const shouldResolveByPath = !id && !legacyProductId && !!categorySlug && !!productSlug;

  const {
    data: resolvedProduct,
    isLoading: isPathLoading,
    error: pathError,
  } = useProductByPath(categorySlug, productSlug);
  const { data: fetchedProduct, isLoading: isProductLoading, error: productError } = useProduct(id || legacyProductId || "");
  const product = fetchedProduct || resolvedProduct;
  const error = productError || pathError;
  const { data: allProducts = [] } = useProducts();
  const [quantity, setQuantity] = useState(1);
  const { toggleWishlist, isInWishlist } = useWishlist();
  const liked = product ? isInWishlist(product.id) : false;
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);
  const [pendingAction, setPendingAction] = useState<"cart" | "buy" | null>(null);
  const [selectedShipping, setSelectedShipping] = useState<string>("");
  const [showShipping, setShowShipping] = useState(false);
  const { addToCart, setBuyNowItem } = useCart();

  useEffect(() => {
    if (!product) return;

    const canonicalPath = generateProductUrl(product);
    if (window.location.pathname !== canonicalPath) {
      navigate(canonicalPath, { replace: true });
    }
  }, [navigate, product]);

  const reviewsRef = useRef<HTMLDivElement>(null);
  const specsRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLDivElement>(null);
  const storeRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  const isLoading = isProductLoading || (shouldResolveByPath && isPathLoading);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Product not found</p>
        </div>
      </div>
    );
  }

  // Use actual image gallery from API, fallback to single image if gallery is empty
  const productImages = product.image_gallery && product.image_gallery.length > 0 
    ? product.image_gallery 
    : [product.image];
  
  const productVideos = product.video_gallery || [];

  // Get shipping options from product variants or use defaults
  const shippingOptions = product.variants?.shippingOptions && product.variants.shippingOptions.length > 0
    ? product.variants.shippingOptions.filter((opt: any) => opt.enabled)
    : [
        { type: "Standard", price: product.freeShipping ? "0" : "50", estimatedDelivery: "3-5", enabled: true, freeShipping: product.freeShipping }
      ];

  // Set default shipping option if not already set
  if (!selectedShipping && shippingOptions.length > 0) {
    setSelectedShipping(shippingOptions[0].type.toLowerCase());
  }

  const relatedProducts = (allProducts || []).filter((p) => p.id !== product.id).slice(0, 6);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    const totalMedia = productImages.length + productVideos.length;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && selectedImage < totalMedia - 1) {
        setSelectedImage(selectedImage + 1);
      } else if (diff < 0 && selectedImage > 0) {
        setSelectedImage(selectedImage - 1);
      }
    }
  };
  const sections = [
    { label: `Customer Reviews (${product.reviews})`, ref: reviewsRef },
    { label: "Specifications", ref: specsRef },
    { label: "Description", ref: descRef },
    { label: "Store", ref: storeRef },
    { label: "More to love", ref: moreRef },
  ];

  const scrollTo = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const triggerAction = (action: "cart" | "buy") => {
    // Check if user is logged in
    if (!isLoggedIn) {
      toast({ 
        title: "Login required", 
        description: "Please login to continue shopping.",
        variant: "destructive" 
      });
      // Save current location to redirect back after login
      localStorage.setItem('redirect_after_login', window.location.pathname);
      navigate("/auth");
      return;
    }

    // Check if variants are enabled
    const hasColors = product.variants?.hasColors && product.variants?.selectedColors && product.variants.selectedColors.length > 0;
    const hasSizes = product.variants?.hasSizes && product.variants?.sizeStocks && product.variants.sizeStocks.length > 0;
    
    // If product has any variants enabled, always show confirmation sheet
    if (hasColors || hasSizes) {
      setPendingAction(action);
      setShowConfirmSheet(true);
      return;
    }
    
    // No variants, add directly
    executeAction(action);
  };

  const executeAction = async (action: "cart" | "buy") => {
    // Double-check authentication
    if (!isLoggedIn) {
      toast({ 
        title: "Login required", 
        description: "Please login to continue shopping.",
        variant: "destructive" 
      });
      // Save current location to redirect back after login
      localStorage.setItem('redirect_after_login', window.location.pathname);
      navigate("/auth");
      return;
    }

    const color = selectedColor || "";
    const size = selectedSize || "";
    const shippingType = selectedShipping || "";
    
    if (action === "cart") {
      try {
        await addToCart(product, quantity, color, size, shippingType);
        toast({ 
          title: "Added to cart", 
          description: `${product.title} (x${quantity})${color ? ` - ${color}` : ''}${size ? `, Size ${size}` : ''}` 
        });
      } catch (error) {
        toast({ 
          title: "Failed to add to cart", 
          description: "Please try again",
          variant: "destructive"
        });
      }
    } else {
      setBuyNowItem({ product, quantity, color, size, shippingType });
      navigate("/checkout");
    }
    setShowConfirmSheet(false);
    setPendingAction(null);
  };

  const handleConfirm = () => {
    const hasColors = product.variants?.hasColors && product.variants?.selectedColors && product.variants.selectedColors.length > 0;
    const hasSizes = product.variants?.hasSizes && product.variants?.sizeStocks && product.variants.sizeStocks.length > 0;
    
    const needsColorSelection = hasColors && !selectedColor;
    const needsSizeSelection = hasSizes && !selectedSize;
    
    if (needsColorSelection || needsSizeSelection) {
      toast({ 
        title: "Please select options", 
        description: `Please select ${needsColorSelection ? 'a color' : ''}${needsColorSelection && needsSizeSelection ? ' and ' : ''}${needsSizeSelection ? 'a size' : ''} to continue.`,
        variant: "destructive" 
      });
      return;
    }
    
    if (pendingAction) executeAction(pendingAction);
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="max-w-[1440px] mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground">{product.title.slice(0, 40)}...</span>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_320px] gap-4 md:gap-6">
          {/* Images */}
          <div className="min-w-0 flex flex-col-reverse sm:flex-row gap-3">
            <div className="flex sm:flex-col gap-2 overflow-x-auto sm:overflow-visible">
              {productImages.map((img, i) => (
                <div
                  key={`img-${i}`}
                  onClick={() => setSelectedImage(i)}
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border-2 cursor-pointer transition-colors flex-shrink-0 ${i === selectedImage ? "border-primary" : "border-border hover:border-muted-foreground"}`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
              {productVideos.map((video, i) => (
                <div
                  key={`vid-${i}`}
                  onClick={() => setSelectedImage(productImages.length + i)}
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border-2 cursor-pointer transition-colors flex-shrink-0 relative ${(productImages.length + i) === selectedImage ? "border-primary" : "border-border hover:border-muted-foreground"}`}
                >
                  <video src={video} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                </div>
              ))}
            </div>
            <div
              className="flex-1 min-w-0 rounded-lg overflow-hidden bg-muted relative h-[320px] sm:h-[420px] lg:h-[500px] xl:h-[560px]"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {selectedImage < productImages.length ? (
                <img src={productImages[selectedImage]} alt={product.title} className="w-full h-full object-cover transition-opacity duration-300" />
              ) : (
                <video 
                  src={productVideos[selectedImage - productImages.length]} 
                  controls 
                  className="w-full h-full object-cover"
                  autoPlay
                />
              )}
              {/* Dot indicators for mobile */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 sm:hidden">
                {[...productImages, ...productVideos].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`w-2 h-2 rounded-full transition-all ${i === selectedImage ? "bg-primary w-4" : "bg-foreground/30"}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-foreground leading-snug mb-3">{product.title}</h1>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < Math.floor(product.rating) ? "fill-star text-star" : "text-border"}`} />
                ))}
              </div>
              <span className="text-sm font-medium">{product.rating}</span>
              <span className="text-sm text-muted-foreground">{product.reviews} Reviews</span>
              <span className="text-sm text-muted-foreground">| {product.sold} sold</span>
            </div>

            {product.welcomeDeal && (
              <div className="welcome-deal-box mb-4">
                <p className="text-primary font-semibold text-sm mb-1">Welcome deal</p>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-primary"><TakaSign />{product.price.toLocaleString()}</span>
                  <span className="price-original"><TakaSign />{product.originalPrice.toLocaleString()}</span>
                </div>
                <p className="text-sm text-success font-medium">New shoppers save <TakaSign />{(product.originalPrice - product.price).toFixed(2)}</p>
              </div>
            )}

            {!product.welcomeDeal && (
              <div className="mb-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-primary"><TakaSign />{product.price.toLocaleString()}</span>
                  <span className="price-original"><TakaSign />{product.originalPrice.toLocaleString()}</span>
                  <span className="price-discount">-{product.discount}%</span>
                </div>
              </div>
            )}

            {/* Available Coupons */}
            <div className="mb-6">
              <ProductCoupons productId={product.id.toString()} />
            </div>

            {/* Color selection - Show if product has color variants enabled */}
            {product.variants?.hasColors && product.variants?.selectedColors && product.variants.selectedColors.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium mb-2">
                  Color: <span className="text-primary">{selectedColor || "Select"}</span>
                </p>
                <div className="flex gap-2 flex-wrap">
                  {product.variants.selectedColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                        color === selectedColor 
                          ? "border-primary bg-primary/10 text-primary" 
                          : "border-border text-foreground hover:border-muted-foreground"
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Size selection - Show if product has size variants enabled */}
            {product.variants?.hasSizes && product.variants?.sizeStocks && product.variants.sizeStocks.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium mb-2">
                  Size: <span className="text-primary">{selectedSize || "Select"}</span>
                </p>
                <div className="flex gap-2 flex-wrap">
                  {product.variants.sizeStocks.map((sizeStock) => (
                    <button
                      key={sizeStock.size}
                      onClick={() => setSelectedSize(sizeStock.size)}
                      disabled={sizeStock.stock === 0}
                      className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                        sizeStock.size === selectedSize 
                          ? "border-primary bg-primary/10 text-primary" 
                          : sizeStock.stock === 0
                          ? "border-border text-muted-foreground opacity-50 cursor-not-allowed"
                          : "border-border text-foreground hover:border-muted-foreground"
                      }`}
                    >
                      {sizeStock.size}
                      {sizeStock.stock === 0 && <span className="ml-1 text-xs">(Out)</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Mobile-only: store, shipping, quantity info */}
          <div className="md:hidden col-span-full space-y-4 border-t border-border pt-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Sold By</span>
              <span className="font-medium text-foreground">{product.store}</span>
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            </div>

            <div className="flex items-center gap-1">
              {product.badges.includes("Choice") && <span className="badge-choice">Choice</span>}
              <span className="text-xs text-muted-foreground">Flypick commitment</span>
            </div>

            <div>
              <button onClick={() => setShowShipping(!showShipping)} className="flex items-center gap-2 text-sm w-full">
                <Truck className="w-4 h-4 text-success" />
                <span className="font-medium">
                  {(() => {
                    const selected = shippingOptions.find(opt => opt.type.toLowerCase() === selectedShipping);
                    const opt = selected || (shippingOptions.length > 0 ? shippingOptions[0] : null);
                    if (!opt) return "Shipping";
                    return opt.freeShipping ? `${opt.type} · Free` : <>{opt.type} · <TakaSign />{opt.price}</>;
                  })()}
                </span>
                <ChevronRight className={`w-3 h-3 ml-auto transition-transform ${showShipping ? "rotate-90" : ""}`} />
              </button>
              {showShipping && (
                <div className="space-y-2 mt-2">
                  {shippingOptions.map((option: any, index: number) => (
                    <label 
                      key={index}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedShipping === option.type.toLowerCase() 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-muted-foreground"
                      }`} 
                      onClick={(e) => { e.preventDefault(); setSelectedShipping(option.type.toLowerCase()); setShowShipping(false); }}
                    >
                      {option.type.toLowerCase().includes('express') || option.type.toLowerCase().includes('super') ? (
                        <Zap className="w-4 h-4 text-primary flex-shrink-0" />
                      ) : (
                        <Truck className="w-4 h-4 text-success flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <span className="text-sm font-medium">
                          {option.type} · {option.freeShipping ? "Free" : <><TakaSign />{option.price}</>}
                        </span>
                        <p className="text-xs text-muted-foreground">{option.estimatedDelivery} business days</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        selectedShipping === option.type.toLowerCase() ? "border-primary" : "border-border"
                      }`}>
                        {selectedShipping === option.type.toLowerCase() && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-3 mt-3">
              {product.return_policy && (
                <div className="flex items-center gap-2 text-sm">
                  <RotateCcw className="w-4 h-4 text-foreground" />
                  <span>{product.return_policy} return & refund available. Easy returns with full refund.</span>
                </div>
              )}
              {product.warranty && (
                <div className="flex items-center gap-2 text-sm">
                  <ShieldCheck className="w-4 h-4 text-success" />
                  <span>{product.warranty} warranty included for your peace of mind.</span>
                </div>
              )}
              {!product.return_policy && !product.warranty && (
                <>
                  <Link to="/return-policy" className="flex items-center gap-2 text-sm cursor-pointer hover:text-foreground">
                    <RotateCcw className="w-4 h-4 text-foreground" />
                    <span>Return & refund policy</span>
                    <ChevronRight className="w-3 h-3 ml-auto" />
                  </Link>
                  <Link to="/privacy-policy" className="flex items-center gap-2 text-sm cursor-pointer hover:text-foreground">
                    <ShieldCheck className="w-4 h-4 text-success" />
                    <span>Security & Privacy</span>
                    <ChevronRight className="w-3 h-3 ml-auto" />
                  </Link>
                </>
              )}
            </div>

            {/* Quantity */}
            <div>
              <p className="text-sm font-medium mb-2">Quantity</p>
              <div className="flex items-center gap-3">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-muted">
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-lg font-medium w-8 text-center">{quantity}</span>
                <button 
                  onClick={() => setQuantity(quantity + 1)} 
                  disabled={product.stock !== undefined && quantity >= product.stock}
                  className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {product.stock !== undefined && (
                <p className="text-xs text-muted-foreground mt-1">
                  {product.stock > 0 ? `${product.stock} available` : "Out of stock"}
                </p>
              )}
            </div>
          </div>

          {/* Sidebar - desktop only */}
          <div className="hidden md:block lg:col-span-2 xl:col-span-1 border border-border rounded-xl p-5 h-fit xl:sticky xl:top-24">

            {/* Color selection - Show if enabled */}
            {product.variants?.hasColors && product.variants?.selectedColors && product.variants.selectedColors.length > 0 && (
              <div className="mb-3">
                <p className="text-sm font-medium mb-2">
                  Color: <span className="text-primary">{selectedColor || "Not selected"}</span>
                </p>
                <div className="flex gap-2 flex-wrap">
                  {product.variants.selectedColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`px-3 py-1.5 rounded-lg border-2 text-xs font-medium transition-all ${
                        color === selectedColor 
                          ? "border-primary bg-primary/10 text-primary" 
                          : "border-border text-foreground hover:border-muted-foreground"
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Size selection - Show if enabled */}
            {product.variants?.hasSizes && product.variants?.sizeStocks && product.variants.sizeStocks.length > 0 && (
              <div className="mb-3">
                <p className="text-sm font-medium mb-2">
                  Size: <span className="text-primary">{selectedSize || "Not selected"}</span>
                </p>
                <div className="flex gap-2 flex-wrap">
                  {product.variants.sizeStocks.map((sizeStock) => (
                    <button
                      key={sizeStock.size}
                      onClick={() => setSelectedSize(sizeStock.size)}
                      disabled={sizeStock.stock === 0}
                      className={`px-3 py-1.5 rounded-lg border-2 text-xs font-medium transition-all ${
                        sizeStock.size === selectedSize 
                          ? "border-primary bg-primary/10 text-primary" 
                          : sizeStock.stock === 0
                          ? "border-border text-muted-foreground opacity-50 cursor-not-allowed"
                          : "border-border text-foreground hover:border-muted-foreground"
                      }`}
                    >
                      {sizeStock.size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm mb-3">
              <span className="text-muted-foreground">Sold By</span>
              <span className="font-medium text-foreground">{product.store}</span>
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            </div>

            <div className="flex items-center gap-1 mb-4">
              {product.badges.includes("Choice") && <span className="badge-choice">Choice</span>}
              <span className="text-xs text-muted-foreground">Flypick commitment</span>
            </div>

            <div className="mb-4">
              <button onClick={() => setShowShipping(!showShipping)} className="flex items-center gap-2 text-sm w-full">
                <Truck className="w-4 h-4 text-success" />
                <span className="font-medium">
                  {(() => {
                    const selected = shippingOptions.find(opt => opt.type.toLowerCase() === selectedShipping);
                    const opt = selected || (shippingOptions.length > 0 ? shippingOptions[0] : null);
                    if (!opt) return "Shipping";
                    return opt.freeShipping ? `${opt.type} · Free` : <>{opt.type} · <TakaSign />{opt.price}</>;
                  })()}
                </span>
                <ChevronRight className={`w-3 h-3 ml-auto transition-transform ${showShipping ? "rotate-90" : ""}`} />
              </button>
              {showShipping && (
                <div className="space-y-2 mt-2">
                  {shippingOptions.map((option: any, index: number) => (
                    <label 
                      key={index}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedShipping === option.type.toLowerCase() 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-muted-foreground"
                      }`} 
                      onClick={(e) => { e.preventDefault(); setSelectedShipping(option.type.toLowerCase()); setShowShipping(false); }}
                    >
                      {option.type.toLowerCase().includes('express') || option.type.toLowerCase().includes('super') ? (
                        <Zap className="w-4 h-4 text-primary flex-shrink-0" />
                      ) : (
                        <Truck className="w-4 h-4 text-success flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <span className="text-sm font-medium">
                          {option.type} · {option.freeShipping ? "Free" : <><TakaSign />{option.price}</>}
                        </span>
                        <p className="text-xs text-muted-foreground">{option.estimatedDelivery} business days</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        selectedShipping === option.type.toLowerCase() ? "border-primary" : "border-border"
                      }`}>
                        {selectedShipping === option.type.toLowerCase() && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3 mb-6">
              {product.return_policy && (
                <div className="flex items-center gap-2 text-sm">
                  <RotateCcw className="w-4 h-4 text-foreground" />
                  <span>{product.return_policy} return & refund available. Easy returns with full refund.</span>
                </div>
              )}
              {product.warranty && (
                <div className="flex items-center gap-2 text-sm">
                  <ShieldCheck className="w-4 h-4 text-success" />
                  <span>{product.warranty} warranty included for your peace of mind.</span>
                </div>
              )}
              {!product.return_policy && !product.warranty && (
                <>
                  <Link to="/return-policy" className="flex items-center gap-2 text-sm cursor-pointer hover:text-foreground">
                    <RotateCcw className="w-4 h-4 text-foreground" />
                    <span>Return & refund policy</span>
                    <ChevronRight className="w-3 h-3 ml-auto" />
                  </Link>
                  <Link to="/privacy-policy" className="flex items-center gap-2 text-sm cursor-pointer hover:text-foreground">
                    <ShieldCheck className="w-4 h-4 text-success" />
                    <span>Security & Privacy</span>
                    <ChevronRight className="w-3 h-3 ml-auto" />
                  </Link>
                </>
              )}
            </div>

            {/* Quantity */}
            <div className="mb-4">
              <p className="text-sm font-medium mb-2">Quantity</p>
              <div className="flex items-center gap-3">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-muted">
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-lg font-medium w-8 text-center">{quantity}</span>
                <button 
                  onClick={() => setQuantity(quantity + 1)} 
                  disabled={product.stock !== undefined && quantity >= product.stock}
                  className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {product.stock !== undefined && (
                <p className="text-xs text-muted-foreground mt-1">
                  {product.stock > 0 ? `${product.stock} available` : "Out of stock"}
                </p>
              )}
            </div>

            <button onClick={() => triggerAction("buy")} className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-lg mb-2 hover:opacity-90 transition-opacity">
              Buy now
            </button>
            <button onClick={() => triggerAction("cart")} className="w-full border-2 border-foreground text-foreground font-bold py-3 rounded-lg mb-4 hover:bg-muted transition-colors">
              Add to cart
            </button>

            <div className="flex gap-3">
              <button className="flex-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground py-2 border border-border rounded-lg">
                <Share2 className="w-4 h-4" /> Share
              </button>
              <button
                onClick={() => product && toggleWishlist(product)}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground py-2 border border-border rounded-lg"
              >
                <Heart className={`w-4 h-4 ${liked ? "fill-primary text-primary" : ""}`} /> {liked ? 1754 : 1753}
              </button>
            </div>
          </div>
        </div>

        {/* Sticky scroll nav */}
        <div className="hidden md:block border-t border-border mt-10 pt-0 sticky top-[120px] z-30 bg-background">
          <div className="flex gap-6 overflow-x-auto border-b border-border">
            {sections.map((section) => (
              <button
                key={section.label}
                onClick={() => scrollTo(section.ref)}
                className="text-sm font-medium whitespace-nowrap py-3 border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>

        {/* All sections inline */}
        <div ref={reviewsRef} className="pt-8 scroll-mt-[180px]">
          <ProductReviews product={product} />
        </div>

        <div ref={specsRef} className="pt-8 border-t border-border mt-8 scroll-mt-[180px]">
          <ProductSpecifications product={product} />
        </div>

        <div ref={descRef} className="pt-8 border-t border-border mt-8 scroll-mt-[180px]">
          <ProductDescription product={product} />
        </div>

        <div ref={storeRef} className="pt-8 border-t border-border mt-8 scroll-mt-[180px]">
          <div className="py-8 text-center">
            <h3 className="text-xl font-bold mb-2">{product.store}</h3>
            <p className="text-muted-foreground text-sm mb-4">Official Store · 98.2% positive feedback</p>
            <button className="px-6 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted">Visit Store</button>
          </div>
        </div>

        <div ref={moreRef} className="pt-8 border-t border-border mt-8 scroll-mt-[180px]">
          <h2 className="text-xl font-bold mb-6">More to love</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
            {(allProducts || []).filter((p) => p.id !== product.id).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>

        {/* Related products */}
        <div className="mt-10 border-t border-border pt-8 pb-20 md:pb-8">
          <h2 className="text-xl font-bold mb-6">Related items</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </main>

      <SiteFooter />

      {/* Mobile sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border p-3 flex gap-3 md:hidden">
        <button onClick={() => triggerAction("cart")} className="flex-1 border-2 border-foreground text-foreground font-bold py-3 rounded-full hover:bg-muted transition-colors text-sm">
          Add to cart
        </button>
        <button onClick={() => triggerAction("buy")} className="flex-1 bg-primary text-primary-foreground font-bold py-3 rounded-full hover:opacity-90 transition-opacity text-sm">
          Buy now
        </button>
      </div>

      {/* Confirmation sheet for color/size selection */}
      {showConfirmSheet && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => { setShowConfirmSheet(false); setPendingAction(null); }} />
          <div className="relative w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl p-5 pb-8 sm:pb-5 animate-slide-in-right sm:animate-scale-in z-10" style={{ animation: "slideUp 0.3s ease-out" }}>
            {/* Product preview */}
            <div className="flex gap-3 mb-5 pb-4 border-b border-border">
              <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                <img src={product.image} alt="" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-sm font-medium line-clamp-2">{product.title}</p>
                <p className="text-lg font-bold text-primary mt-1"><TakaSign />{product.price.toLocaleString()}</p>
              </div>
            </div>

            {/* Color selection - Show if enabled */}
            {product.variants?.hasColors && product.variants?.selectedColors && product.variants.selectedColors.length > 0 && (
              <div className="mb-5">
                <p className="text-sm font-medium mb-2">
                  Color: <span className={selectedColor ? "text-primary" : "text-destructive"}>
                    {selectedColor || "Please select"}
                  </span>
                </p>
                <div className="flex gap-2 flex-wrap">
                  {product.variants.selectedColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                        color === selectedColor 
                          ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30" 
                          : "border-border text-foreground hover:border-muted-foreground"
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Size selection - Show if enabled */}
            {product.variants?.hasSizes && product.variants?.sizeStocks && product.variants.sizeStocks.length > 0 && (
              <div className="mb-6">
                <p className="text-sm font-medium mb-2">
                  Size: <span className={selectedSize ? "text-primary" : "text-destructive"}>
                    {selectedSize || "Please select"}
                  </span>
                </p>
                <div className="flex gap-2 flex-wrap">
                  {product.variants.sizeStocks.map((sizeStock) => (
                    <button
                      key={sizeStock.size}
                      onClick={() => setSelectedSize(sizeStock.size)}
                      disabled={sizeStock.stock === 0}
                      className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                        sizeStock.size === selectedSize 
                          ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30" 
                          : sizeStock.stock === 0
                          ? "border-border text-muted-foreground opacity-50 cursor-not-allowed"
                          : "border-border text-foreground hover:border-muted-foreground"
                      }`}
                    >
                      {sizeStock.size}
                      {sizeStock.stock === 0 && <span className="ml-1 text-xs">(Out)</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Confirm button */}
            <button
              onClick={handleConfirm}
              className={`w-full font-bold py-3.5 rounded-xl transition-all ${
                pendingAction === "buy"
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "border-2 border-foreground text-foreground hover:bg-muted"
              }`}
            >
              {pendingAction === "buy" ? "Buy now" : "Add to cart"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetail;
