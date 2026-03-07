/**
 * AI Search Suggestions API
 * 
 * GET /api/ai/suggestions - Get AI-powered search suggestions
 * 
 * Features:
 * - Popular queries in the tenant
 * - Related queries based on context
 * - Smart completions
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { aiCopilotService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

/**
 * GET - Get search suggestions
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const { searchParams } = new URL(request.url);
    
    const prefix = searchParams.get('q') || '';
    const context = searchParams.get('context') || 'global';
    const contractId = searchParams.get('contractId');

    // Default smart suggestions for contract management
    const defaultSuggestions = [
      'Find contracts expiring in the next 30 days',
      'Show me all high-risk clauses',
      'What are the payment terms across all contracts?',
      'List contracts with auto-renewal clauses',
      'Find liability and indemnification clauses',
      'Show contracts with this supplier',
      'Compare pricing across vendors',
      'What are my termination obligations?',
      'Find confidentiality agreements',
      'Show SLA and performance requirements',
    ];

    // Contract-specific suggestions
    const contractSpecificSuggestions = [
      'Summarize the key terms of this contract',
      'What are the main risks in this contract?',
      'List all obligations I have under this contract',
      'When does this contract expire?',
      'What are the payment terms?',
      'Find similar contracts in my repository',
      'What clauses differ from our standard template?',
      'Generate a renewal reminder',
    ];

    // Get popular queries from history
    let popularQueries: string[] = [];
    try {
      const recentQueries = await prisma.auditLog.findMany({
        where: {
          tenantId,
          action: { startsWith: 'ai.' },
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        select: { resource: true },
        orderBy: { createdAt: 'desc' },
        take: 100 });

      // Count query frequency
      const queryFreq = new Map<string, number>();
      for (const q of recentQueries) {
        if (q.resource && q.resource.length > 10) {
          const normalized = q.resource.toLowerCase().trim();
          queryFreq.set(normalized, (queryFreq.get(normalized) || 0) + 1);
        }
      }

      // Get top 5 most frequent
      popularQueries = Array.from(queryFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([query]) => query);
    } catch {
      // Silently ignore history errors
    }

    // Filter by prefix if provided
    let suggestions = context === 'contract' && contractId
      ? [...contractSpecificSuggestions, ...defaultSuggestions]
      : [...defaultSuggestions];

    if (prefix) {
      const lowerPrefix = prefix.toLowerCase();
      suggestions = suggestions.filter(s => 
        s.toLowerCase().includes(lowerPrefix)
      );
    }

    // Build response
    return createSuccessResponse(ctx, {
      suggestions: suggestions.slice(0, 10),
      popularQueries: popularQueries.slice(0, 5),
      categories: [
        { id: 'risk', label: 'Risk Analysis', icon: 'shield' },
        { id: 'financial', label: 'Financial Terms', icon: 'dollar-sign' },
        { id: 'dates', label: 'Key Dates', icon: 'calendar' },
        { id: 'obligations', label: 'Obligations', icon: 'check-square' },
        { id: 'comparison', label: 'Comparison', icon: 'git-compare' },
      ],
      quickActions: [
        { 
          label: 'Analyze All Risks', 
          query: 'What are all the high-risk clauses across my contracts?',
          icon: 'alert-triangle' },
        { 
          label: 'Upcoming Expirations', 
          query: 'Show contracts expiring in the next 90 days',
          icon: 'clock' },
        { 
          label: 'Spending Analysis', 
          query: 'What is my total contract value by supplier?',
          icon: 'bar-chart' },
      ] });

  });
