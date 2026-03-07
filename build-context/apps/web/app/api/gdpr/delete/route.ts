/**
 * GDPR Account Deletion API Routes
 * 
 * POST   /api/gdpr/delete - Request account deletion (30 day grace period)
 * DELETE /api/gdpr/delete - Cancel deletion request
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { 
  requestAccountDeletion,
  cancelAccountDeletion,
} from '@/lib/gdpr/data-rights';
// Request account deletion
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  return requestAccountDeletion(request);
});

// Cancel deletion request
export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  return cancelAccountDeletion(request);
});
