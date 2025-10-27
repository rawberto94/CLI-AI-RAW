import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RateCardEntryService } from '@/packages/data-orchestration/src/services/rate-card-entry.service';

const rateCardService = new RateCardEntryService(prisma);

/**
 * GET /api/rate-cards/[id]
 * Get a single rate card entry by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    // TODO: Get tenantId from session/auth
    const tenantId = request.nextUrl.searchParams.get('tenantId') || 'default-tenant';

    const entry = await rateCardService.getEntry(id, tenantId);

    return NextResponse.json(entry);
  } catch (error) {
    console.error('Error getting rate card:', error);
    return NextResponse.json(
      { error: 'Rate card not found', details: error instanceof Error ? error.message : String(error) },
      { status: 404 }
    );
  }
}

/**
 * PUT /api/rate-cards/[id]
 * Update a rate card entry
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    
    // TODO: Get tenantId from session/auth
    const tenantId = body.tenantId || 'default-tenant';

    // Convert date strings to Date objects
    if (body.effectiveDate) {
      body.effectiveDate = new Date(body.effectiveDate);
    }
    if (body.expiryDate) {
      body.expiryDate = new Date(body.expiryDate);
    }

    const entry = await rateCardService.updateEntry(id, body, tenantId);

    return NextResponse.json(entry);
  } catch (error) {
    console.error('Error updating rate card:', error);
    return NextResponse.json(
      { error: 'Failed to update rate card', details: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/rate-cards/[id]
 * Delete a rate card entry
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    // TODO: Get tenantId from session/auth
    const tenantId = request.nextUrl.searchParams.get('tenantId') || 'default-tenant';

    await rateCardService.deleteEntry(id, tenantId);

    return NextResponse.json({ success: true, message: 'Rate card deleted' });
  } catch (error) {
    console.error('Error deleting rate card:', error);
    return NextResponse.json(
      { error: 'Failed to delete rate card', details: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}
