import { NextRequest, NextResponse } from 'next/server';
import { metadataEditorService } from 'data-orchestration/src/services/metadata-editor.service';

/**
 * POST /api/contracts/[id]/metadata/tags
 * Add tags to a contract
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { tags, tenantId, userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    if (!tags || !Array.isArray(tags)) {
      return NextResponse.json(
        { error: 'tags array is required' },
        { status: 400 }
      );
    }

    await metadataEditorService.addTags(
      params.id,
      tenantId,
      tags,
      userId
    );

    return NextResponse.json({
      message: 'Tags added successfully',
      tags,
    });
  } catch (error) {
    console.error('Error adding tags:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add tags' },
      { status: 500 }
    );
  }
}
