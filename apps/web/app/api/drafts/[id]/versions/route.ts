/**
 * Draft Version History API
 * 
 * GET /api/drafts/[id]/versions — List all version snapshots
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  withAuthApiHandler,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// GET — list all versions (newest first)
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const tenantId = ctx.tenantId;
    const { id: draftId } = await (ctx as any).params as { id: string };
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
})
