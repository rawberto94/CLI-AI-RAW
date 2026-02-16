import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Pre-Approval Gates API
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { prisma } = await import('@/lib/prisma');
    const gates = await prisma.$queryRaw`SELECT * FROM pre_approval_gates WHERE tenant_id = ${ctx.tenantId} ORDER BY gate_order ASC`;
    return createSuccessResponse(ctx, { gates });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch gates. Please try again.', 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const result = await prisma.$queryRaw`INSERT INTO pre_approval_gates (id, tenant_id, name, description, gate_type, gate_order, conditions, required_approvers, approval_mode, auto_check, sla_hours, is_active, applies_to_types, applies_to_values_above, currency, created_by)
       VALUES (gen_random_uuid()::text, ${ctx.tenantId}, ${body.name}, ${body.description || null}, ${body.gateType || 'APPROVAL'}, ${body.gateOrder || 0}, ${JSON.stringify(body.conditions || {})}, ${JSON.stringify(body.requiredApprovers || [])}, ${body.approvalMode || 'ALL'}, ${body.autoCheck || null}, ${body.slaHours || null}, ${body.isActive ?? true}, ${JSON.stringify(body.appliesToTypes || [])}, ${body.appliesToValuesAbove || null}, ${body.currency || 'USD'}, ${ctx.userId}) RETURNING *`;
    return createSuccessResponse(ctx, { gate: (result as any[])[0] });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to create gate. Please try again.', 500);
  }
});

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const result = await prisma.$queryRaw`UPDATE pre_approval_gates SET name = COALESCE(${body.name || null}, name), is_active = COALESCE(${body.isActive ?? null}, is_active), gate_order = COALESCE(${body.gateOrder ?? null}, gate_order), updated_at = NOW() WHERE id = ${body.id} AND tenant_id = ${ctx.tenantId} RETURNING *`;
    return createSuccessResponse(ctx, { gate: (result as any[])[0] });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to update gate. Please try again.', 500);
  }
});
