import { NextRequest, type NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { hasPermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const AUDIT_LOG_EXPORT_LIMIT = 10_000;

const AUDIT_LOG_CSV_HEADERS = [
  'Timestamp',
  'Action',
  'Category',
  'Success',
  'Actor Name',
  'Actor Email',
  'Actor Role',
  'Resource Type',
  'Resource ID',
  'Resource Name',
  'IP Address',
  'User Agent',
  'Error',
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const text = value instanceof Date
    ? value.toISOString()
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);
  return `"${text.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
}

function formatAuditLogsCsv(logs: Array<Record<string, unknown>>): string {
  const rows = logs.map((log) => [
    log.createdAt,
    log.action,
    log.category,
    log.success === true ? 'Yes' : log.success === false ? 'No' : '',
    log.actorName,
    log.actorEmail,
    log.actorRole,
    log.resourceType,
    log.resourceId,
    log.resourceName,
    log.ipAddress,
    log.userAgent,
    log.errorMessage,
  ].map(csvCell).join(','));

  return [AUDIT_LOG_CSV_HEADERS.join(','), ...rows].join('\n');
}

// Audit Logs API — dedicated endpoint for the audit log viewer
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const canViewAudit = await hasPermission(ctx.userId, 'audit:view');
    if (!canViewAudit) {
      return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403);
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const success = searchParams.get('success');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(searchParams.get('pageSize') || searchParams.get('limit') || '100', 10) || 100), 200);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const userId = searchParams.get('userId');
    const detailId = searchParams.get('detailId');
    const isCsvExport = searchParams.get('export') === 'csv' || searchParams.get('format') === 'csv';
    const isJsonExport = searchParams.get('export') === 'json' || searchParams.get('format') === 'json';
    const { prisma } = await import('@/lib/prisma');

    // Detail view — fetch a single entry with full before/after data
    if (detailId) {
      const entries = await prisma.$queryRaw`
        SELECT al.*, 
          u.name as actor_name, u.email as actor_email
        FROM audit_log al
        LEFT JOIN "User" u ON al.user_id = u.id
        WHERE al.id = ${detailId}::uuid AND al.tenant_id = ${ctx.tenantId}
        LIMIT 1
      ` as any[];

      if (entries.length === 0) return createErrorResponse(ctx, 'NOT_FOUND', 'Entry not found', 404);
      return createSuccessResponse(ctx, { entry: entries[0] });
    }

    // Build dynamic WHERE clauses
    const conditions: Prisma.Sql[] = [Prisma.sql`al.tenant_id = ${ctx.tenantId}`];

    if (category && category !== 'all') {
      conditions.push(Prisma.sql`al.category = ${category}`);
    }
    if (success && success !== 'all') {
      conditions.push(Prisma.sql`al.success = ${success === 'true'}`);
    }
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(Prisma.sql`(al.action ILIKE ${pattern} OR al.resource_name ILIKE ${pattern})`);
    }
    if (startDate) {
      conditions.push(Prisma.sql`al.created_at >= ${startDate}::timestamptz`);
    }
    if (endDate) {
      conditions.push(Prisma.sql`al.created_at <= ${endDate}::timestamptz`);
    }
    if (userId) {
      conditions.push(Prisma.sql`al.user_id = ${userId}`);
    }

    const where = Prisma.join(conditions, ' AND ');
    const offset = (page - 1) * pageSize;

    if (isCsvExport || isJsonExport) {
      const canExportAudit = await hasPermission(ctx.userId, 'audit:export');
      if (!canExportAudit) {
        return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403);
      }

      const exportLimit = Math.min(
        Math.max(1, parseInt(searchParams.get('limit') || String(AUDIT_LOG_EXPORT_LIMIT), 10) || AUDIT_LOG_EXPORT_LIMIT),
        AUDIT_LOG_EXPORT_LIMIT,
      );

      const logs = await prisma.$queryRaw`
        SELECT
          al.created_at as "createdAt",
          al.action,
          al.category,
          al.success,
          al.resource_type as "resourceType",
          al.resource_id as "resourceId",
          al.resource_name as "resourceName",
          al.ip_address as "ipAddress",
          al.user_agent as "userAgent",
          al.error_message as "errorMessage",
          al.details,
          al.changes,
          al.metadata,
          u.name as "actorName",
          u.email as "actorEmail",
          u.role as "actorRole"
        FROM audit_log al
        LEFT JOIN "User" u ON al.user_id = u.id
        WHERE ${where}
        ORDER BY al.created_at DESC
        LIMIT ${exportLimit}
      ` as Array<Record<string, unknown>>;

      if (isJsonExport) {
        const filename = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
        return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), count: logs.length, logs }, null, 2), {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
          },
        }) as unknown as NextResponse;
      }

      const csv = formatAuditLogsCsv(logs);
      const filename = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;

      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      }) as unknown as NextResponse;
    }

    // Count total
    const countResult = await prisma.$queryRaw`
      SELECT COUNT(*)::int as total FROM audit_log al WHERE ${where}
    ` as any[];

    // Fetch paginated logs
    const logs = await prisma.$queryRaw`
      SELECT al.*,
        u.name as actor_name, u.email as actor_email, u.role as actor_role
      FROM audit_log al
      LEFT JOIN "User" u ON al.user_id = u.id
      WHERE ${where}
      ORDER BY al.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    // Category breakdown
    const categoryBreakdown = await prisma.$queryRaw`
      SELECT al.category, COUNT(*)::int as count
      FROM audit_log al WHERE ${where}
      GROUP BY al.category ORDER BY count DESC
    `;

    return createSuccessResponse(ctx, {
      logs,
      total: countResult[0]?.total || 0,
      page,
      pageSize,
      categoryBreakdown,
    });
  } catch (error: unknown) {
    // If audit_log table doesn't exist, return empty gracefully
    if ((error as Error).message?.includes('does not exist')) {
      return createSuccessResponse(ctx, { logs: [], total: 0, page: 1, pageSize: 100, categoryBreakdown: [] });
    }
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'An internal error occurred. Please try again.', 500);
  }
});
