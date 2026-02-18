/**
 * AI On-Demand Extraction API
 *
 * POST /api/ai/extract — Run AI extraction on a contract's text
 *
 * Extracts key fields (parties, dates, values, clauses, obligations) using GPT,
 * optionally with a specific focus or schema.
 *
 * @version 1.0.0
 */

import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import {
  withAuthApiHandler,
  createSuccessResponse,
  createErrorResponse,
  type AuthenticatedApiContext,
} from '@/lib/api-middleware';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { tenantId } = ctx;
  const body = await request.json();
  const { contractId, text, focus } = body;

  // Resolve text from contractId if not supplied directly
  let contractText = text || '';
  let contractName = 'Untitled';

  if (contractId && !text) {
    const c = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { rawText: true, contractTitle: true, fileName: true },
    });
    if (!c || !c.rawText) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found or has no extracted text', 404);
    }
    contractText = c.rawText;
    contractName = c.contractTitle || c.fileName || 'Untitled';
  }

  if (!contractText) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Either contractId or text is required', 400);
  }

  // P0: Input length validation — cap before truncation to avoid multi-MB JSON parse memory pressure
  if (contractText.length > 200_000) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract text exceeds maximum length of 200000 characters', 400);
  }

  const truncatedText = contractText.slice(0, 12000);

  const focusInstruction = focus
    ? `\n\nFocus specifically on extracting: ${focus}`
    : '';

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a contract analysis expert. Extract structured data from the contract text.
Return JSON with these fields (include only those found):
{
  "parties": [{ "name": "", "role": "buyer|seller|contractor|client|...", "address": "" }],
  "effectiveDate": "YYYY-MM-DD or null",
  "expirationDate": "YYYY-MM-DD or null",
  "totalValue": { "amount": 0, "currency": "USD" },
  "paymentTerms": "",
  "governingLaw": "",
  "terminationClauses": [""],
  "confidentiality": { "present": true, "duration": "", "scope": "" },
  "indemnification": { "present": true, "summary": "" },
  "limitationOfLiability": { "present": true, "cap": "" },
  "intellectualProperty": { "present": true, "summary": "" },
  "obligations": [{ "party": "", "obligation": "", "deadline": "" }],
  "keyRisks": [{ "risk": "", "severity": "critical|high|medium|low", "clause": "" }],
  "contractType": "",
  "renewalTerms": ""
}${focusInstruction}`,
        },
        {
          role: 'user',
          content: `Extract data from this contract:\n\n${truncatedText}`,
        },
      ],
    }, { signal: AbortSignal.timeout(30_000) });

    const content = response.choices[0]?.message?.content || '{}';
    const extraction = JSON.parse(content);

    // Optionally persist to contract metadata
    if (contractId) {
      const existing = await prisma.contract.findUnique({
        where: { id: contractId },
        select: { metadata: true },
      });
      const meta = (existing?.metadata || {}) as Record<string, unknown>;
      await prisma.contract.update({
        where: { id: contractId },
        data: {
          metadata: { ...meta, aiExtraction: extraction, aiExtractedAt: new Date().toISOString() },
        },
      });
    }

    return createSuccessResponse(ctx, {
      contractName,
      extraction,
      model: 'gpt-4o-mini',
      extractedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('AI extraction error:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Extraction failed', 500);
  }
});
