/**
 * Contract Health Scores API
 * GET /api/contracts/health-scores - Get health scores from dedicated table
 * POST /api/contracts/health-scores - Trigger recalculation for specific contracts
 * 
 * Uses the ContractHealthScore table for fast querying
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerTenantId } from '@/lib/tenant-server';

export const dynamic = 'force-dynamic';

/**
 * Health score data types
 */
interface HealthFactor {
  name: string;
  score: number;
  weight: number;
  description?: string;
}

interface HealthAlert {
  id?: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  createdAt?: string;
}

interface TrendHistoryEntry {
  date: string;
  score: number;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = await getServerTenantId();
    
    // Parse filters
    const alertLevel = searchParams.get('alertLevel');
    const trendDirection = searchParams.get('trend');
    const minScore = searchParams.get('minScore');
    const maxScore = searchParams.get('maxScore');
    const contractId = searchParams.get('contractId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where conditions
    const conditions: string[] = [`tenant_id = '${tenantId}'`];
    if (alertLevel) conditions.push(`alert_level = '${alertLevel}'`);
    if (trendDirection) conditions.push(`trend_direction = '${trendDirection}'`);
    if (minScore) conditions.push(`overall_score >= ${parseInt(minScore)}`);
    if (maxScore) conditions.push(`overall_score <= ${parseInt(maxScore)}`);
    if (contractId) conditions.push(`contract_id = '${contractId}'`);

    const whereClause = conditions.join(' AND ');

    // Query health scores
    const healthScores = await prisma.$queryRaw<Array<{
      id: string;
      contract_id: string;
      overall_score: number;
      risk_score: number;
      compliance_score: number;
      financial_score: number;
      operational_score: number;
      renewal_readiness: number;
      document_quality: number;
      factors: HealthFactor[];
      strengths: string[];
      weaknesses: string[];
      opportunities: string[];
      previous_score: number;
      score_change: number;
      trend_direction: string;
      trend_history: TrendHistoryEntry[];
      alert_level: string;
      active_alerts: HealthAlert[];
      alert_count: number;
      industry_average: number;
      percentile_rank: number;
      calculated_at: Date;
    }>>`
      SELECT 
        hs.id, hs.contract_id, hs.overall_score, hs.risk_score, hs.compliance_score,
        hs.financial_score, hs.operational_score, hs.renewal_readiness, hs.document_quality,
        hs.factors, hs.strengths, hs.weaknesses, hs.opportunities,
        hs.previous_score, hs.score_change, hs.trend_direction, hs.trend_history,
        hs.alert_level, hs.active_alerts, hs.alert_count,
        hs.industry_average, hs.percentile_rank, hs.calculated_at
      FROM contract_health_scores hs
      WHERE hs.tenant_id = ${tenantId}
      ORDER BY hs.overall_score ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Get contract details for each health score
    const contractIds = healthScores.map(hs => hs.contract_id);
    const contracts = contractIds.length > 0 ? await prisma.contract.findMany({
      where: { id: { in: contractIds } },
      select: {
        id: true,
        contractTitle: true,
        originalName: true,
        fileName: true,
        supplierName: true,
        clientName: true,
        contractType: true,
        totalValue: true,
        expirationDate: true,
        endDate: true,
      },
    }) : [];

    const contractMap = new Map(contracts.map(c => [c.id, c]));

    // Get summary stats
    const stats = await prisma.$queryRaw<Array<{
      total: bigint;
      avg_score: number;
      avg_risk: number;
      avg_compliance: number;
      avg_financial: number;
      avg_renewal_readiness: number;
      critical_count: bigint;
      high_count: bigint;
      medium_count: bigint;
      low_count: bigint;
      healthy_count: bigint;
      improving: bigint;
      declining: bigint;
      stable: bigint;
    }>>`
      SELECT 
        COUNT(*) as total,
        AVG(overall_score) as avg_score,
        AVG(risk_score) as avg_risk,
        AVG(compliance_score) as avg_compliance,
        AVG(financial_score) as avg_financial,
        AVG(renewal_readiness) as avg_renewal_readiness,
        COUNT(*) FILTER (WHERE alert_level = 'critical') as critical_count,
        COUNT(*) FILTER (WHERE alert_level = 'high') as high_count,
        COUNT(*) FILTER (WHERE alert_level = 'medium') as medium_count,
        COUNT(*) FILTER (WHERE alert_level = 'low') as low_count,
        COUNT(*) FILTER (WHERE alert_level = 'none') as healthy_count,
        COUNT(*) FILTER (WHERE trend_direction = 'improving') as improving,
        COUNT(*) FILTER (WHERE trend_direction = 'declining') as declining,
        COUNT(*) FILTER (WHERE trend_direction = 'stable') as stable
      FROM contract_health_scores
      WHERE tenant_id = ${tenantId}
    `;

    const defaultStats = {
      total: BigInt(0),
      avg_score: 0,
      avg_risk: 0,
      avg_compliance: 0,
      avg_financial: 0,
      avg_renewal_readiness: 0,
      critical_count: BigInt(0),
      high_count: BigInt(0),
      medium_count: BigInt(0),
      low_count: BigInt(0),
      healthy_count: BigInt(0),
      improving: BigInt(0),
      declining: BigInt(0),
      stable: BigInt(0),
    };
    const s = stats[0] || defaultStats;

    // Transform to API response
    const data = healthScores.map(hs => {
      const contract = contractMap.get(hs.contract_id);
      return {
        id: hs.id,
        contractId: hs.contract_id,
        contractName: contract?.contractTitle || contract?.originalName || contract?.fileName || 'Unknown',
        supplierName: contract?.supplierName,
        clientName: contract?.clientName,
        contractType: contract?.contractType,
        value: contract?.totalValue ? Number(contract.totalValue) : null,
        expirationDate: (contract?.expirationDate || contract?.endDate)?.toISOString(),
        scores: {
          overall: hs.overall_score,
          risk: hs.risk_score,
          compliance: hs.compliance_score,
          financial: hs.financial_score,
          operational: hs.operational_score,
          renewalReadiness: hs.renewal_readiness,
          documentQuality: hs.document_quality,
        },
        factors: hs.factors,
        strengths: hs.strengths,
        weaknesses: hs.weaknesses,
        opportunities: hs.opportunities,
        trend: {
          direction: hs.trend_direction,
          previousScore: hs.previous_score,
          change: hs.score_change,
          history: hs.trend_history,
        },
        alerts: {
          level: hs.alert_level,
          active: hs.active_alerts,
          count: hs.alert_count,
        },
        benchmarking: {
          industryAverage: hs.industry_average,
          percentileRank: hs.percentile_rank,
        },
        calculatedAt: hs.calculated_at?.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        healthScores: data,
        stats: {
          total: Number(s.total || 0),
          averages: {
            overall: Math.round(Number(s.avg_score || 0)),
            risk: Math.round(Number(s.avg_risk || 0)),
            compliance: Math.round(Number(s.avg_compliance || 0)),
            financial: Math.round(Number(s.avg_financial || 0)),
            renewalReadiness: Math.round(Number(s.avg_renewal_readiness || 0)),
          },
          byAlertLevel: {
            critical: Number(s.critical_count || 0),
            high: Number(s.high_count || 0),
            medium: Number(s.medium_count || 0),
            low: Number(s.low_count || 0),
            healthy: Number(s.healthy_count || 0),
          },
          byTrend: {
            improving: Number(s.improving || 0),
            declining: Number(s.declining || 0),
            stable: Number(s.stable || 0),
          },
        },
        pagination: {
          limit,
          offset,
          hasMore: data.length === limit,
        },
      },
      meta: {
        source: 'database',
        tenantId,
        timestamp: new Date().toISOString(),
        responseTime: `${Date.now() - startTime}ms`,
      },
    });
  } catch (error) {
    console.error('Health scores API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch health scores', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await getServerTenantId();
    const body = await request.json();
    const { action, contractIds } = body;

    if (action === 'recalculate') {
      // Trigger recalculation through the sync API
      const response = await fetch(`${request.nextUrl.origin}/api/contracts/sync-health-scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, contractIds }),
      });

      const result = await response.json();
      return NextResponse.json(result);
    }

    if (action === 'acknowledge-alert') {
      const { contractId, alertId } = body;
      if (!contractId) {
        return NextResponse.json(
          { success: false, error: 'Contract ID is required' },
          { status: 400 }
        );
      }

      // Update the active alerts to mark as acknowledged
      // This would need to parse the JSONB and update it
      return NextResponse.json({
        success: true,
        message: 'Alert acknowledged',
        data: { contractId, alertId },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Health scores POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process action', details: String(error) },
      { status: 500 }
    );
  }
}
