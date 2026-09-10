/**
 * Pure mapping from contract artifacts to the header compliance score.
 * POLICY_CHECK / policy evaluation takes precedence over LLM COMPLIANCE.
 */

export type HeaderComplianceSource = 'policy' | 'llm' | 'none'

export interface HeaderComplianceCheck {
  name: string
  status: string
  message?: string
  passed?: boolean
  quote?: string
  startOffset?: number
  endOffset?: number
}

export interface HeaderComplianceInfo {
  isCompliant: boolean | null
  checks: HeaderComplianceCheck[]
  violations: string[]
  score: number | undefined
  source: HeaderComplianceSource
  packName?: string
  penalty?: number
  criticalCount?: number
  highCount?: number
}

const FAILING_STATUSES = new Set([
  'failed',
  'fail',
  'non-compliant',
  'non_compliant',
  'violation',
  'needs-review',
  'needs_review',
])

const PASSING_STATUSES = new Set([
  'passed',
  'pass',
  'compliant',
  'ok',
  'not-applicable',
  'not_applicable',
  'n/a',
])

const POLICY_PASS_STATUSES = new Set(['PASS', 'PASS_WITH_NOTES'])
const POLICY_FAIL_STATUSES = new Set(['FAIL', 'REVIEW'])
const POLICY_ISSUE_STATUSES = new Set([
  'VIOLATION',
  'INCONSISTENCY',
  'MISSING',
  'INSUFFICIENT_EVIDENCE',
])

const EMPTY: HeaderComplianceInfo = {
  isCompliant: null,
  checks: [],
  violations: [],
  score: undefined,
  source: 'none',
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/** Artifacts may be a type→data map or an array of { type, data }. */
export function artifactsByType(extractedData: unknown): Record<string, unknown> | null {
  if (!extractedData) return null
  if (Array.isArray(extractedData)) {
    const acc: Record<string, unknown> = {}
    for (const item of extractedData) {
      const rec = asRecord(item)
      if (!rec) continue
      const type = rec.type != null ? String(rec.type).toLowerCase() : ''
      if (!type) continue
      acc[type] = rec.data !== undefined ? rec.data : rec
    }
    return acc
  }
  return asRecord(extractedData)
}

function unwrapArtifact(raw: unknown): Record<string, unknown> | null {
  const rec = asRecord(raw)
  if (!rec) return null
  if (
    typeof rec.policyScore === 'number'
    || Array.isArray(rec.findings)
    || (typeof rec.status === 'string' && rec.status.length > 0)
  ) {
    return rec
  }
  if (rec.data !== undefined) return unwrapArtifact(rec.data)
  return rec
}

function pickPolicyArtifact(extracted: Record<string, unknown>): Record<string, unknown> | null {
  const candidates = [
    extracted.policy_check,
    extracted.POLICY_CHECK,
    extracted.policyCheck,
    extracted.policy,
  ]
  for (const candidate of candidates) {
    const unwrapped = unwrapArtifact(candidate)
    if (unwrapped && isPolicyArtifact(unwrapped)) return unwrapped
  }
  return null
}

function isPolicyArtifact(data: Record<string, unknown>): boolean {
  return (
    typeof data.policyScore === 'number'
    || Array.isArray(data.findings)
    || (typeof data.status === 'string' && data.status.length > 0)
  )
}

/** LLM scores may be 0–1 fractions; values in (0, 1] are scaled to percent. */
export function normalizePercentScore(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined
  if (raw > 100 || raw < 0) return undefined
  const scaled = raw > 0 && raw <= 1 ? raw * 100 : raw
  return Math.round(Math.min(100, Math.max(0, scaled)))
}

/** Policy-pack scores are stored as 0–100 integers — never scale 1 → 100. */
export function normalizePolicyScore(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined
  if (raw > 100 || raw < 0) return undefined
  return Math.round(raw)
}

function findingLabel(finding: Record<string, unknown>): string {
  return String(finding.detail || finding.title || finding.ruleCode || finding.message || '').trim()
}

function mapPolicyCompliance(policy: Record<string, unknown>): HeaderComplianceInfo {
  const findings = Array.isArray(policy.findings)
    ? policy.findings.filter((f): f is Record<string, unknown> => Boolean(f) && typeof f === 'object')
    : []

  const issueFindings = findings.filter((finding) => {
    if (finding.waiverId) return false
    const status = String(finding.status || '').toUpperCase()
    return POLICY_ISSUE_STATUSES.has(status) || (status !== '' && status !== 'PASS')
  })

  const violations = issueFindings.map(findingLabel).filter(Boolean)

  const checks: HeaderComplianceCheck[] = findings.map((finding) => {
    const status = String(finding.status || '').toUpperCase()
    const passed = status === 'PASS'
    const evidence = Array.isArray(finding.evidence)
      ? finding.evidence.find((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      : null
    const quote = typeof evidence?.quote === 'string' ? evidence.quote : undefined
    const startOffset = typeof evidence?.startOffset === 'number' ? evidence.startOffset : undefined
    const endOffset = typeof evidence?.endOffset === 'number' ? evidence.endOffset : undefined
    return {
      name: String(finding.title || finding.ruleCode || 'Policy rule'),
      status: passed ? 'passed' : status.toLowerCase() || 'failed',
      message: findingLabel(finding) || undefined,
      passed,
      quote,
      startOffset,
      endOffset,
    }
  })

  const score = normalizePolicyScore(policy.policyScore)
  const status = String(policy.status || '').toUpperCase()

  let isCompliant: boolean | null
  if (POLICY_PASS_STATUSES.has(status)) {
    isCompliant = true
  } else if (POLICY_FAIL_STATUSES.has(status)) {
    isCompliant = false
  } else if (status === 'INDETERMINATE') {
    isCompliant = violations.length > 0 ? false : null
  } else if (violations.length > 0) {
    isCompliant = false
  } else if (score == null) {
    isCompliant = null
  } else {
    isCompliant = score >= 80
  }

  return {
    isCompliant,
    checks,
    violations,
    score,
    source: 'policy',
    packName: typeof policy.packName === 'string' && policy.packName.trim() ? policy.packName.trim() : undefined,
    penalty: typeof policy.penalty === 'number' && Number.isFinite(policy.penalty) ? policy.penalty : undefined,
    criticalCount: typeof policy.criticalCount === 'number' ? policy.criticalCount : undefined,
    highCount: typeof policy.highCount === 'number' ? policy.highCount : undefined,
  }
}

/** User-facing (i) copy: the actual formula, never “% confidence”. */
export function describeHeaderCompliance(info: HeaderComplianceInfo): string {
  if (info.source === 'policy') {
    const pack = info.packName ? `Policy pack ${info.packName}` : 'Policy-pack score'
    const scorePart = info.score == null ? 'not scored' : `${info.score}/100`
    const formula = info.penalty != null
      ? `100 − ${info.penalty} penalty points`
      : '100 minus severity penalties from findings'
    const counts: string[] = []
    if (info.criticalCount) counts.push(`${info.criticalCount} critical`)
    if (info.highCount) counts.push(`${info.highCount} high`)
    const issueNames = info.checks
      .filter((check) => check.passed !== true && !PASSING_STATUSES.has(String(check.status || '').toLowerCase()))
      .map((check) => check.name)
      .filter(Boolean)
      .slice(0, 4)
    const countBit = counts.length > 0 ? `; ${counts.join(', ')} findings` : ''
    const nameBit = issueNames.length > 0 ? `: ${issueNames.join('; ')}` : ''
    return `${pack}: ${scorePart} (${formula})${countBit}${nameBit}. This overrides the LLM compliance artifact.`
  }

  if (info.source === 'llm') {
    const scored = info.checks.filter((check) => {
      const status = String(check.status || '').toLowerCase()
      return FAILING_STATUSES.has(status) || PASSING_STATUSES.has(status) || typeof check.passed === 'boolean'
    })
    const passed = scored.filter((check) =>
      check.passed === true || PASSING_STATUSES.has(String(check.status || '').toLowerCase()),
    ).length
    const issues = scored.length - passed
    const scorePart = info.score == null ? 'not scored' : `${info.score}%`
    if (scored.length > 0) {
      return `LLM compliance checks: ${scorePart} is the share that passed (${passed} passed, ${issues} issue${issues === 1 ? '' : 's'} of ${scored.length}).`
    }
    if (info.score != null) {
      return `LLM compliance score ${scorePart} — share of checks that passed (compliant / not applicable).`
    }
    return 'LLM compliance was run but no scored checks were returned.'
  }

  return 'Compliance has not been assessed for this document.'
}

function mapLlmCompliance(complianceData: unknown): HeaderComplianceInfo {
  const data = asRecord(complianceData)
  if (!data) return { ...EMPTY }
  const meta = asRecord(data._meta)
  if (data.fallback === true || data._fallback === true || meta?.fallback === true) {
    return { ...EMPTY }
  }

  const checks: HeaderComplianceCheck[] = Array.isArray(data.checks)
    ? data.checks
        .filter((check): check is Record<string, unknown> => Boolean(check) && typeof check === 'object')
        .map((check) => {
          const status = String(check.status || '').toLowerCase()
          const passed = check.passed === true || PASSING_STATUSES.has(status)
            ? true
            : check.passed === false || FAILING_STATUSES.has(status)
              ? false
              : undefined
          const quote = typeof check.source === 'string'
            ? check.source
            : typeof check.quote === 'string'
              ? check.quote
              : undefined
          return {
            name: String(check.name || check.regulation || 'Check'),
            status: status || (passed === true ? 'passed' : passed === false ? 'failed' : 'pending'),
            message: String(check.message || check.details || check.regulation || check.name || ''),
            passed,
            quote,
          }
        })
    : []
  const issues = Array.isArray(data.issues) ? data.issues : []

  const violations: string[] = [
    ...checks
      .filter((check: { status?: string; passed?: boolean }) =>
        check?.passed === false || FAILING_STATUSES.has(String(check?.status || '').toLowerCase()),
      )
      .map((check: { name?: string; regulation?: string; message?: string; details?: string }) =>
        check.message || check.details || check.regulation || check.name || '',
      ),
    ...issues
      .filter((issue: { severity?: string }) =>
        ['high', 'critical', 'medium'].includes(String(issue?.severity || '').toLowerCase()),
      )
      .map((issue: { description?: string }) => issue.description || ''),
  ].filter(Boolean)

  const scoredChecks = checks.filter((check: { status?: string }) => {
    const status = String(check?.status || '').toLowerCase()
    return FAILING_STATUSES.has(status) || PASSING_STATUSES.has(status)
  })
  const passedChecks = scoredChecks.filter((check: { status?: string; passed?: boolean }) =>
    check?.passed === true || PASSING_STATUSES.has(String(check?.status || '').toLowerCase()),
  ).length

  const llmScore = typeof data.complianceScore === 'number'
    ? data.complianceScore
    : typeof data.score === 'number'
      ? data.score
      : undefined
  const score = scoredChecks.length > 0
    ? Math.round((passedChecks / scoredChecks.length) * 100)
    : normalizePercentScore(llmScore)

  const isCompliant = violations.length > 0
    ? false
    : (typeof data.compliant === 'boolean' ? data.compliant : (score == null ? null : score >= 80))

  return {
    isCompliant,
    checks,
    violations,
    score,
    source: checks.length > 0 || issues.length > 0 || score != null || typeof data.compliant === 'boolean'
      ? 'llm'
      : 'none',
  }
}

/**
 * Header compliance: policy-pack evaluation wins over LLM COMPLIANCE when present.
 */
export function mapHeaderComplianceScore(extractedData: unknown): HeaderComplianceInfo {
  const artifacts = artifactsByType(extractedData)
  if (!artifacts) return { ...EMPTY }

  const policy = pickPolicyArtifact(artifacts)
  if (policy) return mapPolicyCompliance(policy)

  return mapLlmCompliance(artifacts.compliance ?? artifacts.COMPLIANCE)
}
