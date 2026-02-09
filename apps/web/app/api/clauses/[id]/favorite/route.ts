import { NextRequest } from 'next/server';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

// POST /api/clauses/[id]/favorite - Toggle favorite status
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = getApiContext(request);
  try {
    const { isFavorite } = await request.json();
    const clauseId = params.id;

    // Mock response
    return createSuccessResponse(ctx, {
      success: true,
      clause: {
        id: clauseId,
        isFavorite,
      },
      source: 'mock'
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
