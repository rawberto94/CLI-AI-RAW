/**
 * Save Extracted Rate Cards API
 * POST /api/rate-cards/extract/[contractId]/save
 * Saves reviewed and edited rate cards to the database
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { rateCardExtractionService } from 'data-orchestration/services';

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

export async function POST(request: NextRequest, props: { params: Promise<{ contractId: string }> }) {
  const params = await props.params;
    const ctx = getApiContext(request);
try {    const tenantId = ctx.tenantId;
    const userId = ctx.userId;
    const { contractId } = params;

    const body: SaveRateCardRequest = await _request.json();

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
      const supplierCountry = body.supplierInfo.country || 'United States';
      const region = countryToRegion[supplierCountry] || 'Americas';

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

    // Convert currency for each rate
    const convertCurrency = (amount: number, currency: string) => {
      const rates: Record<string, { usd: number; chf: number }> = {
        USD: { usd: 1.0, chf: 0.88 },
        EUR: { usd: 1.08, chf: 0.95 },
        GBP: { usd: 1.27, chf: 1.12 },
        CHF: { usd: 1.14, chf: 1.0 },
        CAD: { usd: 0.72, chf: 0.63 },
        AUD: { usd: 0.65, chf: 0.57 },
        INR: { usd: 0.012, chf: 0.011 },
      };
      const rate = rates[currency.toUpperCase()] ?? rates['USD']!;
      return {
        usd: amount * rate.usd,
        chf: amount * rate.chf,
      };
    };

    // Save each rate card
    const savedRateCards = [];
    const errors = [];

    for (const rate of body.rates) {
      try {
        const converted = convertCurrency(rate.dailyRate, rate.currency);

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
            dailyRateUSD: converted.usd,
            dailyRateCHF: converted.chf,

            // Geography
            country: rate.location || supplier.country,
            region: supplier.region,
            city: null,
            remoteAllowed: false,

            // Contract context
            contractType: body.contractContext.contractType || 'SOW',
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

    // Trigger benchmark calculations in background (fire and forget)
    if (savedRateCards.length > 0) {
      Promise.all(
        savedRateCards.map((rc) =>
          fetch(`${_request.nextUrl.origin}/api/rate-cards/${rc.id}/benchmark`, {
            method: 'POST',
            headers: {
              'x-tenant-id': tenantId,
            },
          }).catch(() => { /* Benchmark calculation failed silently */ })
        )
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
}
