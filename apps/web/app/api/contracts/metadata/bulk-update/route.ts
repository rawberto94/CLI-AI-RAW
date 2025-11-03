import { NextRequest, NextResponse } from 'next/server';
import { metadataEditorService } from 'data-orchestration/services';

/**
 * POST /api/contracts/metadata/bulk-update
 * Bulk update metadata for multiple contracts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contractIds, updates, userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    if (!contractIds || !Array.isArray(contractIds)) {
      return NextResponse.json(
        { error: 'contractIds array is required' },
        { status: 400 }
      );
    }

    if (!updates) {
      return NextResponse.json(
        { error: 'updates object is required' },
        { status: 400 }
      );
    }

    const result = await metadataEditorService.bulkUpdateMetadata({
      contractIds,
      updates,
      userId,
    });

    return NextResponse.json({
      message: 'Bulk metadata update completed',
      successful: result.successful,
      failed: result.failed,
      totalProcessed: contractIds.length,
    });
  } catch (error) {
    console.error('Error in bulk metadata update:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to bulk update metadata' },
      { status: 500 }
    );
  }
}
