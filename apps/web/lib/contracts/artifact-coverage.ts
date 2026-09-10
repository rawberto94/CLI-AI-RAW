/**
 * Which analysis slots apply to a contract, and why a slot is missing.
 * Used by the upload (i) tooltip and the status API so NDAs are not
 * reported as "missing Rate Cards".
 */

export const ARTIFACT_LABELS: Record<string, string> = {
  overview: 'Overview',
  clauses: 'Key clauses',
  financial: 'Financial analysis',
  risk: 'Risk assessment',
  compliance: 'Compliance check',
  obligations: 'Obligations',
  renewal: 'Renewal terms',
  negotiation_points: 'Negotiation points',
  amendments: 'Amendments',
  contacts: 'Contacts',
  parties: 'Parties',
  timeline: 'Timeline',
  deliverables: 'Deliverables',
  executive_summary: 'Executive summary',
  rates: 'Rate cards',
}

export const EXPECTED_ARTIFACT_IDS = Object.keys(ARTIFACT_LABELS)

export type MissingArtifactReason = 'failed' | 'not_generated'

export interface MissingArtifact {
  type: string
  label: string
  reason: MissingArtifactReason
}

export function artifactLabel(type: string): string {
  const id = type.toLowerCase()
  return ARTIFACT_LABELS[id] || id.replace(/_/g, ' ')
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function isFallbackArtifactData(data: unknown): boolean {
  const record = asRecord(data)
  if (!record) return false
  if (record.fallback === true || record._fallback === true) return true
  const meta = asRecord(record._meta)
  return meta?.fallback === true
}

export function isSuccessfulArtifactData(data: unknown): boolean {
  const record = asRecord(data)
  if (!record) return false
  if (isFallbackArtifactData(record)) return false
  if (typeof record.error === 'string' && record.error.length > 0 && record.certainty == null) return false
  if (record.isApplicable === false) return false
  const meta = asRecord(record._extractionMeta)
  if (meta?.isApplicable === false) return false
  return true
}

export function isMarkedNotApplicable(data: unknown): boolean {
  const record = asRecord(data)
  if (!record) return false
  if (record.isApplicable === false) return true
  const meta = asRecord(record._extractionMeta)
  return meta?.isApplicable === false
}

/** Conservative fallback when contract-type profiles are unavailable. */
export function defaultArtifactApplicable(contractType: string | null | undefined, artifactType: string): boolean {
  const type = (contractType || '').toUpperCase().replace(/[-\s]/g, '_')
  const artifact = artifactType.toLowerCase()
  if (!type) return true
  if (type.includes('NDA') || type.includes('NON_DISCLOSURE')) {
    return !['rates', 'financial', 'deliverables'].includes(artifact)
  }
  if (type.includes('EMPLOYMENT') || type === 'OFFER_LETTER' || type === 'SEPARATION_AGREEMENT') {
    return artifact !== 'rates'
  }
  return true
}

export function computeArtifactCoverage(input: {
  contractType?: string | null
  artifacts: Array<{ type: string; data?: unknown }>
  isApplicable?: (contractType: string, artifactType: string) => boolean
}): {
  successfulTypes: string[]
  applicableTypes: string[]
  missing: MissingArtifact[]
  totalArtifacts: number
  artifactsGenerated: number
} {
  const applicableFn = input.isApplicable || defaultArtifactApplicable
  const contractType = input.contractType || ''
  const applicableTypes = EXPECTED_ARTIFACT_IDS.filter((id) => applicableFn(contractType, id))

  const byType = new Map<string, unknown>()
  for (const artifact of input.artifacts) {
    const id = String(artifact.type || '').toLowerCase()
    if (!id) continue
    byType.set(id, artifact.data)
  }

  const successfulTypes: string[] = []
  const missing: MissingArtifact[] = []

  for (const type of applicableTypes) {
    const data = byType.get(type)
    if (data === undefined) {
      missing.push({ type, label: artifactLabel(type), reason: 'not_generated' })
      continue
    }
    if (isMarkedNotApplicable(data)) continue
    if (isSuccessfulArtifactData(data)) {
      successfulTypes.push(type)
      continue
    }
    missing.push({ type, label: artifactLabel(type), reason: 'failed' })
  }

  return {
    successfulTypes,
    applicableTypes,
    missing,
    totalArtifacts: applicableTypes.length,
    artifactsGenerated: successfulTypes.length,
  }
}

export interface InsightStatusLike {
  artifactTypes?: string[]
  missingArtifactTypes?: string[]
  missingArtifacts?: Array<{ type?: string; label?: string; reason?: string }>
}

/**
 * Labels for the upload (i) tooltip.
 * If the status API sent `missingArtifactTypes` (even as []), trust it —
 * do not fall back to the full 15-type catalog (that is how NDAs grew Rate Cards).
 */
export function getMissingArtifactDetails(status: InsightStatusLike | null | undefined): MissingArtifact[] {
  if (!status) return []

  if (Array.isArray(status.missingArtifacts)) {
    return status.missingArtifacts
      .map((item) => {
        const type = String(item?.type || '').toLowerCase()
        if (!type) return null
        const reason: MissingArtifactReason = item.reason === 'failed' ? 'failed' : 'not_generated'
        return {
          type,
          label: item.label?.trim() || artifactLabel(type),
          reason,
        }
      })
      .filter((item): item is MissingArtifact => item != null)
  }

  if (Array.isArray(status.missingArtifactTypes)) {
    return status.missingArtifactTypes
      .map((type) => String(type || '').toLowerCase())
      .filter(Boolean)
      .map((type) => ({ type, label: artifactLabel(type), reason: 'not_generated' as const }))
  }

  const generated = new Set((status.artifactTypes ?? []).map((type) => type.toLowerCase()))
  return EXPECTED_ARTIFACT_IDS
    .filter((id) => !generated.has(id))
    .map((type) => ({ type, label: artifactLabel(type), reason: 'not_generated' as const }))
}

export function reasonLabel(reason: MissingArtifactReason): string {
  return reason === 'failed' ? 'analysis failed' : 'not produced'
}
