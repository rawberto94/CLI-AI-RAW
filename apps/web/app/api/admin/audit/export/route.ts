/**
 * Audit Log Export API
 *
 * GET /api/admin/audit/export - Export audit logs as CSV or JSON
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthApiHandler, createErrorResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { auditTrailService } from 'data-orchestration/services';
import { hasPermission } from '@/lib/permissions';

interface AuditLogExportParams {
  format: 'csv' | 'json';
  startDate?: string;
  endDate?: string;
  actions?: string[];
  userId?: string;
  limit?: number;
}

/**
 * GET /api/admin/audit/export
 * Export audit logs in CSV or JSON format
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
  // Check specific permission
  const canExport = await hasPermission(ctx.userId, 'audit:export');
  if (!canExport) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403);
  }

  const searchParams = request.nextUrl.searchParams;

  const params: AuditLogExportParams = {
    format: (searchParams.get('format') as 'csv' | 'json') || 'json',
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
    actions: searchParams.get('actions')?.split(',') || undefined,
    userId: searchParams.get('userId') || undefined,
    limit: Math.min(Math.max(1, searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10000), 10000),
  };

  // Build query filters
  const where: Record<string, unknown> = {
    tenantId: ctx.tenantId,
  };

  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) {
      (where.createdAt as Record<string, Date>).gte = new Date(params.startDate);
    }
    if (params.endDate) {
      (where.createdAt as Record<string, Date>).lte = new Date(params.endDate);
    }
  }

  if (params.actions && params.actions.length > 0) {
    where.action = { in: params.actions };
  }

  if (params.userId) {
    where.userId = params.userId;
  }

  // Fetch audit logs
  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(params.limit || 10000, 50000),
    include: {
      user: {
        select: { email: true, firstName: true, lastName: true },
      },
    },
  });

  // Log this export action
  await prisma.auditLog.create({
    data: {
      action: 'AUDIT_LOG_EXPORTED',
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      metadata: {
        format: params.format,
        recordCount: logs.length,
        filters: {
          startDate: params.startDate,
          endDate: params.endDate,
          actions: params.actions,
          userId: params.userId,
        },
      },
    },
  });

  if (params.format === 'csv') {
    const headers = [
      'Timestamp',
      'Action',
      'User Email',
      'User Name',
      'IP Address',
      'User Agent',
      'Resource Type',
      'Resource ID',
      'Metadata',
    ];

    const rows = logs.map(log => [
      log.createdAt.toISOString(),
      log.action,
      log.user?.email || '',
      log.user ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() : '',
      log.ipAddress || '',
      (log.userAgent || '').replace(/"/g, '""'),
      log.resourceType || '',
      log.resourceId || log.entityId || '',
      JSON.stringify(log.metadata || {}).replace(/"/g, '""'),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const filename = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } else {
    // Look up exporter email for JSON export
    const exporter = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { email: true },
    });

    const exportData = {
      exportedAt: new Date().toISOString(),
      exportedBy: exporter?.email || ctx.userId,
      totalRecords: logs.length,
      filters: {
        startDate: params.startDate,
        endDate: params.endDate,
        actions: params.actions,
        userId: params.userId,
      },
      logs: logs.map(log => ({
        id: log.id,
        timestamp: log.createdAt.toISOString(),
        action: log.action,
        user: {
          id: log.userId,
          email: log.user?.email,
          name: log.user ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() : undefined,
        },
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        resourceType: log.resourceType,
        resourceId: log.resourceId || log.entityId,
        metadata: log.metadata,
      })),
    };

    const filename = `audit-log-${new Date().toISOString().split('T')[0]}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }
});
