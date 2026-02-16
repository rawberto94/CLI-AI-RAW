import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// DLP Policies API
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { prisma } = await import('@/lib/prisma');
    const policies = await prisma.$queryRaw`SELECT * FROM dlp_policies WHERE tenant_id = ${ctx.tenantId} ORDER BY created_at DESC`;
    return createSuccessResponse(ctx, { policies });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch DLP policies. Please try again.', 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');

    const result = await prisma.$queryRaw`INSERT INTO dlp_policies (id, tenant_id, name, description, policy_type, rules, actions, applies_to_roles, is_active, created_by)
       VALUES (gen_random_uuid()::text, ${ctx.tenantId}, ${body.name}, ${body.description || null}, ${body.policyType || 'DOWNLOAD_RESTRICTION'}, ${JSON.stringify(body.rules || [])}, ${JSON.stringify(body.actions || { block: false, alert: true, log: true })}, ${JSON.stringify(body.appliesToRoles || [])}, ${body.isActive ?? true}, ${ctx.userId}) RETURNING *`;

    return createSuccessResponse(ctx, { policy: (result as any[])[0] });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to create DLP policy. Please try again.', 500);
  }
});
