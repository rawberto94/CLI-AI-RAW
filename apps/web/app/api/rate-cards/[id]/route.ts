import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RateCardEntryService } from 'data-orchestration/services';
import { getServerSession } from '@/lib/auth';

const rateCardService = new RateCardEntryService(prisma);

/**
 * GET /api/rate-cards/[id]
 * Get a single rate card entry by ID
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { id } = params;
    
    // Check data mode from header
    const dataMode = request.headers.get('x-data-mode') || 'real';
    
    // If mock mode, return mock data
    if (dataMode === 'mock') {
      const mockRateCards = [
        {
          id: "rate-acc-se1",
          rateCardId: "card-acc-001",
          originalRoleName: "Senior Software Engineer",
          roleStandardized: "Software Engineer",
          roleCategory: "Technology",
          seniority: "SENIOR",
          serviceLine: "Technology",
          lineOfService: "Technology",
          country: "United States",
          dailyRate: 1200,
          currency: "USD",
          supplierId: "sup-acc",
          supplierName: "Accenture",
          effectiveDate: "2024-01-01",
          expiryDate: "2025-12-31",
          isBaseline: true,
          isNegotiated: true,
          isEditable: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "rate-acc-arch1",
          rateCardId: "card-acc-001",
          originalRoleName: "Principal Architect",
          roleStandardized: "Solution Architect",
          roleCategory: "Technology",
          seniority: "PRINCIPAL",
          serviceLine: "Technology",
          lineOfService: "Technology",
          country: "United States",
          dailyRate: 1800,
          currency: "USD",
          supplierId: "sup-acc",
          supplierName: "Accenture",
          effectiveDate: "2024-01-01",
          expiryDate: "2025-12-31",
          isBaseline: true,
          isNegotiated: false,
          isEditable: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "rate-acc-ds1",
          rateCardId: "card-acc-001",
          originalRoleName: "Data Scientist",
          roleStandardized: "Data Scientist",
          roleCategory: "Data",
          seniority: "SENIOR",
          serviceLine: "Data & Analytics",
          lineOfService: "Data & Analytics",
          country: "United States",
          dailyRate: 1400,
          currency: "USD",
          supplierId: "sup-acc",
          supplierName: "Accenture",
          effectiveDate: "2024-01-01",
          expiryDate: "2025-12-31",
          isBaseline: false,
          isNegotiated: true,
          isEditable: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "rate-acc-devops1",
          rateCardId: "card-acc-001",
          originalRoleName: "DevOps Engineer",
          roleStandardized: "DevOps Engineer",
          roleCategory: "Technology",
          seniority: "MID",
          serviceLine: "Technology",
          lineOfService: "Technology",
          country: "United States",
          dailyRate: 1000,
          currency: "USD",
          supplierId: "sup-acc",
          supplierName: "Accenture",
          effectiveDate: "2024-01-01",
          expiryDate: "2025-12-31",
          isBaseline: false,
          isNegotiated: false,
          isEditable: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "rate-tw-fs1",
          rateCardId: "card-tw-001",
          originalRoleName: "Full Stack Developer",
          roleStandardized: "Software Engineer",
          roleCategory: "Technology",
          seniority: "SENIOR",
          serviceLine: "Technology",
          lineOfService: "Technology",
          country: "United States",
          dailyRate: 950,
          currency: "USD",
          supplierId: "sup-tw",
          supplierName: "Thoughtworks",
          effectiveDate: "2024-01-01",
          expiryDate: "2025-12-31",
          isBaseline: true,
          isNegotiated: true,
          isEditable: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      
      const mockEntry = mockRateCards.find(rc => rc.id === id);
      if (!mockEntry) {
        return NextResponse.json(
          { error: 'Rate card not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json(mockEntry);
    }
    
    // Get authenticated user from session
    const session = await getServerSession();
    const tenantId = session?.user?.tenantId || request.headers.get('x-tenant-id');

    // Require tenant ID for data isolation
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

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
export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { id } = params;
    const body = await request.json();
    
    // Get authenticated user from session
    const session = await getServerSession();
    const tenantId = session?.user?.tenantId || request.headers.get('x-tenant-id');

    // Require tenant ID for data isolation
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

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
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { id } = params;
    
    // Get authenticated user from session
    const session = await getServerSession();
    const tenantId = session?.user?.tenantId || request.headers.get('x-tenant-id');

    // Require tenant ID for data isolation
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

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
