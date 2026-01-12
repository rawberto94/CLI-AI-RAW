/**
 * Adaptive Extraction Engine
 * 
 * State-of-the-art extraction with continuous learning:
 * 1. Few-shot learning from successful extractions
 * 2. Error pattern detection and avoidance
 * 3. Confidence calibration based on historical accuracy
 * 4. Contract-type specific prompt optimization
 */

import { prisma } from '@/lib/prisma'

// ============================================================================
// TYPES
// ============================================================================

interface LearnedPattern {
  field: string
  pattern: string
  occurrences: number
  contractType: string
  recommendation: string
}

interface SuccessfulExample {
  field: string
  extractedValue: string
  sourceContext?: string
  contractType: string
}

interface PromptEnhancement {
  fewShotExamples: Array<{
    input: string
    output: string
    field: string
  }>
  warningPatterns: string[]
  contractTypeHints: string[]
  confidenceModifiers: Record<string, number>
}

interface FieldAccuracyStats {
  accuracy: number
  sampleSize: number
  commonErrors: string[]
}

// ============================================================================
// ADAPTIVE EXTRACTION ENGINE
// ============================================================================

class AdaptiveExtractionEngine {
  private patterns: Map<string, LearnedPattern[]> = new Map()
  private accuracyCache: Map<string, FieldAccuracyStats> = new Map()
  private lastRefresh: number = 0
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Load learned patterns from database
   */
  async loadLearnedPatterns(tenantId: string): Promise<LearnedPattern[]> {
    const cacheKey = `patterns-${tenantId}`
    const now = Date.now()

    if (this.patterns.has(cacheKey) && now - this.lastRefresh < this.CACHE_TTL) {
      return this.patterns.get(cacheKey) || []
    }

    try {
      // Get corrections grouped by field and contract type
      const corrections = await prisma.extractionCorrection.findMany({
        where: {
          contract: { tenantId },
          wasCorrect: false,
        },
        select: {
          fieldName: true,
          originalValue: true,
          correctedValue: true,
          contractType: true,
        }
      })

      // Analyze patterns
      const patternsByType: Record<string, Record<string, { count: number; examples: Array<{ ai: string | null; user: string | null }> }>> = {}

      for (const c of corrections) {
        const type = c.contractType || 'unknown'
        if (!patternsByType[type]) patternsByType[type] = {}
        
        const pattern = this.identifyPattern(c.originalValue, c.correctedValue)
        const key = `${c.fieldName}:${pattern}`
        
        if (!patternsByType[type][key]) {
          patternsByType[type][key] = { count: 0, examples: [] }
        }
        patternsByType[type][key].count++
        patternsByType[type][key].examples.push({
          ai: c.originalValue,
          user: c.correctedValue
        })
      }

      // Convert to LearnedPattern array
      const patterns: LearnedPattern[] = []
      
      for (const [contractType, fieldPatterns] of Object.entries(patternsByType)) {
        for (const [key, data] of Object.entries(fieldPatterns)) {
          if (data.count >= 2) {
            const [field, pattern] = key.split(':')
            patterns.push({
              field: field || '',
              pattern: pattern || '',
              occurrences: data.count,
              contractType,
              recommendation: this.getPatternRecommendation(pattern || '', data.examples),
            })
          }
        }
      }

      this.patterns.set(cacheKey, patterns)
      this.lastRefresh = now

      return patterns
    } catch (error) {
      console.error('Failed to load learned patterns:', error)
      return []
    }
  }

  /**
   * Get successful extraction examples for few-shot learning
   */
  async getSuccessfulExamples(
    tenantId: string,
    contractType: string,
    field: string,
    limit: number = 3
  ): Promise<SuccessfulExample[]> {
    try {
      const examples = await prisma.extractionCorrection.findMany({
        where: {
          contract: { tenantId },
          contractType,
          fieldName: field,
          wasCorrect: true,
        },
        select: {
          correctedValue: true,
          metadata: true,
          contractType: true,
          fieldName: true,
        },
        take: limit,
        orderBy: { createdAt: 'desc' }
      })

      return examples.map(e => ({
        field: e.fieldName,
        extractedValue: e.correctedValue || '',
        sourceContext: (e.metadata as Record<string, string> | null)?.sourceText,
        contractType: e.contractType || 'unknown',
      }))
    } catch (error) {
      console.error('Failed to get successful examples:', error)
      return []
    }
  }

  /**
   * Build adaptive prompt enhancements based on learned patterns
   */
  async buildAdaptivePrompt(
    tenantId: string,
    contractType: string,
    fields: string[]
  ): Promise<PromptEnhancement> {
    const patterns = await this.loadLearnedPatterns(tenantId)
    const relevantPatterns = patterns.filter(
      p => p.contractType === contractType || p.contractType === 'unknown'
    )

    const fewShotExamples: PromptEnhancement['fewShotExamples'] = []
    const warningPatterns: string[] = []
    const contractTypeHints: string[] = []
    const confidenceModifiers: Record<string, number> = {}

    for (const field of fields) {
      // Get successful examples for few-shot
      const examples = await this.getSuccessfulExamples(tenantId, contractType, field, 2)
      for (const ex of examples) {
        if (ex.sourceContext && ex.extractedValue) {
          fewShotExamples.push({
            input: ex.sourceContext,
            output: ex.extractedValue,
            field,
          })
        }
      }

      // Get field-specific patterns
      const fieldPatterns = relevantPatterns.filter(p => p.field === field)
      for (const fp of fieldPatterns) {
        warningPatterns.push(
          `For ${field}: Avoid ${fp.pattern} errors (${fp.occurrences} past occurrences). ${fp.recommendation}`
        )
      }

      // Calculate confidence modifier based on historical accuracy
      const accuracy = await this.getFieldAccuracy(tenantId, contractType, field)
      if (accuracy) {
        confidenceModifiers[field] = accuracy.accuracy / 100
      }
    }

    // Contract-type specific hints
    if (contractType) {
      const typePatterns = relevantPatterns.filter(p => p.contractType === contractType)
      if (typePatterns.length > 0) {
        const commonFields = [...new Set(typePatterns.map(p => p.field))]
        contractTypeHints.push(
          `For ${contractType} contracts, pay special attention to: ${commonFields.join(', ')}`
        )
      }
    }

    return {
      fewShotExamples,
      warningPatterns,
      contractTypeHints,
      confidenceModifiers,
    }
  }

  /**
   * Get calibrated confidence based on historical accuracy
   */
  async getCalibratedConfidence(
    tenantId: string,
    contractType: string,
    field: string,
    rawConfidence: number
  ): Promise<number> {
    const accuracy = await this.getFieldAccuracy(tenantId, contractType, field)
    
    if (!accuracy || accuracy.sampleSize < 5) {
      // Not enough data, return raw confidence
      return rawConfidence
    }

    // Calibrate confidence based on historical accuracy
    // If historical accuracy is 80% and raw confidence is 95%, calibrated would be ~76%
    const historicalFactor = accuracy.accuracy / 100
    const calibrated = rawConfidence * 0.6 + (rawConfidence * historicalFactor * 0.4)
    
    return Math.round(calibrated * 100) / 100
  }

  /**
   * Get field accuracy from cache or database
   */
  private async getFieldAccuracy(
    tenantId: string,
    contractType: string,
    field: string
  ): Promise<FieldAccuracyStats | null> {
    const cacheKey = `accuracy-${tenantId}-${contractType}-${field}`
    
    if (this.accuracyCache.has(cacheKey)) {
      return this.accuracyCache.get(cacheKey) || null
    }

    try {
      const corrections = await prisma.extractionCorrection.findMany({
        where: {
          contract: { tenantId },
          contractType,
          fieldName: field,
        },
        select: {
          wasCorrect: true,
          originalValue: true,
          correctedValue: true,
        }
      })

      if (corrections.length === 0) return null

      const correct = corrections.filter(c => c.wasCorrect).length
      const accuracy = Math.round((correct / corrections.length) * 100)
      
      // Find common error types
      const errorCounts: Record<string, number> = {}
      for (const c of corrections.filter(c => !c.wasCorrect)) {
        const pattern = this.identifyPattern(c.originalValue, c.correctedValue)
        errorCounts[pattern] = (errorCounts[pattern] || 0) + 1
      }
      
      const commonErrors = Object.entries(errorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([pattern]) => pattern)

      const stats: FieldAccuracyStats = {
        accuracy,
        sampleSize: corrections.length,
        commonErrors,
      }

      this.accuracyCache.set(cacheKey, stats)
      return stats
    } catch (error) {
      console.error('Failed to get field accuracy:', error)
      return null
    }
  }

  /**
   * Identify error pattern type
   */
  private identifyPattern(aiValue: string | null, userValue: string | null): string {
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

  /**
   * Get pattern-specific recommendation
   */
  private getPatternRecommendation(
    pattern: string,
    examples: Array<{ ai: string | null; user: string | null }>
  ): string {
    const recommendations: Record<string, string> = {
      missing_extraction: 'Look more carefully for this field in the document',
      false_positive: 'Only extract if clearly present, leave empty if uncertain',
      case_mismatch: 'Preserve original case from document',
      partial_match: 'Extract complete value, not just partial matches',
      formatting: 'Normalize formatting (spaces, punctuation) consistently',
      date_format: 'Use ISO format (YYYY-MM-DD) for dates',
      number_format: 'Use plain numbers without commas, with . for decimals',
      value_mismatch: 'Review extraction context carefully',
    }

    let rec = recommendations[pattern] || 'Review extraction carefully'

    // Add example if available
    if (examples.length > 0) {
      const ex = examples[0]
      if (ex?.ai && ex?.user) {
        rec += ` Example: "${ex.ai}" should be "${ex.user}"`
      }
    }

    return rec
  }

  /**
   * Clear caches
   */
  clearCache(): void {
    this.patterns.clear()
    this.accuracyCache.clear()
    this.lastRefresh = 0
  }
}

// Singleton instance
export const adaptiveExtractionEngine = new AdaptiveExtractionEngine()

// Export types
export type { LearnedPattern, SuccessfulExample, PromptEnhancement, FieldAccuracyStats }
