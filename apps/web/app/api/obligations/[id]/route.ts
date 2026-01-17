import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/obligations/[id]
 * Get a specific obligation by ID
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Search for obligation in all contracts
    const contracts = await prisma.contract.findMany({
      where: { tenantId: session.user.tenantId },
      select: {
        id: true,
        contractTitle: true,
        metadata: true,
        supplier: { select: { name: true } },
      },
    });

    for (const contract of contracts) {
      const meta = contract.metadata as Record<string, unknown> | null;
      const obligations = (meta?.obligations as unknown[]) || [];
      const obligation = obligations.find(
        (o: unknown) => (o as Record<string, unknown>).id === id
      );

      if (obligation) {
        return NextResponse.json({
          obligation: {
            ...(obligation as Record<string, unknown>),
            contractId: contract.id,
            contractTitle: contract.contractTitle,
            vendorName: contract.supplier?.name,
          },
        });
      }
    }

    return NextResponse.json({ error: 'Obligation not found' }, { status: 404 });
  } catch (error) {
    console.error('Failed to fetch obligation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch obligation' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/obligations/[id]
 * Update an obligation (status, notes, etc.)
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, notes, evidence, completedBy } = body;

    // Find the contract containing this obligation
    const contracts = await prisma.contract.findMany({
      where: { tenantId: session.user.tenantId },
      select: {
        id: true,
        metadata: true,
      },
    });

    let foundContract: { id: string; metadata: unknown } | null = null;
    let obligationIndex = -1;
    let existingObligation: Record<string, unknown> | null = null;

    for (const contract of contracts) {
      const meta = contract.metadata as Record<string, unknown> | null;
      const obligations = (meta?.obligations as unknown[]) || [];
      const idx = obligations.findIndex(
        (o: unknown) => (o as Record<string, unknown>).id === id
      );

      if (idx !== -1) {
        foundContract = contract;
        obligationIndex = idx;
        existingObligation = obligations[idx] as Record<string, unknown>;
        break;
      }
    }

    if (!foundContract || !existingObligation) {
      return NextResponse.json({ error: 'Obligation not found' }, { status: 404 });
    }

    const now = new Date();

    // Build history entry
    const historyEntry = {
      id: crypto.randomUUID(),
      action: status === 'completed' ? 'status_changed' : evidence ? 'evidence_added' : 'updated',
      description: status
        ? `Status changed from ${existingObligation.status} to ${status}${notes ? `: ${notes}` : ''}`
        : notes || 'Obligation updated',
      previousStatus: existingObligation.status,
      newStatus: status || existingObligation.status,
      performedBy: session.user.id,
      performedAt: now.toISOString(),
    };

    // Update obligation
    const updatedObligation: Record<string, unknown> = {
      ...existingObligation,
      ...(status && { status }),
      ...(status === 'completed' && {
        completedAt: now.toISOString(),
        completedBy: completedBy || session.user.id,
        completionNotes: notes,
      }),
      updatedAt: now.toISOString(),
      history: [...((existingObligation.history as unknown[]) || []), historyEntry],
    };

    // Add evidence if provided
    if (evidence && Array.isArray(evidence)) {
      const existingEvidence = (updatedObligation.attachedEvidence as unknown[]) || [];
      const newEvidence = evidence.map((e: Record<string, unknown>) => ({
        ...e,
        id: crypto.randomUUID(),
        uploadedAt: now.toISOString(),
        uploadedBy: session.user.id,
      }));
      updatedObligation.attachedEvidence = [...existingEvidence, ...newEvidence];
    }

    // Update in contract metadata
    const meta = foundContract.metadata as Record<string, unknown> | null;
    const obligations = (meta?.obligations as unknown[]) || [];
    obligations[obligationIndex] = updatedObligation;

    await prisma.contract.update({
      where: { id: foundContract.id },
      data: {
        metadata: JSON.parse(JSON.stringify({
          ...(meta || {}),
          obligations,
        })),
        updatedAt: now,
      },
    });

    return NextResponse.json({
      success: true,
      obligation: updatedObligation,
    });
  } catch (error) {
    console.error('Failed to update obligation:', error);
    return NextResponse.json(
      { error: 'Failed to update obligation' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/obligations/[id]
 * Delete an obligation
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Find and remove from contract
    const contracts = await prisma.contract.findMany({
      where: { tenantId: session.user.tenantId },
      select: {
        id: true,
        metadata: true,
      },
    });

    for (const contract of contracts) {
      const meta = contract.metadata as Record<string, unknown> | null;
      const obligations = (meta?.obligations as unknown[]) || [];
      const filteredObligations = obligations.filter(
        (o: unknown) => (o as Record<string, unknown>).id !== id
      );

      if (filteredObligations.length !== obligations.length) {
        await prisma.contract.update({
          where: { id: contract.id },
          data: {
            metadata: JSON.parse(JSON.stringify({
              ...(meta || {}),
              obligations: filteredObligations,
            })),
            updatedAt: new Date(),
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Obligation deleted',
        });
      }
    }

    return NextResponse.json({ error: 'Obligation not found' }, { status: 404 });
  } catch (error) {
    console.error('Failed to delete obligation:', error);
    return NextResponse.json(
      { error: 'Failed to delete obligation' },
      { status: 500 }
    );
  }
}
