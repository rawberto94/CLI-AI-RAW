/**
 * Slack/Teams Notification Integration API
 * 
 * POST /api/obligations/integrations/slack - Send Slack notification
 * POST /api/obligations/integrations/teams - Send Teams notification
 * GET /api/obligations/integrations - Get integration status
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { aiObligationTrackerService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
export const dynamic = 'force-dynamic';

interface SlackMessage {
  channel?: string;
  text: string;
  blocks?: Array<{
    type: string;
    text?: { type: string; text: string; emoji?: boolean };
    elements?: Array<Record<string, unknown>>;
    accessory?: Record<string, unknown>;
    fields?: Array<{ type: string; text: string }>;
  }>;
  attachments?: Array<{
    color?: string;
    blocks?: Array<Record<string, unknown>>;
    fields?: Array<{ title: string; value: string; short?: boolean }>;
  }>;
}

interface TeamsMessage {
  '@type': string;
  '@context': string;
  themeColor: string;
  summary: string;
  sections: Array<{
    activityTitle: string;
    activitySubtitle?: string;
    activityImage?: string;
    facts?: Array<{ name: string; value: string }>;
    markdown?: boolean;
    text?: string;
  }>;
  potentialAction?: Array<{
    '@type': string;
    name: string;
    targets: Array<{ os: string; uri: string }>;
  }>;
}

// Format obligation for Slack
function formatSlackObligation(obligation: Record<string, unknown>): SlackMessage {
  const statusEmoji: Record<string, string> = {
    pending: '⏳',
    in_progress: '🔄',
    completed: '✅',
    overdue: '🚨',
    at_risk: '⚠️',
    waived: '↩️',
    cancelled: '❌',
  };

  const priorityEmoji: Record<string, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
  };

  const status = (obligation.status as string)?.toLowerCase() || 'pending';
  const priority = (obligation.priority as string)?.toLowerCase() || 'medium';
  const dueDate = obligation.dueDate ? new Date(obligation.dueDate as string).toLocaleDateString() : 'No due date';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.contigo.ai';

  return {
    text: `${statusEmoji[status] || '📋'} Obligation Update: ${obligation.title}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${statusEmoji[status] || '📋'} ${obligation.title}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Status:*\n${statusEmoji[status] || '📋'} ${status.replace('_', ' ')}` },
          { type: 'mrkdwn', text: `*Priority:*\n${priorityEmoji[priority] || '⚪'} ${priority}` },
          { type: 'mrkdwn', text: `*Due Date:*\n${dueDate}` },
          { type: 'mrkdwn', text: `*Type:*\n${obligation.type || 'Other'}` },
        ],
      },
      obligation.description ? {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Description:*\n${obligation.description}` },
      } : null,
      obligation.contractTitle ? {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `📄 *Contract:* ${obligation.contractTitle}` },
        ],
      } : null,
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View in ConTigo', emoji: true },
            url: `${baseUrl}/obligations?id=${obligation.id}`,
            style: 'primary',
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Mark Complete', emoji: true },
            value: `complete_${obligation.id}`,
            action_id: 'complete_obligation',
          },
        ],
      },
    ].filter(Boolean) as SlackMessage['blocks'],
  };
}

// Format obligation for Teams
function formatTeamsObligation(obligation: Record<string, unknown>): TeamsMessage {
  const status = (obligation.status as string)?.toLowerCase() || 'pending';
  const priority = (obligation.priority as string)?.toLowerCase() || 'medium';
  const dueDate = obligation.dueDate ? new Date(obligation.dueDate as string).toLocaleDateString() : 'No due date';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.contigo.ai';

  const themeColors: Record<string, string> = {
    pending: '808080',
    in_progress: '7C3AED',
    completed: '22C55E',
    overdue: 'EF4444',
    at_risk: 'F59E0B',
  };

  return {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    themeColor: themeColors[status] || '7C3AED',
    summary: `Obligation: ${obligation.title}`,
    sections: [
      {
        activityTitle: obligation.title as string,
        activitySubtitle: `Contract: ${obligation.contractTitle || 'Unknown'}`,
        facts: [
          { name: 'Status', value: status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) },
          { name: 'Priority', value: priority.replace(/\b\w/g, (l) => l.toUpperCase()) },
          { name: 'Due Date', value: dueDate },
          { name: 'Type', value: (obligation.type as string || 'Other').replace('_', ' ') },
        ],
        markdown: true,
      },
      obligation.description ? {
        text: obligation.description as string,
        markdown: true,
      } : null,
    ].filter(Boolean) as TeamsMessage['sections'],
    potentialAction: [
      {
        '@type': 'OpenUri',
        name: 'View in ConTigo',
        targets: [{ os: 'default', uri: `${baseUrl}/obligations?id=${obligation.id}` }],
      },
    ],
  };
}

/**
 * Validate webhook URL to prevent SSRF attacks.
 * Only HTTPS URLs to non-private hosts are allowed.
 */
function isAllowedWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    // Block private/reserved ranges and metadata endpoints
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '[::1]') return false;
    if (host.startsWith('169.254.') || host.startsWith('10.') || host.startsWith('192.168.')) return false;
    if (host.startsWith('172.') && parseInt(host.split('.')[1], 10) >= 16 && parseInt(host.split('.')[1], 10) <= 31) return false;
    if (host.endsWith('.internal') || host.endsWith('.local')) return false;
    return true;
  } catch {
    return false;
  }
}

// Send Slack notification
async function sendSlackNotification(webhookUrl: string, message: SlackMessage): Promise<boolean> {
  if (!isAllowedWebhookUrl(webhookUrl)) {
    console.error('Slack webhook URL rejected by SSRF validation:', webhookUrl);
    return false;
  }
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    return response.ok;
  } catch (error) {
    console.error('Slack notification failed:', error);
    return false;
  }
}

// Send Teams notification
async function sendTeamsNotification(webhookUrl: string, message: TeamsMessage): Promise<boolean> {
  if (!isAllowedWebhookUrl(webhookUrl)) {
    console.error('Teams webhook URL rejected by SSRF validation:', webhookUrl);
    return false;
  }
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    return response.ok;
  } catch (error) {
    console.error('Teams notification failed:', error);
    return false;
  }
}

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user?.tenantId) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const body = await request.json();
  const { action, platform, obligationId, webhookUrl, channel } = body;

  // Get tenant configuration for webhook URLs
  const tenantConfig = await prisma.tenantConfig.findUnique({
    where: { tenantId: session.user.tenantId },
  });

  const integrations = tenantConfig?.integrations as Record<string, unknown> || {};

  if (action === 'test') {
    // Test the integration
    const testMessage = {
      text: '✅ ConTigo integration test successful! You will receive obligation notifications here.',
    };

    if (platform === 'slack') {
      const url = webhookUrl || (integrations.slackWebhookUrl as string);
      if (!url) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Slack webhook URL not configured', 400);
      }
      const success = await sendSlackNotification(url, testMessage);
      return createSuccessResponse(ctx, { success, message: success ? 'Test notification sent!' : 'Failed to send notification' });
    }

    if (platform === 'teams') {
      const url = webhookUrl || (integrations.teamsWebhookUrl as string);
      if (!url) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Teams webhook URL not configured', 400);
      }
      const teamsMessage: TeamsMessage = {
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        themeColor: '7C3AED',
        summary: 'ConTigo Integration Test',
        sections: [{ activityTitle: '✅ ConTigo integration test successful!', text: 'You will receive obligation notifications here.', markdown: true }],
      };
      const success = await sendTeamsNotification(url, teamsMessage);
      return createSuccessResponse(ctx, { success, message: success ? 'Test notification sent!' : 'Failed to send notification' });
    }
  }

  if (action === 'notify_obligation') {
    // Send notification for a specific obligation
    const obligation = await prisma.obligation.findFirst({
      where: { id: obligationId, tenantId: session.user.tenantId },
      include: { contract: { select: { contractTitle: true } } },
    });

    if (!obligation) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Obligation not found', 404);
    }

    const oblData = {
      ...obligation,
      status: obligation.status.toLowerCase(),
      priority: obligation.priority.toLowerCase(),
      type: obligation.type.toLowerCase(),
      contractTitle: obligation.contract?.contractTitle,
    };

    if (platform === 'slack') {
      const url = webhookUrl || (integrations.slackWebhookUrl as string);
      if (!url) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Slack webhook URL not configured', 400);
      }
      const slackMessage = formatSlackObligation(oblData);
      if (channel) slackMessage.channel = channel;
      const success = await sendSlackNotification(url, slackMessage);
      return createSuccessResponse(ctx, { success });
    }

    if (platform === 'teams') {
      const url = webhookUrl || (integrations.teamsWebhookUrl as string);
      if (!url) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Teams webhook URL not configured', 400);
      }
      const teamsMessage = formatTeamsObligation(oblData);
      const success = await sendTeamsNotification(url, teamsMessage);
      return createSuccessResponse(ctx, { success });
    }
  }

  if (action === 'notify_digest') {
    // Send daily/weekly digest of obligations
    const overdueObligations = await prisma.obligation.findMany({
      where: {
        tenantId: session.user.tenantId,
        status: { notIn: ['COMPLETED', 'WAIVED', 'CANCELLED'] },
        dueDate: { lt: new Date() },
      },
      include: { contract: { select: { contractTitle: true } } },
      take: 10,
    });

    const upcomingObligations = await prisma.obligation.findMany({
      where: {
        tenantId: session.user.tenantId,
        status: { notIn: ['COMPLETED', 'WAIVED', 'CANCELLED'] },
        dueDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
        },
      },
      include: { contract: { select: { contractTitle: true } } },
      take: 10,
      orderBy: { dueDate: 'asc' },
    });

    if (platform === 'slack') {
      const url = webhookUrl || (integrations.slackWebhookUrl as string);
      if (!url) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Slack webhook URL not configured', 400);
      }

      const digestMessage: SlackMessage = {
        text: '📋 ConTigo Obligations Digest',
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: '📋 Obligations Digest', emoji: true },
          },
          overdueObligations.length > 0 ? {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*🚨 Overdue (${overdueObligations.length}):*\n${overdueObligations.map((o) => `• ${o.title}`).join('\n')}`,
            },
          } : null,
          upcomingObligations.length > 0 ? {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*⏰ Due This Week (${upcomingObligations.length}):*\n${upcomingObligations.map((o) => `• ${o.title} - Due ${o.dueDate?.toLocaleDateString()}`).join('\n')}`,
            },
          } : null,
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'View All Obligations', emoji: true },
                url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.contigo.ai'}/obligations`,
                style: 'primary',
              },
            ],
          },
        ].filter(Boolean) as SlackMessage['blocks'],
      };

      const success = await sendSlackNotification(url, digestMessage);
      return createSuccessResponse(ctx, { success, overdue: overdueObligations.length, upcoming: upcomingObligations.length });
    }

    if (platform === 'teams') {
      const url = webhookUrl || (integrations.teamsWebhookUrl as string);
      if (!url) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Teams webhook URL not configured', 400);
      }

      const digestMessage: TeamsMessage = {
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        themeColor: '7C3AED',
        summary: 'ConTigo Obligations Digest',
        sections: [
          {
            activityTitle: '📋 Obligations Digest',
            facts: [
              { name: '🚨 Overdue', value: String(overdueObligations.length) },
              { name: '⏰ Due This Week', value: String(upcomingObligations.length) },
            ],
            markdown: true,
          },
          overdueObligations.length > 0 ? {
            activityTitle: '🚨 Overdue Obligations',
            text: overdueObligations.map((o) => `- ${o.title}`).join('\n'),
            markdown: true,
          } : null,
          upcomingObligations.length > 0 ? {
            activityTitle: '⏰ Upcoming This Week',
            text: upcomingObligations.map((o) => `- ${o.title} (Due: ${o.dueDate?.toLocaleDateString()})`).join('\n'),
            markdown: true,
          } : null,
        ].filter(Boolean) as TeamsMessage['sections'],
        potentialAction: [
          {
            '@type': 'OpenUri',
            name: 'View All Obligations',
            targets: [{ os: 'default', uri: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.contigo.ai'}/obligations` }],
          },
        ],
      };

      const success = await sendTeamsNotification(url, digestMessage);
      return createSuccessResponse(ctx, { success, overdue: overdueObligations.length, upcoming: upcomingObligations.length });
    }
  }

  if (action === 'configure') {
    // Save webhook configuration
    const { slackWebhookUrl, teamsWebhookUrl, slackChannel, teamsChannel, enabled } = body;

    await prisma.tenantConfig.upsert({
      where: { tenantId: session.user.tenantId },
      update: {
        integrations: {
          ...integrations,
          slackWebhookUrl,
          teamsWebhookUrl,
          slackChannel,
          teamsChannel,
          obligationNotificationsEnabled: enabled,
        },
      },
      create: {
        tenantId: session.user.tenantId,
        integrations: {
          slackWebhookUrl,
          teamsWebhookUrl,
          slackChannel,
          teamsChannel,
          obligationNotificationsEnabled: enabled,
        },
      },
    });

    return createSuccessResponse(ctx, { success: true, message: 'Integration settings saved' });
  }

  return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
});

export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  if (!session?.user?.tenantId) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const tenantConfig = await prisma.tenantConfig.findUnique({
    where: { tenantId: session.user.tenantId },
  });

  const integrations = tenantConfig?.integrations as Record<string, unknown> || {};

  return createSuccessResponse(ctx, {
    success: true,
    data: {
      slack: {
        configured: !!integrations.slackWebhookUrl,
        channel: integrations.slackChannel || null,
      },
      teams: {
        configured: !!integrations.teamsWebhookUrl,
        channel: integrations.teamsChannel || null,
      },
      enabled: integrations.obligationNotificationsEnabled || false,
    },
  });
});
