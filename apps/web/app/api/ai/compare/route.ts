/**
 * AI Contract Comparison API
 * 
 * POST /api/ai/compare - Compare two or more contracts
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { getServerTenantId } from '@/lib/tenant-server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

interface ComparisonResult {
  summary: string;
  similarities: Similarity[];
  differences: Difference[];
  recommendations: string[];
  winner?: {
    contractId: string;
    contractName: string;
    reason: string;
  };
}

interface Similarity {
  aspect: string;
  description: string;
  contracts: string[];
}

interface Difference {
  aspect: string;
  category: 'terms' | 'pricing' | 'liability' | 'duration' | 'scope' | 'other';
  importance: 'critical' | 'high' | 'medium' | 'low';
  values: { contractId: string; contractName: string; value: string }[];
  recommendation?: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { contractIds, comparisonFocus = 'all' } = body;

    if (!contractIds || !Array.isArray(contractIds) || contractIds.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 contractIds are required' },
        { status: 400 }
      );
    }

    if (contractIds.length > 5) {
      return NextResponse.json(
        { error: 'Maximum 5 contracts can be compared at once' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const tenantId = await getServerTenantId();

    // Fetch all contracts
    const contracts = await prisma.contract.findMany({
      where: {
        id: { in: contractIds },
        tenantId,
      },
      select: {
        id: true,
        fileName: true,
        rawText: true,
      },
    });

    if (contracts.length < 2) {
      return NextResponse.json(
        { error: 'Could not find enough contracts to compare' },
        { status: 404 }
      );
    }

    const contractsWithText = contracts.filter(c => c.rawText && c.rawText.length > 100);
    
    if (contractsWithText.length < 2) {
      return NextResponse.json(
        { error: 'Not enough contracts have extractable text for comparison' },
        { status: 400 }
      );
    }

    console.log(`🔍 Comparing ${contractsWithText.length} contracts`);

    // Prepare contract summaries for comparison (truncated)
    const contractSummaries = contractsWithText.map(c => ({
      id: c.id,
      name: c.fileName,
      text: c.rawText!.slice(0, 5000),
    }));

    const comparisonPrompt = `Compare these ${contractSummaries.length} contracts and provide analysis in JSON format:

${contractSummaries.map((c, i) => `
=== Contract ${i + 1}: ${c.name} ===
${c.text}
`).join('\n')}

Provide a JSON response with this structure:
{
  "summary": "Overall comparison summary (2-3 paragraphs)",
  "similarities": [
    { "aspect": "What's similar", "description": "Description", "contracts": ["contract1", "contract2"] }
  ],
  "differences": [
    { 
      "aspect": "What differs", 
      "category": "terms|pricing|liability|duration|scope|other",
      "importance": "critical|high|medium|low",
      "values": [
        { "contractId": "id", "contractName": "name", "value": "Value in this contract" }
      ],
      "recommendation": "Which is better and why"
    }
  ],
  "recommendations": ["Overall recommendations for negotiation or selection"],
  "winner": { 
    "contractId": "id of best contract", 
    "contractName": "name",
    "reason": "Why this contract is preferred"
  }
}

Focus on: ${comparisonFocus === 'all' ? 'all aspects' : comparisonFocus}`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert legal contract analyst specializing in contract comparison. Provide detailed, actionable comparisons in JSON format.',
        },
        {
          role: 'user',
          content: comparisonPrompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2500,
      response_format: { type: 'json_object' },
    });

    const responseContent = completion.choices[0]?.message?.content || '{}';
    
    let comparison: Partial<ComparisonResult>;
    try {
      comparison = JSON.parse(responseContent);
    } catch {
      comparison = { summary: 'Comparison analysis completed', similarities: [], differences: [], recommendations: [] };
    }

    const processingTime = Date.now() - startTime;

    console.log(`✅ Comparison complete in ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      contractsCompared: contractsWithText.map(c => ({ id: c.id, name: c.fileName })),
      comparisonFocus,
      ...comparison,
      metadata: {
        analyzedAt: new Date().toISOString(),
        processingTime,
      },
    });

  } catch (error: any) {
    console.error('Contract comparison error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Comparison failed',
        processingTime: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/ai/compare',
    method: 'POST',
    description: 'AI-powered contract comparison',
    parameters: {
      contractIds: { 
        type: 'array', 
        required: true, 
        description: 'Array of 2-5 contract IDs to compare' 
      },
      comparisonFocus: { 
        type: 'string', 
        required: false, 
        default: 'all',
        options: ['all', 'pricing', 'liability', 'terms', 'duration'],
      },
    },
    returns: {
      summary: 'Overall comparison summary',
      similarities: 'Common elements across contracts',
      differences: 'Key differences with importance ratings',
      recommendations: 'AI recommendations',
      winner: 'Best contract recommendation',
    },
  });
}
