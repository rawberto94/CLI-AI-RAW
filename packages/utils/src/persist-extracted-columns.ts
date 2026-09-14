/**
 * Map OVERVIEW-like extraction onto Contract columns using the repaired
 * persist rules: no signing-as-effective, no role-by-order, notice language
 * only, TCV via resolveTcvWinner, human locks honored.
 */

import { isHumanFieldLocked } from './field-trust';
import { flattenGroundedValue } from './extraction-validation';
import {
  isHumanTcvLocked,
  parseIsoDate,
  parseMonetaryAmount,
  parseNoticePeriodFromClause,
  resolveTcvWinner,
} from './contract-extraction';

export type OverviewLike = {
  parties?: unknown;
  effectiveDate?: unknown;
  expirationDate?: unknown;
  executionDate?: unknown;
  keyDates?: unknown;
  termAndTermination?: unknown;
  jurisdiction?: unknown;
  governingLaw?: unknown;
  totalValue?: unknown;
  currency?: unknown;
};

export type PersistedContractColumns = {
  totalValue?: number;
  currency?: string;
  effectiveDate?: string;
  expirationDate?: string;
  executionDate?: string;
  noticePeriodDays?: number;
  clientName?: string;
  supplierName?: string;
  jurisdiction?: string;
  derivedFields?: Record<string, { rule: string; source: string }>;
};

function unwrap(val: unknown): unknown {
  if (val && typeof val === 'object' && !Array.isArray(val) && 'value' in (val as object) && 'source' in (val as object)) {
    return flattenGroundedValue(val);
  }
  return flattenGroundedValue(val);
}

function unwrapString(val: unknown): string | null {
  const inner = unwrap(val);
  return typeof inner === 'string' && inner.trim() ? inner.trim() : null;
}

function unwrapNumber(val: unknown, locale?: string | null): number | null {
  const inner = unwrap(val);
  if (typeof inner === 'number') return inner > 0 && Number.isFinite(inner) ? inner : null;
  if (typeof inner === 'string') {
    const parsed = parseMonetaryAmount(inner, { locale, rejectAmbiguous: true });
    return parsed != null && parsed > 0 ? parsed : null;
  }
  return null;
}

function toIsoDate(val: unknown, locale?: string | null): string | null {
  const inner = unwrap(val);
  if (!inner) return null;
  if (inner instanceof Date && !Number.isNaN(inner.getTime())) {
    return inner.toISOString().slice(0, 10);
  }
  const iso = parseIsoDate(String(inner), { locale });
  if (iso) return iso;
  const parsed = new Date(String(inner));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function keyDatesOf(raw: unknown): Array<{ event: string; date: unknown }> {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const rec = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    return { event: unwrapString(rec.event) || '', date: rec.date };
  });
}

function resolveFromKeyDates(
  dates: Array<{ event: string; date: unknown }>,
  needles: string[],
  locale?: string | null,
): string | null {
  for (const row of dates) {
    const event = row.event.toLowerCase();
    if (!needles.some((needle) => event.includes(needle))) continue;
    const iso = toIsoDate(row.date, locale);
    if (iso) return iso;
  }
  return null;
}

function partyName(party: unknown): string | null {
  if (typeof party === 'string') return party.trim() || null;
  if (!party || typeof party !== 'object') return null;
  const rec = party as Record<string, unknown>;
  return unwrapString(rec.name) || unwrapString(rec.legalName);
}

function partyRole(party: unknown): string {
  if (!party || typeof party !== 'object') return '';
  return (unwrapString((party as Record<string, unknown>).role) || '').toLowerCase();
}

const CLIENT_ROLE = /client|buyer|customer|purchaser|auftraggeber|acheteur|committente/;
const SUPPLIER_ROLE = /supplier|vendor|provider|contractor|seller|auftragnehmer|fournisseur|fornitore/;

function deriveEndFromTerm(
  effectiveIso: string | null,
  termText: string | null,
): { iso: string; source: string } | null {
  if (!effectiveIso || !termText) return null;
  const wordToNum: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, eighteen: 18, twenty: 20,
  };
  const yearMatch = termText.match(/(?:for|of|period of)\s+(?:a\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:\(\d+\)\s+)?year/i);
  const monthMatch = termText.match(/(?:for|of|period of)\s+(?:a\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|eighteen|twenty)\s+(?:\(\d+\)\s+)?month/i);
  const apply = (num: number, unit: 'year' | 'month') => {
    const d = new Date(`${effectiveIso}T00:00:00Z`);
    if (unit === 'year') d.setUTCFullYear(d.getUTCFullYear() + num);
    else d.setUTCMonth(d.getUTCMonth() + num);
    return d.toISOString().slice(0, 10);
  };
  if (yearMatch) {
    const raw = yearMatch[1] || '';
    const num = parseInt(raw, 10) || wordToNum[raw.toLowerCase()] || 0;
    if (num > 0) return { iso: apply(num, 'year'), source: yearMatch[0] };
  }
  if (monthMatch) {
    const raw = monthMatch[1] || '';
    const num = parseInt(raw, 10) || wordToNum[raw.toLowerCase()] || 0;
    if (num > 0) return { iso: apply(num, 'month'), source: monthMatch[0] };
  }
  return null;
}

export function mapOverviewToPersistedColumns(input: {
  text: string;
  locale?: string | null;
  contractType?: string | null;
  overview?: OverviewLike | null;
  diQueryAnswers?: Record<string, string> | null;
  invoiceTotal?: number | null;
  invoiceCurrency?: string | null;
  aiMetadata?: unknown;
}): PersistedContractColumns {
  const overview = input.overview || {};
  const locale = input.locale;
  const out: PersistedContractColumns = {};
  const locks = input.aiMetadata;

  const tcv = resolveTcvWinner({
    contractType: input.contractType,
    diQueryAnswers: input.diQueryAnswers || {},
    contractText: input.text,
    overviewTotal: unwrapNumber(overview.totalValue, locale),
    overviewCurrency: unwrapString(overview.currency),
    invoiceTotal: input.invoiceTotal ?? null,
    invoiceCurrency: input.invoiceCurrency ?? null,
  });
  if (tcv.value != null && !isHumanTcvLocked(locks) && !isHumanFieldLocked(locks, 'totalValue')) {
    out.totalValue = tcv.value;
  }
  const currency = tcv.currency || unwrapString(overview.currency);
  if (currency && !isHumanFieldLocked(locks, 'currency')) {
    out.currency = currency;
  }

  const keyDates = keyDatesOf(overview.keyDates);
  const effective = toIsoDate(overview.effectiveDate, locale)
    || resolveFromKeyDates(keyDates, ['effective', 'commencement', 'start date', 'inkraft', 'gültig ab'], locale);
  const expiration = toIsoDate(overview.expirationDate, locale)
    || resolveFromKeyDates(keyDates, ['expir', 'term end', 'end date', 'termination date', 'auslauf', 'gültig bis'], locale);
  const execution = toIsoDate(overview.executionDate, locale)
    || resolveFromKeyDates(keyDates, ['execution', 'sign', 'unterzeich'], locale);

  if (effective && !isHumanFieldLocked(locks, 'effectiveDate')) out.effectiveDate = effective;
  if (execution) out.executionDate = execution;

  const termText = unwrapString(overview.termAndTermination);
  const derived = !expiration ? deriveEndFromTerm(effective || null, termText) : null;
  if (expiration && !isHumanFieldLocked(locks, 'expirationDate')) {
    out.expirationDate = expiration;
  } else if (derived && !isHumanFieldLocked(locks, 'expirationDate')) {
    out.expirationDate = derived.iso;
    out.derivedFields = {
      expirationDate: { rule: 'term_duration', source: derived.source.slice(0, 240) },
    };
  }

  const notice = parseNoticePeriodFromClause(termText || '');
  if (notice != null && !isHumanFieldLocked(locks, 'noticePeriodDays')) {
    out.noticePeriodDays = notice;
  }

  const jurisdiction = unwrapString(overview.jurisdiction) || unwrapString(overview.governingLaw);
  if (jurisdiction && !isHumanFieldLocked(locks, 'jurisdiction')) {
    out.jurisdiction = jurisdiction;
  }

  if (Array.isArray(overview.parties)) {
    const client = overview.parties.find((party) => CLIENT_ROLE.test(partyRole(party)));
    const supplier = overview.parties.find((party) => SUPPLIER_ROLE.test(partyRole(party)));
    const clientName = partyName(client);
    const supplierName = partyName(supplier);
    if (clientName && !isHumanFieldLocked(locks, 'clientName')) out.clientName = clientName;
    if (supplierName && !isHumanFieldLocked(locks, 'supplierName')) out.supplierName = supplierName;
  }

  return out;
}

export type GoldenFieldKey =
  | 'totalValue'
  | 'currency'
  | 'effectiveDate'
  | 'expirationDate'
  | 'executionDate'
  | 'noticePeriodDays'
  | 'clientName'
  | 'supplierName'
  | 'jurisdiction';

export const GOLDEN_FIELD_KEYS: GoldenFieldKey[] = [
  'totalValue',
  'currency',
  'effectiveDate',
  'expirationDate',
  'executionDate',
  'noticePeriodDays',
  'clientName',
  'supplierName',
  'jurisdiction',
];

export type FieldScoreStatus = 'correct' | 'missing' | 'incorrect' | 'spurious';

export type FieldScore = {
  field: GoldenFieldKey;
  expected: unknown;
  actual: unknown;
  status: FieldScoreStatus;
};

function normalizeGoldenValue(field: GoldenFieldKey, value: unknown): unknown {
  if (value == null || value === '') return null;
  if (field === 'totalValue' || field === 'noticePeriodDays') {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (field === 'effectiveDate' || field === 'expirationDate' || field === 'executionDate') {
    return toIsoDate(value, 'de') || String(value).slice(0, 10);
  }
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim().toLowerCase();
  return value;
}

export function scorePersistedFields(
  expected: Partial<Record<GoldenFieldKey, unknown>>,
  actual: Partial<Record<GoldenFieldKey, unknown>>,
): { correct: FieldScore[]; missing: FieldScore[]; incorrect: FieldScore[]; spurious: FieldScore[]; rows: FieldScore[] } {
  const rows: FieldScore[] = [];
  for (const field of GOLDEN_FIELD_KEYS) {
    const exp = Object.prototype.hasOwnProperty.call(expected, field)
      ? normalizeGoldenValue(field, expected[field])
      : undefined;
    const act = normalizeGoldenValue(field, actual[field]);
    if (exp === undefined) continue;
    let status: FieldScoreStatus;
    if (exp == null && (act == null || act === '')) status = 'correct';
    else if (exp == null && act != null && act !== '') status = 'spurious';
    else if (exp != null && (act == null || act === '')) status = 'missing';
    else if (exp === act) status = 'correct';
    else status = 'incorrect';
    rows.push({ field, expected: exp, actual: act, status });
  }
  return {
    correct: rows.filter((row) => row.status === 'correct'),
    missing: rows.filter((row) => row.status === 'missing'),
    incorrect: rows.filter((row) => row.status === 'incorrect'),
    spurious: rows.filter((row) => row.status === 'spurious'),
    rows,
  };
}

export function summarizeGoldenRun(label: string, score: ReturnType<typeof scorePersistedFields>): string {
  return `${label}: correct=${score.correct.length} missing=${score.missing.length} incorrect=${score.incorrect.length} spurious=${score.spurious.length}`;
}
