import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Signature Policy API
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { prisma } = await import('@/lib/prisma');
    const items = await prisma.$queryRawUnsafe(
      `SELECT * FROM signature_policies WHERE tenant_id = $1 ORDER BY created_at DESC`, ctx.tenantId
    );
    return createSuccessResponse(ctx, { policies: items });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to fetch signature policies: ${error.message}`, 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO signature_policies (id, tenant_id, name, description, contract_types, min_value, max_value, currency, required_signatories, signing_order, requires_wet_signature, requires_notarization, provider, is_active, created_by)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      ctx.tenantId, body.name, body.description || null,
      JSON.stringify(body.contractTypes || []), body.minValue || null,
      body.maxValue || null, body.currency || 'USD',
      JSON.stringify(body.requiredSignatories || []),
      body.signingOrder || 'SEQUENTIAL', body.requiresWetSignature ?? false,
      body.requiresNotarization ?? false, body.provider || 'DOCUSIGN',
      body.isActive ?? true, ctx.userId
    );
    return createSuccessResponse(ctx, { policy: (result as any[])[0] });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to create signature policy: ${error.message}`, 500);
  }
});
