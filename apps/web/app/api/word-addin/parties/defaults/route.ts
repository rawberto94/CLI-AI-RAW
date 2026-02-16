/**
 * Word Add-in Party Defaults API
 * Manages saved party information for quick contract filling
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

    const { searchParams } = new URL(req.url);
    const partyType = searchParams.get('type') || 'buyer';

    // Look for saved party defaults in user settings
    const settings = await prisma.userSettings.findFirst({
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
      return NextResponse.json({
        success: true,
        data: {
          name: '',
          address: '',
          contact: '',
          email: '',
        },
      });
    }

    return NextResponse.json({ success: true, data: partyDefaults });
  } catch (error) {
    console.error('Word Add-in party defaults error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to fetch party defaults' } },
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
    const { type: partyType, name, address, contact, email } = body;

    if (!partyType) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Party type is required' } },
        { status: 400 }
      );
    }

    // Get or create user settings
    const settings = await prisma.userSettings.findFirst({
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
    console.error('Word Add-in save party defaults error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to save party defaults' } },
      { status: 500 }
    );
  }
}
