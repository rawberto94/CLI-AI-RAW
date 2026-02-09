/**
 * Bulk Import API
 * Processes bulk rate card imports with multi-currency conversion
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

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
        // Find or create supplier (tenant-scoped)
        let supplier = await db.rateCardSupplier.findFirst({
          where: { name: record.supplierName, tenantId },
        });

        if (!supplier) {
          supplier = await db.rateCardSupplier.create({
            data: {
              tenantId,
              name: record.supplierName,
              tier: 'TIER_2',
              country: record.location || 'US',
              region: 'North America',
            },
          });
        }

        // Create rate card entry
        await db.rateCardEntry.create({
          data: {
            tenantId,
            supplierId: supplier.id,
            supplierName: record.supplierName,
            supplierTier: 'TIER_2',
            supplierCountry: record.location || 'US',
            supplierRegion: 'North America',
            roleOriginal: record.roleName,
            roleStandardized: record.roleName,
            roleCategory: 'Professional Services',
            seniority: 'MID',
            lineOfService: 'Professional Services',
            dailyRate: record.dailyRate, // Already converted to USD
            currency: 'USD', // Store in USD
            dailyRateUSD: record.dailyRate,
            dailyRateCHF: record.dailyRate,
            country: record.location || 'US',
            region: 'North America',
            effectiveDate: record.startDate ? new Date(record.startDate) : new Date(),
            expiryDate: record.endDate ? new Date(record.endDate) : null,
            source: 'CSV_UPLOAD',
            confidence: 1.0,
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
      success: true,
      ...results,
    });
  });
