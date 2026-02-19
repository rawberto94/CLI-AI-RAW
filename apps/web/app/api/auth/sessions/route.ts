/**
 * Session Management API
 * 
 * GET /api/auth/sessions - List active sessions
 * DELETE /api/auth/sessions/[id] - Revoke a specific session
 * DELETE /api/auth/sessions - Revoke all sessions except current
 * 
 * NOTE (L19): This uses the `UserSession` Prisma model for manual device/session
 * tracking. This is SEPARATE from NextAuth's JWT-based session strategy.
 * NextAuth does NOT populate UserSession — it is written to manually during
 * login (via signIn callback) and cleaned up here.
 * The NextAuth `Session` model (added for PrismaAdapter SSO support) is also
 * separate; it would only be used if the session strategy were changed to "database".
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

import { prisma } from '@/lib/prisma';
import { auditLog, AuditAction, getAuditContext } from '@/lib/security/audit';
import { UAParser } from 'ua-parser-js';

interface SessionInfo {
  id: string;
  deviceInfo: {
    browser: string;
    os: string;
    device: string;
  };
  ipAddress: string;
  location?: string;
  lastActive: Date;
  createdAt: Date;
  isCurrent: boolean;
}

/**
 * GET /api/auth/sessions - List all active sessions
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { userId } = ctx;

  // Get current session token from cookie
  const currentSessionToken = request.cookies.get('next-auth.session-token')?.value ||
                              request.cookies.get('__Secure-next-auth.session-token')?.value;

  // Get all sessions for this user
  const sessions = await prisma.userSession.findMany({
    where: {
      userId,
      expiresAt: { gt: new Date() },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const sessionInfos: SessionInfo[] = sessions.map(sess => {
    const parser = new UAParser(sess.userAgent || '');
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const device = parser.getDevice();

    return {
      id: sess.id,
      deviceInfo: {
        browser: browser.name ? `${browser.name} ${browser.version || ''}`.trim() : 'Unknown Browser',
        os: os.name ? `${os.name} ${os.version || ''}`.trim() : 'Unknown OS',
        device: device.model || device.type || 'Desktop',
      },
      ipAddress: maskIpAddress(sess.ipAddress || 'Unknown'),
      location: sess.location || undefined,
      lastActive: sess.lastActive || sess.updatedAt,
      createdAt: sess.createdAt,
      isCurrent: sess.token === currentSessionToken || sess.sessionToken === currentSessionToken,
    };
  });

  return createSuccessResponse(ctx, {
    sessions: sessionInfos,
    totalSessions: sessionInfos.length,
  });
});

/**
 * DELETE /api/auth/sessions - Revoke sessions
 */
export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { userId, tenantId } = ctx;

  const body = await request.json().catch(() => ({}));
  const { sessionId, revokeAll } = body;

  // Get current session token to preserve it
  const currentSessionToken = request.cookies.get('next-auth.session-token')?.value ||
                              request.cookies.get('__Secure-next-auth.session-token')?.value;

  if (revokeAll) {
    // Revoke all sessions except current - delete them since revokedAt doesn't exist
    const result = await prisma.userSession.deleteMany({
      where: {
        userId,
        NOT: [
          { token: currentSessionToken },
          { sessionToken: currentSessionToken },
        ],
      },
    });

    await auditLog({
      action: AuditAction.SESSION_REVOKED,
      userId,
      tenantId,
      metadata: { count: result.count, revokeAll: true },
      ...getAuditContext(request),
    });

    return createSuccessResponse(ctx, {
      success: true,
      revokedCount: result.count,
    });
  } else if (sessionId) {
    // Revoke specific session
    const targetSession = await prisma.userSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!targetSession) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Session not found', 404);
    }

    // Prevent revoking current session
    if (targetSession.token === currentSessionToken || targetSession.sessionToken === currentSessionToken) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Cannot revoke current session', 400);
    }

    await prisma.userSession.delete({
      where: { id: sessionId },
    });

    await auditLog({
      action: AuditAction.SESSION_REVOKED,
      userId,
      tenantId,
      metadata: { sessionId },
      ...getAuditContext(request),
    });

    return createSuccessResponse(ctx, { success: true });
  } else {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'sessionId or revokeAll required', 400);
  }
});

/**
 * Mask IP address for privacy (show first two octets for IPv4)
 */
function maskIpAddress(ip: string): string {
  if (ip === 'Unknown') return ip;
  
  // IPv4
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.*.*`;
    }
  }
  
  // IPv6 - show first two segments
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}:****`;
    }
  }
  
  return ip;
}
