/**
 * AI Contract Analysis API
 * 
 * POST /api/ai/analyze - Deep analysis of contract content
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { getServerTenantId } from '@/lib/tenant-server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

interface AnalysisResult {
  summary: string;
  keyTerms: KeyTerm[];
  risks: RiskItem[];
  obligations: Obligation[];
  recommendations: string[];
  metadata: {
    analyzedAt: string;
    wordCount: number;
    processingTime: number;
  };
}

interface KeyTerm {
  term: string;
  value: string;
  category: 'financial' | 'temporal' | 'legal' | 'operational';
  importance: 'high' | 'medium' | 'low';
}

interface RiskItem {
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  mitigation?: string;
  clause?: string;
}

interface Obligation {
  title: string;
  description: string;
  party: 'us' | 'them' | 'mutual';
  deadline?: string;
  type: 'payment' | 'delivery' | 'compliance' | 'reporting' | 'other';
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { contractId, analysisType = 'full' } = body;

    if (!contractId) {
      return NextResponse.json(
        { error: 'contractId is required' },
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

    // Fetch contract
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        fileName: true,
        rawText: true,
        tenantId: true,
        status: true,
        createdAt: true,
      },
    });

    if (!contract) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      );
    }

    if (contract.tenantId !== tenantId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    if (!contract.rawText) {
      return NextResponse.json(
        { error: 'Contract has no text content to analyze' },
        { status: 400 }
      );
    }

    // Truncate for token limits
    const maxTextLength = 15000;
    const contractText = contract.rawText.slice(0, maxTextLength);

    // Build analysis prompt based on type
    const analysisPrompt = getAnalysisPrompt(analysisType, contractText);

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert legal contract analyst. Analyze contracts thoroughly and provide structured insights. Always respond in valid JSON format.`,
        },
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const responseContent = completion.choices[0]?.message?.content || '{}';
    
    let analysis: Partial<AnalysisResult>;
    try {
      analysis = JSON.parse(responseContent);
    } catch {
      analysis = { summary: responseContent, keyTerms: [], risks: [], obligations: [], recommendations: [] };
    }

    const processingTime = Date.now() - startTime;

    const result: AnalysisResult = {
      summary: analysis.summary || 'Analysis completed',
      keyTerms: analysis.keyTerms || [],
      risks: analysis.risks || [],
      obligations: analysis.obligations || [],
      recommendations: analysis.recommendations || [],
      metadata: {
        analyzedAt: new Date().toISOString(),
        wordCount: contract.rawText.split(/\s+/).length,
        processingTime,
      },
    };

    return NextResponse.json({
      success: true,
      contractId,
      contractName: contract.fileName,
      analysisType,
      ...result,
    });

  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed',
        processingTime: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

function getAnalysisPrompt(type: string, contractText: string): string {
  const baseInstruction = `Analyze this contract and provide a JSON response with the following structure:
{
  "summary": "2-3 paragraph executive summary",
  "keyTerms": [
    { "term": "Term name", "value": "Extracted value", "category": "financial|temporal|legal|operational", "importance": "high|medium|low" }
  ],
  "risks": [
    { "title": "Risk title", "description": "Description", "severity": "critical|high|medium|low", "mitigation": "Suggested mitigation", "clause": "Relevant clause reference" }
  ],
  "obligations": [
    { "title": "Obligation", "description": "Description", "party": "us|them|mutual", "deadline": "Date if applicable", "type": "payment|delivery|compliance|reporting|other" }
  ],
  "recommendations": ["Recommendation 1", "Recommendation 2", ...]
}`;

  switch (type) {
    case 'risks':
      return `${baseInstruction}\n\nFocus specifically on identifying ALL risks in this contract. Include severity ratings and specific mitigation suggestions.\n\nContract text:\n${contractText}`;
    
    case 'obligations':
      return `${baseInstruction}\n\nFocus specifically on extracting ALL obligations from this contract. Clearly identify which party is responsible.\n\nContract text:\n${contractText}`;
    
    case 'summary':
      return `Provide ONLY a detailed executive summary (3-4 paragraphs) of this contract. Include key terms, parties, duration, and value. Respond with JSON: { "summary": "..." }\n\nContract text:\n${contractText}`;
    
    case 'full':
    default:
      return `${baseInstruction}\n\nProvide a comprehensive analysis covering all aspects.\n\nContract text:\n${contractText}`;
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/ai/analyze',
    method: 'POST',
    description: 'AI-powered contract analysis',
    parameters: {
      contractId: { type: 'string', required: true },
      analysisType: { 
        type: 'string', 
        required: false, 
        default: 'full',
        options: ['full', 'risks', 'obligations', 'summary'],
      },
    },
    returns: {
      summary: 'Executive summary',
      keyTerms: 'Extracted key terms and values',
      risks: 'Identified risks with severity',
      obligations: 'Party obligations',
      recommendations: 'AI recommendations',
    },
  });
}
