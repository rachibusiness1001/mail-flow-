"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Inbox as InboxIcon, Archive, Clock, MoreVertical, Reply, CornerUpLeft, Trash2, Loader2, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import api from "@/lib/api";

type Thread = {
  id: number;
  lead_id?: number;
  name: string;
  email: string;
  subject: string;
  snippet: string;
  time: string;
  unread: boolean;
};

type Message = {
  id: number;
  from: string;
  subject: string;
  body: string;
  received: string;
  is_sent: boolean;
};

export default function InboxPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  const fetchThreads = async () => {
    try {
      setLoading(true);
      const response = await api.get('/inbox');
      setThreads(response.data.threads);
      if (response.data.threads.length > 0 && !selectedThread) {
        setSelectedThread(response.data.threads[0]);
      }
    } catch (error) {
      console.error("Failed to fetch inbox threads", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, []);

  // Fetch thread messages when selectedThread changes
  useEffect(() => {
    if (!selectedThread) {
      setMessages([]);
      return;
    }

    const fetchThreadMessages = async () => {
      try {
        setMessagesLoading(true);
        if (selectedThread.lead_id) {
          const res = await api.get(`/inbox/thread/${selectedThread.lead_id}`);
          if (res.data.success) {
            setMessages(res.data.thread);
          }
        } else {
          // Fallback if no lead_id is present
          setMessages([{
            id: selectedThread.id,
            from: selectedThread.email,
            subject: selectedThread.subject,
            body: selectedThread.snippet,
            received: selectedThread.time,
            is_sent: false
          }]);
        }
        
        // Mark thread as read
        if (selectedThread.unread) {
          await api.post(`/inbox/${selectedThread.id}/read`);
          setThreads(prev => prev.map(t => t.id === selectedThread.id ? { ...t, unread: false } : t));
        }
      } catch (err) {
        console.error("Failed to load thread messages", err);
      } finally {
        setMessagesLoading(false);
      }
    };

    fetchThreadMessages();
  }, [selectedThread]);

  const handleSendReply = async () => {
    if (!selectedThread || !replyText.trim() || replying) return;
    try {
      setReplying(true);
      await api.post(`/inbox/${selectedThread.id}/reply`, { body: replyText.trim() });
      setReplyText("");
      
      // Refetch messages list
      if (selectedThread.lead_id) {
        const res = await api.get(`/inbox/thread/${selectedThread.lead_id}`);
        if (res.data.success) {
          setMessages(res.data.thread);
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to send SMTP reply. Verify connected account settings.");
    } finally {
      setReplying(false);
    }
  };

  const handleDeleteThread = async () => {
    if (!selectedThread) return;
    if (!confirm("Are you sure you want to remove this inbox thread?")) return;
    try {
      await api.delete(`/inbox/${selectedThread.id}`);
      setThreads(prev => prev.filter(t => t.id !== selectedThread.id));
      setSelectedThread(null);
    } catch (err) {
      alert("Failed to delete thread");
    }
  };

  const handleSnooze = async (days: number) => {
    if (!selectedThread) return;
    try {
      await api.post(`/inbox/${selectedThread.id}/snooze`, { days });
      alert(`Thread snoozed for ${days} days.`);
      setThreads(prev => prev.filter(t => t.id !== selectedThread.id));
      setSelectedThread(null);
    } catch (err) {
      alert("Failed to snooze thread");
    }
  };

  const handleMoveTag = async (tagName: string) => {
    if (!selectedThread) return;
    try {
      // For simplicity, we create a mock tag ID based on names
      // In app.py, tags can be queried, or we map name directly.
      // We will look up tag or send it in payload.
      // Tag ID 1 = Interested, 2 = Not Interested, 3 = Out of office
      const tagIdMap: Record<string, number> = {
        'Interested': 1,
        'Not Interested': 2,
        'Out of Office': 3
      };
      await api.post(`/inbox/${selectedThread.id}/move-tag`, { tag_id: tagIdMap[tagName] || null });
      alert(`Tag updated to: ${tagName}`);
      fetchThreads();
    } catch (err) {
      alert("Failed to update thread tag status");
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col md:flex-row gap-6 pb-6 max-w-6xl mx-auto">
      
      {/* Left Sidebar (Thread List) */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full md:w-1/3 flex flex-col bg-card border border-border rounded-2xl shadow-sm overflow-hidden h-full"
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
          <h2 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <InboxIcon className="w-5 h-5 text-primary" />
            Master Inbox
          </h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={fetchThreads}
              className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {threads.filter(t => t.unread).length > 0 && (
              <span className="bg-primary text-white text-xs font-bold px-2 py-1 rounded-full">
                {threads.filter(t => t.unread).length} New
              </span>
            )}
          </div>
        </div>
        
        {/* Search */}
        <div className="p-3 border-b border-border bg-background">
          <div className="flex items-center gap-3 bg-muted border border-border p-2 rounded-xl">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search conversations..." 
              className="w-full bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-sm font-medium"
            />
          </div>
        </div>

        {/* Threads List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/50">
          {loading ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Loading threads...</span>
            </div>
          ) : (
            threads.map((thread) => (
              <div 
                key={thread.id}
                onClick={() => setSelectedThread(thread)}
                className={`p-4 cursor-pointer transition-all duration-300 hover:bg-muted/30 relative ${
                  selectedThread?.id === thread.id ? 'bg-primary/5 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className={`text-sm font-bold truncate ${thread.unread ? 'text-foreground font-black' : 'text-muted-foreground'}`}>
                    {thread.name}
                  </h3>
                  <span className={`text-xs ${thread.unread ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                    {thread.time}
                  </span>
                </div>
                <p className={`text-xs mb-1 font-semibold truncate ${thread.unread ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {thread.subject}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {thread.snippet}
                </p>
              </div>
            ))
          )}

          {!loading && threads.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No replies in this project workspace yet.
            </div>
          )}
        </div>
      </motion.div>

      {/* Right Pane (Message View) */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full md:w-2/3 flex flex-col bg-card border border-border rounded-2xl shadow-sm overflow-hidden h-full"
      >
        {selectedThread ? (
          <>
            {/* Thread Actions Header */}
            <div className="p-4 border-b border-border flex flex-col md:flex-row items-center justify-between bg-muted/30 gap-4">
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleDeleteThread}
                  className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors" 
                  title="Remove conversation thread"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <div className="h-6 w-px bg-border mx-2"></div>
                
                {/* Snooze actions dropdown */}
                <div className="relative group">
                  <button className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-lg text-sm font-bold text-muted-foreground hover:text-foreground transition-colors" title="Snooze">
                    <Clock className="w-4 h-4" />
                    Snooze
                  </button>
                  <div className="absolute top-full left-0 mt-2 w-32 bg-card border border-border rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-2 space-y-1">
                    {[1, 2, 7].map(d => (
                      <button 
                        key={d} 
                        onClick={() => handleSnooze(d)}
                        className="w-full text-left px-2 py-1.5 text-xs font-bold text-foreground hover:bg-muted rounded-lg transition-colors"
                      >
                        {d} {d === 1 ? 'day' : 'days'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Categorization tag dropdown */}
                <div className="relative group">
                  <button className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-lg text-sm font-bold text-muted-foreground hover:text-foreground transition-colors" title="Apply Tag">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    Tag Status
                  </button>
                  <div className="absolute top-full left-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-2 space-y-1">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-2">Apply Tag Status</div>
                    {[
                      { name: 'Interested', color: 'bg-green-500' },
                      { name: 'Not Interested', color: 'bg-yellow-500' },
                      { name: 'Out of Office', color: 'bg-orange-500' }
                    ].map((tag, i) => (
                      <button 
                        key={i} 
                        onClick={() => handleMoveTag(tag.name)}
                        className="w-full text-left px-3 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors flex items-center gap-2"
                      >
                        <span className={`w-2 h-2 rounded-full ${tag.color}`}></span>
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Conversation Thread Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#0b0d14]/30">
              <h2 className="text-xl font-extrabold text-foreground mb-6 pb-4 border-b border-border/30">{selectedThread.subject}</h2>
              
              {messagesLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <span className="text-sm font-semibold">Loading messages...</span>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="flex gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${
                      msg.is_sent ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-muted text-foreground'
                    }`}>
                      {msg.from ? msg.from.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-bold text-foreground text-sm flex items-center gap-2">
                            {msg.from}
                            {msg.is_sent && (
                              <span className="text-[9px] bg-primary/20 text-primary font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">Sent</span>
                            )}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground font-medium">{msg.received}</p>
                      </div>
                      <div className={`text-sm text-foreground/90 leading-relaxed p-4 rounded-2xl rounded-tl-none border ${
                        msg.is_sent ? 'bg-[#161926]/40 border-primary/20' : 'bg-card border-border'
                      } whitespace-pre-line`}>
                        {msg.body}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Reply Input Box */}
            <div className="p-4 border-t border-border bg-background">
              <div className="border border-border rounded-xl overflow-hidden focus-within:border-primary transition-colors shadow-sm bg-card">
                <textarea 
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your outbound reply here..." 
                  className="w-full h-24 bg-transparent border-none outline-none text-sm p-4 resize-none text-foreground placeholder:text-muted-foreground/60 focus:ring-0"
                ></textarea>
                <div className="bg-muted/30 border-t border-border p-3 flex justify-between items-center">
                  <span className="text-xs text-muted-foreground font-semibold">Replies will be dispatched via original connected email account.</span>
                  <button 
                    onClick={handleSendReply}
                    disabled={replying || !replyText.trim()}
                    className="bg-primary hover:bg-primary/90 text-white px-5 py-2 rounded-lg font-bold flex items-center justify-center gap-2 text-sm shadow-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {replying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Dispatched...
                      </>
                    ) : (
                      <>
                        <CornerUpLeft className="w-4 h-4" />
                        Send Reply
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <InboxIcon className="w-16 h-16 mb-4 opacity-20 text-primary" />
            <p className="font-medium">Select a thread to view conversation history</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
