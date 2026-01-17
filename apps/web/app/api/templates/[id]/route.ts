import { NextRequest, NextResponse } from 'next/server';

// DELETE /api/templates/[id] - Delete a template
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const templateId = params.id;

    // Mock response
    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully',
      source: 'mock'
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}
