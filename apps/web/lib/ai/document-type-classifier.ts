/**
 * Unified document-type classifier.
 *
 * Tiered, AI-optional pipeline that combines:
 *   - Tier A: filename heuristic (high precision, low coverage)
 *   - Tier B: keyword scoring via @repo/workers/contract-type-profiles (no AI)
 *   - Tier C: Azure OpenAI / OpenAI confirmation (only when configured)
 *
 * The function ALWAYS returns a result (`OTHER` if nothing matches), so callers
 * can persist `contractType`, `classificationConf`, `classifiedAt`,
 * `classificationMeta` deterministically — even in environments without AI keys.
 */

import pino from 'pino';
import { hasAIClientConfig, createOpenAIClient, getOpenAIApiKey } from '@/lib/openai-client';

const logger = pino({ name: 'document-type-classifier' });

export type DocumentTypeSource =
  | 'filename'
  | 'keyword'
  | 'ai'
  | 'merged'
  | 'unknown';

export interface DocumentTypeCandidate {
  type: string;
  confidence: number;
  source: DocumentTypeSource;
  matchedKeywords?: string[];
}

export interface DocumentTypeResult {
  /** Best-guess canonical contract type (uppercase, e.g. SOW, NDA, MSA, OTHER). */
  type: string;
  /** 0..1 confidence of `type`. */
  confidence: number;
  /** Which tier produced the final answer. */
  source: DocumentTypeSource;
  /** Human-readable explanation (best-effort). */
  reasoning: string;
  /** Keywords that contributed to the chosen type, if any. */
  matchedKeywords: string[];
  /** Top alternative candidates (max 3). */
  candidates: DocumentTypeCandidate[];
  /** ISO timestamp of when classification ran. */
  classifiedAt: string;
  /** Tiers that were actually executed. */
  tiersRun: DocumentTypeSource[];
}

// ---------------------------------------------------------------------------
// Tier A — filename heuristic
// ---------------------------------------------------------------------------

const FILENAME_PATTERNS: Array<[RegExp, string]> = [
  [/(?:^|[\W_])(sow|statement[\W_]*of[\W_]*work)(?:[\W_]|$)/i, 'SOW'],
  [/(?:^|[\W_])(msa|master[\W_]*service[\W_]*agreement|master[\W_]*services[\W_]*agreement)(?:[\W_]|$)/i, 'MSA'],
  [/(?:^|[\W_])(nda|non[\W_]*disclosure|nondisclosure|confidentiality)(?:[\W_]|$)/i, 'NDA'],
  [/(?:^|[\W_])(dpa|data[\W_]*processing[\W_]*agreement)(?:[\W_]|$)/i, 'DATA_PROCESSING_AGREEMENT'],
  [/(?:^|[\W_])(sla|service[\W_]*level[\W_]*agreement)(?:[\W_]|$)/i, 'SLA'],
  [/(?:^|[\W_])(eula|end[\W_]*user[\W_]*license)(?:[\W_]|$)/i, 'LICENSE'],
  [/(?:^|[\W_])(employment|offer[\W_]*letter|hiring)(?:[\W_]|$)/i, 'EMPLOYMENT'],
  [/(?:^|[\W_])(lease|tenancy|rental)(?:[\W_]|$)/i, 'LEASE'],
  [/(?:^|[\W_])(license|licence|licensing)(?:[\W_]|$)/i, 'LICENSE'],
  [/(?:^|[\W_])(consulting|consultant)(?:[\W_]|$)/i, 'CONSULTING'],
  [/(?:^|[\W_])(subscription)(?:[\W_]|$)/i, 'SUBSCRIPTION'],
  [/(?:^|[\W_])(partnership)(?:[\W_]|$)/i, 'PARTNERSHIP'],
  [/(?:^|[\W_])(distribution|distributor)(?:[\W_]|$)/i, 'DISTRIBUTION'],
  [/(?:^|[\W_])(reseller)(?:[\W_]|$)/i, 'RESELLER'],
  [/(?:^|[\W_])(franchise)(?:[\W_]|$)/i, 'FRANCHISE'],
  [/(?:^|[\W_])(amendment)(?:[\W_]|$)/i, 'AMENDMENT'],
  [/(?:^|[\W_])(addendum)(?:[\W_]|$)/i, 'ADDENDUM'],
  [/(?:^|[\W_])(po|purchase[\W_]*order)(?:[\W_]|$)/i, 'PURCHASE_ORDER'],
  [/(?:^|[\W_])(invoice)(?:[\W_]|$)/i, 'INVOICE'],
  [/(?:^|[\W_])(quote|quotation)(?:[\W_]|$)/i, 'QUOTE'],
  [/(?:^|[\W_])(supply|supplier)(?:[\W_]|$)/i, 'SUPPLY'],
  [/(?:^|[\W_])(loan|credit[\W_]*agreement)(?:[\W_]|$)/i, 'LOAN'],
  [/(?:^|[\W_])(mou|memorandum[\W_]*of[\W_]*understanding)(?:[\W_]|$)/i, 'MEMORANDUM_OF_UNDERSTANDING'],
  [/(?:^|[\W_])(loi|letter[\W_]*of[\W_]*intent)(?:[\W_]|$)/i, 'LETTER_OF_INTENT'],
];

function classifyByFilename(filename: string | undefined | null): DocumentTypeCandidate | null {
  if (!filename) return null;
  for (const [pattern, type] of FILENAME_PATTERNS) {
    const match = filename.match(pattern);
    if (match) {
      return {
        type,
        // Filename hints alone are noisy; cap confidence at 0.45 so a real
        // keyword/AI match always wins.
        confidence: 0.45,
        source: 'filename',
        matchedKeywords: [match[1].toLowerCase()],
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tier B — keyword scoring (reuses the worker library)
// ---------------------------------------------------------------------------

async function classifyByKeywords(text: string): Promise<DocumentTypeCandidate | null> {
  if (!text || text.trim().length < 30) return null;
  try {
    const { detectContractTypeKeywords } = await import('@repo/workers/contract-type-profiles');
    const result = detectContractTypeKeywords(text);
    if (!result || result.type === 'OTHER') return null;
    return {
      type: result.type,
      confidence: Math.max(0, Math.min(1, result.confidence)),
      source: 'keyword',
      matchedKeywords: result.matchedKeywords?.slice(0, 10) ?? [],
    };
  } catch (err) {
    logger.warn({ err }, 'Keyword-based contract type detection failed');
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tier C — AI confirmation (only when an OpenAI / Azure OpenAI key is configured)
// ---------------------------------------------------------------------------

const AI_TYPE_LIST = [
  'NDA', 'MSA', 'SOW', 'SLA', 'EMPLOYMENT', 'LEASE', 'LICENSE', 'PURCHASE',
  'PARTNERSHIP', 'CONSULTING', 'SUBSCRIPTION', 'LOAN', 'SETTLEMENT', 'FRANCHISE',
  'DISTRIBUTION', 'AGENCY', 'JOINT_VENTURE', 'MAINTENANCE', 'WARRANTY', 'INSURANCE',
  'AMENDMENT', 'ADDENDUM', 'MEMORANDUM_OF_UNDERSTANDING', 'LETTER_OF_INTENT',
  'SUPPLY', 'MANUFACTURING', 'RESELLER', 'SERVICES', 'CONSTRUCTION',
  'REAL_ESTATE', 'PURCHASE_ORDER', 'INVOICE', 'QUOTE', 'PROPOSAL',
  'DATA_PROCESSING_AGREEMENT', 'TERMS_OF_SERVICE', 'PRIVACY_POLICY',
  'WORK_ORDER', 'CHANGE_ORDER', 'OFFER_LETTER', 'SEPARATION_AGREEMENT',
  'NON_COMPETE', 'NON_SOLICITATION', 'INDEPENDENT_CONTRACTOR', 'OTHER',
] as const;

async function classifyByAI(
  text: string,
  hint: DocumentTypeCandidate | null,
): Promise<DocumentTypeCandidate | null> {
  if (!hasAIClientConfig()) return null;
  if (!text || text.trim().length < 30) return null;

  let apiKey: string;
  try {
    apiKey = getOpenAIApiKey();
  } catch {
    return null;
  }

  try {
    const openai = createOpenAIClient(apiKey);
    const sample = text.slice(0, 4000);
    const titleSection = text.slice(0, 600);
    const hintLine = hint
      ? `Heuristic guess: ${hint.type} (confidence ${hint.confidence.toFixed(2)}, source ${hint.source}).`
      : 'No heuristic guess available.';

    const response = await openai.chat.completions.create(
      {
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a contract classifier. Return strict JSON only. Use one of the allowed types. Do not invent new types.',
          },
          {
            role: 'user',
            content: `Allowed types: ${AI_TYPE_LIST.join(', ')}.

${hintLine}

TITLE/HEADER:
"""
${titleSection}
"""

EXCERPT (first 4000 chars):
"""
${sample}
"""

Return JSON: { "type": "<one of allowed>", "confidence": 0..1, "reasoning": "<one short sentence>" }.
Use OTHER only when no allowed type fits.`,
          },
        ],
      },
      { signal: AbortSignal.timeout(20_000) },
    );

    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as {
      type?: string;
      confidence?: number;
      reasoning?: string;
    };
    if (!parsed.type) return null;
    const type = AI_TYPE_LIST.includes(parsed.type as (typeof AI_TYPE_LIST)[number])
      ? parsed.type
      : 'OTHER';
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0.6));
    return {
      type,
      confidence,
      source: 'ai',
      matchedKeywords: parsed.reasoning ? [parsed.reasoning.slice(0, 200)] : [],
    };
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : err }, 'AI contract type confirmation failed');
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface ClassifyDocumentTypeOptions {
  /** Skip AI tier even if a key is configured (e.g. when caller already invoked AI). */
  skipAI?: boolean;
  /** Accept a previously-detected type to bias merging (e.g. from upload-time keyword pass). */
  priorType?: string | null;
  priorConfidence?: number | null;
}

export async function classifyDocumentType(
  rawText: string | undefined | null,
  filename: string | undefined | null,
  options: ClassifyDocumentTypeOptions = {},
): Promise<DocumentTypeResult> {
  const tiersRun: DocumentTypeSource[] = [];
  const candidates: DocumentTypeCandidate[] = [];

  // Tier A — filename
  const filenameCandidate = classifyByFilename(filename);
  if (filenameCandidate) {
    tiersRun.push('filename');
    candidates.push(filenameCandidate);
  }

  // Tier B — keyword scoring
  const text = (rawText || '').trim();
  const keywordCandidate = text.length >= 30 ? await classifyByKeywords(text) : null;
  if (keywordCandidate) {
    tiersRun.push('keyword');
    candidates.push(keywordCandidate);
  }

  // Choose best-of-A/B for the AI hint
  const heuristic = pickBest(candidates);

  // Tier C — AI (optional)
  let aiCandidate: DocumentTypeCandidate | null = null;
  if (!options.skipAI && text.length >= 30) {
    aiCandidate = await classifyByAI(text, heuristic);
    if (aiCandidate) {
      tiersRun.push('ai');
      candidates.push(aiCandidate);
    }
  }

  // Optionally factor in caller-provided prior (e.g. existing contract.contractType)
  if (options.priorType && options.priorType.length > 0) {
    candidates.push({
      type: options.priorType.toUpperCase(),
      confidence: Math.max(0, Math.min(1, options.priorConfidence ?? 0.3)),
      source: 'merged',
    });
  }

  if (candidates.length === 0) {
    return {
      type: 'OTHER',
      confidence: 0,
      source: 'unknown',
      reasoning: 'No signal from filename, keywords, or AI.',
      matchedKeywords: [],
      candidates: [],
      classifiedAt: new Date().toISOString(),
      tiersRun,
    };
  }

  // Merge: AI is authoritative if confidence >= 0.6, otherwise prefer
  // the highest scoring candidate. Filename-only ties go to keyword.
  const sorted = [...candidates].sort((a, b) => {
    const aw = sourceWeight(a.source) + a.confidence;
    const bw = sourceWeight(b.source) + b.confidence;
    return bw - aw;
  });
  const winner = sorted[0]!;
  const reasoning = buildReasoning(winner, sorted, tiersRun);

  return {
    type: winner.type,
    confidence: winner.confidence,
    source: winner.source,
    reasoning,
    matchedKeywords: winner.matchedKeywords ?? [],
    candidates: sorted.slice(0, 3),
    classifiedAt: new Date().toISOString(),
    tiersRun,
  };
}

function pickBest(list: DocumentTypeCandidate[]): DocumentTypeCandidate | null {
  if (list.length === 0) return null;
  return [...list].sort(
    (a, b) => sourceWeight(b.source) + b.confidence - (sourceWeight(a.source) + a.confidence),
  )[0]!;
}

function sourceWeight(source: DocumentTypeSource): number {
  switch (source) {
    case 'ai':
      return 0.4;
    case 'keyword':
      return 0.2;
    case 'filename':
      return 0.0;
    case 'merged':
      return 0.05;
    default:
      return 0;
  }
}

function buildReasoning(
  winner: DocumentTypeCandidate,
  sorted: DocumentTypeCandidate[],
  tiersRun: DocumentTypeSource[],
): string {
  const parts = [
    `Chose ${winner.type} via ${winner.source} (${(winner.confidence * 100).toFixed(0)}%).`,
  ];
  const losers = sorted.filter((c) => c !== winner).slice(0, 2);
  if (losers.length > 0) {
    parts.push(
      `Other tiers: ${losers
        .map((l) => `${l.source}=${l.type} (${(l.confidence * 100).toFixed(0)}%)`)
        .join(', ')}.`,
    );
  }
  parts.push(`Tiers run: ${tiersRun.length > 0 ? tiersRun.join(', ') : 'none'}.`);
  return parts.join(' ');
}
