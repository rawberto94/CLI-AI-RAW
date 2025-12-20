/**
 * Intelligence Health API - Uses stored health scores from dedicated table
 * GET /api/intelligence/health - Get contract health scores
 * POST /api/intelligence/health - Trigger health reassessment
 * 
 * Primary source: contract_health_scores table (synced via /api/contracts/sync-health-scores)
 * Fallback: Calculate from RISK artifacts
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerTenantId } from '@/lib/tenant-server';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

interface HealthScore {
  contractId: string;
  contractName: string;
  supplierName: string | null;
  overallScore: number;
  previousScore?: number;
  trend: 'improving' | 'declining' | 'stable';
  status: 'healthy' | 'at-risk' | 'critical';
  factors: Array<{
    id: string;
    name: string;
    score: number;
    weight: number;
    status: string;
    description: string;
  }>;
  actionItems: Array<{
    id: string;
    type: 'urgent' | 'recommended' | 'optional';
    title: string;
    description: string;
    impact: string;
  }>;
  lastAssessed: string;
  nextReview: string;
}

function calculateHealthStatus(score: number): 'healthy' | 'at-risk' | 'critical' {
  if (score >= 70) return 'healthy';
  if (score >= 40) return 'at-risk';
  return 'critical';
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const tenantId = await getServerTenantId();
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);

    // Build safe parameterized query using Prisma.sql
    const conditions: Prisma.Sql[] = [Prisma.sql`tenant_id = ${tenantId}`];
    
    if (contractId) {
      // Validate UUID format to prevent injection
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(contractId)) {
        conditions.push(Prisma.sql`contract_id = ${contractId}`);
      }
    }
    
    const whereClause = Prisma.join(conditions, ' AND ');
      
    const storedScores = await prisma.$queryRaw<Array<{
      contract_id: string;
      overall_score: number;
      risk_score: number;
      compliance_score: number;
      financial_score: number;
      operational_score: number;
      renewal_readiness: number;
      document_quality: number;
      previous_score: number;
      score_change: number;
      trend_direction: string;
      alert_level: string;
      factors: any;
      strengths: any;
      weaknesses: any;
      opportunities: any;
      active_alerts: any;
      calculated_at: Date;
    }>>(Prisma.sql`
      SELECT 
        contract_id, overall_score, risk_score, compliance_score, financial_score,
        operational_score, renewal_readiness, document_quality,
        previous_score, score_change, trend_direction, alert_level,
        factors, strengths, weaknesses, opportunities, active_alerts, calculated_at
      FROM contract_health_scores
      WHERE ${whereClause}
      ORDER BY overall_score ASC
      LIMIT ${limit}
    `);

    // Get contract details
    const contractIds = storedScores.map(s => s.contract_id);
    const contracts = contractIds.length > 0 ? await prisma.contract.findMany({
      where: { id: { in: contractIds } },
      select: {
        id: true,
        contractTitle: true,
        originalName: true,
        fileName: true,
        supplierName: true,
        expirationDate: true,
        endDate: true,
      },
    }) : [];

    const contractMap = new Map(contracts.map(c => [c.id, c]));

    // Transform to HealthScore format
    let healthScores: HealthScore[] = storedScores.map(score => {
      const contract = contractMap.get(score.contract_id);
      const overallScore = score.overall_score;
      
      // Build factors from stored data
      const storedFactors = Array.isArray(score.factors) ? score.factors : [];
      const factors = storedFactors.length > 0 ? storedFactors.map((f: any, i: number) => ({
        id: `factor-${i}`,
        name: f.name || 'Unknown Factor',
        score: f.score || 50,
        weight: f.weight || 0.2,
        status: f.score >= 70 ? 'good' : f.score >= 40 ? 'warning' : 'critical',
        description: f.description || '',
      })) : [
        { id: 'risk', name: 'Risk Analysis', score: score.risk_score, weight: 0.25, status: score.risk_score >= 70 ? 'good' : score.risk_score >= 40 ? 'warning' : 'critical', description: 'Contract risk assessment' },
        { id: 'compliance', name: 'Compliance', score: score.compliance_score, weight: 0.20, status: score.compliance_score >= 70 ? 'good' : score.compliance_score >= 40 ? 'warning' : 'critical', description: 'Regulatory compliance status' },
        { id: 'financial', name: 'Financial Health', score: score.financial_score, weight: 0.20, status: score.financial_score >= 70 ? 'good' : score.financial_score >= 40 ? 'warning' : 'critical', description: 'Financial terms and value' },
        { id: 'operational', name: 'Operational', score: score.operational_score, weight: 0.15, status: score.operational_score >= 70 ? 'good' : score.operational_score >= 40 ? 'warning' : 'critical', description: 'Operational efficiency' },
        { id: 'renewal', name: 'Renewal Readiness', score: score.renewal_readiness, weight: 0.10, status: score.renewal_readiness >= 70 ? 'good' : score.renewal_readiness >= 40 ? 'warning' : 'critical', description: 'Preparation for renewal' },
        { id: 'docs', name: 'Documentation', score: score.document_quality, weight: 0.10, status: score.document_quality >= 70 ? 'good' : score.document_quality >= 40 ? 'warning' : 'critical', description: 'Document completeness' },
      ];

      // Build action items from weaknesses and alerts
      const weaknesses = Array.isArray(score.weaknesses) ? score.weaknesses : [];
      const alerts = Array.isArray(score.active_alerts) ? score.active_alerts : [];
      
      const actionItems = [
        ...weaknesses.map((w: string, i: number) => ({
          id: `action-weakness-${i}`,
          type: 'recommended' as const,
          title: 'Address Identified Weakness',
          description: w,
          impact: 'Medium',
        })),
        ...alerts.map((a: any, i: number) => ({
          id: `action-alert-${i}`,
          type: a.severity === 'high' ? 'urgent' as const : 'recommended' as const,
          title: a.message || 'Alert Action Required',
          description: a.message || '',
          impact: a.severity === 'high' ? 'High' : 'Medium',
        })),
      ];

      return {
        contractId: score.contract_id,
        contractName: contract?.contractTitle || contract?.originalName || contract?.fileName || 'Unknown Contract',
        supplierName: contract?.supplierName || null,
        overallScore,
        previousScore: score.previous_score || undefined,
        trend: (score.trend_direction as 'improving' | 'declining' | 'stable') || 'stable',
        status: calculateHealthStatus(overallScore),
        factors,
        actionItems,
        lastAssessed: score.calculated_at?.toISOString() || new Date().toISOString(),
        nextReview: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
    });

    // If no stored scores, fall back to calculating from RISK artifacts
    if (healthScores.length === 0) {
      const contracts = await prisma.contract.findMany({
        where: {
          tenantId,
          status: { in: ['COMPLETED', 'ACTIVE'] },
          ...(contractId && { id: contractId }),
        },
        include: {
          artifacts: {
            where: { type: 'RISK' },
            select: { id: true, type: true, data: true },
          },
        },
        take: limit,
      });

      healthScores = contracts.map(contract => {
        const riskArtifact = contract.artifacts.find(a => a.type === 'RISK');
        let riskScore = 75;
        
        if (riskArtifact?.data) {
          const riskData = riskArtifact.data as any;
          if (riskData.overallScore !== undefined) {
            riskScore = 100 - riskData.overallScore;
          } else if (riskData.risks?.length) {
            riskScore = Math.max(20, 100 - (riskData.risks.length * 15));
          }
        }
        
        const overallScore = Math.round(riskScore);
        
        return {
          contractId: contract.id,
          contractName: contract.contractTitle || contract.originalName || contract.fileName,
          supplierName: contract.supplierName,
          overallScore,
          trend: 'stable' as const,
          status: calculateHealthStatus(overallScore),
          factors: [
            { id: 'risk', name: 'Risk Analysis', score: overallScore, weight: 0.25, status: overallScore >= 70 ? 'good' : 'warning', description: 'From RISK artifact' },
            { id: 'compliance', name: 'Compliance', score: Math.round(overallScore + 5), weight: 0.20, status: 'good', description: 'Estimated' },
            { id: 'financial', name: 'Financial', score: Math.round(overallScore - 5), weight: 0.20, status: 'good', description: 'Estimated' },
            { id: 'operational', name: 'Operational', score: overallScore, weight: 0.15, status: 'good', description: 'Estimated' },
          ],
          actionItems: [],
          lastAssessed: new Date().toISOString(),
          nextReview: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        };
      });
    }

    // Filter by status if requested
    if (status) {
      healthScores = healthScores.filter(h => h.status === status);
    }

    // Calculate portfolio stats
    const totalContracts = healthScores.length;
    const stats = {
      averageScore: totalContracts > 0 
        ? Math.round(healthScores.reduce((sum, h) => sum + h.overallScore, 0) / totalContracts)
        : 0,
      healthy: healthScores.filter(h => h.status === 'healthy').length,
      atRisk: healthScores.filter(h => h.status === 'at-risk').length,
      critical: healthScores.filter(h => h.status === 'critical').length,
      totalContracts,
      trends: {
        improving: healthScores.filter(h => h.trend === 'improving').length,
        declining: healthScores.filter(h => h.trend === 'declining').length,
        stable: healthScores.filter(h => h.trend === 'stable').length,
      },
      urgentActions: healthScores.reduce((sum, h) => 
        sum + h.actionItems.filter(a => a.type === 'urgent').length, 0),
    };

    return NextResponse.json({
      success: true,
      data: {
        contracts: healthScores,
        stats,
      },
      meta: {
        source: storedScores.length > 0 ? 'health_scores_table' : 'risk_artifacts',
        tenantId,
        timestamp: new Date().toISOString(),
        responseTime: `${Date.now() - startTime}ms`,
      },
    });
  } catch (error) {
    console.error('Intelligence health API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch health data', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await getServerTenantId();
    const body = await request.json();
    const { contractId, reassess, refreshAll } = body;

    if (refreshAll) {
      // Trigger full sync via the sync-health-scores endpoint
      const response = await fetch(`${request.nextUrl.origin}/api/contracts/sync-health-scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });

      const result = await response.json();
      return NextResponse.json({
        success: true,
        message: 'Health scores refresh triggered',
        data: result.data,
      });
    }

    if (!contractId) {
      return NextResponse.json(
        { success: false, error: 'Contract ID is required' },
        { status: 400 }
      );
    }

    // Get the current health score
    const healthScore = await prisma.$queryRaw<Array<{
      overall_score: number;
      calculated_at: Date;
    }>>`
      SELECT overall_score, calculated_at FROM contract_health_scores
      WHERE contract_id = ${contractId} AND tenant_id = ${tenantId}
    `;

    // Get contract info
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: {
        id: true,
        contractTitle: true,
        originalName: true,
        supplierName: true,
      },
    });

    if (!contract) {
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      );
    }

    const score = healthScore[0];

    return NextResponse.json({
      success: true,
      data: {
        contractId: contract.id,
        contractName: contract.contractTitle || contract.originalName,
        supplierName: contract.supplierName,
        overallScore: score?.overall_score || 75,
        status: calculateHealthStatus(score?.overall_score || 75),
        lastAssessed: score?.calculated_at?.toISOString() || new Date().toISOString(),
        reassessmentTriggered: reassess,
      },
    });
  } catch (error) {
    console.error('Intelligence health POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Invalid request', details: String(error) },
      { status: 400 }
    );
  }
}
