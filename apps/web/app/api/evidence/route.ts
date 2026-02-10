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
      items = await prisma.$queryRawUnsafe(
        `SELECT * FROM evidence_items WHERE tenant_id = $1 AND obligation_id = $2 ORDER BY created_at DESC`,
        ctx.tenantId, obligationId
      );
    } else if (contractId) {
      items = await prisma.$queryRawUnsafe(
        `SELECT * FROM evidence_items WHERE tenant_id = $1 AND contract_id = $2 ORDER BY created_at DESC`,
        ctx.tenantId, contractId
      );
    } else {
      items = await prisma.$queryRawUnsafe(
        `SELECT * FROM evidence_items WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 100`, ctx.tenantId
      );
    }

    const metrics = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int as total,
        COUNT(*) FILTER(WHERE status = 'VERIFIED')::int as verified,
        COUNT(*) FILTER(WHERE status = 'PENDING_REVIEW')::int as pending,
        COUNT(*) FILTER(WHERE status = 'REJECTED')::int as rejected
      FROM evidence_items WHERE tenant_id = $1
    `, ctx.tenantId);

    return createSuccessResponse(ctx, { evidence: items, metrics: (metrics as any[])[0] });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to fetch evidence: ${error.message}`, 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO evidence_items (id, tenant_id, obligation_id, contract_id, title, description, evidence_type, file_url, file_name, file_size, mime_type, metadata, tags, uploaded_by)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      ctx.tenantId, body.obligationId, body.contractId, body.title,
      body.description || null, body.evidenceType || 'DOCUMENT',
      body.fileUrl || null, body.fileName || null, body.fileSize || null,
      body.mimeType || null, JSON.stringify(body.metadata || {}),
      JSON.stringify(body.tags || []), ctx.userId
    );
    return createSuccessResponse(ctx, { evidence: (result as any[])[0] });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to create evidence: ${error.message}`, 500);
  }
});

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const { id, action } = body;

    let result;
    if (action === 'verify') {
      result = await prisma.$queryRawUnsafe(
        `UPDATE evidence_items SET status = 'VERIFIED', verified_by = $1, verified_at = NOW(), verification_notes = $2, updated_at = NOW() WHERE id = $3 AND tenant_id = $4 RETURNING *`,
        ctx.userId, body.notes || null, id, ctx.tenantId
      );
    } else if (action === 'reject') {
      result = await prisma.$queryRawUnsafe(
        `UPDATE evidence_items SET status = 'REJECTED', verified_by = $1, verified_at = NOW(), verification_notes = $2, updated_at = NOW() WHERE id = $3 AND tenant_id = $4 RETURNING *`,
        ctx.userId, body.notes || '', id, ctx.tenantId
      );
    }
    return createSuccessResponse(ctx, { evidence: (result as any[])?.[0] });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to update evidence: ${error.message}`, 500);
  }
});
