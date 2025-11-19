import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";

// Using singleton prisma instance from @/lib/prisma

/**
 * POST /api/rate-cards/import/manual
 * Create a single rate card entry manually
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { tenantId, ...rateCardData } = data;

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    // Validate required fields
    const requiredFields = ['roleStandardized', 'seniority', 'dailyRateUSD', 'currency', 'country'];
    const missingFields = requiredFields.filter(field => !rateCardData[field]);

    if (missingFields.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Missing required fields: ${missingFields.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // Create rate card entry
    const rateCardEntry = await prisma.rateCardEntry.create({
      data: {
        tenantId,
        roleOriginal: rateCardData.roleOriginal || rateCardData.roleStandardized,
        roleStandardized: rateCardData.roleStandardized,
        roleCategory: rateCardData.roleCategory || 'Professional Services',
        seniority: rateCardData.seniority,
        dailyRate: rateCardData.dailyRateUSD,
        dailyRateUSD: rateCardData.dailyRateUSD,
        dailyRateCHF: rateCardData.dailyRateCHF || rateCardData.dailyRateUSD,
        currency: rateCardData.currency,
        country: rateCardData.country,
        region: rateCardData.region || 'Not Specified',
        lineOfService: rateCardData.lineOfService || 'Professional Services',
        supplierId: rateCardData.supplierId || 'manual-entry',
        supplierName: rateCardData.supplierName || 'Direct Entry',
        supplierTier: rateCardData.supplierTier || 'TIER_2',
        supplierCountry: rateCardData.country,
        supplierRegion: rateCardData.region || 'Not Specified',
        effectiveDate: rateCardData.effectiveDate 
          ? new Date(rateCardData.effectiveDate) 
          : new Date(),
        expiryDate: rateCardData.expiryDate 
          ? new Date(rateCardData.expiryDate)
          : null,
        source: 'MANUAL',
        confidence: 1.0,
        dataQuality: 'HIGH',
        volumeCommitted: rateCardData.volumeCommitted || 1,
        isNegotiated: rateCardData.isNegotiated ?? false,
        contractId: rateCardData.contractId || null,
        negotiationNotes: rateCardData.notes || null,
      }
    });

    return NextResponse.json({
      success: true,
      data: rateCardEntry
    });

  } catch (error: any) {
    console.error('Error creating manual rate card entry:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
