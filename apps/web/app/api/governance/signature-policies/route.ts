import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Signature Policy API
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { prisma } = await import('@/lib/prisma');
    const items = await prisma.$queryRaw`SELECT * FROM signature_policies WHERE tenant_id = ${ctx.tenantId} ORDER BY created_at DESC`;
    return createSuccessResponse(ctx, { policies: items });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch signature policies. Please try again.', 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const result = await prisma.$queryRaw`INSERT INTO signature_policies (id, tenant_id, name, description, contract_types, min_value, max_value, currency, required_signatories, signing_order, requires_wet_signature, requires_notarization, provider, is_active, created_by)
       VALUES (gen_random_uuid()::text, ${ctx.tenantId}, ${body.name}, ${body.description || null}, ${JSON.stringify(body.contractTypes || [])}, ${body.minValue || null}, ${body.maxValue || null}, ${body.currency || 'USD'}, ${JSON.stringify(body.requiredSignatories || [])}, ${body.signingOrder || 'SEQUENTIAL'}, ${body.requiresWetSignature ?? false}, ${body.requiresNotarization ?? false}, ${body.provider || 'DOCUSIGN'}, ${body.isActive ?? true}, ${ctx.userId}) RETURNING *`;
    return createSuccessResponse(ctx, { policy: (result as any[])[0] });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to create signature policy. Please try again.', 500);
  }
});
