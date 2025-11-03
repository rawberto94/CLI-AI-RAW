import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { id } = params;
    const body = await request.json();
    
    // Check data mode from header
    const dataMode = request.headers.get('x-data-mode') || 'real';
    
    // If mock mode, return success without updating database
    if (dataMode === 'mock') {
      return NextResponse.json({
        success: true,
        message: 'Mock mode - changes not persisted',
        rateCard: {
          id,
          ...body,
          editedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    }
    
    const {
      clientName,
      clientId,
      isBaseline,
      baselineType,
      isNegotiated,
      negotiationDate,
      negotiatedBy,
      msaReference,
      dailyRate,
      currency,
      roleStandardized,
      seniority,
      country,
      supplierName,
      editedBy,
    } = body;

    // Fetch current rate card
    const currentRateCard = await prisma.rateCardEntry.findUnique({
      where: { id },
    });

    if (!currentRateCard) {
      return NextResponse.json(
        { error: 'Rate card not found' },
        { status: 404 }
      );
    }

    if (!currentRateCard.isEditable) {
      return NextResponse.json(
        { error: 'This rate card is locked and cannot be edited' },
        { status: 403 }
      );
    }

    // Build edit history entry
    const editHistoryEntry = {
      timestamp: new Date().toISOString(),
      editedBy: editedBy || 'Unknown',
      changes: Object.keys(body)
        .filter((key) => key !== 'editedBy')
        .map((key) => `${key}: ${(currentRateCard as any)[key]} → ${body[key]}`)
        .join(', '),
    };

    // Get existing edit history
    const existingHistory = (currentRateCard.editHistory as any[]) || [];
    const updatedHistory = [...existingHistory, editHistoryEntry];

    // Update rate card
    const updatedRateCard = await prisma.rateCardEntry.update({
      where: { id },
      data: {
        ...(clientName !== undefined && { clientName }),
        ...(clientId !== undefined && { clientId }),
        ...(isBaseline !== undefined && { isBaseline }),
        ...(baselineType !== undefined && { baselineType }),
        ...(isNegotiated !== undefined && { isNegotiated }),
        ...(negotiationDate !== undefined && { negotiationDate: new Date(negotiationDate) }),
        ...(negotiatedBy !== undefined && { negotiatedBy }),
        ...(msaReference !== undefined && { msaReference }),
        ...(dailyRate !== undefined && { dailyRate }),
        ...(currency !== undefined && { currency }),
        ...(roleStandardized !== undefined && { roleStandardized }),
        ...(seniority !== undefined && { seniority }),
        ...(country !== undefined && { country }),
        ...(supplierName !== undefined && { supplierName }),
        editedBy: editedBy || 'Unknown',
        editedAt: new Date(),
        editHistory: updatedHistory,
      },
    });

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        tenantId: currentRateCard.tenantId,
        userId: editedBy,
        action: 'rate_card_updated',
        resource: id,
        resourceType: 'RateCardEntry',
        details: {
          changes: editHistoryEntry.changes,
          previousValues: {
            clientName: currentRateCard.clientName,
            isBaseline: currentRateCard.isBaseline,
            isNegotiated: currentRateCard.isNegotiated,
            dailyRate: currentRateCard.dailyRate.toString(),
          },
          newValues: {
            clientName,
            isBaseline,
            isNegotiated,
            dailyRate,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      rateCard: updatedRateCard,
    });
  } catch (error) {
    console.error('Error updating rate card:', error);
    return NextResponse.json(
      { error: 'Failed to update rate card' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { id } = params;

    const rateCard = await prisma.rateCardEntry.findUnique({
      where: { id },
      include: {
        supplier: true,
        contract: {
          select: {
            id: true,
            fileName: true,
            clientName: true,
          },
        },
      },
    });

    if (!rateCard) {
      return NextResponse.json(
        { error: 'Rate card not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(rateCard);
  } catch (error) {
    console.error('Error fetching rate card:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rate card' },
      { status: 500 }
    );
  }
}
