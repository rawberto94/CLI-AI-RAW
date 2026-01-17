import { NextRequest, NextResponse } from 'next/server';
import { editableArtifactService } from 'data-orchestration/services';

/**
 * POST /api/contracts/[id]/artifacts/[artifactId]/revert/[version]
 * Revert artifact to a specific version
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string; artifactId: string; version: string }> }
) {
  const params = await props.params;
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const versionNumber = parseInt(params.version);
    if (isNaN(versionNumber)) {
      return NextResponse.json(
        { error: 'Invalid version number' },
        { status: 400 }
      );
    }

    await editableArtifactService.revertToVersion(
      params.artifactId,
      versionNumber,
      userId
    );

    return NextResponse.json({
      message: `Artifact reverted to version ${versionNumber}`,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to revert version' },
      { status: 500 }
    );
  }
}
