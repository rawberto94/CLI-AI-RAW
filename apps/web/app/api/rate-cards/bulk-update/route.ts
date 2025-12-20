import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/rate-cards/bulk-update
 * Bulk update rate card entries
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { ids, updates, userId = 'system' } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or empty ids array' },
        { status: 400 }
      );
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { error: 'Invalid updates object' },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: any = {};
    
    if (updates.clientName !== undefined) {
      updateData.clientName = updates.clientName;
      updateData.clientId = updates.clientId || null;
    }
    
    if (updates.isBaseline !== undefined) {
      updateData.isBaseline = updates.isBaseline;
      if (updates.isBaseline && updates.baselineType) {
        updateData.baselineType = updates.baselineType;
      }
    }
    
    if (updates.isNegotiated !== undefined) {
      updateData.isNegotiated = updates.isNegotiated;
      if (updates.isNegotiated) {
        if (updates.negotiationDate) {
          updateData.negotiationDate = new Date(updates.negotiationDate);
        }
        if (updates.negotiatedBy) {
          updateData.negotiatedBy = updates.negotiatedBy;
        }
        if (updates.msaReference) {
          updateData.msaReference = updates.msaReference;
        }
      }
    }

    // Add edit tracking
    updateData.editedBy = userId;
    updateData.editedAt = new Date();

    // Perform bulk update
    const result = await (prisma as any).rateCardEntry.updateMany({
      where: {
        id: { in: ids },
        tenantId,
      },
      data: updateData,
    });

    // Create audit log entries
    await Promise.all(
      ids.map((id) =>
        (prisma as any).auditLog.create({
          data: {
            tenantId,
            userId,
            action: 'BULK_UPDATE',
            entityType: 'RateCardEntry',
            entityId: id,
            changes: JSON.stringify(updates),
            timestamp: new Date(),
          },
        }).catch((error: any) => {
          console.error(`Failed to create audit log for ${id}:`, error);
          // Don't fail the whole operation if audit log fails
        })
      )
    );

    // Emit events for each updated rate card
    if (result.count > 0) {
      const { rateCardEvents } = await import('@/../../packages/data-orchestration/src/services/event-integration.helper');
      // For bulk updates, emit a single imported event to trigger cache invalidation
      await rateCardEvents.imported(result.count, tenantId, 'BULK_UPDATE');
    }

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
      message: `Successfully updated ${result.count} rate card(s)`,
    });
  } catch (error) {
    console.error('Error bulk updating rate cards:', error);
    return NextResponse.json(
      { error: 'Failed to bulk update rate cards', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
