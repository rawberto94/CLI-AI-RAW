import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Amendments API
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');
    const { prisma } = await import('@/lib/prisma');

    const items = contractId
      ? await prisma.$queryRawUnsafe(`SELECT * FROM amendments WHERE tenant_id = $1 AND original_contract_id = $2 ORDER BY amendment_number DESC`, ctx.tenantId, contractId)
      : await prisma.$queryRawUnsafe(`SELECT * FROM amendments WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 100`, ctx.tenantId);

    const metrics = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int as total,
        COUNT(*) FILTER(WHERE status = 'DRAFT')::int as draft,
        COUNT(*) FILTER(WHERE status = 'IN_REVIEW')::int as in_review,
        COUNT(*) FILTER(WHERE status = 'APPROVED')::int as approved,
        COUNT(*) FILTER(WHERE status = 'EXECUTED')::int as executed
      FROM amendments WHERE tenant_id = $1
    `, ctx.tenantId);

    return createSuccessResponse(ctx, { amendments: items, metrics: (metrics as any[])[0] });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to fetch amendments: ${error.message}`, 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');

    const countResult = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int + 1 as next_number FROM amendments WHERE tenant_id = $1 AND original_contract_id = $2`,
      ctx.tenantId, body.originalContractId
    );

    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO amendments (id, tenant_id, original_contract_id, amendment_number, title, description, amendment_type, status, changes_summary, effective_date, financial_impact, currency, requires_re_signature, initiated_by)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, 'DRAFT', $7, $8, $9, $10, $11, $12) RETURNING *`,
      ctx.tenantId, body.originalContractId, (countResult as any[])[0]?.next_number || 1,
      body.title, body.description || null, body.amendmentType || 'MODIFICATION',
      JSON.stringify(body.changesSummary || []), body.effectiveDate || null,
      body.financialImpact || null, body.currency || 'USD',
      body.requiresReSignature ?? true, ctx.userId
    );

    return createSuccessResponse(ctx, { amendment: (result as any[])[0] });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to create amendment: ${error.message}`, 500);
  }
});

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const { id, status } = body;

    const extras = status === 'APPROVED' ? `, approved_by = $4, approved_at = NOW()` : status === 'EXECUTED' ? `, executed_at = NOW()` : '';
    const baseParams = [status, id, ctx.tenantId];
    const queryParams = status === 'APPROVED' ? [...baseParams, ctx.userId] : baseParams;

    const result = await prisma.$queryRawUnsafe(
      `UPDATE amendments SET status = $1 ${extras}, updated_at = NOW() WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      ...queryParams
    );

    return createSuccessResponse(ctx, { amendment: (result as any[])[0] });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to update amendment: ${error.message}`, 500);
  }
});
