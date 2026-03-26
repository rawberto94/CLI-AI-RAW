/**
 * Extraction Feedback API (Legacy compatibility)
 * 
 * Records user corrections and confirmations for extraction learning.
 * This is the legacy endpoint - new clients should use /api/contracts/[id]/feedback
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { contractService } from 'data-orchestration/services'
import type { Prisma } from '@prisma/client'
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { invalidateLearnedHintsCache } from '@/lib/ai/self-improving-prompt-loop';

const feedbackItemSchema = z.object({
  fieldName: z.string().min(1, 'fieldName is required'),
  extractedValue: z.unknown().optional(),
  correctedValue: z.unknown().optional(),
  wasCorrect: z.boolean(),
  extractionSource: z.string().default('ai'),
  extractionConfidence: z.number(),
})

const singleFeedbackSchema = z.object({
  contractId: z.string().min(1, 'contractId is required'),
  fieldName: z.string().min(1, 'fieldName is required'),
  extractedValue: z.unknown().optional(),
  correctedValue: z.unknown().optional(),
  wasCorrect: z.boolean(),
  extractionSource: z.string().default('ai'),
  extractionConfidence: z.number(),
  contractType: z.string().optional(),
})

const batchFeedbackSchema = z.object({
  contractId: z.string().min(1, 'contractId is required'),
  contractType: z.string().optional(),
  feedback: z.array(feedbackItemSchema).min(1, 'feedback array must not be empty'),
})

// ============================================================================
// TYPES
// ============================================================================

interface FeedbackRequest {
  contractId: string
  fieldName: string
  extractedValue: unknown
  correctedValue?: unknown
  wasCorrect: boolean
  extractionSource: string
  extractionConfidence: number
  contractType?: string
}

interface BatchFeedbackRequest {
  contractId: string
  contractType?: string
  feedback: Array<{
    fieldName: string
    extractedValue: unknown
    correctedValue?: unknown
    wasCorrect: boolean
    extractionSource: string
    extractionConfidence: number
  }>
}

// ============================================================================
// HANDLERS
// ============================================================================

export const POST = withAuthApiHandler(async (request, ctx) => {

  const body = await request.json()
  const tenantId = ctx.tenantId

  // Check if it's batch or single feedback
  if (Array.isArray(body.feedback)) {
    let validated;
    try {
      validated = batchFeedbackSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', error.errors.map(e => e.message).join(', '), 400)
      }
      throw error;
    }
    return handleBatchFeedback(validated as BatchFeedbackRequest, tenantId, ctx)
  } else {
    let validated;
    try {
      validated = singleFeedbackSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', error.errors.map(e => e.message).join(', '), 400)
      }
      throw error;
    }
    return handleSingleFeedback(validated as FeedbackRequest, tenantId, ctx)
  }
});

async function handleSingleFeedback(body: FeedbackRequest, tenantId: string, ctx: any): Promise<ReturnType<typeof createSuccessResponse | typeof createErrorResponse>> {
  const {
    contractId,
    fieldName,
    extractedValue,
    correctedValue,
    wasCorrect,
    extractionSource,
    extractionConfidence,
    contractType
  } = body

  if (!contractId || !fieldName) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'contractId and fieldName are required', 400)
  }

  // Verify contract exists
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    select: { id: true, contractType: true }
  })

  if (!contract) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404)
  }

  // Record the feedback
  const data: Prisma.ExtractionCorrectionCreateInput = {
    contract: { connect: { id: contractId } },
    tenantId,
    fieldName,
    originalValue: String(extractedValue ?? ''),
    correctedValue: String(correctedValue ?? extractedValue ?? ''),
    confidence: extractionConfidence,
    wasCorrect,
    source: extractionSource || 'ai',
    feedbackType: wasCorrect ? 'confirmation' : 'correction',
    contractType: contractType || contract.contractType,
    modelUsed: 'gpt-4o',
    promptVersion: 'v2',
  }

  await prisma.extractionCorrection.create({ data })

  // Dispatch continuous-learning agent when user submits a correction (not just confirmation)
  if (!wasCorrect && correctedValue !== undefined) {
    // Invalidate the self-improving prompt cache so next extraction uses the new correction
    invalidateLearnedHintsCache(contractType || contract.contractType || undefined);

    try {
      // @ts-ignore - module may not be available in edge runtime
      const { runLearningFeedback } = await import('@repo/workers/agents/agent-dispatch');
      runLearningFeedback(contractId, tenantId, [
        { field: fieldName, originalValue: String(extractedValue ?? ''), correctedValue: String(correctedValue ?? ''), reason: extractionSource },
      ]).catch(() => {}); // fire-and-forget
    } catch (_) { /* worker import may fail in edge runtime — non-critical */ }
  }

  return createSuccessResponse(ctx, {
    message: wasCorrect ? 'Confirmation recorded' : 'Correction recorded',
    fieldName
  })
}

async function handleBatchFeedback(body: BatchFeedbackRequest, tenantId: string, ctx: any): Promise<ReturnType<typeof createSuccessResponse | typeof createErrorResponse>> {
  const { contractId, contractType, feedback } = body

  if (!contractId || !feedback || !Array.isArray(feedback)) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'contractId and feedback array are required', 400)
  }

  // Verify contract exists
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    select: { id: true, contractType: true }
  })

  if (!contract) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404)
  }

  let correctCount = 0
  let correctionCount = 0

  for (const item of feedback) {
    const data: Prisma.ExtractionCorrectionCreateInput = {
      contract: { connect: { id: contractId } },
      tenantId,
      fieldName: item.fieldName,
      originalValue: String(item.extractedValue ?? ''),
      correctedValue: String(item.correctedValue ?? item.extractedValue ?? ''),
      confidence: item.extractionConfidence,
      wasCorrect: item.wasCorrect,
      source: item.extractionSource || 'ai',
      feedbackType: item.wasCorrect ? 'confirmation' : 'correction',
      contractType: contractType || contract.contractType,
      modelUsed: 'gpt-4o',
      promptVersion: 'v2',
    }

    await prisma.extractionCorrection.create({ data })

    if (item.wasCorrect) {
      correctCount++
    } else {
      correctionCount++
    }
  }

  // Dispatch continuous-learning agent for any corrections in the batch
  if (correctionCount > 0) {
    // Invalidate the self-improving prompt cache
    invalidateLearnedHintsCache(contractType || contract.contractType || undefined);

    try {
      // @ts-ignore - module may not be available in edge runtime
      const { runLearningFeedback } = await import('@repo/workers/agents/agent-dispatch');
      const corrections = feedback
        .filter(item => !item.wasCorrect && item.correctedValue !== undefined)
        .map(item => ({
          field: item.fieldName,
          originalValue: String(item.extractedValue ?? ''),
          correctedValue: String(item.correctedValue ?? ''),
          reason: item.extractionSource,
        }));
      if (corrections.length > 0) {
        runLearningFeedback(contractId, tenantId, corrections).catch(() => {}); // fire-and-forget
      }
    } catch (_) { /* worker import may fail in edge runtime — non-critical */ }
  }

  return createSuccessResponse(ctx, {
    message: `Recorded ${correctCount} confirmations and ${correctionCount} corrections`,
    stats: { confirmations: correctCount, corrections: correctionCount }
  })
}

// ============================================================================
// GET: Retrieve learning stats and insights
// ============================================================================

export const GET = withAuthApiHandler(async (request, ctx) => {

  const tenantId = ctx.tenantId
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'stats'
  const fieldName = searchParams.get('field')

  switch (action) {
    case 'stats':
      return await getOverallStats(tenantId, ctx)

    case 'field':
      if (!fieldName) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'field parameter required for field stats', 400)
      }
      return await getFieldStats(tenantId, fieldName, ctx)

    case 'insights':
      return await getInsights(tenantId, ctx)

    case 'all-fields':
      return await getAllFieldStats(tenantId, ctx)

    default:
      return createErrorResponse(ctx, 'VALIDATION_ERROR', `Unknown action: ${action}`, 400)
  }
});

async function getOverallStats(tenantId: string, ctx: any) {
  const corrections = await prisma.extractionCorrection.findMany({
    where: { contract: { tenantId } },
    select: { wasCorrect: true }
  })

  const total = corrections.length
  const correct = corrections.filter(c => c.wasCorrect).length
  
  return createSuccessResponse(ctx, {
    stats: {
      totalFeedback: total,
      correctExtractions: correct,
      corrections: total - correct,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : null,
    }
  })
}

async function getFieldStats(tenantId: string, fieldName: string, ctx: any) {
  const corrections = await prisma.extractionCorrection.findMany({
    where: { 
      contract: { tenantId },
      fieldName
    },
    select: { wasCorrect: true, confidence: true }
  })

  const total = corrections.length
  const correct = corrections.filter(c => c.wasCorrect).length
  const avgConfidence = corrections.length > 0
    ? corrections.reduce((sum, c) => sum + Number(c.confidence || 0), 0) / corrections.length
    : null

  return createSuccessResponse(ctx, {
    fieldStats: {
      fieldName,
      totalFeedback: total,
      correctExtractions: correct,
      corrections: total - correct,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : null,
      averageConfidence: avgConfidence ? Math.round(avgConfidence * 100) / 100 : null,
    }
  })
}

async function getAllFieldStats(tenantId: string, ctx: any) {
  const corrections = await prisma.extractionCorrection.findMany({
    where: { contract: { tenantId } },
    select: { fieldName: true, wasCorrect: true }
  })

  const byField = corrections.reduce((acc, c) => {
    if (!acc[c.fieldName]) {
      acc[c.fieldName] = { correct: 0, total: 0 }
    }
    acc[c.fieldName].total++
    if (c.wasCorrect) acc[c.fieldName].correct++
    return acc
  }, {} as Record<string, { correct: number; total: number }>)

  const fieldStats = Object.entries(byField).map(([field, stats]) => ({
    field,
    total: stats.total,
    correct: stats.correct,
    accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : null,
  })).sort((a, b) => (a.accuracy || 0) - (b.accuracy || 0))

  return createSuccessResponse(ctx, {
    fieldStats
  })
}

async function getInsights(tenantId: string, ctx: any) {
  const corrections = await prisma.extractionCorrection.findMany({
    where: { 
      contract: { tenantId },
      wasCorrect: false
    },
    select: { 
      fieldName: true,
      contractType: true,
      originalValue: true,
      correctedValue: true,
    }
  })

  // Find most problematic fields
  const fieldCounts = corrections.reduce((acc, c) => {
    acc[c.fieldName] = (acc[c.fieldName] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const problematicFields = Object.entries(fieldCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([field, count]) => ({ field, errorCount: count }))

  // Find most problematic contract types
  const typeCounts = corrections.reduce((acc, c) => {
    const type = c.contractType || 'unknown'
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const problematicTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ contractType: type, errorCount: count }))

  return createSuccessResponse(ctx, {
    insights: {
      totalErrors: corrections.length,
      problematicFields,
      problematicContractTypes: problematicTypes,
      recommendations: generateRecommendations(problematicFields),
    }
  })
}

function generateRecommendations(problematicFields: Array<{ field: string; errorCount: number }>): string[] {
  const recommendations: string[] = []

  for (const { field, errorCount } of problematicFields) {
    if (errorCount >= 10) {
      recommendations.push(`Consider adding few-shot examples for "${field}" field (${errorCount} errors)`)
    } else if (errorCount >= 5) {
      recommendations.push(`Review extraction prompt for "${field}" field (${errorCount} errors)`)
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('Extraction performance is good. Continue monitoring.')
  }

  return recommendations
}
