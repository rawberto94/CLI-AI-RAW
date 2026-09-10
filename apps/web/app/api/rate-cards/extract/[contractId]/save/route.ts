/**
 * Save Extracted Rate Cards API
 * POST /api/rate-cards/extract/[contractId]/save
 * Saves reviewed and edited rate cards to the database
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { realTimeBenchmarkService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import {
  UNKNOWN_GEO,
  convertedDailyRates,
  resolvePersistGeo,
} from '@/lib/rate-cards/persist-fields';

interface SaveRateCardRequest {
  rates: Array<{
    roleOriginal: string;
    roleStandardized: string;
    seniority: 'JUNIOR' | 'MID' | 'SENIOR' | 'PRINCIPAL' | 'PARTNER';
    dailyRate: number;
    currency: string;
    location?: string;
    lineOfService?: string;
    skills?: string[];
    certifications?: string[];
    minimumCommitment?: {
      value: number;
      unit: 'hours' | 'days' | 'months';
    };
    volumeDiscount?: string;
    additionalInfo?: Record<string, unknown>;
    confidence: number;
  }>;
  supplierInfo: {
    name: string;
    legalName?: string;
    country?: string;
    tier?: 'BIG_4' | 'TIER_2' | 'BOUTIQUE' | 'OFFSHORE';
  };
  contractContext: {
    effectiveDate?: string;
    expiryDate?: string;
    contractType?: string;
  };
}

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { contractId } = await (ctx as any).params as { contractId: string };

  try {
    const tenantId = ctx.tenantId;
    const userId = ctx.userId;

    const body: SaveRateCardRequest = await request.json();

    // Validate contract exists
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { id: true, tenantId: true },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    // Get or create supplier
    let supplier = await prisma.rateCardSupplier.findFirst({
      where: {
        tenantId,
        name: body.supplierInfo.name,
      },
    });

    if (!supplier) {
      // Map country to region
      const countryToRegion: Record<string, string> = {
        'United States': 'Americas', 'Canada': 'Americas', 'Mexico': 'Americas',
        'Brazil': 'Americas', 'Argentina': 'Americas', 'Chile': 'Americas', 'Colombia': 'Americas',
        'United Kingdom': 'EMEA', 'Germany': 'EMEA', 'France': 'EMEA', 'Netherlands': 'EMEA',
        'Switzerland': 'EMEA', 'Spain': 'EMEA', 'Italy': 'EMEA', 'Belgium': 'EMEA',
        'Sweden': 'EMEA', 'Norway': 'EMEA', 'Denmark': 'EMEA', 'Finland': 'EMEA',
        'Poland': 'EMEA', 'Ireland': 'EMEA', 'Portugal': 'EMEA', 'Austria': 'EMEA',
        'South Africa': 'EMEA', 'UAE': 'EMEA', 'Saudi Arabia': 'EMEA', 'Israel': 'EMEA',
        'India': 'APAC', 'China': 'APAC', 'Japan': 'APAC', 'Australia': 'APAC',
        'Singapore': 'APAC', 'Hong Kong': 'APAC', 'South Korea': 'APAC', 'Taiwan': 'APAC',
        'Malaysia': 'APAC', 'Thailand': 'APAC', 'Indonesia': 'APAC', 'Philippines': 'APAC',
        'Vietnam': 'APAC', 'New Zealand': 'APAC',
      };
      const supplierCountry = resolvePersistGeo(body.supplierInfo.country);
      const region = supplierCountry === UNKNOWN_GEO
        ? UNKNOWN_GEO
        : (countryToRegion[supplierCountry] || UNKNOWN_GEO);

      supplier = await prisma.rateCardSupplier.create({
        data: {
          tenantId,
          name: body.supplierInfo.name,
          legalName: body.supplierInfo.legalName || body.supplierInfo.name,
          tier: body.supplierInfo.tier || 'TIER_2',
          country: supplierCountry,
          region,
        },
      });
    }

    const savedRateCards: Array<{ id: string; [key: string]: unknown }> = [];
    const errors: Array<{ role: string; error: string }> = [];

    for (const rate of body.rates) {
      try {
        const converted = convertedDailyRates(rate.dailyRate, rate.currency);

        const rateCard = await prisma.rateCardEntry.create({
          data: {
            tenantId,
            source: 'PDF_EXTRACTION',
            contractId,
            enteredBy: userId,

            // Supplier
            supplierId: supplier.id,
            supplierName: supplier.name,
            supplierTier: supplier.tier,
            supplierCountry: supplier.country,
            supplierRegion: supplier.region,

            // Role
            roleOriginal: rate.roleOriginal,
            roleStandardized: rate.roleStandardized,
            roleCategory: rate.lineOfService || 'Technology',
            seniority: rate.seniority,
            lineOfService: rate.lineOfService || 'Technology Consulting',
            subCategory: null,

            // Rate
            dailyRate: rate.dailyRate,
            currency: rate.currency,
            // Derived sort/benchmark cache only — source rate is dailyRate + currency.
            dailyRateUSD: converted.usd,
            dailyRateCHF: converted.chf,

            // Geography
            country: rate.location || supplier.country,
            region: supplier.region,
            city: null,
            remoteAllowed: false,

            // Contract context
            contractType: body.contractContext.contractType || null,
            effectiveDate: body.contractContext.effectiveDate
              ? new Date(body.contractContext.effectiveDate)
              : new Date(),
            expiryDate: body.contractContext.expiryDate
              ? new Date(body.contractContext.expiryDate)
              : null,

            // Quality
            confidence: rate.confidence,
            dataQuality:
              rate.confidence > 0.8 ? 'HIGH' : rate.confidence > 0.5 ? 'MEDIUM' : 'LOW',

            // Additional
            skills: rate.skills || [],
            certifications: rate.certifications || [],
            additionalInfo: {
              ...rate.additionalInfo,
              minimumCommitment: rate.minimumCommitment,
              volumeDiscount: rate.volumeDiscount,
            },
          },
        });

        savedRateCards.push(rateCard);
      } catch (error) {
        errors.push({
          role: rate.roleOriginal,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Trigger benchmark recalculation in-process so extracted rates don't depend on a missing HTTP endpoint.
    if (savedRateCards.length > 0) {
      const benchmarkService = new realTimeBenchmarkService(prisma);
      void Promise.allSettled(
        savedRateCards.map((rateCard) => benchmarkService.recalculateBenchmark(rateCard.id))
      );
    }

    return createSuccessResponse(ctx, {
      success: true,
      saved: savedRateCards.length,
      failed: errors.length,
      rateCardIds: savedRateCards.map((rc) => rc.id),
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully saved ${savedRateCards.length} rate cards${
        errors.length > 0 ? ` (${errors.length} failed)` : ''
      }`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to save rate cards: ${message}`, 500);
  }
});
