"use client";
import { useState, FormEvent, useEffect } from "react";
import { Mail, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const token = searchParams.get("token");
      const id = searchParams.get("id");
      const nameParam = searchParams.get("name");
      const emailParam = searchParams.get("email");
      const isAdmin = searchParams.get("is_admin") === "true";
      const plan = searchParams.get("plan");
      const role = searchParams.get("role");
      const errorParam = searchParams.get("error");

      if (token && id && emailParam) {
        const userObj = {
          id: parseInt(id),
          name: nameParam || "",
          email: emailParam,
          plan: plan || "free",
          is_admin: isAdmin,
          role: role || "owner"
        };
        login(token, userObj);
        window.location.href = "/dashboard";
      } else if (errorParam) {
        setError(decodeURIComponent(errorParam));
      }
    }
  }, [login]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (isLogin) {
        const res = await api.post("/auth/login", { email, password });
        login(res.data.token, res.data.user);
      } else {
        const res = await api.post("/auth/signup", { name, email, password });
        login(res.data.token, res.data.user);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
    window.location.href = backendUrl + "/auth/google";
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#161926] to-[#0b0d14] border-r border-[#2d3148] p-12 flex-col justify-between relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 font-bold text-2xl tracking-tight mb-6">
            <div className="w-10 h-10 bg-[#6366f1] rounded-xl flex items-center justify-center shadow-lg shadow-[#6366f1]/20">
              <Mail className="w-5 h-5 text-white" />
            </div>
            MailFlow
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold leading-tight mt-12 text-[#f8fafc]">
            The world's best <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6366f1] to-[#8b5cf6]">cold email automation</span>
          </h1>
          <p className="mt-6 text-lg text-[#94a3b8] max-w-md">
            Scale your outreach, land more meetings, and automate follow-ups with our lightning-fast SaaS engine.
          </p>
        </div>
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-[#6366f1]/10 rounded-full blur-3xl mix-blend-screen" />
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-[#8b5cf6]/10 rounded-full blur-3xl mix-blend-screen" />
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-24 relative">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-[#f8fafc]">
              {isLogin ? "Welcome back" : "Create an account"}
            </h2>
            <p className="mt-2 text-[#94a3b8]">
              {isLogin ? "Enter your details to access your workspace." : "Start scaling your outreach today."}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-[#cbd5e1] mb-2">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#161926] border border-[#2d3148] rounded-xl px-4 py-3 text-white placeholder-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:border-transparent transition-all"
                  placeholder="John Doe"
                  required={!isLogin}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[#cbd5e1] mb-2">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#161926] border border-[#2d3148] rounded-xl px-4 py-3 text-white placeholder-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:border-transparent transition-all"
                placeholder="you@company.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#cbd5e1] mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#161926] border border-[#2d3148] rounded-xl px-4 py-3 text-white placeholder-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:border-transparent transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white font-semibold py-3 px-4 rounded-xl transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  {isLogin ? "Sign in" : "Sign up"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="relative my-6 flex items-center justify-center">
              <span className="absolute inset-x-0 h-px bg-[#2d3148]"></span>
              <span className="relative bg-[#0b0d14] px-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">Or continue with</span>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-card border border-[#2d3148] hover:bg-muted text-white font-semibold py-3 px-4 rounded-xl transition-all active:scale-[0.98]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>
          </form>

          <p className="text-center text-sm text-[#94a3b8] mt-8">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(""); }}
              className="text-[#6366f1] hover:text-[#8b5cf6] font-medium transition-colors"
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
