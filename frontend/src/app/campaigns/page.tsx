"use client";
import { motion } from "framer-motion";
import { Plus, Search, MoreHorizontal, Play, Pause, FileEdit, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import api from "@/lib/api";

type Campaign = {
  id: number;
  name: string;
  status: string;
  sent: number;
  openRate: number;
  replyRate: number;
  lastActive: string;
};

export default function CampaignsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const response = await api.get('/campaigns');
        setCampaigns(response.data.campaigns);
      } catch (error) {
        console.error("Failed to fetch campaigns", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCampaigns();
  }, []);

  const filteredCampaigns = campaigns.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-8 pb-12">
      {/* Header section */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground mt-1 font-medium">Create and manage your outreach sequences.</p>
        </div>
        <Link href="/campaigns/create" className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition-all hover:scale-105 active:scale-95">
          <Plus className="w-5 h-5" />
          New Campaign
        </Link>
      </motion.div>
      
      {/* Search and Filters */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-4 bg-card border border-border p-2 rounded-2xl shadow-sm"
      >
        <div className="flex-1 flex items-center gap-3 px-3">
          <Search className="w-5 h-5 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search campaigns..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground h-10 font-medium"
          />
        </div>
      </motion.div>

      {/* Campaigns List */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 gap-4"
      >
        {filteredCampaigns.map((campaign, i) => (
          <Link href={`/campaigns/${campaign.id}`} key={campaign.id} className="block">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i }}
              className="bg-card border border-border hover:border-primary/50 transition-all rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 group cursor-pointer"
            >
              {/* Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{campaign.name}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${
                    campaign.status === 'running' ? 'bg-green-500/10 text-green-500' : 
                    campaign.status === 'paused' ? 'bg-yellow-500/10 text-yellow-500' : 
                    'bg-muted text-muted-foreground'
                  }`}>
                    {campaign.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground font-medium">Last active: {campaign.lastActive}</p>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-8 md:gap-12 w-full md:w-auto">
                <div>
                  <p className="text-xs text-muted-foreground font-bold mb-1 uppercase tracking-wider">Sent</p>
                  <p className="font-bold text-foreground">{campaign.sent.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-bold mb-1 uppercase tracking-wider">Open Rate</p>
                  <p className="font-bold text-foreground">{campaign.openRate}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-bold mb-1 uppercase tracking-wider">Reply Rate</p>
                  <p className="font-bold text-foreground">{campaign.replyRate}%</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-4 md:pt-0 border-t md:border-none border-border w-full md:w-auto justify-end">
                {campaign.status === 'running' ? (
                  <button className="p-2 text-muted-foreground hover:text-yellow-500 hover:bg-yellow-500/10 rounded-xl transition-colors" title="Pause" onClick={(e) => e.preventDefault()}>
                    <Pause className="w-5 h-5" />
                  </button>
                ) : (
                  <button className="p-2 text-muted-foreground hover:text-green-500 hover:bg-green-500/10 rounded-xl transition-colors" title="Start" onClick={(e) => e.preventDefault()}>
                    <Play className="w-5 h-5" />
                  </button>
                )}
                <button className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-colors" title="Edit" onClick={(e) => e.preventDefault()}>
                  <FileEdit className="w-5 h-5" />
                </button>
                <button className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors" title="Delete" onClick={(e) => e.preventDefault()}>
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </Link>
        ))}

        {filteredCampaigns.length === 0 && (
          <div className="py-12 text-center text-muted-foreground bg-card border border-dashed border-border rounded-2xl">
            No campaigns found matching "{searchQuery}"
          </div>
        )}
      </motion.div>
    </div>
  );
}
