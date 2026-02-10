import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Pre-Approval Gates API
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { prisma } = await import('@/lib/prisma');
    const gates = await prisma.$queryRawUnsafe(
      `SELECT * FROM pre_approval_gates WHERE tenant_id = $1 ORDER BY gate_order ASC`, ctx.tenantId
    );
    return createSuccessResponse(ctx, { gates });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to fetch gates: ${error.message}`, 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO pre_approval_gates (id, tenant_id, name, description, gate_type, gate_order, conditions, required_approvers, approval_mode, auto_check, sla_hours, is_active, applies_to_types, applies_to_values_above, currency, created_by)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      ctx.tenantId, body.name, body.description || null, body.gateType || 'APPROVAL',
      body.gateOrder || 0, JSON.stringify(body.conditions || {}),
      JSON.stringify(body.requiredApprovers || []), body.approvalMode || 'ALL',
      body.autoCheck || null, body.slaHours || null, body.isActive ?? true,
      JSON.stringify(body.appliesToTypes || []), body.appliesToValuesAbove || null,
      body.currency || 'USD', ctx.userId
    );
    return createSuccessResponse(ctx, { gate: (result as any[])[0] });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to create gate: ${error.message}`, 500);
  }
});

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const result = await prisma.$queryRawUnsafe(
      `UPDATE pre_approval_gates SET name = COALESCE($1, name), is_active = COALESCE($2, is_active), gate_order = COALESCE($3, gate_order), updated_at = NOW() WHERE id = $4 AND tenant_id = $5 RETURNING *`,
      body.name || null, body.isActive ?? null, body.gateOrder ?? null, body.id, ctx.tenantId
    );
    return createSuccessResponse(ctx, { gate: (result as any[])[0] });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to update gate: ${error.message}`, 500);
  }
});
