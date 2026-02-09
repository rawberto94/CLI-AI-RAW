/**
 * Session Management API
 * 
 * GET /api/auth/sessions - List active sessions
 * DELETE /api/auth/sessions/[id] - Revoke a specific session
 * DELETE /api/auth/sessions - Revoke all sessions except current
 */

import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getApiContext, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

import { prisma } from '@/lib/prisma';
import { auditLog, AuditAction, getAuditContext } from '@/lib/security/audit';
import { UAParser } from 'ua-parser-js';
import { auditTrailService } from 'data-orchestration/services';

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
export async function GET(request: NextRequest) {
  const ctx = getApiContext(request);
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }
    
    // Get current session token from cookie
    const currentSessionToken = request.cookies.get('next-auth.session-token')?.value ||
                                request.cookies.get('__Secure-next-auth.session-token')?.value;
    
    // Get all sessions for this user
    const sessions = await prisma.userSession.findMany({
      where: {
        userId: session.user.id,
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
  } catch (error) {
    console.error('[Sessions List Error]:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to list sessions', 500);
  }
}

/**
 * DELETE /api/auth/sessions - Revoke sessions
 */
export async function DELETE(request: NextRequest) {
  const ctx = getApiContext(request);
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }
    
    const body = await request.json().catch(() => ({}));
    const { sessionId, revokeAll } = body;
    
    // Get current session token to preserve it
    const currentSessionToken = request.cookies.get('next-auth.session-token')?.value ||
                                request.cookies.get('__Secure-next-auth.session-token')?.value;
    
    if (revokeAll) {
      // Revoke all sessions except current - delete them since revokedAt doesn't exist
      const result = await prisma.userSession.deleteMany({
        where: {
          userId: session.user.id,
          NOT: [
            { token: currentSessionToken },
            { sessionToken: currentSessionToken },
          ],
        },
      });
      
      await auditLog({
        action: AuditAction.SESSION_REVOKED,
        userId: session.user.id,
        tenantId: session.user.tenantId,
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
          userId: session.user.id,
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
        userId: session.user.id,
        tenantId: session.user.tenantId,
        metadata: { sessionId },
        ...getAuditContext(request),
      });
      
      return createSuccessResponse(ctx, { success: true });
    } else {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'sessionId or revokeAll required', 400);
    }
  } catch (error) {
    console.error('[Session Revoke Error]:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to revoke session', 500);
  }
}

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
