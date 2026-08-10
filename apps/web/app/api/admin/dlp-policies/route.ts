import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';
import { isMissingRelationError } from '@/lib/db/missing-relation';

export const dynamic = 'force-dynamic';

// DLP Policies API
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'owner') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  try {
    const { prisma } = await import('@/lib/prisma');
    const policies = await prisma.$queryRaw`SELECT * FROM dlp_policies WHERE tenant_id = ${ctx.tenantId} ORDER BY created_at DESC`;
    return createSuccessResponse(ctx, { policies, storageAvailable: true });
  } catch (error: unknown) {
    if (isMissingRelationError(error)) {
      return createSuccessResponse(ctx, {
        policies: [],
        storageAvailable: false,
        warning: 'DLP policy storage is not provisioned in this environment.',
      });
    }
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch DLP policies. Please try again.', 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'owner') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');

    const result = await prisma.$queryRaw`INSERT INTO dlp_policies (id, tenant_id, name, description, policy_type, rules, actions, applies_to_roles, is_active, created_by)
       VALUES (gen_random_uuid()::text, ${ctx.tenantId}, ${body.name}, ${body.description || null}, ${body.policyType || 'DOWNLOAD_RESTRICTION'}, ${JSON.stringify(body.rules || [])}, ${JSON.stringify(body.actions || { block: false, alert: true, log: true })}, ${JSON.stringify(body.appliesToRoles || [])}, ${body.isActive ?? true}, ${ctx.userId}) RETURNING *`;

    return createSuccessResponse(ctx, { policy: (result as any[])[0] });
  } catch (error: unknown) {
    if (isMissingRelationError(error)) {
      return createErrorResponse(ctx, 'NOT_IMPLEMENTED', 'DLP policy storage is not provisioned in this environment.', 501);
    }
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to create DLP policy. Please try again.', 500);
  }
});
