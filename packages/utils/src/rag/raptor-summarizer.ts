/**
 * RAPTOR Hierarchical Summarization
 *
 * Implements the RAPTOR (Recursive Abstractive Processing for Tree-Organized Retrieval)
 * technique from the Stanford paper. Builds hierarchical summaries at indexing time:
 *
 * Level 0 — raw chunks
 * Level 1 — cluster summaries (groups of 5-8 semantically similar chunks)
 * Level 2 — section summaries (groups of cluster summaries)
 * Level 3 — document summary (single top-level summary)
 *
 * At query time, the retriever can search across ALL levels simultaneously,
 * matching fine-grained chunks for detail queries and high-level summaries
 * for broad questions — dramatically improving recall on both.
 */

import pino from 'pino';

const logger = pino({ name: 'raptor-summarizer' });

export interface RaptorNode {
  id: string;
  level: number;
  text: string;
  /** Indices of child nodes (lower-level chunks/summaries) */
  childIndices: number[];
  /** Contract section if identifiable */
  section?: string;
  /** Source chunk indices at level 0 */
  sourceChunkIndices: number[];
}

export interface RaptorTree {
  contractId: string;
  nodes: RaptorNode[];
  levels: number;
}

export interface RaptorConfig {
  /** Number of chunks per cluster at level 1 (default: 6) */
  clusterSize?: number;
  /** Number of cluster summaries per section at level 2 (default: 4) */
  sectionGroupSize?: number;
  /** Maximum tokens for each summary (default: 300) */
  maxSummaryTokens?: number;
  /** Model for summarization (default: gpt-4o-mini) */
  model?: string;
}

type SummarizeFn = (texts: string[], instruction: string) => Promise<string>;

/**
 * Build a RAPTOR tree from raw chunks.
 *
 * @param chunks   - Level-0 chunk texts (ordered by document position)
 * @param summarize - Async function that summarizes an array of texts given an instruction
 * @param contractId - Contract identifier
 * @param config   - Optional configuration
 */
export async function buildRaptorTree(
  chunks: string[],
  summarize: SummarizeFn,
  contractId: string,
  config: RaptorConfig = {},
): Promise<RaptorTree> {
  const {
    clusterSize = 6,
    sectionGroupSize = 4,
  } = config;

  if (chunks.length === 0) {
    return { contractId, nodes: [], levels: 0 };
  }

  const nodes: RaptorNode[] = [];

  // Level 0 — raw chunks (no summarization needed, stored as-is for reference)
  for (let i = 0; i < chunks.length; i++) {
    nodes.push({
      id: `L0_${i}`,
      level: 0,
      text: chunks[i]!,
      childIndices: [],
      sourceChunkIndices: [i],
    });
  }

  if (chunks.length <= 2) {
    return { contractId, nodes, levels: 1 };
  }

  // Level 1 — cluster summaries (groups of clusterSize consecutive chunks)
  const level1Nodes: RaptorNode[] = [];
  for (let i = 0; i < chunks.length; i += clusterSize) {
    const group = chunks.slice(i, i + clusterSize);
    const childIndices = Array.from({ length: group.length }, (_, j) => i + j);
    const sourceChunkIndices = childIndices;

    try {
      const summary = await summarize(
        group,
        'Summarize these contract sections into a single cohesive paragraph (4-6 sentences). Preserve key terms, parties, dates, and obligations. Be factual — do not add information not present in the source text.',
      );

      level1Nodes.push({
        id: `L1_${level1Nodes.length}`,
        level: 1,
        text: summary,
        childIndices,
        sourceChunkIndices,
      });
    } catch (err) {
      logger.warn({ err, chunkRange: `${i}-${i + group.length - 1}` }, 'Level-1 summarization failed, skipping cluster');
    }
  }

  for (const n of level1Nodes) nodes.push(n);

  if (level1Nodes.length <= 2) {
    return { contractId, nodes, levels: 2 };
  }

  // Level 2 — section summaries (groups of sectionGroupSize cluster summaries)
  const level2Nodes: RaptorNode[] = [];
  const l1Texts = level1Nodes.map(n => n.text);
  for (let i = 0; i < l1Texts.length; i += sectionGroupSize) {
    const group = l1Texts.slice(i, i + sectionGroupSize);
    const l1StartIdx = chunks.length; // offset since L0 nodes come first
    const childIndices = Array.from({ length: group.length }, (_, j) => l1StartIdx + i + j);
    const sourceChunkIndices = childIndices
      .map(ci => nodes[ci]?.sourceChunkIndices ?? [])
      .flat();

    try {
      const summary = await summarize(
        group,
        'Synthesize these section summaries into a comprehensive section-level summary (6-8 sentences). Capture the most important terms, obligations, financial details, and risks. Be precise and factual.',
      );

      level2Nodes.push({
        id: `L2_${level2Nodes.length}`,
        level: 2,
        text: summary,
        childIndices,
        sourceChunkIndices,
      });
    } catch (err) {
      logger.warn({ err, sectionRange: i }, 'Level-2 summarization failed, skipping section group');
    }
  }

  for (const n of level2Nodes) nodes.push(n);

  if (level2Nodes.length <= 1) {
    return { contractId, nodes, levels: 3 };
  }

  // Level 3 — document summary (single node summarizing all L2 nodes)
  try {
    const l2Texts = level2Nodes.map(n => n.text);
    const l2StartIdx = chunks.length + level1Nodes.length;
    const l2ChildIndices = Array.from({ length: level2Nodes.length }, (_, j) => l2StartIdx + j);
    const allSourceIndices = Array.from({ length: chunks.length }, (_, i) => i);

    const docSummary = await summarize(
      l2Texts,
      'Create a comprehensive document-level summary (8-10 sentences) of this entire contract. Include: contract type, parties, primary purpose, key commercial terms, critical obligations, notable risks, and important dates. This will be used for high-level contract retrieval.',
    );

    nodes.push({
      id: 'L3_0',
      level: 3,
      text: docSummary,
      childIndices: l2ChildIndices,
      sourceChunkIndices: allSourceIndices,
    });
  } catch (err) {
    logger.warn({ err }, 'Level-3 document summary failed');
  }

  const maxLevel = Math.max(...nodes.map(n => n.level)) + 1;
  return { contractId, nodes, levels: maxLevel };
}

/**
 * Get all summary nodes from a RAPTOR tree (levels > 0).
 * These should be stored as additional embeddings for multi-level retrieval.
 */
export function getRaptorSummaryChunks(tree: RaptorTree): Array<{
  text: string;
  level: number;
  id: string;
  sourceChunkIndices: number[];
}> {
  return tree.nodes
    .filter(n => n.level > 0)
    .map(n => ({
      text: n.text,
      level: n.level,
      id: n.id,
      sourceChunkIndices: n.sourceChunkIndices,
    }));
}
