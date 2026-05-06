import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createErrorResponse, createSuccessResponse } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { auditLog, AuditAction } from '@/lib/security/audit';

import type { ContractApiContext } from '@/lib/contracts/server/context';

const categoryPostSchema = z.object({
  force: z.boolean().default(false),
  useAISelection: z.boolean().default(true),
});

async function getPrismaClient() {
  const { prisma } = await import('@/lib/prisma');
  return prisma;
}

export async function getContractCategory(
  context: ContractApiContext,
  contractId: string,
) {
  const prisma = await getPrismaClient();
  const tenantId = context.tenantId;

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    select: {
      id: true,
      contractCategoryId: true,
      categoryL1: true,
      categoryL2: true,
      contractType: true,
      metadata: true,
      classifiedAt: true,
    },
  });

  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  const currentCategory = contract.contractCategoryId
    ? await prisma.taxonomyCategory.findUnique({
        where: { id: contract.contractCategoryId },
        include: {
          parent: {
            select: { id: true, name: true, color: true, icon: true },
          },
        },
      })
    : null;

  const meta = (contract.metadata as any) || {};
  const categorization = meta._categorization || meta._pendingCategorization;
  const alternatives = categorization?.taxonomy?.alternatives
    || categorization?.suggestedTaxonomy?.alternatives
    || [];

  const l1Categories = await prisma.taxonomyCategory.findMany({
    where: { tenantId, level: 0, isActive: true },
    select: { id: true, name: true, color: true, icon: true },
    orderBy: { sortOrder: 'asc' },
  });

  return createSuccessResponse(context, {
    success: true,
    data: {
      contractId,
      current: currentCategory
        ? {
            id: currentCategory.id,
            name: currentCategory.name,
            color: currentCategory.color,
            icon: currentCategory.icon,
            level: currentCategory.level,
            parent: currentCategory.parent,
            l1: contract.categoryL1,
            l2: contract.categoryL2,
          }
        : null,
      contractType: contract.contractType,
      classifiedAt: contract.classifiedAt,
      confidence: categorization?.overallConfidence || null,
      matchScore: categorization?.taxonomy?.categoryL2?.matchScore
        || categorization?.taxonomy?.categoryL1?.matchScore
        || null,
      alternatives,
      needsReview: !!meta._pendingCategorization?.needsReview,
      reviewReason: meta._pendingCategorization?.reviewReason || null,
      availableCategories: l1Categories,
    },
  });
}

export async function putContractCategory(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  const prisma = await getPrismaClient();
  const tenantId = context.tenantId;
  const body = await request.json();
  const { categoryId, feedbackType = 'correction' } = body;

  if (!categoryId && feedbackType !== 'rejection') {
    return createErrorResponse(context, 'BAD_REQUEST', 'categoryId is required', 400);
  }

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    select: {
      id: true,
      contractCategoryId: true,
      categoryL1: true,
      categoryL2: true,
      contractType: true,
      metadata: true,
      rawText: true,
    },
  });

  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  const newCategory = categoryId
    ? await prisma.taxonomyCategory.findUnique({
        where: { id: categoryId },
        include: {
          parent: { select: { id: true, name: true } },
        },
      })
    : null;

  if (categoryId && !newCategory) {
    return createErrorResponse(context, 'NOT_FOUND', 'Category not found', 404);
  }

  let newL1Name: string | null = null;
  let newL2Name: string | null = null;

  if (newCategory) {
    if (newCategory.level === 0) {
      newL1Name = newCategory.name;
      newL2Name = null;
    } else if (newCategory.level === 1) {
      newL2Name = newCategory.name;
      newL1Name = newCategory.parent?.name || null;
    }
  }

  const originalCategoryId = contract.contractCategoryId;
  const wasCorrect = originalCategoryId === categoryId;
  const meta = (contract.metadata as any) || {};
  const categorization = meta._categorization || meta._pendingCategorization;
  const existingMeta = (contract.metadata as Record<string, unknown>) || {};

  await prisma.$transaction(async (tx) => {
    await tx.extractionCorrection.create({
      data: {
        tenantId,
        contractId,
        fieldName: 'category',
        originalValue: originalCategoryId || null,
        correctedValue: categoryId || null,
        confidence: categorization?.overallConfidence
          ? categorization.overallConfidence / 100
          : null,
        wasCorrect,
        source: 'ai',
        feedbackType,
        contractType: contract.contractType,
        documentLength: contract.rawText?.length || null,
        modelUsed: categorization?.metadata?.model || 'gpt-4o-mini',
        metadata: {
          originalL1: contract.categoryL1,
          originalL2: contract.categoryL2,
          newL1: newL1Name,
          newL2: newL2Name,
          matchScore: categorization?.taxonomy?.categoryL2?.matchScore
            || categorization?.taxonomy?.categoryL1?.matchScore
            || null,
          alternatives: categorization?.taxonomy?.alternatives?.slice(0, 3) || [],
        },
      },
    });

    await tx.contract.update({
      where: { id: contractId },
      data: {
        contractCategoryId: categoryId,
        categoryL1: newL1Name,
        categoryL2: newL2Name,
        classifiedAt: new Date(),
        metadata: JSON.parse(JSON.stringify({
          ...existingMeta,
          _categorization: {
            ...meta._categorization,
            manualOverride: feedbackType !== 'confirmation',
            overriddenAt: new Date().toISOString(),
            overriddenBy: context.userId,
          },
          _pendingCategorization: undefined,
        })),
        updatedAt: new Date(),
      },
    });
  });

  await auditLog({
    action: AuditAction.CONTRACT_UPDATED,
    resourceType: 'contract',
    resourceId: contractId,
    userId: context.userId,
    tenantId,
    metadata: { action: 'category_changed', categoryId, feedbackType: feedbackType || 'manual' },
  }).catch((error) => logger.error('[Category] Audit log failed:', error));

  return createSuccessResponse(context, {
    success: true,
    data: {
      categoryId,
      categoryL1: newL1Name,
      categoryL2: newL2Name,
      feedbackRecorded: true,
      wasCorrect,
    },
  });
}

export async function postContractCategory(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  const prisma = await getPrismaClient();
  const tenantId = context.tenantId;
  const body = await request.json();

  const validated = categoryPostSchema.safeParse(body);
  if (!validated.success) {
    return createErrorResponse(
      context,
      'VALIDATION_ERROR',
      validated.error.errors.map((error) => error.message).join(', '),
      400,
    );
  }

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    select: { id: true, status: true },
  });

  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  const { queueCategorizationJob } = await import('@repo/workers/categorization-worker');
  const jobId = await queueCategorizationJob({
    contractId,
    tenantId,
    forceRecategorize: validated.data.force,
    autoApply: true,
    autoApplyThreshold: 0.7,
    source: 'manual',
  });

  return createSuccessResponse(context, {
    success: true,
    data: {
      jobId,
      message: 'Categorization job queued',
    },
  });
}