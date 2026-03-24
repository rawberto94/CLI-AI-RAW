/**
 * Conversation Summarization Service
 *
 * When conversation history exceeds a threshold, older messages are
 * condensed into a summary paragraph that preserves key context while
 * drastically reducing token count.
 *
 * Strategy:
 *   - Keep the most recent N messages verbatim (they contain the
 *     immediate conversational context the model needs).
 *   - Summarize everything older into a short "Previously discussed:" block.
 *   - The summary is injected as a system-level context note so the model
 *     still has access to long-range information.
 *
 * @version 1.0.0
 */

import OpenAI from 'openai';
import { createOpenAIClient, getOpenAIApiKey } from '@/lib/openai-client';
import { logger } from '@/lib/logger';

// ─── Config ─────────────────────────────────────────────────────────────

/** Messages to keep verbatim (most recent) */
const KEEP_RECENT = 10;

/** Minimum history length before summarization kicks in */
const SUMMARIZE_THRESHOLD = 15;

// ─── Types ──────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface SummarizedHistory {
  /** Summary of older messages (empty string if not needed) */
  summary: string;
  /** Recent messages to pass verbatim */
  recentMessages: ChatMessage[];
  /** Whether summarization was applied */
  wasSummarized: boolean;
}

// ─── Core ───────────────────────────────────────────────────────────────

/**
 * Summarizes a conversation history, returning a condensed summary of
 * older messages plus the most recent messages verbatim.
 *
 * If the history is short enough, returns it unchanged.
 */
export async function summarizeConversationHistory(
  history: ChatMessage[],
): Promise<SummarizedHistory> {
  // Short history — no summarization needed
  if (history.length <= SUMMARIZE_THRESHOLD) {
    return {
      summary: '',
      recentMessages: history,
      wasSummarized: false,
    };
  }

  const olderMessages = history.slice(0, -KEEP_RECENT);
  const recentMessages = history.slice(-KEEP_RECENT);

  // Build a transcript of older messages for the summarizer
  const transcript = olderMessages
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 500)}`)
    .join('\n');

  try {
    const key = getOpenAIApiKey();
    if (!key) {
      // No API key — fall back to naive truncation
      return { summary: '', recentMessages: history.slice(-KEEP_RECENT), wasSummarized: false };
    }

    const openai = createOpenAIClient(key);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content:
            'You are a conversation summarizer for a contract management assistant. ' +
            'Summarize the following conversation excerpt into a concise paragraph (max 3 sentences). ' +
            'Focus on: what the user asked about, key facts/contracts discussed, any decisions or actions taken. ' +
            'Do NOT make up information. Write in third person ("The user asked about…").',
        },
        { role: 'user', content: transcript },
      ],
    });

    const summary = response.choices[0]?.message?.content?.trim() || '';

    if (summary) {
      logger.info('[ConvSummarizer] Summarized conversation history', {
        action: 'conversation-summarized',
        originalMessages: olderMessages.length,
        summaryLength: summary.length,
      });
    }

    return {
      summary: summary ? `**Previously discussed:** ${summary}` : '',
      recentMessages,
      wasSummarized: !!summary,
    };
  } catch (err) {
    logger.warn('[ConvSummarizer] Summarization failed — using truncation', {
      action: 'summarize-error',
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      summary: '',
      recentMessages: history.slice(-KEEP_RECENT),
      wasSummarized: false,
    };
  }
}
