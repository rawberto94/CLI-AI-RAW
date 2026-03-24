/**
 * Draft Version History API
 * 
 * GET /api/drafts/[id]/versions — List all version snapshots
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';
import {
  getAuthenticatedApiContext,
  getApiContext,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// GET — list all versions (newest first)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }

  try {
    const tenantId = await getApiTenantId(request);
    const { id: draftId } = await params;
    const { searchParams } = new URL(request.url);
    const versionParam = searchParams.get('version'); // fetch specific version content

    // Verify draft exists
    const draft = await prisma.contractDraft.findFirst({
      where: { id: draftId, tenantId },
      select: { id: true, version: true },
    });
    if (!draft) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Draft not found', 404);
    }

    // If a specific version is requested, return its full content
    if (versionParam) {
      const ver = await prisma.draftVersion.findFirst({
        where: { draftId, version: parseInt(versionParam) },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });
      if (!ver) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'Version not found', 404);
      }
      return createSuccessResponse(ctx, { version: ver });
    }

    // Otherwise return all versions (without full content to keep response small)
    const versions = await prisma.draftVersion.findMany({
      where: { draftId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        label: true,
        changeSummary: true,
        createdAt: true,
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    return createSuccessResponse(ctx, {
      versions,
      currentVersion: draft.version,
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
