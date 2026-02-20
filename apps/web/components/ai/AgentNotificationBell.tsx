'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, Check, CheckCheck, X, AlertTriangle, Info, Zap, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

export function AgentNotificationBell() {
  const [notifications, setNotifications] = useState<AgentNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/ai/notifications?limit=20');
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // Silently fail — notifications are non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  // SSE subscription for real-time notifications
  useEffect(() => {
    fetchNotifications(); // Initial load

    let es: EventSource | null = null;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    function connectSSE() {
      if (typeof EventSource === 'undefined') {
        // Fallback to polling for browsers without SSE
        fallbackInterval = setInterval(fetchNotifications, 30_000);
        return;
      }

      es = new EventSource('/api/ai/notifications/stream');
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const notification: AgentNotification = JSON.parse(event.data);
          setNotifications(prev => [notification, ...prev].slice(0, 50));
          setUnreadCount(prev => prev + 1);
        } catch {
          // Invalid data
        }
      };

      es.onerror = () => {
        // SSE disconnected — fall back to polling until reconnect
        es?.close();
        eventSourceRef.current = null;
        if (!fallbackInterval) {
          fallbackInterval = setInterval(fetchNotifications, 30_000);
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

    // Only connect SSE when tab is visible
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        if (!eventSourceRef.current) connectSSE();
      } else {
        // Tab hidden — close SSE to save resources, stop polling
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
  }, [fetchNotifications]);

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

  const markAllRead = async () => {
    try {
      await fetch('/api/ai/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const markRead = async (id: string) => {
    try {
      await fetch('/api/ai/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
  };

  const severityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
      case 'success': return <Check className="h-3.5 w-3.5 text-emerald-500" />;
      default: return <Info className="h-3.5 w-3.5 text-blue-500" />;
    }
  };

  const sourceIcon = (source: string) => {
    if (source.includes('risk') || source.includes('compliance')) return <AlertTriangle className="h-3 w-3" />;
    if (source.includes('learning') || source.includes('intelligence')) return <Brain className="h-3 w-3" />;
    return <Zap className="h-3 w-3" />;
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60_000) return 'now';
    if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m`;
    if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h`;
    return `${Math.round(diff / 86_400_000)}d`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        title="Agent Notifications"
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
                <Bot className="h-4 w-4 text-violet-500" />
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Agent Alerts</span>
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

            {/* Notification List */}
            <div className="overflow-y-auto max-h-72">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                  <Bell className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-xs">No agent notifications yet</p>
                  <p className="text-[10px] mt-0.5">Agents will notify you of important findings</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${
                      !n.read ? 'bg-violet-50/30 dark:bg-violet-950/10' : ''
                    }`}
                    onClick={() => {
                      if (!n.read) markRead(n.id);
                      if (n.actionUrl) window.location.href = n.actionUrl;
                    }}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5">{severityIcon(n.severity)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-xs font-medium truncate ${!n.read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                            {n.title}
                          </p>
                          <span className="text-[10px] text-slate-400 shrink-0 ml-2">{timeAgo(n.createdAt)}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{n.message}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          {sourceIcon(n.source)}
                          <span className="text-[10px] text-slate-400 capitalize">{n.source.replace(/-/g, ' ')}</span>
                        </div>
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
            {notifications.length > 0 && (
              <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 text-center">
                <a href="/ai/agents" className="text-[11px] text-violet-600 hover:text-violet-800 font-medium">
                  View Agent Dashboard →
                </a>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Bot icon inline — avoids extra import
function Bot(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}
