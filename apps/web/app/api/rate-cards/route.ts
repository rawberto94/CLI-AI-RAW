import { NextRequest, NextResponse } from 'next/server';
import {
  getRateCardsBySupplier,
  getTopSavingsOpportunities,
  calculateTotalSavingsOpportunity,
} from '@/lib/mock-database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const supplier = searchParams.get('supplier');
    const includeAnalytics = searchParams.get('analytics') === 'true';

    const rateCards = getRateCardsBySupplier(supplier || undefined);

    let response: any = {
      rateCards,
      total: rateCards.length,
    };

    if (includeAnalytics) {
      response.analytics = {
        totalSavingsOpportunity: calculateTotalSavingsOpportunity(),
        topOpportunities: getTopSavingsOpportunities(),
        avgConfidence:
          rateCards.reduce((sum, rc) => sum + rc.confidence, 0) /
          rateCards.length,
        categoriesAnalyzed: [
          ...new Set(rateCards.flatMap(rc => rc.services.map(s => s.category))),
        ],
        lastUpdated: new Date().toISOString(),
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Rate cards API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rate cards' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Check if this is a manual entry or contract extraction
    if (body.supplierName && body.roles) {
      // Manual rate card entry
      const { supplierName, clientName, currency, validFrom, validTo, roles } = body;

      // Validate required fields
      if (!supplierName || !roles || roles.length === 0) {
        return NextResponse.json(
          { error: 'Supplier name and at least one role are required' },
          { status: 400 }
        );
      }

      // Validate roles
      for (const role of roles) {
        if (!role.role || !role.level || !role.location || !role.dailyRate) {
          return NextResponse.json(
            { error: 'All role fields (role, level, location, dailyRate) are required' },
            { status: 400 }
          );
        }
      }

      // In a real implementation, you would:
      // 1. Create RateCard record in database
      // 2. Create RoleRate records for each role
      // 3. Return the created rate card with ID

      const rateCard = {
        id: `rc_${Date.now()}`,
        supplierName,
        clientName: clientName || null,
        currency: currency || 'CHF',
        validFrom: validFrom ? new Date(validFrom) : new Date(),
        validTo: validTo ? new Date(validTo) : null,
        createdAt: new Date(),
        roles: roles.map((role: any, index: number) => ({
          id: `rr_${Date.now()}_${index}`,
          ...role,
          rateCardId: `rc_${Date.now()}`
        }))
      };

      console.log('Created rate card:', rateCard);

      return NextResponse.json({
        success: true,
        rateCard,
        message: 'Rate card created successfully'
      });
    } else {
      // Contract extraction (existing functionality)
      const { contractId, supplier } = body;

      // Simulate rate card extraction process
      await new Promise(resolve => setTimeout(resolve, 2000));

      const mockExtractedRateCard = {
        id: `rc-${Date.now()}`,
        supplier: supplier || 'New Supplier',
        contractId,
        services: [
          {
            name: 'Senior Developer',
            currentRate: 160,
            marketRate: 150,
            savings: 10,
            unit: '/hour',
            category: 'Development',
          },
          {
            name: 'Junior Developer',
            currentRate: 120,
            marketRate: 110,
            savings: 10,
            unit: '/hour',
            category: 'Development',
          },
        ],
        totalSavings: 20,
        extractedAt: new Date(),
        confidence: 88,
      };

      return NextResponse.json({
        success: true,
        rateCard: mockExtractedRateCard,
        message: 'Rate card extracted successfully',
      });
    }
  } catch (error) {
    console.error('Rate card API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
