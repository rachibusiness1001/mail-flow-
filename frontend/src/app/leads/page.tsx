"use client";
import { motion } from "framer-motion";
import { Search, Filter, Download, UserPlus, MoreHorizontal, Mail } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import api from "@/lib/api";

type Lead = {
  id: number;
  email: string;
  name: string;
  company: string;
  status: string;
  campaign: string;
  added: string;
};

export default function LeadsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const response = await api.get('/leads');
        setLeads(response.data.leads);
      } catch (error) {
        console.error("Failed to fetch leads", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLeads();
  }, []);

  const filteredLeads = leads.filter(l => 
    l.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
    l.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <p className="text-muted-foreground mt-1 font-medium">Manage all your contacts and prospects.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-card hover:bg-muted text-foreground border border-border px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
            <Download className="w-5 h-5" />
            Export
          </button>
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
            placeholder="Search leads by email, name, or company..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground h-10 font-medium"
          />
        </div>
        <button className="w-full sm:w-auto bg-card hover:bg-muted text-foreground border border-border px-5 h-14 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors">
          <Filter className="w-5 h-5" />
          Filter
        </button>
      </motion.div>

      {/* Leads Table */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="p-4 pl-6 text-xs font-bold text-muted-foreground uppercase tracking-wider">Contact</th>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Company</th>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Campaign</th>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Added</th>
                <th className="p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredLeads.map((lead, i) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }}
                  key={lead.id} 
                  className="border-b border-border hover:bg-muted/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-foreground/20 cursor-pointer relative z-0 hover:z-10 group"
                >
                  <td className="p-4 pl-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {lead.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{lead.name}</p>
                        <p className="text-sm text-muted-foreground">{lead.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-foreground font-medium">{lead.company}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${
                      lead.status === 'replied' ? 'bg-green-500/10 text-green-500' : 
                      lead.status === 'opened' ? 'bg-blue-500/10 text-blue-500' : 
                      lead.status === 'bounced' ? 'bg-red-500/10 text-red-500' : 
                      lead.status === 'sent' ? 'bg-purple-500/10 text-purple-500' : 
                      'bg-muted text-muted-foreground'
                    }`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="p-4 text-muted-foreground text-sm font-medium">{lead.campaign}</td>
                  <td className="p-4 text-muted-foreground text-sm">{lead.added}</td>
                  <td className="p-4 pr-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="Send Email">
                        <Mail className="w-4 h-4" />
                      </button>
                      <button className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              
              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted-foreground font-medium">
                    No leads found matching "{searchQuery}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination placeholder */}
        <div className="p-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground font-medium bg-muted/10">
          <div>Showing {filteredLeads.length} of 5,234 leads</div>
          <div className="flex gap-2">
            <button className="px-3 py-1 border border-border rounded-lg hover:bg-muted disabled:opacity-50" disabled>Prev</button>
            <button className="px-3 py-1 border border-border rounded-lg hover:bg-muted">Next</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
