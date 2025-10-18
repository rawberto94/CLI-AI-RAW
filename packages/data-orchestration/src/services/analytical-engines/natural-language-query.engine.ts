// Natural Language Query Engine Implementation
import { dbAdaptor } from "../../dal/database.adaptor";
import { cacheAdaptor } from "../../dal/cache.adaptor";
import { analyticalEventPublisher } from "../../events/analytical-event-publisher";
import { analyticalDatabaseService } from "../analytical-database.service";
import { NaturalLanguageQueryEngine } from "../analytical-intelligence.service";
import pino from "pino";

const logger = pino({ name: "natural-language-query-engine" });

export class NaturalLanguageQueryEngineImpl implements NaturalLanguageQueryEngine {
  private queryPatterns = [
    { pattern: /contracts.*with.*auto.*renew/i, type: 'renewal_search' },
    { pattern: /rate.*for.*(\w+)/i, type: 'rate_query' },
    { pattern: /compliance.*score/i, type: 'compliance_query' },
    { pattern: /supplier.*(\w+).*performance/i, type: 'supplier_query' }
  ];

  async processQuery(query: string, context: any): Promise<any> {
    try {
      logger.info({ query, sessionId: context.sessionId }, "Processing natural language query");
      
      const startTime = Date.now();
      
      // Classify query intent
      const intent = this.classifyIntent(query);
      
      // Search for relevant contracts/data
      const searchResults = await this.searchContracts(query, {
        tenantId: context.tenantId
      });
      
      // Generate structured response
      const response = await this.generateResponse(searchResults, query);
      
      const executionTime = Date.now() - startTime;
      
      const queryResponse = {
        answer: response.answer,
        confidence: response.confidence,
        evidence: response.sources,
        suggestions: this.generateSuggestions(query, intent),
        followUpQuestions: this.generateFollowUpQuestions(query, intent)
      };
      
      // Store query history
      await analyticalDatabaseService.createQueryHistory({
        sessionId: context.sessionId,
        tenantId: context.tenantId,
        userId: context.userId,
        query,
        response: queryResponse,
        confidence: response.confidence,
        responseTime: executionTime
      });
      
      // Maintain context
      await this.maintainContext(context.sessionId, query, queryResponse);
      
      // Publish query processed event
      await analyticalEventPublisher.publishQueryProcessed({
        tenantId: context.tenantId,
        sessionId: context.sessionId,
        userId: context.userId,
        query,
        response: {
          answer: response.answer,
          confidence: response.confidence,
          evidenceCount: response.sources.length,
          executionTime
        }
      });
      
      logger.info({ 
        sessionId: context.sessionId, 
        confidence: response.confidence,
        executionTime 
      }, "Query processed successfully");
      
      return queryResponse;
    } catch (error) {
      logger.error({ error, query }, "Failed to process query");
      throw error;
    }
  }

  async searchContracts(query: string, filters: any): Promise<any> {
    try {
      logger.info({ query }, "Searching contracts");
      
      // Mock search implementation - in production would use vector search
      const mockResults = [
        {
          contractId: 'contract-1',
          title: 'IT Services Agreement',
          excerpt: 'This contract automatically renews for additional one-year terms...',
          relevanceScore: 0.85,
          metadata: {
            supplier: 'Accenture',
            value: 1000000,
            category: 'IT Services'
          }
        },
        {
          contractId: 'contract-2', 
          title: 'Consulting Services SOW',
          excerpt: 'Senior consultant rate: $180/hour, Manager rate: $220/hour...',
          relevanceScore: 0.78,
          metadata: {
            supplier: 'Deloitte',
            value: 500000,
            category: 'Consulting'
          }
        }
      ];
      
      // Filter results based on query intent
      const filteredResults = this.filterByIntent(mockResults, query);
      
      logger.info({ resultCount: filteredResults.length }, "Contract search completed");
      return filteredResults;
    } catch (error) {
      logger.error({ error, query }, "Failed to search contracts");
      throw error;
    }
  }

  async generateResponse(results: any[], query: string): Promise<any> {
    try {
      logger.info({ resultCount: results.length, query }, "Generating structured response");
      
      let answer = '';
      let confidence = 0;
      
      if (results.length === 0) {
        answer = "I couldn't find any contracts matching your query. Please try rephrasing your question or check if the contracts exist in the system.";
        confidence = 0.9;
      } else {
        // Generate answer based on query type and results
        const intent = this.classifyIntent(query);
        answer = this.generateAnswerByIntent(intent, results, query);
        confidence = this.calculateResponseConfidence(results);
      }
      
      const response = {
        query,
        answer,
        confidence,
        sources: results.map(r => ({
          contractId: r.contractId,
          excerpt: r.excerpt,
          relevanceScore: r.relevanceScore
        })),
        relatedQueries: this.generateRelatedQueries(query),
        executionTime: Date.now()
      };
      
      logger.info({ confidence }, "Response generated");
      return response;
    } catch (error) {
      logger.error({ error }, "Failed to generate response");
      throw error;
    }
  }

  async maintainContext(sessionId: string, query: string, response: any): Promise<void> {
    try {
      // Store conversation context in cache
      const contextKey = `query-context:${sessionId}`;
      const existingContext = (await cacheAdaptor.get<{ queries: any[] }>(contextKey)) || { queries: [] };
      
      existingContext.queries.push({
        query,
        timestamp: new Date(),
        confidence: response.confidence
      });
      
      // Keep only last 10 queries
      if (existingContext.queries.length > 10) {
        existingContext.queries = existingContext.queries.slice(-10);
      }
      
      await cacheAdaptor.set(contextKey, existingContext, 3600); // 1 hour TTL
      
      logger.debug({ sessionId }, "Query context maintained");
    } catch (error) {
      logger.error({ error, sessionId }, "Failed to maintain context");
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const dbHealth = await analyticalDatabaseService.healthCheck();
      await cacheAdaptor.set('nlq-health-check', 'ok', 10);
      const cacheTest = await cacheAdaptor.get('nlq-health-check');
      
      return dbHealth.success && cacheTest === 'ok';
    } catch (error) {
      logger.error({ error }, "NLQ engine health check failed");
      return false;
    }
  }

  // Private helper methods
  private classifyIntent(query: string): string {
    for (const pattern of this.queryPatterns) {
      if (pattern.pattern.test(query)) {
        return pattern.type;
      }
    }
    return 'general_search';
  }

  private filterByIntent(results: any[], query: string): any[] {
    const intent = this.classifyIntent(query);
    
    switch (intent) {
      case 'renewal_search':
        return results.filter(r => r.excerpt.toLowerCase().includes('renew'));
      case 'rate_query':
        return results.filter(r => r.excerpt.toLowerCase().includes('rate') || r.excerpt.includes('$'));
      case 'compliance_query':
        return results.filter(r => r.metadata.category === 'Compliance' || r.excerpt.toLowerCase().includes('compliance'));
      default:
        return results;
    }
  }

  private generateAnswerByIntent(intent: string, results: any[], query: string): string {
    switch (intent) {
      case 'renewal_search':
        const renewalContracts = results.length;
        return `I found ${renewalContracts} contract(s) with auto-renewal clauses. ${results.map(r => 
          `Contract "${r.title}" with ${r.metadata.supplier} includes auto-renewal terms.`
        ).join(' ')}`;
        
      case 'rate_query':
        const rateInfo = results.map(r => {
          const rates = this.extractRates(r.excerpt);
          return `${r.metadata.supplier}: ${rates}`;
        }).join(', ');
        return `Here are the rates I found: ${rateInfo}`;
        
      case 'supplier_query':
        const supplierMatch = query.match(/supplier.*(\w+)/i);
        const supplier = supplierMatch ? supplierMatch[1] : 'the supplier';
        return `Based on ${results.length} contract(s), ${supplier} has an average contract value of $${this.calculateAverageValue(results).toLocaleString()}.`;
        
      default:
        return `I found ${results.length} relevant contract(s). ${results.map(r => 
          `"${r.title}" with ${r.metadata.supplier} (${r.metadata.category})`
        ).join(', ')}.`;
    }
  }

  private extractRates(text: string): string {
    const rateMatches = text.match(/\$\d+\/\w+/g);
    return rateMatches ? rateMatches.join(', ') : 'rates not specified';
  }

  private calculateAverageValue(results: any[]): number {
    const total = results.reduce((sum, r) => sum + (r.metadata.value || 0), 0);
    return results.length > 0 ? total / results.length : 0;
  }

  private calculateResponseConfidence(results: any[]): number {
    if (results.length === 0) return 0.1;
    
    const avgRelevance = results.reduce((sum, r) => sum + r.relevanceScore, 0) / results.length;
    const resultCountFactor = Math.min(results.length / 5, 1); // More results up to 5 increase confidence
    
    return Math.min(0.95, avgRelevance * 0.7 + resultCountFactor * 0.3);
  }

  private generateSuggestions(query: string, intent: string): string[] {
    const suggestions = [];
    
    if (intent === 'general_search') {
      suggestions.push('Try asking about specific suppliers, contract types, or dates');
      suggestions.push('Ask about renewal dates, compliance scores, or rate comparisons');
    }
    
    suggestions.push('Use specific supplier names for better results');
    suggestions.push('Include date ranges to narrow your search');
    
    return suggestions;
  }

  private generateFollowUpQuestions(query: string, intent: string): string[] {
    const followUps = [];
    
    switch (intent) {
      case 'renewal_search':
        followUps.push('Which contracts are expiring in the next 90 days?');
        followUps.push('What is the total value of auto-renewing contracts?');
        break;
      case 'rate_query':
        followUps.push('How do these rates compare to market benchmarks?');
        followUps.push('Which supplier offers the most competitive rates?');
        break;
      case 'supplier_query':
        followUps.push('What is this supplier\'s performance score?');
        followUps.push('Are there any compliance issues with this supplier?');
        break;
      default:
        followUps.push('Can you show me more details about these contracts?');
        followUps.push('What are the key terms in these agreements?');
    }
    
    return followUps;
  }

  private generateRelatedQueries(query: string): string[] {
    return [
      'Show me all contracts expiring this year',
      'What are the top 5 suppliers by contract value?',
      'Which contracts have compliance issues?',
      'Compare rates across different suppliers'
    ];
  }
}