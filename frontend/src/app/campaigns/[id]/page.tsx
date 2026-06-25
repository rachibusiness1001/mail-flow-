"use client";
import { motion } from "framer-motion";
import { ArrowLeft, Play, Pause, Trash2, Edit2, Clock, SplitSquareHorizontal, Users, MousePointerClick, Reply, Mail, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import api, { withRetry } from "@/lib/api";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/components/Toast";

type Step = {
  id: number;
  type: string;
  subject: string;
  body: string;
  delay: number;
};

type Campaign = {
  id: number;
  name: string;
  status: string;
  sent: number;
  send_limit?: number;
  failed?: number;
  total_leads?: number;
  pending?: number;
  opens: number;
  replies: number;
  openRate: number;
  replyRate: number;
  subject_a: string;
  body_a: string;
  subject_b?: string;
  body_b?: string;
  ab_enabled?: boolean;
  steps: Step[];
};

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [activeTab, setActiveTab] = useState("sequence");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { addToast } = useToast();

  const fetchCampaign = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/campaigns/${id}`);
      setCampaign(res.data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || "Campaign not found.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaign();
  }, [id]);

  const handleToggleStatus = async () => {
    if (!campaign || actionLoading) return;
    setActionLoading(true);
    try {
      if (campaign.status === "running") {
        await api.post(`/campaigns/${campaign.id}/pause`);
        setCampaign(prev => prev ? { ...prev, status: "paused" } : null);
      } else {
        await withRetry(() => api.post(`/campaigns/${campaign.id}/start`));
        setCampaign(prev => prev ? { ...prev, status: "running" } : null);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to toggle campaign state.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = () => {
    if (!campaign) return;
    setShowDeleteModal(true);
  };

  const confirmDeleteCampaign = async () => {
    if (!campaign) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/campaigns/${campaign.id}`);
      router.push("/campaigns");
    } catch (err) {
      console.error("Failed to delete campaign", err);
      addToast("Failed to delete campaign", "error");
    } finally {
      setDeleteLoading(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-semibold">Loading campaign sequence...</p>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/50 rounded-2xl max-w-xl mx-auto mt-12 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold text-white">Campaign Not Found</h2>
        <p className="text-muted-foreground">{error || "This campaign doesn't exist or was deleted."}</p>
        <Link href="/campaigns" className="inline-block bg-primary px-5 py-2 rounded-xl text-white font-bold">
          Back to Campaigns
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6"
      >
        <div className="flex items-center gap-4">
          <Link href="/campaigns" className="p-2 hover:bg-muted rounded-xl text-muted-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold text-foreground tracking-tight">{campaign.name}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${campaign.status === 'running' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                {campaign.status}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 font-medium">Campaign ID: #{campaign.id}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={handleToggleStatus}
            disabled={actionLoading}
            className={`p-2.5 rounded-xl border border-border transition-all flex items-center justify-center ${campaign.status === "running" ? "text-yellow-500 hover:bg-yellow-500/10" : "text-green-500 hover:bg-green-500/10 bg-green-500/5"}`} 
            title={campaign.status === "running" ? "Pause Sequence" : "Start Sequence"}
          >
            {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              campaign.status === "running" ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />
            )}
          </button>
          <button 
            onClick={handleDelete}
            className="p-2.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors bg-card border border-border" 
            title="Delete Campaign"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <Link 
            href={`/campaigns/create?edit=${campaign.id}`}
            className="bg-primary hover:bg-primary/95 text-white px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition-all hover:scale-105 active:scale-95 ml-2"
          >
            <Edit2 className="w-4 h-4" />
            Edit Campaign
          </Link>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
      >
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-2">Total Leads</p>
          <h3 className="text-3xl font-extrabold text-foreground">{campaign.total_leads?.toLocaleString() || 0}</h3>
        </div>
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-2">Pending</p>
          <h3 className="text-3xl font-extrabold text-yellow-500">{campaign.pending?.toLocaleString() || 0}</h3>
        </div>
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-2">Total Sent</p>
          <h3 className="text-3xl font-extrabold text-green-500">{campaign.sent?.toLocaleString() || 0}</h3>
        </div>
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-2">Send Limit</p>
          <h3 className="text-3xl font-extrabold text-blue-500">{campaign.send_limit && campaign.send_limit > 0 ? campaign.send_limit.toLocaleString() : 'No Limit'}</h3>
        </div>
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-2">Open Rate</p>
          <h3 className="text-3xl font-extrabold text-primary">{campaign.openRate}%</h3>
          <p className="text-xs text-muted-foreground mt-1">{campaign.opens} opens</p>
        </div>
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-2">Reply Rate</p>
          <h3 className="text-3xl font-extrabold text-indigo-400">{campaign.replyRate}%</h3>
          <p className="text-xs text-muted-foreground mt-1">{campaign.replies} replies</p>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="border-b border-border flex gap-8">
        <button 
          onClick={() => setActiveTab("sequence")}
          className={`pb-4 font-bold transition-colors ${activeTab === 'sequence' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Sequence Steps
        </button>
        <button 
          onClick={() => setActiveTab("leads")}
          className={`pb-4 font-bold transition-colors ${activeTab === 'leads' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Campaign Leads
        </button>
      </div>

      {/* Tab Content */}
      <motion.div 
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {activeTab === "sequence" ? (
          <div className="space-y-4 max-w-4xl">
            {campaign.steps.map((step, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-6 shadow-sm flex gap-6 relative">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                    {i + 1}
                  </div>
                  {i !== campaign.steps.length - 1 && (
                    <div className="w-0.5 h-full bg-border"></div>
                  )}
                </div>
                <div className="flex-1">
                  {step.delay > 0 && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-bold mb-4">
                      <Clock className="w-3 h-3" /> Wait {step.delay} days
                    </div>
                  )}
                  <h4 className="font-bold text-foreground text-lg mb-2">{step.subject}</h4>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-3 whitespace-pre-line">{step.body || "(No email body defined)"}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden p-8 text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-bold text-foreground mb-2">Campaign Leads</h3>
            <p className="mb-4">All imported cold outreach prospects mapped to this sequence list.</p>
            <Link href="/leads/upload" className="inline-block bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-bold transition-all mx-auto">
              Add Leads to Campaign
            </Link>
          </div>
        )}
      </motion.div>
      <ConfirmModal
        isOpen={showDeleteModal}
        title="Delete Campaign"
        description="Are you sure you want to delete this campaign? This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        destructive
        isLoading={deleteLoading}
        onConfirm={confirmDeleteCampaign}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
