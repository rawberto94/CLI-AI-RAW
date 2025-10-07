/**
 * Vector Similarity Search Service
 * Semantic search using pgvector and OpenAI embeddings
 */

import { prisma } from 'clients-db';
import { Prisma } from '@prisma/client';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface VectorSearchQuery {
  query: string;
  limit?: number;
  threshold?: number;
  filters?: {
    contractType?: string;
    status?: string;
    contractIds?: string[];
  };
}

export interface VectorSearchResult {
  id: string;
  contractId: string;
  chunkText: string;
  similarity: number;
  chunkIndex: number;
  contract?: {
    id: string;
    fileName: string;
    contractType: string | null;
    uploadedAt: Date;
  };
}

export interface VectorSearchResponse {
  results: VectorSearchResult[];
  query: string;
  executionTime: number;
}

export class VectorSearchService {
  private readonly embeddingModel = 'text-embedding-3-small';
  private readonly embeddingDimensions = 1536;

  /**
   * Perform vector similarity search
   */
  async search(searchQuery: VectorSearchQuery): Promise<VectorSearchResponse> {
    const startTime = Date.now();
    const { query, limit = 10, threshold = 0.7, filters } = searchQuery;

    // Generate embedding for the query
    const queryEmbedding = await this.generateEmbedding(query);

    // Build filter conditions
    const filterConditions = this.buildFilterConditions(filters);

    // Perform cosine similarity search using pgvector
    const results = await prisma.$queryRaw<any[]>`
      SELECT 
        ce.id,
        ce."contractId",
        ce."chunkText",
        ce."chunkIndex",
        1 - (ce.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity,
        c."fileName",
        c."contractType",
        c."uploadedAt"
      FROM "ContractEmbedding" ce
      JOIN "Contract" c ON ce."contractId" = c.id
      WHERE 1 - (ce.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) > ${threshold}
        ${filterConditions ? Prisma.sql`AND ${filterConditions}` : Prisma.empty}
      ORDER BY ce.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT ${limit}
    `;

    // Format results
    const formattedResults: VectorSearchResult[] = results.map((row) => ({
      id: row.id,
      contractId: row.contractId,
      chunkText: row.chunkText,
      similarity: parseFloat(row.similarity),
      chunkIndex: row.chunkIndex,
      contract: {
        id: row.contractId,
        fileName: row.fileName,
        contractType: row.contractType,
        uploadedAt: row.uploadedAt,
      },
    }));

    const executionTime = Date.now() - startTime;

    return {
      results: formattedResults,
      query,
      executionTime,
    };
  }

  /**
   * Find similar contracts based on a contract's content
   */
  async findSimilarContracts(
    contractId: string,
    limit: number = 5,
    threshold: number = 0.75
  ): Promise<Array<{ contractId: string; similarity: number; fileName: string }>> {
    // Get embeddings for the source contract
    const sourceEmbeddings = await prisma.contractEmbedding.findMany({
      where: { contractId },
      select: { embedding: true },
    });

    if (sourceEmbeddings.length === 0) {
      return [];
    }

    // Use the first embedding as representative
    const sourceEmbedding = sourceEmbeddings[0].embedding;

    // Find similar contracts
    const results = await prisma.$queryRaw<any[]>`
      SELECT DISTINCT
        c.id as "contractId",
        c."fileName",
        AVG(1 - (ce.embedding <=> ${JSON.stringify(sourceEmbedding)}::vector)) as similarity
      FROM "ContractEmbedding" ce
      JOIN "Contract" c ON ce."contractId" = c.id
      WHERE c.id != ${contractId}
        AND 1 - (ce.embedding <=> ${JSON.stringify(sourceEmbedding)}::vector) > ${threshold}
      GROUP BY c.id, c."fileName"
      ORDER BY similarity DESC
      LIMIT ${limit}
    `;

    return results.map((row) => ({
      contractId: row.contractId,
      fileName: row.fileName,
      similarity: parseFloat(row.similarity),
    }));
  }

  /**
   * Store embeddings for a contract
   */
  async storeEmbeddings(
    contractId: string,
    chunks: string[]
  ): Promise<void> {
    // Generate embeddings for all chunks
    const embeddings = await this.generateEmbeddings(chunks);

    // Store in database
    const data = chunks.map((chunk, index) => ({
      contractId,
      chunkIndex: index,
      chunkText: chunk,
      embedding: embeddings[index],
    }));

    await prisma.contractEmbedding.createMany({
      data,
      skipDuplicates: true,
    });
  }

  /**
   * Update embeddings for a contract
   */
  async updateEmbeddings(
    contractId: string,
    chunks: string[]
  ): Promise<void> {
    // Delete existing embeddings
    await prisma.contractEmbedding.deleteMany({
      where: { contractId },
    });

    // Store new embeddings
    await this.storeEmbeddings(contractId, chunks);
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: this.embeddingModel,
        input: text,
        dimensions: this.embeddingDimensions,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  /**
   * Generate embeddings for multiple texts
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const response = await openai.embeddings.create({
        model: this.embeddingModel,
        input: texts,
        dimensions: this.embeddingDimensions,
      });

      return response.data.map((item) => item.embedding);
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw new Error('Failed to generate embeddings');
    }
  }

  /**
   * Chunk text into smaller pieces for embedding
   */
  chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const chunk = text.slice(start, end);
      
      // Try to break at sentence boundary
      if (end < text.length) {
        const lastPeriod = chunk.lastIndexOf('.');
        const lastNewline = chunk.lastIndexOf('\n');
        const breakPoint = Math.max(lastPeriod, lastNewline);
        
        if (breakPoint > chunkSize * 0.5) {
          chunks.push(chunk.slice(0, breakPoint + 1).trim());
          start += breakPoint + 1;
        } else {
          chunks.push(chunk.trim());
          start = end;
        }
      } else {
        chunks.push(chunk.trim());
        break;
      }

      // Apply overlap
      start = Math.max(start - overlap, start);
    }

    return chunks.filter((chunk) => chunk.length > 50); // Filter out very small chunks
  }

  /**
   * Get embedding statistics for a contract
   */
  async getEmbeddingStats(contractId: string): Promise<{
    totalChunks: number;
    avgChunkLength: number;
    hasEmbeddings: boolean;
  }> {
    const embeddings = await prisma.contractEmbedding.findMany({
      where: { contractId },
      select: { chunkText: true },
    });

    const totalChunks = embeddings.length;
    const avgChunkLength =
      totalChunks > 0
        ? embeddings.reduce((sum, e) => sum + e.chunkText.length, 0) / totalChunks
        : 0;

    return {
      totalChunks,
      avgChunkLength: Math.round(avgChunkLength),
      hasEmbeddings: totalChunks > 0,
    };
  }

  /**
   * Delete embeddings for a contract
   */
  async deleteEmbeddings(contractId: string): Promise<number> {
    const result = await prisma.contractEmbedding.deleteMany({
      where: { contractId },
    });

    return result.count;
  }

  /**
   * Build filter conditions for vector search
   */
  private buildFilterConditions(filters?: VectorSearchQuery['filters']): Prisma.Sql | null {
    if (!filters) return null;

    const conditions: Prisma.Sql[] = [];

    if (filters.contractType) {
      conditions.push(Prisma.sql`c."contractType" = ${filters.contractType}`);
    }

    if (filters.status) {
      conditions.push(Prisma.sql`c.status = ${filters.status}`);
    }

    if (filters.contractIds && filters.contractIds.length > 0) {
      conditions.push(Prisma.sql`c.id = ANY(${filters.contractIds})`);
    }

    if (conditions.length === 0) return null;

    return Prisma.join(conditions, ' AND ');
  }
}

// Export singleton instance
export const vectorSearchService = new VectorSearchService();
