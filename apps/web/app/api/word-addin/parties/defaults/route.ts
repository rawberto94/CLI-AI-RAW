/**
 * Word Add-in Party Defaults API
 * Manages saved party information for quick contract filling
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const partyDefaultsSchema = z.object({
  type: z.enum(['buyer', 'seller', 'provider', 'client'], { required_error: 'Party type is required' }),
  name: z.string().max(200).optional().default(''),
  address: z.string().max(500).optional().default(''),
  contact: z.string().max(200).optional().default(''),
  email: z.string().email('Invalid email').max(254).optional().or(z.literal('')).default(''),
});

export const GET = withAuthApiHandler(async (req: NextRequest, ctx) => {
  try {
    const userId = ctx.userId;

    if (!userId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const { searchParams } = new URL(req.url);
    const partyType = searchParams.get('type') || 'buyer';

    // Use UserPreferences.customSettings for party defaults
    const prefs = await prisma.userPreferences.findFirst({
      where: { userId },
    });

    const customSettings = (prefs?.customSettings as Record<string, unknown>) || {};
    const partyDefaults = customSettings[`${partyType}Defaults`] as {
      name: string;
      address: string;
      contact: string;
      email: string;
    } | undefined;

    if (!partyDefaults) {
      return createSuccessResponse(ctx, {
        name: '',
        address: '',
        contact: '',
        email: '',
      });
    }

    return createSuccessResponse(ctx, partyDefaults);
  } catch (error) {
    logger.error('Word Add-in party defaults error:', error);
    return createErrorResponse(ctx, 'SERVER_ERROR', 'Failed to fetch party defaults', 500);
  }
});

export const POST = withAuthApiHandler(async (req: NextRequest, ctx) => {
  try {
    const userId = ctx.userId;

    if (!userId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const body = await req.json();
    const parsed = partyDefaultsSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', parsed.error.errors[0].message, 400);
    }

    const { type: partyType, name, address, contact, email } = parsed.data;

    // Get or create user preferences
    const prefs = await prisma.userPreferences.findFirst({
      where: { userId },
    });

    const partyDefaults = { name, address, contact, email };
    const currentCustom = (prefs?.customSettings as Record<string, unknown>) || {};
    const updatedCustom = JSON.parse(JSON.stringify({
      ...currentCustom,
      [`${partyType}Defaults`]: partyDefaults,
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
    logger.error('Word Add-in save party defaults error:', error);
    return createErrorResponse(ctx, 'SERVER_ERROR', 'Failed to save party defaults', 500);
  }
});
