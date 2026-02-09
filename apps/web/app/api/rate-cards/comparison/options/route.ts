/**
 * Comparison Options API
 * Returns available suppliers and roles for comparison filtering
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

export const GET = withAuthApiHandler(async (request, ctx) => {
    // Get unique suppliers
    const suppliers = await db.rateCardSupplier.findMany({
      select: { name: true },
      distinct: ['name'],
      orderBy: { name: 'asc' },
    });

    // Get unique roles from rate card entries
    const rateCardEntries = await db.rateCardEntry.findMany({
      select: { roleStandardized: true, roleOriginal: true },
      distinct: ['roleStandardized'],
    });

    const roles = [...new Set(rateCardEntries.map((rc) => rc.roleStandardized || rc.roleOriginal))].sort();

    return createSuccessResponse(ctx, {
      success: true,
      suppliers: suppliers.map((s) => s.name),
      roles,
    });
  });
