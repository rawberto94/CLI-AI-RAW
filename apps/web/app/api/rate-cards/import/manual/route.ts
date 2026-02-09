import { NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';
import { rateCardEntryService, rateCardManagementService } from 'data-orchestration/services';

// Using singleton prisma instance from @/lib/prisma

/**
 * POST /api/rate-cards/import/manual
 * Create a single rate card entry manually
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
    const data = await request.json();
    const { tenantId, ...rateCardData } = data;

    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400)
    }

    // Validate required fields
    const requiredFields = ['roleStandardized', 'seniority', 'dailyRateUSD', 'currency', 'country'];
    const missingFields = requiredFields.filter(field => !rateCardData[field]);

    if (missingFields.length > 0) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', `Missing required fields: ${missingFields.join(', 400)
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

    return createSuccessResponse(ctx, {
      success: true,
      data: rateCardEntry
    });

  });
