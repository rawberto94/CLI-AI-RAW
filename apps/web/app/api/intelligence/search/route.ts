import { NextRequest, NextResponse } from 'next/server';

// Mock search results with semantic relevance
const mockDocuments = [
  {
    id: 'doc1',
    title: 'Master Services Agreement - Acme Corp',
    content: 'This Master Services Agreement establishes the terms and conditions for professional services...',
    type: 'contract',
    relevanceScore: 0.95,
    highlights: ['professional services', 'terms and conditions'],
    metadata: {
      date: '2024-01-15',
      status: 'active',
      value: 1200000,
    },
  },
  {
    id: 'doc2',
    title: 'Cloud Services SLA',
    content: 'Service Level Agreement defining uptime guarantees, response times, and support tiers...',
    type: 'contract',
    relevanceScore: 0.87,
    highlights: ['uptime guarantees', 'support tiers'],
    metadata: {
      date: '2024-02-20',
      status: 'active',
      value: 450000,
    },
  },
  {
    id: 'doc3',
    title: 'Liability Limitation Clause Template',
    content: 'Standard liability limitation clause limiting consequential damages and capping liability...',
    type: 'clause',
    relevanceScore: 0.82,
    highlights: ['liability limitation', 'consequential damages'],
    metadata: {
      category: 'legal',
      usage: 15,
    },
  },
  {
    id: 'doc4',
    title: 'Vendor Risk Assessment - Q1 2024',
    content: 'Quarterly vendor risk assessment covering financial stability, compliance, and performance...',
    type: 'report',
    relevanceScore: 0.78,
    highlights: ['vendor risk', 'compliance'],
    metadata: {
      date: '2024-03-01',
      vendors: 12,
    },
  },
  {
    id: 'doc5',
    title: 'Renewal Playbook - Enterprise Contracts',
    content: 'Guidelines for negotiating enterprise contract renewals including pricing strategies...',
    type: 'playbook',
    relevanceScore: 0.75,
    highlights: ['renewal', 'pricing strategies'],
    metadata: {
      version: '2.1',
      lastUpdated: '2024-02-15',
    },
  },
];

// Natural language query understanding
function parseQuery(query: string) {
  const lowerQuery = query.toLowerCase();
  
  // Extract intent
  let intent = 'search';
  if (lowerQuery.includes('show') || lowerQuery.includes('find') || lowerQuery.includes('get')) {
    intent = 'retrieve';
  } else if (lowerQuery.includes('compare')) {
    intent = 'compare';
  } else if (lowerQuery.includes('summarize') || lowerQuery.includes('summary')) {
    intent = 'summarize';
  }

  // Extract filters
  const filters: Record<string, string> = {};
  if (lowerQuery.includes('active')) filters.status = 'active';
  if (lowerQuery.includes('expired')) filters.status = 'expired';
  if (lowerQuery.includes('contract')) filters.type = 'contract';
  if (lowerQuery.includes('clause')) filters.type = 'clause';

  // Extract entities
  const entities: string[] = [];
  const entityPatterns = ['acme', 'sla', 'liability', 'renewal', 'vendor'];
  entityPatterns.forEach(pattern => {
    if (lowerQuery.includes(pattern)) entities.push(pattern);
  });

  return { intent, filters, entities };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, filters, limit = 10, includeContext = true } = body;

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    // Parse natural language query
    const parsedQuery = parseQuery(query);
    
    // Filter and score documents
    let results = mockDocuments.map(doc => ({
      ...doc,
      // Adjust relevance based on query terms
      relevanceScore: doc.relevanceScore * (
        doc.title.toLowerCase().includes(query.toLowerCase()) ? 1.2 : 1
      ),
    }));

    // Apply type filter
    if (filters?.type || parsedQuery.filters.type) {
      const typeFilter = filters?.type || parsedQuery.filters.type;
      results = results.filter(doc => doc.type === typeFilter);
    }

    // Apply status filter
    if (filters?.status || parsedQuery.filters.status) {
      const statusFilter = filters?.status || parsedQuery.filters.status;
      results = results.filter(doc => doc.metadata.status === statusFilter);
    }

    // Sort by relevance
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Limit results
    results = results.slice(0, limit);

    // Generate AI summary if requested
    let aiSummary = null;
    if (includeContext && results.length > 0) {
      aiSummary = {
        interpretation: `Found ${results.length} relevant documents for "${query}"`,
        keyInsights: [
          `Most relevant: ${results[0]?.title}`,
          `Document types: ${[...new Set(results.map(r => r.type))].join(', ')}`,
        ],
        suggestedActions: [
          'Review highlighted sections',
          'Compare with similar clauses',
          'Check for compliance requirements',
        ],
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        results,
        totalCount: results.length,
        query: {
          original: query,
          parsed: parsedQuery,
        },
        aiSummary,
        suggestions: [
          'Show me all active contracts with Acme',
          'Find liability clauses in master agreements',
          'Compare renewal terms across vendors',
        ],
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const type = searchParams.get('type');
  const limit = parseInt(searchParams.get('limit') || '10');

  // Simple GET search
  let results = mockDocuments;
  
  if (query) {
    results = results.filter(doc =>
      doc.title.toLowerCase().includes(query.toLowerCase()) ||
      doc.content.toLowerCase().includes(query.toLowerCase())
    );
  }

  if (type) {
    results = results.filter(doc => doc.type === type);
  }

  return NextResponse.json({
    success: true,
    data: {
      results: results.slice(0, limit),
      totalCount: results.length,
    },
  });
}
