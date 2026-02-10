/**
 * Calendar Sync API - Sync obligations to external calendars
 * 
 * POST /api/obligations/calendar-sync - Sync obligations to calendar
 * GET /api/obligations/calendar-sync - Get iCal feed URL or sync status
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { aiObligationTrackerService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Generate iCal format for obligations
function generateICalEvent(obligation: Record<string, unknown>): string {
  const uid = obligation.id as string;
  const now = new Date();
  const dtstamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  
  const dueDate = obligation.dueDate ? new Date(obligation.dueDate as string) : now;
  const dtstart = dueDate.toISOString().replace(/[-:]/g, '').split('.')[0].slice(0, 8);
  
  const summary = (obligation.title as string || 'Untitled Obligation').replace(/[,;]/g, '\\$&');
  const description = [
    obligation.description || '',
    `Status: ${obligation.status}`,
    `Priority: ${obligation.priority}`,
    `Type: ${obligation.type}`,
    `Contract: ${obligation.contractTitle || 'Unknown'}`,
    obligation.clauseReference ? `Clause: ${obligation.clauseReference}` : '',
    `View in ConTigo: ${process.env.NEXT_PUBLIC_APP_URL || 'https://app.contigo.ai'}/obligations?id=${uid}`,
  ].filter(Boolean).join('\\n').replace(/[,;]/g, '\\$&');

  const priority = {
    critical: 1,
    high: 2,
    medium: 5,
    low: 9,
  }[obligation.priority as string] || 5;

  const status = obligation.status === 'completed' ? 'COMPLETED' : 'NEEDS-ACTION';
  const location = obligation.contractTitle ? `Contract: ${obligation.contractTitle}` : '';

  return [
    'BEGIN:VEVENT',
    `UID:obligation-${uid}@contigo.ai`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${dtstart}`,
    `SUMMARY:📋 ${summary}`,
    description ? `DESCRIPTION:${description}` : '',
    location ? `LOCATION:${location.replace(/[,;]/g, '\\$&')}` : '',
    `PRIORITY:${priority}`,
    `STATUS:${status}`,
    `CATEGORIES:ConTigo,Obligation,${obligation.type || 'Other'}`,
    // Add reminder 1 day before
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:Obligation due tomorrow: ${summary}`,
    'END:VALARM',
    // Add reminder 1 hour before
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:Obligation due in 1 hour: ${summary}`,
    'END:VALARM',
    'END:VEVENT',
  ].filter(Boolean).join('\r\n');
}

function generateICalFeed(obligations: Record<string, unknown>[], calendarName: string): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  
  const events = obligations.map(generateICalEvent).join('\r\n');
  
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ConTigo//Obligations Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calendarName}`,
    'X-WR-CALDESC:ConTigo Contract Obligations',
    'X-WR-TIMEZONE:UTC',
    `LAST-MODIFIED:${now}`,
    events,
    'END:VCALENDAR',
  ].join('\r\n');
}

// GET - Get calendar feed or sync status
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const format = searchParams.get('format') || 'json';

  // If token provided, return iCal feed (no auth required - token is auth)
  if (token) {
    const calendarToken = await prisma.calendarSyncToken.findFirst({
      where: { token, isActive: true },
    });

    if (!calendarToken) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Invalid or expired calendar token', 401);
    }

    // Get obligations for this tenant
    const obligations = await prisma.obligation.findMany({
      where: {
        tenantId: calendarToken.tenantId,
        status: { notIn: ['CANCELLED', 'WAIVED'] },
      },
      include: {
        contract: {
          select: { contractTitle: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    const transformedObligations = obligations.map((o) => ({
      id: o.id,
      title: o.title,
      description: o.description,
      status: o.status.toLowerCase(),
      priority: o.priority.toLowerCase(),
      type: o.type.toLowerCase(),
      dueDate: o.dueDate?.toISOString(),
      contractTitle: o.contract?.contractTitle,
      clauseReference: o.clauseReference,
    }));

    // Update last synced timestamp
    await prisma.calendarSyncToken.update({
      where: { id: calendarToken.id },
      data: { lastSyncedAt: new Date() },
    });

    if (format === 'ics' || format === 'ical') {
      const icalContent = generateICalFeed(transformedObligations, calendarToken.name || 'ConTigo Obligations');

      return new NextResponse(icalContent, {
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': 'attachment; filename="contigo-obligations.ics"',
        },
      });
    }

    return createSuccessResponse(ctx, {
      success: true,
      obligations: transformedObligations,
      lastSynced: new Date().toISOString(),
    });
  }

  // Otherwise, require auth and return sync status
  if (!session?.user?.tenantId) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  // Get existing calendar tokens for this user
  const tokens = await prisma.calendarSyncToken.findMany({
    where: {
      tenantId: session.user.tenantId,
      userId: session.user.id,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      provider: true,
      createdAt: true,
      lastSyncedAt: true,
      token: true, // Include to generate URL
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.contigo.ai';
  const syncUrls = tokens.map((t) => ({
    id: t.id,
    name: t.name,
    provider: t.provider,
    createdAt: t.createdAt,
    lastSyncedAt: t.lastSyncedAt,
    icalUrl: `${baseUrl}/api/obligations/calendar-sync?token=${t.token}&format=ics`,
    jsonUrl: `${baseUrl}/api/obligations/calendar-sync?token=${t.token}&format=json`,
  }));

  return createSuccessResponse(ctx, {
    success: true,
    data: {
      syncUrls,
      totalTokens: tokens.length,
    },
  });
});

// POST - Create new calendar sync token or sync to provider
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user?.tenantId || !session.user.id) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const body = await request.json();
  const { action, provider, name, filters } = body;

  if (action === 'create_feed') {
    // Generate a unique token for the iCal feed
    const token = crypto.randomBytes(32).toString('hex');

    const calendarToken = await prisma.calendarSyncToken.create({
      data: {
        token,
        tenantId: session.user.tenantId,
        userId: session.user.id,
        name: name || 'ConTigo Obligations',
        provider: provider || 'ical',
        filters: filters || {},
        isActive: true,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.contigo.ai';
    const feedUrl = `${baseUrl}/api/obligations/calendar-sync?token=${token}&format=ics`;

    return createSuccessResponse(ctx, {
      success: true,
      data: {
        id: calendarToken.id,
        name: calendarToken.name,
        feedUrl,
        instructions: {
          google: `1. Open Google Calendar\n2. Click + next to "Other calendars"\n3. Select "From URL"\n4. Paste this URL: ${feedUrl}\n5. Click "Add calendar"`,
          outlook: `1. Open Outlook Calendar\n2. Click "Add calendar" > "From Internet"\n3. Paste this URL: ${feedUrl}\n4. Click "OK"`,
          apple: `1. Open Calendar app\n2. Go to File > New Calendar Subscription\n3. Paste this URL: ${feedUrl}\n4. Click "Subscribe"`,
        },
      },
    });
  }

  if (action === 'revoke') {
    const { tokenId } = body;

    await prisma.calendarSyncToken.update({
      where: { 
        id: tokenId,
        tenantId: session.user.tenantId,
      },
      data: { isActive: false },
    });

    return createSuccessResponse(ctx, {
      success: true,
      message: 'Calendar sync token revoked',
    });
  }

  if (action === 'sync_google') {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Direct Google Calendar sync requires OAuth setup. Use iCal feed URL instead.', 400);
  }

  if (action === 'sync_outlook') {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Direct Outlook sync requires OAuth setup. Use iCal feed URL instead.', 400);
  }

  return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
});
