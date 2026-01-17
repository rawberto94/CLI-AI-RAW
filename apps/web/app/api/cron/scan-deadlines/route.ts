/**
 * Deadline Scanner Cron Job
 * POST /api/cron/scan-deadlines
 * 
 * Automatically scans contracts for approaching deadlines
 * Should run daily via Vercel Cron
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface ContractDeadline {
  contractId: string;
  contractTitle: string;
  expirationDate: Date;
  daysUntilExpiry: number;
  totalValue: number | null;
  supplierName: string | null;
  autoRenewalEnabled: boolean;
  noticePeriodDays: number | null;
  tenantId: string;
  uploadedBy: string | null;
  riskLevel: 'high' | 'medium' | 'low';
}

export async function POST(request: NextRequest) {
  try {
    // Verify this is a cron job request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date();
    const nineDaysFromNow = new Date();
    nineDaysFromNow.setDate(now.getDate() + 90);

    // Find contracts expiring within 90 days
    const contracts = await prisma.contract.findMany({
      where: {
        expirationDate: {
          gte: now,
          lte: nineDaysFromNow,
        },
        status: {
          in: ['ACTIVE', 'COMPLETED'],
        },
        isDeleted: false,
      },
      select: {
        id: true,
        contractTitle: true,
        expirationDate: true,
        totalValue: true,
        supplierName: true,
        autoRenewalEnabled: true,
        noticePeriodDays: true,
        tenantId: true,
        uploadedBy: true,
      },
      orderBy: {
        expirationDate: 'asc',
      },
    });

    const deadlines: ContractDeadline[] = [];
    const notifications: Array<{
      contractId: string;
      type: 'deadline_approaching' | 'notice_period_expiring';
      urgency: 'high' | 'medium' | 'low';
      message: string;
    }> = [];

    for (const contract of contracts) {
      if (!contract.expirationDate) continue;

      const daysUntilExpiry = Math.floor(
        (contract.expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Determine risk level
      let riskLevel: 'high' | 'medium' | 'low' = 'low';
      if (daysUntilExpiry <= 30) riskLevel = 'high';
      else if (daysUntilExpiry <= 60) riskLevel = 'medium';

      // Check notice period
      const noticePeriod = contract.noticePeriodDays || 30;
      const noticePeriodDate = new Date(contract.expirationDate);
      noticePeriodDate.setDate(noticePeriodDate.getDate() - noticePeriod);

      deadlines.push({
        contractId: contract.id,
        contractTitle: contract.contractTitle || 'Untitled Contract',
        expirationDate: contract.expirationDate,
        daysUntilExpiry,
        totalValue: contract.totalValue ? Number(contract.totalValue) : null,
        supplierName: contract.supplierName,
        autoRenewalEnabled: contract.autoRenewalEnabled || false,
        noticePeriodDays: contract.noticePeriodDays,
        tenantId: contract.tenantId,
        uploadedBy: contract.uploadedBy,
        riskLevel,
      });

      // Create notifications based on urgency
      if (daysUntilExpiry <= 30 && !contract.autoRenewalEnabled) {
        notifications.push({
          contractId: contract.id,
          type: 'deadline_approaching',
          urgency: 'high',
          message: `Contract "${contract.contractTitle}" expires in ${daysUntilExpiry} days. Immediate action required.`,
        });
      }

      // Notice period warning
      if (now >= noticePeriodDate && now <= contract.expirationDate) {
        notifications.push({
          contractId: contract.id,
          type: 'notice_period_expiring',
          urgency: 'high',
          message: `Notice period for contract "${contract.contractTitle}" is active. Must act within ${noticePeriod} days.`,
        });
      }
    }

    // Store or update deadline records
    // This would typically go to a ContractDeadline table

    // Send email notifications for high-priority items
    const criticalDeadlines = deadlines.filter(d => d.riskLevel === 'high' || d.daysUntilExpiry <= 7);
    if (criticalDeadlines.length > 0) {
      const { sendEmail } = await import('@/lib/email/email-service');
      const { emailTemplates } = await import('@/lib/email/templates');
      
      for (const deadline of criticalDeadlines) {
        const template = emailTemplates.contractExpiring({
          contractTitle: deadline.contractTitle,
          expirationDate: deadline.expirationDate.toLocaleDateString(),
          daysUntilExpiration: deadline.daysUntilExpiry,
          contractId: deadline.contractId,
          contractUrl: `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3005'}/contracts/${deadline.contractId}`,
        });
        
        // Get owner email from contract uploadedBy or fallback to admin
        let ownerEmail = process.env.ADMIN_EMAIL || 'admin@contigo.ch';
        if (deadline.uploadedBy) {
          const owner = await prisma.user.findUnique({
            where: { id: deadline.uploadedBy },
            select: { email: true },
          });
          if (owner?.email) {
            ownerEmail = owner.email;
          }
        }
        
        await sendEmail({
          to: ownerEmail,
          subject: template.subject,
          html: template.html,
        });
      }
    }

    // Create in-app notifications for all deadlines
    if (deadlines.length > 0) {
      const notificationsData = await Promise.all(
        deadlines.map(async deadline => {
          // Get the actual user ID (owner or uploader)
          const userId = deadline.uploadedBy || 'admin';
          
          return {
            tenantId: deadline.tenantId,
            userId,
            type: deadline.riskLevel === 'high' ? 'CONTRACT_DEADLINE' : 'SYSTEM',
            title: deadline.riskLevel === 'high'
              ? 'Contract Expiring Soon'
              : 'Contract Deadline Approaching',
            message: `${deadline.contractTitle} expires in ${deadline.daysUntilExpiry} days`,
            link: `/contracts/${deadline.contractId}`,
            metadata: {
              contractId: deadline.contractId,
              riskLevel: deadline.riskLevel,
              daysUntilExpiry: deadline.daysUntilExpiry,
            },
          };
        })
      );

      try {
        await prisma.notification.createMany({
          data: notificationsData,
        });
      } catch {
        // Notification creation failed - continue without in-app notifications
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        scannedContracts: contracts.length,
        deadlinesFound: deadlines.length,
        notificationsCreated: notifications.length,
        breakdown: {
          high: deadlines.filter(d => d.riskLevel === 'high').length,
          medium: deadlines.filter(d => d.riskLevel === 'medium').length,
          low: deadlines.filter(d => d.riskLevel === 'low').length,
        },
      },
      deadlines: deadlines.slice(0, 10), // Return first 10 for visibility
      notifications: notifications.slice(0, 5),
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: 'Deadline scan failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Allow GET for manual testing in development
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Manual trigger only available in development' },
      { status: 403 }
    );
  }

  // Forward to POST handler
  return POST(request);
}
