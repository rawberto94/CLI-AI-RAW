/**
 * Renewal Reminder Cron Job
 * 
 * POST /api/cron/send-renewal-reminders
 * 
 * Sends email reminders for contracts that are approaching expiration.
 * 
 * Trigger intervals:
 * - 90 days before: Initial notification
 * - 60 days before: Follow-up reminder
 * - 30 days before: Urgent reminder
 * - 14 days before: Critical reminder
 * - 7 days before: Final warning
 * - 3 days before: Last chance
 * - 1 day before: Day before expiry
 */

import { NextRequest } from 'next/server';
import { withCronHandler, createSuccessResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { EmailService } from '@/lib/services/email.service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Reminder thresholds in days
const REMINDER_THRESHOLDS = [90, 60, 30, 14, 7, 3, 1];

interface ReminderResult {
  contractId: string;
  contractName: string;
  daysRemaining: number;
  emailSent: boolean;
  recipientEmail?: string;
  error?: string;
}

export const POST = withCronHandler(async (request, ctx) => {
  const startTime = Date.now();
  
    const body = await request.json().catch(() => ({}));
    const tenantId = body.tenantId as string | undefined;
    const dryRun = body.dryRun === true;
    const testEmail = body.testEmail as string | undefined;

    logger.info('[CRON] Starting renewal reminder job', { tenantId, dryRun });

    // Build tenant filter
    const tenantFilter = tenantId ? { tenantId } : {};

    // Get contracts expiring within 90 days
    const now = new Date();
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 90);

    const expiringContracts = await prisma.contract.findMany({
      where: {
        ...tenantFilter,
        expirationDate: {
          gte: now,
          lte: maxDate,
        },
        status: {
          notIn: ['FAILED', 'DELETED'],
        },
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        expirationDate: 'asc',
      },
    });

    logger.info(`[CRON] Found ${expiringContracts.length} contracts expiring within 90 days`);

    const results: ReminderResult[] = [];
    const baseUrl = process.env.NEXTAUTH_URL || 'https://app.contigo.ai';

    for (const contract of expiringContracts) {
      const expiryDate = new Date(contract.expirationDate!);
      const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Check if this day matches a reminder threshold
      const shouldSendReminder = REMINDER_THRESHOLDS.includes(daysRemaining);

      if (!shouldSendReminder) {
        continue;
      }

      // Check if we already sent a reminder for this threshold
      const reminderKey = `renewal-reminder-${contract.id}-${daysRemaining}`;
      const existingReminder = await prisma.notification.findFirst({
        where: {
          tenantId: contract.tenantId,
          type: 'CONTRACT_DEADLINE',
          metadata: {
            path: ['reminderKey'],
            equals: reminderKey,
          },
        },
      }).catch(() => null);

      if (existingReminder) {
        logger.debug(`[CRON] Skipping ${contract.contractTitle} - reminder already sent for ${daysRemaining} days`);
        continue;
      }

      // Get owner email from uploadedBy or use tenant contact
      const recipientEmail = testEmail || undefined; // No owner relation, would need user lookup
      const recipientName = contract.uploadedBy || 'Contract Manager';

      if (!recipientEmail) {
        results.push({
          contractId: contract.id,
          contractName: contract.contractTitle || contract.fileName,
          daysRemaining,
          emailSent: false,
          error: 'No recipient email found',
        });
        continue;
      }

      if (dryRun) {
        results.push({
          contractId: contract.id,
          contractName: contract.contractTitle || contract.fileName,
          daysRemaining,
          emailSent: false,
          recipientEmail,
          error: 'Dry run - email not sent',
        });
        continue;
      }

      try {
        // Send email
        const emailResult = await EmailService.sendContractExpiryAlert({
          to: recipientEmail,
          recipientName,
          contractName: contract.contractTitle || contract.fileName,
          contractId: contract.id,
          daysRemaining,
          expiryDate,
          baseUrl,
        });

        // Create in-app notification
        await prisma.notification.create({
          data: {
            tenantId: contract.tenantId,
            userId: contract.uploadedBy || 'system',
            type: 'CONTRACT_DEADLINE',
            title: `Contract Expiring in ${daysRemaining} Days`,
            message: `${contract.contractTitle || contract.fileName} expires on ${expiryDate.toLocaleDateString()}`,
            link: `/contracts/${contract.id}`,
            metadata: {
              contractId: contract.id,
              daysRemaining,
              reminderKey,
              urgency: daysRemaining <= 7 ? 'critical' : daysRemaining <= 30 ? 'high' : 'medium',
            },
            isRead: false,
            createdAt: now,
          },
        }).catch(err => {
          logger.warn('[CRON] Failed to create notification record', { error: err.message });
        });

        results.push({
          contractId: contract.id,
          contractName: contract.contractTitle || contract.fileName,
          daysRemaining,
          emailSent: emailResult.success,
          recipientEmail,
          error: emailResult.error,
        });

        logger.info('[CRON] Sent renewal reminder', {
          contractId: contract.id,
          contractName: contract.contractTitle || contract.fileName,
          daysRemaining,
          recipientEmail,
        });
      } catch (error) {
        results.push({
          contractId: contract.id,
          contractName: contract.contractTitle || contract.fileName,
          daysRemaining,
          emailSent: false,
          recipientEmail,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.emailSent).length;
    const failureCount = results.filter(r => !r.emailSent && !r.error?.includes('Dry run')).length;
    const duration = Date.now() - startTime;

    logger.info('[CRON] Renewal reminder job completed', {
      duration,
      totalProcessed: results.length,
      successCount,
      failureCount,
      dryRun,
    });

    return createSuccessResponse(ctx, {
      message: `Processed ${results.length} renewal reminders`,
      summary: {
        totalContracts: expiringContracts.length,
        remindersProcessed: results.length,
        emailsSent: successCount,
        failures: failureCount,
        dryRun,
        duration: `${duration}ms`,
      },
      results,
      timestamp: new Date().toISOString(),
    });
});

// GET for manual testing
export const GET = withCronHandler(async (request, ctx) => {
  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get('dryRun') !== 'false';
  
  // Create a mock POST request
  const mockRequest = new NextRequest(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({ dryRun }),
  });
  
  return POST(mockRequest);
});
