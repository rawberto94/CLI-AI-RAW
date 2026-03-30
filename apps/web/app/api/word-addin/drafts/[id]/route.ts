/**
 * Word Add-in Draft by ID API
 * GET / PUT / DELETE for individual drafts
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  getAuthenticatedApiContext,
  getApiContext,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const updateDraftSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  content: z.string().max(500000).optional(),
  variables: z.record(z.string()).optional(),
  status: z.enum(['DRAFT', 'IN_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'FINALIZED']).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

/** Fetch a single draft with its template and content */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const apiCtx = getApiContext(req);
  try {
    const ctx = getAuthenticatedApiContext(req);
    if (!ctx) return createErrorResponse(apiCtx, 'UNAUTHORIZED', 'Authentication required', 401);

    const { id } = await params;

    const draft = await prisma.contractDraft.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            structure: true,
            metadata: true,
            version: true,
          },
        },
      },
    });

    if (!draft) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Draft not found', 404);
    }

    return createSuccessResponse(ctx, {
      id: draft.id,
      title: draft.title,
      content: draft.content || '',
      variables: draft.variables || {},
      status: draft.status,
      version: draft.version,
      type: draft.type,
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString(),
      template: draft.template
        ? {
            id: draft.template.id,
            name: draft.template.name,
            description: draft.template.description || '',
            category: draft.template.category || 'OTHER',
            content: draft.template.structure || { sections: [] },
            variables: Array.isArray(draft.template.metadata) ? draft.template.metadata : [],
            version: draft.template.version,
          }
        : null,
    });
  } catch (error) {
    logger.error('Word Add-in get draft error:', error);
    return createErrorResponse(apiCtx, 'SERVER_ERROR', 'Failed to fetch draft', 500);
  }
}

/** Update a draft */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const apiCtx = getApiContext(req);
  try {
    const ctx = getAuthenticatedApiContext(req);
    if (!ctx) return createErrorResponse(apiCtx, 'UNAUTHORIZED', 'Authentication required', 401);

    const { id } = await params;
    const body = await req.json();
    const parsed = updateDraftSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', parsed.error.errors[0].message, 400);
    }
    const { title, content, variables, status } = parsed.data;

    const existing = await prisma.contractDraft.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });

    if (!existing) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Draft not found', 404);
    }

    if (existing.isLocked && existing.lockedBy !== ctx.userId) {
      return createErrorResponse(ctx, 'LOCKED', 'Draft is locked by another user', 423);
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (variables !== undefined) updateData.variables = variables;
    if (status !== undefined) updateData.status = status;

    const draft = await prisma.contractDraft.update({
      where: { id },
      data: updateData,
    });

    return createSuccessResponse(ctx, {
      id: draft.id,
      title: draft.title,
      status: draft.status,
      updatedAt: draft.updatedAt.toISOString(),
    });
  } catch (error) {
    logger.error('Word Add-in update draft error:', error);
    return createErrorResponse(apiCtx, 'SERVER_ERROR', 'Failed to update draft', 500);
  }
}

/** Delete a draft (soft-delete by setting status) */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const apiCtx = getApiContext(req);
  try {
    const ctx = getAuthenticatedApiContext(req);
    if (!ctx) return createErrorResponse(apiCtx, 'UNAUTHORIZED', 'Authentication required', 401);

    const { id } = await params;

    const existing = await prisma.contractDraft.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });

    if (!existing) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Draft not found', 404);
    }

    await prisma.contractDraft.update({
      where: { id },
      data: { status: 'deleted' },
    });

    return createSuccessResponse(ctx, { deleted: true });
  } catch (error) {
    logger.error('Word Add-in delete draft error:', error);
    return createErrorResponse(apiCtx, 'SERVER_ERROR', 'Failed to delete draft', 500);
  }
}
