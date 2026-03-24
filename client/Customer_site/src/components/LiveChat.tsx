import { useRef, useEffect, useState, KeyboardEvent } from 'react';
import { MessageCircle, X, Send, Loader2, ChevronDown, PhoneOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/hooks/useChat';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNavigate } from 'react-router-dom';

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function LiveChat() {
  const { isLoggedIn } = useAuth();
  const { session, messages, isOpen, isLoading, isSending, openChat, closeChat, sendMessage, endChat } = useChat(isLoggedIn);
  const [input, setInput] = useState('');
  const [confirmEnd, setConfirmEnd] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSend = () => {
    if (!input.trim() || isSending) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isMobile) {
    return (
      <button
        onClick={() => navigate('/live-chat')}
        className="fixed bottom-20 right-4 z-40 bg-primary text-primary-foreground rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity"
        aria-label="Open live chat"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    );
  }

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={openChat}
          className="fixed bottom-6 right-6 z-40 bg-primary text-primary-foreground rounded-full w-14 h-14 flex items-center justify-center shadow-xl hover:opacity-90 transition-all hover:scale-105"
          aria-label="Open live chat"
        >
          <MessageCircle className="w-7 h-7" />
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-40 w-80 h-[480px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              <span className="font-semibold text-sm">Flypick Support</span>
            </div>
            <div className="flex items-center gap-2">
              {session && session.status === 'active' && (
                confirmEnd ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-primary-foreground/80">End chat?</span>
                    <button
                      onClick={async () => { await endChat(); setConfirmEnd(false); }}
                      className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full hover:bg-red-600 transition-colors"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmEnd(false)}
                      className="text-xs bg-white/20 px-2 py-0.5 rounded-full hover:bg-white/30 transition-colors"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmEnd(true)}
                    className="hover:opacity-70 transition-opacity"
                    title="End chat"
                  >
                    <PhoneOff className="w-4 h-4" />
                  </button>
                )
              )}
              <button onClick={closeChat} className="hover:opacity-70 transition-opacity">
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {isLoading && (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!isLoading && messages.length === 0 && (
              <div className="text-center text-muted-foreground text-xs py-6">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>Hi! How can we help you today?</p>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender_type === 'customer' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                  msg.sender_type === 'customer'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted text-foreground rounded-bl-sm'
                }`}>
                  <p className="break-words">{msg.content}</p>
                  <p className={`text-[10px] mt-0.5 ${msg.sender_type === 'customer' ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground'}`}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-2 flex-shrink-0">
            {session?.status === 'closed' ? (
              <p className="text-center text-xs text-muted-foreground py-2">This chat session has ended.</p>
            ) : (
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Type a message..."
                  rows={1}
                  className="flex-1 resize-none bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary max-h-24 overflow-y-auto"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isSending}
                  className="bg-primary text-primary-foreground rounded-xl p-2 hover:opacity-90 disabled:opacity-40 transition-opacity flex-shrink-0"
                >
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
