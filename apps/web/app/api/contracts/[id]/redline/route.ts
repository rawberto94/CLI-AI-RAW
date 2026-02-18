/**
 * Redline Persistence API
 *
 * POST /api/contracts/[id]/redline — Save tracked changes + comments
 * GET  /api/contracts/[id]/redline — Load last-saved redline session
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSessionTenantId } from '@/lib/tenant-server';
import { getAuthenticatedApiContext } from '@/lib/api-middleware';

/* ------------------------------------------------------------------ */
/*  GET — load saved redline state                                     */
/* ------------------------------------------------------------------ */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCtx = getAuthenticatedApiContext(_request);
  if (!authCtx) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = getSessionTenantId(session as any);

    const contract = await prisma.contract.findFirst({
      where: { id, tenantId, isDeleted: false },
      select: {
        id: true,
        metadata: true,
        status: true,
        rawText: true,
        contractTitle: true,
      },
    });

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    // Redline state stored in metadata.redline
    const meta = (contract.metadata as Record<string, unknown>) || {};
    const redline = (meta.redline as Record<string, unknown>) || null;

    return NextResponse.json({
      success: true,
      data: {
        contractId: contract.id,
        contractTitle: contract.contractTitle,
        status: contract.status,
        content: redline?.content ?? contract.rawText ?? '',
        changes: redline?.changes ?? [],
        comments: redline?.comments ?? [],
        documentStatus: redline?.documentStatus ?? 'draft',
        savedAt: redline?.savedAt ?? null,
        savedBy: redline?.savedBy ?? null,
        version: redline?.version ?? 0,
      },
    });
  } catch (error) {
    console.error('[Redline GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load redline data' },
      { status: 500 }
    );
  }
}

/* ------------------------------------------------------------------ */
/*  POST — save redline state                                          */
/* ------------------------------------------------------------------ */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCtx = getAuthenticatedApiContext(request);
  if (!authCtx) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = getSessionTenantId(session as any);

    const body = await request.json();
    const {
      content,
      changes = [],
      comments = [],
      documentStatus = 'draft',
      finalize = false,
    } = body;

    if (typeof content !== 'string') {
      return NextResponse.json(
        { error: 'content (string) is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const contract = await prisma.contract.findFirst({
      where: { id, tenantId, isDeleted: false },
      select: { id: true, metadata: true, status: true },
    });

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const existingMeta = (contract.metadata as Record<string, unknown>) || {};
    const existingRedline = (existingMeta.redline as Record<string, unknown>) || {};
    const version = ((existingRedline.version as number) || 0) + 1;

    // Build redline payload
    const redlinePayload = {
      content,
      changes,
      comments,
      documentStatus: finalize ? 'approved' : documentStatus,
      savedAt: now,
      savedBy: session.user.email || session.user.name || 'unknown',
      version,
    };

    // Build status history entry
    const statusHistory = Array.isArray(existingMeta.statusHistory)
      ? existingMeta.statusHistory
      : [];

    // If finalizing, also transition contract status
    const updateData: Record<string, unknown> = {
      metadata: {
        ...existingMeta,
        redline: redlinePayload,
        statusHistory: finalize
          ? [
              ...statusHistory,
              {
                from: contract.status,
                to: 'ACTIVE',
                at: now,
                by: session.user.email || session.user.name,
                reason: 'Redline finalized — all changes accepted',
              },
            ]
          : statusHistory,
      },
      updatedAt: new Date(),
    };

    if (finalize) {
      updateData.status = 'ACTIVE';
    }

    await prisma.contract.update({
      where: { id },
      data: updateData as any,
    });

    return NextResponse.json({
      success: true,
      data: {
        contractId: id,
        version,
        documentStatus: redlinePayload.documentStatus,
        savedAt: now,
        finalized: finalize,
        pendingChanges: changes.filter(
          (c: { status?: string }) => c.status === 'pending'
        ).length,
      },
    });
  } catch (error) {
    console.error('[Redline POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save redline data' },
      { status: 500 }
    );
  }
}
