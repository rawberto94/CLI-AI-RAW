import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

const governanceSubmitSchema = z.object({
  clauseId: z.string().min(1, 'clauseId is required'),
  version: z.number().optional(),
  changesSummary: z.string().optional(),
});

const governanceReviewSchema = z.object({
  id: z.string().min(1, 'id is required'),
  action: z.enum(['approve', 'reject', 'request_changes'], { required_error: 'action is required' }),
  notes: z.string().optional(),
});

export const dynamic = 'force-dynamic';

// Clause Governance Workflow API
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const { prisma } = await import('@/lib/prisma');

    const conditions: Prisma.Sql[] = [Prisma.sql`ca.tenant_id = ${ctx.tenantId}`];
    if (status) conditions.push(Prisma.sql`ca.status = ${status}`);
    const where = Prisma.join(conditions, ' AND ');

    const items = await prisma.$queryRaw`SELECT ca.*, cl.title as clause_title, cl.category as clause_category, cl.risk_level as clause_risk
       FROM clause_approvals ca
       LEFT JOIN clause_library cl ON ca.clause_id = cl.id
       WHERE ${where} ORDER BY ca.submitted_at DESC`;

    return createSuccessResponse(ctx, { approvals: items });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch clause approvals. Please try again.', 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();

    let validated;
    try {
      validated = governanceSubmitSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', error.errors.map(e => e.message).join(', '), 400);
      }
      throw error;
    }

    const { prisma } = await import('@/lib/prisma');

    const result = await prisma.$queryRaw`INSERT INTO clause_approvals (id, tenant_id, clause_id, status, submitted_by, version, changes_summary)
       VALUES (gen_random_uuid()::text, ${ctx.tenantId}, ${validated.clauseId}, 'PENDING', ${ctx.userId}, ${validated.version || 1}, ${validated.changesSummary || null}) RETURNING *`;

    return createSuccessResponse(ctx, { approval: (result as any[])[0] });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', error.errors.map(e => e.message).join(', '), 400);
    }
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to submit clause for approval. Please try again.', 500);
  }
});

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();

    let validated;
    try {
      validated = governanceReviewSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', error.errors.map(e => e.message).join(', '), 400);
      }
      throw error;
    }

    const { prisma } = await import('@/lib/prisma');

    if (validated.action === 'approve') {
      const result = await prisma.$queryRaw`UPDATE clause_approvals SET status = 'APPROVED', reviewed_by = ${ctx.userId}, reviewed_at = NOW(), review_notes = ${validated.notes || null}, updated_at = NOW() WHERE id = ${validated.id} AND tenant_id = ${ctx.tenantId} RETURNING *`;
      // Also update the clause library entry
      const approval = (result as any[])[0];
      if (approval) {
        await prisma.$queryRaw`UPDATE clause_library SET approved_by = ${ctx.userId}, approved_at = NOW(), updated_at = NOW() WHERE id = ${approval.clause_id}`;
      }
      return createSuccessResponse(ctx, { approval });
    }

    if (validated.action === 'reject') {
      const result = await prisma.$queryRaw`UPDATE clause_approvals SET status = 'REJECTED', reviewed_by = ${ctx.userId}, reviewed_at = NOW(), review_notes = ${validated.notes || ''}, updated_at = NOW() WHERE id = ${validated.id} AND tenant_id = ${ctx.tenantId} RETURNING *`;
      return createSuccessResponse(ctx, { approval: (result as any[])[0] });
    }

    return createErrorResponse(ctx, 'BAD_REQUEST', 'Action must be approve, reject, or request_changes', 400);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', error.errors.map(e => e.message).join(', '), 400);
    }
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to review clause. Please try again.', 500);
  }
});
