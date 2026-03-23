import { useState, useEffect } from "react";
import { Tag, Copy, Clock, Users, Package, ShoppingCart, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import api from "@/lib/api";
import TakaSign from "@/components/TakaSign";

interface Coupon {
  id: number;
  code: string;
  discount_type: "percent" | "fixed" | "shipping";
  discount_value: number;
  discount_text: string;
  coupon_type: "all_products" | "specific_products" | "category" | "first_order";
  min_order_amount: number;
  expires_at: string;
  uses: number;
  max_uses: number;
  remaining_uses: number;
}

interface ProductCouponsProps {
  productId: string;
}

const ProductCoupons = ({ productId }: ProductCouponsProps) => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const fetchCoupons = async () => {
      try {
        const response = await api.get(
          `/orders/orders/product_coupons/?product_id=${productId}`
        );
        setCoupons(response.data.coupons || []);
      } catch (error) {
        console.error("Failed to fetch coupons:", error);
      } finally {
        setLoading(false);
      }
    };

    if (productId) fetchCoupons();
  }, [productId]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Coupon copied!",
      description: `${code} has been copied to your clipboard.`,
    });
  };

  const getCouponTypeIcon = (type: string) => {
    switch (type) {
      case "all_products":
        return <Package className="w-4 h-4" />;
      case "specific_products":
        return <Tag className="w-4 h-4" />;
      case "category":
        return <ShoppingCart className="w-4 h-4" />;
      case "first_order":
        return <Users className="w-4 h-4" />;
      default:
        return <Tag className="w-4 h-4" />;
    }
  };

  const getCouponTypeLabel = (type: string) => {
    switch (type) {
      case "all_products":
        return "All Products";
      case "specific_products":
        return "This Product";
      case "category":
        return "Category";
      case "first_order":
        return "First Order Only";
      default:
        return type;
    }
  };

  const formatExpiryDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return "Expired";
    if (diffDays === 1) return "Expires today";
    if (diffDays <= 7) return `${diffDays} days left`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getAccentColor = (index: number) => {
    const colors = [
      "from-primary/90 to-primary/60",
      "from-secondary/90 to-secondary/60",
      "from-success/80 to-success/50",
      "from-primary/70 to-secondary/70",
    ];
    return colors[index % colors.length];
  };

  const getAccentBorder = (index: number) => {
    const borders = [
      "border-primary/30",
      "border-secondary/30",
      "border-success/30",
      "border-primary/20",
    ];
    return borders[index % borders.length];
  };

  if (loading) {
    return (
      <div className="relative pt-2 pb-4">
        <div className="flex flex-col">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="relative"
              style={{ marginTop: i === 0 ? 0 : -36, zIndex: 20 - i }}
            >
              <div className="h-[56px] rounded-lg border border-border/50 bg-card animate-pulse shadow-sm" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (coupons.length === 0) return null;

  const displayedCoupons = showAll ? coupons : coupons.slice(0, 4);

  return (
    <div className="relative pt-3 pb-4">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm font-bold text-foreground tracking-wide uppercase">
          Available Coupons
        </span>
        <span className="text-xs text-muted-foreground ml-1">
          ({coupons.length})
        </span>
      </div>

      <div
        className="relative flex flex-col cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {displayedCoupons.map((coupon, index) => {
          // In collapsed state, show 60% of each card
          const collapsedOffset = index === 0 ? 0 : -32;
          const expandedOffset = index === 0 ? 0 : 8;

          return (
            <article
              key={coupon.id}
              className="relative"
              style={{
                marginTop: isHovered ? expandedOffset : collapsedOffset,
                zIndex: isHovered
                  ? index + 1
                  : displayedCoupons.length - index,
                transition: "all 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)",
                transform: isHovered
                  ? "scale(1)"
                  : `scale(${1 - index * 0.01})`,
                opacity: isHovered ? 1 : index > 2 ? 0 : 1 - index * 0.03,
              }}
            >
              <div className="relative overflow-hidden rounded-lg border-2 border-red-500 bg-card shadow-sm transition-shadow duration-300 hover:shadow-md">
                <div className="flex items-center justify-between px-4 py-4">
                  {/* Left: discount info - always show all content */}
                  <div className="min-w-0 flex-1">
                    {/* Coupon type with icon */}
                    <div className="flex items-center gap-1.5 mb-1">
                      {getCouponTypeIcon(coupon.coupon_type)}
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {getCouponTypeLabel(coupon.coupon_type)}
                      </span>
                    </div>
                    {/* Discount + min order on same line */}
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-xl font-black text-destructive leading-none tracking-tight">
                        {coupon.discount_text}
                      </span>
                      {coupon.min_order_amount > 0 && (
                        <span className="text-sm text-muted-foreground font-medium">
                          Min <TakaSign />{coupon.min_order_amount}
                        </span>
                      )}
                    </div>
                    {/* Expiry + uses - always visible */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{formatExpiryDate(coupon.expires_at)}</span>
                      <span>•</span>
                      <span>{coupon.remaining_uses} uses left</span>
                    </div>
                  </div>

                  {/* Right: copy button - always visible */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyCode(coupon.code);
                    }}
                    className="flex items-center gap-1.5 text-sm font-bold text-destructive hover:text-destructive/80 active:scale-95 transition-all duration-200 shrink-0 ml-4"
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {coupons.length > 4 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 w-full text-sm text-primary font-bold hover:text-primary/80 transition-colors duration-200"
        >
          {showAll ? "Show less" : `Show ${coupons.length - 4} more coupons`}
        </button>
      )}
    </div>
  );
};

export default ProductCoupons;
