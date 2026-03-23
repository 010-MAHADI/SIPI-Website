import { Star, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import type { Product } from "@/hooks/useProducts";
import { generateProductUrl } from "@/lib/slugify";
import TakaSign from "@/components/TakaSign";

interface ProductCardProps {
  product: Product;
}

const ProductCard = ({ product }: ProductCardProps) => {
  return (
    <Link to={generateProductUrl(product)} className="product-card group inline-block w-full">
      <div className="relative overflow-hidden bg-muted">
        <img
          src={product.image}
          alt={product.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <button
          onClick={(e) => { e.preventDefault(); }}
          className="absolute bottom-2 right-2 bg-card/90 backdrop-blur-sm p-1.5 rounded-full border border-border opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ShoppingCart className="w-4 h-4 text-foreground" />
        </button>
        {product.welcomeDeal && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-r from-primary to-secondary text-primary-foreground text-xs font-bold px-2 py-1">
            WELCOME DEAL · Free shipping
          </div>
        )}
      </div>
      <div className="p-3">
        {/* Badges */}
        <div className="flex gap-1 mb-1.5 flex-wrap">
          {product.badges.map((badge) => (
            <span
              key={badge}
              className={badge === "Choice" ? "badge-choice" : "badge-sale"}
            >
              {badge}
            </span>
          ))}
        </div>

        <h3 className="text-sm text-foreground line-clamp-2 mb-2 leading-tight">
          {product.title}
        </h3>

        <div className="flex items-baseline gap-2 mb-1">
          <span className="price-current text-lg">
            <TakaSign />{product.price.toLocaleString()}
          </span>
          <span className="price-original">
            <TakaSign />{product.originalPrice.toLocaleString()}
          </span>
          <span className="price-discount">-{product.discount}%</span>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`w-3 h-3 ${i < Math.floor(product.rating) ? "fill-star text-star" : "text-border"}`}
              />
            ))}
            <span className="ml-1">{product.rating}</span>
          </div>
          <span>|</span>
          <span>{product.sold} sold</span>
        </div>

        {product.freeShipping && (
          <div className="mt-2">
            <span className="badge-free-shipping">Free shipping</span>
          </div>
        )}
      </div>
    </Link>
  );
};

export default ProductCard;
