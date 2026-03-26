import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Audit Logs API — dedicated endpoint for the audit log viewer
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const success = searchParams.get('success');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(Math.max(1, parseInt(searchParams.get('pageSize') || '100', 10) || 100), 200);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const userId = searchParams.get('userId');
    const detailId = searchParams.get('detailId');
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
