"use client";
import { motion } from "framer-motion";
import { Search, Filter, Download, UserPlus, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import api from "@/lib/api";
import LeadsLock from "@/components/LeadsLock";
import LeadsFilesList from "@/components/LeadsFilesList";

type Upload = {
  id: number;
  filename: string;
  total: number;
  invalid: number;
  valid: number;
  uploaded_at: string;
  campaign_id: number | null;
  campaign: string;
};

export default function LeadsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // First, fetch campaigns to check if user has any
        const campaignsResponse = await api.get('/campaigns');
        setCampaigns(campaignsResponse.data.campaigns || []);
        
        // If user has campaigns, fetch uploads
        if (campaignsResponse.data.campaigns && campaignsResponse.data.campaigns.length > 0) {
          const uploadsResponse = await api.get('/leads/uploads');
          setUploads(uploadsResponse.data.uploads);
        }
      } catch (error) {
        console.error("Failed to fetch data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // If no campaigns exist, show lock UI
  if (!loading && campaigns.length === 0) {
    return <LeadsLock />;
  }

  const filteredUploads = uploads.filter(u =>
    u.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.campaign.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExport = async (uploadId: number) => {
    try {
      // Generate CSV export
      const response = await api.get(`/leads/uploads/${uploadId}/export`);
      const leads = response.data.leads;
      
      // Create CSV content
      const csvContent = [
        ['Name', 'Email', 'Company', 'Status', 'Campaign'],
        ...leads.map((lead: any) => [
          lead.name || '',
          lead.email || '',
          lead.company || '',
          lead.status || '',
          lead.campaign || ''
        ])
       ].map((row: string[]) => row.map((cell: string) => `"${cell}"`).join(','))
        .join('\n');
      
      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `leads_${uploadId}.csv`);
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export", error);
      alert("Failed to export leads");
    }
  };

  const handleUploadDeleted = (uploadId: number) => {
    setUploads(prev => prev.filter(u => u.id !== uploadId));
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header section */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Leads Database</h1>
          <p className="text-muted-foreground mt-1 font-medium">View and manage uploaded lead files by campaign.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/leads/upload" className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition-all hover:scale-105 active:scale-95">
            <UserPlus className="w-5 h-5" />
            Import Leads
          </Link>
        </div>
      </motion.div>
      
      {/* Search and Filters */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row items-center gap-4"
      >
        <div className="flex-1 flex items-center gap-3 bg-card border border-border p-2 rounded-2xl shadow-sm px-4 w-full">
          <Search className="w-5 h-5 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search by filename or campaign..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground h-10 font-medium"
          />
        </div>
      </motion.div>

      {/* Files List */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-2xl shadow-sm p-6"
      >
        {loading ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>Loading uploads...</span>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">Uploaded Files</h3>
              <span className="text-sm text-muted-foreground">
                {filteredUploads.length} {filteredUploads.length === 1 ? 'file' : 'files'} • {uploads.reduce((sum, u) => sum + u.total, 0)} total leads
              </span>
            </div>
            <LeadsFilesList 
              uploads={filteredUploads}
              onUploadDeleted={handleUploadDeleted}
              onExport={handleExport}
            />
          </>
        )}
      </motion.div>

      {/* Stats Section */}
      {!loading && uploads.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
            <p className="text-sm text-muted-foreground font-semibold">Total Leads</p>
            <p className="text-2xl font-extrabold text-foreground">{uploads.reduce((sum, u) => sum + u.total, 0)}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
            <p className="text-sm text-muted-foreground font-semibold">Valid Leads</p>
            <p className="text-2xl font-extrabold text-green-500">{uploads.reduce((sum, u) => sum + u.valid, 0)}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
            <p className="text-sm text-muted-foreground font-semibold">Invalid/Duplicates</p>
            <p className="text-2xl font-extrabold text-yellow-500">{uploads.reduce((sum, u) => sum + u.invalid, 0)}</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
