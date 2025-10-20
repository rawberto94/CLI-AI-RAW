import { NextRequest, NextResponse } from 'next/server';
import { editableArtifactService } from 'data-orchestration/src/services/editable-artifact.service';

/**
 * PATCH /api/contracts/[id]/artifacts/[artifactId]/fields
 * Update a single field in an artifact
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; artifactId: string } }
) {
  try {
    const body = await request.json();
    const { fieldPath, value, userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    if (!fieldPath) {
      return NextResponse.json(
        { error: 'fieldPath is required' },
        { status: 400 }
      );
    }

    // Update the field
    await editableArtifactService.updateArtifactField(
      params.artifactId,
      fieldPath,
      value,
      userId
    );

    return NextResponse.json({
      message: 'Field updated successfully',
      fieldPath,
      value,
    });
  } catch (error) {
    console.error('Error updating field:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update field' },
      { status: 500 }
    );
  }
}
