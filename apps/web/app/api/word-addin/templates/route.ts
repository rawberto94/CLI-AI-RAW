/**
 * Word Add-in Templates API
 * Provides template CRUD operations for the Word Add-in
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

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {
      tenantId: ctx.tenantId,
      isActive: true,
    };

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const templates = await prisma.contractTemplate.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        structure: true,
        metadata: true,
        isActive: true,
        version: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Transform to match Word Add-in expected format
    const transformed = templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description || '',
      category: t.category || 'OTHER',
      content: t.structure || { sections: [] },
      variables: Array.isArray(t.metadata) ? t.metadata : [],
      clauses: [],
      isActive: t.isActive,
      version: t.version || 1,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));

    return createSuccessResponse(ctx, transformed);
  } catch (error) {
    console.error('Word Add-in templates error:', error);
    return createErrorResponse(apiCtx, 'SERVER_ERROR', 'Failed to fetch templates', 500);
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
    const { name, description, category, content, variables } = body;

    if (!name) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Template name is required', 400);
    }

    const template = await prisma.contractTemplate.create({
      data: {
        tenantId: ctx.tenantId,
        name,
        description: description || '',
        category: category || 'OTHER',
        clauses: [],
        structure: content || { sections: [] },
        metadata: variables || [],
        isActive: true,
        version: 1,
        createdBy: ctx.userId || 'word-addin',
      },
    });

    return createSuccessResponse(ctx, {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      content: template.structure,
      variables: template.metadata,
      isActive: template.isActive,
      version: template.version,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Word Add-in create template error:', error);
    return createErrorResponse(apiCtx, 'SERVER_ERROR', 'Failed to create template', 500);
  }
}
