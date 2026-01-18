/**
 * Contract Source Browse Files API
 * 
 * GET /api/contract-sources/browse - List files in a source folder
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';
import { createConnector, ConnectorCredentials } from '@/lib/integrations/connectors';

export async function GET(request: NextRequest) {
  try {
    const tenantId = await getApiTenantId(request);
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('sourceId');
    const folderId = searchParams.get('folderId') || 'root';
    const pageToken = searchParams.get('pageToken') || undefined;

    if (!sourceId) {
      return NextResponse.json(
        { success: false, error: 'Source ID is required' },
        { status: 400 }
      );
    }

    // Get source
    const source = await prisma.contractSource.findFirst({
      where: { id: sourceId, tenantId },
    });

    if (!source) {
      return NextResponse.json(
        { success: false, error: 'Source not found' },
        { status: 404 }
      );
    }

    if (!source.credentials) {
      return NextResponse.json(
        { success: false, error: 'Source credentials not configured' },
        { status: 400 }
      );
    }

    // Create connector
    const connector = createConnector(
      source.provider,
      source.credentials as unknown as ConnectorCredentials
    );

    // Set OAuth tokens if available
    if ('setTokens' in connector && source.accessToken) {
      (connector as { setTokens: (a: string, r?: string, e?: Date) => void }).setTokens(
        source.accessToken,
        source.refreshToken || undefined,
        source.tokenExpiresAt || undefined
      );
    }

    // List files
    const result = await connector.listFiles(folderId, {
      pageToken,
      pageSize: 50,
      filePatterns: source.filePatterns,
    });

    await connector.disconnect();

    return NextResponse.json({
      success: true,
      data: {
        files: result.files,
        folders: result.folders,
        nextPageToken: result.nextPageToken,
        hasMore: result.hasMore,
        totalCount: result.totalCount,
      },
    });
  } catch (error) {
    console.error('Error browsing files:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to browse files' 
      },
      { status: 500 }
    );
  }
}
