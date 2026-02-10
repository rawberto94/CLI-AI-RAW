import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Rate Card Compliance API — cross-reference contract rates against rate card baselines
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';
    const { prisma } = await import('@/lib/prisma');

    if (type === 'overview') {
      // Get compliance summary across all active contracts vs rate cards
      const contracts = await prisma.contract.findMany({
        where: { tenantId: ctx.tenantId, status: { in: ['ACTIVE', 'IN_REVIEW'] } },
        select: {
          id: true,
          contractTitle: true,
          supplierName: true,
          totalValue: true,
          currency: true,
          metadata: true,
          extractedData: true,
        },
      });

      const rateCards = await prisma.rateCard.findMany({
        where: { tenantId: ctx.tenantId },
        select: { id: true, name: true, data: true, metadata: true },
      });

      // Compute compliance metrics
      let compliant = 0;
      let nonCompliant = 0;
      let unmatched = 0;
      const violations: any[] = [];

      for (const contract of contracts) {
        const extracted = (contract.extractedData as any) || {};
        const contractRates = extracted.rates || extracted.pricing || [];

        if (!Array.isArray(contractRates) || contractRates.length === 0) {
          unmatched++;
          continue;
        }

        let hasViolation = false;
        for (const rate of contractRates) {
          // Find matching rate card
          for (const rc of rateCards) {
            const rcData = (rc.data as any) || {};
            const baselineRates = rcData.rates || rcData.items || [];
            if (!Array.isArray(baselineRates)) continue;

            const match = baselineRates.find((br: any) =>
              br.role?.toLowerCase() === rate.role?.toLowerCase() ||
              br.category?.toLowerCase() === rate.category?.toLowerCase() ||
              br.description?.toLowerCase() === rate.description?.toLowerCase()
            );

            if (match && rate.amount && match.rate) {
              const variance = ((rate.amount - match.rate) / match.rate) * 100;
              if (Math.abs(variance) > 10) { // > 10% deviation
                hasViolation = true;
                violations.push({
                  contractId: contract.id,
                  contractTitle: contract.contractTitle,
                  supplierName: contract.supplierName,
                  rateCardId: rc.id,
                  rateCardName: rc.name,
                  role: rate.role || rate.category || rate.description,
                  contractRate: rate.amount,
                  baselineRate: match.rate,
                  variance: Math.round(variance * 100) / 100,
                  severity: Math.abs(variance) > 25 ? 'HIGH' : 'MEDIUM',
                  currency: contract.currency || 'USD',
                });
              }
            }
          }
        }
        if (hasViolation) nonCompliant++;
        else compliant++;
      }

      return createSuccessResponse(ctx, {
        summary: {
          totalContracts: contracts.length,
          compliant,
          nonCompliant,
          unmatched,
          complianceRate: contracts.length > 0 ? Math.round((compliant / (contracts.length - unmatched || 1)) * 100) : 100,
          totalViolations: violations.length,
          highSeverity: violations.filter(v => v.severity === 'HIGH').length,
        },
        violations: violations.slice(0, 50),
        rateCardCount: rateCards.length,
      });
    }

    if (type === 'by-supplier') {
      // Group rate compliance by supplier
      const contracts = await prisma.contract.findMany({
        where: { tenantId: ctx.tenantId, status: 'ACTIVE', supplierName: { not: null } },
        select: { id: true, supplierName: true, totalValue: true, extractedData: true },
      });

      const supplierMap: Record<string, { contracts: number; totalValue: number; supplierName: string }> = {};
      for (const c of contracts) {
        const key = c.supplierName || 'Unknown';
        if (!supplierMap[key]) supplierMap[key] = { contracts: 0, totalValue: 0, supplierName: key };
        supplierMap[key].contracts++;
        supplierMap[key].totalValue += Number(c.totalValue || 0);
      }

      return createSuccessResponse(ctx, {
        suppliers: Object.values(supplierMap).sort((a, b) => b.totalValue - a.totalValue),
      });
    }

    return createErrorResponse(ctx, 'VALIDATION_ERROR', `Unknown type: ${type}`, 400);
  } catch (error: any) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', error.message, 500);
  }
});
