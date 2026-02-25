/**
 * Word Add-in Settings API
 * Manages user settings for the Word Add-in
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const settingsSchema = z.object({
  theme: z.string().optional(),
  autoSave: z.boolean().optional(),
  aiEnabled: z.boolean().optional(),
  defaultFormat: z.enum(['html', 'ooxml', 'plain']).optional(),
  trackChanges: z.boolean().optional(),
}).passthrough(); // Allow additional settings

export async function GET(req: NextRequest) {
  const apiCtx = getApiContext(req);
  try {
    const ctx = getAuthenticatedApiContext(req);
    if (!ctx) {
      return createErrorResponse(apiCtx, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    // Use UserPreferences.customSettings to store word-addin settings
    const prefs = await prisma.userPreferences.findFirst({
      where: { userId: ctx.userId },
    });

    const customSettings = (prefs?.customSettings as Record<string, unknown>) || {};
    const wordAddinSettings = customSettings.wordAddin || {};

    return createSuccessResponse(ctx, wordAddinSettings);
  } catch (error) {
    logger.error('Word Add-in get settings error:', error);
    return createErrorResponse(apiCtx, 'SERVER_ERROR', 'Failed to fetch settings', 500);
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
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', parsed.error.errors[0].message, 400);
    }

    // Get or create user preferences
    const prefs = await prisma.userPreferences.findFirst({
      where: { userId: ctx.userId },
    });

    const currentCustom = (prefs?.customSettings as Record<string, unknown>) || {};
    const updatedCustom = JSON.parse(JSON.stringify({
      ...currentCustom,
      wordAddin: parsed.data,
    }));

    if (prefs) {
      await prisma.userPreferences.update({
        where: { id: prefs.id },
        data: { customSettings: updatedCustom },
      });
    } else {
      await prisma.userPreferences.create({
        data: {
          userId: ctx.userId || 'unknown',
          customSettings: updatedCustom,
        },
      });
    }

    return createSuccessResponse(ctx, { saved: true });
  } catch (error) {
    logger.error('Word Add-in save settings error:', error);
    return createErrorResponse(apiCtx, 'SERVER_ERROR', 'Failed to save settings', 500);
  }
}
