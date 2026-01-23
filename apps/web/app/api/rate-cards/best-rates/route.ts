/**
 * Best Rates API
 * 
 * Endpoints for retrieving best (lowest) rates across all role-geography combinations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

import { prisma } from '@/lib/prisma';
import { rateCardBenchmarkingService } from 'data-orchestration/services';

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
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        tenantId: session.user.tenantId,
      });

      return NextResponse.json(bestRate);
    }

    // Otherwise get all best rates
    let bestRates = await benchmarkEngine.getAllBestRates(session.user.tenantId);

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

    return NextResponse.json({
      bestRates,
      total: bestRates.length,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch best rates' },
      { status: 500 }
    );
  }
}
