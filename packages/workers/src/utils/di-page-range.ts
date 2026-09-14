/**
 * Page-range helpers for Azure Document Intelligence metadata passes.
 *
 * Full-document layout/read stays unbounded (aside from AZURE_DI_MAX_PAGES).
 * Query-field and prebuilt-contract enrichment only need front matter +
 * execution/boilerplate pages, so they use a head+tail window.
 *
 * Window is configurable via AZURE_DI_METADATA_FIRST_PAGES / AZURE_DI_METADATA_LAST_PAGES.
 * Set AZURE_DI_METADATA_WINDOW=off to disable and always scan the full document.
 */

export const DI_DEFAULT_POLL_ATTEMPTS = 120;
export const DI_LARGE_DOC_PAGE_THRESHOLD = 15;
const DI_MAX_POLL_ATTEMPTS = 300;

/**
 * Azure `pages` query value for metadata DI (prebuilt-contract + query fields).
 * Returns `undefined` (= full document) when the document is short enough that
 * windowing would save nothing, or when windowing is disabled.
 */
/** True when a peeked PDF page count yields the same DI window as the layout page count. */
export function metadataWindowMatches(peekedPages?: number, actualPages?: number): boolean {
  return computeMetadataPageRange(peekedPages) === computeMetadataPageRange(actualPages);
}

export function computeMetadataPageRange(totalPages?: number): string | undefined {
  if (process.env.AZURE_DI_METADATA_WINDOW === 'off') return undefined;
  const first = Math.max(0, parseInt(process.env.AZURE_DI_METADATA_FIRST_PAGES || '3', 10) || 0);
  const last = Math.max(0, parseInt(process.env.AZURE_DI_METADATA_LAST_PAGES || '2', 10) || 0);
  if (!totalPages || totalPages <= first + last || first + last === 0) return undefined;

  const startLast = totalPages - last + 1;
  if (first <= 0) return `${startLast}-${totalPages}`;
  if (last <= 0) return `1-${first}`;
  if (startLast <= first + 1) return `1-${totalPages}`;
  return `1-${first},${startLast}-${totalPages}`;
}

/**
 * Page count to use for the metadata (head+tail) window.
 * A capped layout result must not be treated as the real document length,
 * or last-N pages become the end of the cap instead of the actual tail.
 */
export function resolveMetadataPageCount(opts: {
  documentPageCount?: number;
  analyzedPageCount?: number;
  layoutCapped: boolean;
}): number | undefined {
  if (opts.layoutCapped) return opts.documentPageCount;
  return opts.analyzedPageCount || opts.documentPageCount;
}

/**
 * Poll budget for DI analyze (1s interval). Default 120s is tight for 20–30 page
 * layout jobs; raise slightly once pageCount exceeds ~15.
 */
export function resolveDIPollAttempts(pageCount?: number, override?: number): number {
  if (override != null && Number.isFinite(override) && override > 0) {
    return Math.min(Math.floor(override), DI_MAX_POLL_ATTEMPTS);
  }
  if (!pageCount || pageCount <= DI_LARGE_DOC_PAGE_THRESHOLD) return DI_DEFAULT_POLL_ATTEMPTS;
  if (pageCount <= 30) return 180;
  return 240;
}

/**
 * Best-effort PDF page count from uncompressed `/Type /Pages /Count`.
 * Returns undefined for non-PDFs or compressed object streams.
 */
export function peekPdfPageCount(buffer: Buffer): number | undefined {
  if (buffer.length < 5) return undefined;
  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') return undefined;

  const headLen = Math.min(buffer.length, 128 * 1024);
  const chunks = [buffer.subarray(0, headLen).toString('latin1')];
  if (buffer.length > headLen) {
    const tailStart = Math.max(headLen, buffer.length - 512 * 1024);
    chunks.push(buffer.subarray(tailStart).toString('latin1'));
  }

  let best: number | undefined;
  const patterns = [
    /\/Type\s*\/Pages\b(?:(?!\/Type\s*\/Pages)[\s\S])*?\/Count\s+(\d+)/g,
    /\/Count\s+(\d+)(?:(?!\/Count)[\s\S])*?\/Type\s*\/Pages\b/g,
  ];
  for (const hay of chunks) {
    for (const re of patterns) {
      re.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = re.exec(hay))) {
        const n = parseInt(match[1]!, 10);
        if (n > 0 && n < 10_000 && (best === undefined || n > best)) {
          best = n;
        }
      }
    }
  }
  return best;
}
