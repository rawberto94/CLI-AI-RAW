/**
 * Full-Text Search Service
 * Uses PostgreSQL's built-in full-text search capabilities
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface FullTextSearchOptions {
  query: string
  tenantId: string
  limit?: number
  offset?: number
  minRank?: number
}

export interface SearchResult {
  id: string
  rank: number
  headline: string
  document: any
}

export class FullTextSearchService {
  /**
   * Search contracts using PostgreSQL full-text search
   */
  async searchContracts(options: FullTextSearchOptions): Promise<SearchResult[]> {
    try {
      const {
        query,
        tenantId,
        limit = 50,
        offset = 0,
        minRank = 0.01,
      } = options

      // Validate inputs
      if (!query || query.trim().length === 0) {
        console.error('Full-text search: Empty query provided')
        return []
      }

      if (!tenantId) {
        console.error('Full-text search: No tenant ID provided')
        throw new Error('Tenant ID is required')
      }

      // Sanitize query for tsquery
      const sanitizedQuery = this.sanitizeQuery(query)

      // Execute full-text search with ranking
      const results = await prisma.$queryRaw<any[]>`
      SELECT 
        c.id,
        c.filename,
        c.original_name,
        c.upload_date,
        c.status,
        c.extracted_data,
        ts_rank(
          to_tsvector('english', 
            COALESCE(c.filename, '') || ' ' || 
            COALESCE(c.original_name, '') || ' ' || 
            COALESCE(c.extracted_text, '')
          ),
          to_tsquery('english', ${sanitizedQuery})
        ) as rank,
        ts_headline(
          'english',
          COALESCE(c.extracted_text, c.filename),
          to_tsquery('english', ${sanitizedQuery}),
          'MaxWords=50, MinWords=25, ShortWord=3, HighlightAll=FALSE, MaxFragments=3'
        ) as headline
      FROM contracts c
      WHERE 
        c.tenant_id = ${tenantId}
        AND to_tsvector('english', 
          COALESCE(c.filename, '') || ' ' || 
          COALESCE(c.original_name, '') || ' ' || 
          COALESCE(c.extracted_text, '')
        ) @@ to_tsquery('english', ${sanitizedQuery})
      ORDER BY rank DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `

      return results
        .filter(r => r.rank >= minRank)
        .map(r => ({
          id: r.id,
          rank: parseFloat(r.rank),
          headline: r.headline,
          document: {
            id: r.id,
            filename: r.filename,
            originalName: r.original_name,
            uploadDate: r.upload_date,
            status: r.status,
            extractedData: r.extracted_data,
          },
        }))
    } catch (error) {
      console.error('Full-text search error:', error)
      console.error('Search options:', options)
      
      // Return empty results on error rather than throwing
      // This allows the hybrid search to fall back to other methods
      if (error instanceof Error) {
        console.error('Error details:', error.message, error.stack)
      }
      
      return []
    }
  }

  /**
   * Search clauses using full-text search
   */
  async searchClauses(options: FullTextSearchOptions): Promise<SearchResult[]> {
    try {
      const {
        query,
        tenantId,
        limit = 50,
        offset = 0,
        minRank = 0.01,
      } = options

      // Validate inputs
      if (!query || query.trim().length === 0) {
        console.error('Clause search: Empty query provided')
        return []
      }

      if (!tenantId) {
        console.error('Clause search: No tenant ID provided')
        throw new Error('Tenant ID is required')
      }

      const sanitizedQuery = this.sanitizeQuery(query)

    const results = await prisma.$queryRaw<any[]>`
      SELECT 
        cl.id,
        cl.contract_id,
        cl.text,
        cl.category,
        cl.risk_level,
        c.filename,
        ts_rank(
          to_tsvector('english', COALESCE(cl.text, '') || ' ' || COALESCE(cl.category, '')),
          to_tsquery('english', ${sanitizedQuery})
        ) as rank,
        ts_headline(
          'english',
          cl.text,
          to_tsquery('english', ${sanitizedQuery}),
          'MaxWords=50, MinWords=25'
        ) as headline
      FROM clauses cl
      JOIN contracts c ON cl.contract_id = c.id
      WHERE 
        c.tenant_id = ${tenantId}
        AND to_tsvector('english', COALESCE(cl.text, '') || ' ' || COALESCE(cl.category, ''))
            @@ to_tsquery('english', ${sanitizedQuery})
      ORDER BY rank DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `

      return results
        .filter(r => r.rank >= minRank)
        .map(r => ({
          id: r.id,
          rank: parseFloat(r.rank),
          headline: r.headline,
          document: {
            id: r.id,
            contractId: r.contract_id,
            text: r.text,
            category: r.category,
            riskLevel: r.risk_level,
            filename: r.filename,
          },
        }))
    } catch (error) {
      console.error('Clause search error:', error)
      console.error('Search options:', options)
      
      if (error instanceof Error) {
        console.error('Error details:', error.message, error.stack)
      }
      
      return []
    }
  }

  /**
   * Get search suggestions based on partial query
   */
  async getSuggestions(
    partialQuery: string,
    tenantId: string,
    limit: number = 10
  ): Promise<string[]> {
    try {
      const sanitized = partialQuery.toLowerCase().trim()

      if (!sanitized || sanitized.length < 2) {
        return []
      }

      if (!tenantId) {
        console.error('Suggestions: No tenant ID provided')
        return []
      }

    const results = await prisma.$queryRaw<{ suggestion: string }[]>`
      SELECT DISTINCT 
        CASE 
          WHEN c.filename ILIKE ${`%${sanitized}%`} THEN c.filename
          WHEN c.original_name ILIKE ${`%${sanitized}%`} THEN c.original_name
        END as suggestion
      FROM contracts c
      WHERE 
        c.tenant_id = ${tenantId}
        AND (
          c.filename ILIKE ${`%${sanitized}%`}
          OR c.original_name ILIKE ${`%${sanitized}%`}
        )
      LIMIT ${limit}
    `

      return results
        .filter(r => r.suggestion)
        .map(r => r.suggestion)
    } catch (error) {
      console.error('Suggestions error:', error)
      console.error('Partial query:', partialQuery, 'Tenant:', tenantId)
      
      if (error instanceof Error) {
        console.error('Error details:', error.message)
      }
      
      return []
    }
  }

  /**
   * Sanitize query for tsquery
   * Handles special characters and formats for PostgreSQL
   */
  private sanitizeQuery(query: string): string {
    // Remove special characters that could break tsquery
    let sanitized = query
      .replace(/[^\w\s-]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0)
      .join(' & ')

    // If empty after sanitization, return a safe default
    if (!sanitized) {
      sanitized = 'contract'
    }

    return sanitized
  }

  /**
   * Count total results for a query
   */
  async countResults(query: string, tenantId: string): Promise<number> {
    try {
      if (!query || !tenantId) {
        console.error('Count results: Missing query or tenant ID')
        return 0
      }

      const sanitizedQuery = this.sanitizeQuery(query)

      const result = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM contracts c
        WHERE 
          c.tenant_id = ${tenantId}
          AND to_tsvector('english', 
            COALESCE(c.filename, '') || ' ' || 
            COALESCE(c.original_name, '') || ' ' || 
            COALESCE(c.extracted_text, '')
          ) @@ to_tsquery('english', ${sanitizedQuery})
      `

      return Number(result[0]?.count || 0)
    } catch (error) {
      console.error('Count results error:', error)
      console.error('Query:', query, 'Tenant:', tenantId)
      
      if (error instanceof Error) {
        console.error('Error details:', error.message)
      }
      
      return 0
    }
  }
}

export const fullTextSearchService = new FullTextSearchService()
