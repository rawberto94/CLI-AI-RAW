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

// Mock comparison data for demonstration
const getMockDifferences = (): VersionDifference[] => [
      {
        field: 'totalValue',
        label: 'Contract Value',
        oldValue: '$500,000',
        newValue: '$550,000',
        changeType: 'modified',
      },
      {
        field: 'expirationDate',
        label: 'Expiration Date',
        oldValue: '2025-12-31',
        newValue: '2026-06-30',
        changeType: 'modified',
      },
      {
        field: 'paymentTerms',
        label: 'Payment Terms',
        oldValue: 'Net 30',
        newValue: 'Net 45',
        changeType: 'modified',
      },
      {
        field: 'autoRenewal',
        label: 'Auto Renewal Clause',
        oldValue: null,
        newValue: 'Automatic renewal every 12 months with 30-day notice period',
        changeType: 'added',
      },
      {
        field: 'penaltyClause',
        label: 'Late Payment Penalty',
        oldValue: '5% per month late fee',
        newValue: null,
        changeType: 'removed',
      },
      {
        field: 'liabilityLimit',
        label: 'Liability Limit',
        oldValue: '$1,000,000',
        newValue: '$750,000',
        changeType: 'modified',
      },
    ];

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
    const useMock = searchParams.get('mock') === 'true';

    if (!v1 || !v2) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Both v1 and v2 parameters are required', 400);
    }

    if (useMock) {
      const mockDifferences = getMockDifferences();
      return createSuccessResponse(ctx, {
        success: true,
        differences: mockDifferences,
        source: 'mock',
        summary: {
          totalChanges: mockDifferences.length,
          added: mockDifferences.filter(d => d.changeType === 'added').length,
          modified: mockDifferences.filter(d => d.changeType === 'modified').length,
          removed: mockDifferences.filter(d => d.changeType === 'removed').length,
        }
      });
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
