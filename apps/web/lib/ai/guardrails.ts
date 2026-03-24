/**
 * AI Guardrails — Input/Output Safety Layer
 *
 * 1. Prompt Injection Detection — regex + heuristic scanner
 * 2. OpenAI Moderation API — content policy check
 * 3. Output Guardrails — post-generation safety filter
 *
 * Runs BEFORE the LLM call (input) and AFTER (output) to prevent
 * prompt injection attacks and harmful content generation.
 *
 * @version 1.0.0
 */

import OpenAI from 'openai';
import { createOpenAIClient, getOpenAIApiKey } from '@/lib/openai-client';
import { logger } from '@/lib/logger';

// ─── Types ──────────────────────────────────────────────────────────────

export interface GuardrailResult {
  safe: boolean;
  reason?: string;
  category?: string;
  /** 0-1 score; higher = more dangerous */
  severity?: number;
}

// ─── Prompt Injection Detection ─────────────────────────────────────────

/**
 * Heuristic patterns that indicate prompt injection attempts.
 * Each pattern has a weight — if cumulative weight exceeds threshold the
 * input is flagged.
 */
const INJECTION_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  // Direct instruction override
  { pattern: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|context)/i, weight: 0.9, label: 'instruction-override' },
  { pattern: /disregard\s+(your|all|the)\s+(instructions?|rules?|guidelines?|system\s+prompt)/i, weight: 0.9, label: 'instruction-override' },
  { pattern: /forget\s+(everything|all|your)\s+(you|instructions?|rules?)/i, weight: 0.8, label: 'instruction-override' },

  // Role hijacking
  { pattern: /you\s+are\s+now\s+(a|an|the|DAN|my)\b/i, weight: 0.85, label: 'role-hijack' },
  { pattern: /pretend\s+(you\s+are|to\s+be|you're)\s/i, weight: 0.7, label: 'role-hijack' },
  { pattern: /act\s+as\s+(if\s+you\s+are|a|an|the)\s/i, weight: 0.5, label: 'role-hijack' },
  { pattern: /\bDAN\b.*\bmode\b/i, weight: 0.95, label: 'jailbreak' },
  { pattern: /\bjailbreak\b/i, weight: 0.9, label: 'jailbreak' },

  // System prompt extraction
  { pattern: /(?:show|print|reveal|output|display|repeat)\s+(your|the)\s+(system\s+)?prompt/i, weight: 0.8, label: 'prompt-extraction' },
  { pattern: /what\s+(is|are)\s+your\s+(system\s+)?(instructions?|prompt|rules?)/i, weight: 0.6, label: 'prompt-extraction' },

  // Delimiter / encoding attacks
  { pattern: /```\s*(system|instruction|prompt)/i, weight: 0.7, label: 'delimiter-attack' },
  { pattern: /<\/?system>/i, weight: 0.8, label: 'delimiter-attack' },
  { pattern: /\[SYSTEM\]/i, weight: 0.7, label: 'delimiter-attack' },

  // Encoded / obfuscated instructions
  { pattern: /base64[:\s]+[A-Za-z0-9+/=]{20,}/i, weight: 0.6, label: 'encoding-attack' },
  { pattern: /eval\s*\(|exec\s*\(/i, weight: 0.7, label: 'code-injection' },
];

const INJECTION_THRESHOLD = 0.75;

/**
 * Scans user input for prompt injection patterns using weighted heuristics.
 * Fast (~0ms) and runs before the LLM call.
 */
export function detectPromptInjection(input: string): GuardrailResult {
  if (!input || input.length < 10) return { safe: true };

  let totalWeight = 0;
  let worstLabel = '';
  let worstWeight = 0;

  for (const { pattern, weight, label } of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      totalWeight += weight;
      if (weight > worstWeight) {
        worstWeight = weight;
        worstLabel = label;
      }
    }
  }

  if (totalWeight >= INJECTION_THRESHOLD) {
    logger.warn('[Guardrails] Prompt injection detected', {
      action: 'prompt-injection',
      category: worstLabel,
      severity: Math.min(totalWeight, 1),
    });
    return {
      safe: false,
      reason: 'Your message was flagged as a potential prompt injection attempt.',
      category: worstLabel,
      severity: Math.min(totalWeight, 1),
    };
  }

  return { safe: true };
}

// ─── OpenAI Moderation API ──────────────────────────────────────────────

let _moderationClient: OpenAI | null = null;
function getModerationClient(): OpenAI | null {
  if (_moderationClient) return _moderationClient;
  const key = getOpenAIApiKey();
  if (!key) return null;
  _moderationClient = createOpenAIClient(key);
  return _moderationClient;
}

/**
 * Checks text against OpenAI's Moderation API for policy violations.
 * Returns safe:true if the API is unavailable — fails open so the chat
 * still works when the moderation endpoint is down.
 */
export async function checkModeration(text: string): Promise<GuardrailResult> {
  const client = getModerationClient();
  if (!client) return { safe: true };

  // Skip very short messages (greetings, confirmations)
  if (text.length < 15) return { safe: true };

  try {
    const response = await client.moderations.create({
      input: text,
    });

    const result = response.results[0];
    if (!result) return { safe: true };

    if (result.flagged) {
      // Find the highest-scoring category
      const scores = result.category_scores;
      let maxCategory = '';
      let maxScore = 0;
      for (const [cat, score] of Object.entries(scores)) {
        if (score > maxScore) {
          maxScore = score;
          maxCategory = cat;
        }
      }

      logger.warn('[Guardrails] Content moderation flagged', {
        action: 'moderation-flagged',
        category: maxCategory,
        score: maxScore,
      });

      return {
        safe: false,
        reason: 'Your message was flagged by our content safety system. Please rephrase your request.',
        category: maxCategory,
        severity: maxScore,
      };
    }

    return { safe: true };
  } catch (err) {
    // Moderation API failure — fail open (don't block the user)
    logger.warn('[Guardrails] Moderation API error — failing open', {
      action: 'moderation-error',
      error: err instanceof Error ? err.message : String(err),
    });
    return { safe: true };
  }
}

// ─── Combined Input Guardrail ───────────────────────────────────────────

/**
 * Runs all input guardrails: prompt injection detection (sync) then
 * OpenAI moderation (async). Short-circuits on first failure.
 */
export async function checkInputGuardrails(input: string): Promise<GuardrailResult> {
  // 1. Fast heuristic check (~0ms)
  const injectionCheck = detectPromptInjection(input);
  if (!injectionCheck.safe) return injectionCheck;

  // 2. OpenAI Moderation API (~100-300ms)
  const moderationCheck = await checkModeration(input);
  if (!moderationCheck.safe) return moderationCheck;

  return { safe: true };
}

// ─── Output Guardrail ───────────────────────────────────────────────────

/**
 * Post-generation safety check on LLM output.
 * Catches cases where the model was tricked into generating harmful content.
 * Runs moderation on the output and checks for leaked system prompt patterns.
 */
export async function checkOutputGuardrails(output: string): Promise<GuardrailResult> {
  if (!output || output.length < 20) return { safe: true };

  // Check for system prompt leakage
  const leakagePatterns = [
    /you are contigo ai.*autonomous contract/i,
    /\*\*capabilities:\*\*/i,
    /response rules:\s*\n.*1\.\s*be concise/i,
  ];
  for (const pattern of leakagePatterns) {
    if (pattern.test(output)) {
      logger.warn('[Guardrails] System prompt leakage detected in output');
      return {
        safe: false,
        reason: 'Response contained internal system information.',
        category: 'system-prompt-leak',
        severity: 0.8,
      };
    }
  }

  // Run moderation on output
  return checkModeration(output);
}
