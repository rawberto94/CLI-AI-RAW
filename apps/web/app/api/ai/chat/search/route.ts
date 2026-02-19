/**
 * AI Chat Search API
 *
 * GET /api/ai/chat/search?q=...&limit=50&dateRange=all&role=all&hasContract=all
 *
 * Full-text search across ChatMessage records.
 * Returns results shaped for the ChatHistorySearch component.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, type AuthenticatedApiContext, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { tenantId, userId } = ctx;
  const { searchParams } = new URL(request.url);

  const q = searchParams.get('q')?.trim();
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
  const dateRange = searchParams.get('dateRange') || 'all';
  const role = searchParams.get('role') || 'all';
  const hasContract = searchParams.get('hasContract') || 'all';
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!q) {
    return createSuccessResponse(ctx, { results: [] });
  }

  try {
    // Build message where clause
    const messageWhere: Record<string, unknown> = {
      content: { contains: q, mode: 'insensitive' },
      conversation: { tenantId, userId, isArchived: false },
    };

    // Role filter
    if (role === 'user' || role === 'assistant' || role === 'system') {
      messageWhere.role = role;
    }

    // Date range filter
    const now = new Date();
    if (dateRange === 'today') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      messageWhere.createdAt = { gte: start };
    } else if (dateRange === 'week') {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      messageWhere.createdAt = { gte: start };
    } else if (dateRange === 'month') {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      messageWhere.createdAt = { gte: start };
    } else if (dateRange === 'custom') {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      if (Object.keys(dateFilter).length > 0) {
        messageWhere.createdAt = dateFilter;
      }
    }

    // Contract filter — check metadata JSON field
    // hasContract uses the presence of sources/contractId in metadata
    // We filter post-query since metadata is JSON

    const messages = await prisma.chatMessage.findMany({
      where: messageWhere,
      include: {
        conversation: {
          select: {
            id: true,
            title: true,
            createdAt: true,
            context: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit * 2, // Over-fetch for post-query contract filter
    });

    // Transform to SearchResult shape
    let results = messages.map((msg) => {
      // Extract a snippet around the match
      const content = msg.content || '';
      const lowerContent = content.toLowerCase();
      const lowerQ = q.toLowerCase();
      const matchIdx = lowerContent.indexOf(lowerQ);
      const snippetStart = Math.max(0, matchIdx - 60);
      const snippetEnd = Math.min(content.length, matchIdx + q.length + 60);
      const matchedText = (snippetStart > 0 ? '…' : '') +
        content.slice(snippetStart, snippetEnd) +
        (snippetEnd < content.length ? '…' : '');

      const sourcesData = (msg.sources && typeof msg.sources === 'object') ? msg.sources as Record<string, unknown> : {};

      return {
        message: {
          id: msg.id,
          conversationId: msg.conversationId,
          role: msg.role,
          content: content.length > 300 ? content.slice(0, 300) + '…' : content,
          timestamp: msg.createdAt.toISOString(),
          metadata: {
            model: msg.model || undefined,
            tokens: msg.tokensUsed || undefined,
            contractId: (sourcesData.contractId as string) || undefined,
            contractName: (sourcesData.contractName as string) || undefined,
          },
        },
        conversationTitle: msg.conversation?.title || 'Untitled',
        conversationDate: msg.conversation?.createdAt?.toISOString() || msg.createdAt.toISOString(),
        matchedText,
        score: matchIdx === 0 ? 1.0 : matchIdx > 0 ? 0.8 : 0.5,
      };
    });

    // Post-query contract filter
    if (hasContract === 'yes') {
      results = results.filter(r => r.message.metadata?.contractId);
    } else if (hasContract === 'no') {
      results = results.filter(r => !r.message.metadata?.contractId);
    }

    // Trim to requested limit
    results = results.slice(0, limit);

    return createSuccessResponse(ctx, { results });
  } catch (error) {
    console.error('[Chat Search] Error:', error);
    return createErrorResponse(ctx, 'SEARCH_ERROR', 'Search failed', 500);
  }
});
