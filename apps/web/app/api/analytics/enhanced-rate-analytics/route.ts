import { NextRequest, NextResponse } from 'next/server';
import { enhancedRateAnalyticsService } from '../../../../../packages/data-orchestration/src/services/enhanced-rate-analytics.service';

/**
 * Enhanced Rate Analytics API
 * Provides comprehensive multi-dimensional analytics for enhanced rate card data
 */

// GET /api/analytics/enhanced-rate-analytics - Get enhanced analytics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'comprehensive';
    const tenantId = searchParams.get('tenantId') || 'default';

    let result: any;

    switch (action) {
      case 'comprehensive':
        // Get all analytics in one call
        const filters = {
          tenantId,
          role: searchParams.get('role') || undefined,
          lineOfService: searchParams.get('lineOfService') || undefined,
          country: searchParams.get('country') || undefined,
          seniorityLevel: searchParams.get('seniorityLevel') || undefined,
          engagementModel: searchParams.get('engagementModel') || undefined,
        };

        const [
          lineOfServiceAnalytics,
          seniorityAnalytics,
          geographicAnalytics,
          skillPremiumAnalytics
        ] = await Promise.all([
          enhancedRateAnalyticsService.analyzeByLineOfService(tenantId, filters),
          enhancedRateAnalyticsService.analyzeBySeniority(tenantId, filters),
          enhancedRateAnalyticsService.analyzeByGeography(tenantId, filters),
          enhancedRateAnalyticsService.analyzeSkillPremiums(tenantId, filters)
        ]);

        result = {
          lineOfServiceAnalytics,
          seniorityAnalytics,
          geographicAnalytics,
          skillPremiumAnalytics,
          summary: {
            totalServices: lineOfServiceAnalytics.totalServices,
            totalSeniorityLevels: seniorityAnalytics.totalLevels,
            totalLocations: geographicAnalytics.totalLocations,
            avgRateAcrossServices: lineOfServiceAnalytics.avgRateAcrossServices,
            avgProgressionIncrease: seniorityAnalytics.avgProgressionIncrease,
            avgCostOfLiving: geographicAnalytics.avgCostOfLiving
          }
        };
        break;

      case 'line-of-service':
        const losFilters = {
          tenantId,
          country: searchParams.get('country') || undefined,
          engagementModel: searchParams.get('engagementModel') || undefined,
          approvalStatus: searchParams.get('approvalStatus') || undefined,
        };
        result = await enhancedRateAnalyticsService.analyzeByLineOfService(tenantId, losFilters);
        break;

      case 'seniority':
        const seniorityFilters = {
          tenantId,
          role: searchParams.get('role') || undefined,
          lineOfService: searchParams.get('lineOfService') || undefined,
          country: searchParams.get('country') || undefined,
        };
        result = await enhancedRateAnalyticsService.analyzeBySeniority(tenantId, seniorityFilters);
        break;

      case 'geography':
        const geoFilters = {
          tenantId,
          role: searchParams.get('role') || undefined,
          seniorityLevel: searchParams.get('seniorityLevel') || undefined,
          lineOfService: searchParams.get('lineOfService') || undefined,
        };
        result = await enhancedRateAnalyticsService.analyzeByGeography(tenantId, geoFilters);
        break;

      case 'skill-premiums':
        const skillFilters = {
          tenantId,
          role: searchParams.get('role') || undefined,
          seniorityLevel: searchParams.get('seniorityLevel') || undefined,
          lineOfService: searchParams.get('lineOfService') || undefined,
        };
        result = await enhancedRateAnalyticsService.analyzeSkillPremiums(tenantId, skillFilters);
        break;

      case 'market-benchmark':
        const role = searchParams.get('role');
        const seniority = searchParams.get('seniority');
        const country = searchParams.get('country');
        
        if (!role || !seniority || !country) {
          return NextResponse.json({ 
            success: false, 
            error: 'Role, seniority, and country parameters required for benchmarking' 
          }, { status: 400 });
        }
        
        const location = { 
          country,
          stateProvince: searchParams.get('stateProvince') || undefined,
          city: searchParams.get('city') || undefined
        };
        
        result = await enhancedRateAnalyticsService.generateMarketBenchmarks(
          role, 
          seniority as any, 
          location, 
          tenantId
        );
        break;

      case 'health':
        result = await enhancedRateAnalyticsService.healthCheck();
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
    console.error('Failed to process enhanced rate analytics request:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process enhanced rate analytics request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/analytics/enhanced-rate-analytics - Complex analytics queries
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, tenantId = 'default', filters = {} } = body;

    let result: any;

    switch (action) {
      case 'multi_dimensional_analysis':
        // Analyze across multiple dimensions simultaneously
        const { dimensions = [] } = body;
        
        const analysisPromises = dimensions.map((dimension: string) => {
          switch (dimension) {
            case 'line_of_service':
              return enhancedRateAnalyticsService.analyzeByLineOfService(tenantId, filters);
            case 'seniority':
              return enhancedRateAnalyticsService.analyzeBySeniority(tenantId, filters);
            case 'geography':
              return enhancedRateAnalyticsService.analyzeByGeography(tenantId, filters);
            case 'skill_premiums':
              return enhancedRateAnalyticsService.analyzeSkillPremiums(tenantId, filters);
            default:
              return Promise.resolve(null);
          }
        });

        const analysisResults = await Promise.all(analysisPromises);
        
        result = dimensions.reduce((acc: any, dimension: string, index: number) => {
          acc[dimension] = analysisResults[index];
          return acc;
        }, {});
        break;

      case 'comparative_analysis':
        // Compare different segments (e.g., different countries, services, etc.)
        const { segments = [] } = body;
        
        const comparativeResults = await Promise.all(
          segments.map((segment: any) => 
            enhancedRateAnalyticsService.analyzeByLineOfService(tenantId, { ...filters, ...segment })
          )
        );
        
        result = {
          segments: segments.map((segment: any, index: number) => ({
            segment,
            analytics: comparativeResults[index]
          })),
          comparison: {
            // Add comparison logic here
            totalSegments: segments.length,
            avgRateVariance: 0 // Calculate variance across segments
          }
        };
        break;

      case 'trend_forecast':
        // Generate forecasts based on historical data
        const { forecastPeriods = 6, dimension = 'line_of_service' } = body;
        
        // This would typically involve more complex forecasting logic
        result = {
          dimension,
          forecastPeriods,
          forecast: Array.from({ length: forecastPeriods }, (_, i) => ({
            period: i + 1,
            predictedGrowth: Math.random() * 10 - 5, // Mock forecast
            confidence: Math.random() * 0.3 + 0.7
          }))
        };
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
    console.error('Failed to process enhanced rate analytics action:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process enhanced rate analytics action',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}