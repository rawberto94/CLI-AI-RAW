/**
 * IP Allowlist API
 *
 * Tenant-level IP allowlisting for enhanced security
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { auditTrailService } from 'data-orchestration/services';
import { hasPermission } from '@/lib/permissions';
import { auditLog, AuditAction, getAuditContext } from '@/lib/security/audit';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// Validation schema for IP entries
const ipEntrySchema = z.object({
  ip: z.string().refine((ip) => {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    const cidrv4Regex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    const cidrv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\/\d{1,3}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip) || cidrv4Regex.test(ip) || cidrv6Regex.test(ip);
  }, 'Invalid IP address or CIDR notation'),
  description: z.string().max(255).optional(),
  expiresAt: z.string().datetime().optional(),
});

/**
 * GET /api/admin/security/ip-allowlist
 */
export const GET = withAuthApiHandler(async (_request, ctx) => {
  const canManage = await hasPermission(ctx.userId, 'security:manage');
  if (!canManage) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403);
  }

  const settings = await prisma.tenantSecuritySettings.findUnique({
    where: { tenantId: ctx.tenantId },
  });

  const entries = await prisma.ipAllowlist.findMany({
    where: {
      tenantId: ctx.tenantId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  return createSuccessResponse(ctx, {
    enabled: settings?.ipAllowlistEnabled ?? false,
    enforceMode: 'disabled',
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
});

/**
 * POST /api/admin/security/ip-allowlist
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
  const canManage = await hasPermission(ctx.userId, 'security:manage');
  if (!canManage) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403);
  }

  const body = await request.json();

  // Handle settings update
  if (body.action === 'updateSettings') {
    const { enabled } = body;

    await prisma.tenantSecuritySettings.upsert({
      where: { tenantId: ctx.tenantId },
      create: {
        tenantId: ctx.tenantId,
        ipAllowlistEnabled: enabled ?? false,
      },
      update: {
        ipAllowlistEnabled: enabled ?? false,
      },
    });

    await auditLog({
      action: AuditAction.SECURITY_SETTINGS_UPDATED,
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      metadata: { ipAllowlistEnabled: enabled },
      ...getAuditContext(request),
    });

    return createSuccessResponse(ctx, { updated: true });
  }

  // Handle adding IP entry
  const validation = ipEntrySchema.safeParse(body);
  if (!validation.success) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', validation.error.errors[0].message, 400);
  }

  const { ip, description, expiresAt } = validation.data;

  // Check for duplicate
  const existing = await prisma.ipAllowlist.findFirst({
    where: {
      tenantId: ctx.tenantId,
      ipAddress: ip,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  });

  if (existing) {
    return createErrorResponse(ctx, 'CONFLICT', 'IP address already in allowlist', 409);
  }

  const entry = await prisma.ipAllowlist.create({
    data: {
      tenantId: ctx.tenantId,
      ipAddress: ip,
      description: description || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: ctx.userId,
    },
  });

  await auditLog({
    action: AuditAction.IP_ALLOWLIST_ADDED,
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    resourceType: 'ip_allowlist',
    resourceId: entry.id,
    metadata: { ip, description },
    ...getAuditContext(request),
  });

  return createSuccessResponse(ctx, { entry });
});

/**
 * DELETE /api/admin/security/ip-allowlist
 */
export const DELETE = withAuthApiHandler(async (request, ctx) => {
  const canManage = await hasPermission(ctx.userId, 'security:manage');
  if (!canManage) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403);
  }

  const { entryId } = await request.json();

  if (!entryId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Entry ID required', 400);
  }

  // Verify entry belongs to tenant
  const entry = await prisma.ipAllowlist.findFirst({
    where: {
      id: entryId,
      tenantId: ctx.tenantId,
    },
  });

  if (!entry) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Entry not found', 404);
  }

  await prisma.ipAllowlist.delete({
    where: { id: entryId },
  });

  await auditLog({
    action: AuditAction.IP_ALLOWLIST_REMOVED,
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    resourceType: 'ip_allowlist',
    resourceId: entryId,
    metadata: { ip: entry.ipAddress },
    ...getAuditContext(request),
  });

  return createSuccessResponse(ctx, { deleted: true });
});

/**
 * Check if an IP is allowed for a tenant
 * Used by middleware for request filtering
 */
export async function checkIPAllowed(ip: string, tenantId: string): Promise<{ allowed: boolean; reason?: string }> {
  const ctx = getApiContext(ip as any);
  try {
    const settings = await prisma.tenantSecuritySettings.findUnique({
      where: { tenantId },
    });

    if (!settings?.ipAllowlistEnabled) {
      return { allowed: true };
    }

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

    if (entries.length === 0) {
      return { allowed: true };
    }

    const isAllowed = entries.some(entry => {
      if (entry.ipAddress.includes('/')) {
        return isIPInCIDR(ip, entry.ipAddress);
      }
      return entry.ipAddress === ip;
    });

    if (isAllowed) {
      return { allowed: true };
    }

    return { allowed: false, reason: 'IP address not authorized' };
  } catch (error) {
    logger.error('[IP Check Error]:', error);
    return { allowed: true };
  }
}

/**
 * Check if IP is within CIDR range
 */
function isIPInCIDR(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/');
  const mask = parseInt(bits, 10);

  if (ip.includes('.') && range.includes('.')) {
    const ipParts = ip.split('.').map(Number);
    const rangeParts = range.split('.').map(Number);

    const ipNum = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
    const rangeNum = (rangeParts[0] << 24) + (rangeParts[1] << 16) + (rangeParts[2] << 8) + rangeParts[3];
    const maskNum = ~((1 << (32 - mask)) - 1);

    return (ipNum & maskNum) === (rangeNum & maskNum);
  }

  if (ip.includes(':') && range.includes(':')) {
    const normalizedIP = normalizeIPv6(ip);
    const normalizedRange = normalizeIPv6(range);
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
