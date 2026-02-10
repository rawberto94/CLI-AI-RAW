import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Records Management — Archive, Restore, Defensible Deletion
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'archived';
    const { prisma } = await import('@/lib/prisma');

    if (type === 'archived') {
      const items = await prisma.$queryRawUnsafe(
        `SELECT * FROM archived_contracts WHERE tenant_id = $1 ORDER BY archived_at DESC`, ctx.tenantId
      );
      return createSuccessResponse(ctx, { archived: items });
    }

    if (type === 'deletion-certs') {
      const items = await prisma.$queryRawUnsafe(
        `SELECT * FROM deletion_certificates WHERE tenant_id = $1 ORDER BY deleted_at DESC`, ctx.tenantId
      );
      return createSuccessResponse(ctx, { certificates: items });
    }

    const metrics = await prisma.$queryRawUnsafe(`
      SELECT
        (SELECT COUNT(*)::int FROM archived_contracts WHERE tenant_id = $1) as archived_count,
        (SELECT COUNT(*)::int FROM archived_contracts WHERE tenant_id = $1 AND status = 'PENDING_DELETION') as pending_deletion,
        (SELECT COUNT(*)::int FROM deletion_certificates WHERE tenant_id = $1) as deleted_count,
        (SELECT COUNT(*)::int FROM archived_contracts WHERE tenant_id = $1 AND archive_type = 'RETENTION_BASED') as retention_based,
        (SELECT COUNT(*)::int FROM archived_contracts WHERE tenant_id = $1 AND archive_type = 'MANUAL') as manual_archive
    `, ctx.tenantId);

    return createSuccessResponse(ctx, { metrics: (metrics as any[])[0] });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to fetch records: ${error.message}`, 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const { action, ...data } = body;

    if (action === 'archive') {
      // Check legal hold first
      const holds = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int as hold_count FROM legal_holds WHERE tenant_id = $1 AND status = 'ACTIVE' AND contract_ids @> $2::jsonb`,
        ctx.tenantId, JSON.stringify([data.contractId])
      ) as any[];

      if (holds[0]?.hold_count > 0) {
        return createErrorResponse(ctx, 'FORBIDDEN', 'Contract is under legal hold and cannot be archived', 403);
      }

      const result = await prisma.$queryRawUnsafe(
        `INSERT INTO archived_contracts (id, tenant_id, contract_id, contract_snapshot, archive_type, reason, retention_policy, retention_until, archive_location, archived_by)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        ctx.tenantId, data.contractId, JSON.stringify(data.snapshot || {}),
        data.archiveType || 'MANUAL', data.reason || null,
        JSON.stringify(data.retentionPolicy || {}), data.retentionUntil || null,
        data.archiveLocation || 'DEFAULT', ctx.userId
      );
      return createSuccessResponse(ctx, { archived: (result as any[])[0] });
    }

    if (action === 'delete-defensible') {
      // Mark for defensible deletion
      const result = await prisma.$queryRawUnsafe(
        `INSERT INTO deletion_certificates (id, tenant_id, contract_id, deletion_type, reason, data_categories_deleted, verification_method, certified_by)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        ctx.tenantId, data.contractId, data.deletionType || 'RETENTION_EXPIRY',
        data.reason || null, JSON.stringify(data.dataCategoriesDeleted || ['contract', 'attachments', 'metadata']),
        data.verificationMethod || 'AUTOMATED', ctx.userId
      );
      return createSuccessResponse(ctx, { certificate: (result as any[])[0] });
    }

    return createErrorResponse(ctx, 'BAD_REQUEST', 'Action must be archive or delete-defensible', 400);
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed in records operation: ${error.message}`, 500);
  }
});
