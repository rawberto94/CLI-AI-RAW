/**
 * Best Rates API
 * 
 * Endpoints for retrieving best (lowest) rates across all role-geography combinations
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateCardBenchmarkingService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

/**
 * GET /api/rate-cards/best-rates
 * Get all best rates for the tenant
 * 
 * Query params:
 * - role: Filter by role (optional)
 * - country: Filter by country (optional)
 * - seniority: Filter by seniority (optional)
 * - lineOfService: Filter by line of service (optional)
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
    if (!ctx.tenantId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const country = searchParams.get('country');
    const seniority = searchParams.get('seniority');
    const lineOfService = searchParams.get('lineOfService');

    const benchmarkEngine = new rateCardBenchmarkingService(prisma);

    // If specific criteria provided, get single best rate
    if (role && country && seniority) {
      const bestRate = await benchmarkEngine.getBestRate({
        roleStandardized: role,
        seniority,
        country,
        lineOfService: lineOfService || undefined,
        tenantId: ctx.tenantId,
      });

      return createSuccessResponse(ctx, bestRate);
    }

    // Otherwise get all best rates
    let bestRates = await benchmarkEngine.getAllBestRates(ctx.tenantId);

    // Apply filters if provided
    if (role) {
      bestRates = bestRates.filter(br => 
        br.bestRateEntry.roleOriginal.toLowerCase().includes(role.toLowerCase())
      );
    }

    if (country) {
      bestRates = bestRates.filter(br => br.bestRateEntry.country === country);
    }

    if (seniority) {
      bestRates = bestRates.filter(br => 
        br.bestRateEntry.roleOriginal.includes(seniority)
      );
    }

    if (lineOfService) {
      bestRates = bestRates.filter(br => br.bestRateEntry.lineOfService === lineOfService);
    }

    // Sort by best rate (lowest first)
    bestRates.sort((a, b) => a.bestRate - b.bestRate);

    return createSuccessResponse(ctx, {
      bestRates,
      total: bestRates.length,
    });
  });
