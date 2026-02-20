/**
 * Agent Notification Service
 * 
 * Bridge between background AI agents and the user-facing chat/UI.
 * Agents can push critical findings to users in real-time via this service.
 * The service emits events that WebSocket handlers or SSE endpoints can subscribe to.
 * 
 * @version 1.0.0
 */

import { EventEmitter } from 'events';

// ── Types ─────────────────────────────────────────────────────────────

export interface AgentNotification {
  id: string;
  tenantId: string;
  userId?: string;
  type: 'risk_alert' | 'compliance_issue' | 'opportunity' | 'deadline' | 'learning' | 'health_change' | 'agent_complete';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  message: string;
  source: string;
  metadata?: Record<string, unknown>;
  actionUrl?: string;
  createdAt: Date;
  read: boolean;
}

export interface NotificationFilter {
  tenantId: string;
  userId?: string;
  types?: AgentNotification['type'][];
  severities?: AgentNotification['severity'][];
  unreadOnly?: boolean;
  limit?: number;
}

// ── In-memory notification store (production should use Redis pub/sub) ──

const MAX_NOTIFICATIONS_PER_TENANT = 100;
const notificationStore = new Map<string, AgentNotification[]>();
const emitter = new EventEmitter();
emitter.setMaxListeners(50);

let notificationCounter = 0;

/**
 * Push a notification from a background agent.
 * This is the primary API for agents to communicate findings to users.
 */
export function pushAgentNotification(notification: Omit<AgentNotification, 'id' | 'createdAt' | 'read'>): AgentNotification {
  const full: AgentNotification = {
    ...notification,
    id: `notif-${++notificationCounter}-${Date.now()}`,
    createdAt: new Date(),
    read: false,
  };

  const key = notification.tenantId;
  const existing = notificationStore.get(key) || [];
  existing.unshift(full);

  // Trim to max size
  if (existing.length > MAX_NOTIFICATIONS_PER_TENANT) {
    existing.length = MAX_NOTIFICATIONS_PER_TENANT;
  }

  notificationStore.set(key, existing);

  // Emit for real-time subscribers (WebSocket handlers)
  emitter.emit(`notification:${key}`, full);
  if (notification.userId) {
    emitter.emit(`notification:${key}:${notification.userId}`, full);
  }

  return full;
}

/**
 * Get notifications for a tenant/user.
 */
export function getNotifications(filter: NotificationFilter): AgentNotification[] {
  const all = notificationStore.get(filter.tenantId) || [];

  let filtered = all;

  if (filter.userId) {
    filtered = filtered.filter(n => !n.userId || n.userId === filter.userId);
  }

  if (filter.types && filter.types.length > 0) {
    filtered = filtered.filter(n => filter.types!.includes(n.type));
  }

  if (filter.severities && filter.severities.length > 0) {
    filtered = filtered.filter(n => filter.severities!.includes(n.severity));
  }

  if (filter.unreadOnly) {
    filtered = filtered.filter(n => !n.read);
  }

  return filtered.slice(0, filter.limit || 20);
}

/**
 * Mark a notification as read.
 */
export function markNotificationRead(tenantId: string, notificationId: string): boolean {
  const notifications = notificationStore.get(tenantId);
  if (!notifications) return false;

  const notif = notifications.find(n => n.id === notificationId);
  if (notif) {
    notif.read = true;
    return true;
  }
  return false;
}

/**
 * Mark all notifications as read for a tenant/user.
 */
export function markAllRead(tenantId: string, userId?: string): number {
  const notifications = notificationStore.get(tenantId);
  if (!notifications) return 0;

  let count = 0;
  for (const n of notifications) {
    if (!n.read && (!userId || !n.userId || n.userId === userId)) {
      n.read = true;
      count++;
    }
  }
  return count;
}

/**
 * Subscribe to real-time notifications for a tenant.
 * Returns an unsubscribe function.
 */
export function subscribeToNotifications(
  tenantId: string,
  userId: string | undefined,
  callback: (notification: AgentNotification) => void
): () => void {
  const eventKey = userId ? `notification:${tenantId}:${userId}` : `notification:${tenantId}`;
  emitter.on(eventKey, callback);

  return () => {
    emitter.off(eventKey, callback);
  };
}

/**
 * Get unread count for a tenant/user.
 */
export function getUnreadCount(tenantId: string, userId?: string): number {
  const notifications = notificationStore.get(tenantId) || [];
  return notifications.filter(n => !n.read && (!userId || !n.userId || n.userId === userId)).length;
}
