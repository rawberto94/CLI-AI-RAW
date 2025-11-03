import { NextRequest, NextResponse } from 'next/server';
import { editableArtifactService } from 'data-orchestration/services';

/**
 * PUT /api/contracts/[id]/artifacts/[artifactId]/rates/[rateId]
 * Update a rate card entry
 */
export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string; artifactId: string; rateId: string }> }
) {
  const params = await props.params;
  try {
    const body = await request.json();
    const { updates, userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    if (!updates) {
      return NextResponse.json(
        { error: 'updates are required' },
        { status: 400 }
      );
    }

    await editableArtifactService.updateRateCardEntry(
      params.artifactId,
      params.rateId,
      updates,
      userId
    );

    return NextResponse.json({
      message: 'Rate card entry updated successfully',
    });
  } catch (error) {
    console.error('Error updating rate card entry:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update rate card entry' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/contracts/[id]/artifacts/[artifactId]/rates/[rateId]
 * Delete a rate card entry
 */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string; artifactId: string; rateId: string }> }
) {
  const params = await props.params;
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    await editableArtifactService.deleteRateCardEntry(
      params.artifactId,
      params.rateId,
      userId
    );

    return NextResponse.json({
      message: 'Rate card entry deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting rate card entry:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete rate card entry' },
      { status: 500 }
    );
  }
}
