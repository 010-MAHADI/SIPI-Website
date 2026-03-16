import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { AddressProvider } from "@/context/AddressContext";
import { OrderProvider } from "@/context/OrderContext";
import { WishlistProvider } from "@/context/WishlistContext";
import ScrollToTop from "./components/ScrollToTop";
import Index from "./pages/Index";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import OrderConfirmation from "./pages/OrderConfirmation";
import Orders from "./pages/Orders";
import Account from "./pages/Account";
import Search from "./pages/Search";
import Wishlist from "./pages/Wishlist";
import Auth from "./pages/Auth";
import Notifications from "./pages/Notifications";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import ReturnPolicy from "./pages/ReturnPolicy";
import ShippingPolicy from "./pages/ShippingPolicy";
import About from "./pages/About";
import Contact from "./pages/Contact";
import FAQ from "./pages/FAQ";
import OrderDetail from "./pages/OrderDetail";
import TrackOrder from "./pages/TrackOrder";
import SuperDeals from "./pages/SuperDeals";
import BundleDeals from "./pages/BundleDeals";
import Returns from "./pages/Returns";
import ReturnRequest from "./pages/ReturnRequest";
import WriteReview from "./pages/WriteReview";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
      <AddressProvider>
      <WishlistProvider>
      <CartProvider>
      <OrderProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            {/* Legacy product URLs for backward compatibility */}
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/product/:id/:slug" element={<ProductDetail />} />
            {/* Canonical SEO-friendly URLs: /category/product-slug */}
            <Route path="/:category/:slug" element={<ProductDetail />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order-confirmation/:orderId" element={<OrderConfirmation />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/order/:orderId" element={<OrderDetail />} />
            <Route path="/track-order/:orderId" element={<TrackOrder />} />
            <Route path="/account" element={<Account />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/search" element={<Search />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/super-deals" element={<SuperDeals />} />
            <Route path="/bundle-deals" element={<BundleDeals />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="/return-policy" element={<ReturnPolicy />} />
            <Route path="/shipping-policy" element={<ShippingPolicy />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/returns" element={<Returns />} />
            <Route path="/return-request/:orderId" element={<ReturnRequest />} />
            <Route path="/write-review/:orderId/:itemId" element={<WriteReview />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </OrderProvider>
      </CartProvider>
      </WishlistProvider>
      </AddressProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
