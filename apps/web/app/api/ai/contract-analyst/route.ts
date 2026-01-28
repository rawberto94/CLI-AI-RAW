/**
 * Contract AI Analyst API
 * 
 * This endpoint handles contract-specific AI analysis queries.
 * It uses RAG to retrieve relevant contract sections and generates
 * contextual answers with source citations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hybridSearch, type SearchFilters } from '@/lib/rag/advanced-rag.service';
import OpenAI from 'openai';

// ============================================================================
// Types
// ============================================================================

interface ContractAnalystRequest {
  contractId: string;
  query: string;
  context?: {
    name?: string;
    supplier?: string;
    type?: string;
    value?: number;
  };
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

interface SourceReference {
  section?: string;
  pageNumber?: number;
  excerpt: string;
  relevance: number;
}

interface ContractAnalystResponse {
  answer: string;
  confidence: number;
  sources: SourceReference[];
  suggestions?: string[];
  relatedQueries?: string[];
}

// ============================================================================
// Prompt Templates
// ============================================================================

const SYSTEM_PROMPT = `You are an expert contract analyst assistant for the Contigo platform. Your role is to answer specific questions about contracts by analyzing their content carefully.

**Your Responsibilities:**
1. Answer questions accurately based ONLY on the provided contract content
2. Cite specific sections or clauses when referencing the contract
3. Highlight any risks, obligations, or important deadlines
4. If information is not found in the contract, clearly state that
5. Provide actionable insights when relevant

**Response Guidelines:**
- Be concise but thorough
- Use bullet points for lists of items or obligations
- Quote relevant text when it directly answers the question
- If the answer is ambiguous, explain the different interpretations
- Flag any concerning or unusual clauses
- Suggest follow-up questions if relevant

**Domain Knowledge:**
- Understand common contract terms: indemnification, force majeure, limitation of liability, termination for cause/convenience
- Recognize standard vs non-standard clauses
- Identify potential compliance or risk issues
- Understand procurement and vendor management contexts

**Output Format:**
Provide a clear, structured response. If citing specific sections, format as "According to [Section Name]: [quote or paraphrase]"`;

const CONTEXT_PROMPT_TEMPLATE = (
  contractName: string,
  supplierName?: string,
  contractType?: string,
  totalValue?: number
) => `
**Contract Context:**
- Contract Name: ${contractName}
- Supplier: ${supplierName || 'Not specified'}
- Contract Type: ${contractType || 'Not specified'}
- Total Value: ${totalValue ? `$${totalValue.toLocaleString()}` : 'Not specified'}
`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate follow-up question suggestions based on the query and response
 */
async function generateSuggestions(
  query: string,
  answer: string,
  openai: OpenAI
): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Generate 3 relevant follow-up questions a user might ask after getting an answer about a contract. 
Return ONLY a JSON array of strings, no explanation.
Questions should be specific and actionable, not generic.`,
        },
        {
          role: 'user',
          content: `Original question: "${query}"
Answer summary: "${answer.slice(0, 500)}"

Generate 3 follow-up questions:`,
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    let content = response.choices[0]?.message?.content || '[]';
    content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(content);
  } catch {
    return [];
  }
}

/**
 * Calculate confidence score based on source relevance
 */
function calculateConfidence(sources: SourceReference[]): number {
  if (sources.length === 0) return 0.3;
  
  const avgRelevance = sources.reduce((sum, s) => sum + s.relevance, 0) / sources.length;
  const coverageBonus = Math.min(sources.length / 5, 0.2); // Up to 0.2 bonus for multiple sources
  
  return Math.min(avgRelevance + coverageBonus, 1);
}

// ============================================================================
// Main Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request
    const body: ContractAnalystRequest = await request.json();
    const { contractId, query, context, conversationHistory } = body;

    if (!contractId || !query) {
      return NextResponse.json(
        { error: 'Contract ID and query are required' },
        { status: 400 }
      );
    }

    // Verify user has access to this contract
    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        tenantId: session.user.tenantId,
      },
      select: {
        id: true,
        contractTitle: true,
        fileName: true,
        originalName: true,
        status: true,
        rawText: true,
        supplierName: true,
        contractType: true,
        totalValue: true,
        startDate: true,
        endDate: true,
        tenantId: true,
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: 'Contract not found or access denied' },
        { status: 404 }
      );
    }

    // Initialize OpenAI
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 503 }
      );
    }

    const openai = new OpenAI({ apiKey });

    // Search for relevant contract sections using RAG
    const searchFilters: SearchFilters = {
      contractIds: [contractId],
      tenantId: contract.tenantId,
    };

    const searchResults = await hybridSearch(query, {
      mode: 'hybrid',
      k: 8,
      minScore: 0.3,
      filters: searchFilters,
      rerank: true,
      expandQuery: true,
    });

    // Build context from search results
    let contractContext = '';
    const sources: SourceReference[] = [];

    if (searchResults.length > 0) {
      contractContext = searchResults
        .map((result, idx) => {
          // Add to sources
          sources.push({
            section: result.metadata?.section || result.metadata?.heading,
            pageNumber: result.metadata?.pageNumber,
            excerpt: result.text.slice(0, 300) + (result.text.length > 300 ? '...' : ''),
            relevance: result.score,
          });

          return `[Section ${idx + 1}${result.metadata?.heading ? `: ${result.metadata.heading}` : ''}]
${result.text}`;
        })
        .join('\n\n---\n\n');
    } else if (contract.rawText) {
      // Fallback to full extracted text if no embeddings found
      contractContext = contract.rawText.slice(0, 8000);
      sources.push({
        excerpt: 'Full contract text (no specific section identified)',
        relevance: 0.5,
      });
    }

    // Build conversation messages
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `${CONTEXT_PROMPT_TEMPLATE(
          context?.name || contract.contractTitle || contract.originalName || contract.fileName,
          context?.supplier || contract.supplierName || undefined,
          context?.type || contract.contractType || undefined,
          context?.value || (contract.totalValue ? Number(contract.totalValue) : undefined)
        )}

**Relevant Contract Sections:**
${contractContext || 'No specific contract content available. Please provide a general response based on contract analysis best practices.'}

---

**User Question:** ${query}`,
      },
    ];

    // Add conversation history if provided (for multi-turn conversations)
    if (conversationHistory && conversationHistory.length > 0) {
      // Insert history after system message but before current query
      const historyMessages: OpenAI.ChatCompletionMessageParam[] = conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));
      messages.splice(1, 0, ...historyMessages);
    }

    // Generate response
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      temperature: 0.3, // Lower temperature for more factual responses
      max_tokens: 1500,
    });

    const answer = completion.choices[0]?.message?.content || 'Unable to generate response.';

    // Calculate confidence based on sources
    const confidence = calculateConfidence(sources);

    // Generate follow-up suggestions (non-blocking)
    const suggestions = await generateSuggestions(query, answer, openai);

    // Prepare response
    const response: ContractAnalystResponse = {
      answer,
      confidence,
      sources,
      suggestions,
      relatedQueries: suggestions.slice(0, 3),
    };

    // Log usage for analytics (non-blocking)
    prisma.aIUsageLog.create({
      data: {
        tenantId: contract.tenantId,
        userId: session.user.id,
        contractId: contractId,
        feature: 'contract_analyst',
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        endpoint: '/api/ai/contract-analyst',
        inputTokens: completion.usage?.prompt_tokens || 0,
        outputTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
        latencyMs: 0, // Could track actual latency
        success: true,
        metadata: JSON.stringify({
          query: query.slice(0, 200),
          confidence,
          sourcesCount: sources.length,
        }),
      },
    }).catch(() => {
      // Ignore logging errors
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Contract Analyst] Error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze contract' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Streaming Handler (for real-time responses)
// ============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get('contractId');
  const query = searchParams.get('query');

  if (!contractId || !query) {
    return NextResponse.json(
      { error: 'Contract ID and query are required' },
      { status: 400 }
    );
  }

  // For GET requests, redirect to POST with streaming
  return NextResponse.json(
    { message: 'Use POST method for contract analysis' },
    { status: 405 }
  );
}
