"use client";
import { motion } from "framer-motion";
import { ShieldAlert, FileText, CheckCircle2, ArrowRight, Loader2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import api from "@/lib/api";

export default function ToolsPage() {
  const [activeTab, setActiveTab] = useState("spam");

  // Spam states
  const [subject, setSubject] = useState("URGENT: Free crypto inside, click now!!");
  const [body, setBody] = useState("Hello,\n\nYou have won a free prize. Buy now or miss out on this 100% free offer. Make money fast!");
  const [score, setScore] = useState<number | null>(null);
  const [spamWords, setSpamWords] = useState<string[]>([]);
  const [spamLoading, setSpamLoading] = useState(false);

  // Spintax states
  const [spintaxText, setSpintaxText] = useState("{Hi|Hello|Hey there} {{firstName}},\n\n{I saw your|I noticed your|I loved your} recent post on LinkedIn.");
  const [previews, setPreviews] = useState<string[]>([]);
  const [spintaxLoading, setSpintaxLoading] = useState(false);

  const handleScanSpam = async () => {
    try {
      setSpamLoading(true);
      const res = await api.post("/auth/spam-check", { subject, body });
      setScore(res.data.score);
      setSpamWords(res.data.words);
    } catch (err) {
      console.error("Spam check failed", err);
      alert("Failed to analyze content.");
    } finally {
      setSpamLoading(false);
    }
  };

  const handleSpintaxGenerate = async () => {
    try {
      setSpintaxLoading(true);
      const res = await api.post("/auth/spintax-preview", { text: spintaxText });
      setPreviews(res.data.previews);
    } catch (err) {
      console.error("Spintax generation failed", err);
      alert("Failed to compile variations.");
    } finally {
      setSpintaxLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-12 max-w-5xl mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Email Deliverability Tools</h1>
        <p className="text-muted-foreground mt-1 font-medium">Analyze subject lines, verify body spam risk, and compile spintax preview sheets.</p>
      </motion.div>

      {/* Tabs */}
      <div className="border-b border-border flex gap-8">
        <button 
          onClick={() => setActiveTab("spam")}
          className={`pb-4 font-bold transition-colors flex items-center gap-2 ${activeTab === 'spam' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <ShieldAlert className="w-4 h-4" /> Spam Word Checker
        </button>
        <button 
          onClick={() => setActiveTab("spintax")}
          className={`pb-4 font-bold transition-colors flex items-center gap-2 ${activeTab === 'spintax' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <FileText className="w-4 h-4" /> Spintax Generator
        </button>
      </div>

      <motion.div 
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {activeTab === "spam" ? (
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col md:flex-row">
            <div className="w-full md:w-1/2 p-6 border-r border-border space-y-4">
              <h3 className="font-bold text-foreground">Email Content Analyzer</h3>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Subject Line</label>
                <input 
                  type="text" 
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject Line"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none transition-colors text-foreground"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Email Body</label>
                <textarea 
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Email Body"
                  className="w-full h-60 bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none transition-colors resize-none text-foreground"
                ></textarea>
              </div>
              <button 
                onClick={handleScanSpam}
                disabled={spamLoading}
                className="w-full bg-primary hover:bg-primary/95 text-white py-3 rounded-xl font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {spamLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scanning Content...
                  </>
                ) : (
                  "Scan for Spam Words"
                )}
              </button>
            </div>
            
            <div className="w-full md:w-1/2 p-6 bg-[#0b0d14]/20 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-foreground mb-4">Spam Score Report</h3>
                
                {score !== null ? (
                  <div className="space-y-6">
                    <div className="flex flex-col items-center justify-center py-6">
                      <div className={`w-32 h-32 rounded-full border-8 flex items-center justify-center relative ${
                        score > 5 ? 'border-red-500/20' : score > 2 ? 'border-yellow-500/20' : 'border-green-500/20'
                      }`}>
                        <div className="text-center">
                          <span className={`text-4xl font-extrabold ${
                            score > 5 ? 'text-red-500' : score > 2 ? 'text-yellow-500' : 'text-green-500'
                          }`}>{score}</span>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground mt-1">
                            {score > 5 ? 'High Risk' : score > 2 ? 'Medium Risk' : 'Healthy'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Flagged Expressions ({spamWords.length})</p>
                      <div className="max-h-52 overflow-y-auto space-y-1.5 pr-2">
                        {spamWords.map((word, i) => (
                          <div key={i} className="flex justify-between items-center p-3 bg-red-500/5 border border-red-500/10 rounded-xl text-red-400 text-xs font-bold">
                            <span>"{word}"</span>
                            <span className="text-[10px] px-2 py-0.5 bg-red-500/15 rounded-full text-red-500">Flags Reputation</span>
                          </div>
                        ))}
                        {spamWords.length === 0 && (
                          <div className="text-center py-6 text-xs text-muted-foreground font-semibold">
                            Excellent! No spam triggers detected in your content.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-24 text-center text-muted-foreground text-sm font-semibold flex flex-col items-center gap-2">
                    <AlertTriangle className="w-8 h-8 text-primary opacity-40" />
                    Fill in details and start the content scan to fetch delivery diagnostics.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden p-6">
            <h3 className="font-bold text-foreground mb-2">Spintax Preview Compiler</h3>
            <p className="text-sm text-muted-foreground mb-6">Type word spins in curly brackets `{`{option1|option2}`} format to verify variant readability.</p>
            
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="w-full lg:w-1/2">
                <textarea 
                  value={spintaxText}
                  onChange={(e) => setSpintaxText(e.target.value)}
                  className="w-full h-56 bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none transition-colors resize-none mb-4 font-mono text-foreground"
                ></textarea>
                <button 
                  onClick={handleSpintaxGenerate}
                  disabled={spintaxLoading}
                  className="w-full bg-foreground text-background hover:opacity-90 py-3 rounded-xl font-bold transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
                >
                  {spintaxLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-background" />
                  ) : (
                    <>
                      Generate Variations <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
              
              <div className="w-full lg:w-1/2 bg-[#0b0d14]/20 border border-border rounded-xl p-4 overflow-y-auto h-72 space-y-4">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Compiled Previews</h4>
                
                {previews.map((preview, i) => (
                  <div key={i} className="p-3.5 bg-background border border-border rounded-xl shadow-sm text-xs text-foreground/90 whitespace-pre-line leading-relaxed">
                    <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase tracking-wider mr-2">Variation {i+1}</span>
                    <div className="mt-2 text-foreground/95">{preview}</div>
                  </div>
                ))}

                {previews.length === 0 && (
                  <div className="py-20 text-center text-muted-foreground text-xs font-semibold">
                    Generated preview copies will list here.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
