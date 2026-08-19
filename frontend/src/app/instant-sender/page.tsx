"use client";

import { useState, useEffect, useRef } from "react";
import api from "@/lib/api";
import { ArrowRight, Send, Loader2, StopCircle, RotateCcw } from "lucide-react";
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
  const [isStopped, setIsStopped] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [statusLog, setStatusLog] = useState<{ msg: string; error?: boolean }[]>([]);

  // useRef so the async loop can read the latest stop signal without stale closure
  const stopRef = useRef(false);

  useEffect(() => {
    api.get("/email-accounts").then(res => {
      if (res.data && res.data.length > 0) {
        setAccounts(res.data);
        setAccountId(res.data[0].id.toString());
      }
    }).catch(err => console.error("Failed to load accounts", err));
  }, []);

  const proceedToStep2 = () => {
    const match = rawEmails.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi);
    if (!match || match.length === 0) {
      addToast("Please enter at least one valid email address.", "error");
      return;
    }
    setEmailsToProcess([...new Set(match)]);
    setCurrentIndex(0);
    setStatusLog([]);
    setIsStopped(false);
    setStep(2);
  };

  const backToStep1 = () => {
    stopRef.current = true;
    setIsSending(false);
    setStep(1);
  };

  const stopSending = () => {
    stopRef.current = true;
    setIsStopped(true);
    addToast("Stopping after current email...", "info");
  };

  const logStatus = (msg: string, error = false) => {
    setStatusLog(prev => [...prev, { msg, error }]);
  };

  const startSending = async () => {
    if (!accountId) { addToast("Please select an account", "error"); return; }
    if (!subject) { addToast("Please enter a subject", "error"); return; }
    if (!body) { addToast("Please enter a message body", "error"); return; }

    stopRef.current = false;
    setIsStopped(false);
    setIsSending(true);

    // If restarting from beginning
    if (currentIndex >= emailsToProcess.length) {
      setCurrentIndex(0);
      setStatusLog([]);
    }

    const startFrom = currentIndex >= emailsToProcess.length ? 0 : currentIndex;

    for (let i = startFrom; i < emailsToProcess.length; i++) {
      if (stopRef.current) {
        logStatus(`⏹ Stopped at ${i}/${emailsToProcess.length}. Click "Resume" to continue.`);
        break;
      }

      const targetEmail = emailsToProcess[i];
      logStatus(`Sending to ${targetEmail}...`);

      try {
        const res = await api.post("/campaigns/instant_send", {
          account_id: parseInt(accountId),
          to_email: targetEmail,
          subject,
          body,
        });

        if (res.data.success) {
          logStatus(`✓ Sent to ${targetEmail}`);
        } else {
          logStatus(`✗ Failed: ${targetEmail} — ${res.data.error}`, true);
        }
      } catch (err: any) {
        const errMsg = err?.response?.data?.error || err.message || "Unknown error";
        logStatus(`✗ Error: ${targetEmail} — ${errMsg}`, true);
      }

      setCurrentIndex(i + 1);

      if (i < emailsToProcess.length - 1 && !stopRef.current) {
        logStatus(`⏱ Waiting ${delay}s...`);
        await new Promise(r => setTimeout(r, delay * 1000));
      }
    }

    setIsSending(false);

    if (!stopRef.current) {
      logStatus(`🎉 All ${emailsToProcess.length} emails processed!`);
      addToast("Instant sending complete!", "success");
    }
  };

  const total = emailsToProcess.length;
  const sentCount = currentIndex;
  const remaining = total - sentCount;
  const percent = total > 0 ? Math.round((sentCount / total) * 100) : 0;
  const remainingSeconds = remaining * delay;
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const isComplete = sentCount >= total && total > 0;

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
              <h3 className="text-xl font-bold mb-1">Step 1: Enter Emails</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Paste email addresses (one per line or comma-separated). Duplicates will be removed automatically.
              </p>
            </div>
            <textarea
              value={rawEmails}
              onChange={(e) => setRawEmails(e.target.value)}
              className="w-full h-64 bg-background border border-input rounded-xl p-4 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-y"
              placeholder={"john@example.com\njane@example.com"}
            />
            <button
              onClick={proceedToStep2}
              className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
            >
              Proceed to Setup <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold">Step 2: Compose & Send</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Sender Account</label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  disabled={isSending}
                  className="w-full bg-background border border-input rounded-xl p-3 focus:ring-2 focus:ring-primary outline-none disabled:opacity-50"
                >
                  <option value="">-- Select an account --</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Delay between emails (seconds)</label>
                <input
                  type="number"
                  value={delay}
                  onChange={(e) => setDelay(parseInt(e.target.value) || 1)}
                  min="1"
                  disabled={isSending}
                  className="w-full bg-background border border-input rounded-xl p-3 focus:ring-2 focus:ring-primary outline-none disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={isSending}
                className="w-full bg-background border border-input rounded-xl p-3 focus:ring-2 focus:ring-primary outline-none disabled:opacity-50"
                placeholder="Email Subject"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Message Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={isSending}
                className="w-full h-48 bg-background border border-input rounded-xl p-4 focus:ring-2 focus:ring-primary outline-none resize-y disabled:opacity-50"
                placeholder="Type your message here..."
              />
            </div>

            {/* Progress */}
            {(isSending || sentCount > 0) && (
              <div className="bg-background border border-border p-4 rounded-xl space-y-3">
                <div className="flex justify-between text-sm font-semibold">
                  <span>
                    {isStopped ? "⏹ Paused at" : "Sending"} {sentCount} / {total} ({percent}%)
                  </span>
                  <span className="text-primary">
                    {isComplete ? "✅ Complete!" : isStopped ? "Stopped" : `Est. ${mins}m ${secs}s`}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${isStopped ? "bg-orange-500" : "bg-primary"}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="h-36 overflow-y-auto bg-card border border-border rounded-lg p-3 text-xs space-y-1 font-mono">
                  {statusLog.map((log, idx) => (
                    <div key={idx} className={log.error ? "text-red-400" : "text-muted-foreground"}>
                      {log.msg}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-border/50">
              <button
                onClick={backToStep1}
                disabled={isSending}
                className="px-5 py-2.5 rounded-xl font-bold border border-input hover:bg-secondary transition-colors disabled:opacity-50"
              >
                ← Back
              </button>

              {isSending ? (
                <button
                  onClick={stopSending}
                  className="bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all"
                >
                  <StopCircle className="w-5 h-5" /> Stop
                </button>
              ) : (
                <button
                  onClick={startSending}
                  disabled={isComplete && !isStopped && sentCount === total}
                  className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                >
                  {isStopped ? (
                    <><RotateCcw className="w-5 h-5" /> Resume</>
                  ) : sentCount > 0 && sentCount < total ? (
                    <><RotateCcw className="w-5 h-5" /> Resume ({sentCount}/{total})</>
                  ) : isComplete ? (
                    <><RotateCcw className="w-5 h-5" /> Send Again</>
                  ) : (
                    <><Send className="w-5 h-5" /> Bulk Send Now</>
                  )}
                </button>
              )}

              {total > 0 && !isSending && (
                <button
                  onClick={() => {
                    setCurrentIndex(0);
                    setStatusLog([]);
                    setIsStopped(false);
                    stopRef.current = false;
                  }}
                  className="px-5 py-2.5 rounded-xl font-bold border border-input hover:bg-secondary transition-colors text-sm"
                >
                  Reset
                </button>
              )}
            </div>

            {isStopped && (
              <p className="text-sm text-orange-400">
                ⚠️ Sending paused. Click <strong>Resume</strong> to continue from where you left off, or <strong>Reset</strong> to start over.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
