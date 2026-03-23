import { useSearchParams } from "react-router-dom";
import { useState, useMemo } from "react";
import { SlidersHorizontal, X, Star, Truck, Tag } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ProductCard from "@/components/ProductCard";
import { useProducts } from "@/hooks/useProducts";
import api from "@/lib/api";
import TakaSign from "@/components/TakaSign";

const Search = () => {
  const { data: products = [], isLoading, isError } = useProducts();
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const categoryId = searchParams.get("category");
  const [sortBy, setSortBy] = useState("best-match");
  const [showFilters, setShowFilters] = useState(false);

  // Fetch category data if categoryId is present
  const { data: category } = useQuery({
    queryKey: ['category', categoryId],
    queryFn: async () => {
      if (!categoryId) return null;
      const response = await api.get(`/products/categories/${categoryId}/`);
      return response.data;
    },
    enabled: !!categoryId,
  });

  // Filter state
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [freeShipping, setFreeShipping] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [selectedBadges, setSelectedBadges] = useState<string[]>([]);
  const [onlyDeals, setOnlyDeals] = useState(false);

  const toggleBadge = (b: string) =>
    setSelectedBadges((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));

  const activeFilterCount = [
    priceMin || priceMax,
    freeShipping,
    minRating > 0,
    selectedBadges.length > 0,
    onlyDeals,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setPriceMin(""); setPriceMax(""); setFreeShipping(false);
    setMinRating(0); setSelectedBadges([]); setOnlyDeals(false);
  };

  const filtered = useMemo(() => {
    return products.filter((p) => {
      // Category filtering - if categoryId is specified, filter by category
      if (categoryId && p.category_id !== parseInt(categoryId)) return false;
      
      // Text search filtering
      if (
        query &&
        !p.title.toLowerCase().includes(query.toLowerCase()) &&
        !p.category.toLowerCase().includes(query.toLowerCase()) &&
        !p.store.toLowerCase().includes(query.toLowerCase())
      ) return false;
      
      // Other filters
      if (priceMin && p.price < Number(priceMin)) return false;
      if (priceMax && p.price > Number(priceMax)) return false;
      if (freeShipping && !p.freeShipping) return false;
      if (minRating > 0 && p.rating < minRating) return false;
      if (selectedBadges.length > 0 && !selectedBadges.some((b) => p.badges.includes(b))) return false;
      if (onlyDeals && !p.welcomeDeal) return false;
      return true;
    });
  }, [products, categoryId, query, priceMin, priceMax, freeShipping, minRating, selectedBadges, onlyDeals]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "price-low": return a.price - b.price;
        case "price-high": return b.price - a.price;
        case "rating": return b.rating - a.rating;
        case "orders": return b.reviews - a.reviews;
        default: return 0;
      }
    });
  }, [filtered, sortBy]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-[1440px] mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 sm:pb-8">
        {isLoading && (
          <div className="text-center py-8 text-muted-foreground">Loading products...</div>
        )}
        {isError && (
          <div className="text-center py-8 text-muted-foreground">Failed to load products.</div>
        )}
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg sm:text-xl font-bold">
              {category ? `${category.name}` : query ? `Results for "${query}"` : "All Products"}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">{sorted.length} items found</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 text-sm border rounded-lg px-3 py-2 transition-colors ${
                showFilters || activeFilterCount > 0
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted text-foreground"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-sm border border-border rounded-lg px-2 sm:px-3 py-2 bg-background"
            >
              <option value="best-match">Best Match</option>
              <option value="price-low">Price: Low → High</option>
              <option value="price-high">Price: High → Low</option>
              <option value="rating">Top Rated</option>
              <option value="orders">Most Orders</option>
            </select>
          </div>
        </div>

        {/* Active filter chips */}
        {activeFilterCount > 0 && !showFilters && (
          <div className="flex flex-wrap gap-2 mb-4">
            {(priceMin || priceMax) && (
              <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                <TakaSign />{priceMin || "0"} - <TakaSign />{priceMax || "∞"}
                <button onClick={() => { setPriceMin(""); setPriceMax(""); }}><X className="w-3 h-3" /></button>
              </span>
            )}
            {freeShipping && (
              <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                Free Shipping <button onClick={() => setFreeShipping(false)}><X className="w-3 h-3" /></button>
              </span>
            )}
            {minRating > 0 && (
              <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                {minRating}★ & up <button onClick={() => setMinRating(0)}><X className="w-3 h-3" /></button>
              </span>
            )}
            {selectedBadges.map((b) => (
              <span key={b} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                {b} <button onClick={() => toggleBadge(b)}><X className="w-3 h-3" /></button>
              </span>
            ))}
            {onlyDeals && (
              <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                Deals Only <button onClick={() => setOnlyDeals(false)}><X className="w-3 h-3" /></button>
              </span>
            )}
            <button onClick={clearFilters} className="text-xs text-destructive hover:underline">Clear all</button>
          </div>
        )}

        {/* Compact filter panel */}
        {showFilters && (
          <div className="border border-border rounded-xl p-4 mb-4 bg-card animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">Filters</h3>
              <div className="flex items-center gap-3">
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="text-xs text-destructive hover:underline">Clear all</button>
                )}
                <button onClick={() => setShowFilters(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* Price Range */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Price Range (Tk/৳)</p>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    className="w-full border border-border rounded-lg px-2 py-1.5 text-xs bg-background"
                    placeholder="Min"
                  />
                  <span className="text-muted-foreground text-xs">-</span>
                  <input
                    type="number"
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                    className="w-full border border-border rounded-lg px-2 py-1.5 text-xs bg-background"
                    placeholder="Max"
                  />
                </div>
              </div>

              {/* Rating */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Min Rating</p>
                <div className="flex gap-1">
                  {[3, 4, 4.5].map((r) => (
                    <button
                      key={r}
                      onClick={() => setMinRating(minRating === r ? 0 : r)}
                      className={`flex items-center gap-0.5 text-xs px-2 py-1.5 rounded-lg border transition-colors ${
                        minRating === r ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      <Star className={`w-3 h-3 ${minRating === r ? "fill-primary text-primary" : "fill-star text-star"}`} />
                      {r}+
                    </button>
                  ))}
                </div>
              </div>

              {/* Badges */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Labels</p>
                <div className="flex gap-1 flex-wrap">
                  {["Choice", "Sale"].map((b) => (
                    <button
                      key={b}
                      onClick={() => toggleBadge(b)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                        selectedBadges.includes(b) ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shipping */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Shipping</p>
                <button
                  onClick={() => setFreeShipping(!freeShipping)}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                    freeShipping ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-muted-foreground"
                  }`}
                >
                  <Truck className="w-3 h-3" /> Free Shipping
                </button>
              </div>

              {/* Deals */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Deals</p>
                <button
                  onClick={() => setOnlyDeals(!onlyDeals)}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                    onlyDeals ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-muted-foreground"
                  }`}
                >
                  <Tag className="w-3 h-3" /> Welcome Deals
                </button>
              </div>
            </div>

            <div className="flex justify-end mt-3">
              <button
                onClick={() => setShowFilters(false)}
                className="text-sm font-medium bg-primary text-primary-foreground px-5 py-2 rounded-lg hover:bg-primary/90 transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}

        {/* Results */}
        {sorted.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-2">No products found matching your criteria.</p>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-sm text-primary hover:underline">Clear filters</button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
            {sorted.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default Search;
