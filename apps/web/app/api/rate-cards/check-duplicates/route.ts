/**
 * Duplicate Detection API
 * POST /api/rate-cards/check-duplicates
 * Checks for similar existing rate card entries
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }
    
    const body = await request.json();

    const { roleStandardized, supplierName, seniority, country } = body;

    if (!roleStandardized || !supplierName) {
      return NextResponse.json(
        { error: 'roleStandardized and supplierName are required' },
        { status: 400 }
      );
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

    return NextResponse.json({
      hasDuplicates,
      count: similarEntries.length,
      similar: similarEntries,
      message: hasDuplicates
        ? `Found ${similarEntries.length} similar rate card(s)`
        : 'No duplicates found',
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: 'Failed to check duplicates',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
