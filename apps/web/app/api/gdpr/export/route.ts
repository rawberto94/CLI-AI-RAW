/**
 * GDPR Data Subject Rights API Routes
 * 
 * POST /api/gdpr/export - Request data export
 * GET  /api/gdpr/export - Get export status
 * POST /api/gdpr/delete - Request account deletion
 * DELETE /api/gdpr/delete - Cancel deletion request
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { 
  requestDataExport, 
  getExportStatus,
  requestAccountDeletion as _requestAccountDeletion,
  cancelAccountDeletion as _cancelAccountDeletion,
} from '@/lib/gdpr/data-rights';
// Data Export
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  return requestDataExport(request);
});

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  return getExportStatus(request);
});
