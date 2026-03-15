import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

type AuthMode = "login" | "signup" | "forgot";

export default function Auth() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    ownerName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    address: "",
    businessName: "",
    businessCategory: "",
    businessDescription: "",
    additionalInfo: "",
  });

  const updateForm = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const loginAndRedirect = async () => {
    const res = await api.post("/auth/token/", {
      email: form.email,
      password: form.password,
    });
    const profile = await login({ access: res.data.access, refresh: res.data.refresh });
    toast.success("Welcome back!");
    if (profile?.role === "Admin" || profile?.is_superuser) {
      navigate("/");
    } else {
      navigate("/shop-selector");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup" && form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        await api.post("/auth/register/", {
          email: form.email,
          password: form.password,
          role: "Seller",
          owner_name: form.ownerName,
          phone: form.phone,
          address: form.address,
          business_name: form.businessName,
          business_category: form.businessCategory,
          business_description: form.businessDescription,
          additional_info: form.additionalInfo,
        });
        toast.success("Seller request submitted. Please wait for admin approval.");
        setMode("login");
      } else if (mode === "login") {
        await loginAndRedirect();
      } else {
        toast.success("Password reset link sent to your email");
        setMode("login");
      }
    } catch (err: any) {
      const data = err?.response?.data;
      const firstFieldError =
        data && typeof data === "object"
          ? Object.values(data).flat().find((v) => typeof v === "string")
          : null;
      toast.error(
        (typeof firstFieldError === "string" && firstFieldError) ||
          data?.detail ||
          data?.error ||
          "An error occurred"
      );
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/70">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground w-full">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Flypick</h1>
            <p className="text-sm text-primary-foreground/70 mt-1">Seller Center</p>
          </div>
          <div>
            <h2 className="text-4xl font-bold leading-tight tracking-tight">
              Grow your business
              <br />
              with Flypick.
            </h2>
            <p className="text-primary-foreground/60 mt-4 text-lg max-w-md leading-relaxed">
              Sellers can register, get approved by the main admin, and manage shops, products, and orders.
            </p>
          </div>
          <p className="text-xs text-primary-foreground/30">© 2026 Flypick. All rights reserved.</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-[520px] space-y-8">
          <div className="lg:hidden text-center mb-4">
            <h1 className="text-2xl font-bold text-primary tracking-tight">Flypick</h1>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">
              {mode === "login" && "Welcome back"}
              {mode === "signup" && "Seller registration"}
              {mode === "forgot" && "Reset password"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {mode === "login" && "Enter your credentials to access your dashboard"}
              {mode === "signup" && "Submit your details for admin approval"}
              {mode === "forgot" && "Enter your email and we will send a reset link"}
            </p>
          </div>



          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="ownerName" className="text-sm font-medium">
                    Owner Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="ownerName"
                      placeholder="John Doe"
                      className="pl-10 h-11 rounded-xl"
                      value={form.ownerName}
                      onChange={(e) => updateForm("ownerName", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-medium">
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      className="h-11 rounded-xl"
                      value={form.phone}
                      onChange={(e) => updateForm("phone", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="businessCategory" className="text-sm font-medium">
                      Business Category
                    </Label>
                    <Input
                      id="businessCategory"
                      className="h-11 rounded-xl"
                      value={form.businessCategory}
                      onChange={(e) => updateForm("businessCategory", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address" className="text-sm font-medium">
                    Address
                  </Label>
                  <Input
                    id="address"
                    className="h-11 rounded-xl"
                    value={form.address}
                    onChange={(e) => updateForm("address", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessName" className="text-sm font-medium">
                    Business Name
                  </Label>
                  <Input
                    id="businessName"
                    className="h-11 rounded-xl"
                    value={form.businessName}
                    onChange={(e) => updateForm("businessName", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessDescription" className="text-sm font-medium">
                    Business Description
                  </Label>
                  <Textarea
                    id="businessDescription"
                    className="rounded-xl"
                    value={form.businessDescription}
                    onChange={(e) => updateForm("businessDescription", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="additionalInfo" className="text-sm font-medium">
                    Other Information (Optional)
                  </Label>
                  <Textarea
                    id="additionalInfo"
                    className="rounded-xl"
                    value={form.additionalInfo}
                    onChange={(e) => updateForm("additionalInfo", e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  className="pl-10 h-11 rounded-xl"
                  value={form.email}
                  onChange={(e) => updateForm("email", e.target.value)}
                  required
                />
              </div>
            </div>

            {mode !== "forgot" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Password
                  </Label>
                  {mode === "login" && (
                    <button
                      type="button"
                      className="text-xs text-primary font-medium hover:underline underline-offset-4"
                      onClick={() => setMode("forgot")}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="pl-10 pr-10 h-11 rounded-xl"
                    value={form.password}
                    onChange={(e) => updateForm("password", e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  className="h-11 rounded-xl"
                  value={form.confirmPassword}
                  onChange={(e) => updateForm("confirmPassword", e.target.value)}
                  required
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 rounded-xl font-semibold text-sm gap-2"
              disabled={loading}
            >
              {loading ? (
                <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  {mode === "login" && "Sign In"}
                  {mode === "signup" && "Submit Request"}
                  {mode === "forgot" && "Send Reset Link"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {mode === "login" && (
              <>
                Don&apos;t have an account?{" "}
                <button className="text-primary font-semibold hover:underline underline-offset-4" onClick={() => setMode("signup")}>
                  Sign up
                </button>
              </>
            )}
            {mode === "signup" && (
              <>
                Already have an account?{" "}
                <button className="text-primary font-semibold hover:underline underline-offset-4" onClick={() => setMode("login")}>
                  Sign in
                </button>
              </>
            )}
            {mode === "forgot" && (
              <>
                Remember your password?{" "}
                <button className="text-primary font-semibold hover:underline underline-offset-4" onClick={() => setMode("login")}>
                  Back to sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
