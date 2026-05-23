"use client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";
import { FolderOpen, FileText, UploadCloud, Trash2, Copy, Download, Search, HardDrive, Check, Loader2 } from "lucide-react";
import { useState } from "react";

type AssetFile = {
  id: string;
  name: string;
  size: string;
  type: "document" | "leads" | "image";
  uploadedAt: string;
  downloads: number;
};

const initialFiles: AssetFile[] = [
  {
    id: "1",
    name: "Enterprise_SaaS_Pitch_Deck.pdf",
    size: "4.8 MB",
    type: "document",
    uploadedAt: "May 15, 2026",
    downloads: 12,
  },
  {
    id: "2",
    name: "Inbound_Leads_May_Clean.csv",
    size: "142 KB",
    type: "leads",
    uploadedAt: "May 16, 2026",
    downloads: 4,
  },
  {
    id: "3",
    name: "mailflow_logo_banner.webp",
    size: "820 KB",
    type: "image",
    uploadedAt: "May 10, 2026",
    downloads: 32,
  },
  {
    id: "4",
    name: "Case_Study_Fintech_Outreach.pdf",
    size: "2.1 MB",
    type: "document",
    uploadedAt: "May 12, 2026",
    downloads: 8,
  }
];

export default function FilesPage() {
  const [files, setFiles] = useState<AssetFile[]>(initialFiles);
  const [activeTab, setActiveTab] = useState<"all" | "document" | "leads" | "image">("all");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setUploading(true);
    
    // Simulate premium upload progress
    setTimeout(() => {
      const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
      const isCSV = file.name.endsWith(".csv") || file.name.endsWith(".xlsx");
      const isImg = file.type.startsWith("image/");
      
      const newFile: AssetFile = {
        id: Math.random().toString(36).substring(2, 9),
        name: file.name,
        size: `${sizeInMB} MB`,
        type: isCSV ? "leads" : isImg ? "image" : "document",
        uploadedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        downloads: 0
      };

      setFiles(prev => [newFile, ...prev]);
      setUploading(false);
    }, 1500);
  };

  const handleDelete = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleCopyLink = (id: string) => {
    setCopiedId(id);
    navigator.clipboard.writeText(`https://api.mailflow.io/assets/${id}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredFiles = files.filter(f => {
    const matchesTab = activeTab === "all" || f.type === activeTab;
    const matchesSearch = f.name.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const getStorageUsed = () => {
    return "7.8 MB";
  };

  return (
    <DashboardLayout>
      <div className="pb-12 space-y-6 max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-border/50">
          <div>
            <span className="text-xs font-bold text-primary uppercase tracking-widest">Central Vault</span>
            <h1 className="text-3xl font-extrabold text-foreground tracking-tight mt-1">Asset & File Manager</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Store and attach PDF brochures, pitch decks, case studies, or lead CSV imports for your outreach campaigns.
            </p>
          </div>
          
          {/* Storage Progress indicator */}
          <div className="bg-card border border-border p-4 rounded-2xl flex items-center gap-4 shadow-sm w-full md:w-auto">
            <div className="p-3 bg-primary/10 rounded-xl">
              <HardDrive className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-foreground">
                <span>Vault Storage</span>
                <span>{getStorageUsed()} / 100 MB</span>
              </div>
              <div className="w-40 h-1.5 bg-muted rounded-full overflow-hidden mt-1.5">
                <div className="h-full bg-primary rounded-full w-[8%]"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Left Column: Drag & Drop upload */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden group min-h-[220px]">
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              
              {uploading ? (
                <div className="space-y-3">
                  <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
                  <span className="text-sm font-bold text-foreground block">Uploading to vault...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary group-hover:scale-110 transition-transform duration-300">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-foreground block">Upload sales asset</span>
                    <span className="text-xs text-muted-foreground mt-1 block">Drag and drop file, or browse from local</span>
                  </div>
                  <label className="inline-block bg-primary hover:bg-primary/95 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer shadow-md transition-all active:scale-95">
                    Choose File
                    <input 
                      type="file" 
                      onChange={handleUpload}
                      className="hidden" 
                      accept=".pdf,.csv,.xlsx,.webp,.png,.jpg,.jpeg"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Quick helper note */}
            <div className="bg-muted/30 border border-border/50 p-4 rounded-xl text-xs text-muted-foreground leading-relaxed">
              <strong>💡 Campaign Integration:</strong> All files uploaded to the Vault are automatically indexable inside email sequence bodies using the attachment icon.
            </div>
          </div>

          {/* Right Column: Files listing */}
          <div className="lg:col-span-3 space-y-4">
            
            {/* Filter and Search controls */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-card border border-border p-3 rounded-2xl shadow-sm">
              <div className="flex gap-1 bg-muted p-1 rounded-xl w-full sm:w-auto">
                {(["all", "document", "leads", "image"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${activeTab === tab ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {tab === "all" ? "All Files" : tab === "leads" ? "Lead Lists" : tab + "s"}
                  </button>
                ))}
              </div>

              {/* Search bar */}
              <div className="flex items-center gap-2 bg-muted border border-border px-3 py-2 rounded-xl w-full sm:w-64">
                <Search className="w-4 h-4 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Search vault..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs font-medium text-foreground w-full"
                />
              </div>
            </div>

            {/* Files Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence>
                {filteredFiles.map(file => (
                  <motion.div
                    key={file.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-card border border-border rounded-2xl p-4 flex gap-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 relative group"
                  >
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
                      file.type === "leads" ? "bg-emerald-500/10 text-emerald-500" :
                      file.type === "image" ? "bg-rose-500/10 text-rose-500" : "bg-blue-500/10 text-blue-500"
                    }`}>
                      {file.type === "leads" ? "📈" : file.type === "image" ? "🖼️" : "📄"}
                    </div>

                    {/* Metadata */}
                    <div className="flex-1 overflow-hidden">
                      <h3 className="text-sm font-bold text-foreground truncate" title={file.name}>
                        {file.name}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span>{file.size}</span>
                        <span>•</span>
                        <span>{file.uploadedAt}</span>
                      </div>
                    </div>

                    {/* Actions Panel */}
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <button
                        onClick={() => handleCopyLink(file.id)}
                        title="Copy asset link for emails"
                        className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-all"
                      >
                        {copiedId === file.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button
                        title="Download file"
                        className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-all"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(file.id)}
                        title="Delete file"
                        className="p-1.5 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {filteredFiles.length === 0 && (
                <div className="col-span-full py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center text-3xl mb-4">
                    📂
                  </div>
                  <h3 className="text-base font-bold text-foreground">No files found</h3>
                  <p className="text-xs text-muted-foreground mt-1">Upload assets or adjust filter controls to display files.</p>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </DashboardLayout>
  );
}
