import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Routing Rules API
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { prisma } = await import('@/lib/prisma');
    const rules = await prisma.$queryRaw`SELECT * FROM routing_rules WHERE tenant_id = ${ctx.tenantId} ORDER BY priority DESC`;
    return createSuccessResponse(ctx, { rules });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to fetch routing rules. Please try again.`, 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const result = await prisma.$queryRaw`INSERT INTO routing_rules (id, tenant_id, name, description, is_active, priority, conditions, actions, assigned_team, assigned_user, sla_hours, auto_approve, created_by)
       VALUES (gen_random_uuid()::text, ${ctx.tenantId}, ${body.name}, ${body.description || null}, ${body.isActive ?? true}, ${body.priority || 0}, ${JSON.stringify(body.conditions || [])}, ${JSON.stringify(body.actions || {})}, ${body.assignedTeam || null}, ${body.assignedUser || null}, ${body.slaHours || null}, ${body.autoApprove ?? false}, ${ctx.userId}) RETURNING *`;
    return createSuccessResponse(ctx, { rule: (result as any[])[0] });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to create routing rule. Please try again.`, 500);
  }
});

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const result = await prisma.$queryRaw`UPDATE routing_rules SET name = COALESCE(${body.name || null}, name), is_active = COALESCE(${body.isActive ?? null}, is_active), priority = COALESCE(${body.priority ?? null}, priority), conditions = COALESCE(${body.conditions ? JSON.stringify(body.conditions) : null}, conditions), assigned_user = COALESCE(${body.assignedUser || null}, assigned_user), sla_hours = COALESCE(${body.slaHours || null}, sla_hours), updated_at = NOW(), updated_by = ${ctx.userId} WHERE id = ${body.id} AND tenant_id = ${ctx.tenantId} RETURNING *`;
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
    await prisma.$queryRaw`DELETE FROM routing_rules WHERE id = ${id} AND tenant_id = ${ctx.tenantId}`;
    return createSuccessResponse(ctx, { deleted: true });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to delete rule. Please try again.`, 500);
  }
});
