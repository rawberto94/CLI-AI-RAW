import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Records Management — Archive, Restore, Defensible Deletion
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'owner') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'archived';
    const { prisma } = await import('@/lib/prisma');

    if (type === 'archived') {
      const items = await prisma.$queryRaw`SELECT * FROM archived_contracts WHERE tenant_id = ${ctx.tenantId} ORDER BY archived_at DESC`;
      return createSuccessResponse(ctx, { archived: items });
    }

    if (type === 'deletion-certs') {
      const items = await prisma.$queryRaw`SELECT * FROM deletion_certificates WHERE tenant_id = ${ctx.tenantId} ORDER BY deleted_at DESC`;
      return createSuccessResponse(ctx, { certificates: items });
    }

    const metrics = await prisma.$queryRaw`
      SELECT
        (SELECT COUNT(*)::int FROM archived_contracts WHERE tenant_id = ${ctx.tenantId}) as archived_count,
        (SELECT COUNT(*)::int FROM archived_contracts WHERE tenant_id = ${ctx.tenantId} AND status = 'PENDING_DELETION') as pending_deletion,
        (SELECT COUNT(*)::int FROM deletion_certificates WHERE tenant_id = ${ctx.tenantId}) as deleted_count,
        (SELECT COUNT(*)::int FROM archived_contracts WHERE tenant_id = ${ctx.tenantId} AND archive_type = 'RETENTION_BASED') as retention_based,
        (SELECT COUNT(*)::int FROM archived_contracts WHERE tenant_id = ${ctx.tenantId} AND archive_type = 'MANUAL') as manual_archive
    `;

    return createSuccessResponse(ctx, { metrics: (metrics as any[])[0] });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch records. Please try again.', 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'owner') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const { action, ...data } = body;

    if (action === 'archive') {
      // Check legal hold first
      const holds = await prisma.$queryRaw`SELECT COUNT(*)::int as hold_count FROM legal_holds WHERE tenant_id = ${ctx.tenantId} AND status = 'ACTIVE' AND contract_ids @> ${JSON.stringify([data.contractId])}::jsonb` as any[];

      if (holds[0]?.hold_count > 0) {
        return createErrorResponse(ctx, 'FORBIDDEN', 'Contract is under legal hold and cannot be archived', 403);
      }

      const result = await prisma.$queryRaw`INSERT INTO archived_contracts (id, tenant_id, contract_id, contract_snapshot, archive_type, reason, retention_policy, retention_until, archive_location, archived_by)
         VALUES (gen_random_uuid()::text, ${ctx.tenantId}, ${data.contractId}, ${JSON.stringify(data.snapshot || {})}, ${data.archiveType || 'MANUAL'}, ${data.reason || null}, ${JSON.stringify(data.retentionPolicy || {})}, ${data.retentionUntil || null}, ${data.archiveLocation || 'DEFAULT'}, ${ctx.userId}) RETURNING *`;
      return createSuccessResponse(ctx, { archived: (result as any[])[0] });
    }

    if (action === 'delete-defensible') {
      // Mark for defensible deletion
      const result = await prisma.$queryRaw`INSERT INTO deletion_certificates (id, tenant_id, contract_id, deletion_type, reason, data_categories_deleted, verification_method, certified_by)
         VALUES (gen_random_uuid()::text, ${ctx.tenantId}, ${data.contractId}, ${data.deletionType || 'RETENTION_EXPIRY'}, ${data.reason || null}, ${JSON.stringify(data.dataCategoriesDeleted || ['contract', 'attachments', 'metadata'])}, ${data.verificationMethod || 'AUTOMATED'}, ${ctx.userId}) RETURNING *`;
      return createSuccessResponse(ctx, { certificate: (result as any[])[0] });
    }

    return createErrorResponse(ctx, 'BAD_REQUEST', 'Action must be archive or delete-defensible', 400);
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed in records operation. Please try again.', 500);
  }
});
