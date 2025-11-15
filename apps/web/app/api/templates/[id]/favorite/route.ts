import { NextRequest, NextResponse } from 'next/server';

// POST /api/templates/[id]/favorite - Toggle favorite status
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { isFavorite } = await request.json();
    const templateId = params.id;

    // Mock response since we don't have database yet
    return NextResponse.json({
      success: true,
      template: {
        id: templateId,
        isFavorite,
      },
      source: 'mock'
    });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    return NextResponse.json(
      { error: 'Failed to toggle favorite' },
      { status: 500 }
    );
  }
}
