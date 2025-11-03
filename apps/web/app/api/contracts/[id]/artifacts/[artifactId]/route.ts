import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/contracts/[id]/artifacts/[artifactId]
 * Get a specific artifact
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string; artifactId: string }> }
) {
  const params = await props.params;
  try {
    const { dbAdaptor } = await import('data-orchestration/src/dal/database.adaptor');
    
    const artifact = await dbAdaptor.getClient().artifact.findUnique({
      where: { id: params.artifactId },
      include: {
        editHistory: {
          orderBy: { version: 'desc' },
          take: 10,
        },
      },
    });

    if (!artifact) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    if (artifact.contractId !== params.id) {
      return NextResponse.json(
        { error: 'Artifact does not belong to this contract' },
        { status: 403 }
      );
    }

    return NextResponse.json(artifact);
  } catch (error) {
    console.error('Error fetching artifact:', error);
    return NextResponse.json(
      { error: 'Failed to fetch artifact' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/contracts/[id]/artifacts/[artifactId]
 * Update an artifact
 */
export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string; artifactId: string }> }
) {
  const params = await props.params;
  try {
    const body = await request.json();
    const { updates, reason, userId } = body;

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

    // Update the artifact using the service
    const { EditableArtifactService } = await import('data-orchestration/src/services/editable-artifact.service');
    const editableArtifactService = EditableArtifactService.getInstance();
    const updatedArtifact = await editableArtifactService.updateArtifact(
      params.artifactId,
      updates,
      userId,
      reason
    );

    return NextResponse.json({
      artifact: updatedArtifact,
      message: 'Artifact updated successfully',
    });
  } catch (error) {
    console.error('Error updating artifact:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update artifact' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/contracts/[id]/artifacts/[artifactId]
 * Delete an artifact
 */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string; artifactId: string }> }
) {
  const params = await props.params;
  try {
    const { dbAdaptor } = await import('data-orchestration/src/dal/database.adaptor');
    
    await dbAdaptor.getClient().artifact.delete({
      where: { id: params.artifactId },
    });

    return NextResponse.json({
      message: 'Artifact deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting artifact:', error);
    return NextResponse.json(
      { error: 'Failed to delete artifact' },
      { status: 500 }
    );
  }
}
