import { NextRequest, NextResponse } from 'next/server';
import { metadataEditorService } from 'data-orchestration/services';

/**
 * DELETE /api/contracts/[id]/metadata/tags/[tagName]
 * Remove a tag from a contract
 */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string; tagName: string }> }
) {
  const params = await props.params;
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const userId = searchParams.get('userId');

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

    await metadataEditorService.removeTag(
      params.id,
      tenantId,
      decodeURIComponent(params.tagName),
      userId
    );

    return NextResponse.json({
      message: 'Tag removed successfully',
    });
  } catch (error) {
    console.error('Error removing tag:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove tag' },
      { status: 500 }
    );
  }
}
