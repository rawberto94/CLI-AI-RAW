import { logger } from '@/lib/logger';
/**
 * Draft Finalization API
 *
 * POST /api/drafts/[id]/finalize
 *
 * Validates that the draft is complete, sets status to FINALIZED,
 * and creates a corresponding Contract record from the draft.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';
import {
  getAuthenticatedApiContext,
  getApiContext,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from '@/lib/api-middleware';
import { auditLog, AuditAction } from '@/lib/security/audit';
import { checkRateLimit, rateLimitResponse, AI_RATE_LIMITS } from '@/lib/ai/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(
      getApiContext(request),
      'UNAUTHORIZED',
      'Authentication required',
      401,
      { retryable: false }
    );
  }

  try {
    const tenantId = await getApiTenantId(request);
    const rl = checkRateLimit(tenantId, ctx.userId, '/api/drafts/[id]/finalize', AI_RATE_LIMITS.standard);
    if (!rl.allowed) return rateLimitResponse(rl);

    const { id } = await params;

    // Fetch the draft
    const draft = await prisma.contractDraft.findFirst({
      where: { id, tenantId },
    });

    if (!draft) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Draft not found', 404, {
        retryable: false,
      });
    }

    // Validate status — must not already be finalized
    if (draft.status === 'FINALIZED') {
      return createErrorResponse(
        ctx,
        'CONFLICT',
        'Draft is already finalized',
        409,
        { retryable: false }
      );
    }

    // Enforce status transition: only APPROVED or IN_REVIEW drafts can be finalized
    const FINALIZABLE_STATUSES = ['APPROVED', 'IN_REVIEW', 'DRAFT'];
    if (!FINALIZABLE_STATUSES.includes(draft.status)) {
      return createErrorResponse(
        ctx,
        'VALIDATION_ERROR',
        `Cannot finalize a draft with status "${draft.status}". Draft must be in APPROVED, IN_REVIEW, or DRAFT status.`,
        422,
        { retryable: false }
      );
    }

    // Validate completeness — must have content
    if (!draft.content || (typeof draft.content === 'string' && draft.content.trim().length < 50)) {
      return createErrorResponse(
        ctx,
        'VALIDATION_ERROR',
        'Draft content is too short to finalize. Please add more content.',
        422,
        { retryable: false }
      );
    }

    // Validate title
    if (!draft.title || draft.title.trim().length === 0) {
      return createErrorResponse(
        ctx,
        'VALIDATION_ERROR',
        'Draft must have a title before finalizing.',
        422,
        { retryable: false }
      );
    }

    // Perform finalization in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update draft status to FINALIZED
      const finalizedDraft = await tx.contractDraft.update({
        where: { id },
        data: {
          status: 'FINALIZED',
          completionPercent: 100,
          currentStep: 'finalized',
          version: { increment: 1 },
        },
      });

      // 2. Create a Contract record from the draft
      // Field mapping: Contract model uses contractTitle, contractType, rawText,
      // uploadedBy, fileName (required), fileSize (required BigInt), mimeType (required)
      const draftContent = typeof draft.content === 'string'
        ? draft.content
        : JSON.stringify(draft.content);

      const contract = await tx.contract.create({
        data: {
          tenantId,
          contractTitle: draft.title,
          contractType: draft.type || 'CUSTOM',
          status: 'DRAFT',
          description: `Contract created from finalized draft: ${draft.title}`,
          rawText: draftContent,
          fileName: `${(draft.title || 'contract').replace(/[^a-zA-Z0-9-_ ]/g, '').slice(0, 100)}.html`,
          fileSize: BigInt(Buffer.byteLength(draftContent, 'utf8')),
          mimeType: 'text/html',
          originalName: draft.title || 'Untitled Draft',
          metadata: {
            sourceType: 'draft_finalization',
            sourceDraftId: id,
            aiGenerated: Boolean(draft.aiPrompt),
            finalizedAt: new Date().toISOString(),
            draftVersion: finalizedDraft.version,
          },
          uploadedBy: ctx.userId,
          tags: ['from-draft'],
          importSource: 'DRAFTING',
          signatureStatus: 'unsigned',
          signatureRequiredFlag: true,
        },
      });

      // 3. Link contract back to the draft (if sourceContractId field exists)
      await tx.contractDraft.update({
        where: { id },
        data: {
          sourceContractId: contract.id,
        },
      });

      return { draft: finalizedDraft, contract };
    });

    await auditLog({
      action: AuditAction.CONTRACT_UPDATED,
      resourceType: 'draft',
      resourceId: id,
      userId: ctx.userId,
      tenantId,
      metadata: { operation: 'finalize', title: draft.title, contractId: result.contract.id },
    }).catch(err => logger.error({ err }, '[Draft] Audit log failed'));

    return createSuccessResponse(ctx, {
      message: 'Draft finalized successfully',
      draft: {
        id: result.draft.id,
        status: result.draft.status,
        version: result.draft.version,
      },
      contract: {
        id: result.contract.id,
        title: result.contract.contractTitle,
        status: result.contract.status,
      },
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
