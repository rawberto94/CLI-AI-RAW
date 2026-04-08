/**
 * Personal Activity Feed API
 * 
 * GET /api/user/activity — Returns the authenticated user's recent audit log entries.
 * Provides a personal activity timeline for the Security Dashboard.
 * 
 * Query params:
 *   limit  — max entries to return (default: 20, max: 100)
 *   cursor — cursor for pagination (ISO date string)
 */

import { NextRequest } from 'next/server';
import {
  withAuthApiHandler,
  createSuccessResponse,
  createErrorResponse,
  type AuthenticatedApiContext,
} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { userId, tenantId } = ctx;

  const url = new URL(request.url);
  const limitParam = parseInt(url.searchParams.get('limit') || '20', 10);
  const limit = Math.min(Math.max(limitParam, 1), 100);
  const cursor = url.searchParams.get('cursor'); // ISO date string

  const where: Record<string, unknown> = {
    userId,
    tenantId,
  };

  if (cursor) {
    where.timestamp = { lt: new Date(cursor) };
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: limit + 1, // Fetch one extra to detect next page
    select: {
      id: true,
      action: true,
      timestamp: true,
      ipAddress: true,
      success: true,
      resourceType: true,
      resourceId: true,
      metadata: true,
    },
  });

  const hasMore = logs.length > limit;
  const entries = hasMore ? logs.slice(0, limit) : logs;
  const nextCursor = hasMore ? entries[entries.length - 1]?.timestamp?.toISOString() : null;

  return createSuccessResponse(ctx, {
    activities: entries.map((log) => ({
      id: log.id,
      action: log.action,
      timestamp: log.timestamp,
      ipAddress: log.ipAddress ? maskIp(log.ipAddress) : null,
      success: log.success,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      description: describeAction(log.action, log.resourceType, log.metadata),
    })),
    hasMore,
    nextCursor,
  });
});

/**
 * Mask an IP address for privacy (show first two octets only).
 */
function maskIp(ip: string): string {
  if (ip.includes('.')) {
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.*.*`;
  }
  // IPv6 — show first segment
  const parts = ip.split(':');
  return `${parts[0]}:${parts[1]}:****`;
}

/**
 * Generate a human-readable description for an audit action.
 */
function describeAction(
  action: string,
  resourceType: string | null,
  metadata: unknown,
): string {
  const meta = (metadata && typeof metadata === 'object') ? metadata as Record<string, unknown> : {};
  const resource = resourceType ? ` ${resourceType.toLowerCase()}` : '';

  const descriptions: Record<string, string> = {
    LOGIN_SUCCESS: 'Signed in successfully',
    LOGIN_FAILED: `Sign-in attempt failed${meta.reason ? ` (${meta.reason})` : ''}`,
    LOGOUT: 'Signed out',
    PASSWORD_CHANGE: 'Changed password',
    MFA_ENABLED: 'Enabled two-factor authentication',
    MFA_DISABLED: 'Disabled two-factor authentication',
    MFA_VERIFIED: 'Verified two-factor code',
    PROFILE_UPDATE: 'Updated profile settings',
    CONTRACT_VIEW: `Viewed${resource}`,
    CONTRACT_CREATE: `Created${resource}`,
    CONTRACT_UPDATE: `Updated${resource}`,
    CONTRACT_DELETE: `Deleted${resource}`,
    CONTRACT_UPLOAD: `Uploaded${resource}`,
    CONTRACT_DOWNLOAD: `Downloaded${resource}`,
    CONTRACT_EXPORT: `Exported${resource}`,
    DRAFT_CREATE: 'Created a new draft',
    DRAFT_UPDATE: 'Updated a draft',
    DRAFT_DELETE: 'Deleted a draft',
    AI_CHAT: 'Used AI assistant',
    AI_ANALYSIS: `Ran AI analysis on${resource}`,
    SEARCH: 'Performed a search',
    SESSION_REVOKED: 'Revoked a session',
    API_KEY_CREATE: 'Created an API key',
    API_KEY_REVOKE: 'Revoked an API key',
    SETTINGS_UPDATE: 'Updated settings',
    EXPORT_REQUEST: `Requested data export`,
  };

  return descriptions[action] || action.toLowerCase().replace(/_/g, ' ');
}
