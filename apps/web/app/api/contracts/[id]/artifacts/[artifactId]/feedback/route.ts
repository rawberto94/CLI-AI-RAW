/**
 * Artifact Feedback API Route
 * 
 * Allows users to rate, provide feedback on, and verify artifacts.
 * Uses existing Prisma schema fields: userRating, feedbackNotes, feedbackBy,
 * feedbackAt, isUserVerified, verifiedBy, verifiedAt.
 */

import { NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getApiTenantId } from "@/lib/tenant-server";
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

/**
 * POST /api/contracts/[id]/artifacts/[artifactId]/feedback
 * Submit feedback (rating + notes) for an artifact
 * 
 * Body: { rating?: number (1-5), notes?: string, verified?: boolean, userId: string }
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string; artifactId: string }> }
) {
  const params = await props.params;
  const ctx = getApiContext(request);
  try {
    const contractId = params.id;
    const artifactId = params.artifactId;
    const tenantId = await getApiTenantId(request);

    const body = await request.json();
    const { rating, notes, verified, userId } = body;

    // Validate rating if provided
    if (rating !== undefined && (typeof rating !== 'number' || rating < 1 || rating > 5)) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Rating must be a number between 1 and 5', 400);
    }

    // Verify artifact exists and belongs to the contract+tenant
    const artifact = await prisma.artifact.findFirst({
      where: { id: artifactId, contractId, tenantId },
      select: { id: true }
    });

    if (!artifact) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Artifact not found', 404);
    }

    // Build update payload
    const updateData: Record<string, any> = {};
    const now = new Date();

    if (rating !== undefined) {
      updateData.userRating = rating;
      updateData.feedbackBy = userId || 'anonymous';
      updateData.feedbackAt = now;
    }

    if (notes !== undefined) {
      updateData.feedbackNotes = notes;
      if (!updateData.feedbackBy) {
        updateData.feedbackBy = userId || 'anonymous';
        updateData.feedbackAt = now;
      }
    }

    if (verified !== undefined) {
      updateData.isUserVerified = verified;
      updateData.verifiedBy = userId || 'anonymous';
      updateData.verifiedAt = now;
    }

    if (Object.keys(updateData).length === 0) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'No feedback data provided. Send rating, notes, or verified.', 400);
    }

    const updated = await prisma.artifact.update({
      where: { id: artifactId },
      data: updateData,
      select: {
        id: true,
        type: true,
        userRating: true,
        feedbackNotes: true,
        feedbackBy: true,
        feedbackAt: true,
        isUserVerified: true,
        verifiedBy: true,
        verifiedAt: true,
      }
    });

    return createSuccessResponse(ctx, {
      success: true,
      artifact: updated
    });

  } catch (error) {
    return handleApiError(ctx, error);
  }
}

/**
 * GET /api/contracts/[id]/artifacts/[artifactId]/feedback
 * Get feedback data for an artifact
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string; artifactId: string }> }
) {
  const params = await props.params;
  const ctx = getApiContext(request);
  try {
    const contractId = params.id;
    const artifactId = params.artifactId;
    const tenantId = await getApiTenantId(request);

    const artifact = await prisma.artifact.findFirst({
      where: { id: artifactId, contractId, tenantId },
      select: {
        id: true,
        type: true,
        userRating: true,
        feedbackNotes: true,
        feedbackBy: true,
        feedbackAt: true,
        isUserVerified: true,
        verifiedBy: true,
        verifiedAt: true,
        qualityScore: true,
        completenessScore: true,
        accuracyScore: true,
        confidence: true,
      }
    });

    if (!artifact) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Artifact not found', 404);
    }

    return createSuccessResponse(ctx, { artifact });

  } catch (error) {
    return handleApiError(ctx, error);
  }
}
