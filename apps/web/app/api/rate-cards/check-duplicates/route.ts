/**
 * Duplicate Detection API
 * POST /api/rate-cards/check-duplicates
 * Checks for similar existing rate card entries
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';
import { rateCardManagementService } from 'data-orchestration/services';

export const POST = withAuthApiHandler(async (request, ctx) => {
    const tenantId = ctx.tenantId;
    
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }
    
    const body = await request.json();

    const { roleStandardized, supplierName, seniority, country } = body;

    if (!roleStandardized || !supplierName) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'roleStandardized and supplierName are required', 400);
    }

    // Find similar entries
    const similarEntries = await prisma.rateCardEntry.findMany({
      where: {
        tenantId,
        roleStandardized: {
          equals: roleStandardized,
          mode: 'insensitive',
        },
        supplierName: {
          equals: supplierName,
          mode: 'insensitive',
        },
        ...(seniority && { seniority }),
        ...(country && { country }),
      },
      select: {
        id: true,
        roleStandardized: true,
        seniority: true,
        dailyRate: true,
        currency: true,
        country: true,
        effectiveDate: true,
        createdAt: true,
      },
      orderBy: {
        effectiveDate: 'desc',
      },
      take: 5,
    });

    const hasDuplicates = similarEntries.length > 0;

    return createSuccessResponse(ctx, {
      hasDuplicates,
      count: similarEntries.length,
      similar: similarEntries,
      message: hasDuplicates
        ? `Found ${similarEntries.length} similar rate card(s)`
        : 'No duplicates found',
    });
  });
