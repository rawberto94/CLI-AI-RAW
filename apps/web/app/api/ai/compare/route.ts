/**
 * AI Contract Comparison API
 * 
 * POST /api/ai/compare - Compare two or more contracts
 */

import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { createOpenAIClient, getOpenAIApiKey, hasAIClientConfig } from '@/lib/openai-client';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { auditLog, AuditAction } from '@/lib/security/audit';
import { checkRateLimit, rateLimitResponse, AI_RATE_LIMITS } from '@/lib/ai/rate-limit';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const key = getOpenAIApiKey();
    if (!key) throw new Error('OPENAI_API_KEY is not configured');
    _openai = createOpenAIClient(key);
  }
  return _openai;
}
const openai = new Proxy({} as OpenAI, { get: (_, prop) => (getOpenAI() as any)[prop] });

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

export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
  const startTime = Date.now();

  // Rate limit AI comparisons
  const rl = checkRateLimit(ctx.tenantId, ctx.userId, '/api/ai/compare', AI_RATE_LIMITS.standard);
  if (!rl.allowed) return rateLimitResponse(rl, ctx.requestId);

  try {
    const body = await request.json();
    const { contractIds, comparisonFocus = 'all' } = body;

    if (!contractIds || !Array.isArray(contractIds) || contractIds.length < 2) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'At least 2 contractIds are required', 400);
    }

    if (contractIds.length > 5) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Maximum 5 contracts can be compared at once', 400);
    }

    if (!hasAIClientConfig()) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'OpenAI API key not configured', 500);
    }

    // Fetch contracts with metadata + artifacts for richer comparison
    const contracts = await prisma.contract.findMany({
      where: {
        id: { in: contractIds },
        tenantId },
      select: {
        id: true,
        fileName: true,
        rawText: true,
        contractType: true,
        contractTitle: true,
        clientName: true,
        supplierName: true,
        totalValue: true,
        currency: true,
        effectiveDate: true,
        expirationDate: true,
        jurisdiction: true,
        paymentTerms: true,
        signatureStatus: true,
        status: true,
        artifacts: {
          where: { type: { in: ['CLAUSES', 'RISK', 'FINANCIAL', 'OBLIGATIONS'] } },
          select: { type: true, content: true },
          take: 4,
        },
      },
    });

    if (contracts.length < 2) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Could not find enough contracts to compare', 404);
    }

    const contractsWithText = contracts.filter(c => c.rawText && c.rawText.length > 100);
    
    if (contractsWithText.length < 2) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Not enough contracts have extractable text for comparison', 400);
    }

    // Build rich contract summaries with metadata + artifact excerpts
    const contractSummaries = contractsWithText.map(c => {
      const metadata = [
        c.contractType && `Type: ${c.contractType}`,
        c.clientName && `Client: ${c.clientName}`,
        c.supplierName && `Supplier: ${c.supplierName}`,
        c.totalValue && `Value: ${c.currency || 'USD'} ${Number(c.totalValue).toLocaleString()}`,
        c.effectiveDate && `Effective: ${c.effectiveDate.toISOString().split('T')[0]}`,
        c.expirationDate && `Expires: ${c.expirationDate.toISOString().split('T')[0]}`,
        c.jurisdiction && `Jurisdiction: ${c.jurisdiction}`,
        c.paymentTerms && `Payment: ${c.paymentTerms}`,
        c.signatureStatus && `Signature: ${c.signatureStatus}`,
      ].filter(Boolean).join('\n');

      // Include artifact summaries for structured comparison
      const artifactSummaries = (c.artifacts || []).map(a => {
        const content = typeof a.content === 'string' ? a.content : JSON.stringify(a.content);
        return `[${a.type}]: ${content.slice(0, 1500)}`;
      }).join('\n');

      // Use more text per contract (10K instead of 5K)
      const textBudget = Math.floor(40000 / contractsWithText.length);
      return {
        id: c.id,
        name: c.contractTitle || c.fileName,
        metadata,
        artifacts: artifactSummaries,
        text: c.rawText!.slice(0, textBudget),
      };
    });

    const focusInstructions = comparisonFocus === 'all'
      ? 'Analyze all aspects comprehensively: pricing, liability, terms, duration, scope, IP, data privacy, termination, indemnification.'
      : `Focus specifically on: ${comparisonFocus}. Be thorough on this aspect.`;

    const comparisonPrompt = `Compare these ${contractSummaries.length} contracts in detail.

${contractSummaries.map((c, i) => `
=== Contract ${i + 1}: ${c.name} (ID: ${c.id}) ===
--- Metadata ---
${c.metadata || 'No metadata available'}
${c.artifacts ? `--- Extracted Artifacts ---\n${c.artifacts}` : ''}
--- Contract Text ---
${c.text}
`).join('\n')}

${focusInstructions}

Return JSON with this structure:
{
  "summary": "Comprehensive comparison (3-4 paragraphs covering key findings, relative strengths, and overall assessment)",
  "similarities": [
    { "aspect": "What's similar", "description": "Detailed description", "contracts": ["contract names"] }
  ],
  "differences": [
    { 
      "aspect": "What differs", 
      "category": "terms|pricing|liability|duration|scope|ip|privacy|termination|indemnification|other",
      "importance": "critical|high|medium|low",
      "values": [
        { "contractId": "id", "contractName": "name", "value": "Specific language or terms in this contract" }
      ],
      "recommendation": "Which position is better and why, with suggested negotiation approach",
      "riskImplication": "How this difference affects risk exposure"
    }
  ],
  "clauseComparison": [
    {
      "clauseType": "Name of clause (e.g., Limitation of Liability, Indemnification, Termination)",
      "present": [{ "contractId": "id", "contractName": "name", "language": "Key language used" }],
      "absent": ["Contract names where this clause is missing"],
      "bestVersion": "Which contract has the strongest version and why"
    }
  ],
  "riskAssessment": {
    "overallRiskRanking": [{ "contractId": "id", "contractName": "name", "riskLevel": "low|medium|high", "keyRisks": ["risk1", "risk2"] }],
    "gaps": ["Important protections missing from one or more contracts"]
  },
  "recommendations": ["Actionable recommendations for negotiation, selection, or improvement"],
  "winner": { 
    "contractId": "id of best contract overall", 
    "contractName": "name",
    "reason": "Detailed justification with key advantages",
    "caveats": "Important limitations or areas where other contracts are better"
  }
}

Be specific with contract language references. Identify clause-level differences, not just topical summaries.`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert legal contract analyst. You specialize in clause-level comparison, risk assessment, and providing actionable negotiation guidance. Analyze contracts thoroughly and identify both obvious and subtle differences that could impact the contracting party's position. Always reference specific contract language when identifying differences.`,
        },
        {
          role: 'user',
          content: comparisonPrompt },
      ],
      temperature: 0.2,
      max_tokens: 4096,
      response_format: { type: 'json_object' } });

    const responseContent = completion.choices[0]?.message?.content || '{}';
    
    let comparison: Record<string, unknown>;
    try {
      comparison = JSON.parse(responseContent);
    } catch {
      comparison = { summary: 'Comparison analysis completed but structured parsing failed.', similarities: [], differences: [], recommendations: [] };
    }

    const processingTime = Date.now() - startTime;

    // Audit log
    await auditLog({
      action: AuditAction.DATA_EXPORTED,
      resourceType: 'contract_comparison',
      resourceId: contractIds.join(','),
      userId: ctx.userId,
      tenantId,
      metadata: { contractCount: contractsWithText.length, focus: comparisonFocus, processingTimeMs: processingTime },
    }).catch(() => {});

    return createSuccessResponse(ctx, {
      contractsCompared: contractsWithText.map(c => ({
        id: c.id,
        name: c.contractTitle || c.fileName,
        type: c.contractType,
        value: c.totalValue ? Number(c.totalValue) : null,
      })),
      comparisonFocus,
      ...comparison,
      metadata: {
        analyzedAt: new Date().toISOString(),
        processingTimeMs: processingTime,
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        textAnalyzed: contractSummaries.reduce((sum, c) => sum + c.text.length, 0),
      },
    });

  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
});

export const GET = withAuthApiHandler(async (_request, ctx) => {
  return createSuccessResponse(ctx, {
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
        options: ['all', 'pricing', 'liability', 'terms', 'duration'] } },
    returns: {
      summary: 'Overall comparison summary',
      similarities: 'Common elements across contracts',
      differences: 'Key differences with importance ratings',
      recommendations: 'AI recommendations',
      winner: 'Best contract recommendation' } });
});
