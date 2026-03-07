/**
 * Adaptive Embedding Chunker
 *
 * Splits text using embedding cosine similarity between adjacent segments.
 * Unlike the regex-based `semanticChunk()`, this module calls an embedding
 * function to find *true semantic boundaries* — it splits only where the
 * meaning of adjacent text segments diverges beyond a configurable threshold.
 *
 * How it works:
 *  1. Split the text into small "atomic" segments (sentences / short paragraphs).
 *  2. Batch-embed all segments.
 *  3. Compute cosine similarity between every adjacent pair.
 *  4. Identify "split points" where similarity drops below the mean − σ·percentile.
 *  5. Merge segments between split points into final chunks.
 *  6. Respect max/min size constraints.
 *
 * Accepts an `embed` callback so the caller controls the embedding provider
 * (OpenAI, local model, mock for tests).
 *
 * Design rules:
 *  - One external dependency: the caller-provided `embed` function
 *  - Deterministic given the same embeddings
 *  - Falls back to uniform splitting if embedding fails
 */

import type { ChunkMetadata, SemanticChunk, ChunkingOptions } from './semantic-chunker';

// Re-export types so callers importing from here don't need a second import
export type { ChunkMetadata, SemanticChunk, ChunkingOptions };

// ── Configuration ───────────────────────────────────────────────────────────

export interface AdaptiveChunkingOptions extends ChunkingOptions {
  /**
   * How aggressively to split. Lower = more splits.
   * Expressed as number of standard deviations below the mean similarity
   * to use as the split threshold. Default 1.0.
   */
  breakpointPercentile?: number;
  /**
   * If provided, sentences with fewer than this many characters are merged
   * with the next sentence before embedding (reduces noise). Default 60.
   */
  minSentenceLen?: number;
}

/**
 * Embedding callback. Takes an array of text strings and returns their
 * embedding vectors. The order of outputs MUST match the order of inputs.
 */
export type EmbedFn = (texts: string[]) => Promise<number[][]>;

// ── Sentence splitter ───────────────────────────────────────────────────────

const SENTENCE_SPLIT =
  /(?<=[.!?;])\s+(?=[A-Z0-9"'(])|(?<=\n)\n+/g;

/**
 * Split text into atomic segments (roughly sentence-level).
 * Very short tails are merged with the preceding segment.
 */
function splitIntoSentences(text: string, minLen: number): string[] {
  const raw = text.split(SENTENCE_SPLIT).filter(Boolean);
  const merged: string[] = [];

  for (const s of raw) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if (merged.length > 0 && trimmed.length < minLen) {
      merged[merged.length - 1] += ' ' + trimmed;
    } else {
      merged.push(trimmed);
    }
  }
  return merged;
}

// ── Cosine similarity ───────────────────────────────────────────────────────

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i]!, bv = b[i]!;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  const mag = Math.sqrt(normA) * Math.sqrt(normB);
  return mag === 0 ? 0 : dot / mag;
}

// ── Breakpoint detection ────────────────────────────────────────────────────

function findBreakpoints(
  similarities: number[],
  sigmaMultiplier: number,
): Set<number> {
  if (similarities.length === 0) return new Set();

  const mean = similarities.reduce((a, b) => a + b, 0) / similarities.length;
  const variance =
    similarities.reduce((sum, s) => sum + (s - mean) ** 2, 0) /
    similarities.length;
  const sigma = Math.sqrt(variance);
  const threshold = mean - sigmaMultiplier * sigma;

  const breakpoints = new Set<number>();
  for (let i = 0; i < similarities.length; i++) {
    if (similarities[i]! < threshold) {
      breakpoints.add(i + 1); // Split AFTER this index
    }
  }
  return breakpoints;
}

// ── Detect chunk type ───────────────────────────────────────────────────────

const HEADING_RE =
  /^(?:#{1,6}\s+|(?:\d+\.)+\s+|[A-Z][A-Z\s]{2,}:?\s*$|Article\s+\d+|Section\s+\d+|ARTICLE\s+[IVXLCDM]+)/m;
const LIST_RE = /^(?:\s*[-•*]\s+|\s*\d+[.)]\s+)/m;
const TABLE_RE = /\|.*\|/;

function detectType(text: string): ChunkMetadata['chunkType'] {
  if (HEADING_RE.test(text)) return 'heading';
  if (LIST_RE.test(text)) return 'list';
  if (TABLE_RE.test(text)) return 'table';
  if (/clause|term|condition|obligation/i.test(text)) return 'clause';
  return 'paragraph';
}

// ── Core function ───────────────────────────────────────────────────────────

/**
 * Adaptive chunking using embedding similarity boundaries.
 *
 * @param text       Full document text
 * @param embed      Callback that returns embedding vectors for an array of strings
 * @param options    Chunking tuning parameters
 * @returns          Array of SemanticChunk with metadata
 */
export async function adaptiveChunk(
  text: string,
  embed: EmbedFn,
  options: AdaptiveChunkingOptions = {},
): Promise<SemanticChunk[]> {
  const {
    maxChunkSize = 1500,
    minChunkSize = 200,
    overlap = 100,
    breakpointPercentile = 1.0,
    minSentenceLen = 60,
  } = options;

  // ── 1. Atomic segmentation ──────────────────────────────────────────────
  const sentences = splitIntoSentences(text, minSentenceLen);
  if (sentences.length <= 1) {
    // Whole text is one chunk
    return [
      {
        index: 0,
        text: text.trim(),
        metadata: {
          chunkType: detectType(text),
          startChar: 0,
          endChar: text.length,
          wordCount: text.split(/\s+/).length,
        },
      },
    ];
  }

  // ── 2. Batch embed ──────────────────────────────────────────────────────
  let embeddings: number[][];
  try {
    embeddings = await embed(sentences);
    if (embeddings.length !== sentences.length) {
      throw new Error('Embedding count mismatch');
    }
  } catch (err) {
    // Fallback: uniform splitting (no embeddings available)
    console.warn('[AdaptiveChunker] Embedding failed, falling back to uniform split:', (err as Error).message);
    return uniformFallback(text, sentences, maxChunkSize, minChunkSize);
  }

  // ── 3. Adjacent cosine similarities ─────────────────────────────────────
  const similarities: number[] = [];
  for (let i = 0; i < embeddings.length - 1; i++) {
    similarities.push(cosine(embeddings[i]!, embeddings[i + 1]!));
  }

  // ── 4. Find breakpoints ─────────────────────────────────────────────────
  const breakpoints = findBreakpoints(similarities, breakpointPercentile);

  // ── 5. Merge into chunks ────────────────────────────────────────────────
  const chunks: SemanticChunk[] = [];
  let currentTexts: string[] = [];
  let chunkIndex = 0;
  let runningCharOffset = 0;

  const flushChunk = () => {
    if (currentTexts.length === 0) return;
    const chunkText = currentTexts.join(' ').trim();
    if (chunkText.length < minChunkSize && chunks.length > 0) {
      // Merge tiny trailing chunk into previous
      const prev = chunks[chunks.length - 1]!;
      prev.text += '\n\n' + chunkText;
      prev.metadata.endChar = runningCharOffset + chunkText.length;
      prev.metadata.wordCount = prev.text.split(/\s+/).length;
    } else {
      const startChar = text.indexOf(currentTexts[0]!, runningCharOffset);
      const safe = startChar >= 0 ? startChar : runningCharOffset;
      chunks.push({
        index: chunkIndex++,
        text: chunkText,
        metadata: {
          chunkType: detectType(chunkText),
          startChar: safe,
          endChar: safe + chunkText.length,
          wordCount: chunkText.split(/\s+/).length,
        },
      });
    }
    currentTexts = [];
  };

  for (let i = 0; i < sentences.length; i++) {
    currentTexts.push(sentences[i]!);

    // Check running size — force split if exceeding maxChunkSize
    const runningText = currentTexts.join(' ');
    const forceFlush = runningText.length >= maxChunkSize;

    if (forceFlush || breakpoints.has(i + 1)) {
      flushChunk();
      // Add overlap from previous sentence(s) if breakpoint-based split
      if (!forceFlush && overlap > 0 && sentences[i]) {
        const overlapText = sentences[i]!.slice(-overlap);
        if (overlapText.length > 20) {
          currentTexts.push(overlapText);
        }
      }
    }
  }
  flushChunk(); // Remaining sentences

  return chunks;
}

// ── Uniform fallback (no embeddings) ────────────────────────────────────────

function uniformFallback(
  fullText: string,
  sentences: string[],
  maxChunkSize: number,
  minChunkSize: number,
): SemanticChunk[] {
  const chunks: SemanticChunk[] = [];
  let current = '';
  let idx = 0;

  for (const s of sentences) {
    if (current.length + s.length + 1 > maxChunkSize && current.length >= minChunkSize) {
      const start = fullText.indexOf(current);
      chunks.push({
        index: idx++,
        text: current.trim(),
        metadata: {
          chunkType: detectType(current),
          startChar: start >= 0 ? start : 0,
          endChar: (start >= 0 ? start : 0) + current.length,
          wordCount: current.split(/\s+/).length,
        },
      });
      current = s;
    } else {
      current += (current ? ' ' : '') + s;
    }
  }
  if (current.trim()) {
    const start = fullText.indexOf(current);
    chunks.push({
      index: idx++,
      text: current.trim(),
      metadata: {
        chunkType: detectType(current),
        startChar: start >= 0 ? start : 0,
        endChar: (start >= 0 ? start : 0) + current.length,
        wordCount: current.split(/\s+/).length,
      },
    });
  }
  return chunks;
}
