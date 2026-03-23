import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import TakaSign from "@/components/TakaSign";

const HeroBanner = () => {
  return (
    <section className="hero-banner py-3 md:py-6 px-4">
      <div className="max-w-[1440px] mx-auto">
        <p className="text-xs md:text-sm font-medium text-foreground/80 mb-1">
          Sale Ends: Mar 8, 13:59 (GMT+6)
        </p>
        <Link to="/super-deals" className="flex items-center gap-1.5 md:gap-2 mb-3 md:mb-5 group w-fit">
          <h2 className="text-2xl md:text-5xl font-black text-foreground">UP TO</h2>
          <span className="text-2xl md:text-5xl font-black text-primary">60%</span>
          <h2 className="text-2xl md:text-5xl font-black text-foreground">OFF</h2>
          <ChevronRight className="w-5 h-5 md:w-8 md:h-8 text-foreground/60 ml-1 group-hover:translate-x-1 transition-transform" />
        </Link>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          {/* Coupon cards */}
          <div className="bg-card rounded-lg p-3 md:p-4 border border-border">
            <p className="text-primary font-bold text-xs md:text-sm"><TakaSign />2,445.44 OFF</p>
            <p className="text-xs text-muted-foreground">orders <TakaSign />19,441.23+</p>
            <p className="text-primary text-xs font-semibold mt-1 md:mt-2">Code:CD1592</p>
          </div>
          <div className="bg-card rounded-lg p-3 md:p-4 border border-border">
            <p className="text-primary font-bold text-xs md:text-sm"><TakaSign />244.54 OFF</p>
            <p className="text-xs text-muted-foreground">orders <TakaSign />1,834.08+</p>
            <p className="text-primary text-xs font-semibold mt-1 md:mt-2">Code:CD1502</p>
          </div>
          <Link to="/super-deals" className="bg-card rounded-lg p-3 md:p-4 border border-border flex items-center gap-2 md:gap-3 hover:border-primary/30 transition-colors">
            <span className="text-xl md:text-2xl">🔧</span>
            <div>
              <p className="font-bold text-xs md:text-sm">Top deals</p>
              <p className="text-[10px] md:text-xs font-semibold bg-foreground text-card px-2 py-0.5 rounded mt-1 inline-block"><TakaSign /> 2,505.35</p>
            </div>
          </Link>
          <Link to="/bundle-deals" className="bg-card rounded-lg p-3 md:p-4 border border-border flex items-center gap-2 md:gap-3 hover:border-primary/30 transition-colors">
            <span className="text-xl md:text-2xl">💡</span>
            <div>
              <p className="font-bold text-xs md:text-sm">Tech lab</p>
              <p className="text-[10px] md:text-xs font-semibold bg-foreground text-card px-2 py-0.5 rounded mt-1 inline-block"><TakaSign /> 684.48</p>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default HeroBanner;
