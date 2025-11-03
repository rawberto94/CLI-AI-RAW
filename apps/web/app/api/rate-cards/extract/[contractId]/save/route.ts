/**
 * Save Extracted Rate Cards API
 * POST /api/rate-cards/extract/[contractId]/save
 * Saves reviewed and edited rate cards to the database
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
    additionalInfo?: any;
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
  try {
    const { contractId } = params;
    const tenantId = request.headers.get('x-tenant-id') || 'default-tenant';
    const userId = request.headers.get('x-user-id') || 'system';

    const body: SaveRateCardRequest = await request.json();

    // Validate contract exists
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true, tenantId: true },
    });

    if (!contract) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      );
    }

    if (contract.tenantId !== tenantId) {
      return NextResponse.json(
        { error: 'Unauthorized access to contract' },
        { status: 403 }
      );
    }

    console.log(`💾 Saving ${body.rates.length} rate cards for contract ${contractId}`);

    // Get or create supplier
    let supplier = await (prisma as any).rateCardSupplier.findFirst({
      where: {
        tenantId,
        name: body.supplierInfo.name,
      },
    });

    if (!supplier) {
      supplier = await (prisma as any).rateCardSupplier.create({
        data: {
          tenantId,
          name: body.supplierInfo.name,
          legalName: body.supplierInfo.legalName || body.supplierInfo.name,
          tier: body.supplierInfo.tier || 'TIER_2',
          country: body.supplierInfo.country || 'United States',
          region: 'Americas', // TODO: Map from country
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
      const rate = rates[currency.toUpperCase()] || rates['USD'];
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

        const rateCard = await (prisma as any).rateCardEntry.create({
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
        console.log(
          `✅ Saved: ${rateCard.roleStandardized} - ${rateCard.dailyRate} ${rateCard.currency}/day`
        );
      } catch (error) {
        console.error(`❌ Error saving rate card for ${rate.roleOriginal}:`, error);
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
          fetch(`${request.nextUrl.origin}/api/rate-cards/${rc.id}/benchmark`, {
            method: 'POST',
            headers: {
              'x-tenant-id': tenantId,
            },
          }).catch((err) => console.error('Benchmark calculation failed:', err))
        )
      );
    }

    return NextResponse.json({
      success: true,
      saved: savedRateCards.length,
      failed: errors.length,
      rateCardIds: savedRateCards.map((rc) => rc.id),
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully saved ${savedRateCards.length} rate cards${
        errors.length > 0 ? ` (${errors.length} failed)` : ''
      }`,
    });
  } catch (error) {
    console.error('Error saving rate cards:', error);
    return NextResponse.json(
      {
        error: 'Failed to save rate cards',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
