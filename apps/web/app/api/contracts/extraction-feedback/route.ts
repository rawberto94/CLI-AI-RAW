/**
 * Extraction Feedback API (Legacy compatibility)
 * 
 * Records user corrections and confirmations for extraction learning.
 * This is the legacy endpoint - new clients should use /api/contracts/[id]/feedback
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { getSessionTenantId } from '@/lib/tenant-server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const tenantId = getSessionTenantId(session)
    
    // Check if it's batch or single feedback
    if (Array.isArray(body.feedback)) {
      return handleBatchFeedback(body as BatchFeedbackRequest, tenantId)
    } else {
      return handleSingleFeedback(body as FeedbackRequest, tenantId)
    }
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Failed to record feedback', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function handleSingleFeedback(body: FeedbackRequest, tenantId: string): Promise<NextResponse> {
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
    return NextResponse.json(
      { error: 'contractId and fieldName are required' },
      { status: 400 }
    )
  }

  // Verify contract exists
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    select: { id: true, contractType: true }
  })

  if (!contract) {
    return NextResponse.json(
      { error: 'Contract not found' },
      { status: 404 }
    )
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
    modelUsed: 'gpt-4-turbo',
    promptVersion: 'v2',
  }

  await prisma.extractionCorrection.create({ data })

  return NextResponse.json({
    success: true,
    message: wasCorrect ? 'Confirmation recorded' : 'Correction recorded',
    fieldName
  })
}

async function handleBatchFeedback(body: BatchFeedbackRequest, tenantId: string): Promise<NextResponse> {
  const { contractId, contractType, feedback } = body

  if (!contractId || !feedback || !Array.isArray(feedback)) {
    return NextResponse.json(
      { error: 'contractId and feedback array are required' },
      { status: 400 }
    )
  }

  // Verify contract exists
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    select: { id: true, contractType: true }
  })

  if (!contract) {
    return NextResponse.json(
      { error: 'Contract not found' },
      { status: 404 }
    )
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
      modelUsed: 'gpt-4-turbo',
      promptVersion: 'v2',
    }

    await prisma.extractionCorrection.create({ data })

    if (item.wasCorrect) {
      correctCount++
    } else {
      correctionCount++
    }
  }

  return NextResponse.json({
    success: true,
    message: `Recorded ${correctCount} confirmations and ${correctionCount} corrections`,
    stats: { confirmations: correctCount, corrections: correctionCount }
  })
}

// ============================================================================
// GET: Retrieve learning stats and insights
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const tenantId = getSessionTenantId(session)
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'stats'
    const fieldName = searchParams.get('field')

    switch (action) {
      case 'stats':
        return await getOverallStats(tenantId)

      case 'field':
        if (!fieldName) {
          return NextResponse.json(
            { error: 'field parameter required for field stats' },
            { status: 400 }
          )
        }
        return await getFieldStats(tenantId, fieldName)

      case 'insights':
        return await getInsights(tenantId)

      case 'all-fields':
        return await getAllFieldStats(tenantId)

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Failed to retrieve learning stats', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function getOverallStats(tenantId: string): Promise<NextResponse> {
  const corrections = await prisma.extractionCorrection.findMany({
    where: { contract: { tenantId } },
    select: { wasCorrect: true }
  })

  const total = corrections.length
  const correct = corrections.filter(c => c.wasCorrect).length
  
  return NextResponse.json({
    success: true,
    stats: {
      totalFeedback: total,
      correctExtractions: correct,
      corrections: total - correct,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : null,
    }
  })
}

async function getFieldStats(tenantId: string, fieldName: string): Promise<NextResponse> {
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

  return NextResponse.json({
    success: true,
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

async function getAllFieldStats(tenantId: string): Promise<NextResponse> {
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

  return NextResponse.json({
    success: true,
    fieldStats
  })
}

async function getInsights(tenantId: string): Promise<NextResponse> {
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

  return NextResponse.json({
    success: true,
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
