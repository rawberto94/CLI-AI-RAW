import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Mock data fallback
const getMockActivities = () => [
      {
        id: '1',
        type: 'upload',
        user: 'Sarah Chen',
        action: 'uploaded the contract',
        details: 'Initial version uploaded from DocuSign',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: { fileSize: '2.4 MB', pages: 15 }
      },
      {
        id: '2',
        type: 'workflow',
        user: 'System',
        action: 'started approval workflow',
        details: 'Legal Review Workflow initiated',
        timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: { workflowName: 'Legal Review' }
      },
      {
        id: '3',
        type: 'comment',
        user: 'John Doe',
        action: 'added a comment',
        details: 'Requested changes to liability clause',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '4',
        type: 'approval',
        user: 'Jane Smith',
        action: 'approved the contract',
        details: 'Legal review completed successfully',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: { step: 'Legal Review' }
      },
      {
        id: '5',
        type: 'metadata',
        user: 'Mike Johnson',
        action: 'updated metadata',
        details: 'Updated contract value and expiration date',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: { fields: ['totalValue', 'expirationDate'] }
      },
      {
        id: '6',
        type: 'share',
        user: 'Sarah Chen',
        action: 'shared with external party',
        details: 'Shared with vendor for signature',
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        metadata: { sharedWith: 'vendor@acme.com' }
      },
      {
        id: '7',
        type: 'download',
        user: 'Alex Brown',
        action: 'downloaded the contract',
        details: 'PDF export downloaded',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        metadata: { format: 'PDF' }
      }
    ];

/**
 * GET /api/contracts/:id/activity
 * Get activity feed for a contract
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contractId = params.id;
    const tenantId = request.headers.get('x-tenant-id') || 'demo';
    const useMock = request.nextUrl.searchParams.get('mock') === 'true';

    // Return mock data if requested
    if (useMock) {
      return NextResponse.json({
        success: true,
        activities: getMockActivities(),
        source: 'mock'
      });
    }

    try {
      const db = await getDb();
      
      // Fetch activities from database
      const activities = await db.contractActivity.findMany({
        where: {
          contractId,
          tenantId
        },
        orderBy: { timestamp: 'desc' },
        take: 50 // Limit to recent 50 activities
      });

      // Transform to frontend format
      const formattedActivities = activities.map(activity => ({
        id: activity.id,
        type: activity.type,
        user: activity.userId, // TODO: Join with User table
        action: activity.action,
        details: activity.details,
        timestamp: activity.timestamp.toISOString(),
        metadata: activity.metadata
      }));

      return NextResponse.json({
        success: true,
        activities: formattedActivities,
        source: 'database'
      });

    } catch (dbError) {
      console.warn('Database query failed, using mock data:', dbError);
      return NextResponse.json({
        success: true,
        activities: getMockActivities(),
        source: 'mock-fallback'
      });
    }

  } catch (error) {
    console.error('Error fetching activity:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch activity',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
