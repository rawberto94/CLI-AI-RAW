import { NextRequest, NextResponse } from 'next/server';
import { rateCardManagementService } from 'data-orchestration';

/**
 * Rate Card Management API
 * Provides manual editing and bulk upload capabilities
 */

// GET /api/analytics/rate-management - Get rate cards and templates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const tenantId = searchParams.get('tenantId') || 'default';

    let result;

    switch (action) {
      case 'list':
        // Get rate cards with filters
        const filters = {
          tenantId,
          supplierId: searchParams.get('supplierId') || undefined,
          region: searchParams.get('region') || undefined,
          deliveryModel: searchParams.get('deliveryModel') as any || undefined,
          dateFrom: searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : undefined,
          dateTo: searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')!) : undefined,
          role: searchParams.get('role') || undefined,
          minRate: searchParams.get('minRate') ? parseFloat(searchParams.get('minRate')!) : undefined,
          maxRate: searchParams.get('maxRate') ? parseFloat(searchParams.get('maxRate')!) : undefined,
        };
        result = await rateCardManagementService.getRateCards(filters);
        break;

      case 'details':
        const rateCardId = searchParams.get('rateCardId');
        if (!rateCardId) {
          return NextResponse.json(
            { success: false, error: 'Rate card ID is required' },
            { status: 400 }
          );
        }
        result = await rateCardManagementService.getRateCardDetails(rateCardId);
        break;

      case 'template':
        // Get bulk upload template
        result = rateCardManagementService.getBulkUploadTemplate();
        break;

      case 'health':
        result = await rateCardManagementService.healthCheck();
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
    console.error('Failed to process rate management request:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process rate management request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/analytics/rate-management - Create, update, delete, bulk upload
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, tenantId = 'default' } = body;

    let result;

    switch (action) {
      case 'create':
        const { rateCard } = body;
        if (!rateCard) {
          return NextResponse.json(
            { success: false, error: 'Rate card data is required' },
            { status: 400 }
          );
        }
        result = await rateCardManagementService.createRateCard(rateCard, tenantId);
        break;

      case 'update':
        const { rateCardId, updates } = body;
        if (!rateCardId || !updates) {
          return NextResponse.json(
            { success: false, error: 'Rate card ID and updates are required' },
            { status: 400 }
          );
        }
        result = await rateCardManagementService.updateRateCard(rateCardId, updates, tenantId);
        break;

      case 'delete':
        const { rateCardId: deleteId } = body;
        if (!deleteId) {
          return NextResponse.json(
            { success: false, error: 'Rate card ID is required' },
            { status: 400 }
          );
        }
        result = await rateCardManagementService.deleteRateCard(deleteId, tenantId);
        break;

      case 'bulk_upload':
        const { data } = body;
        if (!data || !Array.isArray(data)) {
          return NextResponse.json(
            { success: false, error: 'Data array is required for bulk upload' },
            { status: 400 }
          );
        }
        result = await rateCardManagementService.processBulkUpload(data, tenantId);
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
    console.error('Failed to process rate management action:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process rate management action',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PUT /api/analytics/rate-management - Update rate card
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { rateCardId, updates, tenantId = 'default' } = body;

    if (!rateCardId || !updates) {
      return NextResponse.json(
        { success: false, error: 'Rate card ID and updates are required' },
        { status: 400 }
      );
    }

    const result = await rateCardManagementService.updateRateCard(rateCardId, updates, tenantId);

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to update rate card:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update rate card',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE /api/analytics/rate-management - Delete rate card
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rateCardId = searchParams.get('rateCardId');
    const tenantId = searchParams.get('tenantId') || 'default';

    if (!rateCardId) {
      return NextResponse.json(
        { success: false, error: 'Rate card ID is required' },
        { status: 400 }
      );
    }

    const result = await rateCardManagementService.deleteRateCard(rateCardId, tenantId);

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to delete rate card:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete rate card',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}