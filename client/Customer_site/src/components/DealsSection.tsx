import { ChevronRight, Clock, Gift } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import { Link } from "react-router-dom";
import { generateProductUrl } from "@/lib/slugify";
import TakaSign from "@/components/TakaSign";

const DealsSection = () => {
  const { data: products } = useProducts();
  const bundleDeals = (products || []).slice(0, 3);
  const superDeals = (products || []).slice(3, 6);
  return (
    <section className="max-w-[1440px] mx-auto px-4 py-8">
      <h2 className="section-title mb-6">Today's deals</h2>
      <div className="grid md:grid-cols-2 gap-6">
        {/* Bundle deals */}
        <div className="deal-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-foreground">Bundle deals</h3>
            <Link to="/bundle-deals" className="flex items-center gap-1 text-sm bg-muted px-3 py-1.5 rounded-full font-medium hover:bg-muted/80 transition-colors">
              <Gift className="w-4 h-4 text-secondary" />
              3 from <TakaSign />249
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {bundleDeals.map((p) => (
              <Link to={generateProductUrl(p)} key={p.id} className="group">
                <div className="aspect-square rounded-lg overflow-hidden bg-muted mb-2">
                  <img src={p.image} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">{p.title}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* SuperDeals */}
        <div className="deal-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-foreground">SuperDeals</h3>
            <Link to="/super-deals" className="flex items-center gap-1 text-sm bg-muted px-3 py-1.5 rounded-full font-medium hover:bg-muted/80 transition-colors">
              <Clock className="w-4 h-4 text-primary" />
              Ends in: 16:03:33
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {superDeals.map((p) => (
              <Link to={generateProductUrl(p)} key={p.id} className="group">
                <div className="aspect-square rounded-lg overflow-hidden bg-muted mb-2">
                  <img src={p.image} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">{p.title}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default DealsSection;
