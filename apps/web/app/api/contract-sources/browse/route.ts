/**
 * Contract Source Browse Files API
 * 
 * GET /api/contract-sources/browse - List files in a source folder
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createConnector, ConnectorCredentials } from '@/lib/integrations/connectors';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { contractService } from 'data-orchestration/services';
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = await ctx.tenantId;
  const { searchParams } = new URL(request.url);
  const sourceId = searchParams.get('sourceId');
  const folderId = searchParams.get('folderId') || 'root';
  const pageToken = searchParams.get('pageToken') || undefined;

  if (!sourceId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Source ID is required', 400);
  }

  // Get source
  const source = await prisma.contractSource.findFirst({
    where: { id: sourceId, tenantId },
  });

  if (!source) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Source not found', 404);
  }

  if (!source.credentials) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Source credentials not configured', 400);
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

  return createSuccessResponse(ctx, {
    success: true,
    data: {
      files: result.files,
      folders: result.folders,
      nextPageToken: result.nextPageToken,
      hasMore: result.hasMore,
      totalCount: result.totalCount,
    },
  });
});
