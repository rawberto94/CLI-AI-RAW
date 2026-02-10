import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Clause Governance Workflow API
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const { prisma } = await import('@/lib/prisma');

    const conditions = [`ca.tenant_id = $1`];
    const params: unknown[] = [ctx.tenantId];
    if (status) { params.push(status); conditions.push(`ca.status = $${params.length}`); }

    const items = await prisma.$queryRawUnsafe(
      `SELECT ca.*, cl.title as clause_title, cl.category as clause_category, cl.risk_level as clause_risk
       FROM clause_approvals ca
       LEFT JOIN clause_library cl ON ca.clause_id = cl.id
       WHERE ${conditions.join(' AND ')} ORDER BY ca.submitted_at DESC`, ...params
    );

    return createSuccessResponse(ctx, { approvals: items });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to fetch clause approvals: ${error.message}`, 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');

    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO clause_approvals (id, tenant_id, clause_id, status, submitted_by, version, changes_summary)
       VALUES (gen_random_uuid()::text, $1, $2, 'PENDING', $3, $4, $5) RETURNING *`,
      ctx.tenantId, body.clauseId, ctx.userId, body.version || 1,
      body.changesSummary || null
    );

    return createSuccessResponse(ctx, { approval: (result as any[])[0] });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to submit clause for approval: ${error.message}`, 500);
  }
});

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');

    if (body.action === 'approve') {
      const result = await prisma.$queryRawUnsafe(
        `UPDATE clause_approvals SET status = 'APPROVED', reviewed_by = $1, reviewed_at = NOW(), review_notes = $2, updated_at = NOW() WHERE id = $3 AND tenant_id = $4 RETURNING *`,
        ctx.userId, body.notes || null, body.id, ctx.tenantId
      );
      // Also update the clause library entry
      const approval = (result as any[])[0];
      if (approval) {
        await prisma.$queryRawUnsafe(
          `UPDATE clause_library SET approved_by = $1, approved_at = NOW(), updated_at = NOW() WHERE id = $2`,
          ctx.userId, approval.clause_id
        );
      }
      return createSuccessResponse(ctx, { approval });
    }

    if (body.action === 'reject') {
      const result = await prisma.$queryRawUnsafe(
        `UPDATE clause_approvals SET status = 'REJECTED', reviewed_by = $1, reviewed_at = NOW(), review_notes = $2, updated_at = NOW() WHERE id = $3 AND tenant_id = $4 RETURNING *`,
        ctx.userId, body.notes || '', body.id, ctx.tenantId
      );
      return createSuccessResponse(ctx, { approval: (result as any[])[0] });
    }

    return createErrorResponse(ctx, 'BAD_REQUEST', 'Action must be approve or reject', 400);
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to review clause: ${error.message}`, 500);
  }
});
