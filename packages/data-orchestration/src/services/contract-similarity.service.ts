/**
 * Contract Similarity & Embedding Service
 * 
 * Uses vector embeddings to:
 * - Find similar contracts for comparison
 * - Suggest extraction templates based on past successes
 * - Power intelligent recommendations
 * - Enable "extract like this contract" functionality
 * 
 * @version 1.0.0
 */

import { createLogger } from '../utils/logger';
import { cacheAdaptor } from '../dal/cache.adaptor';
import OpenAI from 'openai';

const logger = createLogger('contract-similarity');

// =============================================================================
// TYPES
// =============================================================================

export interface ContractEmbedding {
  contractId: string;
  tenantId: string;
  embedding: number[];
  metadata: ContractMetadata;
  createdAt: Date;
  version: number;
}

export interface ContractMetadata {
  title?: string;
  type?: string;
  subType?: string;
  partyCount?: number;
  valueRange?: 'low' | 'medium' | 'high';
  complexity?: 'simple' | 'moderate' | 'complex';
  industry?: string;
  language?: string;
  wordCount?: number;
  sections?: string[];
  keywords?: string[];
  extractionQuality?: number;
}

export interface SimilarContract {
  contractId: string;
  similarity: number;
  metadata: ContractMetadata;
  matchReasons: string[];
}

export interface SimilaritySearchOptions {
  tenantId: string;
  topK?: number;
  minSimilarity?: number;
  typeFilter?: string;
  industryFilter?: string;
  excludeContractIds?: string[];
}

export interface EmbeddingBatch {
  contracts: Array<{
    id: string;
    text: string;
    metadata: ContractMetadata;
  }>;
  tenantId: string;
}

export interface RecommendedTemplate {
  templateName: string;
  sourceContractId: string;
  similarity: number;
  successRate: number;
  applicableFields: string[];
}

// =============================================================================
// EMBEDDING CONFIGURATION
// =============================================================================

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const CACHE_TTL = 86400 * 7; // 7 days

// =============================================================================
// CONTRACT SIMILARITY SERVICE
// =============================================================================

export class ContractSimilarityService {
  private static instance: ContractSimilarityService;
  private openai: OpenAI | null = null;
  private embeddingStore: Map<string, ContractEmbedding> = new Map();

  private constructor() {
    this.initializeClient();
    this.loadEmbeddingsFromCache();
  }

  static getInstance(): ContractSimilarityService {
    if (!ContractSimilarityService.instance) {
      ContractSimilarityService.instance = new ContractSimilarityService();
    }
    return ContractSimilarityService.instance;
  }

  private initializeClient(): void {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  // ===========================================================================
  // EMBEDDING GENERATION
  // ===========================================================================

  async generateEmbedding(
    contractId: string,
    contractText: string,
    metadata: ContractMetadata,
    tenantId: string
  ): Promise<ContractEmbedding> {
    logger.info({ contractId }, 'Generating embedding');

    // Check cache first
    const cacheKey = `embedding:${contractId}`;
    const cached = await cacheAdaptor.get<ContractEmbedding>(cacheKey);
    if (cached) {
      this.embeddingStore.set(contractId, cached);
      return cached;
    }

    // Generate embedding
    const embedding = await this.callEmbeddingAPI(contractText);

    const contractEmbedding: ContractEmbedding = {
      contractId,
      tenantId,
      embedding,
      metadata: this.enrichMetadata(metadata, contractText),
      createdAt: new Date(),
      version: 1,
    };

    // Store in memory and cache
    this.embeddingStore.set(contractId, contractEmbedding);
    await cacheAdaptor.set(cacheKey, contractEmbedding, CACHE_TTL);

    logger.info({ contractId }, 'Embedding generated and cached');
    return contractEmbedding;
  }

  async generateBatchEmbeddings(batch: EmbeddingBatch): Promise<ContractEmbedding[]> {
    const results: ContractEmbedding[] = [];
    
    // Process in chunks of 10 to avoid rate limits
    const chunkSize = 10;
    for (let i = 0; i < batch.contracts.length; i += chunkSize) {
      const chunk = batch.contracts.slice(i, i + chunkSize);
      
      const embeddings = await Promise.all(
        chunk.map(c => this.generateEmbedding(c.id, c.text, c.metadata, batch.tenantId))
      );
      
      results.push(...embeddings);
      
      // Small delay between chunks
      if (i + chunkSize < batch.contracts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  private async callEmbeddingAPI(text: string): Promise<number[]> {
    if (!this.openai) {
      // Fallback: Generate pseudo-embedding based on text features
      return this.generateFallbackEmbedding(text);
    }

    // Truncate text to fit token limit
    const maxChars = 8000;
    const truncatedText = text.length > maxChars
      ? text.substring(0, maxChars)
      : text;

    const response = await this.openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: truncatedText,
    });

    return response.data[0].embedding;
  }

  private generateFallbackEmbedding(text: string): number[] {
    // Simple fallback: TF-IDF-like features
    const words = text.toLowerCase().split(/\s+/);
    const wordFreq = new Map<string, number>();
    
    for (const word of words) {
      if (word.length > 2) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    }

    // Generate a deterministic pseudo-embedding
    const embedding: number[] = new Array(EMBEDDING_DIMENSIONS).fill(0);
    let index = 0;
    
    for (const [word, freq] of wordFreq) {
      const hash = this.hashString(word);
      const position = Math.abs(hash) % EMBEDDING_DIMENSIONS;
      embedding[position] += freq / words.length;
      
      if (++index > 500) break;
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (magnitude > 0) {
      return embedding.map(v => v / magnitude);
    }
    
    return embedding;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  // ===========================================================================
  // SIMILARITY SEARCH
  // ===========================================================================

  async findSimilarContracts(
    contractId: string,
    options: SimilaritySearchOptions
  ): Promise<SimilarContract[]> {
    const sourceEmbedding = this.embeddingStore.get(contractId);
    if (!sourceEmbedding) {
      logger.warn({ contractId }, 'Embedding not found for source contract');
      return [];
    }

    return this.findSimilarByEmbedding(sourceEmbedding.embedding, {
      ...options,
      excludeContractIds: [...(options.excludeContractIds || []), contractId],
    });
  }

  async findSimilarByText(
    text: string,
    options: SimilaritySearchOptions
  ): Promise<SimilarContract[]> {
    const embedding = await this.callEmbeddingAPI(text);
    return this.findSimilarByEmbedding(embedding, options);
  }

  async findSimilarByEmbedding(
    queryEmbedding: number[],
    options: SimilaritySearchOptions
  ): Promise<SimilarContract[]> {
    const {
      tenantId,
      topK = 10,
      minSimilarity = 0.5,
      typeFilter,
      industryFilter,
      excludeContractIds = [],
    } = options;

    const candidates: SimilarContract[] = [];

    for (const [id, embedding] of this.embeddingStore) {
      // Filter by tenant
      if (embedding.tenantId !== tenantId) continue;
      
      // Exclude specified contracts
      if (excludeContractIds.includes(id)) continue;
      
      // Apply type filter
      if (typeFilter && embedding.metadata.type !== typeFilter) continue;
      
      // Apply industry filter
      if (industryFilter && embedding.metadata.industry !== industryFilter) continue;

      // Calculate similarity
      const similarity = this.cosineSimilarity(queryEmbedding, embedding.embedding);
      
      if (similarity >= minSimilarity) {
        candidates.push({
          contractId: id,
          similarity,
          metadata: embedding.metadata,
          matchReasons: this.generateMatchReasons(similarity, embedding.metadata),
        });
      }
    }

    // Sort by similarity and return top K
    return candidates
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  private generateMatchReasons(similarity: number, metadata: ContractMetadata): string[] {
    const reasons: string[] = [];

    if (similarity > 0.9) {
      reasons.push('Very high semantic similarity');
    } else if (similarity > 0.8) {
      reasons.push('High semantic similarity');
    } else {
      reasons.push('Moderate semantic similarity');
    }

    if (metadata.type) {
      reasons.push(`Same contract type: ${metadata.type}`);
    }

    if (metadata.industry) {
      reasons.push(`Same industry: ${metadata.industry}`);
    }

    if (metadata.extractionQuality && metadata.extractionQuality > 0.9) {
      reasons.push('High-quality extraction available');
    }

    return reasons;
  }

  // ===========================================================================
  // TEMPLATE RECOMMENDATIONS
  // ===========================================================================

  async recommendTemplates(
    contractText: string,
    tenantId: string
  ): Promise<RecommendedTemplate[]> {
    // Find similar contracts
    const similar = await this.findSimilarByText(contractText, {
      tenantId,
      topK: 5,
      minSimilarity: 0.7,
    });

    const recommendations: RecommendedTemplate[] = [];

    for (const match of similar) {
      // Check if this contract had successful extractions
      const quality = match.metadata.extractionQuality || 0.5;
      
      if (quality >= 0.8) {
        recommendations.push({
          templateName: `Based on ${match.metadata.title || match.contractId}`,
          sourceContractId: match.contractId,
          similarity: match.similarity,
          successRate: quality,
          applicableFields: this.determineApplicableFields(match.metadata),
        });
      }
    }

    return recommendations.sort((a, b) => 
      (b.similarity * b.successRate) - (a.similarity * a.successRate)
    );
  }

  private determineApplicableFields(metadata: ContractMetadata): string[] {
    const baseFields = ['parties', 'effectiveDate', 'termination'];
    
    if (metadata.type === 'SERVICE_AGREEMENT') {
      return [...baseFields, 'serviceScope', 'sla', 'deliverables'];
    }
    
    if (metadata.type === 'PROCUREMENT') {
      return [...baseFields, 'items', 'pricing', 'delivery'];
    }
    
    if (metadata.type === 'EMPLOYMENT') {
      return [...baseFields, 'compensation', 'benefits', 'role'];
    }
    
    return baseFields;
  }

  // ===========================================================================
  // METADATA ENRICHMENT
  // ===========================================================================

  private enrichMetadata(metadata: ContractMetadata, text: string): ContractMetadata {
    const words = text.split(/\s+/);
    
    return {
      ...metadata,
      wordCount: words.length,
      complexity: this.determineComplexity(text),
      keywords: this.extractKeywords(text),
      sections: this.detectSections(text),
    };
  }

  private determineComplexity(text: string): 'simple' | 'moderate' | 'complex' {
    const words = text.split(/\s+/);
    const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
    const sentences = text.split(/[.!?]+/).length;
    const avgSentenceLength = words.length / sentences;

    // Complex if long words and long sentences
    if (avgWordLength > 6 && avgSentenceLength > 25) {
      return 'complex';
    }
    if (avgWordLength > 5 || avgSentenceLength > 20) {
      return 'moderate';
    }
    return 'simple';
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'this', 'that', 'these', 'those',
    ]);

    const words = text.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w));

    const freq = new Map<string, number>();
    for (const word of words) {
      freq.set(word, (freq.get(word) || 0) + 1);
    }

    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word]) => word);
  }

  private detectSections(text: string): string[] {
    const sectionPatterns = [
      /\b(definitions?)\b/i,
      /\b(term and termination)\b/i,
      /\b(payment|compensation)\b/i,
      /\b(confidential|nda)\b/i,
      /\b(indemnification|liability)\b/i,
      /\b(warranty|warranties)\b/i,
      /\b(governing law)\b/i,
      /\b(force majeure)\b/i,
      /\b(intellectual property)\b/i,
      /\b(scope of (work|services))\b/i,
      /\b(representations)\b/i,
      /\b(notices)\b/i,
    ];

    const detected: string[] = [];
    for (const pattern of sectionPatterns) {
      if (pattern.test(text)) {
        const match = text.match(pattern);
        if (match) {
          detected.push(match[1].toLowerCase());
        }
      }
    }

    return [...new Set(detected)];
  }

  // ===========================================================================
  // CACHE MANAGEMENT
  // ===========================================================================

  private async loadEmbeddingsFromCache(): Promise<void> {
    // Note: Embeddings are loaded on-demand, not at startup
    // This avoids needing to iterate all cache keys
    logger.info('Contract similarity service initialized');
  }

  async clearEmbedding(contractId: string): Promise<boolean> {
    this.embeddingStore.delete(contractId);
    await cacheAdaptor.del(`embedding:${contractId}`);
    return true;
  }

  getEmbeddingCount(): number {
    return this.embeddingStore.size;
  }

  // ===========================================================================
  // CLUSTER ANALYSIS (for insights)
  // ===========================================================================

  async getContractClusters(
    tenantId: string,
    numClusters: number = 5
  ): Promise<Array<{
    clusterId: number;
    contracts: string[];
    centroidType?: string;
    commonKeywords: string[];
  }>> {
    // Get all embeddings for tenant
    const tenantEmbeddings = Array.from(this.embeddingStore.values())
      .filter(e => e.tenantId === tenantId);

    if (tenantEmbeddings.length < numClusters) {
      return [{
        clusterId: 0,
        contracts: tenantEmbeddings.map(e => e.contractId),
        commonKeywords: [],
      }];
    }

    // Simple K-means clustering
    const clusters = this.kMeansClustering(tenantEmbeddings, numClusters);
    
    return clusters.map((cluster, i) => ({
      clusterId: i,
      contracts: cluster.map(e => e.contractId),
      centroidType: this.getMostCommonType(cluster),
      commonKeywords: this.getCommonKeywords(cluster),
    }));
  }

  private kMeansClustering(
    embeddings: ContractEmbedding[],
    k: number
  ): ContractEmbedding[][] {
    // Initialize centroids randomly
    const centroids: number[][] = [];
    const indices = new Set<number>();
    while (indices.size < k) {
      indices.add(Math.floor(Math.random() * embeddings.length));
    }
    for (const i of indices) {
      centroids.push([...embeddings[i].embedding]);
    }

    let assignments: number[] = [];
    const maxIterations = 20;

    for (let iter = 0; iter < maxIterations; iter++) {
      // Assign points to nearest centroid
      const newAssignments = embeddings.map(e => {
        let minDist = Infinity;
        let closest = 0;
        for (let c = 0; c < k; c++) {
          const dist = this.euclideanDistance(e.embedding, centroids[c]);
          if (dist < minDist) {
            minDist = dist;
            closest = c;
          }
        }
        return closest;
      });

      // Check for convergence
      if (assignments.length === newAssignments.length &&
          assignments.every((a, i) => a === newAssignments[i])) {
        break;
      }
      assignments = newAssignments;

      // Update centroids
      for (let c = 0; c < k; c++) {
        const clusterPoints = embeddings.filter((_, i) => assignments[i] === c);
        if (clusterPoints.length > 0) {
          centroids[c] = this.computeCentroid(clusterPoints.map(p => p.embedding));
        }
      }
    }

    // Group embeddings by cluster
    const clusters: ContractEmbedding[][] = Array.from({ length: k }, () => []);
    assignments.forEach((cluster, i) => {
      clusters[cluster].push(embeddings[i]);
    });

    return clusters;
  }

  private euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Math.pow(a[i] - b[i], 2);
    }
    return Math.sqrt(sum);
  }

  private computeCentroid(vectors: number[][]): number[] {
    const dim = vectors[0].length;
    const centroid = new Array(dim).fill(0);
    
    for (const vec of vectors) {
      for (let i = 0; i < dim; i++) {
        centroid[i] += vec[i];
      }
    }
    
    return centroid.map(v => v / vectors.length);
  }

  private getMostCommonType(cluster: ContractEmbedding[]): string | undefined {
    const types = cluster.map(e => e.metadata.type).filter(Boolean);
    if (types.length === 0) return undefined;
    
    const freq = new Map<string, number>();
    for (const t of types) {
      freq.set(t!, (freq.get(t!) || 0) + 1);
    }
    
    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])[0][0];
  }

  private getCommonKeywords(cluster: ContractEmbedding[]): string[] {
    const keywordFreq = new Map<string, number>();
    
    for (const embedding of cluster) {
      for (const keyword of embedding.metadata.keywords || []) {
        keywordFreq.set(keyword, (keywordFreq.get(keyword) || 0) + 1);
      }
    }
    
    return Array.from(keywordFreq.entries())
      .filter(([_, count]) => count >= cluster.length * 0.5) // At least 50% of cluster
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword]) => keyword);
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const contractSimilarityService = ContractSimilarityService.getInstance();
