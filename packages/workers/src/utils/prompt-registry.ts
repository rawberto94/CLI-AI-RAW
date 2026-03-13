/**
 * Prompt Versioning Registry
 *
 * Centralized registry for all prompt templates used across the system.
 * Supports version tracking, A/B testing, and rollback capability.
 *
 * Features:
 * - Named prompt versions with semantic versioning
 * - Active/inactive version control per prompt key
 * - A/B test splits (percentage-based traffic allocation)
 * - Version history with changelogs
 * - Runtime prompt resolution with fallback
 */

import pino from 'pino';

const logger = pino({ name: 'prompt-registry' });

export interface PromptVersion {
  /** Semantic version e.g. "1.0.0" */
  version: string;
  /** The prompt template text (may contain {{variable}} placeholders) */
  template: string;
  /** When this version was created */
  createdAt: string;
  /** Short description of changes */
  changelog: string;
  /** Whether this version is active */
  active: boolean;
  /** A/B test traffic percentage (0-100). Only used when multiple versions active. */
  trafficPercent?: number;
}

export interface PromptEntry {
  /** Unique key e.g. "artifact.overview", "chatbot.system", "rag.contextual" */
  key: string;
  /** Human-readable description */
  description: string;
  /** Category for grouping */
  category: 'artifact' | 'chatbot' | 'rag' | 'agent' | 'system';
  /** All versions (newest first) */
  versions: PromptVersion[];
}

class PromptRegistry {
  private prompts = new Map<string, PromptEntry>();

  /**
   * Register a prompt with its initial version.
   */
  register(entry: PromptEntry): void {
    this.prompts.set(entry.key, entry);
  }

  /**
   * Add a new version to an existing prompt.
   */
  addVersion(key: string, version: PromptVersion): void {
    const entry = this.prompts.get(key);
    if (!entry) {
      logger.warn({ key }, 'Cannot add version to unregistered prompt');
      return;
    }
    entry.versions.unshift(version);
  }

  /**
   * Resolve the active prompt template for a given key.
   * Supports A/B testing — if multiple versions are active with trafficPercent,
   * randomly selects based on their traffic allocation.
   */
  resolve(key: string, variables?: Record<string, string>): { template: string; version: string } | null {
    const entry = this.prompts.get(key);
    if (!entry) return null;

    const activeVersions = entry.versions.filter(v => v.active);
    if (activeVersions.length === 0) return null;

    let selected: PromptVersion;

    if (activeVersions.length === 1) {
      selected = activeVersions[0]!;
    } else {
      // A/B test selection based on traffic percentages
      const totalTraffic = activeVersions.reduce((sum, v) => sum + (v.trafficPercent ?? 0), 0);
      const roll = Math.random() * (totalTraffic || 100);
      let cumulative = 0;
      selected = activeVersions[0]!;
      for (const v of activeVersions) {
        cumulative += v.trafficPercent ?? (100 / activeVersions.length);
        if (roll <= cumulative) {
          selected = v;
          break;
        }
      }
    }

    let template = selected.template;
    if (variables) {
      for (const [k, v] of Object.entries(variables)) {
        template = template.replaceAll(`{{${k}}}`, v);
      }
    }

    return { template, version: selected.version };
  }

  /**
   * Get version history for a prompt key.
   */
  getHistory(key: string): PromptVersion[] {
    return this.prompts.get(key)?.versions ?? [];
  }

  /**
   * Rollback: deactivate current version and activate a previous one.
   */
  rollback(key: string, targetVersion: string): boolean {
    const entry = this.prompts.get(key);
    if (!entry) return false;

    const target = entry.versions.find(v => v.version === targetVersion);
    if (!target) return false;

    // Deactivate all, activate target
    for (const v of entry.versions) v.active = false;
    target.active = true;
    target.trafficPercent = 100;

    logger.info({ key, targetVersion }, 'Prompt rolled back');
    return true;
  }

  /**
   * List all registered prompts.
   */
  listAll(): PromptEntry[] {
    return Array.from(this.prompts.values());
  }

  /**
   * Get all prompts in a category.
   */
  listByCategory(category: PromptEntry['category']): PromptEntry[] {
    return Array.from(this.prompts.values()).filter(p => p.category === category);
  }
}

// ─── Singleton Instance ─────────────────────────────────────────────────────

export const promptRegistry = new PromptRegistry();

// ─── Register Default Prompts ───────────────────────────────────────────────

promptRegistry.register({
  key: 'system.anti-hallucination',
  description: 'System prompt for contract analysis with anti-hallucination rules',
  category: 'system',
  versions: [
    {
      version: '3.0.0',
      template: `You are a contract analysis AI. Extract information ONLY from the provided contract text.

ANTI-HALLUCINATION RULES (CRITICAL):
1. ONLY extract information explicitly stated in the contract text
2. NEVER guess, infer, or assume information not present
3. Use null for any field where data is not found in the contract
4. Provide honest confidence/certainty scores (0.0-1.0)
5. Extract party names EXACTLY as written - never invent names
6. Quote or closely paraphrase actual contract language for sources
7. Do NOT calculate dates, totals, or values not explicitly stated
8. For every extracted value, include a "source" field citing the contract text
9. Set "extractedFromText": true only for directly quoted/paraphrased data
10. Use "requiresHumanReview": true for any inferred or uncertain values

OUTPUT QUALITY RULES:
1. Scan the ENTIRE contract text before responding
2. Prefer completeness over speed - extract all relevant data
3. Provide substantive summaries, not one-line placeholders
4. Use precise legal/business language
5. Include "additionalFindings" for anything that doesn't fit the schema
6. Include "openEndedNotes" for contextual observations`,
      createdAt: '2025-01-15T00:00:00Z',
      changelog: 'v3 — unified anti-hallucination + quality rules from artifact-prompts-v3',
      active: true,
      trafficPercent: 100,
    },
  ],
});

promptRegistry.register({
  key: 'rag.contextual-retrieval',
  description: 'Prompt for generating contextual prefixes per chunk (Anthropic-style)',
  category: 'rag',
  versions: [
    {
      version: '1.0.0',
      template: `You contextualize contract chunks for a retrieval system. Given a document summary and multiple chunks, write a 1-2 sentence context prefix for EACH chunk that identifies its location in the document and provides enough context for standalone understanding.
Return a JSON array of strings, one prefix per chunk, in the same order. Return ONLY the JSON array, no other text.`,
      createdAt: '2025-01-15T00:00:00Z',
      changelog: 'Initial contextual retrieval prompt',
      active: true,
      trafficPercent: 100,
    },
  ],
});

promptRegistry.register({
  key: 'chatbot.system',
  description: 'System prompt for the contract chatbot',
  category: 'chatbot',
  versions: [
    {
      version: '2.0.0',
      template: `You are an AI contract assistant. Answer questions about contracts using ONLY the provided context. If the context doesn't contain the answer, say so honestly. Never fabricate contract terms, dates, or party names.`,
      createdAt: '2025-01-15T00:00:00Z',
      changelog: 'v2 — concise system prompt with strict grounding rules',
      active: true,
      trafficPercent: 100,
    },
  ],
});

promptRegistry.register({
  key: 'agent.react-system',
  description: 'System prompt for ReAct agent loop',
  category: 'agent',
  versions: [
    {
      version: '1.0.0',
      template: `You are a contract analysis agent. Use the available tools to answer the user's question. Think step by step: Thought → Action → Observation → ... → Final Answer. Only use tools when needed. Always cite sources from the contract.`,
      createdAt: '2025-01-15T00:00:00Z',
      changelog: 'Initial ReAct agent system prompt',
      active: true,
      trafficPercent: 100,
    },
  ],
});

export default promptRegistry;
