/**
 * Rate Card Extraction API
 * POST /api/rate-cards/extract/[contractId]
 * Extracts rate cards from a contract using AI
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateCardExtractionService } from 'data-orchestration/services';
import { roleStandardizationService } from 'data-orchestration/services';

export async function POST(request: NextRequest, props: { params: Promise<{ contractId: string }> }) {
  const params = await props.params;
  try {
    const { contractId } = params;

    // Get tenant ID from header
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id') || 'system';

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    // Validate contract exists and has text - scoped to tenant
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: {
        id: true,
        rawText: true,
        supplierName: true,
        fileName: true,
        tenantId: true,
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      );
    }

    if (!contract.rawText) {
      return NextResponse.json(
        { error: 'Contract has no text content. Please ensure the contract has been processed.' },
        { status: 400 }
      );
    }

    // Check tenant access
    if (contract.tenantId !== tenantId) {
      return NextResponse.json(
        { error: 'Unauthorized access to contract' },
        { status: 403 }
      );
    }

    // Extract rate cards using AI
    const extractionResult = await rateCardExtractionService.extractFromContract(
      contractId,
      contract.rawText
    );

    // Validate extraction
    const validation = await rateCardExtractionService.validateExtraction(
      extractionResult
    );

    // Standardize roles for each extracted rate
    const enrichedRates = await Promise.all(
      extractionResult.rates.map(async (rate) => {
        try {
          const standardization = await roleStandardizationService.standardizeRole(
            rate.roleOriginal,
            tenantId,
            {
              industry: extractionResult.supplierInfo.tier,
              lineOfService: rate.lineOfService,
              seniority: rate.seniority,
            }
          );

          return {
            ...rate,
            roleStandardized: standardization.standardized,
            roleCategory: standardization.category,
            roleSubCategory: standardization.subCategory,
            standardizationConfidence: standardization.confidence,
          };
        } catch {
          return {
            ...rate,
            roleStandardized: rate.roleOriginal,
            roleCategory: 'General',
            standardizationConfidence: 0.5,
          };
        }
      })
    );

    // Return extraction results for preview
    const response = {
      success: true,
      contractId,
      contractName: contract.fileName,
      extraction: {
        rates: enrichedRates,
        supplierInfo: extractionResult.supplierInfo,
        contractContext: extractionResult.contractContext,
        confidence: extractionResult.confidence,
        warnings: extractionResult.warnings,
        metadata: extractionResult.metadata,
      },
      validation: {
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings,
        suggestions: validation.suggestions,
      },
      summary: {
        totalRates: enrichedRates.length,
        highConfidence: enrichedRates.filter((r) => r.confidence >= 0.8).length,
        mediumConfidence: enrichedRates.filter(
          (r) => r.confidence >= 0.5 && r.confidence < 0.8
        ).length,
        lowConfidence: enrichedRates.filter((r) => r.confidence < 0.5).length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to extract rate cards',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/rate-cards/extract/[contractId]
 * Check if rate cards have already been extracted for this contract
 */
export async function GET(request: NextRequest, props: { params: Promise<{ contractId: string }> }) {
  const params = await props.params;
  try {
    const { contractId } = params;
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    // Check if rate cards already exist for this contract
    const existingRateCards = await prisma.rateCardEntry.findMany({
      where: {
        contractId,
        tenantId,
      },
      select: {
        id: true,
        roleStandardized: true,
        dailyRate: true,
        currency: true,
        supplierName: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      hasExistingRateCards: existingRateCards.length > 0,
      count: existingRateCards.length,
      rateCards: existingRateCards,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: 'Failed to check existing rate cards',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
