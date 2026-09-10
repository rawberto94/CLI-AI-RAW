/**
 * Normalize RISK artifact JSON into one list the UI can cite.
 * Prompts emit `risks[]`; some viewers still look for identifiedRisks / riskFactors.
 */

export interface NormalizedRiskFinding {
  title: string
  description: string
  severity?: string
  snippet?: string | null
  heading?: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  return null
}

function snippetFrom(item: Record<string, unknown>): string | null {
  return (
    asText(item.sourceClause) ||
    asText(item.source) ||
    asText(item.quote) ||
    asText(item.location) ||
    null
  )
}

export function normalizeRiskFindings(riskData: unknown): NormalizedRiskFinding[] {
  const rec = asRecord(riskData)
  if (!rec) return []

  const buckets = [rec.risks, rec.identifiedRisks, rec.riskFactors, rec.factors, rec.redFlags]
  const out: NormalizedRiskFinding[] = []
  const seen = new Set<string>()

  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue
    for (const raw of bucket) {
      const item = asRecord(raw)
      if (!item) continue
      const title =
        asText(item.title) ||
        asText(item.flag) ||
        asText(item.issue) ||
        asText(item.description) ||
        asText(item.category) ||
        asText(item.type) ||
        'Risk finding'
      const description =
        asText(item.description) ||
        asText(item.factor) ||
        asText(item.flag) ||
        asText(item.issue) ||
        title
      const snippet = snippetFrom(item)
      const heading = asText(item.clauseReference) || asText(item.section) || title
      const key = `${title}|${snippet || description}`.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        title,
        description,
        severity: asText(item.severity) || asText(item.level) || undefined,
        snippet,
        heading,
      })
    }
  }

  return out
}
