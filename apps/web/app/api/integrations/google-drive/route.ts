/**
 * Google Drive Integration API
 * 
 * GET /api/integrations/google-drive - Get connection status
 * POST /api/integrations/google-drive - Connect or perform actions
 * DELETE /api/integrations/google-drive - Disconnect
 */

import { NextRequest } from 'next/server';
import {
  getGoogleDriveAuthUrl,
  getGoogleDriveConnection,
  getValidAccessToken,
  listDriveFiles,
  downloadDriveFile,
  importFileFromDrive,
  disconnectGoogleDrive,
  SUPPORTED_MIME_TYPES,
} from '@/lib/integrations/google-drive';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;

  if (!tenantId) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const connection = await getGoogleDriveConnection(tenantId);

  if (!connection) {
    return createSuccessResponse(ctx, {
      success: true,
      connected: false,
      authUrl: getGoogleDriveAuthUrl(),
    });
  }

  return createSuccessResponse(ctx, {
    success: true,
    connected: true,
    accountEmail: connection.accountEmail,
    accountName: connection.accountName,
    expiresAt: connection.tokenExpiresAt,
  });
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const userId = ctx.userId;

  if (!tenantId || !userId) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const body = await request.json();
  const { action, folderId, fileId, fileIds } = body;

  switch (action) {
    case 'connect': {
      const authUrl = getGoogleDriveAuthUrl();
      return createSuccessResponse(ctx, { success: true, authUrl });
    }

    case 'list': {
      const accessToken = await getValidAccessToken(tenantId);
      const result = await listDriveFiles(accessToken, folderId || 'root', {
        mimeTypes: [...SUPPORTED_MIME_TYPES],
        includeSubfolders: true,
      });

      return createSuccessResponse(ctx, {
        success: true,
        files: result.files,
        nextPageToken: result.nextPageToken,
      });
    }

    case 'import': {
      const accessToken = await getValidAccessToken(tenantId);
      const result = await importFileFromDrive(accessToken, fileId, tenantId, userId);

      return createSuccessResponse(ctx, {
        success: true,
        contractId: result.contractId,
        fileName: result.fileName,
      });
    }

    case 'import-batch': {
      const accessToken = await getValidAccessToken(tenantId);
      const results: Array<{ contractId: string; fileName: string }> = [];
      const errors: Array<{ fileId: any; error: string }> = [];

      for (const id of fileIds || []) {
        try {
          const result = await importFileFromDrive(accessToken, id, tenantId, userId);
          results.push(result);
        } catch (err) {
          errors.push({
            fileId: id,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }

      return createSuccessResponse(ctx, {
        success: true,
        imported: results,
        errors,
      });
    }

    case 'preview': {
      const accessToken = await getValidAccessToken(tenantId);
      const file = await downloadDriveFile(accessToken, fileId);

      return createSuccessResponse(ctx, {
        success: true,
        name: file.name,
        mimeType: file.mimeType,
        size: file.content.length,
      });
    }

    default:
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
  }
});

export const DELETE = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;

  if (!tenantId) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  await disconnectGoogleDrive(tenantId);

  return createSuccessResponse(ctx, {
    success: true,
    message: 'Google Drive disconnected',
  });
});
