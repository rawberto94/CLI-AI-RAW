/**
 * Semantic Chunking Service
 * 
 * Advanced document chunking that respects document structure.
 * Produces semantically meaningful chunks instead of fixed-size splits.
 */

import OpenAI from 'openai';

// Types
export interface SemanticChunk {
  text: string;
  chunkIndex: number;
  chunkType: 'clause' | 'section' | 'paragraph' | 'definition' | 'schedule';
  section?: string;
  sectionNumber?: string;
  title?: string;
  startChar: number;
  endChar: number;
  metadata: Record<string, unknown>;
}

export interface ChunkingOptions {
  maxChunkSize?: number;
  minChunkSize?: number;
  overlap?: number;
  preserveStructure?: boolean;
  extractMetadata?: boolean;
}

// Section patterns for legal documents
const SECTION_PATTERNS = {
  numberedSection: /^(\d+(?:\.\d+)*)\s+(.+?)(?:\n|$)/gm,
  articleHeader: /^(?:ARTICLE|Article|Section|SECTION)\s+(\d+|[IVX]+)[:\s]+(.+?)(?:\n|$)/gm,
  clauseHeader: /^(?:\d+\.\d+|\([a-z]\)|\([ivx]+\))\s+(.+?)(?:\n|$)/gm,
  definitionBlock: /[""]([^""]+)[""]\s+(?:means|shall mean|refers to)/gi,
  scheduleHeader: /^(?:SCHEDULE|Schedule|EXHIBIT|Exhibit|APPENDIX|Appendix)\s+([A-Z\d]+)/gm,
};

// OpenAI client for AI-assisted chunking
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Semantic chunking that respects document structure
 */
export async function semanticChunk(
  text: string,
  options: ChunkingOptions = {}
): Promise<SemanticChunk[]> {
  const {
    maxChunkSize = 1500,
    minChunkSize = 200,
    overlap = 100,
    preserveStructure = true,
    extractMetadata = true,
  } = options;

  // Step 1: Identify document structure
  const sections = identifySections(text);
  
  // Step 2: Split into semantic chunks
  const chunks: SemanticChunk[] = [];
  let chunkIndex = 0;

  for (const section of sections) {
    // If section is within size limits, keep it as one chunk
    if (section.text.length <= maxChunkSize && section.text.length >= minChunkSize) {
      chunks.push({
        ...section,
        chunkIndex: chunkIndex++,
      });
    } else if (section.text.length > maxChunkSize) {
      // Split large sections at paragraph boundaries
      const subChunks = splitAtParagraphs(section.text, maxChunkSize, overlap);
      
      for (const subText of subChunks) {
        chunks.push({
          text: subText,
          chunkIndex: chunkIndex++,
          chunkType: section.chunkType,
          section: section.section,
          sectionNumber: section.sectionNumber,
          title: section.title,
          startChar: section.startChar + section.text.indexOf(subText),
          endChar: section.startChar + section.text.indexOf(subText) + subText.length,
          metadata: section.metadata,
        });
      }
    } else if (section.text.length < minChunkSize && chunks.length > 0) {
      // Merge small sections with previous chunk if possible
      const lastChunk = chunks[chunks.length - 1];
      if (lastChunk && lastChunk.text.length + section.text.length <= maxChunkSize) {
        lastChunk.text += '\n\n' + section.text;
        lastChunk.endChar = section.endChar;
      } else {
        chunks.push({
          ...section,
          chunkIndex: chunkIndex++,
        });
      }
    } else {
      chunks.push({
        ...section,
        chunkIndex: chunkIndex++,
      });
    }
  }

  // Step 3: Extract metadata if requested
  if (extractMetadata && chunks.length > 0) {
    await enrichChunksWithMetadata(chunks);
  }

  return chunks;
}

/**
 * Identify document sections based on structure patterns
 */
function identifySections(text: string): SemanticChunk[] {
  const sections: SemanticChunk[] = [];
  const lines = text.split('\n');
  
  let currentSection: Partial<SemanticChunk> = {
    text: '',
    chunkType: 'paragraph',
    startChar: 0,
  };
  let charPos = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const lineStart = charPos;
    charPos += line.length + 1; // +1 for newline

    // Check for section headers
    const sectionMatch = line.match(/^(\d+(?:\.\d+)*)\s+(.+)$/);
    const articleMatch = line.match(/^(?:ARTICLE|Article|SECTION|Section)\s+(\d+|[IVX]+)[:\s]+(.+)$/i);
    const scheduleMatch = line.match(/^(?:SCHEDULE|Schedule|EXHIBIT|Exhibit|APPENDIX|Appendix)\s+([A-Z\d]+)/i);
    const definitionMatch = line.match(/[""]([^""]+)[""]\s+(?:means|shall mean|refers to)/i);

    if (sectionMatch || articleMatch || scheduleMatch) {
      // Save current section if it has content
      if (currentSection.text && currentSection.text.trim()) {
        sections.push({
          text: currentSection.text.trim(),
          chunkIndex: sections.length,
          chunkType: currentSection.chunkType as SemanticChunk['chunkType'],
          section: currentSection.section,
          sectionNumber: currentSection.sectionNumber,
          title: currentSection.title,
          startChar: currentSection.startChar!,
          endChar: lineStart - 1,
          metadata: {},
        });
      }

      // Start new section
      if (sectionMatch) {
        currentSection = {
          text: line + '\n',
          chunkType: 'section',
          sectionNumber: sectionMatch[1],
          title: sectionMatch[2],
          section: sectionMatch[2],
          startChar: lineStart,
        };
      } else if (articleMatch) {
        currentSection = {
          text: line + '\n',
          chunkType: 'clause',
          sectionNumber: articleMatch[1],
          title: articleMatch[2],
          section: articleMatch[2],
          startChar: lineStart,
        };
      } else if (scheduleMatch) {
        currentSection = {
          text: line + '\n',
          chunkType: 'schedule',
          sectionNumber: scheduleMatch[1],
          title: `Schedule ${scheduleMatch[1]}`,
          section: `Schedule ${scheduleMatch[1]}`,
          startChar: lineStart,
        };
      }
    } else if (definitionMatch) {
      // Handle definitions inline
      currentSection.text += line + '\n';
      if (currentSection.chunkType === 'paragraph') {
        currentSection.chunkType = 'definition';
      }
    } else {
      // Continue current section
      currentSection.text = (currentSection.text || '') + line + '\n';
    }
  }

  // Don't forget the last section
  if (currentSection.text && currentSection.text.trim()) {
    sections.push({
      text: currentSection.text.trim(),
      chunkIndex: sections.length,
      chunkType: currentSection.chunkType as SemanticChunk['chunkType'],
      section: currentSection.section,
      sectionNumber: currentSection.sectionNumber,
      title: currentSection.title,
      startChar: currentSection.startChar!,
      endChar: charPos,
      metadata: {},
    });
  }

  return sections;
}

/**
 * Split text at paragraph boundaries
 */
function splitAtParagraphs(
  text: string,
  maxSize: number,
  overlap: number
): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    if (currentChunk.length + para.length + 2 <= maxSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        // Start new chunk with overlap from previous
        const overlapText = getOverlapText(currentChunk, overlap);
        currentChunk = overlapText + (overlapText ? '\n\n' : '') + para;
      } else {
        // Paragraph itself is too large, split by sentences
        const sentenceChunks = splitBySentences(para, maxSize, overlap);
        chunks.push(...sentenceChunks.slice(0, -1));
        currentChunk = sentenceChunks[sentenceChunks.length - 1] || '';
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Split text by sentences when paragraphs are too large
 */
function splitBySentences(
  text: string,
  maxSize: number,
  overlap: number
): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length <= maxSize) {
      currentChunk += sentence;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        // Single sentence is too large, split by chars
        chunks.push(sentence.slice(0, maxSize));
        currentChunk = sentence.slice(maxSize - overlap);
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Get overlap text from the end of a chunk
 */
function getOverlapText(text: string, overlapSize: number): string {
  if (text.length <= overlapSize) return text;
  
  // Try to break at word boundary
  const endPortion = text.slice(-overlapSize);
  const wordBreak = endPortion.indexOf(' ');
  
  return wordBreak > 0 ? endPortion.slice(wordBreak + 1) : endPortion;
}

/**
 * Enrich chunks with AI-extracted metadata
 */
async function enrichChunksWithMetadata(chunks: SemanticChunk[]): Promise<void> {
  // Process in batches to avoid rate limits
  const batchSize = 5;
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (chunk) => {
      try {
        const metadata = await extractChunkMetadata(chunk.text);
        chunk.metadata = { ...chunk.metadata, ...metadata };
      } catch (error) {
        console.error('Failed to extract metadata for chunk:', error);
      }
    }));
  }
}

/**
 * Extract metadata from a chunk using AI
 */
async function extractChunkMetadata(text: string): Promise<Record<string, unknown>> {
  // Quick heuristic extraction first
  const metadata: Record<string, unknown> = {};

  // Extract dates
  const dateMatches = text.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g);
  if (dateMatches) {
    metadata.dates = dateMatches;
  }

  // Extract monetary amounts
  const moneyMatches = text.match(/\$[\d,]+(?:\.\d{2})?/g);
  if (moneyMatches) {
    metadata.amounts = moneyMatches;
  }

  // Extract percentages
  const percentMatches = text.match(/\d+(?:\.\d+)?%/g);
  if (percentMatches) {
    metadata.percentages = percentMatches;
  }

  // Detect key clause types
  const clausePatterns = {
    termination: /termination|terminate|ending|conclusion/i,
    liability: /liability|liable|indemnif|damages/i,
    payment: /payment|pay|invoice|fee|price/i,
    confidentiality: /confidential|secret|nda|non-disclosure/i,
    warranty: /warranty|warrants|guarantee/i,
    force_majeure: /force majeure|act of god|unforeseeable/i,
    intellectual_property: /intellectual property|ip|copyright|patent|trademark/i,
    dispute: /dispute|arbitration|litigation|court/i,
  };

  metadata.clauseTypes = Object.entries(clausePatterns)
    .filter(([_, pattern]) => pattern.test(text))
    .map(([type]) => type);

  return metadata;
}

/**
 * Smart chunking with recursive splitting
 */
export function recursiveChunk(
  text: string,
  maxSize: number = 1500,
  separators: string[] = ['\n\n', '\n', '. ', ' ', '']
): string[] {
  if (text.length <= maxSize) {
    return [text];
  }

  const separator = separators[0];
  if (!separator) {
    // Last resort: split by characters
    const chunks = [];
    for (let i = 0; i < text.length; i += maxSize) {
      chunks.push(text.slice(i, i + maxSize));
    }
    return chunks;
  }

  const parts = text.split(separator);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const part of parts) {
    const potentialChunk = currentChunk
      ? currentChunk + separator + part
      : part;

    if (potentialChunk.length <= maxSize) {
      currentChunk = potentialChunk;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      // Recursively split the part if it's too large
      if (part.length > maxSize) {
        chunks.push(...recursiveChunk(part, maxSize, separators.slice(1)));
        currentChunk = '';
      } else {
        currentChunk = part;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Token-aware chunking (estimates tokens)
 */
export function tokenAwareChunk(
  text: string,
  maxTokens: number = 500,
  overlap: number = 50
): string[] {
  // Rough estimate: 1 token ≈ 4 characters for English text
  const charsPerToken = 4;
  const maxChars = maxTokens * charsPerToken;
  const overlapChars = overlap * charsPerToken;

  return splitAtParagraphs(text, maxChars, overlapChars);
}
