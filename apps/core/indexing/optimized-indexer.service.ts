/**
 * Optimized Indexing Service
 * High-performance indexing with parallel processing, incremental updates, and smart caching
 */

import { EventEmitter } from 'events';
import { performanceMonitor } from '../performance/performance-monitor';
import { cacheService } from '../cache/redis-cache.service';
import { BatchProcessor } from '../performance/batch-processor';

interface IndexDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
  timestamp: number;
}

interface IndexResult {
  documentId: string;
  indexed: boolean;
  indexTime: number;
  indices: string[];
  error?: string;
}

interface SearchOptions {
  limit?: number;
  offset?: number;
  filters?: Record<string, any>;
  sort?: { field: string; order: 'asc' | 'desc' };
  highlight?: boolean;
}

export class OptimizedIndexerService extends EventEmitter {
  private indexQueue: IndexDocument[] = [];
  private batchProcessor: BatchProcessor<IndexDocument, IndexResult>;
  private indexCache = new Map<string, any>();
  private incrementalIndexing = true;
  private maxBatchSize = 100;

  constructor() {
    super();

    // Initialize batch processor for indexing
    this.batchProcessor = new BatchProcessor(
      (docs) => this.batchIndex(docs),
      {
        maxBatchSize: this.maxBatchSize,
        maxWaitTime: 100, // 100ms batching window
        concurrency: 5,
      }
    );

    // Start background optimization
    this.startBackgroundOptimization();
  }

  /**
   * Index document with optimization
   */
  async indexDocument(document: IndexDocument): Promise<IndexResult> {
    return performanceMonitor.measure('indexing:document', async () => {
      // Check if document already indexed (incremental)
      if (this.incrementalIndexing) {
        const cached = await this.getIndexedDocument(document.id);
        if (cached && cached.timestamp >= document.timestamp) {
          return {
            documentId: document.id,
            indexed: true,
            indexTime: 0,
            indices: ['cached'],
          };
        }
      }

      // Add to batch processor
      const result = await this.batchProcessor.add(document);
      
      // Cache result
      await this.cacheIndexResult(document.id, result);

      return result;
    });
  }

  /**
   * Batch index multiple documents
   */
  private async batchIndex(documents: IndexDocument[]): Promise<IndexResult[]> {
    return performanceMonitor.measure('indexing:batch', async () => {
      const startTime = Date.now();

      // Parallel indexing across different indices
      const results = await Promise.all(
        documents.map(async (doc) => {
          try {
            // Index in parallel: full-text, vector, metadata
            const [textIndex, vectorIndex, metadataIndex] = await Promise.all([
              this.indexFullText(doc),
              this.indexVector(doc),
              this.indexMetadata(doc),
            ]);

            const indexTime = Date.now() - startTime;

            return {
              documentId: doc.id,
              indexed: true,
              indexTime,
              indices: ['text', 'vector', 'metadata'],
            };
          } catch (error) {
            return {
              documentId: doc.id,
              indexed: false,
              indexTime: Date.now() - startTime,
              indices: [],
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        })
      );

      this.emit('batch:indexed', {
        count: documents.length,
        successful: results.filter(r => r.indexed).length,
        totalTime: Date.now() - startTime,
      });

      return results;
    });
  }

  /**
   * Incremental index update
   */
  async updateIndex(documentId: string, updates: Partial<IndexDocument>): Promise<IndexResult> {
    return performanceMonitor.measure('indexing:update', async () => {
      // Get existing document
      const existing = await this.getIndexedDocument(documentId);
      if (!existing) {
        throw new Error('Document not found in index');
      }

      // Merge updates
      const updated = {
        ...existing,
        ...updates,
        timestamp: Date.now(),
      };

      // Re-index only changed fields
      const changedIndices: string[] = [];

      if (updates.content) {
        await Promise.all([
          this.indexFullText(updated),
          this.indexVector(updated),
        ]);
        changedIndices.push('text', 'vector');
      }

      if (updates.metadata) {
        await this.indexMetadata(updated);
        changedIndices.push('metadata');
      }

      // Update cache
      await this.cacheIndexResult(documentId, {
        documentId,
        indexed: true,
        indexTime: 0,
        indices: changedIndices,
      });

      return {
        documentId,
        indexed: true,
        indexTime: 0,
        indices: changedIndices,
      };
    });
  }

  /**
   * Search with caching and optimization
   */
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<{ results: any[]; total: number; searchTime: number }> {
    return performanceMonitor.measure('indexing:search', async () => {
      const startTime = Date.now();

      // Check cache
      const cacheKey = `search:${query}:${JSON.stringify(options)}`;
      const cached = await cacheService.get<any>(cacheKey);
      if (cached) {
        return {
          ...cached,
          searchTime: Date.now() - startTime,
        };
      }

      // Execute search across indices
      const [textResults, vectorResults] = await Promise.all([
        this.searchFullText(query, options),
        this.searchVector(query, options),
      ]);

      // Merge and rank results
      const mergedResults = this.mergeResults(textResults, vectorResults);

      // Apply filters and pagination
      const filteredResults = this.applyFilters(mergedResults, options.filters);
      const paginatedResults = this.paginate(
        filteredResults,
        options.offset || 0,
        options.limit || 20
      );

      const searchTime = Date.now() - startTime;

      const result = {
        results: paginatedResults,
        total: filteredResults.length,
        searchTime,
      };

      // Cache results
      await cacheService.set(cacheKey, result, { ttl: 300 }); // 5 minutes

      return result;
    });
  }

  /**
   * Bulk delete from index
   */
  async deleteDocuments(documentIds: string[]): Promise<number> {
    return performanceMonitor.measure('indexing:delete', async () => {
      let deleted = 0;

      // Batch delete
      const batchSize = 100;
      for (let i = 0; i < documentIds.length; i += batchSize) {
        const batch = documentIds.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (id) => {
            try {
              await this.deleteFromAllIndices(id);
              await cacheService.del(`index:doc:${id}`);
              deleted++;
            } catch (error) {
              // Log error but continue
            }
          })
        );
      }

      return deleted;
    });
  }

  /**
   * Optimize indices (background task)
   */
  async optimizeIndices(): Promise<void> {
    return performanceMonitor.measure('indexing:optimize', async () => {
      // Compact indices
      await this.compactIndices();

      // Rebuild statistics
      await this.rebuildStatistics();

      // Clear stale cache entries
      await this.clearStaleCache();

      this.emit('indices:optimized');
    });
  }

  /**
   * Get indexing statistics
   */
  getStats() {
    return {
      queueSize: this.indexQueue.length,
      cacheSize: this.indexCache.size,
      batchProcessor: this.batchProcessor.getStats(),
    };
  }

  /**
   * Private indexing methods
   */
  private async indexFullText(document: IndexDocument): Promise<void> {
    // Simulate full-text indexing
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // In production, this would index to Elasticsearch/PostgreSQL FTS
    this.indexCache.set(`text:${document.id}`, {
      content: document.content,
      tokens: document.content.toLowerCase().split(/\s+/),
    });
  }

  private async indexVector(document: IndexDocument): Promise<void> {
    // Simulate vector embedding generation
    await new Promise(resolve => setTimeout(resolve, 20));
    
    // In production, this would generate embeddings via OpenAI/Cohere
    // and store in pgvector
    this.indexCache.set(`vector:${document.id}`, {
      embedding: new Array(1536).fill(0), // Simulated embedding
    });
  }

  private async indexMetadata(document: IndexDocument): Promise<void> {
    // Simulate metadata indexing
    await new Promise(resolve => setTimeout(resolve, 5));
    
    this.indexCache.set(`metadata:${document.id}`, document.metadata);
  }

  private async searchFullText(query: string, options: SearchOptions): Promise<any[]> {
    // Simulate full-text search
    await new Promise(resolve => setTimeout(resolve, 15));
    
    const results: any[] = [];
    const queryTokens = query.toLowerCase().split(/\s+/);

    for (const [key, value] of this.indexCache.entries()) {
      if (key.startsWith('text:')) {
        const tokens = value.tokens || [];
        const score = queryTokens.filter((t: string) => tokens.includes(t)).length;
        
        if (score > 0) {
          results.push({
            id: key.replace('text:', ''),
            score,
            type: 'text',
          });
        }
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  private async searchVector(query: string, options: SearchOptions): Promise<any[]> {
    // Simulate vector search
    await new Promise(resolve => setTimeout(resolve, 25));
    
    // In production, this would do cosine similarity search in pgvector
    return [];
  }

  private mergeResults(textResults: any[], vectorResults: any[]): any[] {
    const merged = new Map<string, any>();

    // Combine scores from different indices
    textResults.forEach(result => {
      merged.set(result.id, {
        id: result.id,
        textScore: result.score,
        vectorScore: 0,
        totalScore: result.score,
      });
    });

    vectorResults.forEach(result => {
      const existing = merged.get(result.id);
      if (existing) {
        existing.vectorScore = result.score;
        existing.totalScore += result.score;
      } else {
        merged.set(result.id, {
          id: result.id,
          textScore: 0,
          vectorScore: result.score,
          totalScore: result.score,
        });
      }
    });

    return Array.from(merged.values()).sort((a, b) => b.totalScore - a.totalScore);
  }

  private applyFilters(results: any[], filters?: Record<string, any>): any[] {
    if (!filters) return results;

    return results.filter(result => {
      for (const [key, value] of Object.entries(filters)) {
        const metadata = this.indexCache.get(`metadata:${result.id}`);
        if (!metadata || metadata[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  private paginate(results: any[], offset: number, limit: number): any[] {
    return results.slice(offset, offset + limit);
  }

  private async getIndexedDocument(documentId: string): Promise<IndexDocument | null> {
    const cached = await cacheService.get<IndexDocument>(`index:doc:${documentId}`);
    return cached;
  }

  private async cacheIndexResult(documentId: string, result: IndexResult): Promise<void> {
    await cacheService.set(`index:doc:${documentId}`, result, { ttl: 3600 });
  }

  private async deleteFromAllIndices(documentId: string): Promise<void> {
    this.indexCache.delete(`text:${documentId}`);
    this.indexCache.delete(`vector:${documentId}`);
    this.indexCache.delete(`metadata:${documentId}`);
  }

  private async compactIndices(): Promise<void> {
    // Simulate index compaction
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async rebuildStatistics(): Promise<void> {
    // Simulate statistics rebuild
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private async clearStaleCache(): Promise<void> {
    // Clear cache entries older than 1 hour
    const oneHourAgo = Date.now() - 3600000;
    
    for (const [key, value] of this.indexCache.entries()) {
      if (value.timestamp && value.timestamp < oneHourAgo) {
        this.indexCache.delete(key);
      }
    }
  }

  private startBackgroundOptimization(): void {
    // Run optimization every 30 minutes
    setInterval(() => {
      this.optimizeIndices().catch(error => {
        this.emit('optimization:error', error);
      });
    }, 30 * 60 * 1000);
  }
}

export const optimizedIndexerService = new OptimizedIndexerService();
