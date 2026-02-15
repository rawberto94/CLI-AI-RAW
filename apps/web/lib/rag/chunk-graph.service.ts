/**
 * Chunk Relationship Graph
 * 
 * Builds a graph of semantic relationships between chunks, enabling
 * multi-hop reasoning. When a user asks about "termination penalties",
 * the system can co-retrieve related clauses like "liability", 
 * "indemnification", and "force majeure" even if they don't match
 * the query directly.
 * 
 * Graph edges:
 * - SEQUENTIAL: Chunks from same section, adjacent positions
 * - CROSS_REFERENCE: Chunks that reference each other (e.g., "see Section 5")
 * - SEMANTIC_SIBLING: Chunks with similar embeddings from different sections
 * - LEGAL_RELATED: Chunks linked by legal concept ontology
 * 
 * The graph is built during indexing and queried during retrieval.
 */

import type { SearchResult } from './advanced-rag.service';

// ============================================================================
// Types
// ============================================================================

type EdgeType = 'SEQUENTIAL' | 'CROSS_REFERENCE' | 'SEMANTIC_SIBLING' | 'LEGAL_RELATED';

interface ChunkNode {
  chunkId: string;          // Unique identifier: `${contractId}:${chunkIndex}`
  contractId: string;
  section: string;
  chunkIndex: number;
  chunkText: string;
  embedding?: number[];
}

interface ChunkEdge {
  sourceId: string;
  targetId: string;
  type: EdgeType;
  weight: number;           // 0-1, strength of relationship
  metadata?: string;        // e.g., "references Section 5.2"
}

interface GraphTraversalOptions {
  maxHops: number;          // How far to traverse (1 = direct neighbors only)
  maxRelated: number;       // Max related chunks to return
  edgeTypes?: EdgeType[];   // Which edge types to follow
  minWeight: number;        // Minimum edge weight to follow
}

interface RelatedChunk {
  chunk: ChunkNode;
  relationship: EdgeType;
  weight: number;
  hopDistance: number;
}

// ============================================================================
// Legal Concept Ontology
// ============================================================================

/**
 * Legal concepts that are often related in contracts.
 * If a chunk is about concept A, chunks about concept B may be relevant.
 */
const LEGAL_CONCEPT_GROUPS: Record<string, string[]> = {
  termination: ['termination', 'expiration', 'cancellation', 'renewal', 'term', 'notice period'],
  liability: ['liability', 'limitation of liability', 'cap', 'damages', 'consequential damages'],
  indemnification: ['indemnification', 'indemnify', 'hold harmless', 'defense', 'third party claims'],
  confidentiality: ['confidentiality', 'non-disclosure', 'trade secrets', 'proprietary information'],
  payment: ['payment', 'fees', 'invoicing', 'billing', 'compensation', 'rate', 'pricing'],
  ip: ['intellectual property', 'ownership', 'license', 'copyright', 'patent', 'work product'],
  compliance: ['compliance', 'regulatory', 'governing law', 'jurisdiction', 'dispute resolution', 'arbitration'],
  warranties: ['warranty', 'warranties', 'representations', 'disclaimer', 'as-is'],
  force_majeure: ['force majeure', 'act of god', 'unforeseeable', 'beyond control'],
  data_protection: ['data protection', 'privacy', 'gdpr', 'personal data', 'data processing', 'data breach'],
};

/** Map individual terms to their concept group */
const TERM_TO_GROUP = new Map<string, string>();
for (const [group, terms] of Object.entries(LEGAL_CONCEPT_GROUPS)) {
  for (const term of terms) {
    TERM_TO_GROUP.set(term.toLowerCase(), group);
  }
}

// ============================================================================
// In-Memory Graph Store
// ============================================================================

class ChunkGraph {
  private nodes: Map<string, ChunkNode> = new Map();
  private adjacency: Map<string, ChunkEdge[]> = new Map();
  private contractNodes: Map<string, Set<string>> = new Map(); // contractId → nodeIds

  /** Add a chunk node to the graph */
  addNode(node: ChunkNode): void {
    this.nodes.set(node.chunkId, node);

    if (!this.adjacency.has(node.chunkId)) {
      this.adjacency.set(node.chunkId, []);
    }

    // Track by contract
    if (!this.contractNodes.has(node.contractId)) {
      this.contractNodes.set(node.contractId, new Set());
    }
    this.contractNodes.get(node.contractId)!.add(node.chunkId);
  }

  /** Add an edge between two chunks */
  addEdge(edge: ChunkEdge): void {
    const sourceEdges = this.adjacency.get(edge.sourceId);
    if (sourceEdges) {
      // Avoid duplicate edges
      const existing = sourceEdges.find(
        e => e.targetId === edge.targetId && e.type === edge.type
      );
      if (!existing) {
        sourceEdges.push(edge);
      }
    }

    // Bidirectional for all edge types except SEQUENTIAL
    if (edge.type !== 'SEQUENTIAL') {
      const targetEdges = this.adjacency.get(edge.targetId);
      if (targetEdges) {
        const existing = targetEdges.find(
          e => e.targetId === edge.sourceId && e.type === edge.type
        );
        if (!existing) {
          targetEdges.push({
            ...edge,
            sourceId: edge.targetId,
            targetId: edge.sourceId,
          });
        }
      }
    }
  }

  /** Get node by ID */
  getNode(chunkId: string): ChunkNode | undefined {
    return this.nodes.get(chunkId);
  }

  /** Remove all nodes and edges for a contract (for re-indexing) */
  removeContract(contractId: string): void {
    const nodeIds = this.contractNodes.get(contractId);
    if (!nodeIds) return;

    for (const nodeId of nodeIds) {
      // Remove outgoing edges
      this.adjacency.delete(nodeId);

      // Remove incoming edges from other nodes
      for (const [, edges] of this.adjacency) {
        const idx = edges.findIndex(e => e.targetId === nodeId);
        if (idx >= 0) edges.splice(idx, 1);
      }

      this.nodes.delete(nodeId);
    }

    this.contractNodes.delete(contractId);
  }

  /**
   * Traverse the graph from a set of seed chunks, returning related chunks.
   * Uses BFS with weight-based pruning.
   */
  traverse(
    seedChunkIds: string[],
    options: Partial<GraphTraversalOptions> = {},
  ): RelatedChunk[] {
    const opts: GraphTraversalOptions = {
      maxHops: 2,
      maxRelated: 5,
      minWeight: 0.3,
      ...options,
    };

    const visited = new Set<string>(seedChunkIds);
    const related: RelatedChunk[] = [];

    // BFS queue: [nodeId, hopDistance, cumulativeWeight]
    const queue: Array<[string, number, number]> = seedChunkIds.map(id => [id, 0, 1.0]);

    while (queue.length > 0 && related.length < opts.maxRelated) {
      const [currentId, hops, cumWeight] = queue.shift()!;

      if (hops >= opts.maxHops) continue;

      const edges = this.adjacency.get(currentId) || [];

      for (const edge of edges) {
        if (visited.has(edge.targetId)) continue;
        if (edge.weight < opts.minWeight) continue;
        if (opts.edgeTypes && !opts.edgeTypes.includes(edge.type)) continue;

        visited.add(edge.targetId);

        const node = this.nodes.get(edge.targetId);
        if (node) {
          related.push({
            chunk: node,
            relationship: edge.type,
            weight: edge.weight * cumWeight,
            hopDistance: hops + 1,
          });

          // Continue BFS from this node
          queue.push([edge.targetId, hops + 1, edge.weight * cumWeight]);
        }
      }
    }

    // Sort by weight descending
    related.sort((a, b) => b.weight - a.weight);
    return related.slice(0, opts.maxRelated);
  }

  /** Get graph statistics */
  getStats(): { nodes: number; edges: number; contracts: number } {
    let edgeCount = 0;
    for (const [, edges] of this.adjacency) {
      edgeCount += edges.length;
    }
    return {
      nodes: this.nodes.size,
      edges: edgeCount,
      contracts: this.contractNodes.size,
    };
  }
}

// ============================================================================
// Graph Building Functions
// ============================================================================

/**
 * Build graph edges for a set of chunks from a single contract.
 * Called during indexing.
 */
export function buildContractGraph(
  graph: ChunkGraph,
  contractId: string,
  chunks: Array<{ text: string; section: string; index: number; embedding?: number[] }>,
): void {
  // Remove existing graph data for this contract
  graph.removeContract(contractId);

  // Add nodes
  for (const chunk of chunks) {
    graph.addNode({
      chunkId: `${contractId}:${chunk.index}`,
      contractId,
      section: chunk.section,
      chunkIndex: chunk.index,
      chunkText: chunk.text,
      embedding: chunk.embedding,
    });
  }

  // Build SEQUENTIAL edges (adjacent chunks in same section)
  for (let i = 0; i < chunks.length - 1; i++) {
    const current = chunks[i]!;
    const next = chunks[i + 1]!;

    if (current.section === next.section) {
      graph.addEdge({
        sourceId: `${contractId}:${current.index}`,
        targetId: `${contractId}:${next.index}`,
        type: 'SEQUENTIAL',
        weight: 0.8,
      });
    }
  }

  // Build CROSS_REFERENCE edges (chunks referencing sections)
  const sectionPattern = /(?:see |refer to |as (?:defined|set forth) in |pursuant to |under )(?:section|clause|article|paragraph)\s+(\d+(?:\.\d+)*)/gi;
  const sectionChunks = new Map<string, string[]>(); // section number → chunk IDs

  for (const chunk of chunks) {
    // Index chunks by their section for cross-referencing
    if (chunk.section) {
      const sectionNum = chunk.section.match(/\d+(?:\.\d+)*/)?.[0];
      if (sectionNum) {
        if (!sectionChunks.has(sectionNum)) sectionChunks.set(sectionNum, []);
        sectionChunks.get(sectionNum)!.push(`${contractId}:${chunk.index}`);
      }
    }

    // Find cross-references in chunk text
    let match;
    while ((match = sectionPattern.exec(chunk.text)) !== null) {
      const refSection = match[1]!;
      const targetChunkIds = sectionChunks.get(refSection);
      if (targetChunkIds) {
        for (const targetId of targetChunkIds) {
          graph.addEdge({
            sourceId: `${contractId}:${chunk.index}`,
            targetId,
            type: 'CROSS_REFERENCE',
            weight: 0.7,
            metadata: `references Section ${refSection}`,
          });
        }
      }
    }
  }

  // Build LEGAL_RELATED edges (chunks about related legal concepts)
  const chunkConcepts = new Map<string, Set<string>>(); // chunkId → concept groups

  for (const chunk of chunks) {
    const chunkId = `${contractId}:${chunk.index}`;
    const concepts = new Set<string>();
    const textLower = chunk.text.toLowerCase();

    for (const [term, group] of TERM_TO_GROUP) {
      if (textLower.includes(term)) {
        concepts.add(group);
      }
    }

    if (concepts.size > 0) {
      chunkConcepts.set(chunkId, concepts);
    }
  }

  // Connect chunks that share related legal concepts
  const chunkIds = Array.from(chunkConcepts.keys());
  for (let i = 0; i < chunkIds.length; i++) {
    for (let j = i + 1; j < chunkIds.length; j++) {
      const conceptsA = chunkConcepts.get(chunkIds[i]!)!;
      const conceptsB = chunkConcepts.get(chunkIds[j]!)!;

      // Find shared concept groups
      const shared = new Set<string>();
      for (const c of conceptsA) {
        if (conceptsB.has(c)) shared.add(c);
      }

      // Also check for related concept groups (e.g., termination ↔ liability)
      const RELATED_CONCEPTS: Record<string, string[]> = {
        termination: ['liability', 'force_majeure', 'payment'],
        liability: ['indemnification', 'warranties', 'termination'],
        indemnification: ['liability', 'warranties'],
        confidentiality: ['ip', 'data_protection'],
        payment: ['termination', 'warranties'],
        ip: ['confidentiality', 'warranties'],
        compliance: ['data_protection', 'warranties'],
        warranties: ['liability', 'indemnification'],
        force_majeure: ['termination', 'liability'],
        data_protection: ['confidentiality', 'compliance'],
      };

      let hasRelated = false;
      for (const groupA of conceptsA) {
        const relatedGroups = RELATED_CONCEPTS[groupA] || [];
        for (const groupB of conceptsB) {
          if (relatedGroups.includes(groupB)) {
            hasRelated = true;
            break;
          }
        }
        if (hasRelated) break;
      }

      if (shared.size > 0 || hasRelated) {
        const weight = shared.size > 0 ? 0.6 : 0.4;
        graph.addEdge({
          sourceId: chunkIds[i]!,
          targetId: chunkIds[j]!,
          type: 'LEGAL_RELATED',
          weight,
          metadata: shared.size > 0
            ? `shared concepts: ${Array.from(shared).join(', ')}`
            : 'related legal concepts',
        });
      }
    }
  }

  // Build SEMANTIC_SIBLING edges (high cosine similarity between different sections)
  if (chunks.some(c => c.embedding)) {
    const embeddingChunks = chunks.filter(c => c.embedding);

    for (let i = 0; i < embeddingChunks.length; i++) {
      for (let j = i + 1; j < embeddingChunks.length; j++) {
        const a = embeddingChunks[i]!;
        const b = embeddingChunks[j]!;

        // Only connect chunks from DIFFERENT sections
        if (a.section === b.section) continue;

        if (a.embedding && b.embedding) {
          const sim = quickCosineSim(a.embedding, b.embedding);
          if (sim >= 0.85) { // High threshold — truly semantically similar
            graph.addEdge({
              sourceId: `${contractId}:${a.index}`,
              targetId: `${contractId}:${b.index}`,
              type: 'SEMANTIC_SIBLING',
              weight: sim * 0.5, // Scale down so other signals aren't overwhelmed
            });
          }
        }
      }
    }
  }
}

/**
 * Given search results, find related chunks via graph traversal.
 * This augments the search results with semantically related content.
 */
export function expandWithGraphContext(
  graph: ChunkGraph,
  searchResults: SearchResult[],
  options?: Partial<GraphTraversalOptions>,
): SearchResult[] {
  // Map search results to chunk IDs
  const seedIds = searchResults
    .map(r => `${r.contractId}:${r.section || 'unknown'}`)
    .filter(id => graph.getNode(id) !== undefined);

  // Also try matching by chunk text prefix
  for (const result of searchResults) {
    // Try to find the node by contractId and matching text
    const contractPrefix = `${result.contractId}:`;
    for (const [nodeId, node] of getNodeEntries(graph)) {
      if (nodeId.startsWith(contractPrefix) && 
          node.chunkText.slice(0, 80) === result.chunkText.slice(0, 80)) {
        if (!seedIds.includes(nodeId)) seedIds.push(nodeId);
        break;
      }
    }
  }

  if (seedIds.length === 0) return searchResults;

  const related = graph.traverse(seedIds, options);

  // Convert related chunks to SearchResult format
  const relatedResults: SearchResult[] = related.map(r => ({
    contractId: r.chunk.contractId,
    chunkText: r.chunk.chunkText,
    section: r.chunk.section,
    similarity: r.weight * 0.5, // Reduced score since these are supplementary
    matchType: 'graph_expansion' as const,
  }));

  // Append graph-expanded results, deduplicating
  const existingTexts = new Set(searchResults.map(r => r.chunkText.slice(0, 80)));
  const newResults = relatedResults.filter(
    r => !existingTexts.has(r.chunkText.slice(0, 80))
  );

  return [...searchResults, ...newResults];
}

// ============================================================================
// Helpers
// ============================================================================

/** Fast cosine similarity for graph building */
function quickCosineSim(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/** Helper to iterate over graph nodes (workaround for private field) */
function getNodeEntries(graph: ChunkGraph): Map<string, ChunkNode> {
  // The graph exposes getNode but not iteration — use the public API
  return (graph as unknown as { nodes: Map<string, ChunkNode> }).nodes;
}

// ============================================================================
// Singleton Graph Instance 
// ============================================================================

let graphInstance: ChunkGraph | null = null;

export function getChunkGraph(): ChunkGraph {
  if (!graphInstance) {
    graphInstance = new ChunkGraph();
  }
  return graphInstance;
}

export function resetChunkGraph(): void {
  graphInstance = null;
}

export { ChunkGraph, ChunkNode, ChunkEdge, EdgeType, GraphTraversalOptions, RelatedChunk };
export { LEGAL_CONCEPT_GROUPS };

export default {
  buildContractGraph,
  expandWithGraphContext,
  getChunkGraph,
  resetChunkGraph,
  LEGAL_CONCEPT_GROUPS,
};
