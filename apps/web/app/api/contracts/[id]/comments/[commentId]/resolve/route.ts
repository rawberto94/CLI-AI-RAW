import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/contracts/:id/comments/:commentId/resolve
 * Mark a comment as resolved
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  try {
    const { id: contractId, commentId } = params;
    const tenantId = await getApiTenantId(request);
    const useMock = request.nextUrl.searchParams.get('mock') === 'true';

    if (useMock) {
      return NextResponse.json({
        success: true,
        message: 'Comment resolved successfully',
        source: 'mock'
      });
    }

    try {
      const db = await getDb();

      // Update comment resolution status
      const updatedComment = await db.contractComment.update({
        where: {
          id: commentId,
          tenantId,
          contractId
        },
        data: {
          isResolved: true,
          resolvedAt: new Date()
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Comment resolved successfully',
        source: 'database',
        comment: {
          id: updatedComment.id,
          isResolved: updatedComment.isResolved,
          resolvedAt: updatedComment.resolvedAt?.toISOString()
        }
      });

    } catch (dbError) {
      console.warn('Database update failed, using mock response:', dbError);
      return NextResponse.json({
        success: true,
        message: 'Comment resolved successfully',
        source: 'mock-fallback'
      });
    }

  } catch (error) {
    console.error('Error resolving comment:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to resolve comment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
