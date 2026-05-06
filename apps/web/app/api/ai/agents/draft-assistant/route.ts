/**
 * Interactive Contract Drafting Assistant API
 *
 * POST /api/ai/agents/draft-assistant — Multi-turn conversational drafting
 *
 * Provides a chat-based experience where the AI asks clarifying questions,
 * gathers context (contract type, parties, jurisdiction, key terms), and
 * eventually generates a draft via the 6-step pipeline.
 *
 * SSE events: message, context_update, suggestions, ready_to_generate,
 *             generation_started, generation_step, generation_complete,
 *             error, done
 *
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  withAuthApiHandler,
  createErrorResponse,
  type AuthenticatedApiContext,
} from '@/lib/api-middleware';
import { createOpenAIClient, hasAIClientConfig } from '@/lib/openai-client';
import { checkRateLimit, rateLimitResponse, AI_RATE_LIMITS } from '@/lib/ai/rate-limit';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getCircuitBreaker } from '@/lib/ai/circuit-breaker';
import {
  isAzureContentFilteredError,
  normalizeDraftingPrompt,
  normalizeDraftingValue,
  summarizeDraftingPromptForStrictSafety,
} from '@/lib/ai/drafting-safety';
import {
  formatPlaybookPromptContext,
  resolveRequestedPlaybook,
} from '@/lib/playbooks/copilot-playbook';
import type { Playbook } from 'data-orchestration/services';

export const maxDuration = 120;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DraftAssistantRequest {
  message: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  context: {
    contractType?: string;
    parties?: Array<{ name: string; role: string }>;
    jurisdiction?: string;
    keyTerms?: Record<string, string>;
    selectedClauses?: string[];
    tone?: 'formal' | 'standard' | 'plain-english';
    templateId?: string;
    title?: string;
    currentContent?: string;
    selectedText?: string;
    documentSections?: string[];
    playbookId?: string;
  };
  action?: 'chat' | 'generate' | 'editor_assist';
}

interface GenerationStep {
  step: number;
  name: string;
  status: 'running' | 'completed' | 'skipped' | 'failed';
  durationMs?: number;
}

type EditorAssistOperation =
  | 'add_clause'
  | 'replace_clause'
  | 'remove_clause'
  | 'rewrite'
  | 'fill_variables'
  | 'tighten_risk'
  | 'other';

interface EditorAssistResponse {
  title: string;
  assistantMessage: string;
  draftHtml: string;
  applyMode: 'replace_selection' | 'insert_at_cursor' | 'none';
  quickReplies: Array<{ label: string; value: string }>;
  followUpQuestion?: string;
  operation?: EditorAssistOperation;
  detectedCategory?: string | null;
  detectedParameters?: Record<string, string>;
  playbookSourceCategory?: string | null;
}

type DraftAssistantSafetyMode = 'standard' | 'strict';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_MESSAGE_LENGTH = 10_000;
const MAX_HISTORY_ITEMS = 50;
// Cap on the combined content of conversationHistory. Without this the API
// validates item count + per-message size but an attacker (or a buggy client
// that keeps pushing draftHtml into the history) can still blow up the LLM
// prompt, burn tokens, and slow down every other tenant's request. 200KB of
// conversation content is enough for ~50 real-world turns and well under the
// gpt-4o 128k context window.
const MAX_HISTORY_TOTAL_BYTES = 200_000;

const CONTRACT_TYPES = [
  { label: 'NDA', value: 'I need a Non-Disclosure Agreement' },
  { label: 'MSA', value: 'I need a Master Services Agreement' },
  { label: 'SOW', value: 'I need a Statement of Work' },
  { label: 'SLA', value: 'I need a Service Level Agreement' },
  { label: 'Employment', value: 'I need an Employment Agreement' },
  { label: 'License', value: 'I need a License Agreement' },
  { label: 'Lease', value: 'I need a Lease Agreement' },
  { label: 'Amendment', value: 'I need a Contract Amendment' },
];

const EDITOR_ASSIST_SYSTEM_PROMPT = `You are ConTigo's in-editor contract copilot. The user already has a live contract draft open in the editor and may also have an active policy pack (playbook).

PRIMARY GOAL
Translate the user's natural-language request into a precise drafting OPERATION against the live draft. Never produce generic boilerplate when the user has supplied specific values, terms, or clause categories — and never ignore the active playbook.

OPERATIONS (pick exactly one)
- "add_clause" — insert a brand-new clause section at the cursor (or after the appropriate heading)
- "replace_clause" — replace the selected text (or the matching clause in the draft) with redrafted language
- "remove_clause" — produce empty draftHtml + applyMode "replace_selection" and explain the deletion in assistantMessage
- "rewrite" — rewrite the selected text (tone, clarity, structure) without changing intent
- "fill_variables" — keep the selected text shape but substitute concrete values supplied by the user
- "tighten_risk" — produce risk-mitigated language for the selected/identified clause (caps, carve-outs, cure periods, etc.)
- "other" — fallback for general questions

EXTRACT FROM THE USER MESSAGE
- Contract parameters: term/duration ("12 months", "3 years"), effective date, governing law / jurisdiction, fee/value/cap, currency, payment cadence, notice periods, renewal type
- Party names, roles, entity types
- Clause category being discussed: PAYMENT, TERMINATION, CONFIDENTIALITY, LIABILITY, INDEMNIFICATION, IP, GOVERNING_LAW, DATA_PRIVACY, FORCE_MAJEURE, ASSIGNMENT, WARRANTIES, DISPUTE_RESOLUTION, INSURANCE, SLA, NON_COMPETE, AUDIT, etc.
- Action verb: add / insert / remove / delete / replace / rewrite / tighten / soften / simplify / harmonize

PLAYBOOK CONTRACT
- If the active playbook contains a "Preferred clause language" entry for the inferred category, USE IT VERBATIM as the basis for new or replaced clauses. Only adapt placeholders to fit the user's supplied values.
- If a "Red flag" pattern matches the selected/inferred clause, prefer "remove_clause" or rewrite to neutralize the flagged language.
- If a "Fallback position" applies, default to the "initial" position unless the user explicitly asks for the fallback or walkaway.
- Always state in assistantMessage which playbook position was applied (e.g. "Applied preferred LIABILITY clause from policy pack" or "Used fallback1 for TERMINATION").

VALUE POLICY (most important)
- Substitute ALL placeholders ("[___]", "{{...}}", "[Party A]", "[X] days") with the concrete values the user supplied or that the playbook provides.
- If a value is missing AND not in the playbook AND not inferable from contract type, leave a clearly-marked placeholder like "[Insert governing law]" — never use "[___]" or invented sample values.
- Do NOT invent example numbers (e.g. "$100,000", "Net 30") unless the user or playbook supplied them.

OUTPUT JSON SHAPE (strict)
{
  "operation": "<one of the operations above>",
  "title": "<2-5 word card label>",
  "assistantMessage": "<1-2 sentences: what you drafted/changed AND which playbook position you applied>",
  "draftHtml": "<HTML fragment using only <p>, <ul>, <ol>, <li>, <strong>, <em>, <h2>, <h3>; empty string when removing>",
  "applyMode": "replace_selection" | "insert_at_cursor" | "none",
  "quickReplies": [{"label":"...","value":"..."}, ...up to 4],
  "followUpQuestion": "<single short question only when a critical value is missing AND no reasonable default exists>",
  "detectedCategory": "<inferred clause category or null>",
  "detectedParameters": {"<paramKey>": "<value>", ...}
}

BEHAVIOUR
- Act like an editor, not an intake bot.
- Prefer drafting over asking. Only ask if a critical value is missing AND not in the playbook AND not inferable.
- No markdown, no code fences.
- Stay concise but complete.`;

// ---------------------------------------------------------------------------
// SSE Helpers
// ---------------------------------------------------------------------------

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a helpful contract drafting assistant for a contract intelligence platform called Contigo. Your job is to have a friendly, professional conversation with the user to gather the information needed to draft a contract.

## Behavior Guidelines
- Greet the user warmly on their first message and ask what kind of contract they need.
- Ask clarifying questions ONE AT A TIME — never overwhelm the user with multiple questions at once.
- Extract structured information from the user's responses: contract type, parties, jurisdiction, key terms, title, and tone.
- Suggest appropriate clauses and options based on the contract type.
- When you have collected enough information to generate a meaningful draft, signal readiness.
- Be concise but thorough. Use a professional yet approachable tone.
- If the user's request is ambiguous, ask for clarification rather than assuming.

## Information to Gather (in rough order)
1. Contract type (NDA, MSA, SOW, SLA, Employment, License, Lease, Amendment, etc.)
2. Parties involved (names and roles — e.g., "Acme Corp" as the sharing party)
3. Jurisdiction / governing law
4. Key terms (effective date, term length, payment terms, confidentiality period, etc.)
5. Tone preference (formal, standard, or plain-english)
6. Any specific clauses or requirements

## Minimum for Readiness
You should signal readiness when you have at least:
- Contract type
- At least two parties
- Jurisdiction

Additional terms and clauses improve quality but are not strictly required.

## Tool Usage
You MUST use the provided tools to communicate structured data:
- Use "update_context" whenever you identify or confirm a piece of contract information from the user.
- Use "suggest_options" to present quick-reply choices to help the user respond faster.
- Use "mark_ready" once you have gathered the minimum required information.

You can call multiple tools in a single response. Always combine tool calls with a natural language response.`;

// ---------------------------------------------------------------------------
// OpenAI Tool Definitions
// ---------------------------------------------------------------------------

const AI_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'update_context',
      description:
        'Update a field in the drafting context when the user provides or confirms contract information.',
      parameters: {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            enum: [
              'contractType',
              'parties',
              'jurisdiction',
              'keyTerms',
              'selectedClauses',
              'tone',
              'title',
            ],
            description: 'The context field to update.',
          },
          value: {
            description:
              'The value to set. For "parties" use an array of {name, role}. For "keyTerms" use an object. For "selectedClauses" use an array of strings.',
          },
          confidence: {
            type: 'number',
            description: 'Confidence level 0-1 that this extraction is correct.',
          },
        },
        required: ['field', 'value', 'confidence'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'suggest_options',
      description:
        'Provide quick-reply suggestions so the user can respond with a single click.',
      parameters: {
        type: 'object',
        properties: {
          suggestions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string', description: 'Short button label.' },
                value: {
                  type: 'string',
                  description: 'Full message to send if selected.',
                },
              },
              required: ['label', 'value'],
              additionalProperties: false,
            },
            description: 'List of suggested quick replies.',
          },
        },
        required: ['suggestions'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'mark_ready',
      description:
        'Signal that enough context has been collected to generate a contract draft.',
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'object',
            description:
              'Summary of the gathered context: type, parties, jurisdiction, etc.',
            properties: {
              type: { type: 'string' },
              parties: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    role: { type: 'string' },
                  },
                  required: ['name', 'role'],
                  additionalProperties: false,
                },
              },
              jurisdiction: { type: 'string' },
              keyTerms: { type: 'object' },
              tone: { type: 'string' },
              title: { type: 'string' },
            },
            required: ['type'],
            additionalProperties: false,
          },
        },
        required: ['summary'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'generate_draft',
      description:
        'Trigger the full draft generation pipeline. Only call this when the user explicitly asks to generate.',
      parameters: {
        type: 'object',
        properties: {
          confirmation: {
            type: 'boolean',
            description: 'Must be true to proceed with generation.',
          },
        },
        required: ['confirmation'],
        additionalProperties: false,
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Fallback Flow (no AI configured)
// ---------------------------------------------------------------------------

interface FallbackResult {
  message: string;
  contextUpdates: Array<{ field: string; value: unknown; confidence: number }>;
  suggestions: Array<{ label: string; value: string }>;
  readyToGenerate: boolean;
  readySummary?: Record<string, unknown>;
}

function determineFallbackStep(
  history: DraftAssistantRequest['conversationHistory'],
  context: DraftAssistantRequest['context'],
): number {
  if (context.contractType && context.parties?.length && context.jurisdiction) return 4;
  if (context.contractType && context.parties?.length) return 3;
  if (context.contractType) return 2;
  if (history.length === 0) return 0;
  return 1;
}

function runFallbackFlow(
  message: string,
  history: DraftAssistantRequest['conversationHistory'],
  context: DraftAssistantRequest['context'],
): FallbackResult {
  const step = determineFallbackStep(history, context);
  const lowerMsg = message.toLowerCase();

  switch (step) {
    case 0: {
      return {
        message:
          "Hello! I'm your contract drafting assistant. What type of contract would you like to create? Select one of the options below or describe what you need.",
        contextUpdates: [],
        suggestions: CONTRACT_TYPES.slice(0, 6),
        readyToGenerate: false,
      };
    }

    case 1: {
      let detectedType = '';
      if (lowerMsg.includes('nda') || lowerMsg.includes('non-disclosure') || lowerMsg.includes('confidential')) {
        detectedType = 'NDA';
      } else if (lowerMsg.includes('msa') || lowerMsg.includes('master service')) {
        detectedType = 'MSA';
      } else if (lowerMsg.includes('sow') || lowerMsg.includes('statement of work') || lowerMsg.includes('project scope')) {
        detectedType = 'SOW';
      } else if (lowerMsg.includes('sla') || lowerMsg.includes('service level')) {
        detectedType = 'SLA';
      } else if (lowerMsg.includes('employ')) {
        detectedType = 'EMPLOYMENT';
      } else if (lowerMsg.includes('license') || lowerMsg.includes('licence')) {
        detectedType = 'LICENSE';
      } else if (lowerMsg.includes('lease') || lowerMsg.includes('rental')) {
        detectedType = 'LEASE';
      } else if (lowerMsg.includes('amend')) {
        detectedType = 'AMENDMENT';
      } else {
        detectedType = 'MSA';
      }

      return {
        message: `Great choice! I'll help you create a ${detectedType}. Who are the parties involved? Please provide the name and role for each party (e.g., "Acme Corp shares confidential information and Beta Inc receives it").`,
        contextUpdates: [{ field: 'contractType', value: detectedType, confidence: 0.85 }],
        suggestions: [
          { label: 'Two parties', value: 'The parties are Company A as Party A and Company B as Party B' },
          { label: 'Skip for now', value: 'I\'ll add party details later, let\'s continue' },
        ],
        readyToGenerate: false,
      };
    }

    case 2: {
      const parties: Array<{ name: string; role: string }> = [];
      const partyPattern = /([A-Z][A-Za-z\s.&]+?)\s+(?:as|is)\s+(?:the\s+)?([A-Za-z\s]+)/gi;
      let match;
      while ((match = partyPattern.exec(message)) !== null) {
        parties.push({ name: match[1].trim(), role: match[2].trim() });
      }

      if (parties.length === 0 && !lowerMsg.includes('skip') && !lowerMsg.includes('later')) {
        parties.push(
          { name: 'Party A', role: 'First Party' },
          { name: 'Party B', role: 'Second Party' },
        );
      }

      const updates: FallbackResult['contextUpdates'] = [];
      if (parties.length > 0) {
        updates.push({ field: 'parties', value: parties, confidence: 0.7 });
      }

      return {
        message: `Got it${parties.length > 0 ? ` — I've noted ${parties.length} ${parties.length === 1 ? 'party' : 'parties'}` : ''}. What jurisdiction or governing law should this contract use?`,
        contextUpdates: updates,
        suggestions: [
          { label: 'United States', value: 'The governing law should be United States' },
          { label: 'United Kingdom', value: 'The governing law should be United Kingdom' },
          { label: 'EU / GDPR', value: 'The governing law should be European Union' },
          { label: 'Switzerland', value: 'The governing law should be Switzerland' },
        ],
        readyToGenerate: false,
      };
    }

    case 3: {
      let jurisdiction = 'United States';
      if (lowerMsg.includes('uk') || lowerMsg.includes('united kingdom') || lowerMsg.includes('england')) {
        jurisdiction = 'United Kingdom';
      } else if (lowerMsg.includes('eu') || lowerMsg.includes('europe') || lowerMsg.includes('gdpr')) {
        jurisdiction = 'European Union';
      } else if (lowerMsg.includes('switzerland') || lowerMsg.includes('swiss')) {
        jurisdiction = 'Switzerland';
      } else if (lowerMsg.includes('canad')) {
        jurisdiction = 'Canada';
      } else if (lowerMsg.includes('australia')) {
        jurisdiction = 'Australia';
      }

      return {
        message: `Jurisdiction set to ${jurisdiction}. Are there any key terms you'd like to specify? For example, effective date, term length, payment terms, or confidentiality period. Or you can say "generate" to create the draft now.`,
        contextUpdates: [{ field: 'jurisdiction', value: jurisdiction, confidence: 0.9 }],
        suggestions: [
          { label: 'Generate now', value: 'Please generate the contract draft' },
          { label: 'Add terms', value: 'I want to specify some key terms first' },
          { label: 'Set tone', value: 'I want to choose the contract tone' },
        ],
        readyToGenerate: true,
        readySummary: {
          type: context.contractType,
          parties: context.parties || [],
          jurisdiction,
        },
      };
    }

    default: {
      // Step 4+: handle additional terms or generate signal
      const updates: FallbackResult['contextUpdates'] = [];

      if (lowerMsg.includes('formal')) {
        updates.push({ field: 'tone', value: 'formal', confidence: 0.95 });
      } else if (lowerMsg.includes('plain') || lowerMsg.includes('simple')) {
        updates.push({ field: 'tone', value: 'plain-english', confidence: 0.9 });
      }

      const termPatterns: Record<string, RegExp> = {
        effectiveDate: /effective\s*date[:\s]+([^\n,;]+)/i,
        termLength: /(?:term|duration|period)[:\s]+([^\n,;]+)/i,
        paymentTerms: /payment[:\s]+([^\n,;]+)/i,
        confidentialityPeriod: /confidentiality[:\s]+([^\n,;]+)/i,
      };

      const keyTerms: Record<string, string> = {};
      for (const [key, pattern] of Object.entries(termPatterns)) {
        const m = pattern.exec(message);
        if (m) keyTerms[key] = m[1].trim();
      }
      if (Object.keys(keyTerms).length > 0) {
        updates.push({
          field: 'keyTerms',
          value: { ...context.keyTerms, ...keyTerms },
          confidence: 0.8,
        });
      }

      return {
        message:
          "Thanks for the additional details! I've updated the context. You can continue adding information or say \"generate\" to create your contract draft.",
        contextUpdates: updates,
        suggestions: [
          { label: 'Generate now', value: 'Please generate the contract draft' },
          { label: 'Add more terms', value: 'I want to add more key terms' },
        ],
        readyToGenerate: true,
        readySummary: {
          type: context.contractType,
          parties: context.parties || [],
          jurisdiction: context.jurisdiction,
          keyTerms: { ...context.keyTerms, ...keyTerms },
        },
      };
    }
  }
}

function inferEditorTopic(message: string): 'payment' | 'termination' | 'confidentiality' | 'liability' | 'gdpr' | 'rewrite' | 'generic' {
  const lower = message.toLowerCase();

  if (/(rewrite|revise|redraft|improve|simplify|tighten)/.test(lower)) return 'rewrite';
  if (/(payment|invoice|fee|billing|net\s*\d+)/.test(lower)) return 'payment';
  if (/(terminate|termination|convenience|wind\s*down)/.test(lower)) return 'termination';
  if (/(confidential|nda|non-disclosure|disclosure)/.test(lower)) return 'confidentiality';
  if (/(liability|cap|damages|indirect|consequential)/.test(lower)) return 'liability';
  if (/(gdpr|data protection|privacy|personal data|processor|controller)/.test(lower)) return 'gdpr';

  return 'generic';
}

function runEditorAssistFallback(
  message: string,
  context: DraftAssistantRequest['context'],
): EditorAssistResponse {
  const topic = inferEditorTopic(message);
  const hasSelection = Boolean(context.selectedText?.trim());

  switch (topic) {
    case 'payment':
      return {
        title: 'Payment Terms',
        assistantMessage:
          'I drafted a balanced payment clause using a standard net 30 structure, a short invoice dispute window, and a capped late-payment remedy.',
        draftHtml:
          '<h2>Fees and Payment</h2><p>Customer shall pay the fees set out in the applicable Statement of Work or Order Form. Unless otherwise agreed in writing, Supplier shall invoice Customer monthly in arrears, and Customer shall pay each undisputed invoice within thirty (30) days after receipt.</p><p>Customer shall notify Supplier in writing of any good-faith dispute regarding an invoice within ten (10) days after receipt, describing the basis of the dispute in reasonable detail. The parties shall work together promptly to resolve any such dispute, and Customer shall timely pay all undisputed amounts.</p><p>Any undisputed amount not paid when due may accrue interest at the lesser of one percent (1.0%) per month or the maximum rate permitted by applicable law, from the due date until paid in full.</p>',
        applyMode: hasSelection ? 'replace_selection' : 'insert_at_cursor',
        quickReplies: [
          { label: 'Net 15', value: 'Use net 15 payment terms instead.' },
          { label: 'Milestones', value: 'Rewrite this as milestone-based payments.' },
          { label: 'No late fee', value: 'Remove the late payment interest language.' },
          { label: 'Advance billing', value: 'Rewrite this for invoicing in advance.' },
        ],
      };

    case 'termination':
      return {
        title: 'Termination Clause',
        assistantMessage:
          'I drafted a practical termination clause with cause, cure rights, and a clean transition obligation.',
        draftHtml:
          '<h2>Termination</h2><p>Either party may terminate this Agreement for material breach if the other party fails to cure such breach within thirty (30) days after receiving written notice describing the breach in reasonable detail.</p><p>Customer may terminate this Agreement for convenience upon sixty (60) days prior written notice, provided that Customer shall pay Supplier for Services properly performed and authorized expenses incurred through the effective date of termination.</p><p>Upon expiration or termination of this Agreement, each party shall promptly return or destroy the other party\'s Confidential Information, except to the extent retention is required by applicable law, and Supplier shall reasonably cooperate in an orderly transition of the Services.</p>',
        applyMode: hasSelection ? 'replace_selection' : 'insert_at_cursor',
        quickReplies: [
          { label: 'Mutual convenience', value: 'Make termination for convenience mutual.' },
          { label: 'Shorter notice', value: 'Change the convenience notice period to 30 days.' },
          { label: 'Customer only', value: 'Keep convenience termination only for the customer.' },
        ],
      };

    case 'confidentiality':
      return {
        title: 'Confidentiality',
        assistantMessage:
          'I drafted a standard confidentiality clause that covers use restrictions, permitted disclosures, and return-or-destroy obligations.',
        draftHtml:
          '<h2>Confidentiality</h2><p>Each party receiving Confidential Information from the other party shall protect such Confidential Information using at least the same degree of care it uses to protect its own similar information, and in no event less than reasonable care. The receiving party shall use Confidential Information solely to perform or exercise its rights under this Agreement and shall not disclose it to any third party except to its employees, contractors, and professional advisers who have a need to know and are bound by confidentiality obligations no less protective than those set out herein.</p><p>The foregoing obligations shall not apply to information that the receiving party can demonstrate is or becomes publicly available through no fault of the receiving party, was already lawfully known to the receiving party without restriction, is lawfully received from a third party without restriction, or is independently developed without use of the disclosing party\'s Confidential Information.</p><p>Upon written request or upon expiration or termination of this Agreement, the receiving party shall promptly return or destroy the disclosing party\'s Confidential Information, except to the extent retention is required by applicable law.</p>',
        applyMode: hasSelection ? 'replace_selection' : 'insert_at_cursor',
        quickReplies: [
          { label: 'Mutual', value: 'Make this expressly mutual between both parties.' },
          { label: '5-year term', value: 'Add a five-year confidentiality survival period.' },
          { label: 'Trade secrets', value: 'Make trade secret obligations perpetual.' },
        ],
      };

    case 'liability':
      return {
        title: 'Liability Cap',
        assistantMessage:
          'I drafted a market-standard liability limitation with a fee-based cap and a carve-out structure.',
        draftHtml:
          '<h2>Limitation of Liability</h2><p>Except for liability arising from a party\'s gross negligence, willful misconduct, breach of its confidentiality obligations, infringement of the other party\'s intellectual property rights, or amounts payable under its indemnification obligations, neither party shall be liable to the other party for any indirect, incidental, special, consequential, exemplary, or punitive damages, or for any loss of profits, revenue, goodwill, or anticipated savings, arising out of or related to this Agreement.</p><p>Except for the foregoing excluded liabilities, each party\'s aggregate liability arising out of or related to this Agreement shall not exceed the total fees paid or payable by Customer under this Agreement during the twelve (12) months preceding the event giving rise to the claim.</p>',
        applyMode: hasSelection ? 'replace_selection' : 'insert_at_cursor',
        quickReplies: [
          { label: '2x fees', value: 'Increase the liability cap to two times the fees paid in the prior 12 months.' },
          { label: 'Supplier friendly', value: 'Make the liability clause more supplier-friendly.' },
          { label: 'Customer friendly', value: 'Make the liability clause more customer-protective.' },
        ],
      };

    case 'gdpr':
      return {
        title: 'Data Protection',
        assistantMessage:
          'I drafted a concise GDPR-style data protection clause covering controller-processor responsibilities and security measures.',
        draftHtml:
          '<h2>Data Protection</h2><p>To the extent Supplier processes Personal Data on behalf of Customer in connection with the Services, Supplier shall process such Personal Data only on documented instructions from Customer, shall ensure that personnel authorized to process Personal Data are bound by appropriate confidentiality obligations, and shall implement appropriate technical and organizational measures to protect Personal Data against accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to Personal Data.</p><p>Supplier shall promptly notify Customer of any confirmed Personal Data Breach affecting Personal Data processed under this Agreement and shall provide reasonable cooperation to assist Customer in meeting its obligations under applicable data protection laws. Supplier shall not engage a sub-processor without ensuring that such sub-processor is bound by written obligations providing materially the same level of protection for Personal Data as set out in this Agreement.</p>',
        applyMode: hasSelection ? 'replace_selection' : 'insert_at_cursor',
        quickReplies: [
          { label: 'Add SCCs', value: 'Add language covering international data transfers and standard contractual clauses.' },
          { label: 'Short breach notice', value: 'Add a 48-hour breach notification deadline.' },
          { label: 'Customer-friendly', value: 'Make the data protection clause more customer-protective.' },
        ],
      };

    case 'rewrite':
      return {
        title: 'Rewrite Suggestion',
        assistantMessage:
          hasSelection
            ? 'I can rewrite the selected text, but the AI editor service is unavailable right now. Please try again once AI generation is available.'
            : 'Select the text you want rewritten and try again, or use one of the clause prompts for a ready-to-insert suggestion.',
        draftHtml: '',
        applyMode: 'none',
        quickReplies: [
          { label: 'Simplify wording', value: 'Simplify the selected text into plain English.' },
          { label: 'Make more protective', value: 'Rewrite the selected text to be more protective of our side.' },
        ],
        followUpQuestion: hasSelection ? undefined : 'Which section should I rewrite?',
      };

    default:
      return {
        title: 'Drafting Help',
        assistantMessage:
          'I can help by drafting a clause, rewriting selected language, or tightening a risky provision. Tell me what you want to add or improve, and I will prepare insertion-ready text.',
        draftHtml: '',
        applyMode: 'none',
        quickReplies: [
          { label: 'Add payment terms', value: 'Add payment terms to this draft.' },
          { label: 'Add termination clause', value: 'Add a termination clause to this draft.' },
          { label: 'Limit liability', value: 'Add a balanced limitation of liability clause.' },
          { label: 'Add GDPR clause', value: 'Add a GDPR-style data protection clause.' },
        ],
        followUpQuestion: 'What clause or section should I work on?',
      };
  }
}

// ---------------------------------------------------------------------------
// Editor-assist helpers: extract user parameters + structured playbook views
// ---------------------------------------------------------------------------

function compactPlaybookText(value: string | undefined, max = 600): string {
  if (!value) return '';
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > max ? `${normalized.slice(0, max - 3).trimEnd()}...` : normalized;
}

/**
 * Extract concrete contract parameters from a free-form user message so the
 * AI is forced to use them verbatim instead of falling back to placeholders.
 * Patterns are deliberately conservative — false positives are worse than
 * a missing extraction (the model will still pick them up from the prompt).
 */
function extractMessageParameters(message: string): Record<string, string> {
  const out: Record<string, string> = {};
  const text = message.trim();
  if (!text) return out;

  // Term / duration: "12 months", "3 years", "for two (2) years"
  const termMatch = text.match(/(\d{1,3}|two|three|four|five|six|seven|eight|nine|ten|twelve|twenty[- ]?four|thirty[- ]?six)\s*(?:\(\d+\)\s*)?(month|months|year|years|week|weeks|day|days)/i);
  if (termMatch) out.term = `${termMatch[1]} ${termMatch[2].toLowerCase()}`;

  // Notice period: "30 days notice", "60-day notice"
  const noticeMatch = text.match(/(\d{1,3})[- ]?day(?:s)?\s+(?:prior\s+)?(?:written\s+)?notice/i);
  if (noticeMatch) out.noticePeriod = `${noticeMatch[1]} days`;

  // Net payment terms: "net 30", "net-15"
  const netMatch = text.match(/net[- ]?(\d{1,3})/i);
  if (netMatch) out.paymentTerms = `Net ${netMatch[1]}`;

  // Monetary cap: "$50,000", "USD 100k", "EUR 250 000"
  const moneyMatch = text.match(/(?:cap(?:ped)?(?:\s+at)?|liability(?:\s+cap)?|fee(?:s)?|value|worth|amount)[^\d$€£CHF]{0,20}((?:\$|€|£|CHF|USD|EUR|GBP)\s?\d[\d,. ]*\s?(?:k|m|million|thousand)?)/i);
  if (moneyMatch) out.cap = moneyMatch[1].replace(/\s+/g, ' ').trim();

  // Standalone currency amounts when no anchor word: "$100,000"
  if (!out.cap) {
    const standaloneMoney = text.match(/((?:\$|€|£|CHF)\s?\d[\d,. ]{2,})/);
    if (standaloneMoney) out.amount = standaloneMoney[1].replace(/\s+/g, ' ').trim();
  }

  // Governing law / jurisdiction
  const govMatch = text.match(/(?:governing law|jurisdiction|governed by(?:\s+the\s+laws\s+of)?|laws of)[:\s]+([A-Z][A-Za-z .,&-]{2,60}?)(?:[.,;\n]|$)/i);
  if (govMatch) out.governingLaw = govMatch[1].trim().replace(/\.$/, '');

  // Single-word jurisdictions when explicitly mentioned with "law"/"jurisdiction"
  if (!out.governingLaw) {
    const jurisdictions = ['Delaware', 'New York', 'California', 'Texas', 'England', 'Wales', 'Scotland', 'Switzerland', 'Germany', 'France', 'Singapore', 'Hong Kong', 'Australia', 'Canada', 'Ireland', 'Netherlands', 'Spain', 'Italy', 'Japan'];
    for (const jur of jurisdictions) {
      const re = new RegExp(`\\b${jur}\\b\\s*(?:law|jurisdiction|courts|governed)`, 'i');
      if (re.test(text)) {
        out.governingLaw = jur;
        break;
      }
    }
  }

  // Effective date
  const dateMatch = text.match(/(?:effective(?:\s+date)?|starting|commencing)[:\s]+([A-Za-z0-9 ,/.-]{4,40}?)(?:[.,;\n]|$)/i);
  if (dateMatch) out.effectiveDate = dateMatch[1].trim();

  // Renewal: "auto-renew", "annual renewal", "automatically renew for one-year terms"
  if (/auto[- ]?renew|automatic(ally)?\s+renew/i.test(text)) out.renewal = 'auto-renew';
  else if (/no\s+(auto|automatic)\s+renew|do\s+not\s+renew/i.test(text)) out.renewal = 'no auto-renew';

  // Confidentiality survival period
  const survMatch = text.match(/(?:confidentiality|surviv\w*)[^\n]{0,30}?(\d{1,2})\s*(year|years|month|months)/i);
  if (survMatch) out.confidentialitySurvival = `${survMatch[1]} ${survMatch[2].toLowerCase()}`;

  // Parties: "between Acme Corp and Beta GmbH", "Acme as Buyer"
  const betweenMatch = text.match(/between\s+([A-Z][A-Za-z0-9 .,&-]{2,60}?)\s+and\s+([A-Z][A-Za-z0-9 .,&-]{2,60}?)(?:[.,;\n]|$)/);
  if (betweenMatch) {
    out.partyA = betweenMatch[1].trim();
    out.partyB = betweenMatch[2].trim();
  }

  // Contract type hints inside the message
  const typeHint = text.match(/\b(NDA|MSA|SOW|SLA|SaaS|MNDA|DPA|services agreement|employment|license|lease|amendment|order form)\b/i);
  if (typeHint) out.contractTypeHint = typeHint[1].toUpperCase();

  return out;
}

function buildPlaybookClauseLanguageMap(playbook: Playbook): string {
  const clauses = playbook.clauses || [];
  if (clauses.length === 0) return '';
  return clauses
    .slice(0, 12)
    .map((clause) => {
      const lines = [`[${clause.category}] preferred:\n${compactPlaybookText(clause.preferredText, 700)}`];
      if (clause.minimumAcceptable) {
        lines.push(`  minimum acceptable: ${compactPlaybookText(clause.minimumAcceptable, 280)}`);
      }
      if (clause.negotiationGuidance) {
        lines.push(`  guidance: ${compactPlaybookText(clause.negotiationGuidance, 220)}`);
      }
      return lines.join('\n');
    })
    .join('\n\n');
}

function buildPlaybookFallbackTable(playbook: Playbook): string {
  const entries = Object.entries(playbook.fallbackPositions || {});
  if (entries.length === 0) return '';
  return entries
    .slice(0, 8)
    .map(([category, position]) => {
      const parts = [`[${category}] initial: ${compactPlaybookText(position.initial, 220)}`];
      if (position.fallback1) parts.push(`  fallback1: ${compactPlaybookText(position.fallback1, 200)}`);
      if (position.fallback2) parts.push(`  fallback2: ${compactPlaybookText(position.fallback2, 200)}`);
      if (position.walkaway) parts.push(`  walkaway: ${compactPlaybookText(position.walkaway, 200)}`);
      return parts.join('\n');
    })
    .join('\n\n');
}

function buildPlaybookRedFlagList(playbook: Playbook): string {
  const flags = playbook.redFlags || [];
  if (flags.length === 0) return '';
  return flags
    .slice(0, 10)
    .map(
      (flag) =>
        `[${flag.category} / ${flag.severity}] avoid: ${compactPlaybookText(flag.pattern, 160)} \u2014 ${compactPlaybookText(flag.explanation, 200)}`,
    )
    .join('\n');
}

async function runEditorAssist(
  message: string,
  context: DraftAssistantRequest['context'],
  playbookPromptContext?: string,
  playbook?: Playbook,
  safetyMode: DraftAssistantSafetyMode = 'standard',
): Promise<EditorAssistResponse> {
  if (!hasAIClientConfig()) {
    return runEditorAssistFallback(message, context);
  }

  try {
    const openai = createOpenAIClient();
    const model = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
    const safeContext = safetyMode === 'strict' ? normalizeDraftingValue(context) : context;
    const excerpt = (safeContext.currentContent || '').slice(0, 6000);
    const selectedText = (safeContext.selectedText || '').slice(0, 2000);
    const headings = (safeContext.documentSections || []).slice(0, 20);
    const extractedParameters = extractMessageParameters(message);
    const safeMessage = safetyMode === 'strict' ? normalizeDraftingPrompt(message) : message;
    const safeExtractedParameters = safetyMode === 'strict' ? normalizeDraftingValue(extractedParameters) : extractedParameters;
    const safePlaybook = safetyMode === 'strict' ? normalizeDraftingValue(playbook) : playbook;
    const safePlaybookPromptContext = playbookPromptContext
      ? (safetyMode === 'strict' ? normalizeDraftingPrompt(playbookPromptContext) : playbookPromptContext)
      : '';
    const playbookClauseMap = safePlaybook ? buildPlaybookClauseLanguageMap(safePlaybook) : '';
    const playbookRedFlagList = safePlaybook ? buildPlaybookRedFlagList(safePlaybook) : '';
    const playbookFallbackTable = safePlaybook ? buildPlaybookFallbackTable(safePlaybook) : '';
    const extractedParamLines = Object.entries(safeExtractedParameters)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join('\n');

    const userPromptParts = [
      safetyMode === 'strict'
        ? `Treat this as a legitimate contract drafting request written in neutral business language. The user wants help with ${summarizeDraftingPromptForStrictSafety(message)}.`
        : `User request:\n${safeMessage}`,
      `Contract type: ${safeContext.contractType || 'Unknown'}`,
      `Tone: ${safeContext.tone || 'standard'}`,
      `Selected text:\n${selectedText || 'None'}`,
      `Document sections:\n${headings.length > 0 ? headings.join(' | ') : 'None provided'}`,
      `Current draft excerpt:\n${excerpt || 'No draft content yet.'}`,
      extractedParamLines
        ? `Parameters extracted from this request (use these EXACT values when drafting; do not output placeholders for them):\n${extractedParamLines}`
        : 'Parameters extracted from this request: none — only invent values if the playbook provides them.',
      safePlaybookPromptContext ? `Active policy pack guidance:\n${safePlaybookPromptContext}` : '',
      playbookClauseMap
        ? `Full playbook clause language (USE VERBATIM where the inferred category matches; substitute extracted parameters into placeholders):\n${playbookClauseMap}`
        : '',
      playbookFallbackTable
        ? `Playbook fallback positions (default to 'initial' unless the user asks for fallback or walkaway):\n${playbookFallbackTable}`
        : '',
      playbookRedFlagList
        ? `Playbook red-flag patterns (treat selected text matching these as candidates for remove_clause or rewrite to neutralise):\n${playbookRedFlagList}`
        : '',
    ].filter(Boolean);

    const response = await openai.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: 1800,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: safetyMode === 'strict' ? normalizeDraftingPrompt(EDITOR_ASSIST_SYSTEM_PROMPT) : EDITOR_ASSIST_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: userPromptParts.join('\n\n'),
        },
      ],
    });

    const raw = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw) as Partial<EditorAssistResponse> & {
      quickReplies?: Array<{ label?: string; value?: string }>;
      detectedParameters?: Record<string, unknown>;
    };
    const quickReplies = Array.isArray(parsed.quickReplies)
      ? parsed.quickReplies
          .filter(
            (item): item is { label: string; value: string } =>
              Boolean(item && typeof item.label === 'string' && item.label.trim() && typeof item.value === 'string' && item.value.trim())
          )
          .slice(0, 4)
      : [];

    const applyMode = parsed.applyMode === 'replace_selection' || parsed.applyMode === 'insert_at_cursor' || parsed.applyMode === 'none'
      ? parsed.applyMode
      : selectedText
        ? 'replace_selection'
        : 'insert_at_cursor';

    const operation: EditorAssistOperation | undefined =
      typeof parsed.operation === 'string' && [
        'add_clause',
        'replace_clause',
        'remove_clause',
        'rewrite',
        'fill_variables',
        'tighten_risk',
        'other',
      ].includes(parsed.operation)
        ? (parsed.operation as EditorAssistOperation)
        : undefined;

    const detectedParameters: Record<string, string> = {};
    if (parsed.detectedParameters && typeof parsed.detectedParameters === 'object') {
      for (const [key, value] of Object.entries(parsed.detectedParameters)) {
        if (typeof value === 'string' && value.trim()) {
          detectedParameters[key] = value.trim();
        } else if (typeof value === 'number') {
          detectedParameters[key] = String(value);
        }
      }
    }
    for (const [k, v] of Object.entries(extractedParameters)) {
      if (!detectedParameters[k]) detectedParameters[k] = v;
    }

    return {
      title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : 'Suggested Language',
      assistantMessage:
        typeof parsed.assistantMessage === 'string' && parsed.assistantMessage.trim()
          ? parsed.assistantMessage.trim()
          : 'I drafted language you can insert directly into the contract.',
      draftHtml: typeof parsed.draftHtml === 'string' ? parsed.draftHtml.trim() : '',
      applyMode,
      quickReplies,
      followUpQuestion:
        typeof parsed.followUpQuestion === 'string' && parsed.followUpQuestion.trim()
          ? parsed.followUpQuestion.trim()
          : undefined,
      operation,
      detectedCategory:
        typeof parsed.detectedCategory === 'string' && parsed.detectedCategory.trim()
          ? parsed.detectedCategory.trim()
          : null,
      detectedParameters,
    };
  } catch (error) {
    if (isAzureContentFilteredError(error)) {
      throw error;
    }

    logger.warn('Editor assist fell back to deterministic response', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return runEditorAssistFallback(message, context);
  }
}

async function runEditorAssistWithSafetyRetry(
  message: string,
  context: DraftAssistantRequest['context'],
  playbookPromptContext?: string,
  playbook?: Playbook,
): Promise<EditorAssistResponse> {
  try {
    return await runEditorAssist(message, context, playbookPromptContext, playbook);
  } catch (error) {
    if (!isAzureContentFilteredError(error)) {
      throw error;
    }

    logger.warn('Draft assistant editor assist hit Azure content filter, retrying with normalized business wording', {
      requestShape: summarizeDraftingPromptForStrictSafety(message),
    });

    return runEditorAssist(message, context, playbookPromptContext, playbook, 'strict');
  }
}

// ---------------------------------------------------------------------------
// Draft Generation Pipeline (simplified inline version)
// ---------------------------------------------------------------------------

async function runGenerationPipeline(
  tenantId: string,
  userId: string,
  context: DraftAssistantRequest['context'],
  emit: (event: string, data: unknown) => void,
): Promise<void> {
  const contractType = context.contractType || 'MSA';
  const title = context.title || `${contractType} Draft`;
  const model = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
  const hasAI = hasAIClientConfig();

  const variables: Record<string, string> = {};
  if (context.parties?.length) {
    context.parties.forEach((p, i) => {
      variables[`party${i + 1}Name`] = p.name;
      variables[`party${i + 1}Role`] = p.role;
    });
  }
  if (context.jurisdiction) variables.jurisdiction = context.jurisdiction;
  if (context.keyTerms) Object.assign(variables, context.keyTerms);

  emit('generation_started', { message: 'Generating your contract draft...' });

  // Step 1: Template Selection
  const step1Start = Date.now();
  emit('generation_step', { step: 1, name: 'Template Selection', status: 'running' });

  let template: { id: string; name: string; content: string } | null = null;
  if (context.templateId) {
    const t = await prisma.contractTemplate.findFirst({
      where: { id: context.templateId, tenantId },
    });
    if (t) {
      const meta = (t.metadata as Record<string, unknown>) || {};
      template = { id: t.id, name: t.name, content: (meta.content as string) || '' };
    }
  } else {
    const typeMap: Record<string, string[]> = {
      NDA: ['NDA', 'Non-Disclosure', 'Confidentiality'],
      MSA: ['MSA', 'Master Service', 'Service Agreement'],
      SOW: ['SOW', 'Statement of Work', 'Project'],
      SLA: ['SLA', 'Service Level'],
    };
    const keywords = typeMap[contractType.toUpperCase()] || [contractType];
    const found = await prisma.contractTemplate.findFirst({
      where: {
        tenantId,
        isActive: true,
        OR: keywords.map((k) => ({ name: { contains: k, mode: 'insensitive' as const } })),
      },
      orderBy: { usageCount: 'desc' },
    });
    if (found) {
      const meta = (found.metadata as Record<string, unknown>) || {};
      template = { id: found.id, name: found.name, content: (meta.content as string) || '' };
    }
  }

  emit('generation_step', {
    step: 1,
    name: 'Template Selection',
    status: 'completed',
    durationMs: Date.now() - step1Start,
  });

  // Step 2: Clause Recommendation
  const step2Start = Date.now();
  emit('generation_step', { step: 2, name: 'Clause Recommendation', status: 'running' });

  let clauses: Array<{ id: string; title: string; category: string; content: string }> = [];
  try {
    clauses = await prisma.clauseLibrary.findMany({
      where: {
        tenantId,
        OR: [
          ...(context.selectedClauses?.length
            ? [{ id: { in: context.selectedClauses } }]
            : []),
          { isStandard: true },
          { isMandatory: true },
        ],
      },
      select: { id: true, title: true, category: true, content: true },
      orderBy: { usageCount: 'desc' },
      take: 10,
    });
  } catch {
    // Continue without clauses
  }

  emit('generation_step', {
    step: 2,
    name: 'Clause Recommendation',
    status: 'completed',
    durationMs: Date.now() - step2Start,
  });

  // Step 3: Content Generation
  const step3Start = Date.now();
  emit('generation_step', { step: 3, name: 'Content Generation', status: 'running' });

  let html = '';
  if (hasAI) {
    try {
      const openai = createOpenAIClient();
      const tone = context.tone || 'formal';
      const jurisdiction = context.jurisdiction || 'United States';

      const variableBlock = Object.entries(variables)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');

      const templateBlock = template
        ? `\n\nBase Template (${template.name}):\n${template.content.slice(0, 6000)}`
        : '';

      const clauseBlock =
        clauses.length > 0
          ? `\n\nApproved Clauses to incorporate:\n${clauses.map((c) => `[${c.category}] ${c.title}\n${c.content}`).join('\n\n')}`
          : '';

      const buildGenerationMessages = (safetyMode: DraftAssistantSafetyMode) => {
        const safeContractType = safetyMode === 'strict' ? normalizeDraftingPrompt(contractType) : contractType;
        const safeVariableBlock =
          safetyMode === 'strict'
            ? normalizeDraftingPrompt(variableBlock || 'None specified — use standard placeholders')
            : (variableBlock || 'None specified — use standard placeholders');
        const safeTemplateBlock = safetyMode === 'strict' ? normalizeDraftingPrompt(templateBlock) : templateBlock;
        const safeClauseBlock = safetyMode === 'strict' ? normalizeDraftingPrompt(clauseBlock) : clauseBlock;

        return [
          {
            role: 'system' as const,
            content: `You are an expert contract attorney generating a complete, professional contract draft.

Output Requirements:
- Return the contract as clean HTML suitable for a WYSIWYG editor
- Use proper heading tags (h1, h2, h3) for sections
- Use <p> tags for paragraphs, <ol>/<ul> for lists
- Use <strong> for defined terms on first use
- Include proper contract structure: title, preamble/recitals, definitions, operative clauses, general provisions, signature blocks
- Tone: ${tone}
- Jurisdiction: ${jurisdiction}
- Replace template variables ({{variableName}}) with provided values
- Use placeholder brackets [___] only for values NOT provided
- Be thorough and complete — this should be ready for legal review

Do NOT include any markdown. Return ONLY HTML content.`,
          },
          {
            role: 'user' as const,
            content: `Generate a complete ${safeContractType} contract.

Variables:
${safeVariableBlock}${safeTemplateBlock}${safeClauseBlock}`,
          },
        ];
      };

      let response;

      try {
        response = await openai.chat.completions.create({
          model,
          temperature: 0.3,
          max_tokens: 4096,
          messages: buildGenerationMessages('standard'),
        });
      } catch (aiError: unknown) {
        if (!isAzureContentFilteredError(aiError)) {
          throw aiError;
        }

        logger.warn('Draft assistant generation hit Azure content filter, retrying with normalized drafting context', {
          requestShape: summarizeDraftingPromptForStrictSafety(`${contractType} ${Object.values(variables).join(' ')}`),
        });

        response = await openai.chat.completions.create({
          model,
          temperature: 0.3,
          max_tokens: 4096,
          messages: buildGenerationMessages('strict'),
        });
      }

      html = response.choices[0]?.message?.content || '';
    } catch (aiError: unknown) {
      const aiMsg = aiError instanceof Error ? aiError.message : '';
      if (
        !aiMsg.includes('DeploymentNotFound') &&
        !aiMsg.includes('model_not_found') &&
        !aiMsg.includes('does not exist')
      ) {
        throw aiError;
      }
      // Fall through to template fallback
    }
  }

  if (!html && template?.content) {
    html = template.content;
    for (const [k, v] of Object.entries(variables)) {
      html = html.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'gi'), v);
    }
    html = html
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/^(?!<[hlo])(.*\S.*)$/gm, '<p>$1</p>');
  } else if (!html) {
    html = `<h1>${title}</h1><p>AI service is not configured. Please set up Azure OpenAI deployment to enable AI-powered contract generation.</p><p>Contract Type: ${contractType}</p>`;
  }

  emit('generation_step', {
    step: 3,
    name: 'Content Generation',
    status: 'completed',
    durationMs: Date.now() - step3Start,
  });

  // Step 4: Risk Analysis
  const step4Start = Date.now();
  emit('generation_step', { step: 4, name: 'Risk Analysis', status: 'running' });

  let risks: unknown[] = [];
  const plainText = html.replace(/<[^>]+>/g, '').trim();

  if (hasAI && plainText.length > 100) {
    try {
      const openai = createOpenAIClient();
      const riskResponse = await openai.chat.completions.create({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are a legal risk analyst. Analyze the contract draft and identify potential risks. Return JSON: { "risks": [{ "category": "...", "severity": "LOW|MEDIUM|HIGH|CRITICAL", "description": "...", "suggestion": "..." }] }. Limit to top 5 risks.`,
          },
          {
            role: 'user',
            content: `Analyze this ${contractType} contract for risks:\n\n${plainText.slice(0, 8000)}`,
          },
        ],
      });
      const parsed = JSON.parse(riskResponse.choices[0]?.message?.content || '{"risks":[]}');
      risks = parsed.risks || [];
    } catch {
      // Skip risk analysis
    }
  }

  emit('generation_step', {
    step: 4,
    name: 'Risk Analysis',
    status: risks.length > 0 ? 'completed' : 'skipped',
    durationMs: Date.now() - step4Start,
  });

  // Step 5: Save Draft
  const step5Start = Date.now();
  emit('generation_step', { step: 5, name: 'Saving Draft', status: 'running' });

  let draft;
  try {
    draft = await prisma.contractDraft.create({
      data: {
        tenantId,
        title,
        type: contractType,
        sourceType: template ? 'TEMPLATE' : 'NEW',
        templateId: template?.id || null,
        content: html,
        clauses: clauses.map((c) => ({ id: c.id, title: c.title, category: c.category })),
        variables,
        structure: {
          risks: risks as any[],
          generatedAt: new Date().toISOString(),
          generatedBy: 'draft-assistant',
          context: {
            parties: context.parties,
            jurisdiction: context.jurisdiction,
            tone: context.tone,
          },
        } as any,
        status: 'DRAFT',
        createdBy: userId,
      },
      select: { id: true, title: true, status: true },
    });
  } catch (dbError: unknown) {
    const msg = dbError instanceof Error ? dbError.message : 'Database error';
    logger.error('Failed to save draft', { tenantId, error: msg });
    emit('error', { message: 'Failed to save draft. Please try again.' });
    return;
  }

  if (template) {
    await prisma.contractTemplate
      .update({
        where: { id: template.id },
        data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
      })
      .catch(() => {});
  }

  emit('generation_step', {
    step: 5,
    name: 'Saving Draft',
    status: 'completed',
    durationMs: Date.now() - step5Start,
  });

  // Step 6: Finalize
  emit('generation_step', { step: 6, name: 'Finalizing', status: 'completed', durationMs: 0 });

  emit('generation_complete', {
    draftId: draft.id,
    title: draft.title,
    editUrl: `/drafting/copilot?draft=${draft.id}`,
  });
}

// ---------------------------------------------------------------------------
// POST Handler
// ---------------------------------------------------------------------------

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { tenantId, userId } = ctx;

  // Rate limit: streaming tier (10 req/min)
  const rl = checkRateLimit(tenantId, userId, '/api/ai/agents/draft-assistant', AI_RATE_LIMITS.streaming);
  if (!rl.allowed) return rateLimitResponse(rl, ctx.requestId);

  // Parse and validate body
  let body: DraftAssistantRequest;
  try {
    body = (await request.json()) as DraftAssistantRequest;
  } catch {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid JSON body.', 400);
  }

  if (!body.message || typeof body.message !== 'string') {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'A "message" string is required.', 400);
  }

  // Trim whitespace and reject empty messages
  body.message = body.message.trim();
  if (!body.message) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Message cannot be empty.', 400);
  }

  if (body.message.length > MAX_MESSAGE_LENGTH) {
    return createErrorResponse(
      ctx,
      'VALIDATION_ERROR',
      `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters.`,
      400,
    );
  }

  if (!Array.isArray(body.conversationHistory)) {
    body.conversationHistory = [];
  }

  // Validate conversation history items
  body.conversationHistory = body.conversationHistory.filter(
    (msg: { role?: string; content?: string }) =>
      msg &&
      typeof msg.role === 'string' &&
      ['user', 'assistant'].includes(msg.role) &&
      typeof msg.content === 'string' &&
      msg.content.trim().length > 0
  );

  if (body.conversationHistory.length > MAX_HISTORY_ITEMS) {
    body.conversationHistory = body.conversationHistory.slice(-MAX_HISTORY_ITEMS);
  }

  // Enforce a total-size cap by trimming from the oldest end until we're
  // under the byte budget. We keep the most recent turns because they carry
  // the strongest context for the current reply.
  {
    let total = body.conversationHistory.reduce(
      (sum: number, m: { content?: string }) => sum + (typeof m?.content === 'string' ? m.content.length : 0),
      0,
    );
    while (total > MAX_HISTORY_TOTAL_BYTES && body.conversationHistory.length > 1) {
      const dropped = body.conversationHistory.shift() as { content?: string } | undefined;
      total -= typeof dropped?.content === 'string' ? dropped.content.length : 0;
    }
    // If a single message is itself larger than the cap, truncate its content.
    if (total > MAX_HISTORY_TOTAL_BYTES && body.conversationHistory.length === 1) {
      const only = body.conversationHistory[0];
      if (typeof only?.content === 'string') {
        only.content = only.content.slice(-MAX_HISTORY_TOTAL_BYTES);
      }
    }
  }

  body.context = body.context || {};
  body.action = body.action || 'chat';

  logger.info('Draft assistant request', {
    requestId: ctx.requestId,
    userId,
    tenantId,
    action: body.action,
    historyLength: body.conversationHistory.length,
    hasContext: Object.keys(body.context).filter((k) => body.context[k as keyof typeof body.context] != null).length,
  });

  const encoder = new TextEncoder();
  let cancelled = false;

  const stream = new ReadableStream({
    cancel() {
      cancelled = true;
    },
    async start(controller) {
      const emit = (event: string, data: unknown) => {
        if (cancelled) return;
        try {
          controller.enqueue(encoder.encode(sseEvent(event, data)));
        } catch {
          cancelled = true;
        }
      };

      // Circuit breaker check
      const assistantBreaker = getCircuitBreaker('ai-draft-assistant', { failureThreshold: 5, resetTimeoutMs: 60_000 });
      const breakerCheck = assistantBreaker.canExecute();
      if (!breakerCheck.allowed) {
        emit('message', { content: 'AI service is temporarily unavailable due to high error rate. Please try again in a minute.' });
        emit('done', {});
        controller.close();
        return;
      }

      // Heartbeat keeps the connection alive through proxy idle timeouts
      // (default nginx 60s) while the model thinks. Comment frames are
      // ignored by the EventSource spec so they don't trigger UI updates.
      const heartbeat = setInterval(() => {
        if (cancelled) {
          clearInterval(heartbeat);
          return;
        }
        try {
          controller.enqueue(encoder.encode(': hb\n\n'));
        } catch {
          clearInterval(heartbeat);
          cancelled = true;
        }
      }, 15_000);

      try {
        // ---------------------------------------------------------------
        // Action: generate — run the draft generation pipeline
        // ---------------------------------------------------------------
        if (body.action === 'generate') {
          try {
            await runGenerationPipeline(tenantId, userId, body.context, emit);
          } catch (pipelineError: unknown) {
            const msg = pipelineError instanceof Error ? pipelineError.message : 'Draft generation failed';
            logger.error('Generation pipeline error', { requestId: ctx.requestId, error: msg });
            emit('error', { message: 'Draft generation failed. Please try again.' });
          }
          emit('done', { done: true });
          controller.close();
          return;
        }

        // ---------------------------------------------------------------
        // Action: editor_assist — focused in-editor drafting help
        // ---------------------------------------------------------------
        if (body.action === 'editor_assist') {
          const resolvedPlaybook = await resolveRequestedPlaybook(tenantId, undefined, body.context.playbookId);
          const result = await runEditorAssistWithSafetyRetry(
            body.message,
            body.context,
            resolvedPlaybook ? formatPlaybookPromptContext(resolvedPlaybook) : undefined,
            resolvedPlaybook,
          );

          emit('assistant_message', {
            title: result.title,
            content: result.assistantMessage,
            draftHtml: result.draftHtml,
            applyMode: result.applyMode,
            followUpQuestion: result.followUpQuestion || '',
            operation: result.operation || 'other',
            detectedCategory: result.detectedCategory ?? null,
            detectedParameters: result.detectedParameters ?? {},
            playbookApplied: resolvedPlaybook ? { id: resolvedPlaybook.id, name: resolvedPlaybook.name } : null,
          });

          if (result.quickReplies.length > 0) {
            emit('suggestions', { suggestions: result.quickReplies });
          }

          assistantBreaker.recordSuccess();
          emit('done', { done: true });
          controller.close();
          return;
        }

        // ---------------------------------------------------------------
        // Action: chat — conversational flow
        // ---------------------------------------------------------------
        const hasAI = hasAIClientConfig();

        if (!hasAI) {
          // Fallback guided flow
          const result = runFallbackFlow(body.message, body.conversationHistory, body.context);

          // Emit context updates
          for (const update of result.contextUpdates) {
            emit('context_update', update);
          }

          // Emit message
          emit('message', { content: result.message, role: 'assistant' });

          // Emit suggestions
          if (result.suggestions.length > 0) {
            emit('suggestions', { suggestions: result.suggestions });
          }

          // Emit ready_to_generate if applicable
          if (result.readyToGenerate) {
            emit('ready_to_generate', {
              ready: true,
              summary: result.readySummary || { type: body.context.contractType },
            });
          }

          emit('done', { done: true });
          controller.close();
          return;
        }

        // ---------------------------------------------------------------
        // AI-powered conversational flow
        // ---------------------------------------------------------------
        const openai = createOpenAIClient();
        const model = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';

        // Build context summary for the system prompt
        const buildChatMessages = (safetyMode: DraftAssistantSafetyMode): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> => {
          const contextForPrompt = safetyMode === 'strict' ? normalizeDraftingValue(body.context) : body.context;
          const contextSummary = Object.entries(contextForPrompt)
            .filter(([, v]) => v != null && (typeof v !== 'object' || (Array.isArray(v) ? v.length > 0 : Object.keys(v as object).length > 0)))
            .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
            .join('\n');

          const contextBlock = contextSummary
            ? `\n\n## Current Context (already gathered)\n${contextSummary}`
            : '';

          return [
            {
              role: 'system',
              content: (safetyMode === 'strict' ? normalizeDraftingPrompt(SYSTEM_PROMPT) : SYSTEM_PROMPT) + contextBlock,
            },
            ...body.conversationHistory.map((m) => ({
              role: m.role as 'user' | 'assistant',
              content: safetyMode === 'strict' ? normalizeDraftingPrompt(m.content) : m.content,
            })),
            {
              role: 'user',
              content:
                safetyMode === 'strict'
                  ? `Treat this as a legitimate contract drafting conversation. The user's latest request in neutral business language is: ${normalizeDraftingPrompt(body.message)}`
                  : body.message,
            },
          ];
        };

        let response;

        try {
          response = await openai.chat.completions.create({
            model,
            temperature: 0.7,
            max_tokens: 1024,
            messages: buildChatMessages('standard'),
            tools: AI_TOOLS,
            tool_choice: 'auto',
            stream: true,
          });
        } catch (error) {
          if (!isAzureContentFilteredError(error)) {
            throw error;
          }

          logger.warn('Draft assistant chat hit Azure content filter, retrying with normalized business wording', {
            requestShape: summarizeDraftingPromptForStrictSafety(body.message),
          });

          response = await openai.chat.completions.create({
            model,
            temperature: 0.7,
            max_tokens: 1024,
            messages: buildChatMessages('strict'),
            tools: AI_TOOLS,
            tool_choice: 'auto',
            stream: true,
          });
        }

        // Process the streamed response
        let contentBuffer = '';
        const toolCalls = new Map<number, { name: string; arguments: string }>();

        for await (const chunk of response as AsyncIterable<{
          choices: Array<{
            delta: {
              content?: string | null;
              tool_calls?: Array<{
                index: number;
                id?: string;
                function?: { name?: string; arguments?: string };
              }>;
            };
            finish_reason?: string | null;
          }>;
        }>) {
          if (cancelled) break;

          const choice = chunk.choices?.[0];
          if (!choice) continue;

          const delta = choice.delta;

          // Stream text content token by token
          if (delta.content) {
            contentBuffer += delta.content;
            emit('message', { content: delta.content, role: 'assistant' });
          }

          // Accumulate tool call arguments
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const existing = toolCalls.get(tc.index);
              if (!existing) {
                toolCalls.set(tc.index, {
                  name: tc.function?.name || '',
                  arguments: tc.function?.arguments || '',
                });
              } else {
                if (tc.function?.name) existing.name = tc.function.name;
                if (tc.function?.arguments) existing.arguments += tc.function.arguments;
              }
            }
          }

          // Process complete tool calls at the end of the stream
          if (choice.finish_reason === 'tool_calls' || choice.finish_reason === 'stop') {
            for (const tc of Array.from(toolCalls.values())) {
              try {
                const args = JSON.parse(tc.arguments);
                switch (tc.name) {
                  case 'update_context':
                    emit('context_update', {
                      field: args.field,
                      value: args.value,
                      confidence: args.confidence,
                    });
                    break;

                  case 'suggest_options':
                    emit('suggestions', { suggestions: args.suggestions });
                    break;

                  case 'mark_ready':
                    emit('ready_to_generate', {
                      ready: true,
                      summary: args.summary,
                    });
                    break;

                  case 'generate_draft':
                    if (args.confirmation) {
                      try {
                        await runGenerationPipeline(tenantId, userId, body.context, emit);
                      } catch (genErr: unknown) {
                        const gm = genErr instanceof Error ? genErr.message : 'Generation failed';
                        logger.error('In-chat generation failed', { error: gm });
                        emit('error', { message: 'Draft generation failed. Please try again.' });
                      }
                    }
                    break;
                }
              } catch (parseError) {
                logger.warn('Failed to parse tool call arguments', {
                  tool: tc.name,
                  error: parseError instanceof Error ? parseError.message : 'Parse error',
                });
              }
            }
          }
        }

        assistantBreaker.recordSuccess();
        emit('done', { done: true });
      } catch (error: unknown) {
        // Record transient failures in circuit breaker
        if (assistantBreaker.isTransientError(error)) {
          assistantBreaker.recordFailure(error instanceof Error ? error.message : String(error));
        }

        logger.error('Draft assistant error', {
          requestId: ctx.requestId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        const rawMsg = error instanceof Error ? error.message : '';
        let safeMessage = 'An error occurred. Please try again.';

        if (
          rawMsg.includes('DeploymentNotFound') ||
          rawMsg.includes('model_not_found') ||
          rawMsg.includes('does not exist')
        ) {
          safeMessage = 'AI model not configured. Please contact your administrator.';
        } else if (isAzureContentFilteredError(error)) {
          safeMessage =
            'Your request looks legitimate, but the upstream AI filter still rejected it after a neutral retry. Try a shorter follow-up or split the drafting task into smaller steps.';
        } else if (rawMsg.includes('429') || rawMsg.includes('rate limit') || rawMsg.includes('quota')) {
          safeMessage = 'AI service rate limited. Please try again later.';
        } else if (rawMsg.includes('timeout') || rawMsg.includes('AbortError')) {
          safeMessage = 'Request timed out. Please try again.';
        }

        emit('error', { message: safeMessage });
        emit('done', { done: true });
      } finally {
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-Request-Id': ctx.requestId,
    },
  });
});
