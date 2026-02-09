import { NextRequest } from 'next/server';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

// POST /api/signatures/[id]/cancel - Cancel a signature workflow
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = getApiContext(request);
  try {
    const _workflowId = params.id;

    // Mock response
    return createSuccessResponse(ctx, {
      success: true,
      message: 'Signature request cancelled successfully',
      source: 'mock'
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
