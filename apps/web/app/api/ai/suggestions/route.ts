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
import { checkRateLimit, rateLimitResponse, AI_RATE_LIMITS } from '@/lib/ai/rate-limit';
import { logger } from '@/lib/logger';

/**
 * GET - Get search suggestions
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;

  // Rate limit: 60 req/min per user (lightweight)
  const rl = checkRateLimit(tenantId, ctx.userId, '/api/ai/suggestions', AI_RATE_LIMITS.lightweight);
  if (!rl.allowed) return rateLimitResponse(rl, ctx.requestId);
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
      ],
      // Dynamic portfolio-aware suggestions (#7)
      dynamicSuggestions: await buildDynamicSuggestions(tenantId, context),
    });

  });

// ── Dynamic Portfolio-Aware Suggestions (#7) ────────────────────────────

interface DynamicSuggestion {
  id: string;
  text: string;
  category: 'urgent' | 'proactive' | 'contextual' | 'smart';
  priority: number;
  metadata?: Record<string, unknown>;
}

async function buildDynamicSuggestions(tenantId: string, pageContext: string): Promise<DynamicSuggestion[]> {
  const suggestions: DynamicSuggestion[] = [];

  try {
    // 1. Contracts expiring soon (urgent)
    const expiringCount = await prisma.contract.count({
      where: {
        tenantId,
        status: 'ACTIVE',
        expirationDate: {
          lte: new Date(Date.now() + 30 * 86400000),
          gte: new Date(),
        },
      },
    });

    if (expiringCount > 0) {
      suggestions.push({
        id: 'dyn-expiring',
        text: `${expiringCount} contract${expiringCount > 1 ? 's' : ''} expiring in 30 days — review now`,
        category: 'urgent',
        priority: 1,
        metadata: { count: expiringCount },
      });
    }

    // 2. Pending approvals
    const pendingApprovals = await prisma.workflowExecution.count({
      where: { tenantId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    });

    if (pendingApprovals > 0) {
      suggestions.push({
        id: 'dyn-approvals',
        text: `${pendingApprovals} pending approval${pendingApprovals > 1 ? 's' : ''} waiting for review`,
        category: 'urgent',
        priority: 2,
        metadata: { count: pendingApprovals },
      });
    }

    // 3. High-risk contracts
    const highRiskCount = await prisma.contract.count({
      where: { tenantId, expirationRisk: { in: ['HIGH', 'CRITICAL'] } },
    });

    if (highRiskCount > 0) {
      suggestions.push({
        id: 'dyn-risk',
        text: `${highRiskCount} high-risk contract${highRiskCount > 1 ? 's' : ''} need attention`,
        category: 'urgent',
        priority: 3,
        metadata: { count: highRiskCount },
      });
    }

    // 4. Missing data
    const missingDates = await prisma.contract.count({
      where: { tenantId, status: 'ACTIVE', expirationDate: null },
    });

    if (missingDates > 0) {
      suggestions.push({
        id: 'dyn-missing',
        text: `${missingDates} active contract${missingDates > 1 ? 's' : ''} missing expiration dates`,
        category: 'proactive',
        priority: 5,
      });
    }

    // 5. Agent insights nudge
    try {
      const recentGoals = await prisma.$queryRaw<Array<{ cnt: string }>>`
        SELECT COUNT(*) as cnt FROM agent_goals
         WHERE tenant_id = ${tenantId} AND status = 'COMPLETED' AND created_at > NOW() - INTERVAL '24 hours'
      `;
      const cnt = parseInt(recentGoals[0]?.cnt || '0');
      if (cnt > 0) {
        suggestions.push({
          id: 'dyn-agents',
          text: `AI agents found ${cnt} insight${cnt > 1 ? 's' : ''} today — ask "what have the agents found?"`,
          category: 'proactive',
          priority: 4,
        });
      }
    } catch { /* */ }

    // 6. Time-based
    const hour = new Date().getHours();
    const dayOfWeek = new Date().getDay();

    if (dayOfWeek === 1 && hour < 12) {
      suggestions.push({
        id: 'dyn-weekly',
        text: 'Monday morning — review contracts needing attention this week',
        category: 'smart',
        priority: 7,
      });
    }

  } catch (error) {
    logger.error('[Dynamic Suggestions] Error:', error);
  }

  return suggestions.sort((a, b) => a.priority - b.priority).slice(0, 6);
}
