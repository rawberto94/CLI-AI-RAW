import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// DLP Policies API
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { prisma } = await import('@/lib/prisma');
    const policies = await prisma.$queryRawUnsafe(
      `SELECT * FROM dlp_policies WHERE tenant_id = $1 ORDER BY created_at DESC`, ctx.tenantId
    );
    return createSuccessResponse(ctx, { policies });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to fetch DLP policies: ${error.message}`, 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');

    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO dlp_policies (id, tenant_id, name, description, policy_type, rules, actions, applies_to_roles, is_active, created_by)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      ctx.tenantId, body.name, body.description || null, body.policyType || 'DOWNLOAD_RESTRICTION',
      JSON.stringify(body.rules || []),
      JSON.stringify(body.actions || { block: false, alert: true, log: true }),
      JSON.stringify(body.appliesToRoles || []), body.isActive ?? true, ctx.userId
    );

    return createSuccessResponse(ctx, { policy: (result as any[])[0] });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to create DLP policy: ${error.message}`, 500);
  }
});
