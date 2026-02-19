/**
 * Word Add-in AI Document Review API
 *
 * Reads the full document body and headings, then performs a comprehensive
 * AI-powered review covering:
 *   - Auto-detect contract type
 *   - Structural completeness (missing sections)
 *   - Risk analysis across the whole document
 *   - Improvement suggestions (missing clauses, ambiguity, compliance)
 *   - Executive summary
 */

import { NextRequest } from 'next/server';
import {
  getAuthenticatedApiContext,
  getApiContext,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/api-middleware';
import { getAIClient } from '@/lib/ai/ai-client';

interface ReviewRequest {
  documentText: string;
  headings: Array<{ text: string; level: number }>;
  contractType?: string;
  wordCount: number;
}

export async function POST(req: NextRequest) {
  const apiCtx = getApiContext(req);
  try {
    const ctx = getAuthenticatedApiContext(req);
    if (!ctx) {
      return createErrorResponse(apiCtx, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const body: ReviewRequest = await req.json();
    const { documentText, headings, contractType, wordCount } = body;

    if (!documentText || documentText.trim().length < 20) {
      return createErrorResponse(
        ctx,
        'VALIDATION_ERROR',
        'Document must contain at least 20 characters of text',
        400,
      );
    }

    const aiClient = await getAIClient();

    // Truncate very long documents to stay within token limits (~12k words)
    const maxChars = 50_000;
    const truncatedText =
      documentText.length > maxChars
        ? documentText.slice(0, maxChars) + '\n\n[...document truncated for analysis...]'
        : documentText;

    const headingList = headings.map((h) => `${'  '.repeat(h.level)}• ${h.text}`).join('\n');

    const systemPrompt = `You are a senior legal contract review agent. You will receive the full text of a contract document and its heading structure.

Perform a comprehensive review and return a JSON object with this EXACT structure (no markdown, just raw JSON):
{
  "completenessScore": <number 0-100>,
  "detectedType": "<contract type like MSA, NDA, SOW, SLA, Employment Agreement, etc.>",
  "structure": {
    "sectionsFound": ["<heading 1>", "<heading 2>", ...],
    "missingRecommended": ["<missing section 1>", "<missing section 2>", ...]
  },
  "risks": [
    {
      "text": "<exact problematic text or summary>",
      "risk": "HIGH",
      "explanation": "<why this is risky>",
      "suggestion": "<how to fix>",
      "section": "<which section>"
    }
  ],
  "suggestions": [
    {
      "id": "1",
      "section": "<section name or 'General'>",
      "text": "<suggested text or description>",
      "explanation": "<why this improvement matters>",
      "type": "missing-clause"
    }
  ],
  "summary": "<2-3 sentence executive summary of the document quality>"
}

Rules:
- Detect the contract type from the document content, not just the title
- Identify 3-10 risks ordered by severity (CRITICAL > HIGH > MEDIUM > LOW)
- Identify 3-8 improvement suggestions covering missing clauses, ambiguities, or compliance gaps
- For missingRecommended, list sections that a typical contract of this type should have but doesn't
- Be specific — reference actual text from the document when flagging risks
- The completenessScore should reflect how production-ready the contract is`;

    const userPrompt = `Contract Type Hint: ${contractType || 'Auto-detect'}
Word Count: ${wordCount}

DOCUMENT HEADINGS:
${headingList || '(No formatted headings detected)'}

FULL DOCUMENT TEXT:
${truncatedText}`;

    const completion = await aiClient.chat.completions.create({
      model: aiClient.model || 'mistral-large-latest',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 4000,
    });

    const responseText = completion.choices[0]?.message?.content || '';

    // Parse JSON response
    let parsed;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON in AI response');
      }
    } catch {
      // Fallback to a basic review structure
      parsed = {
        completenessScore: 50,
        detectedType: contractType || 'Unknown',
        structure: {
          sectionsFound: headings.map((h) => h.text),
          missingRecommended: [],
        },
        risks: [],
        suggestions: [
          {
            id: '1',
            section: 'General',
            text: responseText.slice(0, 500),
            explanation: 'AI response could not be structured — raw analysis provided',
            type: 'improvement',
          },
        ],
        summary: responseText.slice(0, 300),
      };
    }

    return createSuccessResponse(ctx, {
      completenessScore: parsed.completenessScore ?? 50,
      detectedType: parsed.detectedType ?? contractType ?? 'Unknown',
      structure: parsed.structure ?? { sectionsFound: [], missingRecommended: [] },
      risks: parsed.risks ?? [],
      suggestions: parsed.suggestions ?? [],
      summary: parsed.summary ?? 'Review completed.',
    });
  } catch (error) {
    console.error('Word Add-in AI review error:', error);

    // Provide a more helpful error if it's a quota/auth issue
    const errMsg = error instanceof Error ? error.message : 'AI review failed';
    const isQuota = errMsg.includes('insufficient_quota') || errMsg.includes('429');
    const isAuth = errMsg.includes('401') || errMsg.includes('Unauthorized');

    return createErrorResponse(
      apiCtx,
      'SERVER_ERROR',
      isQuota
        ? 'AI quota exhausted — please check your API key or billing'
        : isAuth
          ? 'AI authentication failed — please check your API key'
          : `AI review failed: ${errMsg}`,
      500,
    );
  }
}
