"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Save, Play, Clock, Users, ArrowLeft, Mail, SplitSquareHorizontal, Trash2, ShieldAlert, Loader2, Calendar, MousePointerClick } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api, { withRetry } from "@/lib/api";
import AddLeadsModal from "@/components/AddLeadsModal";
import { useToast } from "@/components/Toast";

type FollowUp = {
  subject: string;
  body: string;
  delay: number; // Wait days
};

type EmailAccount = {
  id: number;
  name: string;
  email: string;
};

export default function CampaignEditor() {
  const [name, setName] = useState("");
  
  // Variant A
  const [subjectA, setSubjectA] = useState("");
  const [bodyA, setBodyA] = useState("");
  
  // Variant B (A/B Test)
  const [abEnabled, setAbEnabled] = useState(false);
  const [subjectB, setSubjectB] = useState("");
  const [bodyB, setBodyB] = useState("");
  const [abSplit, setAbSplit] = useState(50);
  
  // Followups
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  
  // Schedule & Rotation
  const [workingHours, setWorkingHours] = useState(false);
  const [workStart, setWorkStart] = useState(9);
  const [workEnd, setWorkEnd] = useState(18);
  const [selectedDays, setSelectedDays] = useState<string[]>(['0', '1', '2', '3', '4']); // Default Mon-Fri
  const [delayMin, setDelayMin] = useState(1);
  const [delayMax, setDelayMax] = useState(3);
  const [scheduledAt, setScheduledAt] = useState("");
  
  // Connected Email Accounts
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [sendLimit, setSendLimit] = useState(0);
  const [editId, setEditId] = useState<string | null>(null);
  
  // Add Leads Modal State
  const [showAddLeadsModal, setShowAddLeadsModal] = useState(false);
  const [newCampaignId, setNewCampaignId] = useState<number | null>(null);
  const [pendingLaunch, setPendingLaunch] = useState(false);

  
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { addToast } = useToast();

  const daysOfWeek = [
    { key: "0", label: "M", title: "Monday" },
    { key: "1", label: "T", title: "Tuesday" },
    { key: "2", label: "W", title: "Wednesday" },
    { key: "3", label: "T", title: "Thursday" },
    { key: "4", label: "F", title: "Friday" },
    { key: "5", label: "S", title: "Saturday" },
    { key: "6", label: "S", title: "Sunday" }
  ];

  const toggleDay = (key: string) => {
    setSelectedDays(prev => 
      prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key].sort()
    );
  };

  useEffect(() => {
    // Detect edit mode in query param
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const edit = searchParams.get("edit");
      if (edit) {
        setEditId(edit);
        // Fetch campaign details for pre-fill
        api.get(`/campaigns/${edit}`).then(res => {
          const c = res.data;
          setName(c.name);
          setSubjectA(c.subject_a || "");
          setBodyA(c.body_a || "");
          setSubjectB(c.subject_b || "");
          setBodyB(c.body_b || "");
          setAbEnabled(c.ab_enabled || false);
          setAbSplit(c.ab_split || 50);
          setDelayMin(c.delay_min || 1);
          setDelayMax(c.delay_max || 3);
          setWorkingHours(c.working_hours || false);
          setWorkStart(c.work_start || 9);
          setWorkEnd(c.work_end || 18);
          setSendLimit(c.send_limit || 0);
          
          const days = c.work_days ? c.work_days.split(",") : ['0', '1', '2', '3', '4'];
          setSelectedDays(days);
          
          setSelectedAccount(c.account_ids || "");
          setScheduledAt(c.scheduled_at ? c.scheduled_at.substring(0, 16) : "");
          
          // Map follow-up steps
          const steps = c.steps || [];
          const followupsList = steps.filter((s: any) => s.delay > 0).map((s: any) => ({
            subject: s.subject || "",
            body: s.body || "",
            delay: s.delay || 2
          }));
          setFollowups(followupsList);
        }).catch(err => console.error("Failed to load campaign for edit", err));
      }
    }

    // Fetch connected email accounts
    const fetchAccounts = async () => {
      try {
        const res = await api.get("/email-accounts");
        setAccounts(res.data);
        if (res.data.length > 0) {
          setSelectedAccount(prev => prev || res.data[0].id.toString());
        }
      } catch (err) {
        console.error("Failed to load accounts", err);
      }
    };
    fetchAccounts();
  }, []);

  const handleAddFollowup = () => {
    setFollowups(prev => [...prev, { subject: `Follow-up Step ${prev.length + 1}`, body: "", delay: 2 }]);
  };

  const handleRemoveFollowup = (index: number) => {
    setFollowups(prev => prev.filter((_, i) => i !== index));
  };

  const handleFollowupChange = (index: number, field: keyof FollowUp, value: any) => {
    setFollowups(prev => prev.map((fu, i) => i === index ? { ...fu, [field]: value } : fu));
  };

  const handleSave = async (status: 'draft' | 'running' = 'draft') => {
    // Validation
    if (!name.trim()) {
      addToast("Campaign name is required", "error");
      return;
    }
    
    if (!subjectA.trim()) {
      addToast("Email subject line (Variant A) is required", "error");
      return;
    }
    
    if (!bodyA.trim()) {
      addToast("Email message body (Variant A) is required", "error");
      return;
    }
    
    if (status === 'running' && accounts.length === 0) {
      addToast("No email accounts connected. Please add an email account first.", "error");
      return;
    }
    
    if (status === 'running' && !selectedAccount) {
      addToast("Please select an email account to send from", "error");
      return;
    }
    
    setSaving(true);
    try {
      const payload = {
        name,
        subject_a: subjectA,
        body_a: bodyA,
        subject_b: subjectB,
        body_b: bodyB,
        ab_enabled: abEnabled,
        ab_split: abSplit,
        delay_min: delayMin,
        delay_max: delayMax,
        working_hours: workingHours,
        work_start: workStart,
        work_end: workEnd,
        send_limit: sendLimit,
        work_days: selectedDays.join(","),
        account_ids: selectedAccount,
        scheduled_at: scheduledAt || null,
        followups
      };
      
      let targetId = editId;
      let isNewCampaign = false;
      
      if (editId) {
        await api.put(`/campaigns/${editId}`, payload);
      } else {
        const res = await api.post("/campaigns", payload);
        targetId = res.data.id;
        isNewCampaign = true;
      }
      
      if (isNewCampaign) {
        setNewCampaignId(targetId ? Number(targetId) : null);
        if (status === 'running') {
          setPendingLaunch(true);
        }
        setShowAddLeadsModal(true);
        if (status === 'draft') {
          addToast("Campaign saved as draft! Now add some leads to send to.", "success");
        } else {
          addToast("Campaign created! Add leads to launch your sequence.", "success");
        }
      } else if (status === 'running') {
        try {
          await withRetry(() => api.post(`/campaigns/${targetId}/start`));
          addToast("Campaign launched successfully!", "success");
          router.push(`/campaigns/${targetId}`);
        } catch (launchErr: any) {
          const errorMsg = launchErr.response?.data?.error || "Failed to launch campaign";
          addToast(errorMsg, "error");
        }
      } else {
        addToast("Campaign saved as draft", "success");
        router.push(`/campaigns/${targetId}`);
      }
    } catch (err: any) {
      console.error("Failed to save campaign", err);
      const errorMsg = err.response?.data?.error || "Failed to save campaign. Please check all fields and try again.";
      addToast(errorMsg, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col pb-12 space-y-6 max-w-5xl mx-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-border/50">
        <div className="flex items-center gap-4">
          <Link href="/campaigns" className="p-2.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <span className="text-xs font-bold text-primary uppercase tracking-widest">{editId ? "Edit Campaign" : "New Pipeline"}</span>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Campaign Name..."
              className="bg-transparent border-none text-2xl font-extrabold text-foreground focus:outline-none focus:ring-0 p-0 m-0 w-full max-w-md placeholder:text-muted-foreground/40"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => handleSave('draft')}
            disabled={saving}
            className="border border-border hover:bg-muted text-foreground px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all hover:scale-102"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Draft
          </button>
          <button 
            onClick={() => handleSave('running')}
            disabled={saving}
            className="bg-primary hover:bg-primary/95 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-md transition-all hover:scale-105 active:scale-95"
          >
            <Play className="w-4 h-4 fill-white" /> Launch Sequence
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Sequence Builder */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Initial Step Card */}
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/20 flex justify-between items-center">
              <span className="text-xs font-extrabold text-primary uppercase tracking-widest flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] text-primary">1</div>
                Initial Outreach Step
              </span>
              <button 
                onClick={() => setAbEnabled(!abEnabled)}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all ${abEnabled ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-muted text-muted-foreground border-transparent hover:text-foreground'}`}
              >
                <SplitSquareHorizontal className="w-4 h-4" /> A/B Testing
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Email Subject line (Variant A)</label>
                <input 
                  type="text" 
                  value={subjectA}
                  onChange={(e) => setSubjectA(e.target.value)}
                  placeholder="e.g. Quick question about mailflow..."
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm font-semibold outline-none focus:border-primary text-foreground"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Email Message Body (Variant A)</label>
                <textarea 
                  rows={6}
                  value={bodyA}
                  onChange={(e) => setBodyA(e.target.value)}
                  placeholder="Hey {{first_name}}, loved your recent work on..."
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-primary text-foreground resize-none"
                />
              </div>

              {abEnabled && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 pt-4 border-t border-border/50"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">A/B Testing - Variant B Configuration</span>
                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                      <span>Traffic Split:</span>
                      <input 
                        type="number" 
                        min="1" 
                        max="99" 
                        value={abSplit}
                        onChange={(e) => setAbSplit(parseInt(e.target.value))}
                        className="w-12 bg-muted border border-border rounded px-1.5 py-0.5 text-center text-foreground outline-none focus:border-primary"
                      />
                      <span>% (B)</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Email Subject line (Variant B)</label>
                    <input 
                      type="text" 
                      value={subjectB}
                      onChange={(e) => setSubjectB(e.target.value)}
                      placeholder="e.g. Quick question regarding scaling your outreach..."
                      className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm font-semibold outline-none focus:border-primary text-foreground"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Email Message Body (Variant B)</label>
                    <textarea 
                      rows={6}
                      value={bodyB}
                      onChange={(e) => setBodyB(e.target.value)}
                      placeholder="Hey {{first_name}}, saw your team is growing and..."
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-primary text-foreground resize-none"
                    />
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Follow-up Cards */}
          <div className="space-y-4">
            <AnimatePresence>
              {followups.map((fu, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden"
                >
                  <div className="p-4 border-b border-border bg-muted/10 flex justify-between items-center">
                    <span className="text-xs font-extrabold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] text-foreground font-extrabold">{idx + 2}</div>
                      Follow-up Pipeline Step
                    </span>
                    <button 
                      onClick={() => handleRemoveFollowup(idx)}
                      className="p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="flex items-center gap-4 bg-muted/20 border border-border p-4 rounded-2xl text-xs font-bold">
                      <Clock className="w-5 h-5 text-primary flex-shrink-0" />
                      <div className="flex items-center gap-2">
                        <span>Send follow-up if no reply after</span>
                        <input 
                          type="number" 
                          min="1"
                          max="90"
                          value={fu.delay}
                          onChange={(e) => handleFollowupChange(idx, 'delay', parseInt(e.target.value))}
                          className="w-16 bg-background border border-border rounded-xl px-3 py-1.5 text-center text-foreground outline-none focus:border-primary font-extrabold text-sm"
                        />
                        <span>days</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Follow-up Subject line</label>
                      <input 
                        type="text" 
                        value={fu.subject}
                        onChange={(e) => handleFollowupChange(idx, 'subject', e.target.value)}
                        placeholder="Re: Quick question..."
                        className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm font-semibold outline-none focus:border-primary text-foreground"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Follow-up Body</label>
                      <textarea 
                        rows={5}
                        value={fu.body}
                        onChange={(e) => handleFollowupChange(idx, 'body', e.target.value)}
                        placeholder="Hey {{first_name}}, bumping this to make sure it didn't get lost in your inbox..."
                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-primary text-foreground resize-none"
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Add Follow-up Button */}
          <button 
            onClick={handleAddFollowup}
            className="w-full border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/10 p-6 rounded-2xl flex items-center justify-center gap-2 text-sm font-extrabold text-muted-foreground hover:text-foreground transition-all duration-300 shadow-sm"
          >
            + Add Follow-up Step
          </button>
        </div>

        {/* Right Side: Sending configuration */}
        <div className="space-y-6">
          
          {/* Sender Rotation Card */}
          <div className="bg-card border border-border rounded-2xl shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              Connected Sender
            </h3>
            
            {accounts.length === 0 ? (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-bold rounded-xl flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                No sending accounts. Connect an account first!
              </div>
            ) : (
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm font-medium focus:border-primary outline-none text-foreground"
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.email})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Send Limit Configuration */}
          <div className="bg-card border border-border rounded-2xl shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <MousePointerClick className="w-5 h-5 text-muted-foreground" />
              Campaign Send Limit
            </h3>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Maximum Emails to Send</label>
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  min="0"
                  value={sendLimit}
                  onChange={(e) => setSendLimit(parseInt(e.target.value) || 0)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm font-semibold outline-none focus:border-primary text-foreground"
                />
              </div>
              <p className="text-[10px] text-muted-foreground font-medium mt-1">Set to 0 for unlimited. The campaign will automatically pause when it hits this number of sent emails.</p>
            </div>
          </div>

          {/* Schedule Configuration */}
          <div className="bg-card border border-border rounded-2xl shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              Sending Schedule
            </h3>
            
            <div className="space-y-4">
              
              {/* Start Date & Time Calendar picker */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Start Date & Time</label>
                <div className="flex items-center gap-2 bg-background border border-border p-2.5 rounded-xl">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <input 
                    type="datetime-local" 
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="bg-transparent border-none text-xs font-bold text-foreground outline-none w-full"
                  />
                </div>
              </div>

              {/* Restrict Working Hours */}
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Restrict Working Hours</label>
                <input 
                  type="checkbox" 
                  checked={workingHours}
                  onChange={(e) => setWorkingHours(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
              </div>

              {workingHours && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-3 pt-2"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                    <span>Daily Schedule</span>
                    <span className="text-foreground">{workStart}:00 to {workEnd}:00</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="range" 
                      min="0" 
                      max="12" 
                      value={workStart} 
                      onChange={(e) => setWorkStart(parseInt(e.target.value))}
                      className="w-full accent-primary" 
                    />
                    <input 
                      type="range" 
                      min="13" 
                      max="23" 
                      value={workEnd} 
                      onChange={(e) => setWorkEnd(parseInt(e.target.value))}
                      className="w-full accent-primary" 
                    />
                  </div>
                </motion.div>
              )}

              {/* Work Days Multi-Selector */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Target Days of the Week</label>
                <div className="flex items-center justify-between gap-1">
                  {daysOfWeek.map((day) => {
                    const isSelected = selectedDays.includes(day.key);
                    return (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => toggleDay(day.key)}
                        title={day.title}
                        className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center transition-all ${
                          isSelected 
                            ? 'bg-primary text-white scale-110 shadow-sm' 
                            : 'bg-muted text-muted-foreground hover:bg-muted/70'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Delay Interval */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Delay Interval (Minutes)</label>
                <div className="grid grid-cols-2 gap-3 text-xs font-medium">
                  <div className="flex items-center gap-1.5 bg-background border border-border p-2 rounded-xl">
                    <span className="text-muted-foreground">Min:</span>
                    <input 
                      type="number" 
                      min="1" 
                      max="10" 
                      value={delayMin} 
                      onChange={(e) => setDelayMin(parseInt(e.target.value))}
                      className="w-full bg-transparent border-none text-foreground outline-none font-bold text-center"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 bg-background border border-border p-2 rounded-xl">
                    <span className="text-muted-foreground">Max:</span>
                    <input 
                      type="number" 
                      min="2" 
                      max="60" 
                      value={delayMax} 
                      onChange={(e) => setDelayMax(parseInt(e.target.value))}
                      className="w-full bg-transparent border-none text-foreground outline-none font-bold text-center"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Add Leads Modal */}
      <AnimatePresence>
        {showAddLeadsModal && newCampaignId && (
          <AddLeadsModal 
            campaignId={newCampaignId}
            campaignName={name}
            pendingLaunch={pendingLaunch}
            onClose={async () => {
              setShowAddLeadsModal(false);
              if (pendingLaunch && newCampaignId) {
                try {
                  await withRetry(() => api.post(`/campaigns/${newCampaignId}/start`));
                  addToast("Campaign launched successfully!", "success");
                } catch (launchErr: any) {
                  const errorMsg = launchErr.response?.data?.error || "Failed to launch campaign";
                  addToast(errorMsg, "error");
                }
                setPendingLaunch(false);
              }
              router.push(`/campaigns/${newCampaignId}`);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
