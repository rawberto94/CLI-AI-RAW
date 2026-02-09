import { NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';
import { rateCardExtractionService, rateCardManagementService } from 'data-orchestration/services';

/**
 * Rate card artifact data types
 */
interface RateCardArtifactData {
  rates?: RateData[];
  rateCards?: RateData[];
}

interface RateData {
  roleOriginal?: string;
  role?: string;
  position?: string;
  roleStandardized?: string;
  roleCategory?: string;
  category?: string;
  seniority?: string;
  dailyRate?: number;
  rate?: number;
  dailyRateUSD?: number;
  dailyRateCHF?: number;
  currency?: string;
  country?: string;
  region?: string;
  lineOfService?: string;
  supplierTier?: string;
  supplierCountry?: string;
  supplierRegion?: string;
  effectiveDate?: string | Date;
  volumeCommitted?: number;
  quantity?: number;
}

interface ImportError {
  rate?: string;
  artifactId?: string;
  error: string;
}

// Using singleton prisma instance from @/lib/prisma

/**
 * POST /api/rate-cards/import/from-contracts
 * Extract rate cards from contract artifacts
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
    const { contractId, tenantId } = await request.json();

    if (!contractId || !tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Contract ID and Tenant ID are required', 400)
    }

    // Look up contract with rate artifacts
    const contract = await prisma.contract.findFirst({
      where: {
        tenantId,
        id: contractId,
      },
      include: {
        artifacts: {
          where: {
            type: 'RATES',
          },
        },
      },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404)
    }

    // Extract rate card data from artifacts
    const rateCardArtifacts = contract.artifacts;
    const importedRates: Array<{ id: string; roleStandardized: string | null }> = [];
    const errors: ImportError[] = [];

    for (const artifact of rateCardArtifacts) {
      try {
        const rateCardData = artifact.data as RateCardArtifactData;
        
        // Handle different artifact data structures
        const rates = Array.isArray(rateCardData.rates) 
          ? rateCardData.rates 
          : rateCardData.rateCards || [];

        for (const rate of rates) {
          try {
            // Map seniority to valid enum value
            const seniorityMap: Record<string, 'JUNIOR' | 'MID' | 'SENIOR' | 'PRINCIPAL' | 'PARTNER'> = {
              'JUNIOR': 'JUNIOR',
              'MID': 'MID',
              'SENIOR': 'SENIOR',
              'PRINCIPAL': 'PRINCIPAL',
              'PARTNER': 'PARTNER',
            };
            const seniority = seniorityMap[rate.seniority?.toUpperCase()] || 'MID';
            
            // Map supplier tier to valid enum value
            const tierMap: Record<string, 'BIG_4' | 'TIER_2' | 'BOUTIQUE' | 'OFFSHORE'> = {
              'BIG_4': 'BIG_4',
              'TIER_2': 'TIER_2',
              'BOUTIQUE': 'BOUTIQUE',
              'OFFSHORE': 'OFFSHORE',
            };
            const supplierTier = tierMap[rate.supplierTier?.toUpperCase()] || 'TIER_2';
            
            // Create rate card entry
            const rateCardEntry = await prisma.rateCardEntry.create({
              data: {
                tenantId,
                contractId: contract.id,
                roleOriginal: rate.roleOriginal || rate.role || rate.position,
                roleStandardized: rate.roleStandardized || rate.role || rate.position,
                roleCategory: rate.roleCategory || rate.category || 'Professional Services',
                seniority,
                dailyRate: rate.dailyRate || rate.rate || 0,
                dailyRateUSD: rate.dailyRateUSD || rate.dailyRate || rate.rate || 0,
                dailyRateCHF: rate.dailyRateCHF || rate.dailyRateUSD || rate.dailyRate || rate.rate || 0,
                currency: rate.currency || contract.currency || 'USD',
                country: rate.country || 'United States',
                region: rate.region || 'North America',
                lineOfService: rate.lineOfService || rate.category || 'Professional Services',
                supplierId: contract.supplierId || 'unknown',
                supplierName: contract.supplierName || 'Unknown Supplier',
                supplierTier,
                supplierCountry: rate.supplierCountry || 'United States',
                supplierRegion: rate.supplierRegion || 'North America',
                effectiveDate: rate.effectiveDate 
                  ? new Date(rate.effectiveDate) 
                  : contract.startDate || new Date(),
                source: 'PDF_EXTRACTION',
                confidence: artifact.confidence || 0.85,
                dataQuality: 'MEDIUM',
                volumeCommitted: rate.volumeCommitted || rate.quantity || 1,
                isNegotiated: true,
              }
            });

            importedRates.push(rateCardEntry);
          } catch (rateError: unknown) {
            errors.push({
              rate: rate.roleOriginal || rate.role,
              error: rateError instanceof Error ? rateError.message : 'Unknown error'
            });
          }
        }
      } catch (artifactError: unknown) {
        errors.push({
          artifactId: artifact.id,
          error: artifactError instanceof Error ? artifactError.message : 'Unknown error'
        });
      }
    }

    return createSuccessResponse(ctx, {
      success: true,
      imported: importedRates.length,
      errors: errors.length,
      data: {
        rateCards: importedRates,
        errors
      }
    });

  });
