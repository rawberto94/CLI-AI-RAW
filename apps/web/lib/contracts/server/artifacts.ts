import { NextRequest } from 'next/server';

import { getContractQueue } from '@repo/utils/queue/contract-queue';

import { createErrorResponse, createSuccessResponse } from '@/lib/api-middleware';

import type { ContractApiContext } from '@/lib/contracts/server/context';

const RAG_TRIGGER_ARTIFACT_TYPES = [
  'OVERVIEW',
  'CLAUSES',
  'RATES',
  'FINANCIAL',
  'RISK',
] as const;

async function getPrismaClient() {
  const { prisma } = await import('@/lib/prisma');
  return prisma;
}

export async function getContractArtifacts(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  const startTime = Date.now();
  const tenantId = context.tenantId;

  if (!tenantId) {
    return createErrorResponse(context, 'BAD_REQUEST', 'Tenant ID is required', 400);
  }

  if (!contractId) {
    return createErrorResponse(context, 'BAD_REQUEST', 'Contract ID is required', 400);
  }

  const url = new URL(request.url);
  const type = url.searchParams.get('type') || undefined;
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));

  const { artifactService } = await import('@/lib/data-orchestration');
  const result = await artifactService.getContractArtifacts(contractId, tenantId, { type, page, limit });

  if (!result.success) {
    return createErrorResponse(context, 'INTERNAL_ERROR', result.error?.message ?? 'Unknown error', 500);
  }

  interface ArtifactData {
    id?: string;
    type?: string;
    data?: Record<string, unknown> | null;
    confidence?: number;
  }

  const artifactsData = result.data ?? [];
  const transformedArtifacts = (artifactsData as ArtifactData[]).map((artifact) => {
    const artifactData = (artifact.data as Record<string, unknown>) || {};
    return {
      id: artifact.id,
      type: artifact.type,
      data: artifact.data,
      confidence: Number(artifact.confidence || 0),
      completeness: (artifactData.completeness as number) || 0,
    };
  });

  return createSuccessResponse(
    context,
    {
      artifacts: transformedArtifacts,
      pagination: {
        page,
        limit,
        total: transformedArtifacts.length,
        hasMore: transformedArtifacts.length === limit,
      },
    },
    {
      headers: {
        'X-Response-Time': `${Date.now() - startTime}ms`,
        'X-Data-Source': 'data-orchestration',
        'X-Artifact-Count': String(transformedArtifacts.length),
      },
    },
  );
}

export async function getContractArtifact(
  context: ContractApiContext,
  contractId: string,
  artifactId: string,
) {
  const { dbAdaptor } = await import('data-orchestration');

  const artifact = await dbAdaptor.getClient().artifact.findFirst({
    where: { id: artifactId, contractId, tenantId: context.tenantId },
    include: {
      editHistory: {
        orderBy: { version: 'desc' },
        take: 10,
      },
    },
  });

  if (!artifact) {
    return createErrorResponse(context, 'NOT_FOUND', 'Artifact not found', 404);
  }

  return createSuccessResponse(context, artifact);
}

export async function putContractArtifact(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
  artifactId: string,
) {
  const body = await request.json();
  const { updates, reason } = body;
  const prisma = await getPrismaClient();

  const artifact = await prisma.artifact.findFirst({
    where: { id: artifactId, contractId, tenantId: context.tenantId },
    select: { id: true },
  });

  if (!artifact) {
    return createErrorResponse(context, 'NOT_FOUND', 'Artifact not found', 404);
  }

  if (!updates) {
    return createErrorResponse(context, 'BAD_REQUEST', 'updates are required', 400);
  }

  const { editableArtifactService } = await import('data-orchestration/services');
  const updatedArtifact = await editableArtifactService.updateArtifact(
    artifactId,
    updates,
    context.userId,
    reason,
  );

  try {
    const { UserFeedbackLearner } = await import('@repo/workers/agents/user-feedback-learner');
    const learner = new UserFeedbackLearner();

    learner.processFeedback({
      feedbackType: 'artifact_edit' as any,
      artifactType: updatedArtifact.artifactType || 'unknown',
      originalData: updatedArtifact.previousContent ?? {},
      editedData: updates,
      timestamp: new Date(),
      userId: context.userId,
      tenantId: context.tenantId,
      comment: reason || undefined,
    }).catch(() => {
      // Feedback processing failures are non-critical.
    });
  } catch {
    // Feedback learning is optional.
  }

  try {
    await prisma.learningRecord.create({
      data: {
        tenantId: context.tenantId,
        artifactType: updatedArtifact.artifactType || 'unknown',
        field: 'artifact_content',
        correctionType: 'artifact_edit',
        confidence: 1.0,
        aiExtracted: JSON.stringify(updatedArtifact.previousContent ?? {}).slice(0, 2000),
        userCorrected: JSON.stringify(updates).slice(0, 2000),
      },
    });
  } catch {
    // Learning record insert is non-critical.
  }

  let ragReindexQueued = false;
  if (RAG_TRIGGER_ARTIFACT_TYPES.includes(updatedArtifact.artifactType as (typeof RAG_TRIGGER_ARTIFACT_TYPES)[number])) {
    try {
      const contractQueue = getContractQueue();
      await contractQueue.queueRAGIndexing(
        {
          contractId,
          tenantId: context.tenantId,
          artifactIds: [artifactId],
        },
        {
          priority: 15,
          delay: 2000,
        },
      );
      ragReindexQueued = true;
    } catch {
      // RAG re-indexing failures are non-critical.
    }
  }

  return createSuccessResponse(context, {
    artifact: updatedArtifact,
    message: ragReindexQueued
      ? 'Artifact updated successfully. AI search index will be updated shortly.'
      : 'Artifact updated successfully',
    ragReindexQueued,
  });
}

export async function postContractArtifactRegeneration(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  const prisma = await getPrismaClient();
  const body = await request.json();
  const { artifactType } = body;
  const tenantId = context.tenantId;

  if (!artifactType || !tenantId) {
    return createErrorResponse(context, 'BAD_REQUEST', 'Missing required fields: artifactType, tenantId', 400);
  }

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    select: { id: true, rawText: true, status: true },
  });

  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  if (!contract.rawText) {
    return createErrorResponse(
      context,
      'BAD_REQUEST',
      'Contract has no extracted text. Please reprocess the contract.',
      400,
    );
  }

  const { aiArtifactGeneratorService } = await import('data-orchestration/services');
  const result = await aiArtifactGeneratorService.generateArtifact(
    artifactType,
    contract.rawText,
    contractId,
    tenantId,
    {
      preferredMethod: 'ai',
      enableFallback: true,
      userId: context.userId,
    },
  );

  if (!result.success) {
    return createErrorResponse(context, 'INTERNAL_ERROR', 'Regeneration failed', 500);
  }

  return createSuccessResponse(context, {
    success: true,
    contractId,
    artifactType,
    artifact: result.data,
    confidence: result.confidence,
    completeness: result.completeness,
    validation: result.validation,
    method: result.method,
    processingTime: result.processingTime,
    regeneratedAt: new Date().toISOString(),
  });
}

export async function postContractArtifactByIdRegeneration(
  context: ContractApiContext,
  contractId: string,
  artifactId: string,
) {
  const prisma = await getPrismaClient();

  if (!context.tenantId) {
    return createErrorResponse(context, 'BAD_REQUEST', 'Tenant ID is required', 400);
  }

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId: context.tenantId },
    select: {
      id: true,
      fileName: true,
      rawText: true,
      status: true,
    },
  });

  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  if (!contract.rawText) {
    return createErrorResponse(
      context,
      'BAD_REQUEST',
      'Contract has no extracted text. Please reprocess the contract.',
      400,
    );
  }

  const artifact = await prisma.artifact.findFirst({
    where: { id: artifactId, contractId, tenantId: context.tenantId },
  });

  if (!artifact) {
    return createErrorResponse(context, 'NOT_FOUND', 'Artifact not found', 404);
  }

  await prisma.artifact.update({
    where: { id: artifactId },
    data: {
      validationStatus: 'PROCESSING',
      lastEditedAt: new Date(),
    },
  });

  void regenerateContractArtifactAsync(
    contractId,
    artifactId,
    artifact.type,
    contract.rawText,
    context.tenantId,
  ).catch(async (error) => {
    try {
      const { logger } = await import('@/lib/logger');
      logger.error('[ArtifactRegenerate] Background regeneration error:', error);
    } catch {
      // Logging is best-effort.
    }
  });

  return createSuccessResponse(context, {
    success: true,
    message: 'Artifact regeneration started',
    artifactId,
    contractId,
    type: artifact.type,
  });
}

async function regenerateContractArtifactAsync(
  contractId: string,
  artifactId: string,
  artifactType: string,
  rawText: string,
  tenantId: string,
) {
  const prisma = await getPrismaClient();

  try {
    const startTime = Date.now();
    const { aiArtifactGeneratorService } = await import('data-orchestration/services');

    const generateResult = await (aiArtifactGeneratorService.generateArtifact as any)(
      contractId,
      tenantId,
      artifactType,
      { rawText },
    );

    if (!generateResult.success || !generateResult.artifact) {
      throw new Error(generateResult.error || 'Failed to generate artifact');
    }

    const newContent = generateResult.artifact.data;
    const processingTime = Date.now() - startTime;

    await prisma.artifact.update({
      where: { id: artifactId },
      data: {
        validationStatus: 'COMPLETED',
        data: typeof newContent === 'string' ? JSON.parse(newContent) : newContent,
        processingTime,
        lastEditedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const { queueRAGReindex } = await import('@/lib/rag/reindex-helper');
    await queueRAGReindex({
      contractId,
      tenantId,
      reason: `artifact ${artifactType} regenerated`,
    });
  } catch (error: unknown) {
    await prisma.artifact.update({
      where: { id: artifactId },
      data: {
        validationStatus: 'FAILED',
        validationIssues: [{
          error: error instanceof Error ? error.message : 'Unknown error',
          failedAt: new Date().toISOString(),
        }],
        lastEditedAt: new Date(),
      },
    });
  }
}

export async function getContractArtifactRegenerationStatus(
  context: ContractApiContext,
  contractId: string,
  artifactId: string,
) {
  const prisma = await getPrismaClient();
  const artifact = await prisma.artifact.findFirst({
    where: { id: artifactId, contractId, tenantId: context.tenantId },
    select: {
      id: true,
      type: true,
      validationStatus: true,
      data: true,
      updatedAt: true,
    },
  });

  if (!artifact) {
    return createErrorResponse(context, 'NOT_FOUND', 'Artifact not found', 404);
  }

  return createSuccessResponse(context, {
    artifactId: artifact.id,
    type: artifact.type,
    status: artifact.validationStatus,
    data: artifact.data,
    updatedAt: artifact.updatedAt,
  });
}

export async function deleteContractArtifact(
  context: ContractApiContext,
  contractId: string,
  artifactId: string,
) {
  const { dbAdaptor } = await import('data-orchestration');

  const artifact = await dbAdaptor.getClient().artifact.findFirst({
    where: { id: artifactId, contractId, tenantId: context.tenantId },
    select: { id: true },
  });

  if (!artifact) {
    return createErrorResponse(context, 'NOT_FOUND', 'Artifact not found', 404);
  }

  await dbAdaptor.getClient().artifact.delete({
    where: { id: artifactId },
  });

  return createSuccessResponse(context, {
    message: 'Artifact deleted successfully',
  });
}

export async function postContractArtifactFeedback(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
  artifactId: string,
) {
  const body = await request.json();
  const { rating, notes, verified } = body;
  const prisma = await getPrismaClient();

  if (rating !== undefined && (typeof rating !== 'number' || rating < 1 || rating > 5)) {
    return createErrorResponse(context, 'BAD_REQUEST', 'Rating must be a number between 1 and 5', 400);
  }

  const artifact = await prisma.artifact.findFirst({
    where: { id: artifactId, contractId, tenantId: context.tenantId },
    select: { id: true },
  });

  if (!artifact) {
    return createErrorResponse(context, 'NOT_FOUND', 'Artifact not found', 404);
  }

  const updateData: Record<string, unknown> = {};
  const now = new Date();

  if (rating !== undefined) {
    updateData.userRating = rating;
    updateData.feedbackBy = context.userId;
    updateData.feedbackAt = now;
  }

  if (notes !== undefined) {
    updateData.feedbackNotes = notes;
    if (!updateData.feedbackBy) {
      updateData.feedbackBy = context.userId;
      updateData.feedbackAt = now;
    }
  }

  if (verified !== undefined) {
    updateData.isUserVerified = verified;
    updateData.verifiedBy = context.userId;
    updateData.verifiedAt = now;
  }

  if (Object.keys(updateData).length === 0) {
    return createErrorResponse(context, 'BAD_REQUEST', 'No feedback data provided. Send rating, notes, or verified.', 400);
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
    },
  });

  try {
    await prisma.learningRecord.create({
      data: {
        tenantId: context.tenantId,
        artifactType: updated.type || 'unknown',
        field: verified !== undefined ? 'verification' : 'rating',
        correctionType: verified !== undefined ? 'verification' : 'quality_feedback',
        confidence: rating ? rating / 5 : undefined,
        userCorrected: notes || (verified ? 'verified' : rating ? `rating_${rating}` : null),
      },
    });
  } catch {
    // Learning record insert is non-critical.
  }

  return createSuccessResponse(context, {
    success: true,
    artifact: updated,
  });
}

export async function getContractArtifactFeedback(
  context: ContractApiContext,
  contractId: string,
  artifactId: string,
) {
  const prisma = await getPrismaClient();
  const artifact = await prisma.artifact.findFirst({
    where: { id: artifactId, contractId, tenantId: context.tenantId },
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
    },
  });

  if (!artifact) {
    return createErrorResponse(context, 'NOT_FOUND', 'Artifact not found', 404);
  }

  return createSuccessResponse(context, { artifact });
}