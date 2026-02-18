/**
 * AI Contract Analysis API
 * 
 * POST /api/ai/analyze - Deep analysis of contract content
 */

import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { analyticalIntelligenceService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '' });

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

export const POST = withAuthApiHandler(async (request, ctx) => {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { contractId, analysisType = 'full' } = body;

    if (!contractId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'contractId is required', 400);
    }

    if (!process.env.OPENAI_API_KEY) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'OpenAI API key not configured', 500);
    }

    // Fetch contract
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        fileName: true,
        rawText: true,
        tenantId: true,
        status: true,
        createdAt: true } });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    if (contract.tenantId !== ctx.tenantId) {
      return createErrorResponse(ctx, 'FORBIDDEN', 'Access denied', 403);
    }

    if (!contract.rawText) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract has no text content to analyze', 400);
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
          content: `You are an expert legal contract analyst. Analyze contracts thoroughly and provide structured insights. Always respond in valid JSON format.` },
        {
          role: 'user',
          content: analysisPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' } });

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
        processingTime } };

    return createSuccessResponse(ctx, {
      contractId,
      contractName: contract.fileName,
      analysisType,
      ...result });

  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
});

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

export const GET = withAuthApiHandler(async (_request, ctx) => {
  return createSuccessResponse(ctx, {
    endpoint: '/api/ai/analyze',
    method: 'POST',
    description: 'AI-powered contract analysis',
    parameters: {
      contractId: { type: 'string', required: true },
      analysisType: { 
        type: 'string', 
        required: false, 
        default: 'full',
        options: ['full', 'risks', 'obligations', 'summary'] } },
    returns: {
      summary: 'Executive summary',
      keyTerms: 'Extracted key terms and values',
      risks: 'Identified risks with severity',
      obligations: 'Party obligations',
      recommendations: 'AI recommendations' } });
});
