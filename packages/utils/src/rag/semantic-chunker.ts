/**
 * Shared Semantic Chunker
 *
 * Single source of truth for document-structure-aware chunking.
 * Imported by apps/web (advanced-rag.service) AND packages/workers (rag-indexing-worker).
 *
 * Design rules:
 *  - Zero external dependencies (pure string manipulation)
 *  - Deterministic output for the same input
 *  - No OpenAI / LLM calls (metadata enrichment stays in callers)
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface ChunkMetadata {
  section?: string;
  heading?: string;
  pageNumber?: number;
  chunkType: 'heading' | 'paragraph' | 'list' | 'table' | 'clause';
  startChar: number;
  endChar: number;
  wordCount: number;
}

export interface SemanticChunk {
  index: number;
  text: string;
  metadata: ChunkMetadata;
}

export interface ChunkingOptions {
  maxChunkSize?: number;
  minChunkSize?: number;
  overlap?: number;
}

// ── Patterns ────────────────────────────────────────────────────────────────

const HEADING_PATTERN =
  /^(?:#{1,6}\s+|(?:\d+\.)+\s+|[A-Z][A-Z\s]{2,}:?\s*$|Article\s+\d+|Section\s+\d+|ARTICLE\s+[IVXLCDM]+)/gm;

const LIST_PATTERN = /^(?:\s*[-•*]\s+|\s*\d+[.)]\s+)/gm;

const TABLE_PATTERN = /\|.*\|/g;

const SECTION_SPLIT =
  /\n(?=(?:#{1,3}\s+|Article\s+\d+|Section\s+\d+|ARTICLE\s+[IVXLCDM]+))/i;

// ── Core function ───────────────────────────────────────────────────────────

/**
 * Semantic chunking – splits text by document structure (headings, sections,
 * paragraphs) rather than fixed character counts.
 *
 * Returns chunks in document order with char-offset metadata.
 */
export function semanticChunk(
  text: string,
  options: ChunkingOptions = {},
): SemanticChunk[] {
  const { maxChunkSize = 1500, minChunkSize = 200, overlap = 100 } = options;

  const chunks: SemanticChunk[] = [];
  let chunkIndex = 0;

  // Split by major sections first
  const sections = text.split(SECTION_SPLIT);

  for (const section of sections) {
    if (!section.trim()) continue;

    // Extract heading if present
    const headingMatch = section.match(HEADING_PATTERN);
    const heading = headingMatch ? headingMatch[0].trim() : undefined;

    // Determine chunk type
    let chunkType: ChunkMetadata['chunkType'] = 'paragraph';
    if (heading) chunkType = 'heading';
    else if (LIST_PATTERN.test(section)) chunkType = 'list';
    else if (TABLE_PATTERN.test(section)) chunkType = 'table';
    else if (/clause|term|condition|obligation/i.test(section)) chunkType = 'clause';

    // Reset lastIndex after regex.test()
    LIST_PATTERN.lastIndex = 0;
    TABLE_PATTERN.lastIndex = 0;

    // If section is small enough, keep as single chunk
    if (section.length <= maxChunkSize) {
      chunks.push({
        index: chunkIndex++,
        text: section.trim(),
        metadata: {
          section: heading,
          heading,
          chunkType,
          startChar: text.indexOf(section),
          endChar: text.indexOf(section) + section.length,
          wordCount: section.split(/\s+/).length,
        },
      });
      continue;
    }

    // Split large sections by paragraphs
    const paragraphs = section.split(/\n\n+/);
    let currentChunk = '';
    let chunkStartChar = text.indexOf(section);

    for (const para of paragraphs) {
      if (!para.trim()) continue;

      // If adding this paragraph would exceed max size, save current chunk
      if (
        currentChunk.length + para.length > maxChunkSize &&
        currentChunk.length >= minChunkSize
      ) {
        chunks.push({
          index: chunkIndex++,
          text: currentChunk.trim(),
          metadata: {
            section: heading,
            heading,
            chunkType,
            startChar: chunkStartChar,
            endChar: chunkStartChar + currentChunk.length,
            wordCount: currentChunk.split(/\s+/).length,
          },
        });

        // Start new chunk with overlap
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + '\n\n' + para;
        chunkStartChar =
          text.indexOf(currentChunk) ||
          chunkStartChar + currentChunk.length - overlap;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + para;
      }
    }

    // Save remaining chunk
    if (currentChunk.trim().length >= minChunkSize) {
      chunks.push({
        index: chunkIndex++,
        text: currentChunk.trim(),
        metadata: {
          section: heading,
          heading,
          chunkType,
          startChar: chunkStartChar,
          endChar: chunkStartChar + currentChunk.length,
          wordCount: currentChunk.split(/\s+/).length,
        },
      });
    }
  }

  return chunks;
}
