import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

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

    const conditions: Prisma.Sql[] = [Prisma.sql`tenant_id = ${ctx.tenantId}`];
    if (view === 'my-requests') conditions.push(Prisma.sql`requester_id = ${ctx.userId}`);
    if (status) conditions.push(Prisma.sql`status = ${status}`);
    if (assignedTo) conditions.push(Prisma.sql`assigned_to = ${assignedTo}`);
    const where = Prisma.join(conditions, ' AND ');

    const [items, countResult, metrics] = await Promise.all([
      prisma.$queryRaw`SELECT * FROM contract_requests WHERE ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      prisma.$queryRaw`SELECT COUNT(*)::int as total FROM contract_requests WHERE ${where}`,
      prisma.$queryRaw`SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER(WHERE status = 'SUBMITTED')::int as submitted,
        COUNT(*) FILTER(WHERE status = 'IN_TRIAGE')::int as in_triage,
        COUNT(*) FILTER(WHERE status = 'APPROVED')::int as approved,
        COUNT(*) FILTER(WHERE status = 'IN_PROGRESS')::int as in_progress,
        COUNT(*) FILTER(WHERE status = 'COMPLETED')::int as completed,
        COUNT(*) FILTER(WHERE status = 'REJECTED')::int as rejected,
        COUNT(*) FILTER(WHERE escalated = true AND status NOT IN ('COMPLETED','REJECTED'))::int as escalated,
        COUNT(*) FILTER(WHERE sla_deadline < NOW() AND status NOT IN ('COMPLETED','REJECTED','CANCELLED'))::int as sla_breached
      FROM contract_requests WHERE tenant_id = ${ctx.tenantId}`,
    ]);

    return createSuccessResponse(ctx, {
      requests: items,
      total: (countResult as any[])[0]?.total || 0,
      metrics: (metrics as any[])[0],
      page, limit,
    });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch contract requests. Please try again.', 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');

    const slaHours: Record<string, number> = { CRITICAL: 4, HIGH: 24, MEDIUM: 72, LOW: 168 };
    const deadline = new Date(Date.now() + (slaHours[body.urgency || 'MEDIUM'] || 72) * 3600000);

    const result = await prisma.$queryRaw`
      INSERT INTO contract_requests (id, tenant_id, requester_id, title, description, request_type, urgency, department, cost_center, estimated_value, currency, counterparty_name, counterparty_email, contract_type, desired_start_date, desired_end_date, business_justification, attachments, custom_fields, status, sla_deadline)
      VALUES (gen_random_uuid()::text, ${ctx.tenantId}, ${ctx.userId}, ${body.title}, ${body.description || null},
        ${body.requestType || 'NEW_CONTRACT'}, ${body.urgency || 'MEDIUM'},
        ${body.department || null}, ${body.costCenter || null},
        ${body.estimatedValue || null}, ${body.currency || 'USD'},
        ${body.counterpartyName || null}, ${body.counterpartyEmail || null},
        ${body.contractType || null}, ${body.desiredStartDate || null},
        ${body.desiredEndDate || null}, ${body.businessJustification || null},
        ${JSON.stringify(body.attachments || [])}, ${JSON.stringify(body.customFields || {})},
        'SUBMITTED', ${deadline}) RETURNING *
    `;

    return createSuccessResponse(ctx, { request: (result as any[])[0] });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to create contract request. Please try again.', 500);
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
        result = await prisma.$queryRaw`
          UPDATE contract_requests SET assigned_to = ${data.assignedTo}, triage_notes = ${data.triageNotes || null}, triage_priority = ${data.triagePriority || null}, triaged_by = ${ctx.userId}, triaged_at = NOW(), status = 'IN_TRIAGE', updated_at = NOW() WHERE id = ${id} AND tenant_id = ${ctx.tenantId} RETURNING *
        `;
        break;
      case 'approve':
        result = await prisma.$queryRaw`
          UPDATE contract_requests SET status = 'APPROVED', updated_at = NOW() WHERE id = ${id} AND tenant_id = ${ctx.tenantId} RETURNING *
        `;
        break;
      case 'reject':
        result = await prisma.$queryRaw`
          UPDATE contract_requests SET status = 'REJECTED', rejected_reason = ${data.reason}, updated_at = NOW() WHERE id = ${id} AND tenant_id = ${ctx.tenantId} RETURNING *
        `;
        break;
      case 'complete':
        result = await prisma.$queryRaw`
          UPDATE contract_requests SET status = 'COMPLETED', contract_id = ${data.contractId}, updated_at = NOW() WHERE id = ${id} AND tenant_id = ${ctx.tenantId} RETURNING *
        `;
        break;
      default:
        result = await prisma.$queryRaw`
          UPDATE contract_requests SET status = COALESCE(${data.status || null}, status), assigned_to = COALESCE(${data.assignedTo || null}, assigned_to), updated_at = NOW() WHERE id = ${id} AND tenant_id = ${ctx.tenantId} RETURNING *
        `;
    }

    return createSuccessResponse(ctx, { request: (result as any[])[0] });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to update request. Please try again.', 500);
  }
});
