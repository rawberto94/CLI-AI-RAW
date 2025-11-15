import { NextRequest, NextResponse } from 'next/server';

// POST /api/clauses/[id]/favorite - Toggle favorite status
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { isFavorite } = await request.json();
    const clauseId = params.id;

    // Mock response
    return NextResponse.json({
      success: true,
      clause: {
        id: clauseId,
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
