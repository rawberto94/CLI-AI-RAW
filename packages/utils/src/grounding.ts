/** Quote must be findable in OCR text or the extraction is ungrounded. */

export function normalizeForQuoteMatch(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .trim()
    .toLowerCase();
}

export function quoteGrounded(
  quote: string | null | undefined,
  ocrText: string | null | undefined,
): { ok: boolean; score: number } {
  const q = (quote || '').trim();
  const text = ocrText || '';
  if (!q || q.length < 8 || !text) return { ok: false, score: 0 };
  if (text.includes(q)) return { ok: true, score: 1 };
  const nq = normalizeForQuoteMatch(q);
  const nt = normalizeForQuoteMatch(text);
  if (nq.length >= 8 && nt.includes(nq)) return { ok: true, score: 0.95 };
  const window = Math.min(nq.length, 48);
  if (window >= 16) {
    const slice = nq.slice(0, window);
    if (nt.includes(slice)) return { ok: true, score: 0.7 };
  }
  return { ok: false, score: 0 };
}

export function capConfidenceIfUngrounded(confidence: number, grounded: boolean): number {
  if (grounded) return confidence;
  return Math.min(confidence, 0.59);
}

export function pageNumbersFromMarkers(source: string, packedText: string): number[] {
  if (!source || !packedText) return [];
  const idx = packedText.indexOf(source);
  if (idx < 0) {
    const nq = normalizeForQuoteMatch(source);
    const lower = packedText.toLowerCase();
    const alt = lower.indexOf(nq.slice(0, Math.min(40, nq.length)));
    if (alt < 0) return [];
    return [nearestPageMarker(packedText, alt)];
  }
  return [nearestPageMarker(packedText, idx)];
}

function nearestPageMarker(text: string, index: number): number {
  const before = text.slice(0, index);
  const matches = [...before.matchAll(/\[PAGE\s+(\d+)\]/gi)];
  const last = matches[matches.length - 1];
  if (!last) return 1;
  return Number(last[1]) || 1;
}

export function prefixPages(pages: Array<{ pageNumber: number; text: string }>): string {
  return pages
    .map((p) => `\n[PAGE ${p.pageNumber}]\n${p.text || ''}`)
    .join('\n')
    .trim();
}
