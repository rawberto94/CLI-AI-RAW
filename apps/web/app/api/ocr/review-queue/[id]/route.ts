/**
 * Human Review Queue Item API
 * 
 * Individual review item operations
 * Note: Stubbed until OcrReviewItem model is migrated to database
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { z } from 'zod';

// Update schema
const updateSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'escalated']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assignedTo: z.string().nullable().optional(),
  corrections: z.array(z.object({
    field: z.string(),
    original: z.string(),
    corrected: z.string(),
    confidence: z.number().optional(),
  })).optional(),
  notes: z.string().optional(),
  escalationReason: z.string().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/ocr/review-queue/[id]
 * Get a single review item
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Stubbed response - in production, fetch from Prisma
    return NextResponse.json({
      id,
      tenantId: session.user.tenantId,
      contractId: 'contract_stub',
      type: 'ocr_quality',
      status: 'pending',
      priority: 'medium',
      ocrConfidence: 0.75,
      documentName: 'document.pdf',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      message: 'Note: Using stubbed data until database migration is run',
    });
  } catch (error) {
    console.error('[Review Queue] Error fetching item:', error);
    return NextResponse.json(
      { error: 'Failed to fetch review item' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/ocr/review-queue/[id]
 * Update a review item (assign, complete, escalate)
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const data = updateSchema.parse(body);

    // Stubbed response
    return NextResponse.json({
      id,
      ...data,
      updatedAt: new Date().toISOString(),
      message: 'Note: Using stubbed data until database migration is run',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    console.error('[Review Queue] Error updating item:', error);
    return NextResponse.json(
      { error: 'Failed to update review item' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ocr/review-queue/[id]
 * Delete a review item (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin permission
    if (session.user.role !== 'admin' && session.user.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    
    // Stubbed response
    return NextResponse.json({ 
      success: true, 
      id,
      message: 'Note: Using stubbed data until database migration is run',
    });
  } catch (error) {
    console.error('[Review Queue] Error deleting item:', error);
    return NextResponse.json(
      { error: 'Failed to delete review item' },
      { status: 500 }
    );
  }
}
