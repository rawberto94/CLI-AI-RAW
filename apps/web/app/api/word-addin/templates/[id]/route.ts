/**
 * Word Add-in Template by ID API
 * GET / PUT / DELETE for individual templates
 */

import { NextRequest } from 'next/server';
import {
  getAuthenticatedApiContext,
  getApiContext,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

type RouteParams = { params: Promise<{ id: string }> };

/** Fetch a single template */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const apiCtx = getApiContext(req);
  try {
    const ctx = getAuthenticatedApiContext(req);
    if (!ctx) return createErrorResponse(apiCtx, 'UNAUTHORIZED', 'Authentication required', 401);

    const { id } = await params;

    const template = await prisma.contractTemplate.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });

    if (!template) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Template not found', 404);
    }

    return createSuccessResponse(ctx, {
      id: template.id,
      name: template.name,
      description: template.description || '',
      category: template.category || 'OTHER',
      folder: template.category || null,
      content: template.structure || { sections: [] },
      variables: Array.isArray(template.metadata) ? template.metadata : [],
      clauses: [],
      isActive: template.isActive,
      version: template.version || 1,
      usageCount: template.usageCount,
      lastUsedAt: template.lastUsedAt?.toISOString() || null,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Word Add-in get template error:', error);
    return createErrorResponse(apiCtx, 'SERVER_ERROR', 'Failed to fetch template', 500);
  }
}

/** Update a template */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const apiCtx = getApiContext(req);
  try {
    const ctx = getAuthenticatedApiContext(req);
    if (!ctx) return createErrorResponse(apiCtx, 'UNAUTHORIZED', 'Authentication required', 401);

    const { id } = await params;
    const body = await req.json();
    const { name, description, category, content, variables, isActive } = body;

    // Verify ownership
    const existing = await prisma.contractTemplate.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });

    if (!existing) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Template not found', 404);
    }

    // Build update data — only include provided fields
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (content !== undefined) updateData.structure = content;
    if (variables !== undefined) updateData.metadata = variables;
    if (isActive !== undefined) updateData.isActive = isActive;

    const template = await prisma.contractTemplate.update({
      where: { id },
      data: updateData,
    });

    return createSuccessResponse(ctx, {
      id: template.id,
      name: template.name,
      description: template.description || '',
      category: template.category || 'OTHER',
      content: template.structure || { sections: [] },
      variables: Array.isArray(template.metadata) ? template.metadata : [],
      isActive: template.isActive,
      version: template.version,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Word Add-in update template error:', error);
    return createErrorResponse(apiCtx, 'SERVER_ERROR', 'Failed to update template', 500);
  }
}

/** Soft-delete a template (set isActive = false) */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const apiCtx = getApiContext(req);
  try {
    const ctx = getAuthenticatedApiContext(req);
    if (!ctx) return createErrorResponse(apiCtx, 'UNAUTHORIZED', 'Authentication required', 401);

    const { id } = await params;

    const existing = await prisma.contractTemplate.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });

    if (!existing) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Template not found', 404);
    }

    await prisma.contractTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    return createSuccessResponse(ctx, { deleted: true });
  } catch (error) {
    console.error('Word Add-in delete template error:', error);
    return createErrorResponse(apiCtx, 'SERVER_ERROR', 'Failed to delete template', 500);
  }
}
