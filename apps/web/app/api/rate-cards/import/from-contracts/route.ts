import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * POST /api/rate-cards/import/from-contracts
 * Extract rate cards from contract artifacts
 */
export async function POST(request: NextRequest) {
  try {
    const { contractId, tenantId } = await request.json();

    if (!contractId || !tenantId) {
      return NextResponse.json(
        { success: false, error: 'Contract ID and Tenant ID are required' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      );
    }

    // Extract rate card data from artifacts
    const rateCardArtifacts = contract.artifacts;
    const importedRates: any[] = [];
    const errors: any[] = [];

    for (const artifact of rateCardArtifacts) {
      try {
        const rateCardData = artifact.data as any;
        
        // Handle different artifact data structures
        const rates = Array.isArray(rateCardData.rates) 
          ? rateCardData.rates 
          : rateCardData.rateCards || [];

        for (const rate of rates) {
          try {
            // Create rate card entry
            const rateCardEntry = await prisma.rateCardEntry.create({
              data: {
                tenantId,
                contractId: contract.id,
                roleOriginal: rate.roleOriginal || rate.role || rate.position,
                roleStandardized: rate.roleStandardized || rate.role || rate.position,
                roleCategory: rate.roleCategory || rate.category || 'Professional Services',
                seniority: rate.seniority || 'MID',
                dailyRate: rate.dailyRate || rate.rate || 0,
                dailyRateUSD: rate.dailyRateUSD || rate.dailyRate || rate.rate || 0,
                dailyRateCHF: rate.dailyRateCHF || rate.dailyRateUSD || rate.dailyRate || rate.rate || 0,
                currency: rate.currency || contract.currency || 'USD',
                country: rate.country || 'United States',
                region: rate.region || 'North America',
                lineOfService: rate.lineOfService || rate.category || 'Professional Services',
                supplierId: contract.supplierId || 'unknown',
                supplierName: contract.supplierName || 'Unknown Supplier',
                supplierTier: rate.supplierTier || 'TIER_2',
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
          } catch (rateError: any) {
            errors.push({
              rate: rate.roleOriginal || rate.role,
              error: rateError.message
            });
          }
        }
      } catch (artifactError: any) {
        errors.push({
          artifactId: artifact.id,
          error: artifactError.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      imported: importedRates.length,
      errors: errors.length,
      data: {
        rateCards: importedRates,
        errors
      }
    });

  } catch (error: any) {
    console.error('Error importing rate cards from contract:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
