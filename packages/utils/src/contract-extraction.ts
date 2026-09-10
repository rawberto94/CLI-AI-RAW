import { assessSignatureEvidence } from './signature-evidence';

export type ContractTermUnit = 'day' | 'week' | 'month' | 'year';

export interface ContractDurationEvidence {
  value: number;
  unit: ContractTermUnit;
  months: number;
  text: string;
  source: string;
  confidence: number;
  isRenewal: boolean;
}

export interface ContractTermAssessment {
  initialTerm: ContractDurationEvidence | null;
  renewalTerm: ContractDurationEvidence | null;
  derivedEndDate: string | null;
  autoRenewal: boolean;
  evergreen: boolean;
  noticePeriodDays: number | null;
  noticePeriodText: string | null;
  sourceQuote: string | null;
  confidence: number;
}

export interface MonetaryCandidate {
  value: number;
  currency: string | null;
  amountText: string;
  source: string;
  score: number;
  kind: 'aggregate' | 'installment' | 'excluded' | 'unknown';
  reasons: string[];
}

export interface FinancialEvidenceAssessment {
  totalValue: number | null;
  currency: string | null;
  bestCandidate: MonetaryCandidate | null;
  candidates: MonetaryCandidate[];
  paymentScheduleTotal: number | null;
  validationIssues: string[];
}

export interface PartyEvidenceAssessment {
  clientName: string | null;
  supplierName: string | null;
  parties: string[];
  source: string | null;
  confidence: number;
  reviewIssues: string[];
}

export interface CriticalContractEvidenceAssessment {
  evidence: ContractFieldEvidence[];
  metadata: NormalizedContractFieldEvidence['metadata'];
  financial: FinancialEvidenceAssessment;
  term: ContractTermAssessment;
  parties: PartyEvidenceAssessment;
  signature: {
    status: 'signed' | 'partially_signed' | 'unsigned' | 'unknown' | null;
    date: string | null;
    source: string | null;
    confidence: number;
  };
}

export type ContractFieldEvidenceSource = 'azure-di-query' | 'azure-di-key-value' | 'parser' | 'ai' | 'human-review';

export type ContractEvidenceField =
  | 'contractTitle'
  | 'contractType'
  | 'effectiveDate'
  | 'expirationDate'
  | 'initialTerm'
  | 'renewalTerms'
  | 'noticePeriod'
  | 'totalContractValue'
  | 'paymentTerms'
  | 'governingLaw'
  | 'contractingParties'
  | 'clientName'
  | 'supplierName'
  | 'signatureStatus'
  | 'signatureDate'
  | 'autoRenewal'
  | 'terminationClause'
  | 'liabilityCap'
  | 'keyObligations'
  | 'contractCurrency';

export interface ContractFieldEvidence {
  field: ContractEvidenceField;
  value: string;
  normalizedValue?: string | number | boolean | string[] | null;
  currency?: string | null;
  source: ContractFieldEvidenceSource;
  confidence: number;
  question?: string;
  sourceQuote?: string;
  /** Human-readable review flags raised during validation. */
  reviewIssues?: string[];
}

export interface NormalizedContractFieldEvidence {
  evidence: ContractFieldEvidence[];
  metadata: {
    title?: string;
    contractType?: string;
    startDate?: string;
    endDate?: string;
    initialTerm?: string;
    renewalTerms?: string;
    noticePeriodDays?: number;
    totalValue?: number;
    currency?: string;
    paymentTerms?: string;
    jurisdiction?: string;
    parties?: string[];
    clientName?: string;
    supplierName?: string;
    signatureStatus?: 'signed' | 'partially_signed' | 'unsigned' | 'unknown';
    signatureDate?: string;
    autoRenewal?: boolean;
    terminationClause?: string;
    liabilityCap?: number;
    liabilityCapCurrency?: string;
    keyObligations?: string;
  };
}

export interface ContractDIQueryFieldDefinition {
  /** API-compliant identifier passed to Azure DI queryFields (matches field name). */
  identifier: string;
  field: ContractEvidenceField;
  /** Human-readable question stored as metadata. */
  question: string;
}

export const CONTRACT_DI_QUERY_FIELD_DEFINITIONS: ContractDIQueryFieldDefinition[] = [
  { identifier: 'contractTitle', field: 'contractTitle', question: 'What is the contract title or agreement name?' },
  { identifier: 'contractType', field: 'contractType', question: 'What type of contract is this?' },
  { identifier: 'effectiveDate', field: 'effectiveDate', question: 'What is the contract effective date?' },
  { identifier: 'expirationDate', field: 'expirationDate', question: 'What is the contract expiration date or end date?' },
  { identifier: 'initialTerm', field: 'initialTerm', question: 'What is the initial contract term or duration?' },
  { identifier: 'renewalTerms', field: 'renewalTerms', question: 'What are the renewal terms or renewal period?' },
  { identifier: 'noticePeriod', field: 'noticePeriod', question: 'What is the termination or renewal notice period (Kündigungsfrist)?' },
  { identifier: 'totalContractValue', field: 'totalContractValue', question: 'What is the total contract value, aggregate fee, NTE, or Gesamtvertragswert? Do not return a milestone, liability cap, insurance, or example amount.' },
  { identifier: 'contractCurrency', field: 'contractCurrency', question: 'What currency are the contract amounts in (CHF, Fr., EUR, USD)? Return an ISO 4217 code only.' },
  { identifier: 'paymentTerms', field: 'paymentTerms', question: 'What are the payment terms (Zahlungsbedingungen, Net days)?' },
  { identifier: 'governingLaw', field: 'governingLaw', question: 'What is the governing law, jurisdiction, or anwendbares Recht?' },
  { identifier: 'contractingParties', field: 'contractingParties', question: 'Who are the contracting parties?' },
  { identifier: 'clientName', field: 'clientName', question: 'Who is the client, buyer, or customer?' },
  { identifier: 'supplierName', field: 'supplierName', question: 'Who is the supplier, vendor, or service provider?' },
  { identifier: 'signatureStatus', field: 'signatureStatus', question: 'Is the contract signed, partially signed, unsigned, or unknown?' },
  { identifier: 'signatureDate', field: 'signatureDate', question: 'What is the signature or execution date?' },
  { identifier: 'autoRenewal', field: 'autoRenewal', question: 'Does the contract automatically renew?' },
  { identifier: 'terminationClause', field: 'terminationClause', question: 'What is the termination clause or termination right?' },
  { identifier: 'liabilityCap', field: 'liabilityCap', question: 'What is the liability cap or limitation of liability amount?' },
  { identifier: 'keyObligations', field: 'keyObligations', question: 'What are the key deliverables, service levels, or obligations?' },
];

/** Array of API-compliant identifiers to pass to Azure DI queryFields. */
export const CONTRACT_DI_QUERY_IDENTIFIERS = CONTRACT_DI_QUERY_FIELD_DEFINITIONS.map(definition => definition.identifier);

/** @deprecated Use CONTRACT_DI_QUERY_IDENTIFIERS. Kept for callers that previously passed questions. */
export const CONTRACT_DI_QUERY_FIELDS = CONTRACT_DI_QUERY_IDENTIFIERS;

/** Map from DI query identifier back to the original human-readable question. */
export const CONTRACT_DI_QUERY_ID_TO_QUESTION: Record<string, string> = Object.fromEntries(
  CONTRACT_DI_QUERY_FIELD_DEFINITIONS.map(definition => [definition.identifier, definition.question])
);

/** Confidence threshold below which a field should be flagged for human review. */
export const REVIEW_FLAG_THRESHOLD = 0.7;

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const NUMBER_PATTERN = '(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)';
const UNIT_PATTERN = '(?:years?|yrs?|months?|mos?|weeks?|wks?|days?)';
const MONTH_NAMES = '(?:january|february|march|april|may|june|july|august|september|october|november|december|januar|februar|märz|maerz|mai|juni|juli|oktober|dezember)';
const DATE_PATTERN = `(?:${MONTH_NAMES}\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}\\.?\\s+${MONTH_NAMES}\\s+\\d{4}|\\d{1,2}[\\/\\.\\-]\\d{1,2}[\\/\\.\\-]\\d{2,4})`;

const INITIAL_TERM_PATTERNS = [
  new RegExp(`\\b(?:initial\\s+)?term(?:\\s+of\\s+(?:this|the)\\s+agreement)?[^.\\n;]{0,120}?(?:is|shall\\s+be|will\\s+be|continues?\\s+for|lasts?|runs?|for|of)\\s+(?:a\\s+period\\s+of\\s+)?(?<value>${NUMBER_PATTERN})(?:\\s*\\(\\s*\\d+\\s*\\))?\\s*(?<unit>${UNIT_PATTERN})`, 'gi'),
  new RegExp(`\\b(?:for|during)\\s+(?:a\\s+period\\s+of\\s+)?(?<value>${NUMBER_PATTERN})(?:\\s*\\(\\s*\\d+\\s*\\))?\\s*(?<unit>${UNIT_PATTERN})\\s+(?:from|after)\\s+(?:the\\s+)?(?:effective\\s+date|commencement\\s+date|start\\s+date)`, 'gi'),
  new RegExp(`\\b(?<value>${NUMBER_PATTERN})(?:\\s*\\(\\s*\\d+\\s*\\))?[-\\s]*(?<unit>years?|yrs?|months?|mos?|weeks?|wks?|days?)\\s+(?:initial\\s+)?(?:renewal\\s+)?(?:terms?|periods?|duration)\\b`, 'gi'),
  new RegExp(`\\b(?:successive|additional|renewal)\\s+(?<value>${NUMBER_PATTERN})(?:\\s*\\(\\s*\\d+\\s*\\))?\\s*(?<unit>${UNIT_PATTERN})\\s+(?:renewal\\s+)?(?:terms?|periods?)\\b`, 'gi'),
  new RegExp(`\\b(?:expires?|terminates?)\\s+(?<value>${NUMBER_PATTERN})(?:\\s*\\(\\s*\\d+\\s*\\))?\\s*(?<unit>${UNIT_PATTERN})\\s+(?:from|after)\\s+(?:the\\s+)?(?:effective\\s+date|commencement\\s+date|start\\s+date)`, 'gi'),
];

const NOTICE_PATTERNS = [
  new RegExp(`\\b(?<value>${NUMBER_PATTERN})(?:\\s*\\(\\s*\\d+\\s*\\))?\\s*(?<unit>days?|months?)\\s+(?:prior\\s+to|before|advance\\s+written\\s+notice|written\\s+notice|notice)`, 'gi'),
  new RegExp(`\\bnotice(?:\\s+(?:period|requirement|required))?[^.\\n;]{0,80}?(?<value>${NUMBER_PATTERN})(?:\\s*\\(\\s*\\d+\\s*\\))?\\s*(?<unit>days?|months?)`, 'gi'),
];

const EXPLICIT_END_DATE_PATTERNS = [
  new RegExp(`\\b(?:expires?|expiration\\s+date|end\\s+date|terminates?|termination\\s+date)\\s*(?:on|as\\s+of|:)?\\s*(?<date>${DATE_PATTERN})`, 'gi'),
  new RegExp(`\\b(?:until|through)\\s+(?<date>${DATE_PATTERN})`, 'gi'),
];

const MONEY_PATTERN = /((?:USD|EUR|GBP|CHF|SFr\.?|Fr\.?)\s*[$€£]?\s*\d[\d''’.,]*(?:\s*(?:m|mn|mm|million|k|thousand))?|[$€£]\s*\d[\d''’.,]*(?:\s*(?:m|mn|mm|million|k|thousand))?|\b\d+(?:['’.,]\d+)?\s*(?:m|mn|mm|million|k|thousand)\b(?:\s*(?:USD|EUR|GBP|CHF))?|\b\d{1,3}(?:['’']\d{3})+(?:\.\d+)?\b|\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b)/gi;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

const MONTH_NUMBER: Record<string, number> = {
  january: 1, februar: 2, february: 2, march: 3, märz: 3, maerz: 3,
  april: 4, may: 5, mai: 5, june: 6, juni: 6, july: 7, juli: 7,
  august: 8, september: 9, october: 10, oktober: 10, november: 11,
  december: 12, dezember: 12, januar: 1,
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function ymd(yearRaw: string | number, month: number, day: number): string | null {
  let year = typeof yearRaw === 'number' ? yearRaw : Number.parseInt(yearRaw, 10);
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  if (!Number.isFinite(year) || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function parseIsoDate(
  value: string,
  options?: { locale?: 'de' | 'fr' | 'it' | 'en' | string | null },
): string | null {
  const normalized = value
    .replace(/(\d)(st|nd|rd|th)\b/gi, '$1')
    .replace(/\b(?:effective|date|as of|on|from|until|through|inkrafttreten|gültig(?:keitsdauer)?|unterzeichnet)\b/gi, ' ')
    .replace(/[,:;]+$/g, '')
    .trim();
  if (!normalized) return null;

  const iso = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return ymd(iso[1]!, Number(iso[2]), Number(iso[3]));

  // Swiss/German numeric dates: 01.01.2026 is 1 January, not 1st of a US month.
  const dotted = normalized.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (dotted) return ymd(dotted[3]!, Number(dotted[2]), Number(dotted[1]));

  // Slash dates: DE/FR/IT (and default) are DD/MM. English ambiguous MM/DD vs DD/MM is not guessed.
  const slashed = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashed) {
    const first = Number(slashed[1]);
    const second = Number(slashed[2]);
    const year = slashed[3]!;
    if (first > 12 && second <= 12) return ymd(year, second, first);
    if (second > 12 && first <= 12) return ymd(year, first, second);
    const loc = (options?.locale || 'de').toString().toLowerCase().slice(0, 2);
    if (loc === 'en') return null;
    return ymd(year, second, first);
  }

  const dayMonth = normalized.match(/^(\d{1,2})\.?\s+([A-Za-zäöüÄÖÜéè]+)\s+(\d{4})$/);
  if (dayMonth) {
    const month = MONTH_NUMBER[dayMonth[2]!.toLowerCase()];
    if (month) return ymd(dayMonth[3]!, month, Number(dayMonth[1]));
  }

  const monthDay = normalized.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (monthDay) {
    const month = MONTH_NUMBER[monthDay[1]!.toLowerCase()];
    if (month) return ymd(monthDay[3]!, month, Number(monthDay[2]));
  }

  const directDate = new Date(normalized);
  if (!Number.isNaN(directDate.getTime()) && !/^\d{1,2}[./]\d{1,2}[./]\d{2,4}$/.test(normalized)) {
    return directDate.toISOString().slice(0, 10);
  }

  const dateMatch = normalized.match(new RegExp(DATE_PATTERN, 'i'));
  if (!dateMatch?.[0]) return null;
  const matched = dateMatch[0];
  const dottedMatch = matched.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (dottedMatch) return ymd(dottedMatch[3]!, Number(dottedMatch[2]), Number(dottedMatch[1]));
  const matchedDate = new Date(matched.replace(/(\d)(st|nd|rd|th)\b/gi, '$1'));
  return Number.isNaN(matchedDate.getTime()) ? null : matchedDate.toISOString().slice(0, 10);
}

function extractExplicitEndDate(text: string): { date: string; source: string } | null {
  for (const pattern of EXPLICIT_END_DATE_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const date = parseIsoDate(match.groups?.date || '');
      if (!date) continue;

      return {
        date,
        source: contextAround(text, match.index ?? 0, match[0].length),
      };
    }
  }

  return null;
}

function parseNoticePeriodDays(value: string): number | null {
  const match = value.match(new RegExp(`(?<value>${NUMBER_PATTERN})\\s*(?<unit>days?|months?|weeks?)`, 'i'));
  const parsedValue = parseNumberText(match?.groups?.value);
  const rawUnit = match?.groups?.unit;
  if (!parsedValue || !rawUnit) return null;

  return Math.round(durationDays(parsedValue, normalizeTermUnit(rawUnit)));
}

function parseParties(value: string): string[] {
  return value
    .split(/\s+(?:and|&|;|\|)\s+|\n|,/i)
    .map(part => normalizeWhitespace(part).replace(/^(?:the\s+)?(?:parties\s+are|between)\s+/i, ''))
    .filter(part => part.length > 1 && !/^(?:buyer|supplier|client|vendor|customer|party|parties)$/i.test(part))
    .slice(0, 8);
}

function normalizeLookupName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let normalized = normalizeWhitespace(value)
    .replace(/^(?:the\s+)?(?:client|buyer|customer|purchaser|supplier|vendor|provider|service\s+provider|seller)\s*(?:is|:|-)\s*/i, '')
    .replace(/^not\s+(?:specified|stated|available|found)\.?$/i, '')
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/[.;:]+$/g, '')
    .trim();

  const legalNameMatch = normalized.match(/^(.*?\b(?:Inc\.?|LLC|Ltd\.?|Corp(?:oration)?\.?|Co\.?|LP|LLP|PLC|GmbH|AG|SA|SAS|BV|NV|SARL|S\.r\.l\.?|Oy|AB))(?:,|$)/i);
  if (legalNameMatch?.[1]) normalized = normalizeWhitespace(legalNameMatch[1]);

  if (normalized.length < 2 || normalized.length > 180) return null;
  if (/^(?:unknown|n\/a|none|null|not\s+(?:specified|stated|available|found))$/i.test(normalized)) return null;
  if (/^(?:client|supplier|vendor|buyer|seller|party|parties|customer|provider)$/i.test(normalized)) return null;
  return normalized;
}

function normalizeEvidenceText(value: unknown, maxLength = 1200): string | null {
  if (typeof value !== 'string') return null;
  const normalized = normalizeWhitespace(value)
    .replace(/^(?:not\s+(?:specified|stated|available|found)|none|n\/a)\.?$/i, '')
    .trim();
  return normalized.length > 0 ? normalized.slice(0, maxLength) : null;
}

function parseBooleanAnswer(value: string): boolean | null {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (/\b(?:no|not|does\s+not|do\s+not|without|non[-\s]?renewal|will\s+not|shall\s+not)\b/.test(normalized)) return false;
  if (/\b(?:yes|automatically\s+renew|auto[-\s]?renew|renews?\s+automatically|shall\s+renew|will\s+renew|successive\s+(?:renewal\s+)?terms?)\b/.test(normalized)) return true;
  return null;
}

function normalizeSignatureStatusAnswer(value: string): 'signed' | 'partially_signed' | 'unsigned' | 'unknown' | null {
  const normalized = normalizeWhitespace(value).toLowerCase();
  if (!normalized) return null;
  if (/\b(?:unknown|unclear|not\s+(?:specified|stated|available|found))\b/.test(normalized)) return 'unknown';
  if (/\b(?:unsigned|not\s+signed|no\s+signature|blank\s+signature|signature\s+(?:line|field)s?\s+(?:blank|empty))\b/.test(normalized)) return 'unsigned';
  if (/\b(?:partially\s+signed|partly\s+signed|one\s+party\s+signed|only\s+.*\s+signed)\b/.test(normalized)) return 'partially_signed';
  if (/\b(?:signed|executed|docusigned|electronically\s+signed|digitally\s+signed|signature\s+completed)\b/.test(normalized)) return 'signed';
  return null;
}

function parseLiabilityCap(value: string): { amount: number | null; currency: string | null } {
  const amountMatch = value.match(new RegExp(MONEY_PATTERN.source, 'gi'));
  const amount = amountMatch?.[1] ? parseMonetaryAmount(amountMatch[1]) : parseMonetaryAmount(value);
  return {
    amount: amount != null && amount > 0 && amount < 1e12 ? amount : null,
    currency: detectCurrency(value),
  };
}

const LEGAL_ENTITY_SUFFIXES = '(?:Inc\\.?|LLC|Ltd\\.?|Limited|Corp(?:oration)?\\.?|Co\\.?|LP|LLP|PLC|GmbH|AG|SA|SAS|BV|NV|SARL|S\\.r\\.l\\.?|Oy|AB)';
const LEGAL_ENTITY_STOP_WORDS = new Set(['this', 'that', 'the', 'a', 'an', 'each', 'every', 'any', 'such', 'one', 'two', 'and', '&']);

function isPlausibleLegalEntityName(name: string): boolean {
  const normalized = normalizeWhitespace(name);
  if (normalized.length < 3 || normalized.length > 140) return false;
  const words = normalized.split(/\s+/);
  const firstWord = words[0]?.toLowerCase();
  if (!firstWord || LEGAL_ENTITY_STOP_WORDS.has(firstWord)) return false;
  // Each non-connector word should start with an uppercase letter.
  for (const word of words) {
    if (word === '&' || word.toLowerCase() === 'and') continue;
    if (!/^[A-Z]/.test(word)) return false;
  }
  return true;
}

const QUERY_REJECT_WORDS = /\b(?:late|pending|approx|approximately|estimated|example|sample|illustrative|tbd|tbc|n\/a|not\s+applicable|unknown|unspecified)\b/i;

function hasLegalEntitySuffix(value: string): boolean {
  return new RegExp(`\\b${LEGAL_ENTITY_SUFFIXES}(?:,|$|\\s)`, 'i').test(value);
}

function findNearestLegalEntity(text: string, nearIndex = 0): string | null {
  const searchWindow = text.slice(0, 2000);
  const suffixPattern = new RegExp(`\\b${LEGAL_ENTITY_SUFFIXES}\\b`, 'gi');
  let best: { name: string; distance: number } | null = null;

  for (const match of searchWindow.matchAll(suffixPattern)) {
    const suffixStart = match.index ?? 0;
    const before = searchWindow.slice(0, suffixStart);
    const tokens = before.split(/\s+/);
    const nameParts: string[] = [match[0]];
    let collected = 0;

    // Walk backwards from the suffix to collect the preceding capitalized words.
    for (let i = tokens.length - 1; i >= 0 && collected < 10; i--) {
      const rawToken = tokens[i];
      if (!rawToken) continue;
      const token = rawToken.replace(/[,;:.]+$/g, '');
      if (!token) continue;
      if (token === '&' || token.toLowerCase() === 'and') {
        nameParts.unshift(token);
        continue;
      }
      if (!/^[A-Z]/.test(token)) break;
      if (LEGAL_ENTITY_STOP_WORDS.has(token.toLowerCase())) break;
      nameParts.unshift(token);
      collected++;
    }

    const name = nameParts.join(' ');
    if (!isPlausibleLegalEntityName(name)) continue;
    const distance = Math.abs(suffixStart - nearIndex);
    if (!best || distance < best.distance) {
      best = { name, distance };
    }
  }

  return best?.name ?? null;
}

function findMostMentionedCurrency(text: string): string | null {
  const matches = text.match(/\b(?:USD|EUR|GBP|CHF|SFr\.?)\b|(?:^|[^\w])Fr\.|[$€£]/gi) || [];
  if (matches.length === 0) return null;
  const counts = new Map<string, number>();
  for (const match of matches) {
    const currency = detectCurrency(match);
    if (!currency) continue;
    counts.set(currency, (counts.get(currency) || 0) + 1);
  }
  let top: string | null = null;
  let topCount = 0;
  for (const [currency, count] of counts.entries()) {
    if (count > topCount) {
      top = currency;
      topCount = count;
    }
  }
  return top;
}

function extractJurisdictionName(value: string): string | null {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= 80 && !/[.!?]/.test(normalized)) {
    return normalized;
  }
  const patterns = [
    /(?:laws?\s+of|governed\s+(?:by|in\s+accordance\s+with)|jurisdiction\s+of|courts?\s+of)\s+([^,.;\n]{2,80})/i,
    /(?:the\s+)?(?:state|country|laws?)\s+(?:of\s+)?([^,.;\n]{2,80})/i,
    /(?:governing\s+law|jurisdiction)[:\-]?\s*([^,.;\n]{2,80})/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      const candidate = normalizeWhitespace(match[1]);
      if (candidate.length >= 2 && candidate.length <= 80) return candidate;
    }
  }
  return null;
}

export interface DIQueryValidationResult {
  /** Answers after validation/correction. */
  answers: Record<string, string>;
  /** Per-field review flags with suggested confidence penalty. */
  flags: Array<{ field: string; issue: string; confidencePenalty: number }>;
  /** Identifiers that were removed because validation failed. */
  rejected: string[];
}

/**
 * Validate and correct Azure DI query-field answers before normalization.
 *
 * Rules:
 * - Currency amounts must parse to a number and must not contain reject words (e.g. "Late").
 * - Parties should contain a legal-entity suffix; otherwise we look for the nearest legal entity
 *   in the first 2,000 characters of the document text.
 * - Dates must be parseable by Date.parse/parseIsoDate.
 * - Governing law / jurisdiction answers are trimmed to a short location name.
 * - If a contractCurrency answer is missing, we fall back to the most-mentioned currency code.
 */
export function validateDIQueryAnswers(
  answers: Record<string, string>,
  fullText: string
): DIQueryValidationResult {
  const validated: Record<string, string> = {};
  const flags: Array<{ field: string; issue: string; confidencePenalty: number }> = [];
  const rejected: string[] = [];

  for (const [key, value] of Object.entries(answers)) {
    const normalized = normalizeWhitespace(value);
    if (!normalized) continue;
    validated[key] = normalized;
  }

  for (const definition of CONTRACT_DI_QUERY_FIELD_DEFINITIONS) {
    const id = definition.identifier;
    const value = validated[id];
    if (!value) continue;

    if (id === 'totalContractValue' || id === 'liabilityCap') {
      if (QUERY_REJECT_WORDS.test(value)) {
        flags.push({ field: id, issue: `${id} answer contains non-aggregate/example wording: "${value}"`, confidencePenalty: 0.35 });
        delete validated[id];
        rejected.push(id);
        continue;
      }
      const amount = parseMonetaryAmount(value);
      if (amount == null || amount <= 0 || amount >= 1e12) {
        flags.push({ field: id, issue: `${id} answer is not a parseable positive number: "${value}"`, confidencePenalty: 0.35 });
        delete validated[id];
        rejected.push(id);
        continue;
      }
    }

    if (id === 'effectiveDate' || id === 'expirationDate' || id === 'signatureDate') {
      const parsed = parseIsoDate(value);
      if (!parsed) {
        flags.push({ field: id, issue: `${id} answer is not a parseable date: "${value}"`, confidencePenalty: 0.3 });
        delete validated[id];
        rejected.push(id);
        continue;
      }
      // Replace with ISO-normalized date for consistency.
      validated[id] = parsed;
    }

    if (id === 'clientName' || id === 'supplierName') {
      const original = value;
      if (!hasLegalEntitySuffix(original)) {
        const entity = findNearestLegalEntity(fullText, 0);
        if (entity) {
          validated[id] = entity;
          flags.push({ field: id, issue: `${id} replaced "${original}" with nearest legal entity "${entity}"`, confidencePenalty: 0.15 });
        } else {
          flags.push({ field: id, issue: `${id} answer does not contain a legal entity suffix: "${original}"`, confidencePenalty: 0.2 });
        }
      }
    }

    if (id === 'contractCurrency') {
      const detected = detectCurrency(value);
      const code = detected || (/^[A-Z]{3}$/.test(value.trim().toUpperCase()) ? value.trim().toUpperCase() : null);
      if (!code || code === 'XXX') {
        flags.push({ field: id, issue: `contractCurrency is not a real ISO code: "${value}"`, confidencePenalty: 0.3 });
        delete validated[id];
        rejected.push(id);
        continue;
      }
      validated[id] = code;
    }

    if (id === 'governingLaw') {
      const jurisdiction = extractJurisdictionName(value);
      if (!jurisdiction) {
        flags.push({ field: id, issue: `governingLaw answer is not a concise jurisdiction: "${value}"`, confidencePenalty: 0.25 });
        delete validated[id];
        rejected.push(id);
      } else if (jurisdiction !== value) {
        validated[id] = jurisdiction;
        flags.push({ field: id, issue: `governingLaw trimmed from "${value}" to "${jurisdiction}"`, confidencePenalty: 0.1 });
      }
    }
  }

  // Fallback currency when DI did not return one.
  if (!validated.contractCurrency) {
    const mostMentioned = findMostMentionedCurrency(fullText);
    if (mostMentioned) {
      validated.contractCurrency = mostMentioned;
      flags.push({ field: 'contractCurrency', issue: `contractCurrency inferred from document text as ${mostMentioned}`, confidencePenalty: 0.1 });
    }
  }

  return { answers: validated, flags, rejected };
}

function parseNumberText(value: string | undefined): number | null {
  if (!value) return null;

  const normalized = value.toLowerCase().trim();
  const parsed = Number.parseInt(normalized, 10);
  if (Number.isFinite(parsed)) return parsed;

  return NUMBER_WORDS[normalized] ?? null;
}

function normalizeTermUnit(value: string): ContractTermUnit {
  const normalized = value.toLowerCase();
  if (normalized.startsWith('year') || normalized === 'yr' || normalized === 'yrs') return 'year';
  if (normalized.startsWith('month') || normalized === 'mo' || normalized === 'mos') return 'month';
  if (normalized.startsWith('week') || normalized === 'wk' || normalized === 'wks') return 'week';
  return 'day';
}

function durationMonths(value: number, unit: ContractTermUnit): number {
  if (unit === 'year') return value * 12;
  if (unit === 'month') return value;
  if (unit === 'week') return value / 4.345;
  return value / 30.44;
}

function durationDays(value: number, unit: ContractTermUnit): number {
  if (unit === 'year') return value * 365;
  if (unit === 'month') return value * 30;
  if (unit === 'week') return value * 7;
  return value;
}

function contextAround(text: string, index: number, length: number, radius = 180): string {
  return normalizeWhitespace(text.slice(Math.max(0, index - radius), Math.min(text.length, index + length + radius)));
}

function isRenewalContext(context: string, matchedText: string): boolean {
  if (/\b(?:renewal|renew|successive|extension|extended)\b/i.test(matchedText)) {
    return true;
  }

  const normalized = context.toLowerCase();
  return /\b(?:renewal|renew|renews|successive|extension|extended|automatic(?:ally)?\s+renew)/.test(normalized) &&
    !/\binitial\s+term\b/.test(matchedText.toLowerCase());
}

function isNoticeOnlyContext(context: string): boolean {
  const normalized = context.toLowerCase();
  return /\b(?:notice|prior\s+to|before\s+expiration|terminate|termination)\b/.test(normalized) &&
    !/\b(?:initial\s+term|term\s+of\s+(?:this|the)\s+agreement)\b/.test(normalized);
}

function buildDurationEvidence(match: RegExpExecArray, text: string): ContractDurationEvidence | null {
  const value = parseNumberText(match.groups?.value);
  const rawUnit = match.groups?.unit;
  if (!value || !rawUnit) return null;

  const source = contextAround(text, match.index, match[0].length);
  const unit = normalizeTermUnit(rawUnit);
  if (isNoticeOnlyContext(source) && unit !== 'year') return null;

  const renewal = isRenewalContext(source, match[0]);
  const hasStrongInitialLanguage = /\binitial\s+term\b|\bterm\s+of\s+(?:this|the)\s+agreement\b|\bfrom\s+(?:the\s+)?effective\s+date\b/i.test(source);

  return {
    value,
    unit,
    months: durationMonths(value, unit),
    text: `${value} ${unit}${value === 1 ? '' : 's'}`,
    source,
    confidence: hasStrongInitialLanguage ? 0.9 : renewal ? 0.75 : 0.78,
    isRenewal: renewal,
  };
}

function addDurationToIsoDate(isoDate: string, duration: ContractDurationEvidence): string | null {
  const startDate = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(startDate.getTime())) return null;

  const endDate = new Date(startDate);
  if (duration.unit === 'year' || duration.unit === 'month') {
    endDate.setUTCMonth(endDate.getUTCMonth() + Math.round(duration.months));
  } else {
    endDate.setUTCDate(endDate.getUTCDate() + durationDays(duration.value, duration.unit));
  }

  return endDate.toISOString().slice(0, 10);
}

function extractNoticePeriod(text: string): { days: number; text: string } | null {
  for (const pattern of NOTICE_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const value = parseNumberText(match.groups?.value);
      const rawUnit = match.groups?.unit;
      if (!value || !rawUnit) continue;

      const unit = normalizeTermUnit(rawUnit);
      const days = durationDays(value, unit);
      if (days > 0 && days < 3650) {
        return {
          days,
          text: `${value} ${unit}${value === 1 ? '' : 's'}`,
        };
      }
    }
  }

  return null;
}

export function assessContractTermEvidence(
  contractText: string,
  options: { effectiveDate?: string | null } = {}
): ContractTermAssessment {
  const durations: ContractDurationEvidence[] = [];

  if (!contractText || contractText.trim().length === 0) {
    return {
      initialTerm: null,
      renewalTerm: null,
      derivedEndDate: null,
      autoRenewal: false,
      evergreen: false,
      noticePeriodDays: null,
      noticePeriodText: null,
      sourceQuote: null,
      confidence: 0,
    };
  }

  for (const pattern of INITIAL_TERM_PATTERNS) {
    for (const match of contractText.matchAll(pattern)) {
      const evidence = buildDurationEvidence(match, contractText);
      if (evidence) durations.push(evidence);
    }
  }

  durations.sort((left, right) => right.confidence - left.confidence || right.months - left.months);
  const initialTerm = durations.find(evidence => !evidence.isRenewal) ?? null;
  const renewalTerm = durations.find(evidence => evidence.isRenewal) ?? null;
  const noticePeriod = extractNoticePeriod(contractText);
  const autoRenewal = /\b(?:automatically\s+renew|auto-?renews?|shall\s+renew|will\s+renew|renews?\s+automatically|successive\s+(?:renewal\s+)?terms?)\b/i.test(contractText);
  const evergreen = /\b(?:evergreen|perpetual|in\s+perpetuity|indefinite\s+term|continues?\s+indefinitely|no\s+fixed\s+term)\b/i.test(contractText);
  const explicitEndDate = extractExplicitEndDate(contractText);
  const derivedEndDate = explicitEndDate?.date ?? (initialTerm && options.effectiveDate
    ? addDurationToIsoDate(options.effectiveDate, initialTerm)
    : null);
  const sourceQuote = explicitEndDate?.source ?? initialTerm?.source ?? renewalTerm?.source ?? null;

  return {
    initialTerm,
    renewalTerm,
    derivedEndDate,
    autoRenewal,
    evergreen,
    noticePeriodDays: noticePeriod?.days ?? null,
    noticePeriodText: noticePeriod?.text ?? null,
    sourceQuote,
    confidence: explicitEndDate ? 0.92 : initialTerm?.confidence ?? renewalTerm?.confidence ?? (autoRenewal || evergreen ? 0.7 : 0),
  };
}

export function parseMonetaryAmount(
  value: string,
  options?: { locale?: 'de' | 'fr' | 'it' | 'en' | string | null },
): number | null {
  const normalizedText = value.toLowerCase();
  const multiplier = /\b(?:m|mn|mm|million)\b/.test(normalizedText)
    ? 1_000_000
    : /\b(?:k|thousand)\b/.test(normalizedText)
      ? 1_000
      : 1;
  const cleaned = value
    .replace(/\b(?:USD|EUR|GBP|CHF)\b/gi, '')
    .replace(/\bSFr\.?\s*/gi, '')
    .replace(/\bFr\.\s*/gi, '')
    .replace(/[$€£]/g, '')
    .replace(/\b(?:m|mn|mm|million|k|thousand)\b/gi, '')
    .replace(/'/g, '')
    .replace(/[^\d,.-]/g, '')
    .trim();

  if (!cleaned) return null;

  const loc = (options?.locale || '').toString().toLowerCase().slice(0, 2);
  const european = loc === 'de' || loc === 'fr' || loc === 'it';

  let numericText = cleaned;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    numericText = cleaned.lastIndexOf('.') > cleaned.lastIndexOf(',')
      ? cleaned.replace(/,/g, '')
      : cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',') && !cleaned.includes('.')) {
    const parts = cleaned.split(',');
    numericText = parts[parts.length - 1]?.length === 2
      ? cleaned.replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (cleaned.includes('.') && !cleaned.includes(',') && european) {
    const parts = cleaned.split('.');
    const last = parts[parts.length - 1] || '';
    if (last.length === 3 && parts.length >= 2) {
      numericText = cleaned.replace(/\./g, '');
    }
  }

  const parsed = Number.parseFloat(numericText);
  return Number.isFinite(parsed) ? parsed * multiplier : null;
}

function detectCurrency(value: string): string | null {
  if (/\bCHF\b/i.test(value) || /\bSFr\.?\b/i.test(value) || /\bFr\./i.test(value)) return 'CHF';
  if (/\bEUR\b/i.test(value) || /€/.test(value)) return 'EUR';
  if (/\bGBP\b/i.test(value) || /£/.test(value)) return 'GBP';
  if (/\bUSD\b/i.test(value) || /\$/.test(value)) return 'USD';
  return null;
}

export function normalizeDIQueryAnswers(
  answers: Record<string, string>,
  options: {
    confidence?: number;
    source?: ContractFieldEvidenceSource;
    /** Per-field validation results used to lower confidence and attach review flags. */
    fieldValidations?: Record<string, { issue?: string; confidencePenalty?: number }>;
  } = {}
): NormalizedContractFieldEvidence {
  const evidence: ContractFieldEvidence[] = [];
  const metadata: NormalizedContractFieldEvidence['metadata'] = {};
  const baseConfidence = options.confidence ?? 0.8;
  const source = options.source ?? 'azure-di-query';
  const fieldValidations = options.fieldValidations ?? {};

  for (const definition of CONTRACT_DI_QUERY_FIELD_DEFINITIONS) {
    const rawAnswer = answers[definition.identifier] ?? answers[definition.field] ?? answers[definition.question];
    if (!rawAnswer || normalizeWhitespace(rawAnswer).length === 0) continue;

    const value = normalizeWhitespace(rawAnswer);
    const validation = fieldValidations[definition.identifier] ?? fieldValidations[definition.field];
    const confidence = Math.max(0, Math.min(1, baseConfidence - (validation?.confidencePenalty ?? 0)));
    const item: ContractFieldEvidence = {
      field: definition.field,
      value,
      source,
      confidence,
      question: definition.question,
      sourceQuote: value,
      ...(validation?.issue ? { reviewIssues: [validation.issue] } : {}),
    };

    if (definition.field === 'contractTitle') {
      const title = normalizeEvidenceText(value, 240);
      item.normalizedValue = title;
      if (title) metadata.title = title;
    } else if (definition.field === 'contractType') {
      const contractType = normalizeEvidenceText(value, 80);
      item.normalizedValue = contractType;
      if (contractType) metadata.contractType = contractType;
    } else if (definition.field === 'effectiveDate') {
      const normalizedDate = parseIsoDate(value);
      item.normalizedValue = normalizedDate;
      if (normalizedDate) metadata.startDate = normalizedDate;
    } else if (definition.field === 'expirationDate') {
      const normalizedDate = parseIsoDate(value);
      item.normalizedValue = normalizedDate;
      if (normalizedDate) metadata.endDate = normalizedDate;
    } else if (definition.field === 'totalContractValue') {
      const financial = extractFinancialEvidence(value);
      const totalValue = financial.totalValue ?? parseMonetaryAmount(value);
      item.normalizedValue = totalValue;
      item.currency = financial.currency ?? detectCurrency(value);
      if (totalValue != null) metadata.totalValue = totalValue;
      if (item.currency) metadata.currency = item.currency;
    } else if (definition.field === 'noticePeriod') {
      const noticeDays = parseNoticePeriodDays(value);
      item.normalizedValue = noticeDays;
      if (noticeDays != null) metadata.noticePeriodDays = noticeDays;
    } else if (definition.field === 'contractingParties') {
      const parties = parseParties(value);
      item.normalizedValue = parties;
      if (parties.length > 0) metadata.parties = parties;
    } else if (definition.field === 'clientName') {
      const clientName = normalizeLookupName(value);
      item.normalizedValue = clientName;
      if (clientName) metadata.clientName = clientName;
    } else if (definition.field === 'supplierName') {
      const supplierName = normalizeLookupName(value);
      item.normalizedValue = supplierName;
      if (supplierName) metadata.supplierName = supplierName;
    } else if (definition.field === 'signatureStatus') {
      const signatureStatus = normalizeSignatureStatusAnswer(value);
      item.normalizedValue = signatureStatus;
      if (signatureStatus) metadata.signatureStatus = signatureStatus;
    } else if (definition.field === 'signatureDate') {
      const signatureDate = parseIsoDate(value);
      item.normalizedValue = signatureDate;
      if (signatureDate) metadata.signatureDate = signatureDate;
    } else if (definition.field === 'autoRenewal') {
      const autoRenewal = parseBooleanAnswer(value);
      item.normalizedValue = autoRenewal;
      if (autoRenewal != null) metadata.autoRenewal = autoRenewal;
    } else if (definition.field === 'terminationClause') {
      const terminationClause = normalizeEvidenceText(value);
      item.normalizedValue = terminationClause;
      if (terminationClause) metadata.terminationClause = terminationClause;
    } else if (definition.field === 'liabilityCap') {
      const liabilityCap = parseLiabilityCap(value);
      item.normalizedValue = liabilityCap.amount;
      item.currency = liabilityCap.currency;
      if (liabilityCap.amount != null) metadata.liabilityCap = liabilityCap.amount;
      if (liabilityCap.currency) metadata.liabilityCapCurrency = liabilityCap.currency;
    } else if (definition.field === 'keyObligations') {
      const keyObligations = normalizeEvidenceText(value);
      item.normalizedValue = keyObligations;
      if (keyObligations) metadata.keyObligations = keyObligations;
    } else if (definition.field === 'governingLaw') {
      item.normalizedValue = value;
      metadata.jurisdiction = value;
    } else if (definition.field === 'paymentTerms') {
      item.normalizedValue = value;
      metadata.paymentTerms = value;
    } else if (definition.field === 'initialTerm') {
      item.normalizedValue = value;
      metadata.initialTerm = value;
    } else if (definition.field === 'renewalTerms') {
      item.normalizedValue = value;
      metadata.renewalTerms = value;
    } else if (definition.field === 'contractCurrency') {
      const currency = detectCurrency(value)
        || (/^[A-Z]{3}$/.test(value.trim().toUpperCase()) ? value.trim().toUpperCase() : null);
      item.normalizedValue = currency;
      if (currency && !metadata.currency) metadata.currency = currency;
    }

    evidence.push(item);
  }

  // Currency may come from a dedicated query field or from validation fallback.
  const currencyAnswer = answers.contractCurrency ?? answers.currency;
  if (currencyAnswer && !metadata.currency) {
    const detected = detectCurrency(String(currencyAnswer));
    const code = detected
      || (/^[A-Z]{3}$/.test(normalizeWhitespace(String(currencyAnswer)).toUpperCase())
        ? normalizeWhitespace(String(currencyAnswer)).toUpperCase()
        : null);
    if (code) metadata.currency = code;
  }

  if (!metadata.endDate && metadata.startDate) {
    const durationSource = metadata.initialTerm || evidence.find(item => item.field === 'expirationDate')?.value;
    const durationMatch = durationSource?.match(new RegExp(`(?<value>${NUMBER_PATTERN})(?:\\s*\\(\\s*\\d+\\s*\\))?\\s*(?<unit>${UNIT_PATTERN})`, 'i'));
    const durationValue = parseNumberText(durationMatch?.groups?.value);
    const durationUnit = durationMatch?.groups?.unit;
    if (durationValue && durationUnit) {
      const unit = normalizeTermUnit(durationUnit);
      const derivedEndDate = addDurationToIsoDate(metadata.startDate, {
        value: durationValue,
        unit,
        months: durationMonths(durationValue, unit),
        text: `${durationValue} ${unit}${durationValue === 1 ? '' : 's'}`,
        source: durationSource || '',
        confidence: 0.78,
        isRenewal: false,
      });
      if (derivedEndDate) metadata.endDate = derivedEndDate;
    }
  }

  return { evidence, metadata };
}

const STRONG_AGGREGATE_RE = /total\s+contract\s+value|contract\s+value|total\s+value|aggregate\s+(?:amount|fees?|consideration|value)|not\s+to\s+exceed|maximum\s+(?:amount|fees?|value)|total\s+(?:fees?|price|payable|compensation|consideration|amount)|contract\s+amount|purchase\s+price|overall\s+(?:value|amount|fees?)|gesamtvertragswert|vertragswert|auftragswert|höchstbetrag|maximalbetrag|nicht\s+überschreiten|valeur\s+totale|valeur\s+du\s+contrat|plafond|valore\s+complessivo/gi;
const MEDIUM_AGGREGATE_RE = /transaction\s+fee|success[-\s]related\s+transaction\s+fee|service\s+fee|advisory\s+fee|fixed\s+fee|fee\s+shall\s+amount\s+to|shall\s+amount\s+to|amounts?\s+to|budget|consideration|vergütung|honorar/gi;
const INSTALLMENT_RE = /payment\s+schedule|milestone|instal?lment|deposit|advance|invoice|monthly|annual|per\s+(?:month|year|hour|day|unit|tag|stunde)|rate\s+card|unit\s+price|first\s+payment|upon\s+execution|due\s+upon|payment\s+\d+|tagessatz|tagesansatz|stundensatz|honorartabelle|meilenstein|abschlag|taux\s+journalier/gi;
const EXCLUDED_RE = /example|sample|illustrative|liability|insurance|coverage|discount|interest|penalt|shipment|forecast|warranty|tax|vat|gst|late\s+fee|expense\s+cap|reimbursement|haftung|haftungsobergrenze|versicherung|vertragsstrafe|beispiel|responsabilité|responsabilit[aà]/gi;

function nearestLabelBefore(context: string, regex: RegExp, origin: number): number {
  const re = new RegExp(regex.source, 'gi');
  let best = Number.POSITIVE_INFINITY;
  let match: RegExpExecArray | null;
  while ((match = re.exec(context)) !== null) {
    if (match.index <= origin) {
      best = Math.min(best, origin - match.index);
    }
  }
  return best;
}

function scoreMonetaryCandidate(amountText: string, context: string, value: number): MonetaryCandidate {
  const reasons: string[] = [];
  let score = 0;
  let kind: MonetaryCandidate['kind'] = 'unknown';
  const origin = Math.max(0, context.toLowerCase().indexOf(amountText.toLowerCase()));
  const aggregateDist = Math.min(
    nearestLabelBefore(context, STRONG_AGGREGATE_RE, origin),
    nearestLabelBefore(context, MEDIUM_AGGREGATE_RE, origin) + 20,
  );
  const installmentDist = nearestLabelBefore(context, INSTALLMENT_RE, origin);
  const excludedDist = nearestLabelBefore(context, EXCLUDED_RE, origin);
  const hasStrongAggregateLabel = nearestLabelBefore(context, STRONG_AGGREGATE_RE, origin) !== Number.POSITIVE_INFINITY;
  const hasMediumAggregateLabel = nearestLabelBefore(context, MEDIUM_AGGREGATE_RE, origin) !== Number.POSITIVE_INFINITY;
  const hasInstallmentLabel = installmentDist !== Number.POSITIVE_INFINITY;
  const hasExcludedLabel = excludedDist !== Number.POSITIVE_INFINITY;

  if (hasStrongAggregateLabel) {
    score += 120;
    kind = 'aggregate';
    reasons.push('strong aggregate label');
  }
  if (hasMediumAggregateLabel) {
    score += 50;
    if (kind === 'unknown') kind = 'aggregate';
    reasons.push('medium aggregate label');
  }
  if (hasInstallmentLabel) {
    score -= hasStrongAggregateLabel || hasMediumAggregateLabel ? 15 : 85;
    if (!hasStrongAggregateLabel && !hasMediumAggregateLabel) kind = 'installment';
    reasons.push('installment or rate context');
  }
  if (hasExcludedLabel && excludedDist + 8 < aggregateDist) {
    score -= 160;
    kind = 'excluded';
    reasons.push('excluded context');
  } else if (hasExcludedLabel) {
    reasons.push('excluded label farther than aggregate');
  }
  if (kind !== 'excluded' && installmentDist + 8 < aggregateDist && hasInstallmentLabel) {
    kind = 'installment';
  }
  if (/\b(?:USD|EUR|GBP|CHF|SFr\.?)\b|[$€£]|Fr\./i.test(amountText)) {
    score += 10;
    reasons.push('currency marker');
  }
  if (/\b(?:m|mn|mm|million)\b/i.test(amountText)) {
    score += 12;
    reasons.push('large amount suffix');
  }
  if (value >= 1_000_000) score += 12;
  else if (value >= 100_000) score += 8;
  else if (value >= 10_000) score += 4;

  return {
    value,
    currency: detectCurrency(`${amountText} ${context}`),
    amountText: normalizeWhitespace(amountText),
    source: context,
    score,
    kind,
    reasons,
  };
}

export function extractFinancialEvidence(contractText: string): FinancialEvidenceAssessment {
  const candidates: MonetaryCandidate[] = [];
  const validationIssues: string[] = [];

  if (!contractText || contractText.trim().length === 0) {
    return {
      totalValue: null,
      currency: null,
      bestCandidate: null,
      candidates,
      paymentScheduleTotal: null,
      validationIssues,
    };
  }

  for (const match of contractText.matchAll(new RegExp(MONEY_PATTERN.source, 'gi'))) {
    const amountText = match[1];
    if (!amountText) continue;

    const value = parseMonetaryAmount(amountText);
    if (value == null || value <= 0 || value >= 1e12) continue;

    const source = contextAround(contractText, match.index ?? 0, amountText.length, 90);
    candidates.push(scoreMonetaryCandidate(amountText, source, value));
  }

  const sortedCandidates = [...candidates].sort((left, right) => right.score - left.score || right.value - left.value);
  const bestCandidate = sortedCandidates.find(candidate => candidate.kind === 'aggregate' && candidate.score >= 50) ?? null;
  const scheduleCandidates = candidates.filter(candidate => candidate.kind === 'installment' && candidate.score > -120);
  const paymentScheduleTotal = scheduleCandidates.length >= 2
    ? scheduleCandidates.reduce((sum, candidate) => sum + candidate.value, 0)
    : null;

  if (bestCandidate && paymentScheduleTotal && paymentScheduleTotal > bestCandidate.value * 1.2) {
    validationIssues.push('Payment schedule total is materially higher than the extracted aggregate value; review required.');
  }

  return {
    totalValue: bestCandidate?.value ?? null,
    currency: bestCandidate?.currency ?? sortedCandidates.find(candidate => candidate.currency)?.currency ?? null,
    bestCandidate,
    candidates: sortedCandidates.slice(0, 20),
    paymentScheduleTotal,
    validationIssues,
  };
}

export type TcvSource = 'canonical' | 'di_query' | 'heuristic' | 'financial' | 'overview' | 'invoice' | 'none';

/** Human-saved TCV on Contract.aiMetadata.tcvSource — re-analysis must not overwrite. */
export function isHumanTcvLocked(aiMetadata: unknown): boolean {
  if (!aiMetadata || typeof aiMetadata !== 'object' || Array.isArray(aiMetadata)) return false;
  return (aiMetadata as Record<string, unknown>).tcvSource === 'human';
}

export interface TcvWinner {
  value: number | null;
  currency: string | null;
  source: TcvSource;
  quote: string | null;
  label: string;
}

const TCV_SOURCE_LABEL: Record<TcvSource, string> = {
  canonical: 'Saved by you',
  di_query: 'Document Intelligence',
  heuristic: 'Explicit TCV in the text',
  financial: 'Financial analysis',
  overview: 'Overview analysis',
  invoice: 'Invoice total',
  none: 'Not found',
};

function positiveAmount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function almostEqualAmount(a: number, b: number): boolean {
  const abs = Math.abs(a - b);
  if (abs < 0.5) return true;
  return abs / Math.max(a, b) < 0.001;
}

function contextForAmount(text: string | null | undefined, value: number, quote: string | null): string {
  if (text) {
    const heuristic = extractFinancialEvidence(text);
    const match = heuristic.candidates.find((candidate) => almostEqualAmount(candidate.value, value));
    if (match?.source) return match.source;
  }
  return quote || '';
}

function isAcceptableTcvCandidate(
  value: number,
  context: string,
  evidence?: FinancialEvidenceAssessment | null,
): boolean {
  const scored = scoreMonetaryCandidate(String(value), context, value);
  if (scored.kind === 'excluded' || scored.kind === 'installment') return false;
  if (evidence) {
    const collision = evidence.candidates.find(
      (candidate) =>
        almostEqualAmount(candidate.value, value) &&
        (candidate.kind === 'excluded' || candidate.kind === 'installment'),
    );
    const aggregate = evidence.candidates.find(
      (candidate) => almostEqualAmount(candidate.value, value) && candidate.kind === 'aggregate',
    );
    if (collision && !aggregate) return false;
  }
  return true;
}

/**
 * One TCV winner with provenance. Order: DI query → heuristic aggregate → FINANCIAL → OVERVIEW.
 * Invoice totals are used only when the document is classified as an invoice/PO.
 * Canonical (saved) value is not the extraction winner; callers overlay it for display + drift.
 */
export function resolveTcvWinner(input: {
  contractType?: string | null;
  diQueryAnswers?: Record<string, string> | null;
  contractText?: string | null;
  financialTotal?: number | null;
  financialCurrency?: string | null;
  financialQuote?: string | null;
  overviewTotal?: number | null;
  overviewCurrency?: string | null;
  overviewQuote?: string | null;
  invoiceTotal?: number | null;
  invoiceCurrency?: string | null;
}): TcvWinner {
  const type = (input.contractType || '').toUpperCase();
  const isInvoice = type.includes('INVOICE') || type === 'PURCHASE_ORDER' || type === 'RECEIPT';
  const evidence = input.contractText ? extractFinancialEvidence(input.contractText) : null;

  const di = input.diQueryAnswers && Object.keys(input.diQueryAnswers).length > 0
    ? normalizeDIQueryAnswers(input.diQueryAnswers)
    : null;
  const diValue = positiveAmount(di?.metadata.totalValue);
  if (diValue != null) {
    const quote = di?.evidence.find((item) => item.field === 'totalContractValue')?.sourceQuote
      || input.diQueryAnswers?.totalContractValue
      || null;
    const context = contextForAmount(input.contractText, diValue, quote);
    if (isAcceptableTcvCandidate(diValue, context, evidence)) {
      return {
        value: diValue,
        currency: di?.metadata.currency || null,
        source: 'di_query',
        quote,
        label: TCV_SOURCE_LABEL.di_query,
      };
    }
  }

  const heuristicValue = positiveAmount(evidence?.totalValue);
  if (heuristicValue != null) {
    return {
      value: heuristicValue,
      currency: evidence?.currency ?? null,
      source: 'heuristic',
      quote: evidence?.bestCandidate?.source || evidence?.bestCandidate?.amountText || null,
      label: TCV_SOURCE_LABEL.heuristic,
    };
  }

  const financial = positiveAmount(input.financialTotal);
  if (financial != null) {
    const context = contextForAmount(input.contractText, financial, input.financialQuote || null);
    if ((context || input.financialQuote) && isAcceptableTcvCandidate(financial, context, evidence)) {
      return {
        value: financial,
        currency: input.financialCurrency || null,
        source: 'financial',
        quote: input.financialQuote || context || null,
        label: TCV_SOURCE_LABEL.financial,
      };
    }
  }

  const overview = positiveAmount(input.overviewTotal);
  if (overview != null) {
    const context = contextForAmount(input.contractText, overview, input.overviewQuote || null);
    if ((context || input.overviewQuote) && isAcceptableTcvCandidate(overview, context, evidence)) {
      return {
        value: overview,
        currency: input.overviewCurrency || null,
        source: 'overview',
        quote: input.overviewQuote || context || null,
        label: TCV_SOURCE_LABEL.overview,
      };
    }
  }

  if (isInvoice) {
    const invoice = positiveAmount(input.invoiceTotal);
    if (invoice != null) {
      return {
        value: invoice,
        currency: input.invoiceCurrency || null,
        source: 'invoice',
        quote: null,
        label: TCV_SOURCE_LABEL.invoice,
      };
    }
  }

  return { value: null, currency: null, source: 'none', quote: null, label: TCV_SOURCE_LABEL.none };
}

function getObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function dedupeNames(names: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  for (const name of names) {
    const normalized = normalizeLookupName(name || '');
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(normalized);
  }
  return results.slice(0, 10);
}

export function assessPartyEvidence(
  contractText: string,
  options: {
    metadata?: NormalizedContractFieldEvidence['metadata'];
    overviewData?: Record<string, unknown>;
    partiesData?: Record<string, unknown>;
  } = {}
): PartyEvidenceAssessment {
  const reviewIssues: string[] = [];
  const metadata = options.metadata || {};
  const metadataParties = dedupeNames([...(metadata.parties || []), metadata.clientName, metadata.supplierName]);

  if (metadata.clientName || metadata.supplierName || metadataParties.length > 0) {
    return {
      clientName: normalizeLookupName(metadata.clientName) || metadataParties[0] || null,
      supplierName: normalizeLookupName(metadata.supplierName) || metadataParties[1] || null,
      parties: metadataParties,
      source: 'di-field-metadata',
      confidence: metadata.clientName || metadata.supplierName ? 0.86 : 0.78,
      reviewIssues,
    };
  }

  const partyRoles = getObject(options.overviewData?.partyRoles);
  const roleClient = normalizeLookupName(partyRoles?.client);
  const roleSupplier = normalizeLookupName(partyRoles?.supplier || partyRoles?.vendor || partyRoles?.provider);
  if (roleClient || roleSupplier) {
    return {
      clientName: roleClient,
      supplierName: roleSupplier,
      parties: dedupeNames([roleClient, roleSupplier]),
      source: 'artifact:OVERVIEW.partyRoles',
      confidence: 0.78,
      reviewIssues,
    };
  }

  const partyRows = Array.isArray(options.partiesData?.parties) ? options.partiesData?.parties : [];
  let clientName: string | null = null;
  let supplierName: string | null = null;
  const parties: string[] = [];
  for (const row of partyRows) {
    const record = getObject(row);
    if (!record) continue;
    const name = normalizeLookupName(record.name || record.legalName || record.partyName);
    const role = String(record.role || record.type || '').toLowerCase();
    if (!name) continue;
    parties.push(name);
    if (!clientName && /client|buyer|customer|purchaser/.test(role)) clientName = name;
    if (!supplierName && /supplier|vendor|provider|seller|advisory|contractor/.test(role)) supplierName = name;
  }
  if (clientName || supplierName || parties.length > 0) {
    return {
      clientName: clientName || parties[0] || null,
      supplierName: supplierName || parties[1] || null,
      parties: dedupeNames(parties),
      source: 'artifact:PARTIES',
      confidence: clientName || supplierName ? 0.76 : 0.68,
      reviewIssues,
    };
  }

  const labelledClient = contractText.match(/\bClient\s*[:\-]\s*([^\n.;]{2,180})/i)?.[1];
  const labelledSupplier = contractText.match(/\b(?:Supplier|Vendor|Provider|Service\s+Provider|AdvisoryFirm)\s*[:\-]\s*([^\n.;]{2,180})/i)?.[1];
  clientName = normalizeLookupName(labelledClient);
  supplierName = normalizeLookupName(labelledSupplier);
  if (clientName || supplierName) {
    return {
      clientName,
      supplierName,
      parties: dedupeNames([clientName, supplierName]),
      source: 'rawText:role-labels',
      confidence: 0.72,
      reviewIssues,
    };
  }

  const betweenMatch = contractText.match(/between\s+([\s\S]{2,260}?)\s+\(hereinafter referred to as (?:the )?["'](?:Client|Buyer|Customer)["']\)\s+and\s+([\s\S]{2,260}?)\s+\(hereinafter referred to as ["'][^"']+["']\)/i);
  if (betweenMatch) {
    const betweenClient = normalizeLookupName(betweenMatch[1]?.split('\n')[0]);
    const betweenSupplier = normalizeLookupName(betweenMatch[2]?.split('\n')[0]);
    return {
      clientName: betweenClient,
      supplierName: betweenSupplier,
      parties: dedupeNames([betweenClient, betweenSupplier]),
      source: 'rawText:between-clause',
      confidence: 0.74,
      reviewIssues,
    };
  }

  return { clientName: null, supplierName: null, parties: [], source: null, confidence: 0, reviewIssues };
}

export function assessCriticalContractEvidence(
  contractText: string,
  options: {
    effectiveDate?: string | null;
    queryAnswers?: Record<string, string>;
    metadata?: NormalizedContractFieldEvidence['metadata'];
    overviewData?: Record<string, unknown>;
    partiesData?: Record<string, unknown>;
  } = {}
): CriticalContractEvidenceAssessment {
  const normalized = options.queryAnswers
    ? normalizeDIQueryAnswers(options.queryAnswers, { confidence: 0.82, source: 'azure-di-query' })
    : { evidence: [] as ContractFieldEvidence[], metadata: {} as NormalizedContractFieldEvidence['metadata'] };
  const metadata: NormalizedContractFieldEvidence['metadata'] = {
    ...(options.metadata || {}),
    ...normalized.metadata,
  };
  const evidence = [...normalized.evidence];
  const effectiveDate = options.effectiveDate || metadata.startDate;
  const financial = extractFinancialEvidence(contractText);
  const term = assessContractTermEvidence(contractText, { effectiveDate });
  const parties = assessPartyEvidence(contractText, { metadata, overviewData: options.overviewData, partiesData: options.partiesData });
  const signatureEvidence = assessSignatureEvidence(contractText);
  const signatureStatus = signatureEvidence.hasActualSignatureEvidence
    ? 'signed'
    : signatureEvidence.hasSignatureBlock || signatureEvidence.hasBlankSignatureMarkers
      ? 'unsigned'
      : metadata.signatureStatus || null;
  const signatureDate = signatureEvidence.signatureDateText
    ? parseIsoDate(signatureEvidence.signatureDateText)
    : metadata.signatureDate || null;

  const pushParserEvidence = (
    field: ContractEvidenceField,
    value: string,
    normalizedValue?: ContractFieldEvidence['normalizedValue'],
    currency?: string | null,
    confidence = 0.88
  ) => {
    evidence.push({
      field,
      value,
      normalizedValue,
      currency,
      source: 'parser',
      confidence,
      sourceQuote: value,
    });
  };

  if (financial.totalValue != null && (metadata.totalValue == null || metadata.totalValue < financial.totalValue * 0.5)) {
    metadata.totalValue = financial.totalValue;
    if (financial.currency) metadata.currency = financial.currency;
    if (financial.bestCandidate?.source) {
      pushParserEvidence('totalContractValue', financial.bestCandidate.source, financial.totalValue, financial.currency, 0.9);
    }
  }

  if (term.derivedEndDate) {
    metadata.endDate = term.derivedEndDate;
    pushParserEvidence('expirationDate', term.sourceQuote || term.derivedEndDate, term.derivedEndDate, null, term.confidence);
  }
  if (term.initialTerm?.text) metadata.initialTerm = term.initialTerm.text;
  if (term.renewalTerm?.text) metadata.renewalTerms = term.renewalTerm.text;
  if (term.noticePeriodDays != null) metadata.noticePeriodDays = term.noticePeriodDays;
  if (term.autoRenewal) metadata.autoRenewal = true;

  if (parties.clientName) metadata.clientName = parties.clientName;
  if (parties.supplierName) metadata.supplierName = parties.supplierName;
  if (parties.parties.length > 0) metadata.parties = parties.parties;
  if (parties.source && (parties.clientName || parties.supplierName)) {
    pushParserEvidence('contractingParties', [parties.clientName, parties.supplierName].filter(Boolean).join(' and '), parties.parties, null, parties.confidence);
  }

  if (signatureStatus) {
    metadata.signatureStatus = signatureStatus;
    pushParserEvidence('signatureStatus', signatureStatus, signatureStatus, null, signatureEvidence.hasActualSignatureEvidence ? 0.92 : 0.78);
  }
  if (signatureDate) metadata.signatureDate = signatureDate;

  return {
    evidence,
    metadata,
    financial,
    term,
    parties,
    signature: {
      status: signatureStatus,
      date: signatureDate,
      source: signatureEvidence.hasActualSignatureEvidence ? 'signature-evidence' : signatureEvidence.hasSignatureBlock ? 'signature-block' : metadata.signatureStatus ? 'field-metadata' : null,
      confidence: signatureEvidence.hasActualSignatureEvidence ? 0.92 : signatureEvidence.hasSignatureBlock ? 0.78 : metadata.signatureStatus ? 0.7 : 0,
    },
  };
}