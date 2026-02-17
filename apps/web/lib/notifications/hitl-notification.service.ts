/**
 * HITL (Human-in-the-Loop) Notification Service
 *
 * Sends out-of-browser notifications when agent goals require approval.
 * Routes notifications to the right people based on approval type:
 *  - human_review      → all tenant admins + goal creator
 *  - management_approval → users with role 'admin' or 'manager'
 *  - finance_approval   → users with role 'admin' or 'finance'
 *  - legal_approval     → users with role 'admin' or 'legal'
 *
 * Channels: in-app notification, push notification, Slack/webhook, and email.
 */

import { prisma } from '@/lib/prisma';
import { sendNotification, type NotificationPriority } from './notification-engine';
import { sendPushNotification } from '@/lib/push-notification.service';

// ============================================================================
// APPROVAL TYPE → ROLE MAPPING
// ============================================================================

const APPROVAL_ROLE_MAP: Record<string, string[]> = {
  human_review: ['admin', 'manager', 'user'],
  management_approval: ['admin', 'manager'],
  finance_approval: ['admin', 'finance'],
  legal_approval: ['admin', 'legal'],
};

/**
 * Resolve which users should be notified for a given set of required approvals.
 */
async function resolveApprovalRecipients(
  tenantId: string,
  requiredApprovals: string[],
  creatorUserId?: string | null,
): Promise<Array<{ id: string; email: string; role: string }>> {
  // Collect all required roles
  const requiredRoles = new Set<string>();
  for (const approval of requiredApprovals) {
    const roles = APPROVAL_ROLE_MAP[approval] ?? APPROVAL_ROLE_MAP.human_review;
    for (const role of roles) {
      requiredRoles.add(role);
    }
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        role: { in: Array.from(requiredRoles) },
      },
      select: { id: true, email: true, role: true },
    });

    // Always include the goal creator if provided (they should see the status)
    if (creatorUserId && !users.find((u) => u.id === creatorUserId)) {
      const creator = await prisma.user.findUnique({
        where: { id: creatorUserId },
        select: { id: true, email: true, role: true },
      });
      if (creator) users.push(creator);
    }

    return users;
  } catch {
    // DB error — return empty (SSE will still work as fallback)
    return [];
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

export interface HITLNotificationPayload {
  tenantId: string;
  goalId: string;
  goalTitle: string;
  goalType: string;
  goalDescription?: string;
  riskLevel: string;
  requiredApprovals: string[];
  creatorUserId?: string | null;
}

/**
 * Send HITL approval-required notifications via all available channels.
 *
 * 1. In-app notification (via notification engine)
 * 2. Browser push notification (via Web Push)
 * 3. Slack webhook (if SLACK_WEBHOOK_URL configured)
 * 4. Generic webhook (if NOTIFICATION_WEBHOOK_URL configured)
 */
export async function sendHITLApprovalNotification(
  payload: HITLNotificationPayload,
): Promise<{ notifiedUsers: number; channels: string[] }> {
  const {
    tenantId,
    goalId,
    goalTitle,
    goalType,
    goalDescription,
    riskLevel,
    requiredApprovals,
    creatorUserId,
  } = payload;

  const channels: string[] = [];
  let notifiedUsers = 0;

  const priority: NotificationPriority =
    riskLevel === 'critical' ? 'critical' : riskLevel === 'high' ? 'high' : 'medium';

  const approvalLabels = requiredApprovals
    .map((a) => a.replace(/_/g, ' '))
    .join(', ');

  // 1. Resolve recipients by role
  const recipients = await resolveApprovalRecipients(tenantId, requiredApprovals, creatorUserId);

  // 2. In-app notification for each recipient
  for (const user of recipients) {
    try {
      await sendNotification({
        tenantId,
        userId: user.id,
        title: `🔒 Approval Required: ${goalTitle}`,
        message: `Agent goal "${goalTitle}" (${goalType.replace(/_/g, ' ')}) requires ${approvalLabels}. Risk level: ${riskLevel}.${goalDescription ? ` — ${goalDescription.slice(0, 120)}` : ''}`,
        category: 'agent-action',
        priority,
        sourceAgent: 'autonomous-orchestrator',
        actionUrl: `/agents/approvals?goalId=${goalId}`,
        actionLabel: 'Review & Approve',
        metadata: { goalId, goalType, riskLevel, requiredApprovals },
      });
      notifiedUsers++;
    } catch {
      // Non-critical — continue with other recipients
    }
  }
  channels.push('in-app');

  // 3. Browser push notifications
  for (const user of recipients) {
    try {
      await sendPushNotification(user.id, tenantId, {
        title: `🔒 Approval Required: ${goalTitle}`,
        body: `Risk: ${riskLevel} | Approvals needed: ${approvalLabels}`,
        url: `/agents/approvals?goalId=${goalId}`,
        tag: `hitl-${goalId}`,
      });
    } catch {
      // Push not available for this user
    }
  }
  channels.push('push');

  // 4. Slack webhook (if configured)
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  if (slackUrl) {
    try {
      await fetch(slackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🔒 *Agent Approval Required*`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: [
                  `*🔒 Agent Approval Required*`,
                  `> *Goal:* ${goalTitle}`,
                  `> *Type:* ${goalType.replace(/_/g, ' ')}`,
                  `> *Risk Level:* ${riskLevel.toUpperCase()}`,
                  `> *Required Approvals:* ${approvalLabels}`,
                  goalDescription ? `> ${goalDescription.slice(0, 200)}` : '',
                  `\n<${process.env.NEXT_PUBLIC_APP_URL || 'https://app.contigo.ch'}/agents/approvals?goalId=${goalId}|Review in ConTiGo>`,
                ]
                  .filter(Boolean)
                  .join('\n'),
              },
            },
          ],
        }),
      });
      channels.push('slack');
    } catch {
      // Slack delivery failed — non-critical
    }
  }

  // 5. Generic webhook (if configured)
  const webhookUrl = process.env.NOTIFICATION_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.NOTIFICATION_WEBHOOK_SECRET
            ? { Authorization: `Bearer ${process.env.NOTIFICATION_WEBHOOK_SECRET}` }
            : {}),
        },
        body: JSON.stringify({
          event: 'hitl.approval_required',
          goalId,
          goalTitle,
          goalType,
          riskLevel,
          requiredApprovals,
          tenantId,
          recipientCount: recipients.length,
          timestamp: new Date().toISOString(),
        }),
      });
      channels.push('webhook');
    } catch {
      // Webhook delivery failed — non-critical
    }
  }

  return { notifiedUsers, channels };
}

/**
 * Send notification when a goal has been approved/rejected (feedback to watchers).
 */
export async function sendHITLDecisionNotification(
  tenantId: string,
  goalId: string,
  goalTitle: string,
  action: 'approved' | 'rejected' | 'modified',
  decidedBy: string,
): Promise<void> {
  const emoji = action === 'approved' ? '✅' : action === 'rejected' ? '❌' : '✏️';
  const verb = action === 'approved' ? 'Approved' : action === 'rejected' ? 'Rejected' : 'Sent back for changes';

  try {
    await sendNotification({
      tenantId,
      title: `${emoji} Goal ${verb}: ${goalTitle}`,
      message: `Agent goal "${goalTitle}" was ${verb.toLowerCase()} by ${decidedBy}.`,
      category: 'agent-action',
      priority: 'medium',
      sourceAgent: 'hitl-decision-tracker',
      actionUrl: `/agents/goals/${goalId}`,
      actionLabel: 'View Goal',
      metadata: { goalId, action, decidedBy },
    });
  } catch {
    // Non-critical
  }

  // Also notify via Slack if configured
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  if (slackUrl) {
    try {
      await fetch(slackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${emoji} Agent Goal ${verb}: ${goalTitle} (by ${decidedBy})`,
        }),
      });
    } catch {
      // Non-critical
    }
  }
}
