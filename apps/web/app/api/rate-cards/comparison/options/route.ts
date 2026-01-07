/**
 * Comparison Options API
 * Returns available suppliers and roles for comparison filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
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

    return NextResponse.json({
      success: true,
      suppliers: suppliers.map((s) => s.name),
      roles,
    });
  } catch (error) {
    console.error('Error fetching comparison options:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch options',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
