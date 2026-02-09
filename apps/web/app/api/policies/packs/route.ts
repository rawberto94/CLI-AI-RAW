import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  // Return empty policy packs for now
  return createSuccessResponse(ctx, {
    success: true,
    data: [],
    message: 'No policy packs configured'
  });
});
