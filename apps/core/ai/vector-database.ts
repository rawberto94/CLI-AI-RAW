/**
 * Advanced Vector Database with Semantic Search
 * Multi-modal embeddings and RAG implementation
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

export interface VectorDocument {
  id: string;
  tenantId: string;
  content: string;
  embeddings: {
    text: number[];
    semantic: number[];
    multiModal?: number[];
  };
  metadata: {
    type: 'contract' | 'clause' | 'entity' | 'relationship';
    source: string;
    timestamp: Date;
    tags: string[];
    properties: Record<string, any>;
  };
  chunks?: VectorChunk[];
}

export interface VectorChunk {
  id: string;
  content: string;
  embeddings: number[];
  position: {
    start: number;
    end: number;
    page?: number;
  };
  metadata: Record<string, any>;
}

export interface SearchQuery {
  vector?: number[];
  text?: string;
  filters?: {
    tenantId?: string;
    type?: string;
    tags?: string[];
    dateRange?: { start: Date; end: Date };
    properties?: Record<string, any>;
  };
  limit?: number;
  threshold?: number;
  includeMetadata?: boolean;
  includeContent?: boolean;
}

export interface SearchResult {
  id: string;
  score: number;
  document: VectorDocument;
  matchedChunks?: Array<{
    chunk: VectorChunk;
    score: number;
  }>;
  explanation?: string;
}

export interface EmbeddingModel {
  name: string;
  dimensions: number;
  encode(text: string): Promise<number[]>;
  encodeMultiModal?(content: { text?: string; image?: Buffer; table?: any }): Promise<number[]>;
}

// Mock embedding models
export class TextEmbeddingModel implements EmbeddingModel {
  name = 'text-embedding-ada-002';
  dimensions = 1536;

  async encode(text: string): Promise<number[]> {
    // Simulate OpenAI embedding API call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Generate deterministic embeddings based on text content
    const hash = crypto.createHash('sha256').update(text).digest();
    const embeddings: number[] = [];
    
    for (let i = 0; i < this.dimensions; i++) {
      const value = (hash[i % hash.length] / 255) * 2 - 1; // Normalize to [-1, 1]
      embeddings.push(value + (Math.random() - 0.5) * 0.1); // Add small noise
    }
    
    return this.normalizeVector(embeddings);
  }

  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return vector.map(val => val / magnitude);
  }
}

export class SemanticEmbeddingModel implements EmbeddingModel {
  name = 'sentence-transformers/all-MiniLM-L6-v2';
  dimensions = 384;

  async encode(text: string): Promise<number[]> {
    // Simulate sentence transformer embedding
    await new Promise(resolve => setTimeout(resolve, 80));
    
    const words = text.toLowerCase().split(/\s+/).slice(0, 50);
    const embeddings: number[] = [];
    
    for (let i = 0; i < this.dimensions; i++) {
      let value = 0;
      words.forEach((word, idx) => {
        const charCode = word.charCodeAt(idx % word.length) || 65;
        value += Math.sin((charCode + i) * 0.1) * Math.cos((idx + i) * 0.05);
      });
      embeddings.push(value / words.length);
    }
    
    return this.normalizeVector(embeddings);
  }

  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return vector.map(val => val / magnitude);
  }
}

export class MultiModalEmbeddingModel implements EmbeddingModel {
  name = 'clip-vit-base-patch32';
  dimensions = 512;

  async encode(text: string): Promise<number[]> {
    return this.encodeMultiModal({ text });
  }

  async encodeMultiModal(content: { text?: string; image?: Buffer; table?: any }): Promise<number[]> {
    // Simulate CLIP-style multi-modal embedding
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const embeddings: number[] = [];
    
    for (let i = 0; i < this.dimensions; i++) {
      let value = 0;
      
      // Text component
      if (content.text) {
        const textHash = crypto.createHash('md5').update(content.text).digest();
        value += (textHash[i % textHash.length] / 255) * 0.6;
      }
      
      // Image component
      if (content.image) {
        const imageHash = crypto.createHash('md5').update(content.image).digest();
        value += (imageHash[i % imageHash.length] / 255) * 0.3;
      }
      
      // Table component
      if (content.table) {
        const tableStr = JSON.stringify(content.table);
        const tableHash = crypto.createHash('md5').update(tableStr).digest();
        value += (tableHash[i % tableHash.length] / 255) * 0.1;
      }
      
      embeddings.push(value);
    }
    
    return this.normalizeVector(embeddings);
  }

  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return vector.map(val => val / magnitude);
  }
}

// Vector Database Implementation
export class VectorDatabase extends EventEmitter {
  private documents = new Map<string, VectorDocument>();
  private indexes = new Map<string, Map<string, Set<string>>>(); // field -> value -> document IDs
  private textModel: TextEmbeddingModel;
  private semanticModel: SemanticEmbeddingModel;
  private multiModalModel: MultiModalEmbeddingModel;

  constructor() {
    super();
    this.textModel = new TextEmbeddingModel();
    this.semanticModel = new SemanticEmbeddingModel();
    this.multiModalModel = new MultiModalEmbeddingModel();
    this.setupIndexes();
  }

  private setupIndexes(): void {
    this.indexes.set('tenantId', new Map());
    this.indexes.set('type', new Map());
    this.indexes.set('tags', new Map());
  }

  async upsertDocument(document: Omit<VectorDocument, 'embeddings'>): Promise<void> {
    try {
      // Generate embeddings
      const [textEmbeddings, semanticEmbeddings] = await Promise.all([
        this.textModel.encode(document.content),
        this.semanticModel.encode(document.content)
      ]);

      const vectorDoc: VectorDocument = {
        ...document,
        embeddings: {
          text: textEmbeddings,
          semantic: semanticEmbeddings
        }
      };

      // Generate chunk embeddings if content is large
      if (document.content.length > 1000) {
        vectorDoc.chunks = await this.generateChunks(document.content);
      }

      // Store document
      this.documents.set(document.id, vectorDoc);
      
      // Update indexes
      this.updateIndexes(vectorDoc);
      
      this.emit('document:upserted', { id: document.id, tenantId: document.tenantId });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    try {
      let candidateIds = new Set<string>();
      
      // Apply filters first
      if (query.filters) {
        candidateIds = this.applyFilters(query.filters);
      } else {
        candidateIds = new Set(this.documents.keys());
      }

      let results: SearchResult[] = [];

      if (query.vector) {
        // Vector similarity search
        results = await this.vectorSearch(query.vector, candidateIds, query.threshold || 0.7);
      } else if (query.text) {
        // Text-based search with embedding
        const queryEmbedding = await this.semanticModel.encode(query.text);
        results = await this.vectorSearch(queryEmbedding, candidateIds, query.threshold || 0.7);
      }

      // Sort by score and limit
      results.sort((a, b) => b.score - a.score);
      if (query.limit) {
        results = results.slice(0, query.limit);
      }

      // Include/exclude content based on query options
      if (!query.includeContent) {
        results.forEach(result => {
          delete (result.document as any).content;
          if (result.document.chunks) {
            result.document.chunks.forEach(chunk => delete (chunk as any).content);
          }
        });
      }

      this.emit('search:completed', {
        query: query.text || 'vector_search',
        resultCount: results.length,
        candidateCount: candidateIds.size
      });

      return results;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async hybridSearch(
    textQuery: string,
    vectorQuery?: number[],
    filters?: SearchQuery['filters'],
    options: {
      textWeight?: number;
      vectorWeight?: number;
      limit?: number;
      threshold?: number;
    } = {}
  ): Promise<SearchResult[]> {
    const { textWeight = 0.3, vectorWeight = 0.7, limit = 10, threshold = 0.5 } = options;

    // Perform both searches
    const [textResults, vectorResults] = await Promise.all([
      this.search({ text: textQuery, filters, limit: limit * 2 }),
      vectorQuery ? this.search({ vector: vectorQuery, filters, limit: limit * 2 }) : []
    ]);

    // Combine and re-rank results
    const combinedResults = new Map<string, SearchResult>();

    textResults.forEach(result => {
      combinedResults.set(result.id, {
        ...result,
        score: result.score * textWeight
      });
    });

    vectorResults.forEach(result => {
      const existing = combinedResults.get(result.id);
      if (existing) {
        existing.score += result.score * vectorWeight;
      } else {
        combinedResults.set(result.id, {
          ...result,
          score: result.score * vectorWeight
        });
      }
    });

    return Array.from(combinedResults.values())
      .filter(result => result.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async getRecommendations(
    documentId: string,
    limit = 5,
    excludeSameTenant = false
  ): Promise<SearchResult[]> {
    const document = this.documents.get(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    const filters: SearchQuery['filters'] = {};
    if (excludeSameTenant) {
      // This would need more complex filtering logic
    }

    return this.search({
      vector: document.embeddings.semantic,
      filters,
      limit: limit + 1 // +1 to exclude the source document
    }).then(results => 
      results.filter(result => result.id !== documentId).slice(0, limit)
    );
  }

  private async generateChunks(content: string): Promise<VectorChunk[]> {
    const chunkSize = 500; // characters
    const overlap = 50; // character overlap between chunks
    const chunks: VectorChunk[] = [];

    for (let i = 0; i < content.length; i += chunkSize - overlap) {
      const chunkContent = content.slice(i, i + chunkSize);
      const chunkEmbedding = await this.semanticModel.encode(chunkContent);

      chunks.push({
        id: crypto.randomUUID(),
        content: chunkContent,
        embeddings: chunkEmbedding,
        position: {
          start: i,
          end: Math.min(i + chunkSize, content.length)
        },
        metadata: {
          chunkIndex: chunks.length,
          wordCount: chunkContent.split(/\s+/).length
        }
      });
    }

    return chunks;
  }

  private applyFilters(filters: SearchQuery['filters']): Set<string> {
    let candidateIds = new Set<string>();
    let firstFilter = true;

    if (filters.tenantId) {
      const tenantIndex = this.indexes.get('tenantId')!;
      const ids = tenantIndex.get(filters.tenantId) || new Set();
      candidateIds = firstFilter ? new Set(ids) : this.intersect(candidateIds, ids);
      firstFilter = false;
    }

    if (filters.type) {
      const typeIndex = this.indexes.get('type')!;
      const ids = typeIndex.get(filters.type) || new Set();
      candidateIds = firstFilter ? new Set(ids) : this.intersect(candidateIds, ids);
      firstFilter = false;
    }

    if (filters.tags && filters.tags.length > 0) {
      const tagIndex = this.indexes.get('tags')!;
      let tagIds = new Set<string>();
      
      filters.tags.forEach(tag => {
        const ids = tagIndex.get(tag) || new Set();
        tagIds = tagIds.size === 0 ? new Set(ids) : this.union(tagIds, ids);
      });
      
      candidateIds = firstFilter ? tagIds : this.intersect(candidateIds, tagIds);
      firstFilter = false;
    }

    if (filters.dateRange) {
      const dateFilteredIds = new Set<string>();
      for (const [id, doc] of this.documents.entries()) {
        if (doc.metadata.timestamp >= filters.dateRange.start && 
            doc.metadata.timestamp <= filters.dateRange.end) {
          dateFilteredIds.add(id);
        }
      }
      candidateIds = firstFilter ? dateFilteredIds : this.intersect(candidateIds, dateFilteredIds);
    }

    return candidateIds;
  }

  private async vectorSearch(
    queryVector: number[],
    candidateIds: Set<string>,
    threshold: number
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    for (const id of candidateIds) {
      const document = this.documents.get(id)!;
      
      // Calculate similarity with main document embedding
      const similarity = this.cosineSimilarity(queryVector, document.embeddings.semantic);
      
      if (similarity >= threshold) {
        const result: SearchResult = {
          id,
          score: similarity,
          document
        };

        // Check chunk-level matches if available
        if (document.chunks) {
          const chunkMatches = document.chunks
            .map(chunk => ({
              chunk,
              score: this.cosineSimilarity(queryVector, chunk.embeddings)
            }))
            .filter(match => match.score >= threshold)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3); // Top 3 matching chunks

          if (chunkMatches.length > 0) {
            result.matchedChunks = chunkMatches;
            // Boost score based on best chunk match
            result.score = Math.max(result.score, chunkMatches[0].score * 0.9);
          }
        }

        results.push(result);
      }
    }

    return results;
  }

  private updateIndexes(document: VectorDocument): void {
    // Update tenant index
    const tenantIndex = this.indexes.get('tenantId')!;
    if (!tenantIndex.has(document.tenantId)) {
      tenantIndex.set(document.tenantId, new Set());
    }
    tenantIndex.get(document.tenantId)!.add(document.id);

    // Update type index
    const typeIndex = this.indexes.get('type')!;
    if (!typeIndex.has(document.metadata.type)) {
      typeIndex.set(document.metadata.type, new Set());
    }
    typeIndex.get(document.metadata.type)!.add(document.id);

    // Update tag index
    const tagIndex = this.indexes.get('tags')!;
    document.metadata.tags.forEach(tag => {
      if (!tagIndex.has(tag)) {
        tagIndex.set(tag, new Set());
      }
      tagIndex.get(tag)!.add(document.id);
    });
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }

    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    
    return dotProduct / (magnitudeA * magnitudeB);
  }

  private intersect<T>(setA: Set<T>, setB: Set<T>): Set<T> {
    return new Set([...setA].filter(x => setB.has(x)));
  }

  private union<T>(setA: Set<T>, setB: Set<T>): Set<T> {
    return new Set([...setA, ...setB]);
  }

  // Analytics and monitoring
  getStats(): {
    totalDocuments: number;
    documentsByType: Record<string, number>;
    documentsByTenant: Record<string, number>;
    averageEmbeddingDimensions: number;
    indexSizes: Record<string, number>;
  } {
    const stats = {
      totalDocuments: this.documents.size,
      documentsByType: {} as Record<string, number>,
      documentsByTenant: {} as Record<string, number>,
      averageEmbeddingDimensions: 0,
      indexSizes: {} as Record<string, number>
    };

    let totalDimensions = 0;
    for (const doc of this.documents.values()) {
      // Count by type
      stats.documentsByType[doc.metadata.type] = 
        (stats.documentsByType[doc.metadata.type] || 0) + 1;
      
      // Count by tenant
      stats.documentsByTenant[doc.tenantId] = 
        (stats.documentsByTenant[doc.tenantId] || 0) + 1;
      
      // Sum dimensions
      totalDimensions += doc.embeddings.semantic.length;
    }

    stats.averageEmbeddingDimensions = this.documents.size > 0 
      ? totalDimensions / this.documents.size 
      : 0;

    // Index sizes
    for (const [indexName, index] of this.indexes.entries()) {
      stats.indexSizes[indexName] = index.size;
    }

    return stats;
  }
}

// Export singleton vector database
export const vectorDatabase = new VectorDatabase();