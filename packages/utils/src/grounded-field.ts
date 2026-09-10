/** Grounded extraction envelope for critical contract fields. */

export type FieldStatus = 'found' | 'not_found' | 'ambiguous' | 'conflicting' | 'not_applicable';

export interface GroundedCandidate<T = unknown> {
  value: T | null;
  valueRaw: string;
  sourceQuote: string;
  pageNumbers: number[];
}

export interface GroundedField<T = unknown> {
  status: FieldStatus;
  value: T | null;
  valueRaw: string | null;
  sourceQuote: string | null;
  pageNumbers: number[];
  confidence: number;
  notes: string | null;
  candidates?: GroundedCandidate<T>[];
  grounded: boolean;
}

export function emptyGroundedField<T = unknown>(status: FieldStatus = 'not_found'): GroundedField<T> {
  return {
    status,
    value: null,
    valueRaw: null,
    sourceQuote: null,
    pageNumbers: [],
    confidence: 0,
    notes: null,
    grounded: false,
  };
}

/** Weighted confidence: model + quote match + OCR + validation. */
export function compositeConfidence(input: {
  model?: number | null;
  quoteMatch?: number | null;
  ocr?: number | null;
  validation?: number | null;
}): number {
  const model = clamp01(input.model ?? 0);
  const quoteMatch = clamp01(input.quoteMatch ?? 0);
  const ocr = clamp01(input.ocr ?? 0);
  const validation = clamp01(input.validation ?? 0);
  return round2(0.4 * model + 0.2 * quoteMatch + 0.2 * ocr + 0.2 * validation);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const HIGH_RISK_FIELDS = [
  'parties',
  'totalValue',
  'totalContractValue',
  'startDate',
  'endDate',
  'effectiveDate',
  'termination',
  'liability',
  'autoRenewal',
  'governingLaw',
  'signatureStatus',
] as const;

export function isHighRiskField(name: string): boolean {
  const key = name.trim();
  return HIGH_RISK_FIELDS.some((f) => f.toLowerCase() === key.toLowerCase());
}
