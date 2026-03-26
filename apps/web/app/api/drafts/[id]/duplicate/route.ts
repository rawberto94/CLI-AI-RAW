/**
 * POST /api/drafts/:id/duplicate
 *
 * Duplicates an existing draft, resetting status to DRAFT.
 */

import { NextRequest } from 'next/server';
import {
  withAuthApiHandler,
  createSuccessResponse,
  createErrorResponse,
  type AuthenticatedApiContext,
} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export const POST = withAuthApiHandler(
  async (request: NextRequest, ctx: AuthenticatedApiContext) => {
    const { tenantId, userId } = ctx;
    const draftId = ctx.params?.id as string;

    if (!draftId) {
      return createErrorResponse('Draft ID is required', 400, ctx.requestId);
    }

    try {
      // Fetch the source draft
      const source = await prisma.contractDraft.findFirst({
        where: { id: draftId, tenantId },
      });

      if (!source) {
        return createErrorResponse('Draft not found', 404, ctx.requestId);
      }

      // Generate a unique title
      const timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[T:]/g, '-');
      const newTitle = `${source.title} (Copy ${timestamp})`;

      const duplicate = await prisma.contractDraft.create({
        data: {
          tenantId,
          templateId: source.templateId,
          title: newTitle,
          type: source.type,
          sourceType: source.sourceType,
          sourceContractId: source.sourceContractId,
          content: source.content,
          clauses: source.clauses as object,
          variables: source.variables as object,
          structure: {
            ...(source.structure as object || {}),
            duplicatedFrom: source.id,
            duplicatedAt: new Date().toISOString(),
          },
          status: 'DRAFT',
          version: 1,
          isLocked: false,
          estimatedValue: source.estimatedValue,
          currency: source.currency,
          proposedStartDate: source.proposedStartDate,
          proposedEndDate: source.proposedEndDate,
          externalParties: source.externalParties as object,
          aiPrompt: source.aiPrompt,
          aiModel: source.aiModel,
          generationParams: source.generationParams as object,
          currentStep: null,
          completionPercent: 0,
          approvalWorkflow: [],
          createdBy: userId,
        },
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          createdAt: true,
        },
      });

      logger.info('Draft duplicated', {
        sourceId: draftId,
        duplicateId: duplicate.id,
        tenantId,
        userId,
      });

      return createSuccessResponse(
        { draft: duplicate, editUrl: `/drafting?draftId=${duplicate.id}` },
        201,
        ctx.requestId,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to duplicate draft';
      logger.error('Draft duplication failed', { draftId, tenantId, error: msg });
      return createErrorResponse('Failed to duplicate draft', 500, ctx.requestId);
    }
  },
);
