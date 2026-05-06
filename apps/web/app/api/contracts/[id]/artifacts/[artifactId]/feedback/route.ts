/**
 * Artifact Feedback API Route
 * 
 * Allows users to rate, provide feedback on, and verify artifacts.
 * Uses existing Prisma schema fields: userRating, feedbackNotes, feedbackBy,
 * feedbackAt, isUserVerified, verifiedBy, verifiedAt.
 */

import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import {
  getContractArtifactFeedback,
  postContractArtifactFeedback,
} from '@/lib/contracts/server/artifacts';

/**
 * POST /api/contracts/[id]/artifacts/[artifactId]/feedback
 * Submit feedback (rating + notes) for an artifact
 * 
 * Body: { rating?: number (1-5), notes?: string, verified?: boolean, userId: string }
 */
export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId, artifactId } = await (ctx as any).params as { id: string; artifactId: string };

  return postContractArtifactFeedback(request, ctx, contractId, artifactId);
})

/**
 * GET /api/contracts/[id]/artifacts/[artifactId]/feedback
 * Get feedback data for an artifact
 */
export const GET = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId, artifactId } = await (ctx as any).params as { id: string; artifactId: string };

  return getContractArtifactFeedback(ctx, contractId, artifactId);
})
