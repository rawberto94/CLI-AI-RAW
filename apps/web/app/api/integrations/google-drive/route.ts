/**
 * Google Drive Integration API
 * 
 * GET /api/integrations/google-drive - Get connection status
 * POST /api/integrations/google-drive - Connect or perform actions
 * DELETE /api/integrations/google-drive - Disconnect
 */

import { NextRequest, NextResponse } from 'next/server';
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
import { getTenantContext, getServerTenantId } from '@/lib/tenant-server';

export async function GET(request: NextRequest) {
  try {
    const tenantId = await getServerTenantId();
    
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const connection = await getGoogleDriveConnection(tenantId);

    if (!connection) {
      return NextResponse.json({
        success: true,
        connected: false,
        authUrl: getGoogleDriveAuthUrl(),
      });
    }

    return NextResponse.json({
      success: true,
      connected: true,
      accountEmail: connection.accountEmail,
      accountName: connection.accountName,
      expiresAt: connection.tokenExpiresAt,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to get status' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { tenantId, userId } = await getTenantContext();

    if (!tenantId || !userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, folderId, fileId, fileIds } = body;

    switch (action) {
      case 'connect': {
        // Generate OAuth URL
        const authUrl = getGoogleDriveAuthUrl();
        return NextResponse.json({ success: true, authUrl });
      }

      case 'list': {
        // List files in a folder
        const accessToken = await getValidAccessToken(tenantId);
        const result = await listDriveFiles(accessToken, folderId || 'root', {
          mimeTypes: [...SUPPORTED_MIME_TYPES],
          includeSubfolders: true,
        });

        return NextResponse.json({
          success: true,
          files: result.files,
          nextPageToken: result.nextPageToken,
        });
      }

      case 'import': {
        // Import a single file
        const accessToken = await getValidAccessToken(tenantId);
        const result = await importFileFromDrive(accessToken, fileId, tenantId, userId);

        return NextResponse.json({
          success: true,
          contractId: result.contractId,
          fileName: result.fileName,
        });
      }

      case 'import-batch': {
        // Import multiple files
        const accessToken = await getValidAccessToken(tenantId);
        const results = [];
        const errors = [];

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

        return NextResponse.json({
          success: true,
          imported: results,
          errors,
        });
      }

      case 'preview': {
        // Download file for preview
        const accessToken = await getValidAccessToken(tenantId);
        const file = await downloadDriveFile(accessToken, fileId);

        return NextResponse.json({
          success: true,
          name: file.name,
          mimeType: file.mimeType,
          size: file.content.length,
          // Don't return content in JSON - use a separate download endpoint
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to perform action',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const tenantId = await getServerTenantId();

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await disconnectGoogleDrive(tenantId);

    return NextResponse.json({
      success: true,
      message: 'Google Drive disconnected',
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to disconnect' },
      { status: 500 }
    );
  }
}
