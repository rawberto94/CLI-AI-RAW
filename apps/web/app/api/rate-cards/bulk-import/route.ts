/**
 * Bulk Import API
 * Processes bulk rate card imports with multi-currency conversion
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { records } = await request.json();

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No records provided' },
        { status: 400 }
      );
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ row: number; field: string; message: string }>,
    };

    // Get tenantId from request
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID required' },
        { status: 400 }
      );
    }

    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      try {
        // Find or create supplier (tenant-scoped)
        let supplier = await db.supplier.findFirst({
          where: { name: record.supplierName, tenantId },
        });

        if (!supplier) {
          supplier = await db.supplier.create({
            data: {
              name: record.supplierName,
              country: record.location || 'US',
              contactEmail: '',
            },
          });
        }

        // Create rate card
        await db.rateCard.create({
          data: {
            supplierId: supplier.id,
            roleName: record.roleName,
            roleStandardized: record.roleName,
            seniority: record.seniority,
            dailyRate: record.dailyRate, // Already converted to USD
            currency: 'USD', // Store in USD
            skills: record.skills || [],
            location: record.location || '',
            startDate: record.startDate ? new Date(record.startDate) : new Date(),
            endDate: record.endDate ? new Date(record.endDate) : null,
            notes: record.notes || '',
            source: 'BULK_IMPORT',
          },
        });

        results.success++;
      } catch (error) {
        console.error(`Error importing record ${i}:`, error);
        results.failed++;
        results.errors.push({
          row: i + 2,
          field: 'import',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process bulk import',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
