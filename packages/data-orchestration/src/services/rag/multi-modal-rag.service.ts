/**
 * Multi-Modal RAG Service (Phase 6)
 * 
 * Handles tables, images, and mixed content types
 */

import { OpenAIEmbeddings } from '@langchain/openai'
import pino from 'pino'

const logger = pino({ name: 'multi-modal-rag' })

export interface TableData {
  id: string
  contractId: string
  headers: string[]
  rows: string[][]
  metadata: Record<string, any>
}

export interface ImageData {
  id: string
  contractId: string
  url: string
  ocrText?: string
  description?: string
  metadata: Record<string, any>
}

export interface MultiModalSearchResult {
  type: 'text' | 'table' | 'image'
  contractId: string
  content: any
  relevance: number
  metadata: Record<string, any>
}

export class MultiModalRAGService {
  private static instance: MultiModalRAGService
  private embeddings: OpenAIEmbeddings
  private tables: Map<string, TableData> = new Map()
  private images: Map<string, ImageData> = new Map()

  private constructor() {
    this.embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-3-small',
      openAIApiKey: process.env.OPENAI_API_KEY
    })
  }

  static getInstance(): MultiModalRAGService {
    if (!MultiModalRAGService.instance) {
      MultiModalRAGService.instance = new MultiModalRAGService()
    }
    return MultiModalRAGService.instance
  }

  /**
   * Extract and index tables from contract
   */
  async extractTables(
    contractId: string,
    tenantId: string,
    artifacts: any[]
  ): Promise<{ tablesExtracted: number }> {
    try {
      let tablesExtracted = 0

      // Find table artifacts
      const tableArtifacts = artifacts.filter(a => 
        a.type === 'table' || a.metadata?.isTable
      )

      for (const artifact of tableArtifacts) {
        const tableData: TableData = {
          id: `table:${contractId}:${artifact.id}`,
          contractId,
          headers: artifact.metadata?.headers || [],
          rows: artifact.metadata?.rows || [],
          metadata: {
            tenantId,
            page: artifact.metadata?.page,
            section: artifact.metadata?.section
          }
        }

        this.tables.set(tableData.id, tableData)
        tablesExtracted++

        // Generate embeddings for table content
        const tableText = this.tableToText(tableData)
        await this.embeddings.embedQuery(tableText)
      }

      logger.info({ contractId, tablesExtracted }, 'Tables extracted')
      return { tablesExtracted }
    } catch (error) {
      logger.error({ error, contractId }, 'Table extraction failed')
      throw error
    }
  }

  /**
   * Extract and index images from contract
   */
  async extractImages(
    contractId: string,
    tenantId: string,
    artifacts: any[]
  ): Promise<{ imagesExtracted: number }> {
    try {
      let imagesExtracted = 0

      const imageArtifacts = artifacts.filter(a => 
        a.type === 'image' || a.metadata?.isImage
      )

      for (const artifact of imageArtifacts) {
        const imageData: ImageData = {
          id: `image:${contractId}:${artifact.id}`,
          contractId,
          url: artifact.content || artifact.url,
          ocrText: artifact.metadata?.ocrText,
          description: artifact.metadata?.description,
          metadata: {
            tenantId,
            page: artifact.metadata?.page,
            type: artifact.metadata?.imageType
          }
        }

        this.images.set(imageData.id, imageData)
        imagesExtracted++

        // Generate embeddings for OCR text or description
        if (imageData.ocrText || imageData.description) {
          await this.embeddings.embedQuery(imageData.ocrText || imageData.description!)
        }
      }

      logger.info({ contractId, imagesExtracted }, 'Images extracted')
      return { imagesExtracted }
    } catch (error) {
      logger.error({ error, contractId }, 'Image extraction failed')
      throw error
    }
  }

  /**
   * Search across all content types
   */
  async multiModalSearch(
    query: string,
    tenantId: string,
    options?: {
      contentTypes?: Array<'text' | 'table' | 'image'>
      maxResults?: number
    }
  ): Promise<MultiModalSearchResult[]> {
    try {
      const results: MultiModalSearchResult[] = []
      const contentTypes = options?.contentTypes || ['text', 'table', 'image']

      // Search tables
      if (contentTypes.includes('table')) {
        const tableResults = await this.searchTables(query, tenantId)
        results.push(...tableResults)
      }

      // Search images
      if (contentTypes.includes('image')) {
        const imageResults = await this.searchImages(query, tenantId)
        results.push(...imageResults)
      }

      // Sort by relevance
      results.sort((a, b) => b.relevance - a.relevance)

      return results.slice(0, options?.maxResults || 20)
    } catch (error) {
      logger.error({ error, query }, 'Multi-modal search failed')
      throw error
    }
  }

  /**
   * Search tables specifically
   */
  private async searchTables(
    query: string,
    tenantId: string
  ): Promise<MultiModalSearchResult[]> {
    const results: MultiModalSearchResult[] = []

    for (const [id, table] of this.tables.entries()) {
      if (table.metadata.tenantId !== tenantId) continue

      const tableText = this.tableToText(table)
      const relevance = this.calculateRelevance(query, tableText)

      if (relevance > 0.3) {
        results.push({
          type: 'table',
          contractId: table.contractId,
          content: table,
          relevance,
          metadata: table.metadata
        })
      }
    }

    return results
  }

  /**
   * Search images specifically
   */
  private async searchImages(
    query: string,
    tenantId: string
  ): Promise<MultiModalSearchResult[]> {
    const results: MultiModalSearchResult[] = []

    for (const [id, image] of this.images.entries()) {
      if (image.metadata.tenantId !== tenantId) continue

      const imageText = image.ocrText || image.description || ''
      const relevance = this.calculateRelevance(query, imageText)

      if (relevance > 0.3) {
        results.push({
          type: 'image',
          contractId: image.contractId,
          content: image,
          relevance,
          metadata: image.metadata
        })
      }
    }

    return results
  }

  /**
   * Convert table to searchable text
   */
  private tableToText(table: TableData): string {
    const headerText = table.headers.join(' | ')
    const rowsText = table.rows.map(row => row.join(' | ')).join('\n')
    return `${headerText}\n${rowsText}`
  }

  /**
   * Calculate relevance score
   */
  private calculateRelevance(query: string, content: string): number {
    const queryWords = new Set(query.toLowerCase().split(/\s+/))
    const contentWords = content.toLowerCase().split(/\s+/)
    
    let matches = 0
    for (const word of contentWords) {
      if (queryWords.has(word)) matches++
    }

    return Math.min(matches / queryWords.size, 1)
  }

  async getStats(tenantId: string): Promise<{
    totalTables: number
    totalImages: number
  }> {
    const totalTables = Array.from(this.tables.values()).filter(
      t => t.metadata.tenantId === tenantId
    ).length

    const totalImages = Array.from(this.images.values()).filter(
      i => i.metadata.tenantId === tenantId
    ).length

    return { totalTables, totalImages }
  }
}

export const multiModalRAGService = MultiModalRAGService.getInstance()
