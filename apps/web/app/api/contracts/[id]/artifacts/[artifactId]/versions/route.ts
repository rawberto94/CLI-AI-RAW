import { NextRequest, NextResponse } from 'next/server';
import { editableArtifactService } from 'data-orchestration/services';

/**
 * GET /api/contracts/[id]/artifacts/[artifactId]/versions
 * Get version history for an artifact
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string; artifactId: string }> }
) {
  const params = await props.params;
  try {
    const versions = await editableArtifactService.getArtifactVersionHistory(
      params.artifactId
    );

    return NextResponse.json({
      versions,
      total: versions.length,
    });
  } catch (error) {
    console.error('Error fetching version history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch version history' },
      { status: 500 }
    );
  }
}
