"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, Users, Activity, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";
import api from "@/lib/api";

type User = {
  id: number;
  name: string;
  email: string;
  plan: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
};

type Stats = {
  totalUsers: number;
  activeAccounts: number;
  emailsSent: number;
};

export default function AdminPage() {
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, activeAccounts: 0, emailsSent: 0 });
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, usersRes] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/users")
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data.users);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to load admin panel data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleUser = async (id: number) => {
    try {
      const res = await api.post(`/admin/users/${id}/toggle`);
      if (res.data.success) {
        setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: res.data.is_active } : u));
        // Refresh stats
        const statsRes = await api.get("/admin/stats");
        setStats(statsRes.data);
      }
    } catch (err) {
      console.error("Failed to toggle user status", err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-semibold">Loading system telemetry...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/50 rounded-2xl max-w-xl mx-auto mt-12 text-center space-y-4">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold text-white">Access Restricted</h2>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 max-w-5xl mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center shadow-lg">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Admin Console</h1>
          <p className="text-muted-foreground mt-1 font-medium">System-wide monitoring and user management.</p>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        {/* Stats */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex items-center gap-4 hover:-translate-y-0.5 transition-all duration-300">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Total Users</p>
            <h2 className="text-3xl font-extrabold text-foreground">{stats.totalUsers}</h2>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex items-center gap-4 hover:-translate-y-0.5 transition-all duration-300">
          <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Connected Accounts</p>
            <h2 className="text-3xl font-extrabold text-foreground">{stats.activeAccounts}</h2>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex items-center gap-4 hover:-translate-y-0.5 transition-all duration-300">
          <div className="w-12 h-12 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Emails Sent</p>
            <h2 className="text-3xl font-extrabold text-foreground">{stats.emailsSent}</h2>
          </div>
        </div>
      </motion.div>

      {/* User Management Table */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden"
      >
        <div className="p-6 border-b border-border bg-muted/30">
          <h3 className="font-bold text-foreground text-lg">Platform Registered Users</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="p-4 pl-6 text-xs font-bold text-muted-foreground uppercase tracking-wider">User</th>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Joined At</th>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Plan</th>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right pr-6">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-muted/50 transition-colors">
                  <td className="p-4 pl-6">
                    <p className="font-bold text-foreground flex items-center gap-2">
                      {u.name || "None"} {u.is_admin && <span className="text-[10px] bg-red-500/20 text-red-500 font-bold px-1.5 py-0.5 rounded">Admin</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </td>
                  <td className="p-4 text-sm font-medium text-muted-foreground">{u.created_at || "N/A"}</td>
                  <td className="p-4 text-sm font-medium text-foreground capitalize">{u.plan || "Free"}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${u.is_active ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                      {u.is_active ? "Active" : "Suspended"}
                    </span>
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <button 
                      onClick={() => handleToggleUser(u.id)}
                      disabled={u.is_admin}
                      className={`transition-colors flex items-center gap-1.5 justify-end ml-auto text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed ${u.is_active ? "text-muted-foreground hover:text-red-500" : "text-green-500 hover:text-green-400"}`}
                    >
                      {u.is_active ? (
                        <>
                          <ToggleLeft className="w-5 h-5 text-red-500" />
                          Suspend
                        </>
                      ) : (
                        <>
                          <ToggleRight className="w-5 h-5 text-green-500" />
                          Activate
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No users registered in the system database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
