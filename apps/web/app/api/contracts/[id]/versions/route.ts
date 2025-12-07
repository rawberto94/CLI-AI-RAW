import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';

export const dynamic = 'force-dynamic';

// Mock version data for demonstration
const getMockVersions = () => [
      {
        id: '1',
        versionNumber: 1,
        uploadedBy: 'Sarah Chen',
        uploadedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: false,
        summary: 'Initial contract version',
      },
      {
        id: '2',
        versionNumber: 2,
        uploadedBy: 'Roberto Ostojic',
        uploadedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: false,
        summary: 'Updated payment terms and expiration date',
        changes: {
          totalValue: { old: '$500,000', new: '$525,000' },
          expirationDate: { old: '2025-12-31', new: '2026-03-31' },
        }
      },
      {
        id: '3',
        versionNumber: 3,
        uploadedBy: 'Mike Johnson',
        uploadedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true,
        summary: 'Final negotiated terms',
        changes: {
          totalValue: { old: '$525,000', new: '$550,000' },
          paymentTerms: { old: 'Net 30', new: 'Net 45' },
          autoRenewal: { old: null, new: 'Yes' },
        }
      },
    ];

/**
 * GET /api/contracts/:id/versions
 * Get all versions of a contract
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contractId = params.id;
    const tenantId = await getApiTenantId(request);
    const useMock = request.nextUrl.searchParams.get('mock') === 'true';

    if (useMock) {
      return NextResponse.json({
        success: true,
        versions: getMockVersions(),
        source: 'mock'
      });
    }

    try {
      const db = await getDb();

      // Get contract versions from database
      const versions = await db.contractVersion.findMany({
        where: { contractId, tenantId },
        orderBy: { versionNumber: 'asc' },
        include: {
          uploadedByUser: {
            select: { firstName: true, lastName: true, email: true }
          }
        }
      });

      const transformedVersions = versions.map(v => {
        const userName = v.uploadedByUser 
          ? `${v.uploadedByUser.firstName || ''} ${v.uploadedByUser.lastName || ''}`.trim() 
          : null;
        return {
          id: v.id,
          versionNumber: v.versionNumber,
          uploadedBy: userName || v.uploadedBy || 'Unknown',
          uploadedAt: v.uploadedAt.toISOString(),
          isActive: v.isActive,
          summary: v.summary || undefined,
          changes: v.changes || undefined,
          fileUrl: v.fileUrl || undefined
        };
      });

      return NextResponse.json({
        success: true,
        versions: transformedVersions,
        source: 'database'
      });

    } catch (dbError) {
      console.warn('Database query failed, using mock data:', dbError);
      return NextResponse.json({
        success: true,
        versions: getMockVersions(),
        source: 'mock-fallback'
      });
    }

  } catch (error) {
    console.error('Error fetching versions:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch versions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
