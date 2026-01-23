/**
 * Contract Extraction Feedback API
 * POST /api/contracts/[id]/feedback - Record user corrections for learning
 * GET /api/contracts/[id]/feedback - Get feedback history
 * 
 * This API enables the continuous learning loop by:
 * 1. Recording user corrections to AI extractions
 * 2. Tracking field-level accuracy over time
 * 3. Enabling AI prompt improvements based on patterns
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { getSessionTenantId } from '@/lib/tenant-server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

// ============================================================================
// TYPES
// ============================================================================

interface FieldFeedback {
  fieldName: string
  originalValue: unknown
  correctedValue: unknown
  extractionConfidence: number
  extractionSource: string
  wasCorrect: boolean
  context?: {
    contractType?: string
    pageNumber?: number
    sourceText?: string
  }
}

interface FeedbackRequest {
  feedbackType: 'correction' | 'confirmation' | 'rejection'
  fields: FieldFeedback[]
  sessionId?: string
  notes?: string
}

// ============================================================================
// POST - Record feedback
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: contractId } = await params
    const tenantId = getSessionTenantId(session)
    
    const body: FeedbackRequest = await request.json()
    const { feedbackType, fields } = body

    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      return NextResponse.json(
        { success: false, error: 'fields array is required' },
        { status: 400 }
      )
    }

    // Verify contract exists
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { id: true, contractType: true, fileName: true, rawText: true }
    })

    if (!contract) {
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      )
    }

    // Record each piece of feedback
    const feedbackRecords = await Promise.all(
      fields.map(async (field) => {
        // Check for existing correction on this field
        const existing = await prisma.extractionCorrection.findFirst({
          where: {
            contractId,
            fieldName: field.fieldName,
          }
        })

        const data: Prisma.ExtractionCorrectionCreateInput = {
          contract: { connect: { id: contractId } },
          tenantId,
          fieldName: field.fieldName,
          originalValue: String(field.originalValue ?? ''),
          correctedValue: String(field.correctedValue ?? ''),
          confidence: field.extractionConfidence,
          wasCorrect: field.wasCorrect,
          source: field.extractionSource || 'ai',
          feedbackType,
          contractType: contract.contractType,
          documentLength: contract.rawText?.length ?? null,
          modelUsed: 'gpt-4-turbo',
          promptVersion: 'v2',
          metadata: field.context ? JSON.parse(JSON.stringify(field.context)) : {},
        }

        if (existing) {
          return prisma.extractionCorrection.update({
            where: { id: existing.id },
            data: {
              originalValue: data.originalValue,
              correctedValue: data.correctedValue,
              confidence: data.confidence,
              wasCorrect: data.wasCorrect,
              feedbackType: data.feedbackType,
              metadata: data.metadata,
            }
          })
        } else {
          return prisma.extractionCorrection.create({ data })
        }
      })
    )

    // Update learning metrics in contract metadata
    const correctCount = fields.filter(f => f.wasCorrect).length
    const incorrectCount = fields.filter(f => !f.wasCorrect).length
    
    const currentContract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { metadata: true }
    })

    const existingMetadata = (currentContract?.metadata as Record<string, unknown>) || {}

    await prisma.contract.update({
      where: { id: contractId },
      data: {
        metadata: {
          ...existingMetadata,
          feedbackStats: {
            totalFeedback: fields.length,
            correctExtractions: correctCount,
            corrections: incorrectCount,
            lastFeedbackAt: new Date().toISOString(),
          }
        }
      }
    })

    // Analyze patterns for this contract type
    const patterns = await analyzeCorrectionsForPatterns(tenantId, contract.contractType || 'unknown')

    return NextResponse.json({
      success: true,
      data: {
        recorded: feedbackRecords.length,
        correctExtractions: correctCount,
        corrections: incorrectCount,
        patternsDetected: patterns.length,
        patterns: patterns.slice(0, 5), // Top 5 patterns
        learningImpact: calculateLearningImpact(correctCount, incorrectCount),
      }
    })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to record feedback' },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET - Retrieve feedback history
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: contractId } = await params
    const tenantId = getSessionTenantId(session)
    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view') || 'history'

    // Verify contract exists
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { id: true, contractType: true, metadata: true }
    })

    if (!contract) {
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      )
    }

    if (view === 'history') {
      // Get correction history for this contract
      const corrections = await prisma.extractionCorrection.findMany({
        where: { contractId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })

      const metadata = contract.metadata as Record<string, unknown>
      const feedbackStats = metadata?.feedbackStats as Record<string, number> | undefined

      return NextResponse.json({
        success: true,
        data: {
          corrections: corrections.map(c => ({
            id: c.id,
            fieldName: c.fieldName,
            originalValue: c.originalValue,
            correctedValue: c.correctedValue,
            wasCorrect: c.wasCorrect,
            feedbackType: c.feedbackType,
            createdAt: c.createdAt,
          })),
          stats: feedbackStats || {
            totalFeedback: 0,
            correctExtractions: 0,
            corrections: 0,
          },
        }
      })
    }

    if (view === 'accuracy') {
      // Calculate field-level accuracy for this contract type
      const allCorrections = await prisma.extractionCorrection.findMany({
        where: {
          contractType: contract.contractType,
          contract: { tenantId },
        },
        select: {
          fieldName: true,
          wasCorrect: true,
        }
      })

      const fieldStats = allCorrections.reduce((acc, c) => {
        if (!acc[c.fieldName]) {
          acc[c.fieldName] = { correct: 0, total: 0 }
        }
        acc[c.fieldName].total++
        if (c.wasCorrect) acc[c.fieldName].correct++
        return acc
      }, {} as Record<string, { correct: number; total: number }>)

      const fieldAccuracy = Object.entries(fieldStats).map(([field, stats]) => ({
        field,
        accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
        sampleSize: stats.total,
      })).sort((a, b) => a.accuracy - b.accuracy) // Worst accuracy first

      return NextResponse.json({
        success: true,
        data: {
          contractType: contract.contractType,
          fieldAccuracy,
          overallAccuracy: allCorrections.length > 0 
            ? Math.round((allCorrections.filter(c => c.wasCorrect).length / allCorrections.length) * 100)
            : null,
          totalSamples: allCorrections.length,
        }
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid view parameter'
    }, { status: 400 })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to get feedback history' },
      { status: 500 }
    )
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function analyzeCorrectionsForPatterns(
  tenantId: string,
  contractType: string
): Promise<Array<{ field: string; pattern: string; occurrences: number }>> {
  const patterns: Array<{ field: string; pattern: string; occurrences: number }> = []

  try {
    // Get all corrections for this contract type
    const corrections = await prisma.extractionCorrection.findMany({
      where: {
        contractType,
        contract: { tenantId },
      },
      select: {
        fieldName: true,
        originalValue: true,
        correctedValue: true,
      }
    })

    // Group by field and find patterns
    const byField = corrections.reduce((acc, c) => {
      if (!acc[c.fieldName]) acc[c.fieldName] = []
      acc[c.fieldName].push({ ai: c.originalValue, user: c.correctedValue })
      return acc
    }, {} as Record<string, Array<{ ai: string | null; user: string | null }>>)

    for (const [field, values] of Object.entries(byField)) {
      if (values.length >= 3) {
        // Find common patterns
        const patternCount = values.reduce((acc, v) => {
          const pattern = identifyPattern(v.ai, v.user)
          acc[pattern] = (acc[pattern] || 0) + 1
          return acc
        }, {} as Record<string, number>)

        const topPattern = Object.entries(patternCount).sort((a, b) => b[1] - a[1])[0]
        if (topPattern && topPattern[1] >= 2) {
          patterns.push({
            field,
            pattern: topPattern[0],
            occurrences: topPattern[1],
          })
        }
      }
    }
  } catch {
    // Pattern analysis failed silently
  }

  return patterns
}

function identifyPattern(aiValue: string | null, userValue: string | null): string {
  if (!aiValue && userValue) return 'missing_extraction'
  if (aiValue && !userValue) return 'false_positive'
  
  const ai = String(aiValue || '').toLowerCase()
  const user = String(userValue || '').toLowerCase()
  
  if (ai === user) return 'case_mismatch'
  if (ai.includes(user) || user.includes(ai)) return 'partial_match'
  if (ai.replace(/[^\w]/g, '') === user.replace(/[^\w]/g, '')) return 'formatting'
  
  // Check for date format issues
  const datePattern = /\d{1,4}[-\/]\d{1,2}[-\/]\d{1,4}/
  if (datePattern.test(ai) && datePattern.test(user)) return 'date_format'
  
  // Check for number/currency issues
  const numPattern = /[\d,\.]+/
  if (numPattern.test(ai) && numPattern.test(user)) return 'number_format'
  
  return 'value_mismatch'
}

function calculateLearningImpact(correct: number, incorrect: number): {
  description: string
  value: number
  color: string
} {
  const total = correct + incorrect
  if (total === 0) {
    return { description: 'No data', value: 0, color: 'gray' }
  }

  const accuracy = correct / total
  if (accuracy >= 0.9) {
    return { description: 'Excellent extraction accuracy', value: accuracy * 100, color: 'green' }
  } else if (accuracy >= 0.7) {
    return { description: 'Good accuracy, minor improvements needed', value: accuracy * 100, color: 'blue' }
  } else if (accuracy >= 0.5) {
    return { description: 'Moderate accuracy, learning in progress', value: accuracy * 100, color: 'yellow' }
  } else {
    return { description: 'Low accuracy, significant learning opportunity', value: accuracy * 100, color: 'red' }
  }
}
