/**
 * Field-relevant evidence packing for schema metadata extraction.
 * Prefer locate-style windows over prefix truncation so schedules,
 * later clauses, and signatures remain visible on long contracts.
 */

import { LEGAL_QUERY_SYNONYMS } from './analysis-language';

export type EvidenceFieldHint = {
  name?: string;
  label?: string;
  hint?: string;
  type?: string;
};

export type ExtractionEvidence = {
  text: string;
  coverage: {
    totalChars: number;
    usedChars: number;
    omitted: boolean;
    windowCount: number;
    notes: string[];
  };
};

const DEFAULT_MAX_CHARS = 14_000;
const HEAD_CHARS = 2_400;
const TAIL_CHARS = 2_400;
const WINDOW_BEFORE = 420;
const WINDOW_AFTER = 780;
const MAX_HITS_PER_TERM = 3;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function termsForField(field: EvidenceFieldHint): string[] {
  const raw = [field.name, field.label, field.hint]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 1)
    .flatMap((v) => v.split(/[_\s,/]+/))
    .map((v) => v.trim())
    .filter((v) => v.length >= 3 && !/^(the|and|for|from|with|type|field|value)$/i.test(v));
  return [...new Set(raw)].slice(0, 8);
}

function mergeRanges(ranges: Array<{ start: number; end: number }>): Array<{ start: number; end: number }> {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const out: Array<{ start: number; end: number }> = [{ ...sorted[0]! }];
  for (const range of sorted.slice(1)) {
    const last = out[out.length - 1]!;
    if (range.start <= last.end + 80) {
      last.end = Math.max(last.end, range.end);
    } else {
      out.push({ ...range });
    }
  }
  return out;
}

/** Pack field-relevant slices plus document head/tail. Exposes omitted coverage. */
export function selectFieldEvidence(
  documentText: string,
  fields: EvidenceFieldHint[],
  options?: { maxChars?: number },
): ExtractionEvidence {
  const text = documentText || '';
  const maxChars = options?.maxChars ?? DEFAULT_MAX_CHARS;
  const totalChars = text.length;
  const notes: string[] = [];

  if (totalChars === 0) {
    return { text: '', coverage: { totalChars: 0, usedChars: 0, omitted: false, windowCount: 0, notes: ['empty document'] } };
  }
  if (totalChars <= maxChars) {
    return {
      text,
      coverage: { totalChars, usedChars: totalChars, omitted: false, windowCount: 1, notes: [] },
    };
  }

  const ranges: Array<{ start: number; end: number }> = [
    { start: 0, end: Math.min(HEAD_CHARS, totalChars) },
    { start: Math.max(0, totalChars - TAIL_CHARS), end: totalChars },
  ];

  const synonymTerms = LEGAL_QUERY_SYNONYMS.flatMap((group) => group.terms).filter((term) => term.length >= 4);
  const terms = [...new Set([...fields.flatMap(termsForField), ...synonymTerms])].slice(0, 80);
  for (const term of terms) {
    const re = new RegExp(escapeRegExp(term), 'gi');
    let match: RegExpExecArray | null;
    let hits = 0;
    while ((match = re.exec(text)) !== null && hits < MAX_HITS_PER_TERM) {
      ranges.push({
        start: Math.max(0, match.index - WINDOW_BEFORE),
        end: Math.min(totalChars, match.index + match[0].length + WINDOW_AFTER),
      });
      hits += 1;
    }
  }

  const merged = mergeRanges(ranges);
  const parts: string[] = [];
  let used = 0;
  for (const range of merged) {
    if (used >= maxChars) break;
    const slice = text.slice(range.start, range.end);
    const remaining = maxChars - used;
    const piece = slice.length > remaining ? slice.slice(0, remaining) : slice;
    parts.push(piece);
    used += piece.length;
  }

  const omitted = used < totalChars;
  if (omitted) {
    notes.push(`Packed ${used} of ${totalChars} characters from ${merged.length} evidence windows (head, tail, field hits).`);
  }

  return {
    text: parts.join('\n\n---\n\n'),
    coverage: {
      totalChars,
      usedChars: used,
      omitted,
      windowCount: merged.length,
      notes,
    },
  };
}
