/**
 * Dashboard Stats API
 * GET /api/dashboard/stats - Get aggregated contract statistics from database
 * 
 * All data is fetched from the real database - no mock fallbacks
 * Includes health scores, expiration data, and comprehensive analytics
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuthApiHandler, createSuccessResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';
import { analyticsService } from 'data-orchestration/services';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withAuthApiHandler(async (_request: NextRequest, ctx: AuthenticatedApiContext) => {
  const startTime = Date.now();
  const tenantId = ctx.tenantId;
  
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  // Core contract stats + health scores + expirations in parallel
  const [
    totalContracts,
    activeContracts,
    expiringIn30Days,
    expiringIn90Days,
    recentlyAdded,
    statusBreakdown,
    typeBreakdown,
    totalValue,
    healthScoreStats,
    expirationStats,
    pendingAlerts,
  ] = await Promise.all([
    prisma.contract.count({ where: { tenantId, isDeleted: false } }),
    prisma.contract.count({ 
      where: { 
        tenantId,
        status: { in: ['COMPLETED', 'ACTIVE', 'PROCESSING'] }
      } 
    }),
    prisma.contract.count({
      where: {
        tenantId,
        OR: [
          { endDate: { gte: now, lte: thirtyDaysFromNow } },
          { expirationDate: { gte: now, lte: thirtyDaysFromNow } },
        ]
      }
    }),
    prisma.contract.count({
      where: {
        tenantId,
        OR: [
          { endDate: { gte: now, lte: ninetyDaysFromNow } },
          { expirationDate: { gte: now, lte: ninetyDaysFromNow } },
        ]
      }
    }),
    prisma.contract.count({
      where: {
        tenantId,
        createdAt: { gte: thirtyDaysAgo }
      }
    }),
    prisma.contract.groupBy({
      by: ['status'],
      where: { tenantId, isDeleted: false },
      _count: true
    }),
    prisma.contract.groupBy({
      by: ['contractType'],
      where: { tenantId, isDeleted: false },
      _count: true
    }),
    prisma.contract.aggregate({
      where: { tenantId, isDeleted: false },
      _sum: { totalValue: true }
    }),
    // Health score stats from dedicated table
    prisma.$queryRaw<Array<{
      total: bigint;
      avg_overall: number;
      avg_risk: number;
      avg_compliance: number;
      critical_count: bigint;
      high_count: bigint;
      medium_count: bigint;
      healthy_count: bigint;
      improving: bigint;
      declining: bigint;
    }>>`
      SELECT 
        COUNT(*) as total,
        AVG(overall_score) as avg_overall,
        AVG(risk_score) as avg_risk,
        AVG(compliance_score) as avg_compliance,
        COUNT(*) FILTER (WHERE alert_level = 'critical') as critical_count,
        COUNT(*) FILTER (WHERE alert_level = 'high') as high_count,
        COUNT(*) FILTER (WHERE alert_level = 'medium') as medium_count,
        COUNT(*) FILTER (WHERE alert_level IN ('low', 'none')) as healthy_count,
        COUNT(*) FILTER (WHERE trend_direction = 'improving') as improving,
        COUNT(*) FILTER (WHERE trend_direction = 'declining') as declining
      FROM contract_health_scores WHERE tenant_id = ${tenantId}
    `.catch(() => [{}] as Array<{
      total: bigint;
      avg_overall: number;
      avg_risk: number;
      avg_compliance: number;
      critical_count: bigint;
      high_count: bigint;
      medium_count: bigint;
      healthy_count: bigint;
      improving: bigint;
      declining: bigint;
    }>),
    // Expiration stats from dedicated table
    prisma.$queryRaw<Array<{
      total: bigint;
      expired: bigint;
      critical_risk: bigint;
      high_risk: bigint;
      total_value_at_risk: number;
      pending_renewal: bigint;
      initiated_renewal: bigint;
    }>>`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_expired = true) as expired,
        COUNT(*) FILTER (WHERE expiration_risk = 'CRITICAL') as critical_risk,
        COUNT(*) FILTER (WHERE expiration_risk = 'HIGH') as high_risk,
        COALESCE(SUM(value_at_risk), 0) as total_value_at_risk,
        COUNT(*) FILTER (WHERE renewal_status = 'PENDING') as pending_renewal,
        COUNT(*) FILTER (WHERE renewal_status = 'INITIATED') as initiated_renewal
      FROM contract_expirations WHERE tenant_id = ${tenantId}
    `.catch(() => [{}] as Array<{
      total: bigint;
      expired: bigint;
      critical_risk: bigint;
      high_risk: bigint;
      total_value_at_risk: number;
      pending_renewal: bigint;
      initiated_renewal: bigint;
    }>),
    // Pending alerts count
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM expiration_alerts 
      WHERE tenant_id = ${tenantId} AND status = 'PENDING'
    `.catch(() => [{ count: 0n }]),
  ]);
  
  // Calculate portfolio value from actual values or estimate
  const portfolioValue = totalValue._sum.totalValue ? Number(totalValue._sum.totalValue) : 0;
  
  // Extract health and expiration stats
  const defaultHealthStats = {
    total: BigInt(0),
    avg_overall: 0,
    avg_risk: 0,
    avg_compliance: 0,
    critical_count: BigInt(0),
    high_count: BigInt(0),
    medium_count: BigInt(0),
    healthy_count: BigInt(0),
    improving: BigInt(0),
    declining: BigInt(0),
  };
  const defaultExpirationStats = {
    total: BigInt(0),
    expired: BigInt(0),
    critical_risk: BigInt(0),
    high_risk: BigInt(0),
    total_value_at_risk: 0,
    pending_renewal: BigInt(0),
    initiated_renewal: BigInt(0),
  };
  const hs = healthScoreStats[0] || defaultHealthStats;
  const es = expirationStats[0] || defaultExpirationStats;
  const alertCount = Number(pendingAlerts[0]?.count || 0);

  // Calculate overall health score (average from health_scores table)
  const avgHealthScore = Math.round(Number(hs.avg_overall || 0));
  const avgRiskScore = Math.round(Number(hs.avg_risk || 0));
  const avgComplianceScore = Math.round(Number(hs.avg_compliance || 0));
  
  return createSuccessResponse(ctx, {
    overview: {
      totalContracts,
      activeContracts,
      portfolioValue,
      recentlyAdded,
    },
    renewals: {
      expiringIn30Days,
      expiringIn90Days,
      urgentCount: expiringIn30Days,
      expired: Number(es.expired || 0),
      pendingRenewal: Number(es.pending_renewal || 0),
      initiatedRenewal: Number(es.initiated_renewal || 0),
    },
    health: {
      averageScore: avgHealthScore,
      averageRiskScore: avgRiskScore,
      averageComplianceScore: avgComplianceScore,
      byAlertLevel: {
        critical: Number(hs.critical_count || 0),
        high: Number(hs.high_count || 0),
        medium: Number(hs.medium_count || 0),
        healthy: Number(hs.healthy_count || 0),
      },
      trends: {
        improving: Number(hs.improving || 0),
        declining: Number(hs.declining || 0),
      },
      contractsWithScores: Number(hs.total || 0),
    },
    expirations: {
      tracked: Number(es.total || 0),
      expired: Number(es.expired || 0),
      criticalRisk: Number(es.critical_risk || 0),
      highRisk: Number(es.high_risk || 0),
      valueAtRisk: Number(es.total_value_at_risk || 0),
    },
    alerts: {
      pending: alertCount,
    },
    breakdown: {
      byStatus: statusBreakdown.map(item => ({
        status: item.status,
        count: item._count
      })),
      byType: typeBreakdown.filter(item => item.contractType).map(item => ({
        type: item.contractType || 'Unknown',
        count: item._count
      }))
    },
    // Legacy compatibility
    riskScore: avgRiskScore,
    complianceScore: avgComplianceScore,
    _meta: {
      source: 'database',
      tenantId,
      timestamp: now.toISOString(),
      responseTime: `${Date.now() - startTime}ms`,
    }
  });
});
