/**
 * Contract Extraction Confidence API
 * GET /api/contracts/[id]/extraction-confidence - Get confidence scores for extracted fields
 * 
 * Returns real confidence scores from:
 * 1. ContractArtifact extraction_meta if available
 * 2. aiMetadata on the contract
 * 3. Historical accuracy from ExtractionCorrection feedback
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { getSessionTenantId } from '@/lib/tenant-server'
import { prisma } from '@/lib/prisma'

interface FieldConfidence {
  name: string
  label: string
  value: unknown
  confidence: number
  source: 'ai' | 'user' | 'ocr' | 'inferred'
  lastUpdated?: string
  feedbackCount?: number
}

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

    // Get contract with metadata
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: {
        id: true,
        supplierName: true,
        clientName: true,
        totalValue: true,
        effectiveDate: true,
        expirationDate: true,
        contractType: true,
        contractTitle: true,
        description: true,
        aiMetadata: true,
        metadata: true,
      }
    })

    if (!contract) {
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      )
    }

    // Get extraction artifacts for confidence data
    const extractionArtifact = await prisma.contractArtifact.findFirst({
      where: {
        contractId,
        type: { in: ['extraction_meta', 'metadata_extraction', 'ai_extraction'] }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Get feedback history for calibrated confidence
    const corrections = await prisma.extractionCorrection.findMany({
      where: { contractId },
      select: {
        fieldName: true,
        wasCorrect: true,
        confidence: true,
        createdAt: true,
      }
    })

    // Build confidence map from various sources
    const confidenceMap: Record<string, { confidence: number; source: string; feedbackCount: number }> = {}

    // 1. Start with AI metadata if available
    const aiMeta = contract.aiMetadata as Record<string, unknown> | null
    if (aiMeta?.fieldConfidence) {
      const fieldConf = aiMeta.fieldConfidence as Record<string, number>
      for (const [field, conf] of Object.entries(fieldConf)) {
        confidenceMap[field] = { confidence: conf, source: 'ai', feedbackCount: 0 }
      }
    }

    // 2. Override with extraction artifact data
    const extractionData = extractionArtifact?.value as Record<string, unknown> | null
    if (extractionData?.fieldConfidence) {
      const fieldConf = extractionData.fieldConfidence as Record<string, number>
      for (const [field, conf] of Object.entries(fieldConf)) {
        confidenceMap[field] = { 
          ...(confidenceMap[field] || {}),
          confidence: conf, 
          source: 'ai',
          feedbackCount: confidenceMap[field]?.feedbackCount || 0
        }
      }
    }

    // 3. Calibrate with feedback history
    const feedbackByField = corrections.reduce((acc, c) => {
      if (!acc[c.fieldName]) acc[c.fieldName] = { correct: 0, total: 0 }
      acc[c.fieldName].total++
      if (c.wasCorrect) acc[c.fieldName].correct++
      return acc
    }, {} as Record<string, { correct: number; total: number }>)

    for (const [field, stats] of Object.entries(feedbackByField)) {
      const historicalAccuracy = stats.total > 0 ? stats.correct / stats.total : 1
      const baseConfidence = confidenceMap[field]?.confidence ?? 80
      
      // Calibrate: blend base confidence with historical accuracy
      const calibrated = Math.round(baseConfidence * 0.6 + (baseConfidence * historicalAccuracy * 0.4))
      
      confidenceMap[field] = {
        confidence: calibrated,
        source: confidenceMap[field]?.source || 'ai',
        feedbackCount: stats.total,
      }
    }

    // Build fields array with real values and confidence
    const fields: FieldConfidence[] = [
      { name: 'supplierName', label: 'Supplier', value: contract.supplierName },
      { name: 'clientName', label: 'Client', value: contract.clientName },
      { name: 'totalValue', label: 'Total Value', value: contract.totalValue },
      { name: 'effectiveDate', label: 'Effective Date', value: contract.effectiveDate },
      { name: 'expirationDate', label: 'Expiration Date', value: contract.expirationDate },
      { name: 'contractType', label: 'Contract Type', value: contract.contractType },
      { name: 'contractTitle', label: 'Title', value: contract.contractTitle },
      { name: 'description', label: 'Description', value: contract.description },
    ]
    .filter(f => f.value !== null && f.value !== undefined)
    .map(f => ({
      ...f,
      confidence: confidenceMap[f.name]?.confidence ?? getDefaultConfidence(f.name, f.value),
      source: (confidenceMap[f.name]?.source || 'ai') as 'ai' | 'user' | 'ocr' | 'inferred',
      feedbackCount: confidenceMap[f.name]?.feedbackCount ?? 0,
    }))

    // Calculate overall stats
    const avgConfidence = fields.length > 0
      ? Math.round(fields.reduce((sum, f) => sum + f.confidence, 0) / fields.length)
      : null

    const lowConfidenceFields = fields.filter(f => f.confidence < 70).length
    const totalFeedback = corrections.length

    return NextResponse.json({
      success: true,
      data: {
        contractId,
        fields,
        summary: {
          averageConfidence: avgConfidence,
          lowConfidenceFields,
          totalFeedback,
          lastFeedback: corrections[0]?.createdAt || null,
        }
      }
    })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to get extraction confidence' },
      { status: 500 }
    )
  }
}

/**
 * Estimate default confidence based on field type and value
 */
function getDefaultConfidence(fieldName: string, value: unknown): number {
  // Dates extracted well
  if (fieldName.includes('Date') && value) return 90
  
  // Money values are usually accurate
  if (fieldName.includes('Value') || fieldName.includes('Amount')) return 85
  
  // Names can vary
  if (fieldName.includes('Name')) return 82
  
  // Type classification less certain
  if (fieldName.includes('Type')) return 75
  
  // Description is often partial
  if (fieldName.includes('description') || fieldName.includes('Description')) return 70
  
  return 80
}
