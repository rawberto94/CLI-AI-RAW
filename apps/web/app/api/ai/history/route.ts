/**
 * AI Query History API
 * 
 * POST /api/ai/history - Log AI queries for analytics
 * GET /api/ai/history - Get query history for a user/tenant
 * 
 * Features:
 * - Track all AI queries across chat, search, analysis
 * - Analytics on query patterns and usage
 * - Improve AI responses over time
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { aiCopilotService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export type AIQueryType = 
  | 'chat' 
  | 'search' 
  | 'analysis' 
  | 'comparison' 
  | 'rag_retrieval'
  | 'embedding_generation';

interface LogQueryRequest {
  queryType: AIQueryType;
  query: string;
  context?: string;
  contractId?: string;
  responseTime?: number;
  tokensUsed?: number;
  model?: string;
  success: boolean;
  errorMessage?: string;
  ragResults?: number;
  userFeedback?: 'positive' | 'negative' | null;
  metadata?: Record<string, any>;
}

/**
 * POST - Log an AI query
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const body: LogQueryRequest = await request.json();

    const {
      queryType,
      query,
      context,
      contractId,
      responseTime,
      tokensUsed,
      model,
      success,
      errorMessage,
      ragResults,
      userFeedback,
      metadata } = body;

    // Store in AuditLog with AI-specific action type
    const auditEntry = await prisma.auditLog.create({
      data: {
        tenantId,
        action: `ai.${queryType}`,
        resourceType: 'ai_query',
        entityType: 'ai_query',
        entityId: contractId,
        resource: query.slice(0, 500), // Truncate for storage
        metadata: {
          queryType,
          fullQuery: query,
          context,
          contractId,
          responseTime,
          tokensUsed,
          model: model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
          success,
          errorMessage,
          ragResults,
          userFeedback,
          ...metadata } } });

    return createSuccessResponse(ctx, {
      id: auditEntry.id,
      logged: true });

  });

/**
 * GET - Get AI query history and analytics
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const { searchParams } = new URL(request.url);
    
    const queryType = searchParams.get('queryType') as AIQueryType | null;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const days = parseInt(searchParams.get('days') || '30');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build where clause
    const whereClause: Record<string, unknown> = {
      tenantId,
      action: queryType ? `ai.${queryType}` : { startsWith: 'ai.' },
      createdAt: { gte: startDate } };

    // Get paginated history
    const [history, totalCount, analytics] = await Promise.all([
      prisma.auditLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          action: true,
          resource: true,
          createdAt: true,
          metadata: true } }),
      prisma.auditLog.count({ where: whereClause }),
      // Get aggregated analytics
      prisma.auditLog.groupBy({
        by: ['action'],
        where: { 
          tenantId, 
          action: { startsWith: 'ai.' },
          createdAt: { gte: startDate } },
        _count: true }),
    ]);

    // Calculate analytics
    const queryTypeBreakdown = analytics.reduce((acc, item) => {
      const type = item.action.replace('ai.', '');
      acc[type] = item._count;
      return acc;
    }, {} as Record<string, number>);

    // Get success rate
    const successfulQueries = await prisma.auditLog.count({
      where: {
        ...whereClause,
        metadata: {
          path: ['success'],
          equals: true } } });

    const successRate = totalCount > 0 
      ? Math.round((successfulQueries / totalCount) * 100) 
      : 100;

    return createSuccessResponse(ctx, {
      history: history.map(h => ({
        id: h.id,
        queryType: h.action.replace('ai.', ''),
        query: h.resource,
        timestamp: h.createdAt,
        ...(h.metadata as any) })),
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit) },
      analytics: {
        totalQueries: totalCount,
        queryTypeBreakdown,
        successRate,
        period: `Last ${days} days` } });

  });
