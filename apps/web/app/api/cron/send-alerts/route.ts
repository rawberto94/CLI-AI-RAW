import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { AdvancedNotificationService, NotificationPayload } from '@/lib/notifications/notification.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const notificationService = new AdvancedNotificationService();

const CRON_SECRET = process.env.CRON_SECRET || 'development-cron-secret';

/**
 * Send Expiration Alerts via Email/Notifications
 * 
 * This endpoint processes pending alerts and sends notifications.
 * 
 * Recommended schedule: Every hour
 */

interface NotificationResult {
  processed: number;
  sent: number;
  failed: number;
  errors: string[];
}

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const providedSecret = authHeader?.replace('Bearer ', '') || request.nextUrl.searchParams.get('secret');
    
    if (providedSecret !== CRON_SECRET) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const startTime = Date.now();
    const results: NotificationResult = {
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [],
    };

    // Get all pending alerts that are due
    const pendingAlerts = await prisma.expirationAlert.findMany({
      where: {
        status: 'PENDING',
        scheduledFor: { lte: new Date() },
      },
      orderBy: [
        { severity: 'asc' }, // Critical first
        { scheduledFor: 'asc' },
      ],
      take: 100, // Process max 100 alerts per run
    });

    // Get contracts for the alerts
    const contractIds = [...new Set(pendingAlerts.map(a => a.contractId))];
    type ContractWithMetadata = Prisma.ContractGetPayload<{
      include: { contractMetadata: true };
    }>;

    const contracts = (await prisma.contract.findMany({
      where: { id: { in: contractIds } },
      include: { contractMetadata: true },
    })) as ContractWithMetadata[];

    const contractMap = new Map<string, ContractWithMetadata>(contracts.map(c => [c.id, c]));

    for (const alert of pendingAlerts) {
      results.processed++;

      try {
        // Get contract details for notification
        const contract = contractMap.get(alert.contractId);
        const owner = contract?.uploadedBy;

        // Send notification via the notification service
        if (owner) {
          // Get user details for email
          const user = await prisma.user.findFirst({
            where: { id: owner },
            select: { id: true, tenantId: true, email: true }
          });
          
          if (user) {
            const payload: NotificationPayload = {
              type: 'contract_expiring',
              title: `[${alert.severity.toUpperCase()}] Contract Alert`,
              body: alert.message,
              data: {
                contractId: alert.contractId,
                severity: alert.severity,
                alertType: alert.alertType,
              },
              actionUrl: `/contracts/${alert.contractId}`,
              priority: alert.severity === 'CRITICAL' ? 'urgent' : alert.severity === 'HIGH' ? 'high' : 'normal',
            };

            await notificationService.notify(
              { userId: user.id, tenantId: user.tenantId, email: user.email },
              payload
            );
          }
        }

        // Mark alert as sent
        await prisma.expirationAlert.update({
          where: { id: alert.id },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            sentTo: owner ? [{ email: owner }] : [],
          },
        });

        results.sent++;

        // Update last notification sent on expiration record
        await prisma.contractExpiration.update({
          where: { contractId: alert.contractId },
          data: {
            lastAlertSent: new Date(),
          },
        });

      } catch (error: unknown) {
        results.failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Alert ${alert.id}: ${errorMsg}`);
      }
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        ...results,
        duration: `${duration}ms`,
        completedAt: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Alert sending failed',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  
  if (secret !== CRON_SECRET) {
    // Return stats about pending alerts
    const stats = await prisma.expirationAlert.groupBy({
      by: ['status', 'severity'],
      _count: { id: true },
    });

    return NextResponse.json({
      success: true,
      message: 'Alert notification cron endpoint is active',
      schedule: 'Every hour recommended',
      pendingAlerts: stats,
    });
  }

  return POST(request);
}
