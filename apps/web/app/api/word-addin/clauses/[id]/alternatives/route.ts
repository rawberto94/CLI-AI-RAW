/**
 * Word Add-in Clause Alternatives API
 *
 * GET /api/word-addin/clauses/[id]/alternatives — Fetch alternative language for a clause
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const paramsSchema = z.object({
  id: z.string().min(1, 'Clause ID is required'),
});

export const GET = withAuthApiHandler(async (req: NextRequest, ctx) => {
  try {
    const rawParams = await (ctx as any).params as { id: string };
    const parsed = paramsSchema.safeParse(rawParams);
    if (!parsed.success) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', parsed.error.errors[0].message, 400);
    }

    const { id } = parsed.data;

    // Use clauseLibrary (correct model) with tenant isolation
    const clause = await prisma.clauseLibrary.findFirst({
      where: {
        id,
        tenantId: ctx.tenantId,
      },
    });

    if (!clause) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Clause not found', 404);
    }

    // Build alternatives from alternativeText and any stored alternatives JSON
    const clauseData = clause as Record<string, unknown>;
    const alternatives: Array<{ id: string; text: string; label: string }> = [];

    // Primary alternative: the alternativeText field
    if (clauseData.alternativeText && typeof clauseData.alternativeText === 'string') {
      alternatives.push({
        id: `${id}-alt`,
        text: clauseData.alternativeText as string,
        label: 'Alternative Language',
      });
    }

    // Additional alternatives if stored as JSON array
    if (Array.isArray(clauseData.alternatives)) {
      clauseData.alternatives.forEach((alt: unknown, idx: number) => {
        if (typeof alt === 'string') {
          alternatives.push({ id: `${id}-alt-${idx}`, text: alt, label: `Alternative ${idx + 1}` });
        } else if (alt && typeof alt === 'object' && 'text' in (alt as Record<string, unknown>)) {
          alternatives.push({
            id: (alt as Record<string, unknown>).id as string || `${id}-alt-${idx}`,
            text: (alt as Record<string, unknown>).text as string,
            label: (alt as Record<string, unknown>).label as string || `Alternative ${idx + 1}`,
          });
        }
      });
    }

    return createSuccessResponse(ctx, alternatives);
  } catch (error) {
    logger.error('Word Add-in clause alternatives error:', error);
    return createErrorResponse(ctx, 'SERVER_ERROR', 'Failed to fetch alternatives', 500);
  }
});
