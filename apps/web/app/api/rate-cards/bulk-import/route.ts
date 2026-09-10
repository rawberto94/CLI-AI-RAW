/**
 * Bulk Import API
 * Processes bulk rate card imports with multi-currency conversion
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import {
  UNKNOWN_CURRENCY,
  convertedDailyRates,
  resolvePersistCurrency,
  resolvePersistGeo,
} from '@/lib/rate-cards/persist-fields';

export const POST = withAuthApiHandler(async (request, ctx) => {
    const { records } = await request.json();

    if (!records || !Array.isArray(records) || records.length === 0) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'No records provided', 400)
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ row: number; field: string; message: string }>,
    };

    // Get tenantId from request
    const tenantId = ctx.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400)
    }

    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      try {
        const amount = Number(record.dailyRate)
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error('Missing rate amount')
        }
        const currency = resolvePersistCurrency(record.currency)
        if (currency === UNKNOWN_CURRENCY) {
          throw new Error('Missing currency — not imported as USD')
        }
        const converted = convertedDailyRates(amount, currency)
        const country = resolvePersistGeo(record.location, record.country)
        const region = resolvePersistGeo(record.region)

        // Upsert supplier (tenant-scoped) to avoid race conditions on concurrent imports
        const supplier = await db.rateCardSupplier.upsert({
          where: { tenantId_name: { tenantId, name: record.supplierName } },
          update: {},
          create: {
            tenantId,
            name: record.supplierName,
            tier: 'TIER_2',
            country,
            region,
          },
        });

        await db.rateCardEntry.create({
          data: {
            tenantId,
            supplierId: supplier.id,
            supplierName: record.supplierName,
            supplierTier: 'TIER_2',
            supplierCountry: country,
            supplierRegion: region,
            roleOriginal: record.roleName,
            roleStandardized: record.roleName,
            roleCategory: 'Professional Services',
            seniority: 'MID',
            lineOfService: 'Professional Services',
            dailyRate: amount,
            currency,
            dailyRateUSD: converted.usd,
            dailyRateCHF: converted.chf,
            country,
            region,
            effectiveDate: record.startDate ? new Date(record.startDate) : new Date(),
            expiryDate: record.endDate ? new Date(record.endDate) : null,
            source: 'CSV_UPLOAD',
            confidence: record.confidence ?? 1.0,
            dataQuality: 'HIGH',
          },
        });

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: i + 2,
          field: 'import',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return createSuccessResponse(ctx, {
      ...results,
    });
  });
