import type { RoleRate } from './enhanced-rate-benchmarking-data'

export interface ConfidenceScore {
  overall: number
  sampleSize: number
  freshness: number
  coverage: number
  mapping: number
}

export interface DataQualityWarning {
  type: 'low-confidence' | 'stale-data' | 'low-sample' | 'mapping-uncertainty'
  severity: 'high' | 'medium' | 'low'
  message: string
  suggestion: string
}

/**
 * Calculate confidence score based on multiple factors
 */
export function calculateConfidenceScore(
  role: RoleRate,
  sampleSize: number = 50
): ConfidenceScore {
  // Sample size score (0-1)
  const sampleSizeScore = Math.min(1, sampleSize / 100)
  
  // Freshness score (0-1) - based on days since last update
  const daysSinceUpdate = Math.floor(
    (new Date().getTime() - role.lastUpdated.getTime()) / (1000 * 60 * 60 * 24)
  )
  const freshnessScore = Math.max(0, 1 - (daysSinceUpdate / 180)) // 180 days = 0 score
  
  // Coverage score (0-1) - based on geography and service line
  const coverageScore = 0.9 // Simulated - would be based on actual data coverage
  
  // Mapping confidence (0-1) - how confident we are in role standardization
  const mappingScore = 0.95 // Simulated - would be based on fuzzy matching confidence
  
  // Overall confidence (weighted average)
  const overall = (
    sampleSizeScore * 0.35 +
    freshnessScore * 0.25 +
    coverageScore * 0.25 +
    mappingScore * 0.15
  )
  
  return {
    overall,
    sampleSize: sampleSizeScore,
    freshness: freshnessScore,
    coverage: coverageScore,
    mapping: mappingScore
  }
}

/**
 * Generate warnings based on confidence scores
 */
export function generateDataQualityWarnings(
  role: RoleRate,
  confidence: ConfidenceScore
): DataQualityWarning[] {
  const warnings: DataQualityWarning[] = []
  
  // Low overall confidence
  if (confidence.overall < 0.7) {
    warnings.push({
      type: 'low-confidence',
      severity: confidence.overall < 0.5 ? 'high' : 'medium',
      message: `Confidence level is ${(confidence.overall * 100).toFixed(0)}% for ${role.role}`,
      suggestion: 'Consider using alternative data sources or requesting more recent benchmarks'
    })
  }
  
  // Stale data
  const daysSinceUpdate = Math.floor(
    (new Date().getTime() - role.lastUpdated.getTime()) / (1000 * 60 * 60 * 24)
  )
  if (daysSinceUpdate > 90) {
    warnings.push({
      type: 'stale-data',
      severity: daysSinceUpdate > 180 ? 'high' : 'medium',
      message: `Data is ${daysSinceUpdate} days old for ${role.role}`,
      suggestion: 'Request updated benchmark data for more accurate comparisons'
    })
  }
  
  // Low sample size
  if (confidence.sampleSize < 0.5) {
    warnings.push({
      type: 'low-sample',
      severity: 'medium',
      message: `Limited sample size for ${role.role} in this geography`,
      suggestion: 'Consider expanding geographic scope or using similar role benchmarks'
    })
  }
  
  // Mapping uncertainty
  if (confidence.mapping < 0.8) {
    warnings.push({
      type: 'mapping-uncertainty',
      severity: 'low',
      message: `Role mapping confidence is ${(confidence.mapping * 100).toFixed(0)}% for ${role.role}`,
      suggestion: 'Verify role standardization matches your actual requirements'
    })
  }
  
  return warnings
}

/**
 * Get confidence badge color
 */
export function getConfidenceBadgeColor(confidence: number): string {
  if (confidence >= 0.8) return 'bg-green-100 text-green-700 border-green-300'
  if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-700 border-yellow-300'
  return 'bg-red-100 text-red-700 border-red-300'
}

/**
 * Get confidence label
 */
export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High'
  if (confidence >= 0.6) return 'Medium'
  return 'Low'
}

/**
 * Format freshness indicator
 */
export function formatFreshnessIndicator(lastUpdated: Date): {
  text: string
  color: string
  isFresh: boolean
} {
  const daysSince = Math.floor(
    (new Date().getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24)
  )
  
  if (daysSince <= 30) {
    return {
      text: `Updated ${daysSince} days ago`,
      color: 'text-green-600',
      isFresh: true
    }
  } else if (daysSince <= 90) {
    return {
      text: `Updated ${daysSince} days ago`,
      color: 'text-yellow-600',
      isFresh: true
    }
  } else {
    return {
      text: `Updated ${daysSince} days ago`,
      color: 'text-red-600',
      isFresh: false
    }
  }
}

/**
 * Calculate aggregate confidence for multiple roles
 */
export function calculateAggregateConfidence(roles: RoleRate[]): {
  average: number
  min: number
  max: number
  distribution: {
    high: number
    medium: number
    low: number
  }
} {
  if (roles.length === 0) {
    return {
      average: 0,
      min: 0,
      max: 0,
      distribution: { high: 0, medium: 0, low: 0 }
    }
  }
  
  const confidenceScores = roles.map(role => 
    calculateConfidenceScore(role).overall
  )
  
  const average = confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length
  const min = Math.min(...confidenceScores)
  const max = Math.max(...confidenceScores)
  
  const distribution = {
    high: confidenceScores.filter(s => s >= 0.8).length,
    medium: confidenceScores.filter(s => s >= 0.6 && s < 0.8).length,
    low: confidenceScores.filter(s => s < 0.6).length
  }
  
  return { average, min, max, distribution }
}
