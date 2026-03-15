import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, ShoppingBag, Sparkles, Shield, Truck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api, { API_BASE_URL } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

const floatingItems = [
  { icon: ShoppingBag, delay: 0, x: "10%", y: "20%" },
  { icon: Sparkles, delay: 1.5, x: "80%", y: "15%" },
  { icon: Shield, delay: 3, x: "15%", y: "75%" },
  { icon: Truck, delay: 4.5, x: "85%", y: "70%" },
];

const Auth = () => {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSubmitTime, setLastSubmitTime] = useState(0);
  const [socialProvider, setSocialProvider] = useState<"google" | "apple" | null>(null);
  const [isCompletingSocialLogin, setIsCompletingSocialLogin] = useState(false);
  const { login, completeSocialLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const handledSocialPayloadRef = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(location.hash.startsWith("#") ? location.hash.slice(1) : "");
    const provider = (hashParams.get("provider") || searchParams.get("provider")) as "google" | "apple" | null;
    const socialError = searchParams.get("social_error");
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const nextPath = hashParams.get("next") || searchParams.get("next") || localStorage.getItem("redirect_after_login") || "/account";
    const socialPayloadKey = `${location.search}|${location.hash}`;

    if (socialError) {
      if (handledSocialPayloadRef.current === socialPayloadKey) {
        return;
      }
      handledSocialPayloadRef.current = socialPayloadKey;
      setSocialProvider(null);
      setIsCompletingSocialLogin(false);
      toast.error(socialError);
      navigate("/auth", { replace: true });
      return;
    }

    if (!accessToken || !refreshToken) {
      handledSocialPayloadRef.current = null;
      return;
    }

    if (handledSocialPayloadRef.current === socialPayloadKey) {
      return;
    }
    handledSocialPayloadRef.current = socialPayloadKey;

    window.history.replaceState(null, "", "/auth");
    setSocialProvider(provider);
    setIsCompletingSocialLogin(true);
    let isActive = true;

    const completeLogin = async () => {
      try {
        await completeSocialLogin(accessToken, refreshToken);
        localStorage.removeItem("redirect_after_login");
        navigate(nextPath.startsWith("/") ? nextPath : "/account", { replace: true });
      } catch (error) {
        console.error("Social login completion failed:", error);
        toast.error("Social sign-in failed. Please try again.");
        navigate("/auth", { replace: true });
      } finally {
        if (isActive) {
          setSocialProvider(null);
          setIsCompletingSocialLogin(false);
        }
      }
    };

    void completeLogin();
    return () => {
      isActive = false;
    };
  }, [location.hash, location.search, completeSocialLogin, navigate]);

  const handleSwitch = (target?: "login" | "signup" | "forgot") => {
    setSwitching(true);
    setTimeout(() => {
      if (target) {
        setMode(target);
        setIsLogin(target === "login");
      } else {
        const next = isLogin ? "signup" : "login";
        setMode(next);
        setIsLogin(!isLogin);
      }
      setForgotSent(false);
      setSwitching(false);
    }, 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submissions with debounce
    const now = Date.now();
    if (isSubmitting || (now - lastSubmitTime < 2000)) {
      return;
    }
    
    setLastSubmitTime(now);
    
    if (mode === "forgot") {
      setForgotSent(true);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      if (mode === "login") {
        await login(email, password);
        
        // Check if there's a redirect URL saved
        const redirectUrl = localStorage.getItem('redirect_after_login');
        if (redirectUrl) {
          localStorage.removeItem('redirect_after_login');
          navigate(redirectUrl);
        } else {
          navigate("/account");
        }
      } else {
        // Customer registration
        const timestamp = Date.now().toString().slice(-4); // Last 4 digits of timestamp
        const baseUsername = email.split('@')[0];
        const uniqueUsername = `${baseUsername}_${timestamp}`;
        
        const response = await api.post("/auth/customer/register/", {
          email: email,
          password: password,
          username: uniqueUsername, // Use timestamped username for uniqueness
          customer_profile: {
            first_name: name.split(' ')[0] || '',
            last_name: name.split(' ').slice(1).join(' ') || ''
          }
        });
        
        // Small delay before auto-login to prevent race conditions
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Auto-login after successful registration
        await login(email, password);
        navigate("/account");
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      
      let errorMessage = "";
      
      if (error?.response?.data) {
        const errorData = error.response.data;
        
        // Handle specific field errors
        if (errorData.username) {
          errorMessage = Array.isArray(errorData.username) ? errorData.username[0] : errorData.username;
        } else if (errorData.email) {
          errorMessage = Array.isArray(errorData.email) ? errorData.email[0] : errorData.email;
        } else if (errorData.password) {
          errorMessage = Array.isArray(errorData.password) ? errorData.password[0] : errorData.password;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (errorData.non_field_errors) {
          errorMessage = Array.isArray(errorData.non_field_errors) ? errorData.non_field_errors[0] : errorData.non_field_errors;
        } else {
          errorMessage = mode === "login" ? "Login failed. Please check your credentials." : "Registration failed. Please try again.";
        }
      } else {
        errorMessage = mode === "login" ? "Login failed. Please check your credentials." : "Registration failed. Please try again.";
      }
      
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startSocialLogin = (provider: "google" | "apple") => {
    const nextPath = localStorage.getItem("redirect_after_login") || "/account";
    setSocialProvider(provider);
    window.location.assign(
      `${API_BASE_URL}/auth/social/${provider}/start/?next=${encodeURIComponent(nextPath)}`
    );
  };

  return (
    <div className="min-h-screen flex bg-background overflow-hidden relative">
      {/* Animated background side */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center auth-gradient overflow-hidden">
        {/* Floating animated circles */}
        <div className="absolute inset-0">
          <div className="auth-blob auth-blob-1" />
          <div className="auth-blob auth-blob-2" />
          <div className="auth-blob auth-blob-3" />
        </div>

        {/* Floating icons */}
        {floatingItems.map((item, i) => (
          <div
            key={i}
            className="absolute auth-float"
            style={{
              left: item.x,
              top: item.y,
              animationDelay: `${item.delay}s`,
            }}
          >
            <div className="bg-card/20 backdrop-blur-sm p-4 rounded-2xl border border-card/10">
              <item.icon className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
        ))}

        {/* Center content */}
        <div
          className={`relative z-10 text-center px-12 transition-all duration-700 ${mounted ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
        >
          <h1 className="text-5xl font-black text-primary-foreground mb-4 tracking-tight">
            Fly<span className="opacity-80">pick</span>
          </h1>
          <p className="text-primary-foreground/80 text-lg max-w-md mx-auto leading-relaxed">
            Discover millions of products at unbeatable prices. Your one-stop shop for everything.
          </p>
          <div className="flex gap-8 mt-10 justify-center">
            {[
              { num: "10M+", label: "Products" },
              { num: "5M+", label: "Users" },
              { num: "99%", label: "Happy" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-bold text-primary-foreground">{stat.num}</div>
                <div className="text-sm text-primary-foreground/60">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Particle dots */}
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-primary-foreground/30 auth-particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      {/* Form side */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div
          className={`w-full max-w-md transition-all duration-700 ${mounted ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
          style={{ transitionDelay: "200ms" }}
        >
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <span className="text-3xl font-black text-primary">
              Fly<span className="text-foreground">pick</span>
            </span>
          </div>

          <div className={`transition-all duration-300 ${switching ? "scale-95 opacity-0" : "scale-100 opacity-100"}`}>
            <h2 className="text-3xl font-bold text-foreground mb-2">
              {mode === "forgot" ? "Reset password" : isLogin ? "Welcome back" : "Create account"}
            </h2>
            <p className="text-muted-foreground mb-8">
              {mode === "forgot"
                ? "Enter your email and we'll send you a reset link."
                : isLogin
                ? "Sign in to access your orders, wishlist and recommendations."
                : "Join millions of shoppers and start saving today."}
            </p>

            {mode === "forgot" ? (
              forgotSent ? (
                <div className="text-center py-6">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">Check your email</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    We've sent a password reset link to <span className="font-medium text-foreground">{email}</span>
                  </p>
                  <button
                    onClick={() => handleSwitch("login")}
                    className="text-primary font-semibold hover:underline text-sm"
                  >
                    ← Back to sign in
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all duration-200"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl hover:opacity-90 transition-all duration-200 flex items-center justify-center gap-2 group auth-btn-glow disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? "Sending..." : "Send reset link"}
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>

                  <p className="text-center text-sm text-muted-foreground">
                    Remember your password?{" "}
                    <button type="button" onClick={() => handleSwitch("login")} className="text-primary font-semibold hover:underline">
                      Sign in
                    </button>
                  </p>
                </form>
              )
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {!isLogin && (
                    <div className="auth-field-enter">
                      <label className="text-sm font-medium text-foreground mb-1.5 block">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="John Doe"
                          className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all duration-200"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all duration-200"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-11 pr-12 py-3 rounded-xl border-2 border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all duration-200"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {isLogin && (
                    <div className="flex items-center justify-between text-sm">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="rounded border-border text-primary focus:ring-primary" />
                        <span className="text-muted-foreground">Remember me</span>
                      </label>
                      <button type="button" onClick={() => handleSwitch("forgot")} className="text-primary hover:underline font-medium">
                        Forgot password?
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl hover:opacity-90 transition-all duration-200 flex items-center justify-center gap-2 group auth-btn-glow disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting 
                      ? (isLogin ? "Signing in..." : "Creating account...") 
                      : (isLogin ? "Sign in" : "Create account")
                    }
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-4 my-6">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-sm text-muted-foreground">or continue with</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Social buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => startSocialLogin("google")}
                    disabled={isCompletingSocialLogin || socialProvider !== null}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-border hover:border-muted-foreground hover:bg-muted/50 transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    {socialProvider === "google" ? "Connecting..." : "Google"}
                  </button>
                  <button
                    type="button"
                    onClick={() => startSocialLogin("apple")}
                    disabled={isCompletingSocialLogin || socialProvider !== null}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-border hover:border-muted-foreground hover:bg-muted/50 transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.47C4.25 16.56 2.93 11.3 4.7 7.72C5.57 5.94 7.36 4.86 9.28 4.84C10.56 4.82 11.78 5.72 12.57 5.72C13.36 5.72 14.82 4.62 16.39 4.82C17.07 4.85 18.89 5.1 20.07 6.82C19.96 6.89 17.62 8.23 17.65 11.1C17.68 14.52 20.6 15.63 20.63 15.64C20.6 15.72 20.17 17.24 19.09 18.8L18.71 19.5Z" />
                    </svg>
                    {socialProvider === "apple" ? "Connecting..." : "Apple"}
                  </button>
                </div>

                {/* Switch mode */}
                <p className="text-center mt-8 text-sm text-muted-foreground">
                  {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                  <button
                    onClick={() => handleSwitch()}
                    className="text-primary font-semibold hover:underline"
                  >
                    {isLogin ? "Sign up" : "Sign in"}
                  </button>
                </p>
              </>
            )}
          </div>

          {/* Back to home */}
          <div className="text-center mt-6">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Back to shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
