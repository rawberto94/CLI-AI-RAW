import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Evidence Repository API
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const obligationId = searchParams.get('obligationId');
    const contractId = searchParams.get('contractId');
    const { prisma } = await import('@/lib/prisma');

    let items;
    if (obligationId) {
      items = await prisma.$queryRaw`SELECT * FROM evidence_items WHERE tenant_id = ${ctx.tenantId} AND obligation_id = ${obligationId} ORDER BY created_at DESC`;
    } else if (contractId) {
      items = await prisma.$queryRaw`SELECT * FROM evidence_items WHERE tenant_id = ${ctx.tenantId} AND contract_id = ${contractId} ORDER BY created_at DESC`;
    } else {
      items = await prisma.$queryRaw`SELECT * FROM evidence_items WHERE tenant_id = ${ctx.tenantId} ORDER BY created_at DESC LIMIT 100`;
    }

    const metrics = await prisma.$queryRaw`
      SELECT COUNT(*)::int as total,
        COUNT(*) FILTER(WHERE status = 'VERIFIED')::int as verified,
        COUNT(*) FILTER(WHERE status = 'PENDING_REVIEW')::int as pending,
        COUNT(*) FILTER(WHERE status = 'REJECTED')::int as rejected
      FROM evidence_items WHERE tenant_id = ${ctx.tenantId}
    `;

    return createSuccessResponse(ctx, { evidence: items, metrics: (metrics as any[])[0] });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to fetch evidence. Please try again.`, 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const result = await prisma.$queryRaw`INSERT INTO evidence_items (id, tenant_id, obligation_id, contract_id, title, description, evidence_type, file_url, file_name, file_size, mime_type, metadata, tags, uploaded_by)
       VALUES (gen_random_uuid()::text, ${ctx.tenantId}, ${body.obligationId}, ${body.contractId}, ${body.title}, ${body.description || null}, ${body.evidenceType || 'DOCUMENT'}, ${body.fileUrl || null}, ${body.fileName || null}, ${body.fileSize || null}, ${body.mimeType || null}, ${JSON.stringify(body.metadata || {})}, ${JSON.stringify(body.tags || [])}, ${ctx.userId}) RETURNING *`;
    return createSuccessResponse(ctx, { evidence: (result as any[])[0] });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to create evidence. Please try again.`, 500);
  }
});

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const { id, action } = body;

    let result;
    if (action === 'verify') {
      result = await prisma.$queryRaw`UPDATE evidence_items SET status = 'VERIFIED', verified_by = ${ctx.userId}, verified_at = NOW(), verification_notes = ${body.notes || null}, updated_at = NOW() WHERE id = ${id} AND tenant_id = ${ctx.tenantId} RETURNING *`;
    } else if (action === 'reject') {
      result = await prisma.$queryRaw`UPDATE evidence_items SET status = 'REJECTED', verified_by = ${ctx.userId}, verified_at = NOW(), verification_notes = ${body.notes || ''}, updated_at = NOW() WHERE id = ${id} AND tenant_id = ${ctx.tenantId} RETURNING *`;
    }
    return createSuccessResponse(ctx, { evidence: (result as any[])?.[0] });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to update evidence. Please try again.`, 500);
  }
});
