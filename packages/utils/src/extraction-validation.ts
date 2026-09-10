/**
 * Post-LLM extraction validation: quote grounding, locale dates/money,
 * definition-only clause traps, and GroundedField envelopes.
 */

import type { AnalysisLanguage } from './analysis-language';
import { parseIsoDate, parseMonetaryAmount } from './contract-extraction';
import {
  compositeConfidence,
  emptyGroundedField,
  type FieldStatus,
  type GroundedField,
  isHighRiskField,
} from './grounded-field';
import { capConfidenceIfUngrounded, pageNumbersFromMarkers, quoteGrounded } from './grounding';

export const EXTRACTION_PIPELINE_VERSION = 'qwen-ml-v1';

const SOURCE_KEYS = new Set([
  'source',
  'sourcequote',
  'source_quote',
  'source_text',
  'sourcetext',
  'quote',
  'sourcesection',
  'source_section',
]);

const RELATIVE_DATE_RE =
  /\b(\d+)\s+days?\s+after\b|\bwithin\s+\d+\s+days\b|innerhalb von|nach (?:der )?unterzeichnung|à compter de|dopo la (?:firma|sottoscrizione)/i;

const DEFINITION_HEADING_RE = /\b(definitions?|definitionen|définitions|definizioni)\b/i;
const DEFINITION_MEANS_RE = /\b(means|shall mean|bedeutet|désigne|si intende)\b/i;

export function flattenGroundedValue(val: unknown): unknown {
  if (val == null || typeof val !== 'object' || Array.isArray(val)) return val;
  const rec = val as Record<string, unknown>;
  const looksGrounded =
    'value' in rec &&
    (rec.status != null || rec.sourceQuote != null || rec.grounded != null || rec.valueRaw != null);
  if (looksGrounded) return rec.value;
  if ('value' in rec && 'source' in rec && Object.keys(rec).length <= 8) return rec.value;
  return val;
}

export function isDefinitionOnlyQuote(quote: string, packedText: string): boolean {
  const q = (quote || '').trim();
  if (!q || !packedText) return false;
  const hay = packedText.toLowerCase();
  const needle = q.toLowerCase().slice(0, Math.min(48, q.length));
  const idx = hay.indexOf(needle);
  if (idx < 0) return false;
  const headingWindow = packedText.slice(Math.max(0, idx - 400), Math.min(packedText.length, idx + 80));
  const meansWindow = packedText.slice(Math.max(0, idx - 80), Math.min(packedText.length, idx + 80));
  return DEFINITION_HEADING_RE.test(headingWindow) && DEFINITION_MEANS_RE.test(meansWindow);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function collectQuote(node: Record<string, unknown>): string | null {
  for (const [key, val] of Object.entries(node)) {
    if (!SOURCE_KEYS.has(key.toLowerCase())) continue;
    if (typeof val === 'string' && val.trim().length >= 8) return val.trim();
  }
  return null;
}

function walkSourceQuotes(
  node: unknown,
  ocrText: string,
  packedText: string,
  path: string,
  ungrounded: string[],
): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((item, i) => walkSourceQuotes(item, ocrText, packedText, `${path}[${i}]`, ungrounded));
    return;
  }
  const rec = node as Record<string, unknown>;
  const quote = collectQuote(rec);
  if (quote) {
    const match = quoteGrounded(quote, ocrText);
    rec.grounded = match.ok;
    if (!match.ok) {
      ungrounded.push(path || 'root');
      if (typeof rec.confidence === 'number') {
        rec.confidence = capConfidenceIfUngrounded(rec.confidence, false);
      }
      rec.requiresHumanReview = true;
    } else if ((!Array.isArray(rec.pageNumbers) || rec.pageNumbers.length === 0) && packedText) {
      rec.pageNumbers = pageNumbersFromMarkers(quote, packedText);
    }
  }
  for (const [key, val] of Object.entries(rec)) {
    if (SOURCE_KEYS.has(key.toLowerCase())) continue;
    walkSourceQuotes(val, ocrText, packedText, path ? `${path}.${key}` : key, ungrounded);
  }
}

function buildEnvelope(input: {
  value: unknown;
  valueRaw?: string | null;
  quote?: string | null;
  ocrText: string;
  packedText: string;
  locale?: string | null;
  modelConfidence?: number | null;
  ocrConfidence?: number | null;
  statusHint?: FieldStatus;
}): GroundedField {
  const quote = (input.quote || '').trim() || null;
  const match = quoteGrounded(quote, input.ocrText);
  const pages = quote ? pageNumbersFromMarkers(quote, input.packedText) : [];
  let status: FieldStatus = input.statusHint || (input.value == null || input.value === '' ? 'not_found' : 'found');
  if (status === 'found' && quote && isDefinitionOnlyQuote(quote, input.packedText)) {
    status = 'ambiguous';
  }
  if (typeof input.valueRaw === 'string' && RELATIVE_DATE_RE.test(input.valueRaw) && !parseIsoDate(input.valueRaw, { locale: input.locale })) {
    status = 'ambiguous';
  }
  const quoteScore = match.ok ? match.score : 0;
  const validation = status === 'found' && match.ok ? 1 : status === 'ambiguous' || status === 'conflicting' ? 0.4 : 0.2;
  const confidence = capConfidenceIfUngrounded(
    compositeConfidence({
      model: input.modelConfidence ?? 0.7,
      quoteMatch: quoteScore,
      ocr: input.ocrConfidence ?? 0.8,
      validation,
    }),
    match.ok || status === 'not_found' || status === 'not_applicable',
  );
  if (status === 'found' && !match.ok && quote) {
    status = 'ambiguous';
  }
  return {
    status,
    value: status === 'not_found' || status === 'not_applicable' ? null : input.value,
    valueRaw: input.valueRaw ?? (typeof input.value === 'string' ? input.value : quote),
    sourceQuote: quote,
    pageNumbers: pages,
    confidence,
    notes: !match.ok && quote ? 'source_quote not found in OCR text' : null,
    grounded: match.ok || !quote,
  };
}

function pickQuote(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c === 'string') {
      const text = c.trim();
      if (text.length >= 8 && !/^\d{4}-\d{2}-\d{2}$/.test(text) && !/^\d+([.,]\d+)?$/.test(text)) {
        return text;
      }
      continue;
    }
    const rec = asRecord(c);
    if (rec) {
      const inner = collectQuote(rec);
      if (inner) return inner;
    }
  }
  return null;
}

/** Build GroundedField envelopes for critical OVERVIEW / FINANCIAL / RENEWAL fields. */
export function groundCriticalContractFields(
  artifacts: Record<string, Record<string, unknown> | undefined>,
  ocrText: string,
  options?: {
    locale?: AnalysisLanguage | string | null;
    packedText?: string | null;
    ocrConfidence?: number | null;
  },
): Record<string, GroundedField> {
  const packed = options?.packedText || ocrText;
  const locale = options?.locale || 'de';
  const ocrConf = options?.ocrConfidence ?? 0.8;
  const overview = artifacts.OVERVIEW || {};
  const financial = artifacts.FINANCIAL || {};
  const renewal = artifacts.RENEWAL || {};
  const parties = artifacts.PARTIES || {};
  const model = typeof overview.certainty === 'number' ? overview.certainty : 0.7;

  const effectiveRaw = (() => {
    const rec = asRecord(overview.effectiveDate);
    if (rec && typeof rec.valueRaw === 'string') return rec.valueRaw;
    const flat = flattenGroundedValue(overview.effectiveDate);
    return flat == null || flat === '' ? null : String(flat);
  })();
  const expirationRaw = (() => {
    const rec = asRecord(overview.expirationDate);
    if (rec && typeof rec.valueRaw === 'string') return rec.valueRaw;
    const flat = flattenGroundedValue(overview.expirationDate);
    return flat == null || flat === '' ? null : String(flat);
  })();
  const tcvRaw = flattenGroundedValue(financial.totalValue ?? overview.totalValue);
  const tcvQuote =
    pickQuote(
      financial.tcvProvenance,
      overview.tcvProvenance,
      asRecord(financial.totalValue),
      asRecord(overview.totalValue),
    ) || (typeof (financial as { tcvProvenance?: { quote?: string } }).tcvProvenance?.quote === 'string'
      ? (financial as { tcvProvenance: { quote: string } }).tcvProvenance.quote
      : null);

  const partyList = Array.isArray(overview.parties)
    ? overview.parties
    : Array.isArray(parties.parties)
      ? parties.parties
      : [];
  const partyNames = partyList
    .map((p) => {
      const rec = asRecord(p);
      const name = rec ? flattenGroundedValue(rec.name ?? rec.legalName) : p;
      return typeof name === 'string' ? name : '';
    })
    .filter(Boolean)
    .join('; ');
  const partyQuote = partyList
    .map((p) => pickQuote(p))
    .find((q): q is string => Boolean(q)) || partyNames || null;

  const termNotice = asRecord(renewal.terminationNotice) || asRecord(renewal.terminationRights);
  const termQuote = pickQuote(termNotice, renewal.terminationNotice, renewal.termAndTermination, overview.termAndTermination);
  const termValue =
    termNotice?.requiredDays ??
    termNotice?.noticePeriod ??
    flattenGroundedValue(renewal.terminationNotice);

  const govLaw = flattenGroundedValue(overview.governingLaw ?? overview.jurisdiction);
  const govQuote = pickQuote(asRecord(overview.governingLaw), asRecord(overview.jurisdiction), overview.governingLaw);

  const autoRenewal = flattenGroundedValue(renewal.autoRenewal);
  const autoQuote = pickQuote(asRecord(renewal.renewalTerms), renewal.renewalTerms);

  const isoEffective =
    effectiveRaw == null || effectiveRaw === ''
      ? null
      : parseIsoDate(String(effectiveRaw), { locale }) || (typeof effectiveRaw === 'string' ? null : String(effectiveRaw));
  const isoExpiration =
    expirationRaw == null || expirationRaw === ''
      ? null
      : parseIsoDate(String(expirationRaw), { locale }) || (typeof expirationRaw === 'string' ? null : String(expirationRaw));

  const tcvNumber =
    typeof tcvRaw === 'number'
      ? tcvRaw
      : typeof tcvRaw === 'string'
        ? parseMonetaryAmount(tcvRaw, { locale })
        : null;

  const fields: Record<string, GroundedField> = {
    effectiveDate: buildEnvelope({
      value: isoEffective,
      valueRaw: effectiveRaw,
      quote: pickQuote(asRecord(overview.effectiveDate), overview.effectiveDate),
      ocrText,
      packedText: packed,
      locale,
      modelConfidence: model,
      ocrConfidence: ocrConf,
    }),
    expirationDate: buildEnvelope({
      value: isoExpiration,
      valueRaw: expirationRaw == null ? null : String(expirationRaw),
      quote: pickQuote(asRecord(overview.expirationDate), overview.expirationDate),
      ocrText,
      packedText: packed,
      locale,
      modelConfidence: model,
      ocrConfidence: ocrConf,
    }),
    totalValue: buildEnvelope({
      value: tcvNumber,
      valueRaw: tcvRaw == null ? null : String(tcvRaw),
      quote: tcvQuote,
      ocrText,
      packedText: packed,
      locale,
      modelConfidence: model,
      ocrConfidence: ocrConf,
    }),
    parties: buildEnvelope({
      value: partyNames || null,
      valueRaw: partyNames || null,
      quote: partyQuote,
      ocrText,
      packedText: packed,
      locale,
      modelConfidence: model,
      ocrConfidence: ocrConf,
    }),
    termination: buildEnvelope({
      value: termValue ?? null,
      valueRaw: termValue == null ? null : String(termValue),
      quote: termQuote,
      ocrText,
      packedText: packed,
      locale,
      modelConfidence: model,
      ocrConfidence: ocrConf,
    }),
    governingLaw: buildEnvelope({
      value: govLaw == null ? null : String(govLaw),
      valueRaw: govLaw == null ? null : String(govLaw),
      quote: govQuote,
      ocrText,
      packedText: packed,
      locale,
      modelConfidence: model,
      ocrConfidence: ocrConf,
    }),
    autoRenewal: buildEnvelope({
      value: autoRenewal ?? null,
      valueRaw: autoRenewal == null ? null : String(autoRenewal),
      quote: autoQuote,
      ocrText,
      packedText: packed,
      locale,
      modelConfidence: model,
      ocrConfidence: ocrConf,
    }),
  };

  if (isoEffective && isoExpiration && isoEffective > isoExpiration) {
    const start = fields.effectiveDate;
    const end = fields.expirationDate;
    if (start && end) {
      fields.effectiveDate = {
        ...start,
        status: 'conflicting',
        notes: 'start date is after end date',
        confidence: Math.min(start.confidence, 0.59),
      };
      fields.expirationDate = {
        ...end,
        status: 'conflicting',
        notes: 'end date is before start date',
        confidence: Math.min(end.confidence, 0.59),
      };
    }
  }

  return fields;
}

export function groundArtifactTree(
  data: Record<string, unknown>,
  ocrText: string,
  packedText?: string | null,
): { ungroundedPaths: string[] } {
  const ungroundedPaths: string[] = [];
  walkSourceQuotes(data, ocrText, packedText || ocrText, '', ungroundedPaths);
  const meta = asRecord(data._meta);
  if (meta) {
    meta.ungroundedPaths = ungroundedPaths.slice(0, 40);
    meta.pipelineVersion = EXTRACTION_PIPELINE_VERSION;
    if (ungroundedPaths.length > 0 && typeof meta.certainty === 'number') {
      meta.certainty = capConfidenceIfUngrounded(meta.certainty as number, false);
    }
  }
  if (ungroundedPaths.length > 0) {
    data.requiresHumanReview = true;
  }
  return { ungroundedPaths };
}

export function applyExtractionValidation(
  artifacts: Record<string, Record<string, any> | undefined>,
  ocrText: string,
  options?: {
    locale?: AnalysisLanguage | string | null;
    packedText?: string | null;
    ocrConfidence?: number | null;
  },
): {
  groundedFields: Record<string, GroundedField>;
  ungroundedPaths: string[];
  requiresHumanReview: boolean;
} {
  const packed = options?.packedText || ocrText;
  const ungroundedPaths: string[] = [];
  for (const [type, data] of Object.entries(artifacts)) {
    if (!data || typeof data !== 'object') continue;
    const walked = groundArtifactTree(data, ocrText, packed);
    ungroundedPaths.push(...walked.ungroundedPaths.map((p) => (p ? `${type}.${p}` : type)));
  }
  const groundedFields = groundCriticalContractFields(artifacts, ocrText, options);
  const highRiskUngrounded = Object.entries(groundedFields).some(
    ([name, field]) => isHighRiskField(name) && (!field.grounded || field.status === 'ambiguous' || field.status === 'conflicting' || field.confidence < 0.85),
  );
  const requiresHumanReview = ungroundedPaths.length > 0 || highRiskUngrounded;
  return { groundedFields, ungroundedPaths, requiresHumanReview };
}

export function emptyGroundedMap(): Record<string, GroundedField> {
  return {
    effectiveDate: emptyGroundedField(),
    expirationDate: emptyGroundedField(),
    totalValue: emptyGroundedField(),
    parties: emptyGroundedField(),
    termination: emptyGroundedField(),
    governingLaw: emptyGroundedField(),
    autoRenewal: emptyGroundedField(),
  };
}
