/**
 * Word Add-in Settings API
 * Manages user settings for the Word Add-in
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const settingsSchema = z.object({
  theme: z.string().optional(),
  autoSave: z.boolean().optional(),
  aiEnabled: z.boolean().optional(),
  defaultFormat: z.enum(['html', 'ooxml', 'plain']).optional(),
  trackChanges: z.boolean().optional(),
}).passthrough(); // Allow additional settings

export const GET = withAuthApiHandler(async (req: NextRequest, ctx) => {
  try {
    const userId = ctx.userId;

    if (!userId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    // Use UserPreferences.customSettings to store word-addin settings
    const prefs = await prisma.userPreferences.findFirst({
      where: { userId },
    });

    const customSettings = (prefs?.customSettings as Record<string, unknown>) || {};
    const wordAddinSettings = customSettings.wordAddin || {};

    return createSuccessResponse(ctx, wordAddinSettings);
  } catch (error) {
    logger.error('Word Add-in get settings error:', error);
    return createErrorResponse(ctx, 'SERVER_ERROR', 'Failed to fetch settings', 500);
  }
});

export const POST = withAuthApiHandler(async (req: NextRequest, ctx) => {
  try {
    const userId = ctx.userId;

    if (!userId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const body = await req.json();
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', parsed.error.errors[0].message, 400);
    }

    // Get or create user preferences
    const prefs = await prisma.userPreferences.findFirst({
      where: { userId },
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
          userId,
          customSettings: updatedCustom,
        },
      });
    }

    return createSuccessResponse(ctx, { saved: true });
  } catch (error) {
    logger.error('Word Add-in save settings error:', error);
    return createErrorResponse(ctx, 'SERVER_ERROR', 'Failed to save settings', 500);
  }
});
