import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { contractService } from 'data-orchestration/services';
// TODO: Migrate $executeRaw/$queryRaw calls to contractService when raw query support is added
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

/**
 * POST /api/contracts/sync-health-scores
 * Calculates and syncs health scores for all contracts using raw SQL
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
  const startTime = Date.now();
  
  try {
    const tenantId = ctx.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }
    
    // Get contracts with artifacts - use raw SQL to avoid enum issues
    const contracts = await prisma.contract.findMany({
      where: { 
        tenantId, 
        isDeleted: false,
        status: { notIn: ['PROCESSING', 'FAILED', 'DELETED'] }
      },
      select: {
        id: true,
        tenantId: true,
        contractTitle: true,
        status: true,
        totalValue: true,
        expirationDate: true,
        endDate: true,
        artifacts: { select: { type: true, data: true } },
        contractMetadata: { select: { riskScore: true, complianceStatus: true, dataQualityScore: true } }
      }
    });

    const now = new Date();
    const results = { synced: 0, errors: 0 };

    for (const contract of contracts) {
      try {
        const artifacts = contract.artifacts || [];
        const metadata = contract.contractMetadata;
        
        // Calculate scores
        const scores = { risk: 70, compliance: 70, financial: 70, operational: 70, renewalReadiness: 50, documentQuality: 50 };
        const factors: Array<{ name: string; score: number; weight: number }> = [];
        const strengths: string[] = [];
        const weaknesses: string[] = [];
        const opportunities: string[] = [];

        // Risk Score
        const riskArtifact = artifacts.find(a => a.type === 'RISK');
        if (riskArtifact) {
          const riskData = riskArtifact.data as any;
          const overallRisk = riskData?.overallRiskLevel || 'MEDIUM';
          scores.risk = overallRisk === 'LOW' ? 85 : (overallRisk === 'HIGH' ? 40 : 65);
          if (overallRisk === 'LOW') strengths.push('Low overall risk profile');
          else if (overallRisk === 'HIGH') weaknesses.push('High risk factors identified');
          factors.push({ name: 'Risk Analysis', score: scores.risk, weight: 0.25 });
        }

        // Compliance Score
        const complianceArtifact = artifacts.find(a => a.type === 'COMPLIANCE');
        if (complianceArtifact) {
          const complianceData = complianceArtifact.data as any;
          scores.compliance = complianceData?.complianceScore || 70;
          if (scores.compliance >= 80) strengths.push('Strong compliance posture');
          else if (scores.compliance < 60) { weaknesses.push('Compliance gaps detected'); opportunities.push('Review compliance issues'); }
          factors.push({ name: 'Compliance Analysis', score: scores.compliance, weight: 0.20 });
        } else if (metadata?.complianceStatus) {
          scores.compliance = metadata.complianceStatus === 'compliant' ? 90 : metadata.complianceStatus === 'non-compliant' ? 30 : 60;
          factors.push({ name: 'Compliance Status', score: scores.compliance, weight: 0.20 });
        }

        // Document Quality
        const artifactCount = artifacts.length;
        const hasOverview = artifacts.some(a => a.type === 'OVERVIEW');
        scores.documentQuality = Math.min(100, 20 + (artifactCount * 15) + (hasOverview ? 20 : 0));
        if (hasOverview) strengths.push('Complete contract analysis available');
        factors.push({ name: 'Document Completeness', score: scores.documentQuality, weight: 0.10 });

        // Renewal Readiness
        const expirationDate = contract.expirationDate || contract.endDate;
        if (expirationDate) {
          const daysUntilExpiry = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysUntilExpiry < 0) { scores.renewalReadiness = 0; weaknesses.push('Contract has expired'); }
          else if (daysUntilExpiry <= 30) { scores.renewalReadiness = 30; weaknesses.push('Urgent: expires within 30 days'); }
          else if (daysUntilExpiry <= 60) { scores.renewalReadiness = 50; opportunities.push('Begin renewal process soon'); }
          else if (daysUntilExpiry <= 90) { scores.renewalReadiness = 70; opportunities.push('Plan for upcoming renewal'); }
          else { scores.renewalReadiness = 90; strengths.push('Adequate time for renewal planning'); }
          factors.push({ name: 'Renewal Timeline', score: scores.renewalReadiness, weight: 0.10 });
        }

        // Calculate overall score
        const overallScore = Math.round(
          scores.risk * 0.25 + scores.compliance * 0.20 + scores.financial * 0.20 +
          scores.operational * 0.15 + scores.renewalReadiness * 0.10 + scores.documentQuality * 0.10
        );

        // Alert level
        const alertLevel = overallScore < 40 ? 'critical' : overallScore < 55 ? 'high' : overallScore < 70 ? 'medium' : overallScore < 85 ? 'low' : 'none';
        const activeAlerts: Array<{ type: string; message: string; severity: string }> = [];
        if (scores.risk < 50) activeAlerts.push({ type: 'RISK', message: 'High risk detected', severity: 'high' });
        if (scores.compliance < 60) activeAlerts.push({ type: 'COMPLIANCE', message: 'Compliance issues', severity: 'medium' });
        if (scores.renewalReadiness < 50) activeAlerts.push({ type: 'RENEWAL', message: 'Renewal attention needed', severity: 'medium' });

        const id = `hs_${contract.id}`;

        // Upsert health score using raw SQL
        await prisma.$executeRaw`
          INSERT INTO contract_health_scores (
            id, contract_id, tenant_id, overall_score, risk_score, compliance_score,
            financial_score, operational_score, renewal_readiness, document_quality,
            factors, strengths, weaknesses, opportunities, score_change, trend_direction,
            trend_history, alert_level, active_alerts, alert_count, calculated_at, created_at, updated_at
          ) VALUES (
            ${id}, ${contract.id}, ${contract.tenantId}, ${overallScore}, ${scores.risk}, ${scores.compliance},
            ${scores.financial}, ${scores.operational}, ${scores.renewalReadiness}, ${scores.documentQuality},
            ${JSON.stringify(factors)}::jsonb, ${JSON.stringify(strengths)}::jsonb, 
            ${JSON.stringify(weaknesses)}::jsonb, ${JSON.stringify(opportunities)}::jsonb,
            0, 'stable', '[]'::jsonb, ${alertLevel}, ${JSON.stringify(activeAlerts)}::jsonb, 
            ${activeAlerts.length}, ${now}, ${now}, ${now}
          )
          ON CONFLICT (contract_id) DO UPDATE SET
            overall_score = EXCLUDED.overall_score,
            risk_score = EXCLUDED.risk_score,
            compliance_score = EXCLUDED.compliance_score,
            financial_score = EXCLUDED.financial_score,
            operational_score = EXCLUDED.operational_score,
            renewal_readiness = EXCLUDED.renewal_readiness,
            document_quality = EXCLUDED.document_quality,
            factors = EXCLUDED.factors,
            strengths = EXCLUDED.strengths,
            weaknesses = EXCLUDED.weaknesses,
            opportunities = EXCLUDED.opportunities,
            previous_score = contract_health_scores.overall_score,
            score_change = EXCLUDED.overall_score - contract_health_scores.overall_score,
            trend_direction = CASE 
              WHEN EXCLUDED.overall_score - contract_health_scores.overall_score > 5 THEN 'improving'
              WHEN EXCLUDED.overall_score - contract_health_scores.overall_score < -5 THEN 'declining'
              ELSE 'stable' END,
            alert_level = EXCLUDED.alert_level,
            active_alerts = EXCLUDED.active_alerts,
            alert_count = EXCLUDED.alert_count,
            calculated_at = ${now},
            updated_at = ${now}
        `;

        results.synced++;
      } catch {
        results.errors++;
      }
    }

    return createSuccessResponse(ctx, {
      message: 'Health score sync completed',
      totalContracts: contracts.length, ...results, duration: `${Date.now() - startTime}ms`
    });

  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
});

/**
 * GET /api/contracts/sync-health-scores - Returns health score statistics
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
  }

  const stats = await prisma.$queryRaw<Array<{
    total: bigint; avg_overall: number; avg_risk: number; avg_compliance: number;
    critical_count: bigint; high_count: bigint; medium_count: bigint; healthy_count: bigint;
  }>>`
    SELECT 
      COUNT(*) as total,
      AVG(overall_score) as avg_overall,
      AVG(risk_score) as avg_risk,
      AVG(compliance_score) as avg_compliance,
      COUNT(*) FILTER (WHERE alert_level = 'critical') as critical_count,
      COUNT(*) FILTER (WHERE alert_level = 'high') as high_count,
      COUNT(*) FILTER (WHERE alert_level = 'medium') as medium_count,
      COUNT(*) FILTER (WHERE alert_level IN ('low', 'none')) as healthy_count
    FROM contract_health_scores WHERE tenant_id = ${tenantId}
  `;

  const s = stats[0] || { total: 0n, avg_overall: 0, avg_risk: 0, avg_compliance: 0, critical_count: 0n, high_count: 0n, medium_count: 0n, healthy_count: 0n };

  return createSuccessResponse(ctx, {
    summary: {
      total: Number(s.total),
      averageScore: Math.round(s.avg_overall || 0),
      averageRiskScore: Math.round(s.avg_risk || 0),
      averageComplianceScore: Math.round(s.avg_compliance || 0)
    },
    byAlertLevel: {
      critical: Number(s.critical_count),
      high: Number(s.high_count),
      medium: Number(s.medium_count),
      healthy: Number(s.healthy_count)
    }
  });
});
