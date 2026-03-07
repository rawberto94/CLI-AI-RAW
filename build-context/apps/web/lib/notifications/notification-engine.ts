/**
 * Push Notification Engine
 *
 * Centralized notification system for agent-generated events.
 * Supports in-app notifications with priority levels, batching,
 * and channel routing (in-app, email digest, webhook).
 */

import { prisma } from '@/lib/prisma';

// ============================================================================
// TYPES
// ============================================================================

export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low';
export type NotificationChannel = 'in-app' | 'email' | 'webhook';
export type NotificationCategory =
  | 'deadline'
  | 'health-alert'
  | 'opportunity'
  | 'validation-issue'
  | 'workflow-update'
  | 'compliance-alert'
  | 'agent-action'
  | 'system';

export interface Notification {
  id: string;
  tenantId: string;
  userId?: string;
  title: string;
  message: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  /** Agent that generated this notification */
  sourceAgent?: string;
  /** Related contract ID */
  contractId?: string;
  /** Link to navigate to on click */
  actionUrl?: string;
  /** Action label (e.g. "View Contract") */
  actionLabel?: string;
  /** Additional structured metadata */
  metadata?: Record<string, unknown>;
  /** Whether the notification has been read */
  read: boolean;
  /** Whether the notification has been dismissed */
  dismissed: boolean;
  createdAt: Date;
  readAt?: Date;
}

export interface NotificationPayload {
  tenantId: string;
  userId?: string;
  title: string;
  message: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  channels?: NotificationChannel[];
  sourceAgent?: string;
  contractId?: string;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// IN-MEMORY NOTIFICATION STORE (ring buffer for real-time delivery)
// ============================================================================

const MAX_BUFFER_SIZE = 500;

class NotificationBuffer {
  private buffer: Notification[] = [];
  private subscribers: Map<string, ((notification: Notification) => void)[]> = new Map();

  push(notification: Notification): void {
    this.buffer.push(notification);
    if (this.buffer.length > MAX_BUFFER_SIZE) {
      this.buffer.shift();
    }

    // Notify real-time subscribers
    const key = notification.userId
      ? `${notification.tenantId}:${notification.userId}`
      : notification.tenantId;
    const handlers = this.subscribers.get(key) || [];
    for (const handler of handlers) {
      try {
        handler(notification);
      } catch {
        // Subscriber error — non-critical
      }
    }

    // Also notify tenant-wide subscribers
    const tenantHandlers = this.subscribers.get(notification.tenantId) || [];
    for (const handler of tenantHandlers) {
      try {
        handler(notification);
      } catch {
        // Non-critical
      }
    }
  }

  getRecent(tenantId: string, userId?: string, limit = 50): Notification[] {
    return this.buffer
      .filter(n => n.tenantId === tenantId && (!userId || !n.userId || n.userId === userId))
      .slice(-limit)
      .reverse();
  }

  getUnreadCount(tenantId: string, userId?: string): number {
    return this.buffer.filter(
      n => n.tenantId === tenantId && (!userId || !n.userId || n.userId === userId) && !n.read
    ).length;
  }

  markRead(notificationId: string): boolean {
    const notification = this.buffer.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      notification.readAt = new Date();
      return true;
    }
    return false;
  }

  markAllRead(tenantId: string, userId?: string): number {
    let count = 0;
    for (const n of this.buffer) {
      if (n.tenantId === tenantId && (!userId || !n.userId || n.userId === userId) && !n.read) {
        n.read = true;
        n.readAt = new Date();
        count++;
      }
    }
    return count;
  }

  subscribe(tenantId: string, userId: string | undefined, handler: (n: Notification) => void): () => void {
    const key = userId ? `${tenantId}:${userId}` : tenantId;
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, []);
    }
    this.subscribers.get(key)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.subscribers.get(key);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index >= 0) handlers.splice(index, 1);
      }
    };
  }
}

export const notificationBuffer = new NotificationBuffer();

// ============================================================================
// PRIORITY → CHANNEL ROUTING
// ============================================================================

function resolveChannels(priority: NotificationPriority, explicitChannels?: NotificationChannel[]): NotificationChannel[] {
  if (explicitChannels && explicitChannels.length > 0) return explicitChannels;

  switch (priority) {
    case 'critical':
      return ['in-app', 'email', 'webhook'];
    case 'high':
      return ['in-app', 'email'];
    case 'medium':
      return ['in-app'];
    case 'low':
      return ['in-app'];
    default:
      return ['in-app'];
  }
}

// ============================================================================
// CORE API
// ============================================================================

let notificationCounter = 0;

/**
 * Send a notification through the notification engine.
 * Writes to in-memory buffer for real-time delivery and
 * persists to database for history.
 */
export async function sendNotification(payload: NotificationPayload): Promise<Notification> {
  const id = `notif-${Date.now()}-${++notificationCounter}`;
  const channels = resolveChannels(payload.priority, payload.channels);

  const notification: Notification = {
    id,
    tenantId: payload.tenantId,
    userId: payload.userId,
    title: payload.title,
    message: payload.message,
    category: payload.category,
    priority: payload.priority,
    channels,
    sourceAgent: payload.sourceAgent,
    contractId: payload.contractId,
    actionUrl: payload.actionUrl,
    actionLabel: payload.actionLabel,
    metadata: payload.metadata,
    read: false,
    dismissed: false,
    createdAt: new Date(),
  };

  // Push to real-time buffer
  notificationBuffer.push(notification);

  // Persist to database (best-effort)
  try {
    await prisma.agentNotification.create({
      data: {
        id,
        tenantId: payload.tenantId,
        userId: payload.userId,
        title: payload.title,
        message: payload.message,
        category: payload.category,
        priority: payload.priority,
        channels: channels.join(','),
        sourceAgent: payload.sourceAgent,
        contractId: payload.contractId,
        actionUrl: payload.actionUrl,
        actionLabel: payload.actionLabel,
        metadata: payload.metadata ? JSON.stringify(payload.metadata) : undefined,
      },
    });
  } catch {
    // DB write failed — notification still in buffer for real-time delivery
    console.warn(`[NotificationEngine] Failed to persist notification ${id} to DB`);
  }

  return notification;
}

// ============================================================================
// CONVENIENCE HELPERS — used by agents to send typed notifications
// ============================================================================

export async function notifyDeadlineApproaching(
  tenantId: string,
  contractId: string,
  contractName: string,
  daysRemaining: number,
  deadlineType: 'expiration' | 'renewal' | 'notice-period' | 'milestone',
): Promise<Notification> {
  const priority: NotificationPriority = daysRemaining <= 7 ? 'critical' : daysRemaining <= 30 ? 'high' : 'medium';

  return sendNotification({
    tenantId,
    title: `${deadlineType === 'expiration' ? '⚠️ Contract Expiring' : deadlineType === 'renewal' ? '🔄 Renewal Due' : '📅 Deadline Approaching'}: ${contractName}`,
    message: `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} until ${deadlineType}. ${priority === 'critical' ? 'Immediate action required.' : 'Review and take action.'}`,
    category: 'deadline',
    priority,
    sourceAgent: 'autonomous-deadline-manager',
    contractId,
    actionUrl: `/contracts/${contractId}`,
    actionLabel: 'View Contract',
    metadata: { daysRemaining, deadlineType },
  });
}

export async function notifyHealthAlert(
  tenantId: string,
  contractId: string,
  contractName: string,
  healthScore: number,
  previousScore: number,
  factors: string[],
): Promise<Notification> {
  const priority: NotificationPriority = healthScore < 40 ? 'critical' : healthScore < 60 ? 'high' : 'medium';
  const trend = healthScore < previousScore ? 'declining' : 'improving';

  return sendNotification({
    tenantId,
    title: `${healthScore < 40 ? '🔴' : healthScore < 60 ? '🟡' : '🟢'} Health ${trend}: ${contractName}`,
    message: `Health score ${trend} to ${healthScore}/100 (was ${previousScore}). Key factors: ${factors.slice(0, 3).join(', ')}.`,
    category: 'health-alert',
    priority,
    sourceAgent: 'contract-health-monitor',
    contractId,
    actionUrl: `/intelligence?tab=health&contractId=${contractId}`,
    actionLabel: 'View Health',
    metadata: { healthScore, previousScore, factors },
  });
}

export async function notifyOpportunity(
  tenantId: string,
  title: string,
  description: string,
  estimatedSavings?: number,
  contractIds?: string[],
): Promise<Notification> {
  return sendNotification({
    tenantId,
    title: `💡 ${title}`,
    message: description + (estimatedSavings ? ` (Est. savings: $${estimatedSavings.toLocaleString()})` : ''),
    category: 'opportunity',
    priority: estimatedSavings && estimatedSavings > 50000 ? 'high' : 'medium',
    sourceAgent: 'opportunity-discovery-engine',
    contractId: contractIds?.[0],
    actionUrl: '/intelligence?tab=opportunities',
    actionLabel: 'View Opportunities',
    metadata: { estimatedSavings, contractIds },
  });
}

export async function notifyAgentAction(
  tenantId: string,
  agentName: string,
  action: string,
  contractId?: string,
  details?: string,
): Promise<Notification> {
  return sendNotification({
    tenantId,
    title: `🤖 Agent Action: ${action}`,
    message: details || `${agentName} performed: ${action}`,
    category: 'agent-action',
    priority: 'low',
    sourceAgent: agentName,
    contractId,
    actionUrl: contractId ? `/contracts/${contractId}` : '/agents',
    actionLabel: contractId ? 'View Contract' : 'View Agents',
  });
}
