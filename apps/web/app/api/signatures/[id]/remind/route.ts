import { NextRequest } from 'next/server';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

// POST /api/signatures/[id]/remind - Send reminder to signer
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = getApiContext(request);
  try {
    const _workflowId = params.id;
    const { signerId: _signerId, message: _message } = await request.json();

    // Mock response
    return createSuccessResponse(ctx, {
      success: true,
      message: 'Reminder sent successfully',
      source: 'mock'
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
