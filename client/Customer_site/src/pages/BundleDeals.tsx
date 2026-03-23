import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ProductCard from "@/components/ProductCard";
import { useProducts } from "@/hooks/useProducts";
import { Gift } from "lucide-react";
import TakaSign from "@/components/TakaSign";

const BundleDeals = () => {
  const { data: products = [], isLoading, isError } = useProducts();
  const bundleProducts = products.filter(
    (p) => p.freeShipping && p.discount >= 20
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-[1440px] mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 sm:pb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
            <Gift className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Bundle Deals</h1>
            <p className="text-xs text-muted-foreground">3 from <TakaSign />249 · {bundleProducts.length} products</p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground">Loading products...</div>
        ) : isError ? (
          <div className="text-center py-10 text-muted-foreground">Failed to load products.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {bundleProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default BundleDeals;
