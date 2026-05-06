/**
 * Word Add-in Templates API
 * Provides template CRUD operations for the Word Add-in
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const createTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(200),
  description: z.string().max(2000).optional().default(''),
  category: z.string().max(50).optional().default('OTHER'),
  content: z.record(z.unknown()).optional(),
  variables: z.array(z.unknown()).optional(),
});

export const GET = withAuthApiHandler(async (req: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') || 'name';   // name | updatedAt | usageCount
    const order = searchParams.get('order') || 'asc';   // asc | desc
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

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

    const orderByField = ['name', 'updatedAt', 'usageCount', 'createdAt'].includes(sort) ? sort : 'name';
    const orderByDir = order === 'desc' ? 'desc' : 'asc';

    const [templates, total] = await Promise.all([
      prisma.contractTemplate.findMany({
        where,
        orderBy: { [orderByField]: orderByDir },
        skip: offset,
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          structure: true,
          metadata: true,
          isActive: true,
          version: true,
          usageCount: true,
          lastUsedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.contractTemplate.count({ where }),
    ]);

    // Transform to match Word Add-in expected format
    const transformed = templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description || '',
      category: t.category || 'OTHER',
      folder: t.category || 'OTHER',
      content: t.structure || { sections: [] },
      variables: Array.isArray(t.metadata) ? t.metadata : [],
      clauses: [],
      isActive: t.isActive,
      version: t.version || 1,
      usageCount: t.usageCount,
      lastUsedAt: t.lastUsedAt?.toISOString() || null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));

    return createSuccessResponse(ctx, { templates: transformed, total, limit, offset });
  } catch (error) {
    logger.error('Word Add-in templates error:', error);
    return createErrorResponse(ctx, 'SERVER_ERROR', 'Failed to fetch templates', 500);
  }
});

export const POST = withAuthApiHandler(async (req: NextRequest, ctx) => {
  try {
    const tenantId = ctx.tenantId;
    const userId = ctx.userId;

    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant not found', 400);
    }

    if (!userId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const body = await req.json();
    const parsed = createTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', parsed.error.errors[0].message, 400);
    }
    const { name, description, category, content, variables } = parsed.data;

    const template = await prisma.contractTemplate.create({
      data: {
        tenantId,
        name,
        description: description || '',
        category: category || 'OTHER',
        clauses: [],
        structure: JSON.parse(JSON.stringify(content || { sections: [] })),
        metadata: JSON.parse(JSON.stringify(variables || [])),
        isActive: true,
        version: 1,
        createdBy: userId,
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
    logger.error('Word Add-in create template error:', error);
    return createErrorResponse(ctx, 'SERVER_ERROR', 'Failed to create template', 500);
  }
});
