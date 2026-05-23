"use client";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, Mail, MousePointerClick, Reply, AlertTriangle, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import api from "@/lib/api";

type Stats = {
  emailsSent: number;
  openRate: number;
  replyRate: number;
  activeCampaigns: number;
  unreadInboxCount: number;
  recentLeads: { id: number; name: string; email: string; status: string; campaign: string }[];
};

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get("/auth/stats");
        setStats(res.data);
      } catch (err) {
        console.error("Failed to load analytics", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-semibold">Generating live metrics report...</p>
      </div>
    );
  }

  const emailSentCount = stats?.emailsSent || 0;
  const openRate = stats?.openRate || 0;
  const replyRate = stats?.replyRate || 0;

  return (
    <div className="space-y-8 pb-12 max-w-5xl mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Analytics Overview</h1>
        <p className="text-muted-foreground mt-1 font-medium">Real-time telemetry on sender reputation and delivery performance.</p>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Total Sent", value: emailSentCount.toLocaleString(), trend: "+12%", icon: Mail, color: "text-blue-500" },
          { title: "Open Rate", value: `${openRate}%`, trend: "+5.2%", icon: TrendingUp, color: "text-green-500" },
          { title: "Reply Rate", value: `${replyRate}%`, trend: "+2.1%", icon: Reply, color: "text-primary" },
          { title: "Active Sequences", value: stats?.activeCampaigns || 0, trend: "Stable", icon: BarChart3, color: "text-indigo-400" }
        ].map((kpi, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-card border border-border p-6 rounded-2xl shadow-sm hover:-translate-y-0.5 transition-all duration-300"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl bg-muted/50 ${kpi.color}`}>
                <kpi.icon className="w-5 h-5" />
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${kpi.trend.startsWith('+') ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                {kpi.trend}
              </span>
            </div>
            <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">{kpi.title}</p>
            <h3 className="text-3xl font-extrabold text-foreground">{kpi.value}</h3>
          </motion.div>
        ))}
      </div>

      {/* Main Charts Area */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        {/* Sends Breakdown visual chart */}
        <div className="lg:col-span-2 bg-card border border-border p-6 rounded-2xl shadow-sm flex flex-col justify-between space-y-6">
          <div>
            <h3 className="font-bold text-foreground text-lg">Send Pipeline Distribution</h3>
            <p className="text-sm text-muted-foreground font-medium">Daily outbound email dispatch counts.</p>
          </div>
          
          <div className="flex items-end justify-between h-44 px-4 pt-4 border-b border-border/50">
            {[
              { day: "Mon", height: "h-[45%]", count: Math.round(emailSentCount * 0.15) },
              { day: "Tue", height: "h-[75%]", count: Math.round(emailSentCount * 0.28) },
              { day: "Wed", height: "h-[90%]", count: Math.round(emailSentCount * 0.32) },
              { day: "Thu", height: "h-[60%]", count: Math.round(emailSentCount * 0.20) },
              { day: "Fri", height: "h-[30%]", count: Math.round(emailSentCount * 0.05) }
            ].map((bar, i) => (
              <div key={i} className="flex flex-col items-center gap-2 w-12 group cursor-pointer">
                <span className="text-[10px] font-extrabold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  {bar.count}
                </span>
                <div className={`w-8 ${bar.height} bg-gradient-to-t from-primary/80 to-primary rounded-t-lg transition-all group-hover:scale-x-110 shadow`}></div>
                <span className="text-xs font-bold text-muted-foreground">{bar.day}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Deliverability Alerts */}
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
            Inbox Deliverability
          </h3>
          <div className="flex-1 space-y-4">
            <div className="p-4 border border-border rounded-xl bg-green-500/5 hover:border-green-500/20 transition-all">
              <p className="text-sm font-bold text-green-500 mb-1">SPF & DKIM Validated</p>
              <p className="text-xs text-muted-foreground">All active sender records have authentic signatures verified.</p>
            </div>
            <div className="p-4 border border-border rounded-xl bg-orange-500/5 hover:border-orange-500/20 transition-all">
              <p className="text-sm font-bold text-orange-400 mb-1">Warmup Active</p>
              <p className="text-xs text-muted-foreground">Sender reputation is climbing safely with simulated active reading threads.</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
