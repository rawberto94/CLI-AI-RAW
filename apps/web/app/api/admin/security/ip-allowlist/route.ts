/**
 * IP Allowlist API
 * 
 * Tenant-level IP allowlisting for enhanced security
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/permissions';
import { auditLog, AuditAction, getAuditContext } from '@/lib/security/audit';
import { z } from 'zod';

// Validation schema for IP entries
const ipEntrySchema = z.object({
  ip: z.string().refine((ip) => {
    // Validate IPv4, IPv6, or CIDR notation
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    const cidrv4Regex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    const cidrv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\/\d{1,3}$/;
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip) || cidrv4Regex.test(ip) || cidrv6Regex.test(ip);
  }, 'Invalid IP address or CIDR notation'),
  description: z.string().max(255).optional(),
  expiresAt: z.string().datetime().optional(),
});

interface _IPAllowlistEntry {
  id: string;
  ip: string;
  description: string | null;
  createdAt: Date;
  createdBy: string;
  expiresAt: Date | null;
  isActive: boolean;
}

/**
 * GET /api/admin/security/ip-allowlist
 * Get tenant IP allowlist
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const canManage = await hasPermission(session.user.id, 'security:manage');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Get tenant security settings
    const settings = await prisma.tenantSecuritySettings.findUnique({
      where: { tenantId: session.user.tenantId },
    });
    
    // Get IP allowlist entries
    const entries = await prisma.ipAllowlist.findMany({
      where: {
        tenantId: session.user.tenantId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    
    return NextResponse.json({
      enabled: settings?.ipAllowlistEnabled ?? false,
      enforceMode: 'disabled', // Not stored in DB, use default
      entries: entries.map(e => ({
        id: e.id,
        ip: e.ipAddress,
        description: e.description,
        createdAt: e.createdAt,
        createdBy: e.createdBy,
        expiresAt: e.expiresAt,
        isActive: e.isActive && (!e.expiresAt || e.expiresAt > new Date()),
      })),
    });
  } catch (error) {
    console.error('[IP Allowlist GET Error]:', error);
    return NextResponse.json({ error: 'Failed to fetch IP allowlist' }, { status: 500 });
  }
}

/**
 * POST /api/admin/security/ip-allowlist
 * Add IP to allowlist or update settings
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const canManage = await hasPermission(session.user.id, 'security:manage');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const body = await request.json();
    
    // Handle settings update
    if (body.action === 'updateSettings') {
      const { enabled } = body;
      
      await prisma.tenantSecuritySettings.upsert({
        where: { tenantId: session.user.tenantId },
        create: {
          tenantId: session.user.tenantId,
          ipAllowlistEnabled: enabled ?? false,
        },
        update: {
          ipAllowlistEnabled: enabled ?? false,
        },
      });
      
      await auditLog({
        action: AuditAction.SECURITY_SETTINGS_UPDATED,
        userId: session.user.id,
        tenantId: session.user.tenantId,
        metadata: { ipAllowlistEnabled: enabled },
        ...getAuditContext(request),
      });
      
      return NextResponse.json({ success: true });
    }
    
    // Handle adding IP entry
    const validation = ipEntrySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0].message }, { status: 400 });
    }
    
    const { ip, description, expiresAt } = validation.data;
    
    // Check for duplicate
    const existing = await prisma.ipAllowlist.findFirst({
      where: {
        tenantId: session.user.tenantId,
        ipAddress: ip,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });
    
    if (existing) {
      return NextResponse.json({ error: 'IP address already in allowlist' }, { status: 409 });
    }
    
    const entry = await prisma.ipAllowlist.create({
      data: {
        tenantId: session.user.tenantId,
        ipAddress: ip,
        description: description || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: session.user.id,
      },
    });
    
    await auditLog({
      action: AuditAction.IP_ALLOWLIST_ADDED,
      userId: session.user.id,
      tenantId: session.user.tenantId,
      resourceType: 'ip_allowlist',
      resourceId: entry.id,
      metadata: { ip, description },
      ...getAuditContext(request),
    });
    
    return NextResponse.json({ success: true, entry });
  } catch (error) {
    console.error('[IP Allowlist POST Error]:', error);
    return NextResponse.json({ error: 'Failed to update IP allowlist' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/security/ip-allowlist
 * Remove IP from allowlist
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const canManage = await hasPermission(session.user.id, 'security:manage');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const { entryId } = await request.json();
    
    if (!entryId) {
      return NextResponse.json({ error: 'Entry ID required' }, { status: 400 });
    }
    
    // Verify entry belongs to tenant
    const entry = await prisma.ipAllowlist.findFirst({
      where: {
        id: entryId,
        tenantId: session.user.tenantId,
      },
    });
    
    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }
    
    await prisma.ipAllowlist.delete({
      where: { id: entryId },
    });
    
    await auditLog({
      action: AuditAction.IP_ALLOWLIST_REMOVED,
      userId: session.user.id,
      tenantId: session.user.tenantId,
      resourceType: 'ip_allowlist',
      resourceId: entryId,
      metadata: { ip: entry.ipAddress },
      ...getAuditContext(request),
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[IP Allowlist DELETE Error]:', error);
    return NextResponse.json({ error: 'Failed to remove IP from allowlist' }, { status: 500 });
  }
}

/**
 * Check if an IP is allowed for a tenant
 * Used by middleware for request filtering
 */
export async function checkIPAllowed(ip: string, tenantId: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const settings = await prisma.tenantSecuritySettings.findUnique({
      where: { tenantId },
    });
    
    // If IP allowlist is not enabled, allow all
    if (!settings?.ipAllowlistEnabled) {
      return { allowed: true };
    }
    
    // Get active allowlist entries
    const entries = await prisma.ipAllowlist.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });
    
    // If no entries, allow all (don't lock out users)
    if (entries.length === 0) {
      return { allowed: true };
    }
    
    // Check if IP matches any entry
    const isAllowed = entries.some(entry => {
      if (entry.ipAddress.includes('/')) {
        // CIDR notation - use proper subnet matching
        return isIPInCIDR(ip, entry.ipAddress);
      }
      return entry.ipAddress === ip;
    });
    
    if (isAllowed) {
      return { allowed: true };
    }
    
    // IP not in allowlist - block
    return { allowed: false, reason: 'IP address not authorized' };
  } catch (error) {
    console.error('[IP Check Error]:', error);
    // On error, default to allow to prevent lockout
    return { allowed: true };
  }
}

/**
 * Check if IP is within CIDR range
 */
function isIPInCIDR(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/');
  const mask = parseInt(bits, 10);
  
  // Simple IPv4 check
  if (ip.includes('.') && range.includes('.')) {
    const ipParts = ip.split('.').map(Number);
    const rangeParts = range.split('.').map(Number);
    
    const ipNum = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
    const rangeNum = (rangeParts[0] << 24) + (rangeParts[1] << 16) + (rangeParts[2] << 8) + rangeParts[3];
    const maskNum = ~((1 << (32 - mask)) - 1);
    
    return (ipNum & maskNum) === (rangeNum & maskNum);
  }
  
  // For IPv6, do a basic prefix check (simplified)
  if (ip.includes(':') && range.includes(':')) {
    const normalizedIP = normalizeIPv6(ip);
    const normalizedRange = normalizeIPv6(range);
    
    // Compare first N bits
    const prefixLength = Math.floor(mask / 4);
    return normalizedIP.substring(0, prefixLength) === normalizedRange.substring(0, prefixLength);
  }
  
  return false;
}

/**
 * Normalize IPv6 address to full form
 */
function normalizeIPv6(ip: string): string {
  const parts = ip.split(':');
  const result: string[] = [];
  
  for (const part of parts) {
    if (part === '') {
      // Expand ::
      const missing = 8 - parts.filter(p => p !== '').length;
      for (let i = 0; i < missing + 1; i++) {
        result.push('0000');
      }
    } else {
      result.push(part.padStart(4, '0'));
    }
  }
  
  return result.slice(0, 8).join('');
}
