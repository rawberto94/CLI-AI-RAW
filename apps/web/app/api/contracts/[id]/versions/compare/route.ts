import { NextRequest } from 'next/server';
import getDb from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

/**
 * Version difference entry
 */
interface VersionDifference {
  field: string;
  label?: string;
  oldValue: unknown;
  newValue: unknown;
  changeType: 'added' | 'modified' | 'removed';
}

/**
 * GET /api/contracts/:id/versions/compare
 * Compare two versions of a contract
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = getApiContext(request);
  try {
    const searchParams = request.nextUrl.searchParams;
    const v1 = searchParams.get('v1');
    const v2 = searchParams.get('v2');

    if (!v1 || !v2) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Both v1 and v2 parameters are required', 400);
    }

    try {
      const db = await getDb();
      const contractId = params.id;
      const tenantId = await getApiTenantId(request);

      // Get both versions
      const [version1, version2] = await Promise.all([
        db.contractVersion.findFirst({
          where: { contractId, tenantId, versionNumber: parseInt(v1) }
        }),
        db.contractVersion.findFirst({
          where: { contractId, tenantId, versionNumber: parseInt(v2) }
        })
      ]);

      if (!version1 || !version2) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'One or both versions not found', 404);
      }

      // Extract differences from version changes field
      const differences = (version2.changes || []) as VersionDifference[];

      return createSuccessResponse(ctx, {
        success: true,
        differences,
        source: 'database',
        summary: {
          totalChanges: Array.isArray(differences) ? differences.length : 0,
          added: Array.isArray(differences) ? differences.filter((d: VersionDifference) => d.changeType === 'added').length : 0,
          modified: Array.isArray(differences) ? differences.filter((d: VersionDifference) => d.changeType === 'modified').length : 0,
          removed: Array.isArray(differences) ? differences.filter((d: VersionDifference) => d.changeType === 'removed').length : 0,
        }
      });

    } catch (error) {
      return handleApiError(ctx, error);
    }

  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}
