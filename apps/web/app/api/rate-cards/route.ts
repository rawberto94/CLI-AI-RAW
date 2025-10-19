import { NextRequest, NextResponse } from 'next/server';
import { rateCardManagementService } from 'data-orchestration';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const supplier = searchParams.get('supplier');
    const includeAnalytics = searchParams.get('analytics') === 'true';
    const tenantId = "demo"; // TODO: Get from auth session

    // Get rate cards using real service
    const result = await rateCardManagementService.getRateCards(tenantId, {
      supplierName: supplier || undefined,
    });

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: 'Failed to fetch rate cards' },
        { status: 500 }
      );
    }

    const rateCards = result.data;

    let response: any = {
      rateCards,
      total: rateCards.length,
    };

    if (includeAnalytics && rateCards.length > 0) {
      // Calculate analytics from real data
      const totalRoles = rateCards.reduce((sum: number, rc: any) => sum + (rc.roles?.length || 0), 0);
      const avgConfidence = rateCards.reduce((sum: number, rc: any) => sum + (rc.dataQuality?.score || 0), 0) / rateCards.length;
      
      response.analytics = {
        totalSavingsOpportunity: 0, // TODO: Calculate from benchmarking
        topOpportunities: [], // TODO: Get from benchmarking service
        avgConfidence,
        categoriesAnalyzed: totalRoles,
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
    const tenantId = "demo"; // TODO: Get from auth session
    
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

      // Create rate card using real service
      const result = await rateCardManagementService.createRateCard(tenantId, {
        supplierName,
        effectiveDate: validFrom ? new Date(validFrom) : new Date(),
        expiryDate: validTo ? new Date(validTo) : undefined,
        currency: currency || 'CHF',
        roles: roles.map((role: any) => ({
          roleName: role.role,
          level: role.level,
          location: role.location,
          dailyRate: role.dailyRate,
          hourlyRate: role.dailyRate / 8, // Assuming 8 hour day
        })),
      });

      if (!result.success || !result.data) {
        return NextResponse.json(
          { error: 'Failed to create rate card' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        rateCard: result.data,
        message: 'Rate card created successfully'
      });
    } else {
      // Contract extraction - use rate card intelligence service
      const { contractId, supplier } = body;

      // TODO: Implement real contract extraction using AI service
      // For now, return a placeholder response
      return NextResponse.json({
        success: true,
        message: 'Rate card extraction from contract is not yet implemented',
        contractId,
        supplier,
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
