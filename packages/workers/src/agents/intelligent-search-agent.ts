/**
 * Intelligent Search Agent
 * Provides intent-aware semantic search with natural language understanding
 */

import { BaseAgent } from './base-agent';
import type {
  AgentInput,
  AgentOutput,
  SearchIntent,
  SearchFilter,
  SearchResult,
} from './types';
import { logger } from '../utils/logger';
import { openai } from '../lib/openai';
import clientsDb from 'clients-db';

const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;
const prisma = getClient();

export class IntelligentSearchAgent extends BaseAgent {
  name = 'intelligent-search-agent';
  version = '1.0.0';
  capabilities = ['search-intent', 'semantic-search', 'query-transformation'];

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { query, userContext } = input.context;

    // Detect search intent
    const intent = await this.detectSearchIntent(query, userContext);

    // Transform query based on intent
    const transformedQuery = this.transformQuery(query, intent);

    // Execute search (would integrate with actual search system)
    const searchResult = await this.performSearch(transformedQuery, intent, input.tenantId);

    return {
      success: true,
      data: searchResult,
      confidence: searchResult.confidence,
      reasoning: this.formatReasoning([
        `Query: "${query}"`,
        `Detected Intent: ${intent.type}`,
        `Confidence: ${(intent.confidence * 100).toFixed(0)}%`,
        `Results Found: ${searchResult.totalResults}`,
        '',
        'Applied Filters:',
        ...intent.filters.map(f => `  - ${f.field} ${f.operator} ${f.value}`),
        '',
        `Summary: ${searchResult.summary}`,
      ]),
      metadata: {
        processingTime: Date.now() - input.metadata!.timestamp.getTime(),
      },
    };
  }

  protected getEventType(): 'search_executed' {
    return 'search_executed';
  }

  /**
   * Detect search intent from natural language query
   */
  private async detectSearchIntent(
    query: string,
    userContext: any
  ): Promise<SearchIntent> {
    const queryLower = query.toLowerCase();

    // Pattern matching for common intents
    if (this.matchesPattern(queryLower, ['expir', 'renewal', 'ending', 'soon'])) {
      return {
        type: 'find_expiring',
        confidence: 0.90,
        filters: [
          {
            field: 'expirationDate',
            operator: 'between',
            value: [new Date(), this.addDays(new Date(), 90)],
            derived: true,
          },
        ],
        sortBy: 'expirationDate_asc',
      };
    }

    if (this.matchesPattern(queryLower, ['risk', 'risky', 'high risk', 'problem'])) {
      return {
        type: 'find_high_risk',
        confidence: 0.85,
        filters: [
          {
            field: 'riskScore',
            operator: 'greater_than',
            value: 7,
            derived: true,
          },
        ],
        sortBy: 'riskScore_desc',
        includeAnalysis: true,
      };
    }

    if (this.matchesPattern(queryLower, ['approved by', 'signed by', 'reviewed by']) || 
        this.extractsPersonName(query)) {
      const personName = this.extractPersonName(query);
      return {
        type: 'find_by_person',
        confidence: 0.88,
        filters: [
          {
            field: 'approvers',
            operator: 'contains',
            value: personName,
            derived: true,
          },
        ],
      };
    }

    if (this.matchesPattern(queryLower, ['$', 'value', 'cost', 'price', 'expensive', 'cheap'])) {
      const amount = this.extractAmount(query);
      return {
        type: 'find_by_value',
        confidence: 0.82,
        filters: amount ? [
          {
            field: 'value',
            operator: queryLower.includes('over') || queryLower.includes('above') ? 'greater_than' : 'less_than',
            value: amount,
            derived: true,
          },
        ] : [],
        sortBy: 'value_desc',
      };
    }

    if (this.matchesPattern(queryLower, ['cost', 'spending', 'expensive', 'save', 'savings'])) {
      return {
        type: 'analyze_costs',
        confidence: 0.80,
        filters: [],
        includeAnalysis: true,
      };
    }

    if (this.matchesPattern(queryLower, ['supplier', 'vendor', 'compare'])) {
      return {
        type: 'compare_suppliers',
        confidence: 0.78,
        filters: [],
        includeAnalysis: true,
      };
    }

    // Use AI for complex queries
    return await this.aiIntentDetection(query, userContext);
  }

  /**
   * AI-powered intent detection for complex queries
   */
  private async aiIntentDetection(
    query: string,
    userContext: any
  ): Promise<SearchIntent> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a search intent classifier. Analyze the user's query and determine their search intent. Return JSON with:
{
  "type": "find_expiring" | "find_high_risk" | "find_by_person" | "find_by_value" | "analyze_costs" | "compare_suppliers" | "general_search",
  "confidence": 0.0-1.0,
  "filters": [{ "field": "field_name", "operator": "equals|contains|greater_than|less_than", "value": "value" }],
  "reasoning": "explanation"
}`,
          },
          {
            role: 'user',
            content: `Query: "${query}"\n\nUser Context: ${JSON.stringify(userContext)}`,
          },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');

      return {
        type: result.type || 'general_search',
        confidence: result.confidence || 0.7,
        filters: (result.filters || []).map((f: any) => ({
          ...f,
          derived: true,
        })),
      };
    } catch (error) {
      logger.error({ error, query }, 'AI intent detection failed');
      
      // Fallback to general search
      return {
        type: 'general_search',
        confidence: 0.60,
        filters: [],
      };
    }
  }

  /**
   * Transform query based on detected intent
   */
  private transformQuery(query: string, intent: SearchIntent): string {
    switch (intent.type) {
      case 'find_expiring':
        return `contracts expiring soon within 90 days ${query}`;
      
      case 'find_high_risk':
        return `high risk contracts with issues ${query}`;
      
      case 'find_by_person':
        const person = this.extractPersonName(query);
        return `contracts involving ${person} ${query}`;
      
      case 'find_by_value':
        return `contracts by value ${query}`;
      
      case 'analyze_costs':
        return `contract costs and spending analysis ${query}`;
      
      case 'compare_suppliers':
        return `supplier comparison and analysis ${query}`;
      
      default:
        return query;
    }
  }

  /**
   * Perform search using full-text + vector similarity on real database
   */
  private async performSearch(
    query: string,
    intent: SearchIntent,
    tenantId: string
  ): Promise<SearchResult> {
    let dbResults: any[] = [];

    try {
      // Build intent-specific WHERE conditions
      const intentConditions: string[] = ['c."tenantId" = $1', 'c."isDeleted" = false'];
      const params: any[] = [tenantId];
      let paramIdx = 2;

      for (const filter of intent.filters) {
        switch (filter.field) {
          case 'status':
            intentConditions.push(`c."status" = $${paramIdx}`);
            params.push(String(filter.value).toUpperCase());
            paramIdx++;
            break;
          case 'expirationDate':
            if (filter.operator === 'less_than') {
              intentConditions.push(`c."expirationDate" < $${paramIdx}`);
              params.push(new Date(filter.value));
              paramIdx++;
            }
            break;
          case 'totalValue':
            if (filter.operator === 'greater_than') {
              intentConditions.push(`c."totalValue" > $${paramIdx}`);
              params.push(Number(filter.value));
              paramIdx++;
            }
            break;
          case 'supplierName':
            intentConditions.push(`c."supplierName" ILIKE $${paramIdx}`);
            params.push(`%${filter.value}%`);
            paramIdx++;
            break;
        }
      }

      const whereClause = intentConditions.join(' AND ');

      // Strategy 1: Full-text search on Contract.searchableText + rawText
      const ftsQuery = query.replace(/[^a-zA-Z0-9\s]/g, ' ').trim().split(/\s+/).filter(Boolean).join(' & ');
      
      if (ftsQuery) {
        params.push(ftsQuery);
        const ftsResults = await prisma.$queryRawUnsafe<any[]>(`
          SELECT c.id, c."contractTitle", c."supplierName", c."contractType",
                 c."totalValue", c."expirationDate", c.status,
                 ts_rank(to_tsvector('english', COALESCE(c."searchableText", '') || ' ' || COALESCE(c."rawText", '')), to_tsquery('english', $${paramIdx})) as rank
          FROM "Contract" c
          WHERE ${whereClause}
            AND to_tsvector('english', COALESCE(c."searchableText", '') || ' ' || COALESCE(c."rawText", ''))
                @@ to_tsquery('english', $${paramIdx})
          ORDER BY rank DESC
          LIMIT 20
        `, ...params);
        paramIdx++;

        dbResults = ftsResults.map((r: any) => ({
          id: r.id,
          contractTitle: r.contractTitle,
          supplierName: r.supplierName,
          contractType: r.contractType,
          totalValue: r.totalValue ? Number(r.totalValue) : null,
          expirationDate: r.expirationDate,
          status: r.status,
          score: Number(r.rank),
          matchType: 'fulltext',
        }));
      }

      // Strategy 2: If few FTS results, fall back to ILIKE search
      if (dbResults.length < 5) {
        const likeParams = [...params.slice(0, paramIdx - 1)]; // without fts param
        likeParams.push(`%${query}%`);
        const likeIdx = likeParams.length;

        const likeResults = await prisma.$queryRawUnsafe<any[]>(`
          SELECT c.id, c."contractTitle", c."supplierName", c."contractType",
                 c."totalValue", c."expirationDate", c.status
          FROM "Contract" c
          WHERE ${whereClause}
            AND (c."contractTitle" ILIKE $${likeIdx} OR c."supplierName" ILIKE $${likeIdx} OR c."rawText" ILIKE $${likeIdx})
          ORDER BY c."updatedAt" DESC
          LIMIT 10
        `, ...likeParams);

        const existingIds = new Set(dbResults.map(r => r.id));
        for (const r of likeResults) {
          if (!existingIds.has(r.id)) {
            dbResults.push({
              id: r.id,
              contractTitle: r.contractTitle,
              supplierName: r.supplierName,
              contractType: r.contractType,
              totalValue: r.totalValue ? Number(r.totalValue) : null,
              expirationDate: r.expirationDate,
              status: r.status,
              score: 0.5,
              matchType: 'keyword',
            });
          }
        }
      }
    } catch (error) {
      logger.warn({ error, tenantId, query }, 'Search agent DB query failed');
    }

    const summary = await this.generateSearchSummary(dbResults, intent);
    const suggestedFilters = this.generateSuggestedFilters(dbResults, intent);
    const relatedQueries = this.generateRelatedQueries(query, intent);

    return {
      results: dbResults,
      intent: intent.type,
      summary,
      suggestedFilters,
      relatedQueries,
      totalResults: dbResults.length,
      confidence: intent.confidence,
    };
  }

  /**
   * Generate AI summary of search results
   */
  private async generateSearchSummary(
    results: any[],
    intent: SearchIntent
  ): Promise<string> {
    if (results.length === 0) {
      return 'No contracts found matching your search criteria.';
    }

    switch (intent.type) {
      case 'find_expiring':
        return `Found ${results.length} contracts expiring within the next 90 days. Prioritize renewal planning for high-value contracts.`;
      
      case 'find_high_risk':
        return `Identified ${results.length} high-risk contracts requiring attention. Common issues include missing clauses, compliance gaps, and unfavorable terms.`;
      
      case 'find_by_value':
        const totalValue = results.reduce((sum, r) => sum + (r.value || 0), 0);
        return `Found ${results.length} contracts with total value of $${totalValue.toLocaleString()}.`;
      
      default:
        return `Found ${results.length} contracts matching your search.`;
    }
  }

  /**
   * Generate suggested filters based on results
   */
  private generateSuggestedFilters(
    results: any[],
    intent: SearchIntent
  ): SearchFilter[] {
    const filters: SearchFilter[] = [];

    // Suggest status filters
    filters.push({
      field: 'status',
      operator: 'equals',
      value: 'active',
      derived: true,
    });

    // Suggest department filters if multiple departments present
    if (intent.type !== 'find_by_person') {
      filters.push({
        field: 'department',
        operator: 'equals',
        value: 'IT',
        derived: true,
      });
    }

    return filters;
  }

  /**
   * Generate related search queries
   */
  private generateRelatedQueries(query: string, intent: SearchIntent): string[] {
    const related: string[] = [];

    switch (intent.type) {
      case 'find_expiring':
        related.push(
          'Contracts with auto-renewal',
          'Contracts expiring next month',
          'High-value contracts expiring soon'
        );
        break;
      
      case 'find_high_risk':
        related.push(
          'Contracts missing liability clauses',
          'Non-compliant contracts',
          'Contracts needing amendment'
        );
        break;
      
      case 'find_by_value':
        related.push(
          'Contracts over $1M',
          'Highest value contracts',
          'Cost optimization opportunities'
        );
        break;
      
      default:
        related.push(
          'Recent contracts',
          'Pending approvals',
          'Active contracts'
        );
    }

    return related;
  }

  /**
   * Check if query matches patterns
   */
  private matchesPattern(query: string, patterns: string[]): boolean {
    return patterns.some(pattern => query.includes(pattern));
  }

  /**
   * Check if query contains a person name
   */
  private extractsPersonName(query: string): boolean {
    // Simple heuristic: contains "by" followed by capitalized words
    return /by\s+[A-Z][a-z]+\s+[A-Z][a-z]+/.test(query);
  }

  /**
   * Extract person name from query
   */
  private extractPersonName(query: string): string {
    const match = query.match(/(?:by|approved by|signed by|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    return match?.[1] ?? '';
  }

  /**
   * Extract amount from query
   */
  private extractAmount(query: string): number | null {
    const match = query.match(/\$?([\d,]+(?:\.\d{2})?)\s*(?:k|thousand|m|million|b|billion)?/i);
    if (!match?.[1]) return null;

    let amount = parseFloat(match[1].replace(/,/g, ''));
    const unit = query.match(/\b(k|thousand|m|million|b|billion)\b/i)?.[1]?.toLowerCase();

    if (unit === 'k' || unit === 'thousand') amount *= 1000;
    else if (unit === 'm' || unit === 'million') amount *= 1000000;
    else if (unit === 'b' || unit === 'billion') amount *= 1000000000;

    return amount;
  }

  /**
   * Add days to date
   */
  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}

// Export singleton instance
export const intelligentSearchAgent = new IntelligentSearchAgent();
