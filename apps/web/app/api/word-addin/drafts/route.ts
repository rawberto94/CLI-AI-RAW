/**
 * Word Add-in Drafts API
 * Manages contract drafts for the Word Add-in
 */

import { NextRequest } from 'next/server';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const apiCtx = getApiContext(req);
  try {
    const ctx = getAuthenticatedApiContext(req);
    if (!ctx) {
      return createErrorResponse(apiCtx, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const drafts = await prisma.contractDraft.findMany({
      where: {
        tenantId: ctx.tenantId,
        status: { not: 'deleted' },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        template: {
          select: { name: true },
        },
      },
    });

    const transformed = drafts.map((d) => ({
      id: d.id,
      title: d.title,
      templateName: d.template?.name || 'Custom',
      updatedAt: d.updatedAt.toISOString(),
      status: d.status,
    }));

    return createSuccessResponse(ctx, transformed);
  } catch (error) {
    console.error('Word Add-in drafts error:', error);
    return createErrorResponse(apiCtx, 'SERVER_ERROR', 'Failed to fetch drafts', 500);
  }
}

export async function POST(req: NextRequest) {
  const apiCtx = getApiContext(req);
  try {
    const ctx = getAuthenticatedApiContext(req);
    if (!ctx) {
      return createErrorResponse(apiCtx, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const body = await req.json();
    const { templateId, title, content, variables } = body;

    if (!title) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Draft title is required', 400);
    }

    const draft = await prisma.contractDraft.create({
      data: {
        tenantId: ctx.tenantId,
        templateId: templateId || null,
        title,
        content: content || '',
        variables: variables || {},
        status: 'draft',
        createdBy: ctx.userId || 'word-addin',
      },
    });

    return createSuccessResponse(ctx, { draftId: draft.id });
  } catch (error) {
    console.error('Word Add-in create draft error:', error);
    return createErrorResponse(apiCtx, 'SERVER_ERROR', 'Failed to create draft', 500);
  }
}
