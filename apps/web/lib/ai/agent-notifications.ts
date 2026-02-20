/**
 * Agent Notification Service
 *
 * Bridge between background AI agents and the user-facing chat/UI.
 * Agents can push critical findings to users in real-time via this service.
 *
 * Storage strategy:
 *   1. Redis (primary) — durable, shared across all server instances.
 *      Uses Redis Lists for persistence and Pub/Sub for real-time fan-out.
 *   2. In-memory Map (fallback) — used when Redis is unavailable so the
 *      service never throws and single-instance dev keeps working.
 *
 * @version 2.0.0
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

// ── Constants ──────────────────────────────────────────────────────────

const MAX_NOTIFICATIONS_PER_TENANT = 100;
const REDIS_KEY_PREFIX = 'agent:notif:';
const REDIS_READ_PREFIX = 'agent:notif:read:';
const REDIS_PUBSUB_CHANNEL = 'agent:notifications';
const NOTIFICATION_TTL_SECONDS = 60 * 60 * 24; // 24 hours
const TENANT_TTL_MS = 60 * 60 * 1000; // 1 hour in-memory eviction

// ── In-memory fallback store ──────────────────────────────────────────

interface TenantStore {
  notifications: AgentNotification[];
  lastAccess: number;
}

const memoryStore = new Map<string, TenantStore>();
const emitter = new EventEmitter();
emitter.setMaxListeners(50);

let notificationCounter = 0;

// ── Redis layer (lazy-initialised, never throws) ──────────────────────

// Redis instance type (ioredis) — using any to avoid import-time dependency
type IoRedisInstance = any;

let redisPub: IoRedisInstance | null = null;
let redisSub: IoRedisInstance | null = null;
let redisReady = false;

async function initRedis(): Promise<void> {
  if (redisReady || redisPub) return; // already initialised or in progress
  const url = process.env.REDIS_URL;
  if (!url) return;

  try {
    const Redis = (await import('ioredis')).default;

    redisPub = new Redis(url, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      connectTimeout: 3000,
      enableReadyCheck: true,
    });
    await redisPub.connect();

    // Separate connection for subscriptions (ioredis requirement)
    redisSub = new Redis(url, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      connectTimeout: 3000,
      enableReadyCheck: true,
    });
    await redisSub.connect();

    // Subscribe to cross-instance notifications
    await redisSub.subscribe(REDIS_PUBSUB_CHANNEL);
    redisSub.on('message', (_channel: string, message: string) => {
      try {
        const notif: AgentNotification = JSON.parse(message);
        notif.createdAt = new Date(notif.createdAt);
        // Emit to local subscribers so SSE picks it up
        emitter.emit(`notification:${notif.tenantId}`, notif);
        if (notif.userId) {
          emitter.emit(`notification:${notif.tenantId}:${notif.userId}`, notif);
        }
      } catch { /* ignore malformed messages */ }
    });

    redisReady = true;
    console.log('[agent-notifications] Redis connected — using durable storage');
  } catch (err) {
    console.warn('[agent-notifications] Redis unavailable, using in-memory fallback', (err as Error).message);
    redisPub = null;
    redisSub = null;
  }
}

// Fire-and-forget initialisation on module load
initRedis().catch(() => {});

// ── In-memory helpers (fallback) ──────────────────────────────────────

function evictStaleTenants(): void {
  const now = Date.now();
  for (const [key, store] of memoryStore) {
    if (now - store.lastAccess > TENANT_TTL_MS) {
      memoryStore.delete(key);
    }
  }
}

const _evictionInterval = setInterval(evictStaleTenants, 10 * 60_000);
if (typeof _evictionInterval?.unref === 'function') _evictionInterval.unref();

function getMemoryStore(tenantId: string): TenantStore {
  let store = memoryStore.get(tenantId);
  if (!store) {
    store = { notifications: [], lastAccess: Date.now() };
    memoryStore.set(tenantId, store);
  } else {
    store.lastAccess = Date.now();
  }
  return store;
}

// ── Redis helpers ─────────────────────────────────────────────────────

function redisListKey(tenantId: string): string {
  return `${REDIS_KEY_PREFIX}${tenantId}`;
}

function redisReadSetKey(tenantId: string): string {
  return `${REDIS_READ_PREFIX}${tenantId}`;
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Push a notification from a background agent.
 * Persists to Redis when available, falls back to in-memory.
 */
export function pushAgentNotification(
  notification: Omit<AgentNotification, 'id' | 'createdAt' | 'read'>
): AgentNotification {
  const full: AgentNotification = {
    ...notification,
    id: `notif-${++notificationCounter}-${Date.now()}`,
    createdAt: new Date(),
    read: false,
  };

  const key = notification.tenantId;

  if (redisReady && redisPub) {
    // Persist to Redis list and publish for cross-instance delivery
    const serialised = JSON.stringify(full);
    redisPub
      .multi()
      .lpush(redisListKey(key), serialised)
      .ltrim(redisListKey(key), 0, MAX_NOTIFICATIONS_PER_TENANT - 1)
      .expire(redisListKey(key), NOTIFICATION_TTL_SECONDS)
      .publish(REDIS_PUBSUB_CHANNEL, serialised)
      .exec()
      .catch((err) => {
        console.warn('[agent-notifications] Redis write failed, falling back', err);
        pushToMemory(key, full);
      });
  } else {
    pushToMemory(key, full);
  }

  return full;
}

function pushToMemory(tenantId: string, notif: AgentNotification): void {
  const store = getMemoryStore(tenantId);
  store.notifications.unshift(notif);
  if (store.notifications.length > MAX_NOTIFICATIONS_PER_TENANT) {
    store.notifications.length = MAX_NOTIFICATIONS_PER_TENANT;
  }
  // Local-instance emit (for non-Redis path)
  emitter.emit(`notification:${tenantId}`, notif);
  if (notif.userId) {
    emitter.emit(`notification:${tenantId}:${notif.userId}`, notif);
  }
}

/**
 * Get notifications for a tenant/user.
 * Reads from Redis when available, falls back to in-memory.
 */
export async function getNotifications(filter: NotificationFilter): Promise<AgentNotification[]> {
  let notifications: AgentNotification[];

  if (redisReady && redisPub) {
    try {
      const raw = await redisPub.lrange(redisListKey(filter.tenantId), 0, MAX_NOTIFICATIONS_PER_TENANT - 1);
      const readSet = await redisPub.smembers(redisReadSetKey(filter.tenantId));
      const readIds = new Set(readSet);

      notifications = raw.map((item) => {
        const n: AgentNotification = JSON.parse(item);
        n.createdAt = new Date(n.createdAt);
        n.read = readIds.has(n.id);
        return n;
      });
    } catch {
      notifications = getMemoryStore(filter.tenantId).notifications;
    }
  } else {
    notifications = getMemoryStore(filter.tenantId).notifications;
  }

  let filtered = notifications;

  if (filter.userId) {
    filtered = filtered.filter((n) => !n.userId || n.userId === filter.userId);
  }
  if (filter.types && filter.types.length > 0) {
    filtered = filtered.filter((n) => filter.types!.includes(n.type));
  }
  if (filter.severities && filter.severities.length > 0) {
    filtered = filtered.filter((n) => filter.severities!.includes(n.severity));
  }
  if (filter.unreadOnly) {
    filtered = filtered.filter((n) => !n.read);
  }

  return filtered.slice(0, filter.limit || 20);
}

/**
 * Mark a notification as read.
 */
export async function markNotificationRead(tenantId: string, notificationId: string): Promise<boolean> {
  if (redisReady && redisPub) {
    try {
      await redisPub.sadd(redisReadSetKey(tenantId), notificationId);
      await redisPub.expire(redisReadSetKey(tenantId), NOTIFICATION_TTL_SECONDS);
      return true;
    } catch { /* fall through to memory */ }
  }

  const store = getMemoryStore(tenantId);
  const notif = store.notifications.find((n) => n.id === notificationId);
  if (notif) {
    notif.read = true;
    return true;
  }
  return false;
}

/**
 * Mark all notifications as read for a tenant/user.
 */
export async function markAllRead(tenantId: string, userId?: string): Promise<number> {
  if (redisReady && redisPub) {
    try {
      const raw = await redisPub.lrange(redisListKey(tenantId), 0, MAX_NOTIFICATIONS_PER_TENANT - 1);
      const ids = raw
        .map((item) => {
          const n = JSON.parse(item) as AgentNotification;
          if (!userId || !n.userId || n.userId === userId) return n.id;
          return null;
        })
        .filter(Boolean) as string[];

      if (ids.length > 0) {
        await redisPub.sadd(redisReadSetKey(tenantId), ...ids);
        await redisPub.expire(redisReadSetKey(tenantId), NOTIFICATION_TTL_SECONDS);
      }
      return ids.length;
    } catch { /* fall through */ }
  }

  const store = getMemoryStore(tenantId);
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
 * Works both with Redis Pub/Sub (cross-instance) and the local EventEmitter.
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
export async function getUnreadCount(tenantId: string, userId?: string): Promise<number> {
  const notifications = await getNotifications({ tenantId, userId, unreadOnly: true, limit: MAX_NOTIFICATIONS_PER_TENANT });
  return notifications.length;
}
