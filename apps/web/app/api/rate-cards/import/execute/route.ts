/**
 * CSV Import Execute API
 * POST /api/rate-cards/import/execute
 * Executes batch import of validated rate cards
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { roleStandardizationService } from '@/packages/data-orchestration/src/services/role-standardization.service';

export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id') || 'default-tenant';
    const userId = request.headers.get('x-user-id') || 'system';
    const body = await request.json();

    const { rows } = body;

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json(
        { error: 'Invalid request. Expected rows array.' },
        { status: 400 }
      );
    }

    console.log(`📥 Starting batch import of ${rows.length} rate cards`);

    const results = {
      imported: 0,
      failed: 0,
      errors: [] as any[],
      rateCardIds: [] as string[],
    };

    // Process in batches to avoid overwhelming the database
    const BATCH_SIZE = 50;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      
      await Promise.all(
        batch.map(async (row: any) => {
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
            let supplier = await (prisma as any).rateCardSupplier.findFirst({
              where: {
                tenantId,
                name: data.supplierName,
              },
            });

            if (!supplier) {
              supplier = await (prisma as any).rateCardSupplier.create({
                data: {
                  tenantId,
                  name: data.supplierName,
                  legalName: data.supplierName,
                  tier: data.supplierTier || 'TIER_2',
                  country: data.supplierCountry || data.country,
                  region: data.region || 'Americas',
                },
              });
            }

            // Convert currency
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

            const converted = convertCurrency(data.dailyRate, data.currency);

            // Create rate card entry
            const rateCard = await (prisma as any).rateCardEntry.create({
              data: {
                tenantId,
                source: 'CSV_IMPORT',
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
                seniority: data.seniority,
                lineOfService: data.lineOfService || 'General',
                subCategory: null,

                // Rate
                dailyRate: data.dailyRate,
                currency: data.currency,
                dailyRateUSD: converted.usd,
                dailyRateCHF: converted.chf,

                // Geography
                country: data.country,
                region: data.region,
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
            console.log(`✅ Imported: ${rateCard.roleStandardized} - ${rateCard.dailyRate} ${rateCard.currency}`);
          } catch (error) {
            results.failed++;
            results.errors.push({
              row: row.rowNumber,
              role: row.data.roleOriginal,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            console.error(`❌ Failed to import row ${row.rowNumber}:`, error);
          }
        })
      );
    }

    console.log(`✅ Import complete: ${results.imported} imported, ${results.failed} failed`);

    // Emit event for bulk import
    if (results.imported > 0) {
      const { rateCardEvents } = await import('@/../../packages/data-orchestration/src/services/event-integration.helper');
      await rateCardEvents.imported(results.imported, tenantId, 'CSV_IMPORT');
    }

    return NextResponse.json({
      success: true,
      imported: results.imported,
      failed: results.failed,
      rateCardIds: results.rateCardIds,
      errors: results.errors,
      message: `Successfully imported ${results.imported} rate cards${
        results.failed > 0 ? ` (${results.failed} failed)` : ''
      }`,
    });
  } catch (error) {
    console.error('Error executing import:', error);
    return NextResponse.json(
      {
        error: 'Failed to execute import',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
