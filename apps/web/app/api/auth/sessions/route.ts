/**
 * Session Management API
 * 
 * GET /api/auth/sessions - List active sessions
 * DELETE /api/auth/sessions/[id] - Revoke a specific session
 * DELETE /api/auth/sessions - Revoke all sessions except current
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

import { prisma } from '@/lib/prisma';
import { auditLog, AuditAction } from '@/lib/security/audit';
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
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get current session token from cookie
    const currentSessionToken = request.cookies.get('next-auth.session-token')?.value ||
                                request.cookies.get('__Secure-next-auth.session-token')?.value;
    
    // Get all sessions for this user
    const sessions = await prisma.userSession.findMany({
      where: {
        userId: session.user.id,
        expiresAt: { gt: new Date() },
        revokedAt: null,
      },
      orderBy: { lastActive: 'desc' },
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
        lastActive: sess.lastActive,
        createdAt: sess.createdAt,
        isCurrent: sess.sessionToken === currentSessionToken,
      };
    });
    
    return NextResponse.json({
      sessions: sessionInfos,
      totalSessions: sessionInfos.length,
    });
  } catch (error) {
    console.error('[Sessions List Error]:', error);
    return NextResponse.json({ error: 'Failed to list sessions' }, { status: 500 });
  }
}

/**
 * DELETE /api/auth/sessions - Revoke sessions
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json().catch(() => ({}));
    const { sessionId, revokeAll } = body;
    
    // Get current session token to preserve it
    const currentSessionToken = request.cookies.get('next-auth.session-token')?.value ||
                                request.cookies.get('__Secure-next-auth.session-token')?.value;
    
    if (revokeAll) {
      // Revoke all sessions except current
      const result = await prisma.userSession.updateMany({
        where: {
          userId: session.user.id,
          revokedAt: null,
          NOT: { sessionToken: currentSessionToken },
        },
        data: {
          revokedAt: new Date(),
          revokedReason: 'User revoked all sessions',
        },
      });
      
      await auditLog({
        action: AuditAction.SESSION_REVOKED_ALL,
        userId: session.user.id,
        tenantId: session.user.tenantId,
        metadata: { count: result.count },
        request,
      });
      
      return NextResponse.json({
        success: true,
        revokedCount: result.count,
      });
    } else if (sessionId) {
      // Revoke specific session
      const targetSession = await prisma.userSession.findFirst({
        where: {
          id: sessionId,
          userId: session.user.id,
          revokedAt: null,
        },
      });
      
      if (!targetSession) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      
      // Prevent revoking current session
      if (targetSession.sessionToken === currentSessionToken) {
        return NextResponse.json({ error: 'Cannot revoke current session' }, { status: 400 });
      }
      
      await prisma.userSession.update({
        where: { id: sessionId },
        data: {
          revokedAt: new Date(),
          revokedReason: 'User revoked session',
        },
      });
      
      await auditLog({
        action: AuditAction.SESSION_REVOKED,
        userId: session.user.id,
        tenantId: session.user.tenantId,
        metadata: { sessionId },
        request,
      });
      
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'sessionId or revokeAll required' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Session Revoke Error]:', error);
    return NextResponse.json({ error: 'Failed to revoke session' }, { status: 500 });
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
