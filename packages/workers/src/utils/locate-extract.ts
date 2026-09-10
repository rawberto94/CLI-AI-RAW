/**
 * Deterministic locate-then-extract for critical fields.
 * Finds candidate quotes/pages before the LLM sees the whole pack.
 */

export interface LocatedCandidate {
  field: 'effectiveDate' | 'tcv' | 'termination' | 'party';
  quote: string;
  page: number;
}

const DATE_HINT =
  /effective date|entered into as of|commencement date|inkrafttreten|prend effet|decorrenza|signature date|unterzeichnet/i;
const TCV_HINT =
  /total contract value|not to exceed|gesamtvertragswert|valeur totale|valore complessivo/i;
const TERM_HINT =
  /terminat|kündigung|kündigen|résiliation|risoluzione|notice period|kündigungsfrist|préavis/i;
const PARTY_HINT =
  /between|zwischen|entre|tra\b|gmbh|s\.à r\.l|sàrl|'provider'|'client'|vertragspartei/i;

function pageOf(packed: string, index: number): number {
  const before = packed.slice(0, index);
  const matches = [...before.matchAll(/\[PAGE\s+(\d+)\]/gi)];
  const last = matches[matches.length - 1];
  return last ? Number(last[1]) || 1 : 1;
}

const DEFINITION_HEADING_RE = /\b(definitions?|definitionen|définitions|definizioni)\b/i;
const DEFINITION_MEANS_RE = /\b(means|shall mean|bedeutet|désigne|si intende)\b/i;

function isDefinitionContext(text: string, index: number): boolean {
  const headingWindow = text.slice(Math.max(0, index - 400), Math.min(text.length, index + 80));
  const meansWindow = text.slice(Math.max(0, index - 80), Math.min(text.length, index + 80));
  return DEFINITION_HEADING_RE.test(headingWindow) && DEFINITION_MEANS_RE.test(meansWindow);
}

function collect(
  packed: string,
  re: RegExp,
  field: LocatedCandidate['field'],
  limit: number,
  skipDefinitions = false,
): LocatedCandidate[] {
  const out: LocatedCandidate[] = [];
  const clone = new RegExp(re.source, 'gi');
  let match: RegExpExecArray | null;
  while ((match = clone.exec(packed)) !== null && out.length < limit) {
    if (skipDefinitions && isDefinitionContext(packed, match.index)) continue;
    const start = Math.max(0, match.index - 80);
    const end = Math.min(packed.length, match.index + match[0].length + 160);
    out.push({
      field,
      quote: packed.slice(start, end).replace(/\s+/g, ' ').trim(),
      page: pageOf(packed, match.index),
    });
  }
  return out;
}

export function locateCriticalCandidates(packedText: string): LocatedCandidate[] {
  return [
    ...collect(packedText, DATE_HINT, 'effectiveDate', 6),
    ...collect(packedText, TCV_HINT, 'tcv', 6),
    ...collect(packedText, TERM_HINT, 'termination', 6, true),
    ...collect(packedText, PARTY_HINT, 'party', 8),
  ];
}

export function formatLocatedCandidates(candidates: LocatedCandidate[]): string {
  if (candidates.length === 0) return '';
  const lines = candidates.map(
    (c) => `- ${c.field} [PAGE ${c.page}]: "${c.quote.slice(0, 220)}"`,
  );
  return `CANDIDATE SLICES (prefer these over the rest of the document for dates, TCV, parties, termination):\n${lines.join('\n')}`;
}
