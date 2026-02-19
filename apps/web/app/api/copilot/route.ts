/**
 * AI Contract Copilot API
 * 
 * Real-time drafting assistance endpoints:
 * - POST /api/copilot - Get suggestions for current text
 * - POST /api/copilot?mode=assist - AI-generated text from a user prompt
 * - POST /api/copilot/complete - Get auto-completions
 * - POST /api/copilot/risks - Analyze risks only
 * - POST /api/copilot/apply - Apply a suggestion
 */

import { NextRequest } from 'next/server';
import { 
  getAICopilotService,
  type CopilotContext,
  type RealtimeSuggestion as _RealtimeSuggestion 
} from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

// ============================================================================
// POST - Get real-time suggestions or AI-assisted generation
// ============================================================================

export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
  const userId = ctx.userId;
    const body = await request.json();
    const { 
      text, 
      cursorPosition = text?.length || 0,
      contractType,
      counterpartyName,
      contractValue,
      isNegotiating = false,
      userRole = 'drafter',
      playbook,
      mode,
      prompt,
      selectedText } = body;

    if (!text && mode !== 'assist') {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Text is required', 400);
    }

    const context: CopilotContext = {
      tenantId,
      userId,
      contractType,
      counterpartyName,
      contractValue,
      isNegotiating,
      userRole,
      activePlaybook: playbook };

    const copilotService = getAICopilotService();

    // ── ASSIST MODE: AI generates text from user prompt ──
    if (mode === 'assist' && prompt) {
      try {
        const OpenAI = (await import('openai')).OpenAI;
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        // Build context from existing content & RAG
        let ragContext = '';
        try {
          const { hybridSearch } = await import('@/lib/rag/advanced-rag.service');
          const ragResults = await hybridSearch(prompt, {
            k: 5,
            filters: { tenantId },
            minScore: 0.3,
          });
          if (ragResults.length > 0) {
            ragContext = '\n\nRelevant clauses from your contract library:\n' +
              ragResults.map((r, i) => `[${i + 1}] ${(r.text || '').slice(0, 400)}`).join('\n\n');
          }
        } catch {
          // RAG unavailable — continue without
        }

        const systemPrompt = `You are an expert contract drafting AI assistant. Generate precise, legally sound contract text based on the user's request.

Rules:
- Write directly usable contract language (no markdown headers, no explanations)
- Use "shall" for obligations, "may" for permissions
- Use defined terms consistently (capitalize them)
- Be concise but thorough
- Match the style and tone of the existing document context
- If the user asks to rewrite/improve selected text, provide only the improved version

${contractType ? `Contract type: ${contractType}` : ''}
${ragContext}`;

        const messages: Array<{ role: 'system' | 'user'; content: string }> = [
          { role: 'system', content: systemPrompt },
        ];

        let userMessage = prompt;
        if (text) {
          userMessage += `\n\nExisting document context (around cursor):\n${text.slice(Math.max(0, cursorPosition - 500), cursorPosition + 500)}`;
        }
        if (selectedText) {
          userMessage += `\n\nCurrently selected text:\n${selectedText}`;
        }
        messages.push({ role: 'user', content: userMessage });

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages,
          temperature: 0.3,
          max_tokens: 2000,
        });

        const generatedText = completion.choices[0]?.message?.content?.trim() || '';

        return createSuccessResponse(ctx, {
          generatedText,
          model: 'gpt-4o-mini',
          ragContextUsed: ragContext.length > 0,
          suggestions: [],
        });
      } catch (error) {
        return createErrorResponse(
          ctx,
          'INTERNAL_ERROR',
          error instanceof Error ? error.message : 'AI assist failed',
          500,
        );
      }
    }

    // ── REALTIME MODE: standard suggestions pipeline ──
    if (!text) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Text is required', 400);
    }

    const response = await copilotService.getSuggestions(text, cursorPosition, context);

    return createSuccessResponse(ctx, response);
  });
