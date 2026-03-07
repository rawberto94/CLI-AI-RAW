/**
 * Contract Comparison Utilities
 */

import { Contract } from './contracts-data-service'

export interface Comparison {
  id: string
  name: string
  contracts: Contract[]
  createdAt: Date
  metrics: ComparisonMetrics
  differences: Difference[]
}

export interface ComparisonMetrics {
  valueDifference: number
  riskDifference: number
  complianceDifference: number
  similarityScore: number
  keyDifferences: KeyDifference[]
}

export interface KeyDifference {
  field: string
  count: number
  severity: 'high' | 'medium' | 'low'
}

export interface Difference {
  id: string
  type: 'added' | 'removed' | 'modified' | 'identical'
  field: string
  label: string
  values: any[]
  severity: 'high' | 'medium' | 'low'
  description?: string
}

export interface ComparisonConfig {
  includeMetrics: boolean
  includeDifferences: boolean
  includeFullText: boolean
  includeClauses: boolean
}

/**
 * Calculate comparison metrics between contracts
 */
export function calculateComparisonMetrics(contracts: Contract[]): ComparisonMetrics {
  if (contracts.length < 2) {
    return {
      valueDifference: 0,
      riskDifference: 0,
      complianceDifference: 0,
      similarityScore: 100,
      keyDifferences: [],
    }
  }

  const values = contracts.map(c => c.extractedData?.financial?.totalValue || 0)
  const risks = contracts.map(c => c.extractedData?.risk?.overallScore || 0)
  const compliances = contracts.map(c => c.extractedData?.compliance?.overallScore || 0)

  const valueDiff = Math.max(...values) - Math.min(...values)
  const riskDiff = Math.max(...risks) - Math.min(...risks)
  const complianceDiff = Math.max(...compliances) - Math.min(...compliances)

  const differences = findDifferences(contracts)
  const similarityScore = calculateSimilarityScore(contracts, differences)
  const keyDifferences = groupDifferencesByField(differences)

  return {
    valueDifference: valueDiff,
    riskDifference: riskDiff,
    complianceDifference: complianceDiff,
    similarityScore,
    keyDifferences,
  }
}

/**
 * Find all differences between contracts
 */
export function findDifferences(contracts: Contract[]): Difference[] {
  if (contracts.length < 2) return []

  const differences: Difference[] = []
  const fields = [
    { key: 'extractedData.financial.totalValue', label: 'Contract Value', severity: 'high' as const },
    { key: 'extractedData.financial.currency', label: 'Currency', severity: 'low' as const },
    { key: 'extractedData.parties', label: 'Parties', severity: 'high' as const },
    { key: 'extractedData.dates.effectiveDate', label: 'Effective Date', severity: 'medium' as const },
    { key: 'extractedData.dates.expirationDate', label: 'Expiration Date', severity: 'medium' as const },
    { key: 'extractedData.terms.paymentTerms', label: 'Payment Terms', severity: 'high' as const },
    { key: 'extractedData.terms.terminationClause', label: 'Termination Clause', severity: 'high' as const },
    { key: 'extractedData.risk.overallScore', label: 'Risk Score', severity: 'high' as const },
    { key: 'extractedData.compliance.overallScore', label: 'Compliance Score', severity: 'medium' as const },
  ]

  fields.forEach(field => {
    const values = contracts.map(c => getNestedValue(c, field.key))
    const allSame = values.every(v => JSON.stringify(v) === JSON.stringify(values[0]))

    if (!allSame) {
      differences.push({
        id: `diff-${field.key}`,
        type: 'modified',
        field: field.key,
        label: field.label,
        values,
        severity: field.severity,
        description: generateDifferenceDescription(field.label, values),
      })
    }
  })

  return differences
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

/**
 * Generate human-readable description of difference
 */
function generateDifferenceDescription(label: string, values: any[]): string {
  const uniqueValues = [...new Set(values.map(v => JSON.stringify(v)))]
  if (uniqueValues.length === 1) return `${label} is identical`
  return `${label} varies: ${uniqueValues.length} different values`
}

/**
 * Calculate similarity score between contracts
 */
function calculateSimilarityScore(contracts: Contract[], differences: Difference[]): number {
  const totalFields = 20 // Total comparable fields
  const differentFields = differences.length
  const similarFields = totalFields - differentFields
  return Math.round((similarFields / totalFields) * 100)
}

/**
 * Group differences by field for summary
 */
function groupDifferencesByField(differences: Difference[]): KeyDifference[] {
  const grouped = new Map<string, KeyDifference>()

  differences.forEach(diff => {
    const category = getCategoryFromField(diff.field)
    const existing = grouped.get(category)

    if (existing) {
      existing.count++
      if (diff.severity === 'high') existing.severity = 'high'
      else if (diff.severity === 'medium' && existing.severity === 'low') {
        existing.severity = 'medium'
      }
    } else {
      grouped.set(category, {
        field: category,
        count: 1,
        severity: diff.severity,
      })
    }
  })

  return Array.from(grouped.values()).sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 }
    return severityOrder[a.severity] - severityOrder[b.severity]
  })
}

/**
 * Get category from field path
 */
function getCategoryFromField(field: string): string {
  if (field.includes('financial')) return 'Financial Terms'
  if (field.includes('parties')) return 'Parties'
  if (field.includes('dates')) return 'Dates & Terms'
  if (field.includes('terms')) return 'Contract Terms'
  if (field.includes('risk')) return 'Risk Assessment'
  if (field.includes('compliance')) return 'Compliance'
  return 'Other'
}

/**
 * Format difference value for display
 */
export function formatDifferenceValue(value: any): string {
  if (value === null || value === undefined) return 'Not specified'
  if (typeof value === 'object') {
    if (Array.isArray(value)) return value.join(', ')
    return JSON.stringify(value)
  }
  return String(value)
}

/**
 * Get difference color class
 */
export function getDifferenceColor(type: Difference['type']): string {
  switch (type) {
    case 'added':
      return 'bg-green-50 border-green-200 text-green-800'
    case 'removed':
      return 'bg-red-50 border-red-200 text-red-800'
    case 'modified':
      return 'bg-yellow-50 border-yellow-200 text-yellow-800'
    case 'identical':
      return 'bg-gray-50 border-gray-200 text-gray-600'
  }
}

/**
 * Get severity badge color
 */
export function getSeverityColor(severity: 'high' | 'medium' | 'low'): string {
  switch (severity) {
    case 'high':
      return 'bg-red-100 text-red-800'
    case 'medium':
      return 'bg-yellow-100 text-yellow-800'
    case 'low':
      return 'bg-violet-100 text-violet-800'
  }
}

/**
 * Save comparison to localStorage
 */
export function saveComparison(comparison: Comparison): void {
  try {
    const saved = getComparisons()
    saved.unshift(comparison)
    // Keep only last 10 comparisons
    const limited = saved.slice(0, 10)
    localStorage.setItem('contract-comparisons', JSON.stringify(limited))
  } catch {
    // Error saving comparison - silently ignored
  }
}

/**
 * Get saved comparisons from localStorage
 */
export function getComparisons(): Comparison[] {
  try {
    const saved = localStorage.getItem('contract-comparisons')
    if (saved) {
      return JSON.parse(saved)
    }
  } catch {
    // Error loading comparisons - silently ignored
  }
  return []
}

/**
 * Delete comparison from localStorage
 */
export function deleteComparison(id: string): void {
  try {
    const saved = getComparisons()
    const filtered = saved.filter(c => c.id !== id)
    localStorage.setItem('contract-comparisons', JSON.stringify(filtered))
  } catch {
    // Error deleting comparison - silently ignored
  }
}

/**
 * Create comparison from contracts
 */
export function createComparison(contracts: Contract[], name?: string): Comparison {
  const metrics = calculateComparisonMetrics(contracts)
  const differences = findDifferences(contracts)

  return {
    id: `comparison-${Date.now()}`,
    name: name || `Comparison ${new Date().toLocaleDateString()}`,
    contracts,
    createdAt: new Date(),
    metrics,
    differences,
  }
}
