/**
 * Notification Center - Placeholder Module
 * 
 * Real notification UI lives in:
 *   - components/ui/notification-system.tsx (NotificationProvider, NotificationCenter, useNotifications)
 *   - components/notifications/NotificationCenter.tsx
 *   - components/collaboration/NotificationCenter.tsx
 * 
 * These exports provide no-op stubs for the originally planned module API.
 */

import React from 'react';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

export type NotificationType = 'info' | 'warning' | 'error' | 'success';

// No-op provider
export const NotificationProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) =>
  React.createElement(React.Fragment, null, children);

// No-op bell component
export const NotificationBell: React.FC = () => null;

// No-op hooks
export function useNotifications() {
  return {
    notifications: [] as Notification[],
    unreadCount: 0,
    markAsRead: (_id: string) => {},
    markAllAsRead: () => {},
    dismiss: (_id: string) => {},
  };
}

export function useDemoNotifications() {
  return { addDemo: () => {} };
}
