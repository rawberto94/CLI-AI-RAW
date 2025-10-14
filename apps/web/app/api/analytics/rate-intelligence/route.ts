import { NextRequest, NextResponse } from 'next/server';
import { rateCardIntelligenceService } from '../../../../../packages/data-orchestration/src/services/rate-card-intelligence.service';

/**
 * Rate Card Intelligence API
 * Provides comprehensive intelligence and analytics for rate card data
 */

// GET /api/analytics/rate-intelligence - Get rate intelligence data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'analytics';
    const tenantId = searchParams.get('tenantId') || 'default';

    let result;

    switch (action) {
      case 'analytics':
        const period = searchParams.get('period') || '12M';
        result = await rateCardIntelligenceService.generateRateAnalytics(tenantId, period);
        break;

      case 'repository':
        const filters = {
          tenantId,
          supplierId: searchParams.get('supplierId') || undefined,
          lineOfService: searchParams.get('lineOfService') || undefined,
          category: searchParams.get('category') || undefined, // Legacy support
          region: searchParams.get('region') || undefined,
          country: searchParams.get('country') || undefined,
          stateProvince: searchParams.get('stateProvince') || undefined,
          city: searchParams.get('city') || undefined,
          deliveryModel: searchParams.get('deliveryModel') || undefined,
          engagementModel: searchParams.get('engagementModel') || undefined,
          businessUnit: searchParams.get('businessUnit') || undefined,
          approvalStatus: searchParams.get('approvalStatus') || undefined,
          minRate: searchParams.get('minRate') ? parseFloat(searchParams.get('minRate')!) : undefined,
          maxRate: searchParams.get('maxRate') ? parseFloat(searchParams.get('maxRate')!) : undefined,
        };
        result = await rateCardIntelligenceService.getAllRateCards(filters);
        break;

      case 'enhanced-analytics':
        const enhancedFilters = {
          tenantId,
          lineOfService: searchParams.get('lineOfService') || undefined,
          country: searchParams.get('country') || undefined,
          seniorityLevel: searchParams.get('seniorityLevel') || undefined,
          engagementModel: searchParams.get('engagementModel') || undefined,
          role: searchParams.get('role') || undefined,
        };
        result = await rateCardIntelligenceService.getEnhancedAnalytics(tenantId, enhancedFilters);
        break;

      case 'line-of-service':
        const losFilters = {
          tenantId,
          country: searchParams.get('country') || undefined,
          engagementModel: searchParams.get('engagementModel') || undefined,
        };
        result = await rateCardIntelligenceService.analyzeByLineOfService(tenantId, losFilters);
        break;

      case 'seniority':
        const seniorityFilters = {
          tenantId,
          role: searchParams.get('role') || undefined,
          lineOfService: searchParams.get('lineOfService') || undefined,
        };
        result = await rateCardIntelligenceService.analyzeBySeniority(tenantId, seniorityFilters);
        break;

      case 'geography':
        const geoFilters = {
          tenantId,
          role: searchParams.get('role') || undefined,
          seniorityLevel: searchParams.get('seniorityLevel') || undefined,
        };
        result = await rateCardIntelligenceService.analyzeByGeography(tenantId, geoFilters);
        break;

      case 'skill-premiums':
        const skillFilters = {
          tenantId,
          role: searchParams.get('role') || undefined,
          seniorityLevel: searchParams.get('seniorityLevel') || undefined,
        };
        result = await rateCardIntelligenceService.analyzeSkillPremiums(tenantId, skillFilters);
        break;

      case 'market-benchmark':
        const benchmarkRole = searchParams.get('role');
        const seniority = searchParams.get('seniority');
        const country = searchParams.get('country');
        
        if (!benchmarkRole || !seniority || !country) {
          return NextResponse.json({ 
            success: false, 
            error: 'Role, seniority, and country parameters required for benchmarking' 
          }, { status: 400 });
        }
        
        result = await rateCardIntelligenceService.generateMarketBenchmarks(benchmarkRole, seniority, country, tenantId);
        break;

      case 'trends':
        const timeframe = searchParams.get('timeframe') || '24M';
        result = await rateCardIntelligenceService.analyzeTrends(tenantId, timeframe);
        break;

      case 'role':
        const role = searchParams.get('role');
        if (!role) {
          return NextResponse.json(
            { success: false, error: 'Role parameter is required' },
            { status: 400 }
          );
        }
        const roleFilters = {
          tenantId,
          seniorityLevel: searchParams.get('seniorityLevel') || undefined,
          level: searchParams.get('level') || undefined, // Legacy support
          region: searchParams.get('region') || undefined,
          country: searchParams.get('country') || undefined,
          lineOfService: searchParams.get('lineOfService') || undefined,
          engagementModel: searchParams.get('engagementModel') || undefined,
          rateType: searchParams.get('rateType') || undefined,
          remoteWorkAllowed: searchParams.get('remoteWorkAllowed') === 'true' ? true : 
                           searchParams.get('remoteWorkAllowed') === 'false' ? false : undefined,
          securityClearanceRequired: searchParams.get('securityClearanceRequired') === 'true' ? true :
                                   searchParams.get('securityClearanceRequired') === 'false' ? false : undefined,
          minExperience: searchParams.get('minExperience') ? parseInt(searchParams.get('minExperience')!) : undefined,
          maxExperience: searchParams.get('maxExperience') ? parseInt(searchParams.get('maxExperience')!) : undefined,
          maxTravelPercentage: searchParams.get('maxTravelPercentage') ? parseInt(searchParams.get('maxTravelPercentage')!) : undefined,
          minRate: searchParams.get('minRate') ? parseFloat(searchParams.get('minRate')!) : undefined,
          maxRate: searchParams.get('maxRate') ? parseFloat(searchParams.get('maxRate')!) : undefined,
        };
        result = await rateCardIntelligenceService.getRatesByRole(role, roleFilters);
        break;

      case 'supplier':
        const supplierId = searchParams.get('supplierId');
        if (!supplierId) {
          return NextResponse.json(
            { success: false, error: 'Supplier ID parameter is required' },
            { status: 400 }
          );
        }
        result = await rateCardIntelligenceService.getRatesBySupplier(supplierId, tenantId);
        break;

      case 'health':
        result = await rateCardIntelligenceService.healthCheck();
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action specified' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to process rate intelligence request:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process rate intelligence request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/analytics/rate-intelligence - Process queries and comparisons
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, tenantId = 'default' } = body;

    let result;

    switch (action) {
      case 'query':
        const { query } = body;
        if (!query) {
          return NextResponse.json(
            { success: false, error: 'Query parameter is required' },
            { status: 400 }
          );
        }
        result = await rateCardIntelligenceService.queryRateData(query, tenantId);
        break;

      case 'compare_suppliers':
        const { supplierIds } = body;
        if (!supplierIds || !Array.isArray(supplierIds)) {
          return NextResponse.json(
            { success: false, error: 'Supplier IDs array is required' },
            { status: 400 }
          );
        }
        result = await rateCardIntelligenceService.compareSuppliers(supplierIds, tenantId);
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action specified' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to process rate intelligence action:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process rate intelligence action',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}