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
 *   - Falls back to extractive summarization when no AI model is available.
 *
 * @version 1.1.0
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

// ─── Extractive Fallback ────────────────────────────────────────────────

const CONTRACT_ID_PATTERN = /\b(cl[a-z0-9]{20,30}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/g;
const ENTITY_PATTERNS = [
  /(?:contract|agreement)\s+(?:titled?|named?|called)\s+"([^"]+)"/gi,
  /(?:company|vendor|supplier|client|party)\s+(?:named?|called)\s+"?([A-Z][A-Za-z\s&.]+)"?/g,
];

/**
 * Rule-based fallback summarization — extracts key entities, topics,
 * and user questions from the conversation when no AI is available.
 */
function extractiveSummary(messages: ChatMessage[]): string {
  const contractIds = new Set<string>();
  const entities = new Set<string>();
  const userQuestions: string[] = [];

  for (const msg of messages) {
    // Extract contract IDs
    const ids = msg.content.match(CONTRACT_ID_PATTERN);
    if (ids) ids.forEach(id => contractIds.add(id));

    // Extract named entities
    for (const pattern of ENTITY_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(msg.content)) !== null) {
        entities.add(match[1].trim());
      }
    }

    // Capture user questions (first 120 chars of each)
    if (msg.role === 'user' && msg.content.length > 15) {
      const q = msg.content.slice(0, 120).replace(/\n/g, ' ').trim();
      if (userQuestions.length < 5) userQuestions.push(q);
    }
  }

  const parts: string[] = [];
  if (userQuestions.length > 0) {
    parts.push(`User asked about: ${userQuestions.join('; ')}`);
  }
  if (contractIds.size > 0) {
    parts.push(`Contracts referenced: ${[...contractIds].slice(0, 5).join(', ')}`);
  }
  if (entities.size > 0) {
    parts.push(`Entities mentioned: ${[...entities].slice(0, 5).join(', ')}`);
  }

  return parts.length > 0 ? `**Previously discussed:** ${parts.join('. ')}.` : '';
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
      // No API key — fall back to extractive summarization
      const fallback = extractiveSummary(olderMessages);
      return {
        summary: fallback,
        recentMessages,
        wasSummarized: !!fallback,
      };
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
            'Include specific contract IDs, company names, and values mentioned. ' +
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
    logger.warn('[ConvSummarizer] Summarization failed — using extractive fallback', {
      action: 'summarize-error',
      error: err instanceof Error ? err.message : String(err),
    });
    // Fallback to extractive summarization instead of returning nothing
    const fallback = extractiveSummary(olderMessages);
    return {
      summary: fallback,
      recentMessages,
      wasSummarized: !!fallback,
    };
  }
}
