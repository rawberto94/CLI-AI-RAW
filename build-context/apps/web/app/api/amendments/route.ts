import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Amendments API
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');
    const { prisma } = await import('@/lib/prisma');

    const items = contractId
      ? await prisma.$queryRaw`SELECT * FROM amendments WHERE tenant_id = ${ctx.tenantId} AND original_contract_id = ${contractId} ORDER BY amendment_number DESC`
      : await prisma.$queryRaw`SELECT * FROM amendments WHERE tenant_id = ${ctx.tenantId} ORDER BY created_at DESC LIMIT 100`;

    const metrics = await prisma.$queryRaw`
      SELECT COUNT(*)::int as total,
        COUNT(*) FILTER(WHERE status = 'DRAFT')::int as draft,
        COUNT(*) FILTER(WHERE status = 'IN_REVIEW')::int as in_review,
        COUNT(*) FILTER(WHERE status = 'APPROVED')::int as approved,
        COUNT(*) FILTER(WHERE status = 'EXECUTED')::int as executed
      FROM amendments WHERE tenant_id = ${ctx.tenantId}
    `;

    return createSuccessResponse(ctx, { amendments: items, metrics: (metrics as any[])[0] });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch amendments. Please try again.', 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');

    const countResult = await prisma.$queryRaw`SELECT COUNT(*)::int + 1 as next_number FROM amendments WHERE tenant_id = ${ctx.tenantId} AND original_contract_id = ${body.originalContractId}`;

    const result = await prisma.$queryRaw`INSERT INTO amendments (id, tenant_id, original_contract_id, amendment_number, title, description, amendment_type, status, changes_summary, effective_date, financial_impact, currency, requires_re_signature, initiated_by)
       VALUES (gen_random_uuid()::text, ${ctx.tenantId}, ${body.originalContractId}, ${(countResult as any[])[0]?.next_number || 1}, ${body.title}, ${body.description || null}, ${body.amendmentType || 'MODIFICATION'}, 'DRAFT', ${JSON.stringify(body.changesSummary || [])}, ${body.effectiveDate || null}, ${body.financialImpact || null}, ${body.currency || 'USD'}, ${body.requiresReSignature ?? true}, ${ctx.userId}) RETURNING *`;

    return createSuccessResponse(ctx, { amendment: (result as any[])[0] });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to create amendment. Please try again.', 500);
  }
});

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const { id, status } = body;

    let result;
    if (status === 'APPROVED') {
      result = await prisma.$queryRaw`UPDATE amendments SET status = ${status}, approved_by = ${ctx.userId}, approved_at = NOW(), updated_at = NOW() WHERE id = ${id} AND tenant_id = ${ctx.tenantId} RETURNING *`;
    } else if (status === 'EXECUTED') {
      result = await prisma.$queryRaw`UPDATE amendments SET status = ${status}, executed_at = NOW(), updated_at = NOW() WHERE id = ${id} AND tenant_id = ${ctx.tenantId} RETURNING *`;
    } else {
      result = await prisma.$queryRaw`UPDATE amendments SET status = ${status}, updated_at = NOW() WHERE id = ${id} AND tenant_id = ${ctx.tenantId} RETURNING *`;
    }

    return createSuccessResponse(ctx, { amendment: (result as any[])[0] });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to update amendment. Please try again.', 500);
  }
});
