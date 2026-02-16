import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Legal Holds API
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const { prisma } = await import('@/lib/prisma');

    const conditions: Prisma.Sql[] = [Prisma.sql`tenant_id = ${ctx.tenantId}`];
    if (status) conditions.push(Prisma.sql`status = ${status}`);
    const where = Prisma.join(conditions, ' AND ');

    const items = await prisma.$queryRaw`SELECT * FROM legal_holds WHERE ${where} ORDER BY issued_at DESC`;

    return createSuccessResponse(ctx, { holds: items });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch legal holds. Please try again.', 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');

    const result = await prisma.$queryRaw`INSERT INTO legal_holds (id, tenant_id, name, description, matter_id, hold_type, contract_ids, obligation_ids, custodians, issued_by)
       VALUES (gen_random_uuid()::text, ${ctx.tenantId}, ${body.name}, ${body.description || null}, ${body.matterId || null}, ${body.holdType || 'LITIGATION'}, ${JSON.stringify(body.contractIds || [])}, ${JSON.stringify(body.obligationIds || [])}, ${JSON.stringify(body.custodians || [])}, ${ctx.userId}) RETURNING *`;

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
      const result = await prisma.$queryRaw`UPDATE legal_holds SET status = 'RELEASED', released_by = ${ctx.userId}, released_at = NOW(), release_reason = ${body.reason || ''}, updated_at = NOW() WHERE id = ${body.id} AND tenant_id = ${ctx.tenantId} RETURNING *`;
      return createSuccessResponse(ctx, { hold: (result as any[])[0] });
    }

    return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to update legal hold. Please try again.', 500);
  }
});
