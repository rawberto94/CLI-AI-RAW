/**
 * Normalize CLAUSES artifact JSON into one list the UI can cite.
 * Worker prompts emit title/content/fullText/source; some schemas still use
 * clauseId/text/page. Viewers historically read only one of those shapes.
 */

export interface NormalizedExtractedClause {
  title: string
  section: string | null
  summary: string
  fullText: string
  snippet: string | null
  page: number | undefined
  importance: string | null
  category: string | null
  type: string | null
  riskLevel: string | null
  obligations: string[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  return null
}

function asPage(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return undefined
}

function normalizeOne(raw: unknown, index: number): NormalizedExtractedClause | null {
  const item = asRecord(raw)
  if (!item) return null

  const title =
    asText(item.title) ||
    asText(item.name) ||
    asText(item.heading) ||
    asText(item.clauseId) ||
    asText(item.type) ||
    `Clause ${index + 1}`

  const section =
    asText(item.section) ||
    asText(item.pageReference) ||
    asText(item.clauseId) ||
    null

  const summary =
    asText(item.summary) ||
    asText(item.content) ||
    asText(item.description) ||
    ''

  const fullText =
    asText(item.fullText) ||
    asText(item.text) ||
    asText(item.source) ||
    summary

  // Prefer a verbatim quote for click-to-source; paraphrased summaries rarely match OCR.
  const snippet =
    asText(item.source) ||
    asText(item.fullText) ||
    asText(item.text) ||
    (summary.length >= 12 ? summary : null)

  if (!title && !summary && !fullText) return null

  return {
    title,
    section,
    summary: summary || fullText,
    fullText,
    snippet,
    page: asPage(item.page) ?? asPage(item.pageNumber),
    importance: asText(item.importance),
    category: asText(item.category),
    type: asText(item.type) || asText(item.category),
    riskLevel: asText(item.riskLevel) || asText(item.importance),
    obligations: Array.isArray(item.obligations)
      ? item.obligations.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [],
  }
}

export function normalizeExtractedClauses(data: unknown): NormalizedExtractedClause[] {
  if (Array.isArray(data)) {
    return data
      .map((item, index) => normalizeOne(item, index))
      .filter((item): item is NormalizedExtractedClause => item != null)
  }

  const rec = asRecord(data)
  if (!rec) return []

  const buckets = [rec.clauses, rec.keyClauses]
  const out: NormalizedExtractedClause[] = []
  const seen = new Set<string>()

  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue
    for (const raw of bucket) {
      const item = normalizeOne(raw, out.length)
      if (!item) continue
      const key = `${item.title}|${item.snippet || item.fullText}`.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(item)
    }
  }

  return out
}
