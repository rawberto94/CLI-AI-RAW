/**
 * Rate Card Filter Options API
 * 
 * Provides unique values for filter dropdowns
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/rate-cards/filter-options
 * Get unique values for all filterable fields
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Add authentication when next-auth is configured
    const tenantId = 'demo-tenant'; // Default tenant for now

    // Get unique clients
    const clients = await prisma.$queryRaw<Array<{ clientName: string }>>`
      SELECT DISTINCT "clientName"
      FROM "rate_card_entries"
      WHERE "tenantId" = ${tenantId}
        AND "clientName" IS NOT NULL
      ORDER BY "clientName"
    `;

    // Get unique suppliers
    const suppliers = await prisma.$queryRaw<Array<{ supplierName: string }>>`
      SELECT DISTINCT "supplierName"
      FROM "rate_card_entries"
      WHERE "tenantId" = ${tenantId}
      ORDER BY "supplierName"
    `;

    // Get unique lines of service
    const linesOfService = await prisma.$queryRaw<Array<{ lineOfService: string }>>`
      SELECT DISTINCT "lineOfService"
      FROM "rate_card_entries"
      WHERE "tenantId" = ${tenantId}
      ORDER BY "lineOfService"
    `;

    // Get unique countries
    const countries = await prisma.$queryRaw<Array<{ country: string }>>`
      SELECT DISTINCT "country"
      FROM "rate_card_entries"
      WHERE "tenantId" = ${tenantId}
      ORDER BY "country"
    `;

    return NextResponse.json({
      clients: clients.map(c => c.clientName),
      suppliers: suppliers.map(s => s.supplierName),
      linesOfService: linesOfService.map(l => l.lineOfService),
      countries: countries.map(c => c.country),
    });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    return NextResponse.json(
      { error: 'Failed to fetch filter options' },
      { status: 500 }
    );
  }
}
