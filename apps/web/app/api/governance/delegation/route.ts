import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Delegation of Authority Matrix API
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { prisma } = await import('@/lib/prisma');
    const items = await prisma.$queryRaw`SELECT * FROM delegation_of_authority WHERE tenant_id = ${ctx.tenantId} ORDER BY max_value ASC NULLS LAST`;
    return createSuccessResponse(ctx, { entries: items });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch DoA matrix. Please try again.', 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const result = await prisma.$queryRaw`INSERT INTO delegation_of_authority (id, tenant_id, name, role, department, contract_types, max_value, currency, requires_counter_sign, counter_sign_role, can_delegate, delegation_depth, conditions, is_active, effective_from, effective_until, created_by)
       VALUES (gen_random_uuid()::text, ${ctx.tenantId}, ${body.name}, ${body.role}, ${body.department || null}, ${JSON.stringify(body.contractTypes || [])}, ${body.maxValue || null}, ${body.currency || 'USD'}, ${body.requiresCounterSign ?? false}, ${body.counterSignRole || null}, ${body.canDelegate ?? true}, ${body.delegationDepth || 1}, ${JSON.stringify(body.conditions || {})}, ${body.isActive ?? true}, ${body.effectiveFrom || null}, ${body.effectiveUntil || null}, ${ctx.userId}) RETURNING *`;
    return createSuccessResponse(ctx, { entry: (result as any[])[0] });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to create DoA entry. Please try again.', 500);
  }
});

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const { id, ...data } = body;
    if (!id) return createErrorResponse(ctx, 'BAD_REQUEST', 'ID is required', 400);

    const result = await prisma.$queryRaw`UPDATE delegation_of_authority SET name = COALESCE(${data.name || null}, name), role = COALESCE(${data.role || null}, role), department = COALESCE(${data.department || null}, department), max_value = COALESCE(${data.maxValue || null}, max_value), is_active = COALESCE(${data.isActive ?? null}, is_active), updated_at = NOW() WHERE id = ${id} AND tenant_id = ${ctx.tenantId} RETURNING *`;
    return createSuccessResponse(ctx, { entry: (result as any[])[0] });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to update DoA entry. Please try again.', 500);
  }
});

export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return createErrorResponse(ctx, 'BAD_REQUEST', 'ID is required', 400);
    const { prisma } = await import('@/lib/prisma');
    await prisma.$queryRaw`DELETE FROM delegation_of_authority WHERE id = ${id} AND tenant_id = ${ctx.tenantId}`;
    return createSuccessResponse(ctx, { deleted: true });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to delete DoA entry. Please try again.', 500);
  }
});
