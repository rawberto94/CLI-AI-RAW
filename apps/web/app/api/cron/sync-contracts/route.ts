import { NextRequest } from 'next/server';
import { withCronHandler, createSuccessResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { contractService } from 'data-orchestration/services';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for comprehensive sync

/**
 * Scheduled Contract Sync Job
 * 
 * This endpoint should be called by a cron service (e.g., Vercel Cron, GitHub Actions, etc.)
 * on a regular schedule to keep contract tracking data fresh.
 * 
 * Recommended schedule: Every 6 hours
 * 
 * What it syncs:
 * 1. Contract expirations - Updates tracking table with current expiration status
 * 2. Health scores - Recalculates health scores for all contracts
 * 3. Expiration alerts - Generates new alerts for upcoming expirations
 * 4. Cleans up old/resolved alerts
 */

interface SyncResult {
  expirations: {
    processed: number;
    expired: number;
    expiringSoon: number;
  };
  healthScores: {
    calculated: number;
    averageScore: number;
  };
  alerts: {
    generated: number;
    resolved: number;
  };
}

export const POST = withCronHandler(async (request, ctx) => {
    const startTime = Date.now();
    const results: SyncResult = {
      expirations: { processed: 0, expired: 0, expiringSoon: 0 },
      healthScores: { calculated: 0, averageScore: 0 },
      alerts: { generated: 0, resolved: 0 },
    };

    // Get all tenants
    const tenants = await prisma.tenant.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    for (const tenant of tenants) {
      const tenantId = tenant.id;

      // ========== SYNC EXPIRATIONS ==========
      const contracts = await prisma.contract.findMany({
        where: {
          tenantId,
          status: { notIn: ['DELETED', 'FAILED'] },
        },
        include: {
          contractMetadata: true,
        },
      });

      const now = new Date();

      for (const contract of contracts) {
        const endDate = contract.endDate || contract.expirationDate;
        if (!endDate) continue;

        const daysUntilExpiry = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const isExpired = daysUntilExpiry < 0;
        
        let expirationRisk = 'LOW';
        if (daysUntilExpiry <= 0) expirationRisk = 'EXPIRED';
        else if (daysUntilExpiry <= 7) expirationRisk = 'CRITICAL';
        else if (daysUntilExpiry <= 30) expirationRisk = 'HIGH';
        else if (daysUntilExpiry <= 90) expirationRisk = 'MEDIUM';

        let renewalStatus = 'PENDING';
        if (isExpired) renewalStatus = 'EXPIRED';
        else if (daysUntilExpiry <= 30) renewalStatus = 'UPCOMING';

        // Check if record exists
        const existing = await prisma.contractExpiration.findUnique({
          where: { contractId: contract.id },
        });

        const expirationData = {
          tenantId,
          expirationDate: endDate,
          daysUntilExpiry,
          isExpired,
          expiredAt: isExpired && !existing?.expiredAt ? now : existing?.expiredAt,
          expirationRisk,
          impactScore: Math.min(100, Math.max(0, 100 - daysUntilExpiry)),
          contractValue: contract.totalValue || null,
          renewalStatus,
          contractTitle: contract.contractTitle || contract.originalName,
          contractType: contract.contractType || contract.category,
          updatedAt: now,
        };

        if (existing) {
          await prisma.contractExpiration.update({
            where: { contractId: contract.id },
            data: expirationData,
          });
        } else {
          await prisma.contractExpiration.create({
            data: {
              contractId: contract.id,
              ...expirationData,
            },
          });
        }

        results.expirations.processed++;
        if (isExpired) results.expirations.expired++;
        else if (daysUntilExpiry <= 30) results.expirations.expiringSoon++;
      }

      // ========== SYNC HEALTH SCORES ==========
      const contractsForHealth = await prisma.contract.findMany({
        where: {
          tenantId,
          status: { notIn: ['PROCESSING', 'FAILED', 'DELETED'] },
        },
        include: {
          contractMetadata: true,
          artifacts: true,
        },
      });

      let totalScore = 0;
      
      for (const contract of contractsForHealth) {
        // Calculate health score based on multiple factors
        let riskScore = 50; // Default medium risk
        let complianceScore = 70; // Default compliance
        let financialScore = 60; // Default financial health
        const operationalScore = 65; // Default operational

        // Adjust based on artifacts
        const riskArtifact = contract.artifacts.find(a => a.type === 'RISK');
        const complianceArtifact = contract.artifacts.find(a => a.type === 'COMPLIANCE');
        const financialArtifact = contract.artifacts.find(a => a.type === 'FINANCIAL');

        if (riskArtifact?.data) {
          try {
            const riskData = typeof riskArtifact.data === 'string' ? JSON.parse(riskArtifact.data) : riskArtifact.data;
            riskScore = 100 - ((riskData as any).overallRisk || 50);
          } catch {}
        }

        if (complianceArtifact?.data) {
          try {
            const complianceData = typeof complianceArtifact.data === 'string' ? JSON.parse(complianceArtifact.data) : complianceArtifact.data;
            complianceScore = (complianceData as any).complianceScore || (complianceData as any).score || 70;
          } catch {}
        }

        if (financialArtifact?.data) {
          try {
            const financialData = typeof financialArtifact.data === 'string' ? JSON.parse(financialArtifact.data) : financialArtifact.data;
            financialScore = (financialData as any).healthScore || 60;
          } catch {}
        }

        // Calculate weighted overall score
        const overallScore = Math.round(
          riskScore * 0.3 +
          complianceScore * 0.25 +
          financialScore * 0.25 +
          operationalScore * 0.2
        );

        // Determine trend (compare with previous if exists)
        const existing = await prisma.contractHealthScore.findUnique({
          where: { contractId: contract.id },
        });

        let trend: 'improving' | 'stable' | 'declining' = 'stable';
        if (existing) {
          const scoreDiff = overallScore - existing.overallScore;
          if (scoreDiff >= 5) trend = 'improving';
          else if (scoreDiff <= -5) trend = 'declining';
        }

        let alertLevel = 'healthy';
        if (overallScore < 40) alertLevel = 'critical';
        else if (overallScore < 60) alertLevel = 'high';
        else if (overallScore < 75) alertLevel = 'medium';

        await prisma.contractHealthScore.upsert({
          where: { contractId: contract.id },
          update: {
            overallScore,
            riskScore,
            complianceScore,
            financialScore,
            operationalScore,
            trendDirection: trend,
            alertLevel,
            calculatedAt: now,
            updatedAt: now,
          },
          create: {
            contractId: contract.id,
            tenantId,
            overallScore,
            riskScore,
            complianceScore,
            financialScore,
            operationalScore,
            trendDirection: trend,
            alertLevel,
            calculatedAt: now,
          },
        });

        totalScore += overallScore;
        results.healthScores.calculated++;
      }

      if (results.healthScores.calculated > 0) {
        results.healthScores.averageScore = Math.round(totalScore / results.healthScores.calculated);
      }

      // ========== GENERATE ALERTS ==========
      const expirations = await prisma.contractExpiration.findMany({
        where: {
          tenantId,
          expirationRisk: { in: ['HIGH', 'CRITICAL', 'MEDIUM'] },
          daysUntilExpiry: { gte: 0, lte: 90 },
          isExpired: false,
        },
      });

      for (const expiration of expirations) {
        // Check if alert already exists for this expiration
        const existingAlert = await prisma.expirationAlert.findFirst({
          where: {
            contractId: expiration.contractId,
            tenantId,
            status: 'PENDING',
          },
        });

        if (!existingAlert) {
          let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
          let alertType = 'EXPIRATION_90_DAYS';
          
          if (expiration.daysUntilExpiry <= 7) {
            severity = 'CRITICAL';
            alertType = 'EXPIRATION_7_DAYS';
          } else if (expiration.daysUntilExpiry <= 30) {
            severity = 'HIGH';
            alertType = 'EXPIRATION_30_DAYS';
          } else if (expiration.daysUntilExpiry <= 60) {
            severity = 'MEDIUM';
            alertType = 'EXPIRATION_60_DAYS';
          }

          const contractTitle = expiration.contractTitle || 'Unknown Contract';
          
          await prisma.expirationAlert.create({
            data: {
              contractId: expiration.contractId,
              tenantId,
              alertType,
              severity,
              title: `Contract Expiring: ${contractTitle}`,
              message: `Contract "${contractTitle}" expires in ${expiration.daysUntilExpiry} days. Please review and take appropriate action.`,
              scheduledFor: now,
              daysBeforeExpiry: expiration.daysUntilExpiry,
              status: 'PENDING',
            },
          });

          results.alerts.generated++;
        }
      }

      // Resolve alerts for expired contracts
      const resolvedAlerts = await prisma.expirationAlert.updateMany({
        where: {
          tenantId,
          status: 'PENDING',
          contractId: {
            in: (await prisma.contractExpiration.findMany({
              where: { tenantId, isExpired: true },
              select: { contractId: true },
            })).map(e => e.contractId),
          },
        },
        data: {
          status: 'ACKNOWLEDGED',
          acknowledgedAt: now,
          acknowledgedAction: 'EXPIRED',
        },
      });

      results.alerts.resolved = resolvedAlerts.count;
    }

    const duration = Date.now() - startTime;

    return createSuccessResponse(ctx, {
      data: {
        ...results,
        duration: `${duration}ms`,
        tenantsProcessed: tenants.length,
        completedAt: new Date().toISOString(),
      },
    });
});

// GET endpoint for manual trigger or health check
export const GET = withCronHandler(async (request, ctx) => {
  return POST(request);
});
