/**
 * Rate Card Bulk Import API
 * 
 * POST /api/rate-cards/import - Bulk import rate card entries from wizard
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerTenantId } from '@/lib/tenant-server';
import { Prisma } from '@prisma/client';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { rateCardManagementService } from 'data-orchestration/services';

export const dynamic = 'force-dynamic';

interface RateCardImportEntry {
  roleTitle: string;
  level?: string | null;
  rateType: string;
  minRate: number;
  maxRate: number;
  currency: string;
  region?: string | null;
  skillCategory?: string | null;
  effectiveDate?: string | null;
  expirationDate?: string | null;
}

interface ImportRequest {
  entries: RateCardImportEntry[];
  source?: string;
  metadata?: Record<string, unknown>;
}

export const POST = withAuthApiHandler(async (request, ctx) => {
    const tenantId = await getServerTenantId();
    const body: ImportRequest = await request.json();

    if (!body.entries || !Array.isArray(body.entries) || body.entries.length === 0) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'No entries provided', 400)
    }

    const source = body.source || 'IMPORT_WIZARD';
    const now = new Date();

    // Map seniority from level - using valid SeniorityLevel enum values
    const mapSeniority = (level?: string | null): 'JUNIOR' | 'MID' | 'SENIOR' | 'PRINCIPAL' | 'PARTNER' => {
      if (!level) return 'MID';
      const levelLower = level.toLowerCase();
      if (levelLower.includes('junior') || levelLower.includes('entry') || levelLower.includes('1')) return 'JUNIOR';
      if (levelLower.includes('mid') || levelLower.includes('2') || levelLower.includes('3')) return 'MID';
      if (levelLower.includes('senior') || levelLower.includes('sr') || levelLower.includes('4') || levelLower.includes('5')) return 'SENIOR';
      if (levelLower.includes('lead') || levelLower.includes('principal') || levelLower.includes('6')) return 'PRINCIPAL';
      if (levelLower.includes('architect') || levelLower.includes('director') || levelLower.includes('manager') || levelLower.includes('partner')) return 'PARTNER';
      return 'MID';
    };

    // Map region from country/region string
    const mapRegion = (region?: string | null): string => {
      if (!region) return 'NOT_SPECIFIED';
      const regionLower = region.toLowerCase();
      
      // Americas
      if (['us', 'usa', 'united states', 'canada', 'mexico', 'brazil'].some(c => regionLower.includes(c))) {
        return 'AMERICAS';
      }
      // EMEA
      if (['uk', 'united kingdom', 'germany', 'france', 'europe', 'emea', 'middle east', 'africa', 'netherlands', 'spain', 'italy', 'switzerland'].some(c => regionLower.includes(c))) {
        return 'EMEA';
      }
      // APAC
      if (['asia', 'pacific', 'apac', 'india', 'japan', 'china', 'australia', 'singapore', 'korea'].some(c => regionLower.includes(c))) {
        return 'APAC';
      }
      // LATAM
      if (['latin', 'latam', 'south america', 'argentina', 'chile', 'colombia', 'peru'].some(c => regionLower.includes(c))) {
        return 'LATAM';
      }
      
      return region.toUpperCase().replace(/\s+/g, '_').slice(0, 50);
    };

    // Convert hourly/monthly rates to daily
    const toDailyRate = (rate: number, rateType: string): number => {
      switch (rateType.toUpperCase()) {
        case 'HOURLY': return rate * 8;
        case 'MONTHLY': return rate / 22;
        case 'YEARLY':
        case 'ANNUAL': return rate / 260;
        default: return rate; // Assume daily
      }
    };

    // Prepare batch insert
    const rateCardEntries = body.entries.map((entry) => {
      const avgRate = (entry.minRate + entry.maxRate) / 2;
      const dailyRate = toDailyRate(avgRate, entry.rateType);
      // Could use for rate range: toDailyRate(entry.minRate, entry.rateType), toDailyRate(entry.maxRate, entry.rateType)

      return {
        tenantId,
        roleOriginal: entry.roleTitle,
        roleStandardized: entry.roleTitle.trim(),
        roleCategory: entry.skillCategory || 'Professional Services',
        seniority: mapSeniority(entry.level),
        dailyRate: dailyRate,
        dailyRateUSD: dailyRate, // Assume USD for now, could add currency conversion
        dailyRateCHF: dailyRate * 0.88, // Approximate conversion
        currency: entry.currency || 'USD',
        country: entry.region || 'NOT_SPECIFIED',
        region: mapRegion(entry.region),
        lineOfService: entry.skillCategory || 'Professional Services',
        supplierId: `import-${Date.now()}`,
        supplierName: source,
        supplierTier: 'TIER_2' as const,
        supplierCountry: entry.region || 'NOT_SPECIFIED',
        supplierRegion: mapRegion(entry.region),
        effectiveDate: entry.effectiveDate ? new Date(entry.effectiveDate) : now,
        expiryDate: entry.expirationDate ? new Date(entry.expirationDate) : null,
        source: 'CSV_UPLOAD' as const, // Use valid RateCardSource enum value
        confidence: 0.9,
        dataQuality: 'MEDIUM' as const,
        volumeCommitted: 1,
        isNegotiated: false,
        // Store original rate info in additionalInfo field
        additionalInfo: entry.rateType !== 'DAILY' 
          ? { originalRate: `${entry.rateType} ${entry.minRate}-${entry.maxRate}` }
          : undefined,
      };
    });

    // Create rate card entries in batch
    const result = await prisma.rateCardEntry.createMany({
      data: rateCardEntries,
      skipDuplicates: true,
    });

    // Log the import
    // Rate card import completed successfully

    // Track import in audit/analytics if table exists
    try {
      await prisma.auditLog.create({
        data: {
          tenantId,
          action: 'RATE_CARD_IMPORT',
          entityType: 'RATE_CARD',
          entityId: `import-${Date.now()}`,
          userId: 'system',
          metadata: {
            entriesSubmitted: body.entries.length,
            entriesCreated: result.count,
            source,
            fileName: body.metadata?.fileName as string | undefined,
          } as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Audit log table may not exist, continue
    }

    return createSuccessResponse(ctx, {
      success: true,
      data: {
        entriesCreated: result.count,
        entriesSubmitted: body.entries.length,
        skipped: body.entries.length - result.count,
        source,
      },
    });

  });
