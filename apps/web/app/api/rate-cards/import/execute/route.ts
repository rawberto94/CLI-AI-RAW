/**
 * CSV Import Execute API
 * POST /api/rate-cards/import/execute
 * Executes batch import of validated rate cards
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateCardEvents, roleStandardizationService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import {
  UNKNOWN_CURRENCY,
  convertedDailyRates,
  resolvePersistCurrency,
  resolvePersistGeo,
} from '@/lib/rate-cards/persist-fields';

export const POST = withAuthApiHandler(async (request, ctx) => {    const tenantId = ctx.tenantId;
    const userId = ctx.userId;
    
    const body = await request.json();

    const { rows } = body;

    if (!rows || !Array.isArray(rows)) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid request. Expected rows array.', 400);
    }

    const results = {
      imported: 0,
      failed: 0,
      errors: [] as { rowIndex: number; rowNumber?: number; role?: string; error: string }[],
      rateCardIds: [] as string[],
    };

    interface ImportRow {
      index?: number;
      rowNumber?: number;
      data: {
        roleStandardized?: string;
        roleOriginal: string;
        lineOfService?: string;
        seniority?: string;
        supplierName: string;

        supplierTier?: string;
        supplierCountry?: string;

        roleCategory?: string;

        dailyRate: number;
        currency: string;
        country?: string;
        region?: string;
        city?: string;

        effectiveDate: string;
        expiryDate?: string | null;

        skills?: string[];
        certifications?: string[];
        isNegotiated?: boolean;
        negotiationNotes?: string;
      };
    }

    // Process in batches to avoid overwhelming the database
    const BATCH_SIZE = 50;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      
      await Promise.all(
        batch.map(async (row: ImportRow) => {
          try {
            const data = row.data;

            // Standardize role if not provided
            let roleStandardized = data.roleStandardized;
            if (!roleStandardized) {
              const standardization = await roleStandardizationService.standardizeRole(
                data.roleOriginal,
                tenantId,
                {
                  lineOfService: data.lineOfService,
                  seniority: data.seniority,
                }
              );
              roleStandardized = standardization.standardized;
            }

            // Get or create supplier
            let supplier = await prisma.rateCardSupplier.findFirst({
              where: {
                tenantId,
                name: data.supplierName,
              },
            });

            if (!supplier) {
              supplier = await prisma.rateCardSupplier.create({
                data: {
                  tenantId,
                  name: data.supplierName,
                  legalName: data.supplierName,
                  tier: (data.supplierTier || 'TIER_2') as 'BIG_4' | 'TIER_2' | 'BOUTIQUE' | 'OFFSHORE',
                  country: resolvePersistGeo(data.supplierCountry, data.country),
                  region: resolvePersistGeo(data.region),
                },
              });
            }

            const currency = resolvePersistCurrency(data.currency);
            if (currency === UNKNOWN_CURRENCY) {
              throw new Error('Missing currency — not imported as USD');
            }
            const converted = convertedDailyRates(Number(data.dailyRate), currency);

            // Create rate card entry
            const rateCard = await prisma.rateCardEntry.create({
              data: {
                tenantId,
                source: 'CSV_UPLOAD',
                enteredBy: userId,

                // Supplier
                supplierId: supplier.id,
                supplierName: supplier.name,
                supplierTier: supplier.tier,
                supplierCountry: supplier.country,
                supplierRegion: supplier.region,

                // Role
                roleOriginal: data.roleOriginal,
                roleStandardized,
                roleCategory: data.roleCategory || 'General',
                seniority: data.seniority as 'JUNIOR' | 'MID' | 'SENIOR' | 'PRINCIPAL' | 'PARTNER',
                lineOfService: data.lineOfService || 'General',
                subCategory: null,

                // Rate
                dailyRate: data.dailyRate,
                currency,
                dailyRateUSD: converted.usd,
                dailyRateCHF: converted.chf,

                // Geography
                country: resolvePersistGeo(data.country, data.supplierCountry),
                region: resolvePersistGeo(data.region),
                city: data.city || null,
                remoteAllowed: false,

                // Contract context
                contractType: 'RATE_CARD',
                effectiveDate: new Date(data.effectiveDate),
                expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,

                // Quality
                confidence: 0.9,
                dataQuality: 'HIGH',

                // Additional
                skills: data.skills || [],
                certifications: data.certifications || [],
                additionalInfo: {
                  isNegotiated: data.isNegotiated,
                  negotiationNotes: data.negotiationNotes,
                  importedFrom: 'CSV',
                  importedAt: new Date().toISOString(),
                },
              },
            });

            results.imported++;
            results.rateCardIds.push(rateCard.id);
          } catch (error) {
            results.failed++;
            results.errors.push({
              rowIndex: typeof row.index === 'number' ? row.index : 0,
              rowNumber: row.rowNumber ?? row.index,
              role: row.data.roleOriginal,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        })
      );
    }

    // Emit event for bulk import
    if (results.imported > 0) {
      await rateCardEvents.imported(results.imported, tenantId, 'CSV_IMPORT');
    }

    return createSuccessResponse(ctx, {
      success: true,
      imported: results.imported,
      failed: results.failed,
      rateCardIds: results.rateCardIds,
      errors: results.errors,
      message: `Successfully imported ${results.imported} rate cards${
        results.failed > 0 ? ` (${results.failed} failed)` : ''
      }`,
    });
  });
