import { NextRequest, NextResponse } from 'next/server';
import { editableArtifactService } from 'data-orchestration/src/services/editable-artifact.service';

/**
 * POST /api/contracts/[id]/artifacts/bulk-update
 * Bulk update multiple artifacts
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { updates, userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: 'updates array is required' },
        { status: 400 }
      );
    }

    const result = await editableArtifactService.bulkUpdateArtifacts(
      updates,
      userId
    );

    return NextResponse.json({
      message: 'Bulk update completed',
      successful: result.successful,
      failed: result.failed,
      totalProcessed: result.totalProcessed,
    });
  } catch (error) {
    console.error('Error in bulk update:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to bulk update artifacts' },
      { status: 500 }
    );
  }
}
