/**
 * NotificationCenter Module
 *
 * Re-exports and extends the AgentNotificationBell for use as a generic
 * notification system. Provides a React context provider, hook, and UI
 * components for in-app notifications throughout the platform.
 *
 * @version 1.0.0
 */

'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { AgentNotificationBell } from '@/components/ai/AgentNotificationBell';

// ── Types ─────────────────────────────────────────────────────────────

export type NotificationType = 'agent' | 'system' | 'contract' | 'approval' | 'signature' | 'deadline';
export type NotificationCategory = 'ai' | 'workflow' | 'alert' | 'info';
export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Notification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  source: string;
  actionUrl?: string;
  createdAt: string;
  read: boolean;
  metadata?: Record<string, unknown>;
}

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

// ── Context ───────────────────────────────────────────────────────────

const NotificationContext = createContext<NotificationContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────

let notifCounter = 0;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const addNotification = useCallback(
    (partial: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
      const notification: Notification = {
        ...partial,
        id: `notif-local-${++notifCounter}-${Date.now()}`,
        createdAt: new Date().toISOString(),
        read: false,
      };
      setNotifications((prev) => [notification, ...prev].slice(0, 100));
    },
    [],
  );

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, addNotification, markRead, markAllRead, clearAll }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a <NotificationProvider>');
  }
  return ctx;
}

// ── UI Components ─────────────────────────────────────────────────────

/**
 * NotificationBell — wraps the existing AgentNotificationBell.
 * Drop-in replacement that can be extended with the local context.
 */
export const NotificationBell = AgentNotificationBell;

/**
 * NotificationCenter — the full notification dropdown/panel.
 * Currently delegates to AgentNotificationBell (which includes the panel).
 * Can be extended with additional notification channels.
 */
export const NotificationCenter = AgentNotificationBell;
