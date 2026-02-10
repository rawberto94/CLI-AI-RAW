import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Contract Request Intake API
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const assignedTo = searchParams.get('assignedTo') || undefined;
    const view = searchParams.get('view'); // 'my-requests' for requester view
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const { prisma } = await import('@/lib/prisma');

    const conditions = [`tenant_id = $1`];
    const params: unknown[] = [ctx.tenantId];
    if (view === 'my-requests') { params.push(ctx.userId); conditions.push(`requester_id = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
    if (assignedTo) { params.push(assignedTo); conditions.push(`assigned_to = $${params.length}`); }
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const [items, countResult, metrics] = await Promise.all([
      prisma.$queryRawUnsafe(`SELECT * FROM contract_requests ${whereClause} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`, ...params),
      prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as total FROM contract_requests ${whereClause}`, ...params),
      prisma.$queryRawUnsafe(`SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER(WHERE status = 'SUBMITTED')::int as submitted,
        COUNT(*) FILTER(WHERE status = 'IN_TRIAGE')::int as in_triage,
        COUNT(*) FILTER(WHERE status = 'APPROVED')::int as approved,
        COUNT(*) FILTER(WHERE status = 'IN_PROGRESS')::int as in_progress,
        COUNT(*) FILTER(WHERE status = 'COMPLETED')::int as completed,
        COUNT(*) FILTER(WHERE status = 'REJECTED')::int as rejected,
        COUNT(*) FILTER(WHERE escalated = true AND status NOT IN ('COMPLETED','REJECTED'))::int as escalated,
        COUNT(*) FILTER(WHERE sla_deadline < NOW() AND status NOT IN ('COMPLETED','REJECTED','CANCELLED'))::int as sla_breached
      FROM contract_requests WHERE tenant_id = $1`, ctx.tenantId),
    ]);

    return createSuccessResponse(ctx, {
      requests: items,
      total: (countResult as any[])[0]?.total || 0,
      metrics: (metrics as any[])[0],
      page, limit,
    });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to fetch contract requests: ${error.message}`, 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');

    const slaHours: Record<string, number> = { CRITICAL: 4, HIGH: 24, MEDIUM: 72, LOW: 168 };
    const deadline = new Date(Date.now() + (slaHours[body.urgency || 'MEDIUM'] || 72) * 3600000);

    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO contract_requests (id, tenant_id, requester_id, title, description, request_type, urgency, department, cost_center, estimated_value, currency, counterparty_name, counterparty_email, contract_type, desired_start_date, desired_end_date, business_justification, attachments, custom_fields, status, sla_deadline)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'SUBMITTED', $19) RETURNING *`,
      ctx.tenantId, ctx.userId, body.title, body.description || null,
      body.requestType || 'NEW_CONTRACT', body.urgency || 'MEDIUM',
      body.department || null, body.costCenter || null,
      body.estimatedValue || null, body.currency || 'USD',
      body.counterpartyName || null, body.counterpartyEmail || null,
      body.contractType || null, body.desiredStartDate || null,
      body.desiredEndDate || null, body.businessJustification || null,
      JSON.stringify(body.attachments || []), JSON.stringify(body.customFields || {}),
      deadline
    );

    return createSuccessResponse(ctx, { request: (result as any[])[0] });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to create contract request: ${error.message}`, 500);
  }
});

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const { id, action, ...data } = body;

    if (!id) return createErrorResponse(ctx, 'BAD_REQUEST', 'Request ID is required', 400);

    let result;
    switch (action) {
      case 'triage':
        result = await prisma.$queryRawUnsafe(
          `UPDATE contract_requests SET assigned_to = $1, triage_notes = $2, triage_priority = $3, triaged_by = $4, triaged_at = NOW(), status = 'IN_TRIAGE', updated_at = NOW() WHERE id = $5 AND tenant_id = $6 RETURNING *`,
          data.assignedTo, data.triageNotes || null, data.triagePriority || null, ctx.userId, id, ctx.tenantId
        );
        break;
      case 'approve':
        result = await prisma.$queryRawUnsafe(
          `UPDATE contract_requests SET status = 'APPROVED', updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *`, id, ctx.tenantId
        );
        break;
      case 'reject':
        result = await prisma.$queryRawUnsafe(
          `UPDATE contract_requests SET status = 'REJECTED', rejected_reason = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3 RETURNING *`,
          data.reason, id, ctx.tenantId
        );
        break;
      case 'complete':
        result = await prisma.$queryRawUnsafe(
          `UPDATE contract_requests SET status = 'COMPLETED', contract_id = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3 RETURNING *`,
          data.contractId, id, ctx.tenantId
        );
        break;
      default:
        result = await prisma.$queryRawUnsafe(
          `UPDATE contract_requests SET status = COALESCE($1, status), assigned_to = COALESCE($2, assigned_to), updated_at = NOW() WHERE id = $3 AND tenant_id = $4 RETURNING *`,
          data.status || null, data.assignedTo || null, id, ctx.tenantId
        );
    }

    return createSuccessResponse(ctx, { request: (result as any[])[0] });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to update request: ${error.message}`, 500);
  }
});
