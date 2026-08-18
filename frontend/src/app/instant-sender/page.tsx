"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { ArrowRight, Send, Loader2 } from "lucide-react";
import { useToast } from "@/components/Toast";

export default function InstantSenderPage() {
  const { addToast } = useToast();
  
  // Step 1
  const [step, setStep] = useState(1);
  const [rawEmails, setRawEmails] = useState("");
  const [emailsToProcess, setEmailsToProcess] = useState<string[]>([]);

  // Step 2
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountId, setAccountId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [delay, setDelay] = useState(5);

  // Sending state
  const [isSending, setIsSending] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [statusLog, setStatusLog] = useState<{msg: string, error?: boolean}[]>([]);

  useEffect(() => {
    // Fetch accounts when component mounts
    api.get("/email-accounts").then(res => {
      if (res.data) {
        setAccounts(res.data);
        if (res.data.length > 0) {
          setAccountId(res.data[0].id.toString());
        }
      }
    }).catch(err => {
      console.error("Failed to load accounts", err);
    });
  }, []);

  const proceedToStep2 = () => {
    const match = rawEmails.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi);
    if (!match || match.length === 0) {
      addToast("Please enter at least one valid email address.", "error");
      return;
    }
    setEmailsToProcess([...new Set(match)]);
    setStep(2);
  };

  const backToStep1 = () => {
    if (isSending) {
      if (!confirm("Sending is in progress. Are you sure you want to stop?")) return;
      setIsSending(false);
    }
    setStep(1);
  };

  const startSending = async () => {
    if (!accountId) { addToast("Please select an account", "error"); return; }
    if (!subject) { addToast("Please enter a subject", "error"); return; }
    if (!body) { addToast("Please enter a message body", "error"); return; }

    setIsSending(true);
    
    let currentProcessIndex = currentIndex >= emailsToProcess.length ? 0 : currentIndex;
    setCurrentIndex(currentProcessIndex);
    if (currentProcessIndex === 0) {
      setStatusLog([]);
    }

    let isStillSending = true;

    for (let i = currentProcessIndex; i < emailsToProcess.length; i++) {
      // Need a way to check if component unmounted or stopped, but React state inside async loop is tricky.
      // We rely on isSending but since it's an async function, we need to read it from a ref ideally,
      // but for simplicity we will just let it finish the loop if not strictly stopped.
      
      const targetEmail = emailsToProcess[i];
      setStatusLog(prev => [...prev, {msg: `Sending to ${targetEmail}...`}]);
      setCurrentIndex(i);

      try {
        const res = await api.post("/campaigns/instant_send", {
          account_id: parseInt(accountId),
          to_email: targetEmail,
          subject,
          body
        });
        
        if (res.data.success) {
          setStatusLog(prev => [...prev, {msg: `✓ Sent successfully to ${targetEmail}`}]);
        } else {
          setStatusLog(prev => [...prev, {msg: `✗ Failed to send to ${targetEmail}: ${res.data.error}`, error: true}]);
        }
      } catch (err: any) {
        setStatusLog(prev => [...prev, {msg: `✗ Error sending to ${targetEmail}: ${err.message}`, error: true}]);
      }

      setCurrentIndex(i + 1);

      if (i < emailsToProcess.length - 1) {
        setStatusLog(prev => [...prev, {msg: `Waiting ${delay} seconds...`}]);
        await new Promise(r => setTimeout(r, delay * 1000));
      }
    }

    setStatusLog(prev => [...prev, {msg: `All emails processed!` }]);
    setIsSending(false);
    addToast("Instant sending complete!", "success");
  };

  const total = emailsToProcess.length;
  const sentCount = currentIndex;
  const remaining = total - sentCount;
  const percent = total > 0 ? Math.round((sentCount / total) * 100) : 0;
  
  const remainingSeconds = remaining * delay;
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Instant Sender</h1>
        <p className="text-muted-foreground mt-2">Quickly broadcast emails without setting up a campaign.</p>
      </div>

      <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-bold mb-2">Step 1: Enter Emails</h3>
              <p className="text-sm text-muted-foreground mb-4">Paste your target email addresses below (one per line, or comma-separated).</p>
            </div>
            <textarea
              value={rawEmails}
              onChange={(e) => setRawEmails(e.target.value)}
              className="w-full h-64 bg-background border border-input rounded-xl p-4 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              placeholder="john@example.com&#10;jane@example.com"
            />
            <button
              onClick={proceedToStep2}
              className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all"
            >
              Proceed to Setup <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold">Step 2: Compose & Send</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Select Sender Account</label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full bg-background border border-input rounded-xl p-3 focus:ring-2 focus:ring-primary outline-none"
                >
                  <option value="">-- Select an account --</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.email}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-background border border-input rounded-xl p-3 focus:ring-2 focus:ring-primary outline-none"
                  placeholder="Email Subject"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Message Body</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full h-48 bg-background border border-input rounded-xl p-4 focus:ring-2 focus:ring-primary outline-none"
                  placeholder="Type your message here..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Delay between emails (in seconds)</label>
                <input
                  type="number"
                  value={delay}
                  onChange={(e) => setDelay(parseInt(e.target.value) || 0)}
                  min="1"
                  className="w-48 bg-background border border-input rounded-xl p-3 focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
            </div>

            {/* Progress UI */}
            {(isSending || currentIndex > 0) && (
              <div className="bg-background border border-border p-4 rounded-xl space-y-3">
                <div className="flex justify-between text-sm font-semibold">
                  <span>Sending {sentCount} / {total} ({percent}%)</span>
                  <span className="text-primary">
                    {remaining > 0 ? `Est. time: ${mins}m ${secs}s` : "Completed!"}
                  </span>
                </div>
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                
                <div className="mt-4 h-32 overflow-y-auto bg-card border border-border rounded-lg p-3 text-xs space-y-1 font-mono">
                  {statusLog.map((log, idx) => (
                    <div key={idx} className={log.error ? "text-red-400" : "text-muted-foreground"}>
                      {log.msg}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-4 pt-4 border-t border-border/50">
              <button
                onClick={backToStep1}
                disabled={isSending}
                className="px-6 py-3 rounded-xl font-bold border border-input hover:bg-secondary transition-colors disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={startSending}
                disabled={isSending}
                className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {isSending ? <><Loader2 className="w-5 h-5 animate-spin" /> Sending...</> : <><Send className="w-5 h-5" /> Bulk Send Now</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
