import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Vendor Risk Profiles API
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const riskTier = searchParams.get('riskTier');
    const { prisma } = await import('@/lib/prisma');

    const where = riskTier
      ? `WHERE tenant_id = $1 AND risk_tier = $2`
      : `WHERE tenant_id = $1`;
    const queryParams: unknown[] = riskTier ? [ctx.tenantId, riskTier] : [ctx.tenantId];

    const [items, metrics] = await Promise.all([
      prisma.$queryRawUnsafe(`SELECT * FROM vendor_risk_profiles ${where} ORDER BY overall_score DESC`, ...queryParams),
      prisma.$queryRawUnsafe(`SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER(WHERE risk_tier = 'HIGH')::int as high_risk,
        COUNT(*) FILTER(WHERE risk_tier = 'MEDIUM')::int as medium_risk,
        COUNT(*) FILTER(WHERE risk_tier = 'LOW')::int as low_risk,
        AVG(overall_score)::int as avg_score,
        COUNT(*) FILTER(WHERE next_assessment_due < NOW())::int as overdue
      FROM vendor_risk_profiles WHERE tenant_id = $1`, ctx.tenantId),
    ]);

    return createSuccessResponse(ctx, { profiles: items, metrics: (metrics as any[])[0] });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to fetch vendor risk profiles: ${error.message}`, 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');

    const weights = { financial: 0.25, operational: 0.25, compliance: 0.2, cyber: 0.2, geopolitical: 0.1 };
    const overallScore = Math.round(
      (body.financialRisk || 50) * weights.financial + (body.operationalRisk || 50) * weights.operational +
      (body.complianceRisk || 50) * weights.compliance + (body.cyberRisk || 50) * weights.cyber +
      (body.geopoliticalRisk || 50) * weights.geopolitical
    );
    const riskTier = overallScore >= 70 ? 'HIGH' : overallScore >= 40 ? 'MEDIUM' : 'LOW';

    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO vendor_risk_profiles (id, tenant_id, vendor_name, vendor_id, risk_tier, overall_score, financial_risk, operational_risk, compliance_risk, cyber_risk, geopolitical_risk, questionnaire_responses, certifications, insurance_details, notes, assessed_by, last_assessment_date, next_assessment_due)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW() + INTERVAL '90 days') RETURNING *`,
      ctx.tenantId, body.vendorName, body.vendorId || null, riskTier, overallScore,
      body.financialRisk || 50, body.operationalRisk || 50,
      body.complianceRisk || 50, body.cyberRisk || 50, body.geopoliticalRisk || 50,
      JSON.stringify(body.questionnaireResponses || {}),
      JSON.stringify(body.certifications || []),
      JSON.stringify(body.insuranceDetails || {}),
      body.notes || null, ctx.userId
    );

    return createSuccessResponse(ctx, { profile: (result as any[])[0] });
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to create risk profile: ${error.message}`, 500);
  }
});
