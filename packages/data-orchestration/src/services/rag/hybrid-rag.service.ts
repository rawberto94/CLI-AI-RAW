/**
 * Hybrid RAG Service
 * 
 * Uses:
 * - OpenAI for embeddings (existing API key)
 * - Chroma DB for vector storage (local, free)
 * - LangChain for orchestration
 * - Integrates with existing contract services
 */

import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai'
import { Chroma } from '@langchain/community/vectorstores/chroma'
import { RetrievalQAChain } from 'langchain/chains'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { Document } from 'langchain/document'
import { ContentProcessor } from '../../../../apps/workers/shared/rag-utils'
import pino from 'pino'

const logger = pino({ name: 'hybrid-rag-service' })

export interface RAGQuery {
  query: string
  contractId?: string
  tenantId: string
  userId?: string
  filters?: {
    contractType?: string
    parties?: string[]
    dateRange?: { start: Date; end: Date }
  }
  options?: {
    maxResults?: number
    threshold?: number
    useStreaming?: boolean
  }
}

export interface RAGResponse {
  answer: string
  sources: Array<{
    contractId: string
    title?: string
    excerpt: string
    relevance: number
    metadata?: any
  }>
  confidence: number
  processingTime: number
  model: string
  tokensUsed?: number
}

export interface ContractProcessingResult {
  contractId: string
  chunksCreated: number
  embeddingsGenerated: number
  processingTime: number
  success: boolean
  error?: string
}

export class HybridRAGService {
  private static instance: HybridRAGService
  private embeddings: OpenAIEmbeddings
  private llm: ChatOpenAI
  private vectorStore: Chroma | null = null
  private isInitialized = false

  private constructor() {
    // Initialize OpenAI embeddings (uses existing OPENAI_API_KEY)
    this.embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-3-small', // Cheap: $0.00002 per 1K tokens
      openAIApiKey: process.env.OPENAI_API_KEY
    })

    // Initialize OpenAI LLM for generation
    this.llm = new ChatOpenAI({
      modelName: 'gpt-4-turbo-preview',
      temperature: 0.1,
      openAIApiKey: process.env.OPENAI_API_KEY
    })
  }

  static getInstance(): HybridRAGService {
    if (!HybridRAGService.instance) {
      HybridRAGService.instance = new HybridRAGService()
    }
    return HybridRAGService.instance
  }

  /**
   * Initialize the RAG service and connect to Chroma DB
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      logger.info('Initializing Hybrid RAG Service...')

      const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8000'

      // Try to connect to existing collection or create new one
      try {
        this.vectorStore = await Chroma.fromExistingCollection(
          this.embeddings,
          {
            collectionName: 'contracts',
            url: chromaUrl
          }
        )
        logger.info('Connected to existing Chroma collection')
      } catch (error) {
        // Collection doesn't exist, create it
        logger.info('Creating new Chroma collection')
        this.vectorStore = await Chroma.fromDocuments(
          [], // Empty initially
          this.embeddings,
          {
            collectionName: 'contracts',
            url: chromaUrl
          }
        )
      }

      this.isInitialized = true
      logger.info('Hybrid RAG Service initialized successfully')
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Hybrid RAG Service')
      throw error
    }
  }

  /**
   * Process a contract and store it in the vector database
   * Integrates with existing ContentProcessor from rag-utils.ts
   */
  async processContract(
    contractId: string,
    tenantId: string,
    artifacts: any[]
  ): Promise<ContractProcessingResult> {
    const startTime = Date.now()

    try {
      await this.initialize()

      logger.info({ contractId, tenantId }, 'Processing contract for RAG')

      // Use existing ContentProcessor to extract searchable content
      const searchableContent = ContentProcessor.extractSearchableContent(
        contractId,
        tenantId,
        artifacts
      )

      // Split content into chunks
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
        separators: ['\n\n', '\n', '. ', ' ', '']
      })

      const chunks = await splitter.createDocuments(
        [searchableContent.content],
        [{
          contractId,
          tenantId,
          title: searchableContent.title,
          contractType: searchableContent.metadata.contractType,
          parties: JSON.stringify(searchableContent.metadata.parties),
          riskLevel: searchableContent.metadata.riskLevel,
          totalValue: searchableContent.metadata.totalValue,
          confidenceScore: searchableContent.metadata.confidenceScore
        }]
      )

      // Generate embeddings and store in Chroma
      await this.vectorStore!.addDocuments(chunks)

      const processingTime = Date.now() - startTime

      logger.info({
        contractId,
        chunksCreated: chunks.length,
        processingTime
      }, 'Contract processed successfully')

      return {
        contractId,
        chunksCreated: chunks.length,
        embeddingsGenerated: chunks.length,
        processingTime,
        success: true
      }
    } catch (error) {
      logger.error({ error, contractId }, 'Failed to process contract')
      return {
        contractId,
        chunksCreated: 0,
        embeddingsGenerated: 0,
        processingTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Query the RAG system with natural language
   */
  async query(ragQuery: RAGQuery): Promise<RAGResponse> {
    const startTime = Date.now()

    try {
      await this.initialize()

      logger.info({ query: ragQuery.query, tenantId: ragQuery.tenantId }, 'Processing RAG query')

      // Build filter for tenant isolation
      const filter: any = {
        tenantId: ragQuery.tenantId
      }

      // Add optional filters
      if (ragQuery.contractId) {
        filter.contractId = ragQuery.contractId
      }
      if (ragQuery.filters?.contractType) {
        filter.contractType = ragQuery.filters.contractType
      }

      // Create retriever with filters
      const retriever = this.vectorStore!.asRetriever({
        k: ragQuery.options?.maxResults || 5,
        filter
      })

      // Create RAG chain
      const chain = RetrievalQAChain.fromLLM(
        this.llm,
        retriever,
        {
          returnSourceDocuments: true,
          verbose: false
        }
      )

      // Execute query
      const response = await chain.call({
        query: ragQuery.query
      })

      // Format sources
      const sources = response.sourceDocuments.map((doc: Document) => ({
        contractId: doc.metadata.contractId,
        title: doc.metadata.title,
        excerpt: doc.pageContent.substring(0, 200) + '...',
        relevance: 0.85, // TODO: Calculate actual relevance score
        metadata: doc.metadata
      }))

      // Calculate confidence based on source quality
      const confidence = this.calculateConfidence(sources, response.text)

      const processingTime = Date.now() - startTime

      logger.info({
        query: ragQuery.query,
        sourcesFound: sources.length,
        confidence,
        processingTime
      }, 'RAG query completed')

      return {
        answer: response.text,
        sources,
        confidence,
        processingTime,
        model: 'gpt-4-turbo-preview',
        tokensUsed: undefined // TODO: Track token usage
      }
    } catch (error) {
      logger.error({ error, query: ragQuery.query }, 'RAG query failed')
      throw error
    }
  }

  /**
   * Search contracts semantically without AI generation
   */
  async search(
    query: string,
    tenantId: string,
    options?: {
      maxResults?: number
      filters?: RAGQuery['filters']
    }
  ): Promise<Array<{
    contractId: string
    content: string
    relevance: number
    metadata: any
  }>> {
    await this.initialize()

    const filter: any = { tenantId }
    if (options?.filters?.contractType) {
      filter.contractType = options.filters.contractType
    }

    const results = await this.vectorStore!.similaritySearch(
      query,
      options?.maxResults || 10,
      filter
    )

    return results.map(doc => ({
      contractId: doc.metadata.contractId,
      content: doc.pageContent,
      relevance: 0.85, // TODO: Get actual similarity score
      metadata: doc.metadata
    }))
  }

  /**
   * Delete contract from vector store
   */
  async deleteContract(contractId: string): Promise<void> {
    await this.initialize()

    // Chroma doesn't have a direct delete by metadata filter
    // We need to implement this based on Chroma's API
    logger.warn({ contractId }, 'Contract deletion not yet implemented')
    // TODO: Implement deletion
  }

  /**
   * Get statistics about the vector store
   */
  async getStats(tenantId: string): Promise<{
    totalDocuments: number
    totalContracts: number
    storageSize: string
  }> {
    await this.initialize()

    // TODO: Implement stats retrieval from Chroma
    return {
      totalDocuments: 0,
      totalContracts: 0,
      storageSize: '0 MB'
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy'
    details: any
  }> {
    try {
      await this.initialize()

      // Test embedding generation
      await this.embeddings.embedQuery('test')

      // Test vector store
      await this.vectorStore!.similaritySearch('test', 1)

      return {
        status: 'healthy',
        details: {
          initialized: this.isInitialized,
          chromaConnected: this.vectorStore !== null,
          openAIConfigured: !!process.env.OPENAI_API_KEY
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  }

  /**
   * Calculate confidence score based on sources and response
   */
  private calculateConfidence(sources: any[], response: string): number {
    if (sources.length === 0) return 0.1

    // Base confidence on number of sources
    let confidence = Math.min(sources.length / 5, 1) * 0.5

    // Boost if response is detailed
    if (response.length > 200) confidence += 0.2

    // Boost if multiple sources
    if (sources.length >= 3) confidence += 0.2

    // Cap at 0.95
    return Math.min(confidence, 0.95)
  }
}

export const hybridRAGService = HybridRAGService.getInstance()
