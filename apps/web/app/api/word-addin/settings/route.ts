/**
 * Word Add-in Settings API
 * Manages user settings for the Word Add-in
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedApiContext } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthenticatedApiContext(req);
    if (!ctx) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const settings = await prisma.userSettings.findFirst({
      where: {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
      },
    });

    const wordAddinSettings = (settings?.preferences as Record<string, unknown>)?.wordAddin || {};

    return NextResponse.json({ success: true, data: wordAddinSettings });
  } catch (error) {
    console.error('Word Add-in get settings error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to fetch settings' } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthenticatedApiContext(req);
    if (!ctx) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const body = await req.json();

    // Get or create user settings
    const settings = await prisma.userSettings.findFirst({
      where: {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
      },
    });

    const currentPrefs = (settings?.preferences as Record<string, unknown>) || {};
    const updatedPrefs = {
      ...currentPrefs,
      wordAddin: body,
    };

    if (settings) {
      await prisma.userSettings.update({
        where: { id: settings.id },
        data: { preferences: updatedPrefs },
      });
    } else {
      await prisma.userSettings.create({
        data: {
          userId: ctx.userId || 'unknown',
          tenantId: ctx.tenantId,
          preferences: updatedPrefs,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Word Add-in save settings error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to save settings' } },
      { status: 500 }
    );
  }
}
