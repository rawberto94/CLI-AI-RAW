import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');

    // Require tenant ID for security
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    // Get total rate cards tracked
    const totalRateCards = await prisma.rateCardEntry.count({
      where: { tenantId },
    });

    // Get total suppliers
    const totalSuppliers = await prisma.rateCardSupplier.count({
      where: { tenantId },
    });

    // Get geographic coverage (unique countries)
    const geographicCoverage = await prisma.rateCardEntry.findMany({
      where: { tenantId },
      select: { country: true },
      distinct: ['country'],
    });

    // Get service line coverage (unique lines of service)
    const serviceLineCoverage = await prisma.rateCardEntry.findMany({
      where: { tenantId },
      select: { lineOfService: true },
      distinct: ['lineOfService'],
    });

    return NextResponse.json({
      totalRateCards,
      totalSuppliers,
      geographicCoverage: geographicCoverage.length,
      serviceLineCoverage: serviceLineCoverage.length,
      countries: geographicCoverage.map(g => g.country).filter(Boolean),
      serviceLines: serviceLineCoverage.map(s => s.lineOfService).filter(Boolean),
    });
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard metrics' },
      { status: 500 }
    );
  }
}
