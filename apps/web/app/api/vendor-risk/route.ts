import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Vendor Risk Profiles API
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const riskTier = searchParams.get('riskTier');
    const { prisma } = await import('@/lib/prisma');

    const where: any = { tenantId: ctx.tenantId };
    if (riskTier) where.riskTier = riskTier;

    const [profiles, allProfiles] = await Promise.all([
      prisma.vendorRiskProfile.findMany({ where, orderBy: { overallScore: 'desc' } }),
      prisma.vendorRiskProfile.findMany({
        where: { tenantId: ctx.tenantId },
        select: { riskTier: true, overallScore: true, nextAssessmentDue: true },
      }),
    ]);

    const now = new Date();
    const metrics = {
      total: allProfiles.length,
      high_risk: allProfiles.filter(p => p.riskTier === 'HIGH').length,
      medium_risk: allProfiles.filter(p => p.riskTier === 'MEDIUM').length,
      low_risk: allProfiles.filter(p => p.riskTier === 'LOW').length,
      avg_score: allProfiles.length > 0 ? Math.round(allProfiles.reduce((s, p) => s + p.overallScore, 0) / allProfiles.length) : 0,
      overdue: allProfiles.filter(p => p.nextAssessmentDue && p.nextAssessmentDue < now).length,
    };

    return createSuccessResponse(ctx, { profiles, metrics });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch vendor risk profiles', 500);
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

    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + 90);

    const profile = await prisma.vendorRiskProfile.create({
      data: {
        tenantId: ctx.tenantId,
        vendorName: body.vendorName,
        vendorId: body.vendorId || null,
        riskTier,
        overallScore,
        financialRisk: body.financialRisk || 50,
        operationalRisk: body.operationalRisk || 50,
        complianceRisk: body.complianceRisk || 50,
        cyberRisk: body.cyberRisk || 50,
        geopoliticalRisk: body.geopoliticalRisk || 50,
        questionnaireResponses: body.questionnaireResponses || {},
        certifications: body.certifications || [],
        insuranceDetails: body.insuranceDetails || {},
        notes: body.notes || null,
        assessedBy: ctx.userId,
        lastAssessmentDate: new Date(),
        nextAssessmentDue: nextDue,
      },
    });

    return createSuccessResponse(ctx, { profile }, { status: 201 });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to create risk profile', 500);
  }
});
