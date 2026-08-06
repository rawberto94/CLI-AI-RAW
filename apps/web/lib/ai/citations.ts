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

/**
 * Build deep-link to contract details with citation highlight query params.
 * Matches FloatingAIBubble link convention.
 */
export function buildCitationHref(
  citation: Pick<
    Citation,
    'contractId' | 'index' | 'heading' | 'section' | 'startOffset' | 'endOffset' | 'snippet'
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

  next.set('tab', 'details');
  next.set('cite', '1');
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
