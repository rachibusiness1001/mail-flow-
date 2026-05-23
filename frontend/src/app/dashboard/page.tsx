"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type Lead = {
  id: number;
  name: string;
  email: string;
  status: string;
  campaign: string;
};

type Stats = {
  emailsSent: number;
  openRate: number;
  replyRate: number;
  activeCampaigns: number;
  unreadInboxCount: number;
  recentLeads: Lead[];
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await api.get("/auth/stats");
      setStats(res.data);
    } catch (err) {
      console.error("Failed to fetch dashboard stats", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-indigo-500/10 border-t-indigo-500 animate-spin"></div>
          <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
            ⚡
          </div>
        </div>
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading live workspace metrics...</p>
      </div>
    );
  }

  const emailsSent = stats?.emailsSent ?? 0;
  const openRate = stats?.openRate ?? 0;
  const replyRate = stats?.replyRate ?? 0;
  const activeCampaigns = stats?.activeCampaigns ?? 0;
  const unreadInboxCount = stats?.unreadInboxCount ?? 0;
  const recentLeads = stats?.recentLeads ?? [];

  return (
    <div className="space-y-8 pb-12 w-full max-w-5xl mx-auto">
      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-[28px] font-bold text-foreground tracking-tight">
            Welcome back, {user?.name || "Rachit"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Measure your campaign performance, replies, and meetings for this week.
          </p>
        </div>
        
        <div className="flex gap-3 items-center self-start md:self-auto">
          <button 
            onClick={handleRefresh}
            className="flex items-center justify-center p-2.5 border border-border/50 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all active:scale-95"
            title="Refresh stats"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-500' : ''}`} />
          </button>
          
          <div className="flex bg-muted/30 rounded-xl p-1 border border-border/50">
            {["30 days", "7 days", "24 hours"].map((t, i) => (
              <button key={t} className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${i === 1 ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Top Metrics Grid */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        {/* Metric 1 */}
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-500/20 transition-all duration-300 cursor-pointer group">
          <h2 className="text-[32px] font-bold text-foreground leading-none mb-4 group-hover:text-indigo-400 transition-colors">
            {emailsSent.toLocaleString()}
          </h2>
          <p className="text-sm font-medium text-muted-foreground">Emails sent</p>
        </div>

        {/* Metric 2 */}
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/5 hover:border-emerald-500/20 transition-all duration-300 cursor-pointer group">
          <h2 className="text-[32px] font-bold text-foreground leading-none mb-4 group-hover:text-emerald-400 transition-colors">
            {openRate}%
          </h2>
          <p className="text-sm font-medium text-muted-foreground">Open rate</p>
        </div>

        {/* Metric 3 */}
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/5 hover:border-violet-500/20 transition-all duration-300 cursor-pointer group">
          <h2 className="text-[32px] font-bold text-foreground leading-none mb-4 group-hover:text-violet-400 transition-colors">
            {replyRate}%
          </h2>
          <p className="text-sm font-medium text-muted-foreground">Reply rate</p>
        </div>
        
        {/* Metric 4 */}
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-500/5 hover:border-orange-500/20 transition-all duration-300 cursor-pointer group">
          <h2 className="text-[32px] font-bold text-foreground leading-none mb-4 group-hover:text-orange-400 transition-colors">
            {activeCampaigns}
          </h2>
          <p className="text-sm font-medium text-muted-foreground">Active campaigns</p>
        </div>
      </motion.div>

      {/* Middle Section */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
      >
        {/* Inbox overview */}
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm hover:-translate-y-1 hover:shadow-xl hover:shadow-pink-500/5 hover:border-pink-500/20 transition-all duration-300 cursor-pointer group flex flex-col justify-between min-h-[160px]">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-pink-500 uppercase tracking-widest bg-pink-500/10 px-2 py-0.5 rounded">Inbox Status</span>
              <span className="text-xl">📬</span>
            </div>
            <h3 className="text-lg font-bold text-foreground mt-2">Inbox Action Required</h3>
            <p className="text-xs text-muted-foreground mt-1">You have {unreadInboxCount} unread replies waiting for your response.</p>
          </div>
          <div className="text-xs font-bold text-pink-400 group-hover:translate-x-1 transition-transform self-end mt-4">
            Go to Inbox →
          </div>
        </div>

        {/* Campaign Health */}
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-500/20 transition-all duration-300 cursor-pointer group flex flex-col justify-between min-h-[160px]">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded">Workspace</span>
              <span className="text-xl">✨</span>
            </div>
            <h3 className="text-lg font-bold text-foreground mt-2">SaaS Plan Level</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Active plan: <span className="font-bold text-foreground uppercase">{user?.plan || "Pro"}</span>. Enjoy unlimited active campaigns.
            </p>
          </div>
          <div className="text-xs font-bold text-indigo-400 group-hover:translate-x-1 transition-transform self-end mt-4">
            Manage Billing →
          </div>
        </div>

        {/* Quick Tips */}
        <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/5 hover:border-emerald-500/20 transition-all duration-300 cursor-pointer group flex flex-col justify-between min-h-[160px]">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded">AI Suggestion</span>
              <span className="text-xl">💡</span>
            </div>
            <h3 className="text-lg font-bold text-foreground mt-2">Increase Open Rates</h3>
            <p className="text-xs text-muted-foreground mt-1">Enable A/B testing on your outreach campaigns to find the best subject lines.</p>
          </div>
          <div className="text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform self-end mt-4">
            A/B Outreach →
          </div>
        </div>
      </motion.div>

      {/* Suggested Reviews Table */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-8"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-foreground">Recent Leads Activity</h3>
            <p className="text-[11px] text-muted-foreground">The most recent prospective customers added to your outreach funnel</p>
          </div>
        </div>
        
        <div className="space-y-3">
          {recentLeads.length > 0 ? (
            recentLeads.map((lead) => (
              <div 
                key={lead.id}
                className="flex items-center justify-between p-4 bg-card/40 border border-border/50 hover:bg-card hover:-translate-y-0.5 hover:shadow-md hover:border-indigo-500/20 rounded-xl transition-all duration-300 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xs font-bold">
                    {lead.name ? lead.name.charAt(0).toUpperCase() : lead.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground">{lead.name || "Unnamed Lead"}</span>
                    <span className="text-xs text-muted-foreground">{lead.email}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <span className="text-xs font-medium text-muted-foreground">
                    Campaign: <span className="text-foreground font-semibold">{lead.campaign}</span>
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    lead.status === 'replied' ? 'bg-emerald-500/10 text-emerald-500' :
                    lead.status === 'opened' ? 'bg-blue-500/10 text-blue-500' :
                    'bg-amber-500/10 text-amber-500'
                  }`}>
                    {lead.status}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center p-8 bg-card/20 border border-border/50 border-dashed rounded-xl">
              <span className="text-2xl mb-2">👤</span>
              <p className="text-xs font-medium text-muted-foreground">No recent leads found.</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">Upload a CSV inside Campaigns to start tracking leads.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
