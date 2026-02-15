/**
 * Parent Document Retrieval Service
 * 
 * Implements a two-tier chunking strategy:
 * - **Child chunks** (small, ~300 chars): Used for precise vector matching
 * - **Parent chunks** (large, ~1500 chars): Returned to the LLM for full context
 * 
 * This solves the fundamental RAG trade-off:
 * - Small chunks → better embedding precision (semantic match)
 * - Large chunks → better LLM context (complete clauses, full paragraphs)
 * 
 * How it works:
 * 1. During indexing: split into parent chunks, then further split each into children
 * 2. Store parent-child relationships via parentChunkIndex
 * 3. During retrieval: search child chunks, but return their parent chunk text
 * 
 * This is stored alongside existing ContractEmbedding records using the
 * existing `section` field to encode parent references.
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export interface ParentChunk {
  index: number;
  text: string;
  section?: string;
  chunkType?: string;
  children: ChildChunk[];
}

export interface ChildChunk {
  index: number;
  text: string;
  parentIndex: number;
  offsetInParent: number;
}

/**
 * Split text into parent chunks, then further split each parent into children.
 */
export function createParentChildChunks(
  text: string,
  options: {
    parentMaxSize?: number;
    childMaxSize?: number;
    parentOverlap?: number;
    childOverlap?: number;
  } = {},
): ParentChunk[] {
  const {
    parentMaxSize = 1500,
    childMaxSize = 300,
    parentOverlap = 100,
    childOverlap = 50,
  } = options;

  const parents: ParentChunk[] = [];

  // Split by major sections/headings first
  const sections = text.split(/\n(?=(?:#{1,3}\s+|Article\s+\d+|Section\s+\d+|ARTICLE\s+[IVXLCDM]+|\d+\.\s+))/i);

  let parentIndex = 0;
  let globalChildIndex = 0;

  for (const section of sections) {
    if (!section.trim()) continue;

    // Extract heading if present
    const headingMatch = section.match(/^((?:#{1,3}\s+|Article\s+\d+|Section\s+\d+|ARTICLE\s+[IVXLCDM]+|\d+\.\d*\s+).+?)(?:\n|$)/i);
    const heading = headingMatch ? headingMatch[1]?.trim() : undefined;

    // If section is already small enough for a parent chunk
    if (section.length <= parentMaxSize) {
      const parent: ParentChunk = {
        index: parentIndex++,
        text: section.trim(),
        section: heading,
        chunkType: detectChunkType(section),
        children: [],
      };

      // Create children from this parent
      parent.children = splitIntoChildren(parent.text, parent.index, globalChildIndex, childMaxSize, childOverlap);
      globalChildIndex += parent.children.length;
      parents.push(parent);
    } else {
      // Split large section into multiple parents at paragraph boundaries
      const paragraphs = section.split(/\n\n+/);
      let currentParent = '';
      const currentOffset = 0;

      for (const para of paragraphs) {
        if (!para.trim()) continue;

        if (currentParent.length + para.length + 2 > parentMaxSize && currentParent.length > 0) {
          // Finalize current parent
          const parent: ParentChunk = {
            index: parentIndex++,
            text: currentParent.trim(),
            section: heading,
            chunkType: detectChunkType(currentParent),
            children: [],
          };
          parent.children = splitIntoChildren(parent.text, parent.index, globalChildIndex, childMaxSize, childOverlap);
          globalChildIndex += parent.children.length;
          parents.push(parent);

          // Start new parent with overlap
          const overlapText = currentParent.slice(-parentOverlap);
          currentParent = overlapText + '\n\n' + para;
        } else {
          currentParent += (currentParent ? '\n\n' : '') + para;
        }
      }

      // Save remaining text as final parent
      if (currentParent.trim()) {
        const parent: ParentChunk = {
          index: parentIndex++,
          text: currentParent.trim(),
          section: heading,
          chunkType: detectChunkType(currentParent),
          children: [],
        };
        parent.children = splitIntoChildren(parent.text, parent.index, globalChildIndex, childMaxSize, childOverlap);
        globalChildIndex += parent.children.length;
        parents.push(parent);
      }
    }
  }

  return parents;
}

/**
 * Split a parent chunk into smaller child chunks for precise matching.
 */
function splitIntoChildren(
  parentText: string,
  parentIndex: number,
  globalStartIndex: number,
  maxSize: number,
  overlap: number,
): ChildChunk[] {
  const children: ChildChunk[] = [];
  
  // If parent is already small enough, single child === parent
  if (parentText.length <= maxSize) {
    children.push({
      index: globalStartIndex,
      text: parentText,
      parentIndex,
      offsetInParent: 0,
    });
    return children;
  }

  // Split at sentence boundaries
  const sentences = parentText.match(/[^.!?]+[.!?]+/g) || [parentText];
  let current = '';
  let offset = 0;

  for (const sentence of sentences) {
    if (current.length + sentence.length > maxSize && current.length > 0) {
      children.push({
        index: globalStartIndex + children.length,
        text: current.trim(),
        parentIndex,
        offsetInParent: offset,
      });
      // Start new child with overlap
      const overlapStart = Math.max(0, current.length - overlap);
      const overlapText = current.slice(overlapStart);
      offset += current.length - overlapText.length;
      current = overlapText + sentence;
    } else {
      current += sentence;
    }
  }

  if (current.trim()) {
    children.push({
      index: globalStartIndex + children.length,
      text: current.trim(),
      parentIndex,
      offsetInParent: offset,
    });
  }

  return children;
}

/**
 * After vector search on child chunks, expand results to return parent chunk text.
 * This gives the LLM full context instead of tiny fragments.
 */
export async function expandToParentChunks(
  searchResults: Array<{ contractId: string; chunkIndex: number; text: string; score: number; [key: string]: any }>,
): Promise<Array<{ contractId: string; chunkIndex: number; text: string; parentText: string; score: number; [key: string]: any }>> {
  if (searchResults.length === 0) return [];

  // Group by contractId for batch queries
  const byContract = new Map<string, typeof searchResults>();
  for (const result of searchResults) {
    const existing = byContract.get(result.contractId) || [];
    existing.push(result);
    byContract.set(result.contractId, existing);
  }

  const expandedResults: Array<{ contractId: string; chunkIndex: number; text: string; parentText: string; score: number; [key: string]: any }> = [];

  for (const [contractId, results] of byContract) {
    // Get the parent chunk indices from section field (encoded as "parent:{index}")
    const chunkIndices = results.map(r => r.chunkIndex);

    // Fetch the child chunks to find their parent references
    const childChunks = await prisma.contractEmbedding.findMany({
      where: {
        contractId,
        chunkIndex: { in: chunkIndices },
      },
      select: {
        chunkIndex: true,
        chunkText: true,
        section: true,
      },
    });

    // Extract parent indices from the section field
    const parentIndices = new Set<number>();
    const childToParent = new Map<number, number>();

    for (const child of childChunks) {
      const parentMatch = child.section?.match(/^parent:(\d+)(?:\|(.*))?$/);
      if (parentMatch) {
        const parentIdx = parseInt(parentMatch[1]!, 10);
        parentIndices.add(parentIdx);
        childToParent.set(child.chunkIndex, parentIdx);
      }
    }

    // Fetch parent chunks
    let parentMap = new Map<number, string>();
    if (parentIndices.size > 0) {
      const parents = await prisma.contractEmbedding.findMany({
        where: {
          contractId,
          chunkIndex: { in: Array.from(parentIndices) },
          section: { startsWith: 'PARENT' },
        },
        select: { chunkIndex: true, chunkText: true },
      });
      parentMap = new Map(parents.map(p => [p.chunkIndex, p.chunkText]));
    }

    // Map results back
    for (const result of results) {
      const parentIdx = childToParent.get(result.chunkIndex);
      const parentText = parentIdx !== undefined ? parentMap.get(parentIdx) : undefined;
      expandedResults.push({
        ...result,
        parentText: parentText || result.text, // Fall back to child text if no parent
      });
    }
  }

  // Deduplicate by parent (multiple children may map to same parent)
  const seen = new Set<string>();
  const deduplicated = expandedResults.filter(r => {
    const key = `${r.contractId}:${r.parentText.slice(0, 100)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Re-sort by score
  deduplicated.sort((a, b) => b.score - a.score);

  return deduplicated;
}

/** Simple chunk type detection heuristic */
function detectChunkType(text: string): string {
  if (/^(?:#{1,6}\s+|Article\s+\d+|Section\s+\d+|ARTICLE)/im.test(text)) return 'heading';
  if (/\|.*\|/.test(text)) return 'table';
  if (/^\s*[-•*]\s+/m.test(text)) return 'list';
  if (/clause|term|condition|obligation|liability|indemnif|terminat/i.test(text)) return 'clause';
  return 'paragraph';
}

export default {
  createParentChildChunks,
  expandToParentChunks,
};
