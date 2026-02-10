import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
/**
 * Extraction Accuracy API
 * GET /api/extraction/accuracy - Get extraction accuracy statistics
 * 
 * Provides insights into AI extraction performance based on user feedback
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/auth'
import { getSessionTenantId } from '@/lib/tenant-server'
import { analyticsService } from 'data-orchestration/services';

// ============================================================================
// GET - Get accuracy statistics
// ============================================================================

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401)
  }

  const tenantId = getSessionTenantId(session)
  const { searchParams } = new URL(request.url)
  const view = searchParams.get('view') || 'summary'
  const contractType = searchParams.get('contractType')

  // Base filter
  const whereClause = {
    contract: { tenantId },
    ...(contractType && { contractType }),
  }

  if (view === 'summary') {
    // Overall accuracy summary
    const corrections = await prisma.extractionCorrection.findMany({
      where: whereClause,
      select: {
        fieldName: true,
        wasCorrect: true,
        contractType: true,
        createdAt: true,
      }
    })

    const totalCount = corrections.length
    const correctCount = corrections.filter(c => c.wasCorrect).length
    const overallAccuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : null

    // Field-level breakdown
    const fieldStats = corrections.reduce((acc, c) => {
      if (!acc[c.fieldName]) {
        acc[c.fieldName] = { correct: 0, total: 0 }
      }
      acc[c.fieldName].total++
      if (c.wasCorrect) acc[c.fieldName].correct++
      return acc
    }, {} as Record<string, { correct: number; total: number }>)

    const fieldAccuracy = Object.entries(fieldStats)
      .map(([field, stats]) => ({
        field,
        accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
        sampleSize: stats.total,
      }))
      .sort((a, b) => a.accuracy - b.accuracy)

    // Contract type breakdown
    const typeStats = corrections.reduce((acc, c) => {
      const type = c.contractType || 'unknown'
      if (!acc[type]) {
        acc[type] = { correct: 0, total: 0 }
      }
      acc[type].total++
      if (c.wasCorrect) acc[type].correct++
      return acc
    }, {} as Record<string, { correct: number; total: number }>)

    const typeAccuracy = Object.entries(typeStats)
      .map(([type, stats]) => ({
        contractType: type,
        accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
        sampleSize: stats.total,
      }))
      .sort((a, b) => a.accuracy - b.accuracy)

    return createSuccessResponse(ctx, {
      success: true,
      data: {
        overview: {
          totalFeedback: totalCount,
          correctExtractions: correctCount,
          corrections: totalCount - correctCount,
          overallAccuracy,
        },
        fieldAccuracy,
        typeAccuracy,
        recommendations: generateRecommendations(fieldAccuracy, typeAccuracy),
      }
    })
  }

  if (view === 'patterns') {
    // Error pattern analysis
    const corrections = await prisma.extractionCorrection.findMany({
      where: {
        ...whereClause,
        wasCorrect: false,
      },
      select: {
        fieldName: true,
        originalValue: true,
        correctedValue: true,
        contractType: true,
      }
    })

    const patterns = analyzePatterns(corrections)

    return createSuccessResponse(ctx, {
      success: true,
      data: {
        totalErrors: corrections.length,
        patterns,
      }
    })
  }

  if (view === 'trends') {
    // Accuracy over time
    const corrections = await prisma.extractionCorrection.findMany({
      where: whereClause,
      select: {
        wasCorrect: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' }
    })

    // Group by week
    const weeklyTrends = corrections.reduce((acc, c) => {
      const weekStart = getWeekStart(c.createdAt)
      const key = weekStart.toISOString().split('T')[0]

      if (!acc[key]) {
        acc[key] = { correct: 0, total: 0, weekStart: key }
      }
      acc[key].total++
      if (c.wasCorrect) acc[key].correct++
      return acc
    }, {} as Record<string, { correct: number; total: number; weekStart: string }>)

    const trends = Object.values(weeklyTrends).map(week => ({
      weekStart: week.weekStart,
      accuracy: week.total > 0 ? Math.round((week.correct / week.total) * 100) : 0,
      sampleSize: week.total,
    }))

    return createSuccessResponse(ctx, {
      success: true,
      data: {
        trends,
        isImproving: isAccuracyImproving(trends),
      }
    })
  }

  return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid view parameter', 400)
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface FieldAccuracy {
  field: string
  accuracy: number
  sampleSize: number
}

interface TypeAccuracy {
  contractType: string
  accuracy: number
  sampleSize: number
}

function generateRecommendations(
  fieldAccuracy: FieldAccuracy[],
  typeAccuracy: TypeAccuracy[]
): string[] {
  const recommendations: string[] = []

  // Check for low-performing fields
  const lowFields = fieldAccuracy.filter(f => f.accuracy < 70 && f.sampleSize >= 5)
  if (lowFields.length > 0) {
    recommendations.push(
      `Consider adding few-shot examples for: ${lowFields.map(f => f.field).join(', ')}`
    )
  }

  // Check for problematic contract types
  const lowTypes = typeAccuracy.filter(t => t.accuracy < 70 && t.sampleSize >= 5)
  if (lowTypes.length > 0) {
    recommendations.push(
      `Review extraction prompts for contract types: ${lowTypes.map(t => t.contractType).join(', ')}`
    )
  }

  // General recommendations based on data volume
  const totalSamples = fieldAccuracy.reduce((sum, f) => sum + f.sampleSize, 0)
  if (totalSamples < 100) {
    recommendations.push(
      'Collect more feedback data to improve extraction accuracy (minimum 100 samples recommended)'
    )
  }

  if (recommendations.length === 0) {
    recommendations.push('Extraction accuracy is performing well. Continue monitoring.')
  }

  return recommendations
}

interface Correction {
  fieldName: string
  originalValue: string | null
  correctedValue: string | null
  contractType: string | null
}

function analyzePatterns(corrections: Correction[]): Array<{
  pattern: string
  count: number
  fields: string[]
  description: string
}> {
  const patternCounts: Record<string, { count: number; fields: Set<string> }> = {}

  for (const c of corrections) {
    const pattern = identifyPattern(c.originalValue, c.correctedValue)
    
    if (!patternCounts[pattern]) {
      patternCounts[pattern] = { count: 0, fields: new Set() }
    }
    patternCounts[pattern].count++
    patternCounts[pattern].fields.add(c.fieldName)
  }

  const patternDescriptions: Record<string, string> = {
    missing_extraction: 'AI failed to extract value that exists in document',
    false_positive: 'AI extracted value that should be empty',
    case_mismatch: 'Case sensitivity issues in extracted values',
    partial_match: 'Extraction captured only partial value',
    formatting: 'Formatting differences (spaces, punctuation)',
    date_format: 'Date format inconsistencies',
    number_format: 'Number/currency format issues',
    value_mismatch: 'Complete value mismatch - needs investigation',
  }

  return Object.entries(patternCounts)
    .map(([pattern, data]) => ({
      pattern,
      count: data.count,
      fields: Array.from(data.fields),
      description: patternDescriptions[pattern] || 'Unknown pattern',
    }))
    .sort((a, b) => b.count - a.count)
}

function identifyPattern(aiValue: string | null, userValue: string | null): string {
  if (!aiValue && userValue) return 'missing_extraction'
  if (aiValue && !userValue) return 'false_positive'
  
  const ai = String(aiValue || '').toLowerCase()
  const user = String(userValue || '').toLowerCase()
  
  if (ai === user) return 'case_mismatch'
  if (ai.includes(user) || user.includes(ai)) return 'partial_match'
  if (ai.replace(/[^\w]/g, '') === user.replace(/[^\w]/g, '')) return 'formatting'
  
  const datePattern = /\d{1,4}[-\/]\d{1,2}[-\/]\d{1,4}/
  if (datePattern.test(ai) && datePattern.test(user)) return 'date_format'
  
  const numPattern = /[\d,\.]+/
  if (numPattern.test(ai) && numPattern.test(user)) return 'number_format'
  
  return 'value_mismatch'
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day
  return new Date(d.setDate(diff))
}

interface TrendPoint {
  weekStart: string
  accuracy: number
  sampleSize: number
}

function isAccuracyImproving(trends: TrendPoint[]): boolean | null {
  if (trends.length < 3) return null
  
  const recent = trends.slice(-3)
  const older = trends.slice(-6, -3)
  
  if (older.length === 0) return null
  
  const recentAvg = recent.reduce((sum, t) => sum + t.accuracy, 0) / recent.length
  const olderAvg = older.reduce((sum, t) => sum + t.accuracy, 0) / older.length
  
  return recentAvg > olderAvg
}
