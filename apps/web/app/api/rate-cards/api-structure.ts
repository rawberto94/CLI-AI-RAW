/**
 * Rate Card Benchmarking API
 * Comprehensive API for managing rate cards, benchmarking, and market intelligence
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// ============================================================================
// Schemas & Types
// ============================================================================

export const RateCardEntrySchema = z.object({
  // Source
  source: z.enum(['PDF_EXTRACTION', 'MANUAL', 'CSV_UPLOAD', 'API', 'EMAIL']),
  contractId: z.string().optional(),
  importJobId: z.string().optional(),

  // Supplier
  supplierId: z.string().optional(), // Auto-create if not exists
  supplierName: z.string(),
  supplierTier: z.enum(['BIG_4', 'TIER_2', 'BOUTIQUE', 'OFFSHORE']),
  supplierCountry: z.string(),
  supplierRegion: z.string(),

  // Role
  roleOriginal: z.string(),
  roleStandardized: z.string().optional(), // AI will suggest
  roleCategory: z.string(),
  seniority: z.enum(['JUNIOR', 'MID', 'SENIOR', 'PRINCIPAL', 'PARTNER']),
  lineOfService: z.string(),
  subCategory: z.string().optional(),

  // Rate
  dailyRate: z.number().positive(),
  currency: z.string().length(3), // ISO code

  // Geography
  country: z.string(),
  region: z.string(),
  city: z.string().optional(),
  remoteAllowed: z.boolean().default(false),

  // Contract Context
  contractType: z.string().optional(),
  effectiveDate: z.string().datetime(),
  expiryDate: z.string().datetime().optional(),
  contractValue: z.number().optional(),
  volumeCommitted: z.number().int().positive().optional(),

  // Additional
  isNegotiated: z.boolean().default(false),
  negotiationNotes: z.string().optional(),
  additionalInfo: z.record(z.any()).optional(),
  skills: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
});

export type RateCardEntryInput = z.infer<typeof RateCardEntrySchema>;

export const BulkUploadSchema = z.object({
  entries: z.array(RateCardEntrySchema),
  validateOnly: z.boolean().default(false),
  skipDuplicates: z.boolean().default(true),
});

export const BenchmarkQuerySchema = z.object({
  roleStandardized: z.string().optional(),
  seniority: z.enum(['JUNIOR', 'MID', 'SENIOR', 'PRINCIPAL', 'PARTNER']).optional(),
  country: z.string().optional(),
  lineOfService: z.string().optional(),
  periodMonths: z.number().int().positive().default(12),
});

export const CompareRatesSchema = z.object({
  rateIds: z.array(z.string()).min(2),
  comparisonType: z.enum(['SUPPLIER_VS_SUPPLIER', 'YEAR_OVER_YEAR', 'ROLE_VS_ROLE', 'REGION_VS_REGION', 'CUSTOM']),
  comparisonName: z.string().optional(),
});

// ============================================================================
// API Route Handlers
// ============================================================================

/**
 * POST /api/rate-cards
 * Create a new rate card entry
 */
export async function createRateCard(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = RateCardEntrySchema.parse(body);

    // 1. Get or create supplier
    const supplier = await getOrCreateSupplier({
      name: validated.supplierName,
      tier: validated.supplierTier,
      country: validated.supplierCountry,
      region: validated.supplierRegion,
    });

    // 2. Standardize role using AI if not provided
    const roleStandardized = validated.roleStandardized || 
      await standardizeRole(validated.roleOriginal);

    // 3. Convert to base currencies
    const { dailyRateUSD, dailyRateCHF } = await convertCurrency(
      validated.dailyRate,
      validated.currency
    );

    // 4. Create rate card entry
    const rateCard = await prisma.rateCardEntry.create({
      data: {
        ...validated,
        supplierId: supplier.id,
        roleStandardized,
        dailyRateUSD,
        dailyRateCHF,
        confidence: 0.95, // High confidence for manual entry
        dataQuality: 'HIGH',
      },
    });

    // 5. Trigger benchmark calculation (async)
    await triggerBenchmarkCalculation(rateCard.id);

    // 6. Check for savings opportunities
    await detectSavingsOpportunities(rateCard.id);

    return NextResponse.json({
      success: true,
      data: rateCard,
      message: 'Rate card created successfully',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}

/**
 * POST /api/rate-cards/bulk
 * Bulk import rate cards from CSV
 */
export async function bulkImportRateCards(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = BulkUploadSchema.parse(body);

    // 1. Validate all entries
    const validationResults = await Promise.all(
      validated.entries.map(async (entry, index) => {
        const errors = await validateRateCardEntry(entry);
        return { index, entry, errors };
      })
    );

    const hasErrors = validationResults.some(r => r.errors.length > 0);

    if (validated.validateOnly || hasErrors) {
      return NextResponse.json({
        success: !hasErrors,
        validationResults,
        message: hasErrors ? 'Validation errors found' : 'Validation successful',
      });
    }

    // 2. Process imports
    const results = await Promise.all(
      validated.entries.map(async (entry) => {
        try {
          // Check for duplicates
          const duplicate = await findDuplicateRate(entry);
          if (duplicate && validated.skipDuplicates) {
            return { success: false, reason: 'duplicate', entry };
          }

          // Create entry
          const rateCard = await createRateCardFromInput(entry);
          return { success: true, data: rateCard };
        } catch (error) {
          return { success: false, reason: 'error', error: error.message, entry };
        }
      })
    );

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    // 3. Trigger bulk benchmark calculation
    const successfulIds = results
      .filter(r => r.success)
      .map(r => r.data.id);
    
    await triggerBulkBenchmarking(successfulIds);

    return NextResponse.json({
      success: true,
      summary: {
        total: validated.entries.length,
        successful,
        failed,
        skipped: results.filter(r => r.reason === 'duplicate').length,
      },
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}

/**
 * POST /api/rate-cards/extract/:contractId
 * Extract rate cards from contract PDF
 */
export async function extractRateCardsFromContract(
  req: NextRequest,
  { params }: { params: { contractId: string } }
) {
  try {
    const { contractId } = params;

    // 1. Get contract
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { supplier: true, client: true },
    });

    if (!contract) {
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      );
    }

    // 2. Extract rate cards using AI
    const extractedRates = await extractRateCardsWithAI(contract);

    // 3. Auto-create entries with confidence scores
    const rateCards = await Promise.all(
      extractedRates.rates.map(async (rate) => {
        const supplier = await getOrCreateSupplier({
          name: contract.supplierName || rate.supplierName,
          tier: rate.tier || 'TIER_2',
          country: rate.country || 'US',
          region: rate.region || 'Americas',
        });

        return await prisma.rateCardEntry.create({
          data: {
            source: 'PDF_EXTRACTION',
            contractId: contract.id,
            supplierId: supplier.id,
            supplierName: supplier.name,
            supplierTier: supplier.tier,
            supplierCountry: supplier.country,
            supplierRegion: supplier.region,
            roleOriginal: rate.role,
            roleStandardized: await standardizeRole(rate.role),
            roleCategory: rate.category || 'Technology',
            seniority: rate.seniority,
            lineOfService: rate.lineOfService || 'Consulting',
            dailyRate: rate.dailyRate,
            currency: rate.currency || 'USD',
            dailyRateUSD: await convertToUSD(rate.dailyRate, rate.currency),
            dailyRateCHF: await convertToCHF(rate.dailyRate, rate.currency),
            country: rate.country || contract.jurisdiction || 'US',
            region: rate.region || 'Americas',
            effectiveDate: contract.startDate || new Date(),
            expiryDate: contract.endDate,
            confidence: rate.confidence,
            dataQuality: rate.confidence > 0.8 ? 'HIGH' : 'MEDIUM',
            additionalInfo: rate.additionalInfo,
          },
        });
      })
    );

    // 4. Trigger benchmarking
    await triggerBulkBenchmarking(rateCards.map(r => r.id));

    return NextResponse.json({
      success: true,
      data: {
        extracted: extractedRates.rates.length,
        created: rateCards.length,
        confidence: extractedRates.overallConfidence,
        rateCards,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/rate-cards/:id/benchmark
 * Get rate card with benchmark data
 */
export async function getRateCardWithBenchmark(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Get rate card
    const rateCard = await prisma.rateCardEntry.findUnique({
      where: { id },
      include: {
        supplier: true,
        contract: true,
      },
    });

    if (!rateCard) {
      return NextResponse.json(
        { success: false, error: 'Rate card not found' },
        { status: 404 }
      );
    }

    // Get latest benchmark snapshot
    const benchmark = await prisma.benchmarkSnapshot.findFirst({
      where: { rateCardEntryId: id },
      orderBy: { snapshotDate: 'desc' },
    });

    // Get savings opportunities
    const opportunities = await prisma.rateSavingsOpportunity.findMany({
      where: { 
        rateCardEntryId: id,
        status: { not: 'REJECTED' },
      },
      orderBy: { annualSavings: 'desc' },
    });

    // Calculate market position
    const marketIntelligence = await getMarketIntelligence({
      roleStandardized: rateCard.roleStandardized,
      seniority: rateCard.seniority,
      country: rateCard.country,
      lineOfService: rateCard.lineOfService,
    });

    return NextResponse.json({
      success: true,
      data: {
        rateCard,
        benchmark,
        opportunities,
        marketIntelligence,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/benchmarking/market
 * Get market intelligence for specific criteria
 */
export async function getMarketIntelligenceAPI(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = BenchmarkQuerySchema.parse({
      roleStandardized: searchParams.get('role'),
      seniority: searchParams.get('seniority'),
      country: searchParams.get('country'),
      lineOfService: searchParams.get('lineOfService'),
      periodMonths: parseInt(searchParams.get('periodMonths') || '12'),
    });

    const intelligence = await calculateMarketIntelligence(query);

    return NextResponse.json({
      success: true,
      data: intelligence,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}

/**
 * POST /api/benchmarking/compare
 * Compare multiple rates
 */
export async function compareRates(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = CompareRatesSchema.parse(body);

    // Get all rates
    const rates = await prisma.rateCardEntry.findMany({
      where: { id: { in: validated.rateIds } },
      include: {
        supplier: true,
        benchmarkSnapshot: {
          take: 1,
          orderBy: { snapshotDate: 'desc' },
        },
      },
    });

    // Perform comparison analysis
    const comparison = await analyzeRateComparison(rates, validated.comparisonType);

    // Save comparison
    const savedComparison = await prisma.rateComparison.create({
      data: {
        tenantId: rates[0].tenantId,
        comparisonName: validated.comparisonName || `Comparison ${new Date().toISOString()}`,
        comparisonType: validated.comparisonType,
        createdBy: req.headers.get('user-id') || 'system',
        targetRateId: validated.rateIds[0],
        comparisonRates: validated.rateIds,
        results: comparison.analysis,
        summary: comparison.summary,
        recommendations: comparison.recommendations,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        comparison: savedComparison,
        analysis: comparison,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}

/**
 * GET /api/opportunities
 * Get savings opportunities
 */
export async function getSavingsOpportunities(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    const status = searchParams.get('status') || undefined;
    const minSavings = parseFloat(searchParams.get('minSavings') || '0');
    const sortBy = searchParams.get('sortBy') || 'annualSavings';

    const opportunities = await prisma.rateSavingsOpportunity.findMany({
      where: {
        status: status as any,
        annualSavings: { gte: minSavings },
      },
      include: {
        rateCardEntry: {
          include: { supplier: true },
        },
      },
      orderBy: { [sortBy]: 'desc' },
      take: 100,
    });

    // Calculate summary stats
    const summary = {
      total: opportunities.length,
      totalSavings: opportunities.reduce((sum, o) => sum + Number(o.annualSavings), 0),
      byStatus: groupBy(opportunities, 'status'),
      byCategory: groupBy(opportunities, 'category'),
      avgSavings: opportunities.length > 0 
        ? opportunities.reduce((sum, o) => sum + Number(o.annualSavings), 0) / opportunities.length 
        : 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        opportunities,
        summary,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/suppliers/:id/benchmark
 * Get supplier benchmark
 */
export async function getSupplierBenchmark(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(req.url);
    const periodMonths = parseInt(searchParams.get('periodMonths') || '12');

    const supplier = await prisma.rateCardSupplier.findUnique({
      where: { id },
      include: {
        rateCards: {
          where: {
            effectiveDate: {
              gte: new Date(Date.now() - periodMonths * 30 * 24 * 60 * 60 * 1000),
            },
          },
          include: {
            benchmarkSnapshot: {
              take: 1,
              orderBy: { snapshotDate: 'desc' },
            },
          },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json(
        { success: false, error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Calculate comprehensive benchmark
    const benchmark = await calculateSupplierBenchmark(supplier, periodMonths);

    return NextResponse.json({
      success: true,
      data: {
        supplier,
        benchmark,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

async function standardizeRole(roleOriginal: string): Promise<string> {
  // Use AI to standardize role names
  // This could use GPT-4 or a fine-tuned model
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a role standardization expert. Convert job titles to standardized formats.',
      },
      {
        role: 'user',
        content: `Standardize this role: "${roleOriginal}". Return only the standardized name.`,
      },
    ],
  });

  return response.choices[0].message.content?.trim() || roleOriginal;
}

async function convertCurrency(amount: number, from: string) {
  // Use real-time FX API
  const rates = await fetchExchangeRates(from);
  return {
    dailyRateUSD: amount * rates.USD,
    dailyRateCHF: amount * rates.CHF,
  };
}

async function triggerBenchmarkCalculation(rateCardId: string) {
  // Queue background job for benchmark calculation
  await queueJob({
    type: 'CALCULATE_BENCHMARK',
    data: { rateCardId },
  });
}

async function detectSavingsOpportunities(rateCardId: string) {
  // Queue background job to detect savings opportunities
  await queueJob({
    type: 'DETECT_SAVINGS',
    data: { rateCardId },
  });
}

function groupBy(arr: any[], key: string) {
  return arr.reduce((acc, item) => {
    const group = item[key];
    acc[group] = (acc[group] || 0) + 1;
    return acc;
  }, {});
}

// Export all handlers
export const RateCardAPI = {
  createRateCard,
  bulkImportRateCards,
  extractRateCardsFromContract,
  getRateCardWithBenchmark,
  getMarketIntelligenceAPI,
  compareRates,
  getSavingsOpportunities,
  getSupplierBenchmark,
};
