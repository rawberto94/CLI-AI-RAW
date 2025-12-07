/**
 * Search Suggestions API
 * Returns typeahead suggestions for the intelligent search
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface Suggestion {
  id: string;
  type: 'contract' | 'supplier' | 'category' | 'ai_suggestion';
  title: string;
  subtitle?: string;
  href: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q')?.trim() || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '8'), 20);

    if (!query || query.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    const suggestions: Suggestion[] = [];

    // Search contracts
    try {
      const contracts = await prisma.contract.findMany({
        where: {
          OR: [
            { contractTitle: { contains: query, mode: 'insensitive' } },
            { supplierName: { contains: query, mode: 'insensitive' } },
            { clientName: { contains: query, mode: 'insensitive' } },
            { fileName: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          contractTitle: true,
          supplierName: true,
          clientName: true,
          fileName: true,
          status: true,
        },
        take: Math.floor(limit / 2),
        orderBy: { updatedAt: 'desc' },
      });

      contracts.forEach((contract) => {
        suggestions.push({
          id: `contract-${contract.id}`,
          type: 'contract',
          title: contract.contractTitle || contract.fileName || 'Untitled Contract',
          subtitle: contract.supplierName || contract.clientName || undefined,
          href: `/contracts/${contract.id}`,
        });
      });
    } catch {
      // Database might not be available
    }

    // Get unique suppliers from contracts
    try {
      const suppliers = await prisma.contract.findMany({
        where: {
          supplierName: { contains: query, mode: 'insensitive' },
        },
        select: {
          supplierName: true,
        },
        distinct: ['supplierName'],
        take: 3,
      });

      suppliers.forEach((s) => {
        if (s.supplierName) {
          suggestions.push({
            id: `supplier-${s.supplierName}`,
            type: 'supplier',
            title: s.supplierName,
            subtitle: 'Supplier',
            href: `/contracts?supplier=${encodeURIComponent(s.supplierName)}`,
          });
        }
      });
    } catch {
      // Ignore
    }

    // Always add AI suggestion if we have a query
    suggestions.push({
      id: 'ai-search',
      type: 'ai_suggestion',
      title: `Search for "${query}"`,
      subtitle: 'Search all contracts and documents',
      href: `/search?q=${encodeURIComponent(query)}`,
    });

    suggestions.push({
      id: 'ai-chat',
      type: 'ai_suggestion',
      title: `Ask AI about "${query}"`,
      subtitle: 'Get AI-powered insights',
      href: `/ai/chat?q=${encodeURIComponent(query)}`,
    });

    return NextResponse.json({
      success: true,
      suggestions: suggestions.slice(0, limit),
      query,
    });
  } catch (error) {
    console.error('Search suggestions error:', error);
    
    // Return fallback suggestions
    const query = request.nextUrl.searchParams.get('q') || '';
    return NextResponse.json({
      success: true,
      suggestions: [
        {
          id: 'search-all',
          type: 'ai_suggestion',
          title: `Search for "${query}"`,
          subtitle: 'Search all contracts',
          href: `/search?q=${encodeURIComponent(query)}`,
        },
        {
          id: 'ai-ask',
          type: 'ai_suggestion',
          title: `Ask AI about "${query}"`,
          subtitle: 'Get AI-powered insights',
          href: `/ai/chat?q=${encodeURIComponent(query)}`,
        },
      ],
    });
  }
}
