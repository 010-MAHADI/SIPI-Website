import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ShopProvider } from "@/context/ShopContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AdminLayout } from "@/components/AdminLayout";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import ProductForm from "./pages/ProductForm";
import Orders from "./pages/Orders";
import Customers from "./pages/Customers";
import Categories from "./pages/Categories";
import Reviews from "./pages/Reviews";
import Analytics from "./pages/Analytics";
import Coupons from "./pages/Coupons";
import Transactions from "./pages/Transactions";
import Sellers from "./pages/Sellers";
import SellerDetail from "./pages/SellerDetail";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import Banners from "./pages/Banners";
import SellerRequests from "./pages/SellerRequests";
import ShopSelector from "./pages/ShopSelector";
import CreateShop from "./pages/CreateShop";
import Promotions from "./pages/Promotions";
import ChatAdmin from "./pages/ChatAdmin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();
type Role = "Admin" | "Seller";

const hasAdminAccess = (user: any) =>
  !!user && (user.role === "Admin" || user.is_superuser === true);

const hasSellerAccess = (user: any) => !!user && user.role === "Seller";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <div className="h-screen w-full flex items-center justify-center bg-background"><div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" />;
  }

  if (!hasAdminAccess(user) && !hasSellerAccess(user)) {
    return <Navigate to="/auth" />;
  }

  return children;
};

const RoleRoute = ({ children, roles }: { children: React.ReactNode; roles: Role[] }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="h-screen w-full flex items-center justify-center bg-background"><div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const effectiveRole: Role | null = hasAdminAccess(user)
    ? "Admin"
    : hasSellerAccess(user)
      ? "Seller"
      : null;

  if (!effectiveRole || !roles.includes(effectiveRole)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <ShopProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/shop-selector" element={<ProtectedRoute><RoleRoute roles={["Seller"]}><ShopSelector /></RoleRoute></ProtectedRoute>} />
              <Route path="/create-shop" element={<ProtectedRoute><RoleRoute roles={["Seller"]}><CreateShop /></RoleRoute></ProtectedRoute>} />
              <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/products" element={<Products />} />
                <Route path="/products/new" element={<ProductForm />} />
                <Route path="/products/:id/edit" element={<ProductForm />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/coupons" element={<Coupons />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/promotions" element={<Promotions />} />
                <Route path="/customers" element={<RoleRoute roles={["Admin"]}><Customers /></RoleRoute>} />
                <Route path="/categories" element={<RoleRoute roles={["Admin"]}><Categories /></RoleRoute>} />
                <Route path="/reviews" element={<RoleRoute roles={["Admin"]}><Reviews /></RoleRoute>} />
                <Route path="/transactions" element={<RoleRoute roles={["Admin"]}><Transactions /></RoleRoute>} />
                <Route path="/sellers" element={<RoleRoute roles={["Admin"]}><Sellers /></RoleRoute>} />
                <Route path="/sellers/:id" element={<RoleRoute roles={["Admin"]}><SellerDetail /></RoleRoute>} />
                <Route path="/seller-requests" element={<RoleRoute roles={["Admin"]}><SellerRequests /></RoleRoute>} />
                <Route path="/banners" element={<RoleRoute roles={["Admin"]}><Banners /></RoleRoute>} />
                <Route path="/chat" element={<RoleRoute roles={["Admin"]}><ChatAdmin /></RoleRoute>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ShopProvider>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
