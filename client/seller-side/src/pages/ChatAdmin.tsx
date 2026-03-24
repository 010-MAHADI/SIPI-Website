import { useState, useEffect, useRef, useCallback, KeyboardEvent } from 'react';
import { MessageCircle, Send, Loader2, User, RefreshCw, CheckCheck, PhoneOff } from 'lucide-react';
import api from '@/lib/api';
import CustomerProfileModal from '@/components/CustomerProfileModal';

interface ChatMessage {
  id: number;
  session: string;
  sender_type: 'customer' | 'admin';
  content: string;
  is_read: boolean;
  created_at: string;
}

interface ChatSession {
  id: string;
  user: number | null;
  session_id: string | null;
  assigned_admin: number | null;
  assigned_admin_name: string | null;
  status: 'active' | 'closed';
  last_message_at: string;
  created_at: string;
  unread_count: number;
  last_message_preview: string | null;
  customer_name: string;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatFull(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatAdmin() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [profileCustomerId, setProfileCustomerId] = useState<number | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const lastIdRef = useRef<number | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.get('/chat/admin/sessions/');
      // Handle both paginated {results:[]} and plain array responses
      const data = res.data;
      setSessions(Array.isArray(data) ? data : (data.results ?? []));
    } catch (e) {
      console.error('Failed to fetch sessions', e);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  const fetchMessages = useCallback(async (sessionId: string, sinceId?: number | null) => {
    try {
      const params: Record<string, string> = { session_id: sessionId };
      if (sinceId) params.since_id = String(sinceId);
      const res = await api.get('/chat/messages/', { params });
      const newMsgs: ChatMessage[] = res.data;
      if (newMsgs.length > 0) {
        lastActivityRef.current = Date.now();
        lastIdRef.current = newMsgs[newMsgs.length - 1].id;
        if (sinceId) {
          setMessages(prev => [...prev, ...newMsgs]);
        } else {
          setMessages(newMsgs);
          lastIdRef.current = newMsgs[newMsgs.length - 1]?.id ?? null;
        }
      }
    } catch (e) {
      console.error('Failed to fetch messages', e);
    }
  }, []);

  const scheduleNextPoll = useCallback((sessionId: string) => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    const idle = Date.now() - lastActivityRef.current > 30000;
    const delay = idle ? 9000 : 2500;
    pollTimerRef.current = setTimeout(async () => {
      await fetchMessages(sessionId, lastIdRef.current);
      await fetchSessions();
      scheduleNextPoll(sessionId);
    }, delay);
  }, [fetchMessages, fetchSessions]);

  const openSession = useCallback(async (session: ChatSession) => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    setActiveSession(session);
    setMessages([]);
    setConfirmEnd(false);
    lastIdRef.current = null;
    await fetchMessages(session.id, null);
    scheduleNextPoll(session.id);
    // mark as read
    api.post('/chat/read/', { session_id: session.id, sender_type: 'admin' }).catch(() => {});
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, unread_count: 0 } : s));
  }, [fetchMessages, scheduleNextPoll]);

  const sendMessage = useCallback(async () => {
    if (!activeSession || !input.trim() || isSending) return;
    const content = input.trim();
    const optimistic: ChatMessage = {
      id: Date.now(),
      session: activeSession.id,
      sender_type: 'admin',
      content,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    setInput('');
    lastActivityRef.current = Date.now();
    setIsSending(true);
    try {
      const res = await api.post('/chat/message/', {
        session: activeSession.id,
        sender_type: 'admin',
        content,
      });
      const real: ChatMessage = res.data;
      setMessages(prev => prev.map(m => m.id === optimistic.id ? real : m));
      lastIdRef.current = real.id;
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    } finally {
      setIsSending(false);
    }
  }, [activeSession, input, isSending]);

  const assignSelf = useCallback(async () => {
    if (!activeSession) return;
    try {
      await api.post('/chat/admin/assign/', { session_id: activeSession.id });
      setActiveSession(prev => prev ? { ...prev, assigned_admin_name: 'You' } : prev);
    } catch (e) {
      console.error('Assign failed', e);
    }
  }, [activeSession]);

  const endChat = useCallback(async () => {
    if (!activeSession) return;
    try {
      const res = await api.post('/chat/close/', { session_id: activeSession.id });
      setActiveSession(res.data);
      setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, status: 'closed' } : s));
    } catch (e) {
      console.error('End chat failed', e);
    }
    setConfirmEnd(false);
  }, [activeSession]);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); };
  }, []);

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background border border-border rounded-lg overflow-hidden">
      {/* Session list */}
      <div className="w-72 border-r border-border flex flex-col flex-shrink-0">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-sm">Live Chats</h2>
          <button onClick={fetchSessions} className="text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingSessions && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loadingSessions && sessions.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8 px-4">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No active chats</p>
            </div>
          )}
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => openSession(s)}
              className={`w-full text-left px-3 py-3 border-b border-border hover:bg-muted/50 transition-colors ${activeSession?.id === s.id ? 'bg-muted' : ''}`}
            >
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-medium truncate">{s.customer_name}</span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatTime(s.last_message_at)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{s.last_message_preview || 'No messages yet'}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                      {s.status}
                    </span>
                    {s.unread_count > 0 && (
                      <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {s.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat window */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeSession ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Select a conversation to start</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <button
                    className="text-sm font-semibold hover:underline text-left"
                    onClick={() => activeSession.user && setProfileCustomerId(activeSession.user)}
                    title={activeSession.user ? "View customer profile" : undefined}
                  >
                    {activeSession.customer_name}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {activeSession.assigned_admin_name ? `Assigned to: ${activeSession.assigned_admin_name}` : 'Unassigned'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full ${activeSession.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                  {activeSession.status}
                </span>
                {!activeSession.assigned_admin_name && (
                  <button onClick={assignSelf} className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-full hover:opacity-90 transition-opacity">
                    Assign to me
                  </button>
                )}
                {activeSession.status === 'active' && (
                  confirmEnd ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">End chat?</span>
                      <button
                        onClick={endChat}
                        className="text-xs bg-red-500 text-white px-2.5 py-1 rounded-full hover:bg-red-600 transition-colors"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmEnd(false)}
                        className="text-xs border px-2.5 py-1 rounded-full hover:bg-muted transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmEnd(true)}
                      className="flex items-center gap-1 text-xs text-destructive border border-destructive/30 px-2.5 py-1 rounded-full hover:bg-destructive/10 transition-colors"
                      title="End chat"
                    >
                      <PhoneOff className="w-3.5 h-3.5" /> End Chat
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] rounded-2xl px-3 py-2 ${
                    msg.sender_type === 'admin'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm'
                  }`}>
                    <p className="text-sm break-words">{msg.content}</p>
                    <div className={`flex items-center gap-1 mt-0.5 ${msg.sender_type === 'admin' ? 'justify-end' : ''}`}>
                      <span className={`text-[10px] ${msg.sender_type === 'admin' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {formatFull(msg.created_at)}
                      </span>
                      {msg.sender_type === 'admin' && msg.is_read && (
                        <CheckCheck className="w-3 h-3 text-primary-foreground/70" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border p-3 flex-shrink-0">
              {activeSession.status === 'closed' ? (
                <p className="text-center text-sm text-muted-foreground py-2">This session is closed.</p>
              ) : (
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Type a reply..."
                    rows={1}
                    className="flex-1 resize-none bg-muted rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary max-h-24 overflow-y-auto"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || isSending}
                    className="bg-primary text-primary-foreground rounded-xl p-2 hover:opacity-90 disabled:opacity-40 transition-opacity flex-shrink-0"
                  >
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <CustomerProfileModal
        customerId={profileCustomerId}
        onClose={() => setProfileCustomerId(null)}
      />
    </div>
  );
}
