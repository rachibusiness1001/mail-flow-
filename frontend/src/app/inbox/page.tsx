"use client";
import ConversationView from "@/components/ConversationView";

export default function InboxPage() {
  return <ConversationView />;
}

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
