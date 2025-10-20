import { NextRequest, NextResponse } from 'next/server';
import { editableArtifactService } from 'data-orchestration/src/services/editable-artifact.service';

/**
 * POST /api/contracts/[id]/artifacts/[artifactId]/rates
 * Add a new rate card entry
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; artifactId: string } }
) {
  try {
    const body = await request.json();
    const { rate, userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    if (!rate) {
      return NextResponse.json(
        { error: 'rate data is required' },
        { status: 400 }
      );
    }

    const rateId = await editableArtifactService.addRateCardEntry(
      params.artifactId,
      rate,
      userId
    );

    return NextResponse.json({
      message: 'Rate card entry added successfully',
      rateId,
    });
  } catch (error) {
    console.error('Error adding rate card entry:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add rate card entry' },
      { status: 500 }
    );
  }
}
