/**
 * Shared citation types + normalization for agent evidence / RAG sources.
 *
 * Writers (agent-write-gateway, orchestrator, RAG chat) have historically stored
 * heterogeneous JSON shapes. Consumers should go through `normalizeCitations`.
 */

export interface CitationSource {
  contractId?: string;
  contractName?: string;
  score?: number;
  snippet?: string;
  text?: string;
  heading?: string;
  section?: string;
  page?: number;
  startOffset?: number;
  endOffset?: number;
  /** Free-form source label when no contract id is present */
  source?: string;
  matchType?: string;
  confidence?: number;
}

/** Canonical citation used by CitationList and deep-link builders */
export interface Citation {
  index: number;
  contractId?: string;
  contractName: string;
  score: number;
  snippet?: string;
  heading?: string;
  section?: string;
  page?: number;
  startOffset?: number;
  endOffset?: number;
  source?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return undefined;
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value;
  return undefined;
}

/**
 * Normalize arbitrary citation / evidence JSON into Citation[].
 * Accepts RAGSource-like objects, audit Citation shape, nested { source }, etc.
 */
export function normalizeCitations(raw: unknown, fallbackContractId?: string | null): Citation[] {
  if (!raw) return [];

  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.citations)) list = obj.citations;
    else if (Array.isArray(obj.sources)) list = obj.sources;
    else if (Array.isArray(obj.evidenceChain)) list = obj.evidenceChain;
    else list = [raw];
  } else {
    return [];
  }

  return list
    .map((item, i): Citation | null => {
      if (typeof item === 'string') {
        return {
          index: i + 1,
          contractId: fallbackContractId ?? undefined,
          contractName: 'Source',
          score: 0,
          snippet: item,
        };
      }

      const rec = asRecord(item);
      if (!rec) return null;

      // Nested source (RAG message shape: { source: RAGSource, index })
      const nested = asRecord(rec.source);
      const src = nested ?? rec;

      const contractId =
        asString(src.contractId) ||
        asString(src.contract_id) ||
        asString(rec.contractId) ||
        fallbackContractId ||
        undefined;

      const contractName =
        asString(src.contractName) ||
        asString(src.contract_name) ||
        asString(src.title) ||
        asString(src.source) ||
        asString(rec.source) ||
        (typeof rec.source === 'string' ? rec.source : undefined) ||
        (contractId ? `Contract ${contractId.slice(0, 8)}…` : 'Source');

      const score =
        asNumber(src.score) ??
        asNumber(src.confidence) ??
        asNumber(src.relevance) ??
        asNumber(rec.score) ??
        asNumber(rec.confidence) ??
        asNumber(rec.weight) ??
        0;

      const snippet =
        asString(src.snippet) ||
        asString(src.text) ||
        asString(src.content) ||
        asString(src.quote) ||
        asString(rec.snippet) ||
        asString(rec.text) ||
        asString(rec.content);

      const heading = asString(src.heading) || asString(rec.heading);
      const section = asString(src.section) || asString(rec.section) || asString(src.page?.toString?.());
      const page = asNumber(src.page) ?? asNumber(rec.page);
      const startOffset = asNumber(src.startOffset) ?? asNumber(src.start_offset) ?? asNumber(rec.startOffset);
      const endOffset = asNumber(src.endOffset) ?? asNumber(src.end_offset) ?? asNumber(rec.endOffset);
      const sourceLabel = asString(src.source) || (typeof rec.source === 'string' ? rec.source : undefined);

      return {
        index: asNumber(rec.index) ?? i + 1,
        contractId,
        contractName,
        score: score > 1 ? score / 100 : score, // allow 0-100 or 0-1
        snippet,
        heading,
        section,
        page,
        startOffset,
        endOffset,
        source: sourceLabel,
      };
    })
    .filter((c): c is Citation => c !== null);
}

export interface BuildCitationHrefOptions {
  /** Current pathname (to preserve query params when already on contract page) */
  pathname?: string | null;
  /** Current search params string or URLSearchParams */
  searchParams?: string | URLSearchParams | null;
}

function foldCitationChar(ch: string): string {
  if (ch === '\u2018' || ch === '\u2019' || ch === '`') return "'";
  if (ch === '\u201C' || ch === '\u201D') return '"';
  if (ch === '\u2013' || ch === '\u2014') return '-';
  if (ch === '\u00A0') return ' ';
  return ch;
}

/** Fold quotes, OCR hyphenation, and whitespace so LLM excerpts still match. */
export function buildCitationIndex(source: string): { text: string; map: number[] } {
  let text = '';
  const map: number[] = [];
  for (let i = 0; i < source.length; i++) {
    const raw = source[i]!;
    if (raw === '\u00AD') continue;
    if (raw === '-' && i + 1 < source.length && /\s/.test(source[i + 1]!)) {
      while (i + 1 < source.length && /\s/.test(source[i + 1]!)) i += 1;
      continue;
    }
    let ch = foldCitationChar(raw);
    if (/\s/.test(ch)) {
      if (text.endsWith(' ')) continue;
      ch = ' ';
    }
    map.push(i);
    text += ch;
  }
  return { text, map };
}

/**
 * Find a quoted snippet inside OCR/raw text even when whitespace, quotes, or casing differ.
 */
export function locateSnippetInText(
  sourceText: string,
  snippet: string | null | undefined,
): { start: number; end: number } | null {
  if (!sourceText || !snippet) return null;
  const needle = snippet.replace(/\u2026|\.{3}/g, ' ').trim();
  if (needle.length < 8) return null;

  const exact = sourceText.indexOf(needle);
  if (exact >= 0) return { start: exact, end: exact + needle.length };

  const indexed = buildCitationIndex(sourceText);
  const foldedNeedle = buildCitationIndex(needle).text.toLowerCase();
  if (!foldedNeedle) return null;
  const haystack = indexed.text.toLowerCase();

  let foldedIndex = haystack.indexOf(foldedNeedle);
  if (foldedIndex < 0 && foldedNeedle.length > 24) {
    foldedIndex = haystack.indexOf(foldedNeedle.slice(0, 48));
  }
  if (foldedIndex < 0) {
    const tokens = foldedNeedle.split(' ').filter((token) => token.length > 2).slice(0, 8);
    if (tokens.length >= 4) {
      foldedIndex = haystack.indexOf(tokens.join(' '));
    }
  }
  if (foldedIndex < 0) return null;

  const start = indexed.map[foldedIndex] ?? 0;
  const endIndex = Math.min(indexed.map.length - 1, foldedIndex + Math.max(foldedNeedle.length - 1, 0));
  const end = (indexed.map[endIndex] ?? sourceText.length - 1) + 1;
  return { start, end: Math.max(end, start + 1) };
}

/** Prefer live snippet match when stored offsets no longer contain the quote. */
export function resolveCitationSpan(
  sourceText: string,
  opts: { startOffset?: number; endOffset?: number; snippet?: string | null },
): { start: number; end: number; strategy: 'offset' | 'snippet' } | null {
  const snippet = opts.snippet?.trim();
  if (
    typeof opts.startOffset === 'number' &&
    typeof opts.endOffset === 'number' &&
    opts.endOffset > opts.startOffset &&
    opts.startOffset >= 0 &&
    opts.startOffset < sourceText.length
  ) {
    const slice = sourceText.slice(opts.startOffset, Math.min(opts.endOffset, sourceText.length));
    const stillMatches = !snippet || locateSnippetInText(slice, snippet) != null || slice.toLowerCase().includes(snippet.slice(0, 24).toLowerCase());
    if (stillMatches) {
      return { start: opts.startOffset, end: Math.min(opts.endOffset, sourceText.length), strategy: 'offset' };
    }
  }
  if (snippet) {
    const located = locateSnippetInText(sourceText, snippet);
    if (located) return { ...located, strategy: 'snippet' };
  }
  return null;
}

export function buildCitationHref(
  citation: Pick<
    Citation,
    'contractId' | 'index' | 'heading' | 'section' | 'startOffset' | 'endOffset' | 'snippet' | 'page'
  >,
  options: BuildCitationHrefOptions = {},
): string | null {
  if (!citation.contractId) return null;

  const isCurrentContractPage = options.pathname === `/contracts/${citation.contractId}`;
  const existing =
    typeof options.searchParams === 'string'
      ? options.searchParams
      : options.searchParams instanceof URLSearchParams
        ? options.searchParams.toString()
        : '';
  const next = new URLSearchParams(isCurrentContractPage ? existing : '');

  if (!isCurrentContractPage || !next.get('tab')) {
    next.set('tab', 'details');
  }
  next.set('cite', '1');
  next.set('pdf', '1');
  next.set('citeIndex', String(citation.index));

  if (citation.heading) next.set('citeHeading', citation.heading);
  else next.delete('citeHeading');

  if (citation.section) next.set('citeSection', citation.section);
  else next.delete('citeSection');

  if (typeof citation.startOffset === 'number') next.set('citeStart', String(citation.startOffset));
  else next.delete('citeStart');

  if (typeof citation.endOffset === 'number') next.set('citeEnd', String(citation.endOffset));
  else next.delete('citeEnd');

  if (citation.snippet) next.set('citeSnippet', citation.snippet.slice(0, 320));
  else next.delete('citeSnippet');

  if (typeof citation.page === 'number' && citation.page > 0) next.set('citePage', String(citation.page));
  else next.delete('citePage');

  return `/contracts/${citation.contractId}?${next.toString()}`;
}

/** Format a field value for before/after display */
export function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value || '—';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
