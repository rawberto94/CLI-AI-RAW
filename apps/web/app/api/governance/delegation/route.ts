import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Delegation of Authority Matrix API
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { prisma } = await import('@/lib/prisma');
    const items = await prisma.$queryRawUnsafe(
      `SELECT * FROM delegation_of_authority WHERE tenant_id = $1 ORDER BY max_value ASC NULLS LAST`, ctx.tenantId
    );
    return createSuccessResponse(ctx, { entries: items });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to fetch DoA matrix: ${error.message}`, 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO delegation_of_authority (id, tenant_id, name, role, department, contract_types, max_value, currency, requires_counter_sign, counter_sign_role, can_delegate, delegation_depth, conditions, is_active, effective_from, effective_until, created_by)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
      ctx.tenantId, body.name, body.role, body.department || null,
      JSON.stringify(body.contractTypes || []), body.maxValue || null,
      body.currency || 'USD', body.requiresCounterSign ?? false,
      body.counterSignRole || null, body.canDelegate ?? true,
      body.delegationDepth || 1, JSON.stringify(body.conditions || {}),
      body.isActive ?? true, body.effectiveFrom || null, body.effectiveUntil || null,
      ctx.userId
    );
    return createSuccessResponse(ctx, { entry: (result as any[])[0] });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to create DoA entry: ${error.message}`, 500);
  }
});

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const { id, ...data } = body;
    if (!id) return createErrorResponse(ctx, 'BAD_REQUEST', 'ID is required', 400);

    const result = await prisma.$queryRawUnsafe(
      `UPDATE delegation_of_authority SET name = COALESCE($1, name), role = COALESCE($2, role), department = COALESCE($3, department), max_value = COALESCE($4, max_value), is_active = COALESCE($5, is_active), updated_at = NOW() WHERE id = $6 AND tenant_id = $7 RETURNING *`,
      data.name || null, data.role || null, data.department || null,
      data.maxValue || null, data.isActive ?? null, id, ctx.tenantId
    );
    return createSuccessResponse(ctx, { entry: (result as any[])[0] });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to update DoA entry: ${error.message}`, 500);
  }
});

export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return createErrorResponse(ctx, 'BAD_REQUEST', 'ID is required', 400);
    const { prisma } = await import('@/lib/prisma');
    await prisma.$queryRawUnsafe(`DELETE FROM delegation_of_authority WHERE id = $1 AND tenant_id = $2`, id, ctx.tenantId);
    return createSuccessResponse(ctx, { deleted: true });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to delete DoA entry: ${error.message}`, 500);
  }
});
