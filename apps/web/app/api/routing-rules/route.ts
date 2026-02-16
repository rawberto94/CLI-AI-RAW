import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Routing Rules API
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { prisma } = await import('@/lib/prisma');
    const rules = await prisma.$queryRawUnsafe(
      `SELECT * FROM routing_rules WHERE tenant_id = $1 ORDER BY priority DESC`, ctx.tenantId
    );
    return createSuccessResponse(ctx, { rules });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to fetch routing rules. Please try again.`, 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO routing_rules (id, tenant_id, name, description, is_active, priority, conditions, actions, assigned_team, assigned_user, sla_hours, auto_approve, created_by)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      ctx.tenantId, body.name, body.description || null, body.isActive ?? true,
      body.priority || 0, JSON.stringify(body.conditions || []),
      JSON.stringify(body.actions || {}), body.assignedTeam || null,
      body.assignedUser || null, body.slaHours || null, body.autoApprove ?? false,
      ctx.userId
    );
    return createSuccessResponse(ctx, { rule: (result as any[])[0] });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to create routing rule. Please try again.`, 500);
  }
});

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const result = await prisma.$queryRawUnsafe(
      `UPDATE routing_rules SET name = COALESCE($1, name), is_active = COALESCE($2, is_active), priority = COALESCE($3, priority), conditions = COALESCE($4, conditions), assigned_user = COALESCE($5, assigned_user), sla_hours = COALESCE($6, sla_hours), updated_at = NOW(), updated_by = $7 WHERE id = $8 AND tenant_id = $9 RETURNING *`,
      body.name || null, body.isActive ?? null, body.priority ?? null,
      body.conditions ? JSON.stringify(body.conditions) : null,
      body.assignedUser || null, body.slaHours || null, ctx.userId,
      body.id, ctx.tenantId
    );
    return createSuccessResponse(ctx, { rule: (result as any[])[0] });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to update routing rule. Please try again.`, 500);
  }
});

export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return createErrorResponse(ctx, 'BAD_REQUEST', 'Rule ID required', 400);
    const { prisma } = await import('@/lib/prisma');
    await prisma.$queryRawUnsafe(`DELETE FROM routing_rules WHERE id = $1 AND tenant_id = $2`, id, ctx.tenantId);
    return createSuccessResponse(ctx, { deleted: true });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to delete rule. Please try again.`, 500);
  }
});
