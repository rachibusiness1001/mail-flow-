"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Plus, Flame, Power, Trash2, Loader2, AlertCircle, X, ShieldAlert, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import api from "@/lib/api";

type EmailAccount = {
  id: number;
  name: string;
  email: string;
  smtp_host: string;
  smtp_port: number;
  imap_host: string;
  auth_type: string;
  daily_limit: number;
  sent_today: number;
  is_active: boolean;
  warmup_enabled: boolean;
  warmup_day: number;
  warmup_limit: number;
};

export default function EmailAccountsPage() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState(587);
  const [imapHost, setImapHost] = useState("imap.gmail.com");
  const [dailyLimit, setDailyLimit] = useState(50);
  const [modalLoading, setModalLoading] = useState(false);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await api.get("/email-accounts");
      setAccounts(res.data);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load connected email senders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
    
    // Check URL parameters for OAuth success/errors
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("success") === "true") {
        alert("Gmail account successfully connected via Google OAuth!");
        // Clean URL params
        window.history.replaceState({}, document.title, window.location.pathname);
        fetchAccounts();
      } else if (params.get("error")) {
        alert(`OAuth connection failed: ${params.get("error")}`);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const handleToggleWarmup = async (id: number) => {
    try {
      const res = await api.post(`/email-accounts/${id}/toggle-warmup`);
      if (res.data.success) {
        setAccounts(prev => prev.map(a => a.id === id ? { ...a, warmup_enabled: res.data.warmup_enabled } : a));
      }
    } catch (err) {
      console.error("Failed to toggle warmup", err);
    }
  };

  const handleDeleteAccount = async (id: number) => {
    if (!confirm("Are you sure you want to remove this email account? This will halt all active campaigns using it.")) return;
    try {
      await api.delete(`/email-accounts/${id}`);
      setAccounts(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      alert("Failed to remove email sender");
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    try {
      await api.post("/email-accounts", {
        name,
        email,
        password,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        imap_host: imapHost,
        daily_limit: dailyLimit
      });
      setShowModal(false);
      
      // Reset form
      setName("");
      setEmail("");
      setPassword("");
      setSmtpHost("smtp.gmail.com");
      setSmtpPort(587);
      setImapHost("imap.gmail.com");
      setDailyLimit(50);
      
      fetchAccounts();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to add email connection. Please verify credentials.");
    } finally {
      setModalLoading(false);
    }
  };

  const getOAuthUrl = () => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token");
      return `http://localhost:5000/accounts/google/connect?token=${token}`;
    }
    return "#";
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-semibold">Loading sending channels...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 max-w-5xl mx-auto relative">
      
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-end border-b border-border/50 pb-6"
      >
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Sender Channels</h1>
          <p className="text-muted-foreground mt-1 font-medium">Connect SMTP/IMAP senders or Gmail OAuth to warm up delivery channels.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-primary hover:bg-primary/95 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all hover:scale-105 active:scale-95"
        >
          <Plus className="w-5 h-5" /> Add Account
        </button>
      </motion.div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-500 text-sm font-bold rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 gap-4"
      >
        {accounts.map(acc => (
          <div key={acc.id} className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 hover:border-primary/20 transition-all duration-300">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center shadow-inner">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-lg">{acc.email}</h3>
                <p className="text-sm text-muted-foreground flex items-center gap-2 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span> 
                  Connected via {acc.auth_type === 'oauth' ? 'Google OAuth' : 'SMTP/IMAP'} ({acc.name})
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-between md:justify-end gap-8 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 border-border/50">
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Warmup</span>
                <button 
                  onClick={() => handleToggleWarmup(acc.id)}
                  className={`flex items-center gap-1.5 text-xs font-extrabold px-3 py-1 rounded-full border transition-all ${acc.warmup_enabled ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-muted text-muted-foreground border-transparent hover:text-foreground'}`}
                >
                  <Flame className="w-3.5 h-3.5" /> 
                  {acc.warmup_enabled ? "Warmup 🔥" : "Inactive"}
                </button>
              </div>
              
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Limit</span>
                <span className="text-sm font-extrabold text-foreground">{acc.sent_today} / {acc.daily_limit}</span>
              </div>
              
              <div className="flex items-center gap-2 pl-4 border-l border-border/50">
                <button 
                  onClick={() => handleToggleWarmup(acc.id)}
                  className={`p-2 rounded-xl transition-colors ${acc.warmup_enabled ? 'text-orange-500 hover:bg-orange-500/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                  title={acc.warmup_enabled ? "Pause Warmup" : "Resume Warmup"}
                >
                  <Power className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => handleDeleteAccount(acc.id)}
                  className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors" 
                  title="Remove Account"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {accounts.length === 0 && (
          <div className="text-center p-12 border-2 border-dashed border-border rounded-2xl text-muted-foreground">
            <Mail className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <h3 className="font-bold text-foreground text-lg mb-1">No Connected Email Channels</h3>
            <p className="max-w-xs mx-auto mb-6 text-sm">Please link your Gmail or SMTP accounts to start sending sequence pipelines.</p>
            <button 
              onClick={() => setShowModal(true)}
              className="bg-primary hover:bg-primary/95 text-white px-5 py-2.5 rounded-xl font-bold"
            >
              Connect Email Sender
            </button>
          </div>
        )}
      </motion.div>

      {/* Connection Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-3xl w-full max-w-lg shadow-xl overflow-hidden"
            >
              <div className="p-6 border-b border-border/50 flex justify-between items-center bg-muted/20">
                <h3 className="font-extrabold text-foreground text-xl flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Connect Sending Account
                </h3>
                <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-muted rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Gmail OAuth redirection */}
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl flex flex-col items-center justify-center text-center space-y-3">
                  <h4 className="font-bold text-foreground">Connect with Google Account</h4>
                  <p className="text-xs text-muted-foreground max-w-sm">The safest, fastest way to link Google Workspace or personal Gmail senders using OAuth redirection.</p>
                  <a
                    href={getOAuthUrl()}
                    className="bg-primary hover:bg-primary/95 text-white px-5 py-2 rounded-xl font-bold text-sm inline-flex items-center gap-2 transition-transform active:scale-98 shadow"
                  >
                    Connect Gmail via Google
                  </a>
                </div>

                <div className="relative flex items-center justify-center">
                  <span className="absolute inset-x-0 h-px bg-[#2d3148]"></span>
                  <span className="relative bg-[#0b0d14] px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Or connect via SMTP</span>
                </div>

                <form onSubmit={handleAddAccount} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Sender Name</label>
                      <input 
                        type="text" 
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Rachit Srivastava"
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary text-foreground"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Email Address</label>
                      <input 
                        type="email" 
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="rachit@company.com"
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary text-foreground"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">App Password / Auth Token</label>
                    <input 
                      type="password" 
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••••••"
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary text-foreground"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1 col-span-2">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">SMTP Server</label>
                      <input 
                        type="text" 
                        required
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary text-foreground"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">SMTP Port</label>
                      <input 
                        type="number" 
                        required
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(parseInt(e.target.value))}
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary text-foreground"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">IMAP Server</label>
                      <input 
                        type="text" 
                        required
                        value={imapHost}
                        onChange={(e) => setImapHost(e.target.value)}
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary text-foreground"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Daily Sent Limit</label>
                      <input 
                        type="number" 
                        required
                        value={dailyLimit}
                        onChange={(e) => setDailyLimit(parseInt(e.target.value))}
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary text-foreground"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                    <button 
                      type="button" 
                      onClick={() => setShowModal(false)}
                      className="px-5 py-2 rounded-xl font-bold text-muted-foreground hover:bg-muted transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={modalLoading}
                      className="bg-primary hover:bg-primary/95 text-white px-6 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-1.5"
                    >
                      {modalLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Testing Connection...
                        </>
                      ) : (
                        "Save SMTP Connection"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
