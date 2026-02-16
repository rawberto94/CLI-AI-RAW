import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Audit Logs API — dedicated endpoint for the audit log viewer
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const success = searchParams.get('success');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '100', 10);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const userId = searchParams.get('userId');
    const detailId = searchParams.get('detailId');
    const { prisma } = await import('@/lib/prisma');

    // Detail view — fetch a single entry with full before/after data
    if (detailId) {
      const entries = await prisma.$queryRawUnsafe(`
        SELECT al.*, 
          u.name as actor_name, u.email as actor_email
        FROM audit_log al
        LEFT JOIN "User" u ON al.user_id = u.id
        WHERE al.id = $1::uuid AND al.tenant_id = $2
        LIMIT 1
      `, detailId, ctx.tenantId) as any[];

      if (entries.length === 0) return createErrorResponse(ctx, 'NOT_FOUND', 'Entry not found', 404);
      return createSuccessResponse(ctx, { entry: entries[0] });
    }

    // Build dynamic WHERE clauses
    const conditions: string[] = ['al.tenant_id = $1'];
    const params: any[] = [ctx.tenantId];
    let paramIdx = 2;

    if (category && category !== 'all') {
      conditions.push(`al.category = $${paramIdx}`);
      params.push(category);
      paramIdx++;
    }
    if (success && success !== 'all') {
      conditions.push(`al.success = $${paramIdx}`);
      params.push(success === 'true');
      paramIdx++;
    }
    if (search) {
      conditions.push(`(al.action ILIKE $${paramIdx} OR al.resource_name ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (startDate) {
      conditions.push(`al.created_at >= $${paramIdx}::timestamptz`);
      params.push(startDate);
      paramIdx++;
    }
    if (endDate) {
      conditions.push(`al.created_at <= $${paramIdx}::timestamptz`);
      params.push(endDate);
      paramIdx++;
    }
    if (userId) {
      conditions.push(`al.user_id = $${paramIdx}`);
      params.push(userId);
      paramIdx++;
    }

    const whereClause = conditions.join(' AND ');
    const offset = (page - 1) * pageSize;

    // Count total
    const countResult = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int as total FROM audit_log al WHERE ${whereClause}
    `, ...params) as any[];

    // Fetch paginated logs
    const logs = await prisma.$queryRawUnsafe(`
      SELECT al.*,
        u.name as actor_name, u.email as actor_email, u.role as actor_role
      FROM audit_log al
      LEFT JOIN "User" u ON al.user_id = u.id
      WHERE ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `, ...params);

    // Category breakdown
    const categoryBreakdown = await prisma.$queryRawUnsafe(`
      SELECT al.category, COUNT(*)::int as count
      FROM audit_log al WHERE ${whereClause}
      GROUP BY al.category ORDER BY count DESC
    `, ...params);

    return createSuccessResponse(ctx, {
      logs,
      total: countResult[0]?.total || 0,
      page,
      pageSize,
      categoryBreakdown,
    });
  } catch (error: unknown) {
    // If audit_log table doesn't exist, return empty gracefully
    if (error.message?.includes('does not exist')) {
      return createSuccessResponse(ctx, { logs: [], total: 0, page: 1, pageSize: 100, categoryBreakdown: [] });
    }
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'An internal error occurred. Please try again.', 500);
  }
});
