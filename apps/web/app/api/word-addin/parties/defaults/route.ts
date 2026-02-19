/**
 * Word Add-in Party Defaults API
 * Manages saved party information for quick contract filling
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
    const partyType = searchParams.get('type') || 'buyer';

    // Look for saved party defaults in user settings
    const settings = await (prisma as any).userSettings.findFirst({
      where: {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
      },
    });

    const partyDefaults = (settings?.preferences as Record<string, unknown>)?.[`${partyType}Defaults`] as {
      name: string;
      address: string;
      contact: string;
      email: string;
    } | undefined;

    if (!partyDefaults) {
      // Return empty defaults
      return createSuccessResponse(ctx, {
        name: '',
        address: '',
        contact: '',
        email: '',
      });
    }

    return createSuccessResponse(ctx, partyDefaults);
  } catch (error) {
    console.error('Word Add-in party defaults error:', error);
    return createErrorResponse(apiCtx, 'SERVER_ERROR', 'Failed to fetch party defaults', 500);
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
    const { type: partyType, name, address, contact, email } = body;

    if (!partyType) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Party type is required', 400);
    }

    // Get or create user settings
    const settings = await (prisma as any).userSettings.findFirst({
      where: {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
      },
    });

    const partyDefaults = {
      name: name || '',
      address: address || '',
      contact: contact || '',
      email: email || '',
    };

    const currentPrefs = (settings?.preferences as Record<string, unknown>) || {};
    const updatedPrefs = {
      ...currentPrefs,
      [`${partyType}Defaults`]: partyDefaults,
    };

    if (settings) {
      await (prisma as any).userSettings.update({
        where: { id: settings.id },
        data: { preferences: updatedPrefs },
      });
    } else {
      await (prisma as any).userSettings.create({
        data: {
          userId: ctx.userId || 'unknown',
          tenantId: ctx.tenantId,
          preferences: updatedPrefs,
        },
      });
    }

    return createSuccessResponse(ctx, { saved: true });
  } catch (error) {
    console.error('Word Add-in save party defaults error:', error);
    return createErrorResponse(apiCtx, 'SERVER_ERROR', 'Failed to save party defaults', 500);
  }
}
