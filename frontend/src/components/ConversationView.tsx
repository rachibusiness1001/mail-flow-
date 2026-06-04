"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MessageCircle, Archive, Clock, MoreVertical, Reply, CornerUpLeft, Trash2, Loader2, RefreshCw, Mail, User } from "lucide-react";
import { useState, useEffect } from "react";
import api from "@/lib/api";

type Conversation = {
  email: string;
  message_count: number;
  last_message_time: string;
  unread_count: number;
};

type Message = {
  id: number;
  from: string;
  subject: string;
  body: string;
  received: string;
  is_sent: boolean;
  lead_id?: number;
  lead_name?: string;
};

export default function ConversationView() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/inbox/conversations');
      setConversations(response.data.conversations);
      if (response.data.conversations.length > 0 && !selectedConversation) {
        setSelectedConversation(response.data.conversations[0]);
      }
    } catch (error) {
      console.error("Failed to fetch conversations", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  // Fetch conversation messages when selected conversation changes
  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }

    const fetchConversationMessages = async () => {
      try {
        setMessagesLoading(true);
        const res = await api.get(`/inbox/conversation/${encodeURIComponent(selectedConversation.email)}`);
        if (res.data.success) {
          setMessages(res.data.conversation);
        }
      } catch (err) {
        console.error("Failed to load conversation messages", err);
      } finally {
        setMessagesLoading(false);
      }
    };

    fetchConversationMessages();
  }, [selectedConversation]);

  const handleSendReply = async () => {
    if (!selectedConversation || !replyText.trim() || replying) return;
    if (!messages.length) return;
    
    try {
      setReplying(true);
      // Send reply using the last message ID
      const lastMessage = messages[messages.length - 1];
      await api.post(`/inbox/${lastMessage.id}/reply`, { body: replyText.trim() });
      setReplyText("");
      
      // Refetch messages list
      const res = await api.get(`/inbox/conversation/${encodeURIComponent(selectedConversation.email)}`);
      if (res.data.success) {
        setMessages(res.data.conversation);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to send reply.");
    } finally {
      setReplying(false);
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalUnread = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col md:flex-row gap-6 pb-6 max-w-7xl mx-auto">
      
      {/* Left Sidebar (Conversations List) */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full md:w-1/3 flex flex-col bg-card border border-border rounded-2xl shadow-sm overflow-hidden h-full"
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
          <h2 className="text-xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            Conversations
          </h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={fetchConversations}
              className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {totalUnread > 0 && (
              <span className="bg-primary text-white text-xs font-bold px-2 py-1 rounded-full">
                {totalUnread} New
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-sm font-medium"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/50">
          {loading ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Loading conversations...</span>
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <div 
                key={conversation.email}
                onClick={() => setSelectedConversation(conversation)}
                className={`p-4 cursor-pointer transition-all duration-300 hover:bg-muted/30 relative ${
                  selectedConversation?.email === conversation.email ? 'bg-primary/5 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <h3 className={`text-sm font-bold truncate ${conversation.unread_count ? 'text-foreground font-black' : 'text-muted-foreground'}`}>
                      {conversation.email}
                    </h3>
                  </div>
                  {conversation.unread_count > 0 && (
                    <span className="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full ml-2 flex-shrink-0">
                      {conversation.unread_count}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {conversation.message_count} {conversation.message_count === 1 ? 'message' : 'messages'}
                  </span>
                  <span className="text-muted-foreground">
                    {conversation.last_message_time}
                  </span>
                </div>
              </div>
            ))
          )}

          {!loading && filteredConversations.length === 0 && conversations.length > 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No conversations match "{searchQuery}"
            </div>
          )}

          {!loading && conversations.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No conversations yet. Send emails to get started.
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
        {selectedConversation ? (
          <>
            {/* Conversation Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{selectedConversation.email}</h3>
                  <p className="text-xs text-muted-foreground">{selectedConversation.message_count} messages</p>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messagesLoading ? (
                <div className="flex items-center justify-center p-8 text-muted-foreground gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Loading messages...</span>
                </div>
              ) : (
                <AnimatePresence>
                  {messages.map((message, index) => (
                    <motion.div 
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${message.is_sent ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-lg p-4 rounded-xl ${
                        message.is_sent 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted text-foreground border border-border'
                      }`}>
                        <p className="text-xs font-semibold mb-2 opacity-75">{message.subject}</p>
                        <p className="text-sm break-words">{message.body}</p>
                        <p className={`text-xs mt-2 ${message.is_sent ? 'opacity-75' : 'text-muted-foreground'}`}>
                          {message.received}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Reply Box */}
            <div className="p-4 border-t border-border bg-muted/20">
              <div className="space-y-2">
                <textarea 
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your reply here..."
                  className="w-full bg-card border border-border rounded-xl p-3 text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 min-h-[100px] resize-none text-sm"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || replying}
                    className="bg-primary text-primary-foreground px-6 py-2 rounded-xl font-bold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    <Reply className="w-4 h-4" />
                    {replying ? "Sending..." : "Send Reply"}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-semibold">No conversation selected</p>
              <p className="text-sm">Select a conversation from the list to view messages</p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
