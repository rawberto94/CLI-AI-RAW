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
const TENANT_TTL_MS = 60 * 60 * 1000; // 1 hour inactivity → evict

interface TenantStore {
  notifications: AgentNotification[];
  lastAccess: number;
}

const notificationStore = new Map<string, TenantStore>();
const emitter = new EventEmitter();
emitter.setMaxListeners(50);

let notificationCounter = 0;

// ── Periodic eviction of stale tenants (every 10 minutes) ──

function evictStaleTenants(): void {
  const now = Date.now();
  for (const [key, store] of notificationStore) {
    if (now - store.lastAccess > TENANT_TTL_MS) {
      notificationStore.delete(key);
    }
  }
}

const _evictionInterval = setInterval(evictStaleTenants, 10 * 60_000);
// Allow Node.js to exit even if interval is running
if (typeof _evictionInterval?.unref === 'function') _evictionInterval.unref();

/** Get or create tenant store entry */
function getTenantStore(tenantId: string): TenantStore {
  let store = notificationStore.get(tenantId);
  if (!store) {
    store = { notifications: [], lastAccess: Date.now() };
    notificationStore.set(tenantId, store);
  } else {
    store.lastAccess = Date.now();
  }
  return store;
}

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
  const store = getTenantStore(key);
  store.notifications.unshift(full);

  // Trim to max size
  if (store.notifications.length > MAX_NOTIFICATIONS_PER_TENANT) {
    store.notifications.length = MAX_NOTIFICATIONS_PER_TENANT;
  }

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
  const store = getTenantStore(filter.tenantId);
  let filtered = store.notifications;

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
  const store = getTenantStore(tenantId);
  const notif = store.notifications.find(n => n.id === notificationId);
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
  const store = getTenantStore(tenantId);
  let count = 0;
  for (const n of store.notifications) {
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
  const store = getTenantStore(tenantId);
  return store.notifications.filter(n => !n.read && (!userId || !n.userId || n.userId === userId)).length;
}
