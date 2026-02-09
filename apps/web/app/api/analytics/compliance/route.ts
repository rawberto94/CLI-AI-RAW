import { NextRequest } from 'next/server';
import { analyticalIntelligenceService } from "@/lib/services/analytical-intelligence.service";
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const contractId = searchParams.get("contractId");
  const tenantId = ctx.tenantId;

  const complianceEngine =
    analyticalIntelligenceService.getComplianceEngine();

  switch (action) {
    case "scan":
      if (!contractId) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID required', 400);
      }
      const scanResult = await complianceEngine.scanContract(contractId);
      return createSuccessResponse(ctx, scanResult);

    case "report":
      const filters = {
        tenantId,
        supplierId: searchParams.get("supplierId") || undefined,
        riskLevel: searchParams.get("riskLevel") || undefined,
        clauseType: searchParams.get("clauseType") || undefined,
        dateRange:
          searchParams.get("startDate") && searchParams.get("endDate")
            ? {
                start: new Date(searchParams.get("startDate")!),
                end: new Date(searchParams.get("endDate")!),
              }
            : undefined,
      };
      const report = await complianceEngine.generateComplianceReport(filters);
      return createSuccessResponse(ctx, report);

    default:
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const body = await request.json();
  const { action, policies, complianceResult } = body;

  const complianceEngine =
    analyticalIntelligenceService.getComplianceEngine();

  switch (action) {
    case "update-policies":
      if (!policies) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Policies required', 400);
      }
      await complianceEngine.updatePolicies(policies);
      return createSuccessResponse(ctx, { updated: true });

    case "recommend-remediation":
      if (!complianceResult) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Compliance result required', 400);
      }
      const remediationPlan = await complianceEngine.recommendRemediation(
        complianceResult
      );
      return createSuccessResponse(ctx, remediationPlan);

    default:
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
  }
});
