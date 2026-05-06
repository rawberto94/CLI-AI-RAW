/**
 * Word Add-in Clauses API
 * Provides clause library operations for the Word Add-in
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const createClauseSchema = z.object({
  name: z.string().max(100).optional(),
  title: z.string().min(1, 'Clause title is required').max(300),
  category: z.string().max(50).optional().default('General'),
  content: z.string().min(1, 'Clause content is required').max(50000),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('LOW'),
  isStandard: z.boolean().optional().default(false),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
});

export const GET = withAuthApiHandler(async (req: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const riskLevel = searchParams.get('riskLevel');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {
      tenantId: ctx.tenantId,
    };

    if (category) {
      where.category = category;
    }

    if (riskLevel) {
      where.riskLevel = riskLevel;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { plainText: { contains: search, mode: 'insensitive' } },
      ];
    }

    const clauses = await prisma.clauseLibrary.findMany({
      where,
      orderBy: [
        { isStandard: 'desc' },
        { usageCount: 'desc' },
        { title: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        title: true,
        category: true,
        content: true,
        riskLevel: true,
        isStandard: true,
        tags: true,
        usageCount: true,
        alternativeText: true,
      },
    });

    // Transform to match expected format
    const transformed = clauses.map((c) => ({
      id: c.id,
      name: c.name,
      title: c.title,
      category: c.category || 'General',
      content: c.content,
      riskLevel: c.riskLevel || 'LOW',
      isStandard: c.isStandard || false,
      alternatives: c.alternativeText ? [c.alternativeText] : [],
      tags: Array.isArray(c.tags) ? c.tags : [],
      usageCount: c.usageCount || 0,
    }));

    return createSuccessResponse(ctx, transformed);
  } catch (error) {
    logger.error('Word Add-in clauses error:', error);
    return createErrorResponse(ctx, 'SERVER_ERROR', 'Failed to fetch clauses', 500);
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
    const parsed = createClauseSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', parsed.error.errors[0].message, 400);
    }
    const { name, title, category, content, riskLevel, isStandard, tags } = parsed.data;

    // Generate unique name from title if not provided
    const clauseName = name || title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 50);

    const clause = await prisma.clauseLibrary.create({
      data: {
        tenantId,
        name: `${clauseName}_${Date.now()}`,
        title,
        category: category || 'General',
        content,
        riskLevel: riskLevel || 'LOW',
        isStandard: isStandard || false,
        tags: tags || [],
        usageCount: 0,
        createdBy: userId,
      },
    });

    return createSuccessResponse(ctx, {
      id: clause.id,
      name: clause.name,
      title: clause.title,
      category: clause.category,
      content: clause.content,
      riskLevel: clause.riskLevel,
      isStandard: clause.isStandard,
      tags: clause.tags,
      usageCount: clause.usageCount,
    });
  } catch (error) {
    logger.error('Word Add-in create clause error:', error);
    return createErrorResponse(ctx, 'SERVER_ERROR', 'Failed to create clause', 500);
  }
});
