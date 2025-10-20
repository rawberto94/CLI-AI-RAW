import { NextRequest, NextResponse } from 'next/server';
import { editableArtifactService } from 'data-orchestration/src/services/editable-artifact.service';

/**
 * GET /api/contracts/[id]/artifacts/[artifactId]/versions/[version]
 * Get a specific version
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; artifactId: string; version: string } }
) {
  try {
    const versionNumber = parseInt(params.version);
    if (isNaN(versionNumber)) {
      return NextResponse.json(
        { error: 'Invalid version number' },
        { status: 400 }
      );
    }

    const versions = await editableArtifactService.getArtifactVersionHistory(
      params.artifactId
    );

    const version = versions.find(v => v.version === versionNumber);

    if (!version) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(version);
  } catch (error) {
    console.error('Error fetching version:', error);
    return NextResponse.json(
      { error: 'Failed to fetch version' },
      { status: 500 }
    );
  }
}
