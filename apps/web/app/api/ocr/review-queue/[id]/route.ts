/**
 * Human Review Queue Item API
 * 
 * Individual review item operations
 * Note: Stubbed until OcrReviewItem model is migrated to database
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

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
  const ctx = getApiContext(request);
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    const { id } = await params;

    // Stubbed response - in production, fetch from Prisma
    return createSuccessResponse(ctx, {
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
    return handleApiError(ctx, error);
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
  const ctx = getApiContext(request);
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    const { id } = await params;
    const body = await request.json();
    const data = updateSchema.parse(body);

    // Stubbed response
    return createSuccessResponse(ctx, {
      id,
      ...data,
      updatedAt: new Date().toISOString(),
      message: 'Note: Using stubbed data until database migration is run',
    });
  } catch (error) {
    return handleApiError(ctx, error);
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
  const ctx = getApiContext(request);
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    // Check admin permission
    if (session.user.role !== 'admin' && session.user.role !== 'owner') {
      return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403);
    }

    const { id } = await params;
    
    // Stubbed response
    return createSuccessResponse(ctx, { 
      success: true, 
      id,
      message: 'Note: Using stubbed data until database migration is run',
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
