"use client";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, Users, Building, Shield, ArrowUpRight, X, Loader2, Plus, AlertCircle, KeyRound, User } from "lucide-react";
import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type TeamMember = {
  id: number;
  user_id: number;
  name: string;
  email: string;
  role: string;
  joined_at: string;
};

type WorkspaceDetails = {
  id: number;
  name: string;
  plan: string;
  role: string;
  billing_status: string;
  force_pause: boolean;
};

export default function SettingsPage() {
  const { user } = useAuth();
  
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [activeWsId, setActiveWsId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceDetails | null>(null);
  const [togglingPause, setTogglingPause] = useState(false);

  // Invite states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);

  // Profile update states
  const [fullName, setFullName] = useState("");
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Password update states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const fetchWorkspaceData = async (wsId: string) => {
    try {
      setLoadingMembers(true);
      const [membersRes, workspaceRes] = await Promise.all([
        api.get(`/workspaces/${wsId}/members`),
        api.get(`/workspaces/${wsId}`)
      ]);
      setMembers(membersRes.data);
      setWorkspace(workspaceRes.data);
    } catch (err) {
      console.error("Failed to fetch workspace data", err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleToggleForcePause = async () => {
    if (!activeWsId || !workspace || togglingPause) return;
    try {
      setTogglingPause(true);
      const res = await api.post(`/workspaces/${activeWsId}/force_pause`, {
        force_pause: !workspace.force_pause
      });
      setWorkspace({ ...workspace, force_pause: res.data.force_pause });
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to toggle global force pause.");
    } finally {
      setTogglingPause(false);
    }
  };

  useEffect(() => {
    if (user?.name) {
      setFullName(user.name);
    }
    if (typeof window !== "undefined") {
      const wsId = localStorage.getItem("active_workspace_id");
      setActiveWsId(wsId);
      if (wsId) {
        fetchWorkspaceData(wsId);
      }
    }
  }, [user]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWsId || !inviteEmail.trim() || inviting) return;
    try {
      setInviting(true);
      const res = await api.post(`/workspaces/${activeWsId}/members`, {
        email: inviteEmail.trim(),
        role: inviteRole
      });
      alert(res.data.message || "Invitation sent successfully!");
      setShowInviteModal(false);
      setInviteEmail("");
      // Refresh list
      fetchWorkspaceData(activeWsId);
    } catch (err: any) {
      alert(err.response?.data?.error || "Invitation failed. Verify email and roles.");
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || updatingProfile) return;
    try {
      setUpdatingProfile(true);
      await api.post("/auth/profile/update-info", { name: fullName.trim() });
      alert("Profile name updated successfully!");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to update profile info.");
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || updatingPassword) return;
    try {
      setUpdatingPassword(true);
      await api.post("/auth/profile/change-password", {
        current_password: currentPassword,
        new_password: newPassword
      });
      alert("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to change password.");
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleManageBilling = async () => {
    if (!activeWsId) return;
    try {
      // Connects to checkout endpoint, mock redirecting to stripe success URL for sandbox local testing
      const res = await api.post("/billing/checkout", {
        plan_id: "price_mock_pro",
        workspace_id: parseInt(activeWsId)
      });
      if (res.data.url) {
        window.open(res.data.url, '_blank');
      } else {
        alert("Billing checkout initialized successfully.");
      }
    } catch (err: any) {
      alert(err.response?.data?.error || "Billing connection failed.");
    }
  };

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto relative">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between border-b border-border/50 pb-6"
      >
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Workspace Settings</h1>
          <p className="text-muted-foreground mt-1 font-medium">
            Manage your project context: <span className="text-primary font-bold">{workspace?.name || "Active Project"}</span>.
          </p>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid gap-8"
      >
        {/* Billing Section */}
        <section className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-border">
            <div className="p-3 bg-primary/10 text-primary rounded-xl">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Billing & Subscription</h2>
              <p className="text-sm text-muted-foreground">Manage your payment plans and cycles.</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 bg-gradient-to-r from-muted/50 to-transparent border border-border rounded-2xl mb-6">
            <div>
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Current Workspace Plan</p>
              <h3 className="text-2xl font-extrabold text-foreground flex items-center gap-2 capitalize">
                MailFlow {workspace?.plan || "Free"} <span className="text-sm font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">$99/mo</span>
              </h3>
              <p className="text-sm text-muted-foreground mt-2">Billing status: <span className="font-bold text-primary capitalize">{workspace?.billing_status || "Active"}</span></p>
            </div>
            <button 
              onClick={handleManageBilling}
              className="mt-4 sm:mt-0 bg-foreground text-background hover:opacity-90 px-5 py-2.5 rounded-xl font-bold transition-all active:scale-95 flex items-center gap-1.5"
            >
              Upgrade Plan <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* Team Section */}
        <section className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Workspace Team Members</h2>
                <p className="text-sm text-muted-foreground">Invite colleagues to access project outreach datasets.</p>
              </div>
            </div>
            {workspace?.role !== 'member' && (
              <button 
                onClick={() => setShowInviteModal(true)}
                className="bg-primary hover:bg-primary/95 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow"
              >
                <Plus className="w-4 h-4" /> Invite Member
              </button>
            )}
          </div>
          
          <div className="space-y-3">
            {loadingMembers ? (
              <div className="flex items-center justify-center p-8 gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Loading team list...</span>
              </div>
            ) : (
              members.map((member) => (
                <div key={member.id} className="flex justify-between items-center p-4 border border-border rounded-xl bg-background hover:border-primary/20 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold">
                      {member.name ? member.name.charAt(0).toUpperCase() : member.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{member.name || "Pending Account"}</p>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                  <span className="bg-muted px-3 py-1 rounded-full text-xs font-bold text-foreground capitalize">{member.role}</span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* System Controls Section */}
        <section className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-red-500/20">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-500/10 text-red-500 rounded-xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Global System Controls</h2>
                <p className="text-sm text-muted-foreground">Emergency actions to pause all outgoing emails across the workspace.</p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 bg-background/50 border border-border rounded-xl">
            <div>
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                Global Force Pause
                {workspace?.force_pause && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">ACTIVE</span>}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-lg">
                Instantly freeze all outgoing campaigns and follow-ups. Useful if your email accounts hit sending limits or you need to halt operations immediately.
              </p>
            </div>
            <button 
              onClick={handleToggleForcePause}
              disabled={togglingPause}
              className={`mt-4 sm:mt-0 px-6 py-2.5 rounded-xl font-bold transition-all active:scale-95 flex items-center gap-2 ${
                workspace?.force_pause 
                  ? 'bg-green-500 hover:bg-green-600 text-white' 
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
            >
              {togglingPause ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {workspace?.force_pause ? 'Resume All Systems' : 'Force Pause Everything'}
            </button>
          </div>
        </section>

        {/* Profile & Security Section */}
        <section className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-border">
            <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Profile & Password Security</h2>
              <p className="text-sm text-muted-foreground">Update your identity profile settings.</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <form onSubmit={handleUpdateProfile} className="space-y-2">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Full Identity Name</label>
              <div className="flex gap-4">
                <input 
                  type="text" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none text-foreground font-semibold" 
                />
                <button 
                  type="submit"
                  disabled={updatingProfile || !fullName.trim()}
                  className="bg-muted hover:bg-muted/80 text-foreground px-6 font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {updatingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />}
                  Update
                </button>
              </div>
            </form>
            
            <form onSubmit={handleChangePassword} className="space-y-3 pt-4 border-t border-border/50">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Modify System Password</label>
              <div className="flex flex-col gap-3">
                <input 
                  type="password" 
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password" 
                  className="w-full lg:w-1/2 bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none text-foreground font-semibold" 
                  required
                />
                <div className="flex gap-4">
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (minimum 8 characters)" 
                    className="flex-1 lg:flex-none lg:w-1/2 bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none text-foreground font-semibold" 
                    required
                  />
                  <button 
                    type="submit"
                    disabled={updatingPassword || !currentPassword || newPassword.length < 8}
                    className="bg-primary hover:bg-primary/95 text-white px-6 font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {updatingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    Save Password
                  </button>
                </div>
              </div>
            </form>
          </div>
        </section>
      </motion.div>

      {/* Invite Member Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-3xl w-full max-w-md shadow-xl overflow-hidden"
            >
              <div className="p-6 border-b border-border/50 flex justify-between items-center bg-muted/20">
                <h3 className="font-extrabold text-foreground text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary animate-pulse" />
                  Invite Workspace Colleague
                </h3>
                <button onClick={() => setShowInviteModal(false)} className="p-1.5 hover:bg-muted rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleInvite} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Invite Email Address</label>
                  <input 
                    type="email" 
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary text-foreground font-semibold"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Workspace Role</label>
                  <select 
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary text-foreground font-semibold"
                  >
                    <option value="member">Standard Workspace Member</option>
                    <option value="admin">Workspace Admin</option>
                  </select>
                </div>
                
                <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                  <button 
                    type="button" 
                    onClick={() => setShowInviteModal(false)}
                    className="px-5 py-2 rounded-xl font-bold text-muted-foreground hover:bg-muted transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={inviting || !inviteEmail.trim()}
                    className="bg-primary hover:bg-primary/95 text-white px-6 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-1.5"
                  >
                    {inviting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Inviting...
                      </>
                    ) : (
                      "Send Invitation"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
