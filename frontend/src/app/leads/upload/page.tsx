"use client";
import { motion } from "framer-motion";
import { UploadCloud, CheckCircle2, ArrowRight, FileText, X, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import api from "@/lib/api";

type Campaign = {
  id: number;
  name: string;
};

export default function UploadLeadsPage() {
  const [step, setStep] = useState(1); // 1 = Upload, 2 = Map, 3 = Success
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  
  // File details
  const [fileName, setFileName] = useState("");
  const [rowCount, setRowCount] = useState(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<string[][]>([]);
  
  // Column Mappings
  const [emailCol, setEmailCol] = useState("");
  const [firstNameCol, setFirstNameCol] = useState("");
  const [lastNameCol, setLastNameCol] = useState("");
  const [companyCol, setCompanyCol] = useState("");
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch campaigns for mapping
    const fetchCampaigns = async () => {
      try {
        const res = await api.get("/campaigns");
        setCampaigns(res.data.campaigns);
        if (res.data.campaigns.length > 0) {
          setSelectedCampaignId(res.data.campaigns[0].id.toString());
        }
      } catch (err) {
        console.error("Failed to load campaigns", err);
      }
    };
    fetchCampaigns();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFileName(selectedFile.name);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(line => line !== "");
      if (lines.length > 0) {
        // Safe CSV parser splitting by comma (can handle simple fields)
        const parsedHeaders = lines[0].split(",").map(h => h.replace(/^["']|["']$/g, '').trim());
        setHeaders(parsedHeaders);
        setRowCount(lines.length - 1);
        
        const dataRows = lines.slice(1).map(line => 
          line.split(",").map(val => val.replace(/^["']|["']$/g, '').trim())
        );
        setCsvData(dataRows);
        
        // Auto match columns based on header substrings
        const emailIdx = parsedHeaders.findIndex(h => h.toLowerCase().includes("email"));
        if (emailIdx !== -1) setEmailCol(parsedHeaders[emailIdx]);
        
        const firstIdx = parsedHeaders.findIndex(h => h.toLowerCase().includes("first") || h.toLowerCase().includes("name"));
        if (firstIdx !== -1) setFirstNameCol(parsedHeaders[firstIdx]);
        
        const lastIdx = parsedHeaders.findIndex(h => h.toLowerCase().includes("last"));
        if (lastIdx !== -1) setLastNameCol(parsedHeaders[lastIdx]);
        
        const compIdx = parsedHeaders.findIndex(h => h.toLowerCase().includes("company") || h.toLowerCase().includes("org"));
        if (compIdx !== -1) setCompanyCol(parsedHeaders[compIdx]);
        
        setStep(2);
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    if (!selectedCampaignId) {
      alert("Please select a campaign first!");
      return;
    }
    
    const emailIdx = headers.indexOf(emailCol);
    const firstIdx = headers.indexOf(firstNameCol);
    const lastIdx = headers.indexOf(lastNameCol);
    const compIdx = headers.indexOf(companyCol);
    
    if (emailIdx === -1) {
      alert("Please map the Email column!");
      return;
    }
    
    // Construct leads payload
    const leadsList = csvData.map(row => ({
      email: row[emailIdx] || "",
      first_name: firstIdx !== -1 ? row[firstIdx] || "" : "",
      last_name: lastIdx !== -1 ? row[lastIdx] || "" : "",
      company: compIdx !== -1 ? row[compIdx] || "" : ""
    })).filter(lead => lead.email.includes("@"));
    
    if (leadsList.length === 0) {
      alert("No valid leads with emails found in the uploaded file.");
      return;
    }
    
    setLoading(true);
    try {
      await api.post("/leads/upload", {
        campaign_id: parseInt(selectedCampaignId),
        leads: leadsList
      });
      setStep(3);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || "Lead upload failed. Check campaign selection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      
      {/* Header */}
      <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground mb-8">
        <Link href="/leads" className="hover:text-foreground transition-colors">Leads</Link>
        <span>/</span>
        <span className="text-foreground">Import CSV</span>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Import Leads</h1>
        <p className="text-muted-foreground mt-1 font-medium">Upload a CSV file and map columns to your sequence database.</p>
      </motion.div>

      {/* Stepper */}
      <div className="flex items-center gap-4 mb-8">
        <div className={`flex items-center gap-2 font-bold text-sm ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 1 ? 'bg-primary text-white' : 'bg-muted'}`}>1</div>
          Upload File
        </div>
        <div className="h-px w-12 bg-border"></div>
        <div className={`flex items-center gap-2 font-bold text-sm ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 2 ? 'bg-primary text-white' : 'bg-muted'}`}>2</div>
          Map Columns
        </div>
        <div className="h-px w-12 bg-border"></div>
        <div className={`flex items-center gap-2 font-bold text-sm ${step >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 3 ? 'bg-primary text-white' : 'bg-muted'}`}>3</div>
          Import
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden"
      >
        {step === 1 && (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
              <UploadCloud className="w-10 h-10 text-primary" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-foreground">Upload your CSV</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Drag and drop your file here, or click to browse. Max size 50MB.
              </p>
            </div>
            
            <div className="w-full max-w-md bg-background border-2 border-dashed border-border rounded-2xl p-8 hover:border-primary/50 transition-colors cursor-pointer relative group flex flex-col items-center justify-center">
              <input 
                type="file" 
                accept=".csv"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <span className="bg-primary hover:bg-primary/95 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-sm">
                Browse CSV File
              </span>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between bg-muted/30 p-4 rounded-xl border border-border">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-bold text-foreground">{fileName}</p>
                  <p className="text-xs text-muted-foreground">{rowCount} prospects detected</p>
                </div>
              </div>
              <button onClick={() => setStep(1)} className="p-2 hover:bg-muted rounded-full transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Target Campaign selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Assign to Campaign</label>
              {campaigns.length === 0 ? (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-bold rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  No campaigns active. Please create a campaign sequence first!
                </div>
              ) : (
                <select
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm font-semibold outline-none focus:border-primary text-foreground"
                >
                  {campaigns.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>

            <h3 className="text-xl font-bold text-foreground pt-4">Map Column Fields</h3>
            
            <div className="space-y-4">
              {[
                { label: "Email Address *", value: emailCol, setter: setEmailCol },
                { label: "First Name", value: firstNameCol, setter: setFirstNameCol },
                { label: "Last Name", value: lastNameCol, setter: setLastNameCol },
                { label: "Company Name", value: companyCol, setter: setCompanyCol }
              ].map((field, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border border-border rounded-xl bg-background">
                  <div className="w-full sm:w-1/3 font-bold text-foreground text-sm">{field.label}</div>
                  <div className="hidden sm:flex items-center justify-center w-8">
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="w-full sm:w-2/3">
                    <select 
                      value={field.value}
                      onChange={(e) => field.setter(e.target.value)}
                      className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:border-primary text-foreground"
                    >
                      <option value="">Select CSV Column...</option>
                      {headers.map((h, idx) => (
                        <option key={idx} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-border/50">
              <button 
                onClick={() => setStep(1)} 
                className="px-6 py-2.5 rounded-xl font-bold text-muted-foreground hover:bg-muted transition-colors"
              >
                Back
              </button>
              <button 
                onClick={handleImport}
                disabled={loading || campaigns.length === 0}
                className="bg-primary hover:bg-primary/95 text-white px-8 py-2.5 rounded-xl font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    Start Import
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-16 flex flex-col items-center justify-center text-center space-y-6">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 12 }}
              className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center"
            >
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </motion.div>
            
            <div className="space-y-2">
              <h3 className="text-3xl font-extrabold text-foreground">Import Complete!</h3>
              <p className="text-muted-foreground max-w-sm mx-auto font-medium">
                Successfully imported your leads into MailFlow. Sequence delivery will commence automatically according to your sending schedule.
              </p>
            </div>
            
            <Link href="/leads" className="bg-primary hover:bg-primary/95 text-white px-8 py-3 rounded-full font-bold transition-all inline-block">
              Go to Leads Database
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}
