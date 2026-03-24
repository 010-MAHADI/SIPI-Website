import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/lib/api';

export interface ChatMessage {
  id: number;
  session: string;
  sender_type: 'customer' | 'admin';
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface ChatSession {
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

const SESSION_KEY = 'chat_session_id';
const ANON_KEY = 'chat_anon_id';

function getAnonId(): string {
  let id = localStorage.getItem(ANON_KEY);
  if (!id) {
    id = `anon_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(ANON_KEY, id);
  }
  return id;
}

export function useChat(isAuthenticated: boolean) {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const lastIdRef = useRef<number | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const initSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const payload: Record<string, string> = {};
      if (!isAuthenticated) {
        payload.session_id = getAnonId();
      }
      const res = await api.post('/chat/session/', payload);
      const s: ChatSession = res.data;
      setSession(s);
      localStorage.setItem(SESSION_KEY, s.id);
      return s;
    } catch (e) {
      console.error('Chat session init failed', e);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

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
      console.error('Fetch messages failed', e);
    }
  }, []);

  const scheduleNextPoll = useCallback((sessionId: string) => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    const idle = Date.now() - lastActivityRef.current > 30000;
    const delay = idle ? 9000 : 2500;
    pollTimerRef.current = setTimeout(async () => {
      await fetchMessages(sessionId, lastIdRef.current);
      scheduleNextPoll(sessionId);
    }, delay);
  }, [fetchMessages]);

  const openChat = useCallback(async () => {
    setIsOpen(true);
    let s = session;
    if (!s) {
      s = await initSession();
    }
    if (!s) return;
    await fetchMessages(s.id, null);
    scheduleNextPoll(s.id);
    // mark admin messages as read
    api.post('/chat/read/', { session_id: s.id, sender_type: 'customer' }).catch(() => {});
  }, [session, initSession, fetchMessages, scheduleNextPoll]);

  const closeChat = useCallback(() => {
    setIsOpen(false);
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!session || !content.trim()) return;
    const optimistic: ChatMessage = {
      id: Date.now(),
      session: session.id,
      sender_type: 'customer',
      content: content.trim(),
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    lastActivityRef.current = Date.now();
    setIsSending(true);
    try {
      const res = await api.post('/chat/message/', {
        session: session.id,
        sender_type: 'customer',
        content: content.trim(),
      });
      const real: ChatMessage = res.data;
      setMessages(prev => prev.map(m => m.id === optimistic.id ? real : m));
      lastIdRef.current = real.id;
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    } finally {
      setIsSending(false);
    }
  }, [session]);

  const endChat = useCallback(async () => {
    if (!session) return;
    try {
      const res = await api.post('/chat/close/', { session_id: session.id });
      setSession(res.data);
    } catch (e) {
      console.error('End chat failed', e);
    }
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
  }, [session]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  return { session, messages, isOpen, isLoading, isSending, openChat, closeChat, sendMessage, endChat };
}
