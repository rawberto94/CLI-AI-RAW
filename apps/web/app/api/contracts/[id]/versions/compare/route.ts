import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Mock comparison data for demonstration
const getMockDifferences = () => [
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
  try {
    const searchParams = request.nextUrl.searchParams;
    const v1 = searchParams.get('v1');
    const v2 = searchParams.get('v2');
    const useMock = searchParams.get('mock') === 'true';

    if (!v1 || !v2) {
      return NextResponse.json(
        { success: false, error: 'Both v1 and v2 parameters are required' },
        { status: 400 }
      );
    }

    if (useMock) {
      const mockDifferences = getMockDifferences();
      return NextResponse.json({
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
      const tenantId = request.headers.get('x-tenant-id') || 'demo';

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
        return NextResponse.json(
          { success: false, error: 'One or both versions not found' },
          { status: 404 }
        );
      }

      // Extract differences from version changes field
      const differences = version2.changes || [];

      return NextResponse.json({
        success: true,
        differences,
        source: 'database',
        summary: {
          totalChanges: Array.isArray(differences) ? differences.length : 0,
          added: Array.isArray(differences) ? differences.filter((d: any) => d.changeType === 'added').length : 0,
          modified: Array.isArray(differences) ? differences.filter((d: any) => d.changeType === 'modified').length : 0,
          removed: Array.isArray(differences) ? differences.filter((d: any) => d.changeType === 'removed').length : 0,
        }
      });

    } catch (dbError) {
      console.warn('Database query failed, using mock data:', dbError);
      const mockDifferences = getMockDifferences();
      return NextResponse.json({
        success: true,
        differences: mockDifferences,
        source: 'mock-fallback',
        summary: {
          totalChanges: mockDifferences.length,
          added: mockDifferences.filter(d => d.changeType === 'added').length,
          modified: mockDifferences.filter(d => d.changeType === 'modified').length,
          removed: mockDifferences.filter(d => d.changeType === 'removed').length,
        }
      });
    }

  } catch (error) {
    console.error('Error comparing versions:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to compare versions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
