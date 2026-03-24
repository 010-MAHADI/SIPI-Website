import { useRef, useEffect, useState, KeyboardEvent } from 'react';
import { ArrowLeft, Send, Loader2, MessageCircle, PhoneOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/hooks/useChat';
import SiteHeader from '@/components/SiteHeader';

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function LiveChatPage() {
  const { isLoggedIn } = useAuth();
  const { session, messages, isLoading, isSending, openChat, sendMessage, endChat } = useChat(isLoggedIn);
  const [input, setInput] = useState('');
  const [confirmEnd, setConfirmEnd] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    openChat();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  return (
    <div className="flex flex-col h-screen bg-background">
      <SiteHeader />
      <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto overflow-hidden">
        {/* Chat header */}
        <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button onClick={() => navigate(-1)} className="hover:opacity-70 transition-opacity">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-2 h-2 bg-green-400 rounded-full" />
            <span className="font-semibold">Flypick Support</span>
          </div>
          {session && session.status === 'active' && (
            confirmEnd ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-primary-foreground/80">End chat?</span>
                <button
                  onClick={async () => { await endChat(); setConfirmEnd(false); }}
                  className="text-xs bg-red-500 text-white px-2.5 py-1 rounded-full hover:bg-red-600 transition-colors"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmEnd(false)}
                  className="text-xs bg-white/20 px-2.5 py-1 rounded-full hover:bg-white/30 transition-colors"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmEnd(true)}
                className="hover:opacity-70 transition-opacity ml-auto"
                title="End chat"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            )
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isLoading && messages.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Hi! How can we help you today?</p>
              <p className="text-sm mt-1">Send us a message and we'll get back to you.</p>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.sender_type === 'customer' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                msg.sender_type === 'customer'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-muted text-foreground rounded-bl-sm'
              }`}>
                <p className="text-sm break-words">{msg.content}</p>
                <p className={`text-[10px] mt-1 ${msg.sender_type === 'customer' ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground'}`}>
                  {formatTime(msg.created_at)}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="fixed bottom-16 left-0 right-0 bg-card border-t border-border p-3 max-w-2xl mx-auto w-full">
          {session?.status === 'closed' ? (
            <p className="text-center text-sm text-muted-foreground py-2">This chat session has ended.</p>
          ) : (
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Type a message..."
                rows={1}
                className="flex-1 resize-none bg-muted rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary max-h-28 overflow-y-auto"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isSending}
                className="bg-primary text-primary-foreground rounded-xl p-2.5 hover:opacity-90 disabled:opacity-40 transition-opacity flex-shrink-0"
              >
                {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
