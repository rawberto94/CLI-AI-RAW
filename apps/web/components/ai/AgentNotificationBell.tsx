'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Bell, Check, CheckCheck, AlertTriangle, Info, Zap, Brain, MessageSquare, FileText, Users, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebSocket } from '@/contexts/websocket-context';
import { trackUxEventClient } from '@/lib/analytics/ux-events-client';

// ---- Agent-origin notifications (existing) ----
interface AgentNotification {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical' | 'success';
  title: string;
  message: string;
  source: string;
  actionUrl?: string;
  createdAt: string;
  read: boolean;
}

// ---- System/collaboration-origin notifications (merged in from the old collaboration bell) ----
interface SystemNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

// ---- Unified shape the panel actually renders ----
interface MergedNotification {
  id: string;
  origin: 'agent' | 'system';
  title: string;
  message: string;
  href?: string;
  createdAt: string;
  read: boolean;
  severity?: AgentNotification['severity'];
  rawType: string;
}

const systemTypeIcon: Record<string, React.ElementType> = {
  APPROVAL_REQUEST: FileText,
  APPROVAL_COMPLETED: Check,
  COMMENT_MENTION: MessageSquare,
  COMMENT_REPLY: MessageSquare,
  CONTRACT_DEADLINE: Clock,
  CONTRACT_UPDATE: FileText,
  WORKFLOW_STEP: Users,
  SHARE_INVITE: Users,
};

function fromAgent(n: AgentNotification): MergedNotification {
  return {
    id: `agent:${n.id}`,
    origin: 'agent',
    title: n.title,
    message: n.message,
    href: n.actionUrl,
    createdAt: n.createdAt,
    read: n.read,
    severity: n.severity,
    rawType: n.source,
  };
}

function fromSystem(n: SystemNotification): MergedNotification {
  return {
    id: `system:${n.id}`,
    origin: 'system',
    title: n.title,
    message: n.message,
    href: n.link,
    createdAt: n.createdAt,
    read: n.isRead,
    rawType: n.type,
  };
}

type FilterTab = 'all' | 'agent' | 'system';

export function AgentNotificationBell() {
  const [agentNotifications, setAgentNotifications] = useState<AgentNotification[]>([]);
  const [systemNotifications, setSystemNotifications] = useState<SystemNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const wsContext = useWebSocket();

  // ---- fetch: agent notifications ----
  const fetchAgentNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/notifications?limit=20');
      if (!res.ok) return;
      const data = await res.json();
      setAgentNotifications(data.notifications || []);
    } catch {
      // Silently fail — notifications are non-critical
    }
  }, []);

  // ---- fetch: system/collaboration notifications ----
  const fetchSystemNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setSystemNotifications(data.notifications || []);
      }
    } catch {
      // Silently fail — notifications are non-critical
    }
  }, []);

  useEffect(() => {
    fetchAgentNotifications();
    fetchSystemNotifications();
  }, [fetchAgentNotifications, fetchSystemNotifications]);

  // SSE subscription for real-time agent notifications
  useEffect(() => {
    let es: EventSource | null = null;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    function connectSSE() {
      if (typeof EventSource === 'undefined') {
        // Fallback to polling for browsers without SSE
        fallbackInterval = setInterval(fetchAgentNotifications, 30_000);
        return;
      }

      es = new EventSource('/api/ai/notifications/stream');
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const notification: AgentNotification = JSON.parse(event.data);
          setAgentNotifications(prev => [notification, ...prev].slice(0, 50));
        } catch {
          // Invalid data
        }
      };

      es.onerror = () => {
        // SSE disconnected — fall back to polling until reconnect
        es?.close();
        eventSourceRef.current = null;
        if (!fallbackInterval) {
          fallbackInterval = setInterval(fetchAgentNotifications, 30_000);
        }
        // Attempt reconnect after 10 seconds
        setTimeout(() => {
          if (document.visibilityState === 'visible') {
            if (fallbackInterval) { clearInterval(fallbackInterval); fallbackInterval = null; }
            connectSSE();
          }
        }, 10_000);
      };
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        if (!eventSourceRef.current) connectSSE();
      } else {
        es?.close();
        eventSourceRef.current = null;
        if (fallbackInterval) { clearInterval(fallbackInterval); fallbackInterval = null; }
      }
    }

    connectSSE();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      es?.close();
      eventSourceRef.current = null;
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [fetchAgentNotifications]);

  // Real-time system notifications via WebSocket (same mechanism the old collaboration bell used)
  useEffect(() => {
    if (!wsContext?.onEvent) return;

    const unsubscribe = wsContext.onEvent((event: unknown) => {
      const typedEvent = event as { type?: string; data?: SystemNotification };
      if (typedEvent.type === 'notification' && typedEvent.data) {
        setSystemNotifications(prev => [typedEvent.data!, ...prev]);
      }
    });

    return () => unsubscribe?.();
  }, [wsContext]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const merged = useMemo<MergedNotification[]>(() => {
    const all = [
      ...agentNotifications.map(fromAgent),
      ...systemNotifications.map(fromSystem),
    ];
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return all;
  }, [agentNotifications, systemNotifications]);

  const filtered = useMemo(
    () => (filter === 'all' ? merged : merged.filter(n => n.origin === filter)),
    [merged, filter],
  );

  const unreadCount = useMemo(() => merged.filter(n => !n.read).length, [merged]);

  const markRead = async (n: MergedNotification) => {
    if (n.origin === 'agent') {
      const rawId = n.id.replace(/^agent:/, '');
      setAgentNotifications(prev => prev.map(x => (x.id === rawId ? { ...x, read: true } : x)));
      try {
        await fetch('/api/ai/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notificationId: rawId }),
        });
      } catch {
        // ignore
      }
    } else {
      const rawId = n.id.replace(/^system:/, '');
      setSystemNotifications(prev => prev.map(x => (x.id === rawId ? { ...x, isRead: true } : x)));
      try {
        await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notificationIds: [rawId] }),
        });
      } catch {
        // ignore
      }
    }
  };

  const markAllRead = async () => {
    setAgentNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setSystemNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    try {
      await Promise.all([
        fetch('/api/ai/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ markAllRead: true }),
        }),
        fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ markAllRead: true }),
        }),
      ]);
    } catch {
      // ignore
    }
  };

  const originIcon = (n: MergedNotification) => {
    if (n.origin === 'agent') {
      switch (n.severity) {
        case 'critical': return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
        case 'warning': return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
        case 'success': return <Check className="h-3.5 w-3.5 text-emerald-500" />;
        default: return <Info className="h-3.5 w-3.5 text-blue-500" />;
      }
    }
    const Icon = systemTypeIcon[n.rawType] ?? Bell;
    return <Icon className="h-3.5 w-3.5 text-violet-500" />;
  };

  const sourceLabel = (n: MergedNotification) => {
    if (n.origin === 'agent') {
      if (n.rawType.includes('risk') || n.rawType.includes('compliance')) return <AlertTriangle className="h-3 w-3" />;
      if (n.rawType.includes('learning') || n.rawType.includes('intelligence')) return <Brain className="h-3 w-3" />;
      return <Zap className="h-3 w-3" />;
    }
    return null;
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60_000) return 'now';
    if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m`;
    if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h`;
    return `${Math.round(diff / 86_400_000)}d`;
  };

  const tabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'agent', label: 'Agents' },
    { id: 'system', label: 'System' },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => {
          const next = !isOpen;
          setIsOpen(next);
          if (next) {
            // impression when the panel opens (agentic UX 1.5)
            void trackUxEventClient('notification_impression', {
              unreadCount,
              source: 'agent_notification_bell',
            });
          }
        }}
        className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-violet-600 text-white text-[10px] font-bold px-1"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 max-h-96 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-violet-500" />
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[10px] text-violet-600 hover:text-violet-800 font-medium flex items-center gap-1"
                >
                  <CheckCheck className="h-3 w-3" /> Mark all read
                </button>
              )}
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-1.5 px-4 py-2 border-b border-slate-100 dark:border-slate-800">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setFilter(t.id)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors ${
                    filter === t.id
                      ? 'bg-violet-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Notification List */}
            <div className="overflow-y-auto max-h-72">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                  <Bell className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-xs">No notifications</p>
                </div>
              ) : (
                filtered.map((n) => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${
                      !n.read ? 'bg-violet-50/30 dark:bg-violet-950/10' : ''
                    }`}
                    onClick={() => {
                      if (!n.read) markRead(n);
                      void trackUxEventClient('notification_click', {
                        notificationId: n.id,
                        origin: n.origin,
                        href: n.href ?? null,
                        source: 'agent_notification_bell',
                      });
                      if (n.href) window.location.href = n.href;
                    }}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5">{originIcon(n)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-xs font-medium truncate ${!n.read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                            {n.title}
                          </p>
                          <span className="text-[10px] text-slate-400 shrink-0 ml-2">{timeAgo(n.createdAt)}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{n.message}</p>
                        {n.origin === 'agent' && (
                          <div className="flex items-center gap-1.5 mt-1">
                            {sourceLabel(n)}
                            <span className="text-[10px] text-slate-400 capitalize">{n.rawType.replace(/-/g, ' ')}</span>
                          </div>
                        )}
                      </div>
                      {!n.read && (
                        <div className="w-2 h-2 rounded-full bg-violet-500 shrink-0 mt-1.5" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {filtered.length > 0 && (
              <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <a href="/notifications" className="text-[11px] text-violet-600 hover:text-violet-800 font-medium">
                  All notifications →
                </a>
                <a href="/ai/agents" className="text-[11px] text-violet-600 hover:text-violet-800 font-medium">
                  Agent dashboard →
                </a>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AgentNotificationBell;
