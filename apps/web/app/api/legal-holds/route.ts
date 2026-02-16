import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Legal Holds API
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const { prisma } = await import('@/lib/prisma');

    const where = status
      ? `WHERE tenant_id = $1 AND status = $2`
      : `WHERE tenant_id = $1`;
    const queryParams: unknown[] = status ? [ctx.tenantId, status] : [ctx.tenantId];

    const items = await prisma.$queryRawUnsafe(
      `SELECT * FROM legal_holds ${where} ORDER BY issued_at DESC`, ...queryParams
    );

    return createSuccessResponse(ctx, { holds: items });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch legal holds. Please try again.', 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');

    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO legal_holds (id, tenant_id, name, description, matter_id, hold_type, contract_ids, obligation_ids, custodians, issued_by)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      ctx.tenantId, body.name, body.description || null, body.matterId || null,
      body.holdType || 'LITIGATION', JSON.stringify(body.contractIds || []),
      JSON.stringify(body.obligationIds || []), JSON.stringify(body.custodians || []),
      ctx.userId
    );

    return createSuccessResponse(ctx, { hold: (result as any[])[0] });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to create legal hold. Please try again.', 500);
  }
});

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');

    if (body.action === 'release') {
      const result = await prisma.$queryRawUnsafe(
        `UPDATE legal_holds SET status = 'RELEASED', released_by = $1, released_at = NOW(), release_reason = $2, updated_at = NOW() WHERE id = $3 AND tenant_id = $4 RETURNING *`,
        ctx.userId, body.reason || '', body.id, ctx.tenantId
      );
      return createSuccessResponse(ctx, { hold: (result as any[])[0] });
    }

    return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to update legal hold. Please try again.', 500);
  }
});
