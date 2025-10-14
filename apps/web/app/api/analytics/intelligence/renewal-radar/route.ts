import { NextRequest, NextResponse } from 'next/server';
import { analyticalIntelligenceService } from '@/lib/services/analytical-intelligence.service';

/**
 * Renewal Radar API Endpoints
 */

// GET /api/analytics/intelligence/renewal-radar - Get renewal data and alerts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || 'default';
    const supplierId = searchParams.get('supplierId');
    const category = searchParams.get('category');
    const riskLevel = searchParams.get('riskLevel');
    const daysUntilExpiry = searchParams.get('daysUntilExpiry');
    const view = searchParams.get('view') || 'calendar'; // calendar, alerts, timeline

    const filters = {
      tenantId,
      ...(supplierId && { supplierId }),
      ...(category && { category }),
      ...(riskLevel && { riskLevel }),
      ...(daysUntilExpiry && { daysUntilExpiry: parseInt(daysUntilExpiry) })
    };

    let result;

    switch (view) {
      case 'calendar':
        result = await analyticalIntelligenceService.getRenewalCalendar(filters);
        break;
      case 'alerts':
        result = await analyticalIntelligenceService.getRenewalAlerts(filters);
        break;
      case 'timeline':
        result = await analyticalIntelligenceService.getRenewalTimeline(filters);
        break;
      default:
        result = await analyticalIntelligenceService.getRenewalCalendar(filters);
    }

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to get renewal radar data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get renewal radar data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/analytics/intelligence/renewal-radar - Process renewal actions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, contractId, alertId } = body;

    let result;

    switch (action) {
      case 'extract_renewal_data':
        if (!contractId) {
          return NextResponse.json(
            { success: false, error: 'Contract ID is required' },
            { status: 400 }
          );
        }
        result = await analyticalIntelligenceService.extractRenewalData(contractId);
        break;
      
      case 'schedule_alerts':
        result = await analyticalIntelligenceService.scheduleRenewalAlerts(body.renewalData);
        break;
      
      case 'acknowledge_alert':
        if (!alertId) {
          return NextResponse.json(
            { success: false, error: 'Alert ID is required' },
            { status: 400 }
          );
        }
        result = await analyticalIntelligenceService.acknowledgeAlert(alertId, body.userId);
        break;
      
      case 'trigger_rfx':
        if (!contractId) {
          return NextResponse.json(
            { success: false, error: 'Contract ID is required' },
            { status: 400 }
          );
        }
        result = await analyticalIntelligenceService.triggerRfxGeneration(contractId);
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
    console.error('Failed to process renewal radar action:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process renewal radar action',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}