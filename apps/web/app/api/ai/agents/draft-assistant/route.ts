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
  };
  action?: 'chat' | 'generate';
}

interface GenerationStep {
  step: number;
  name: string;
  status: 'running' | 'completed' | 'skipped' | 'failed';
  durationMs?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_MESSAGE_LENGTH = 10_000;
const MAX_HISTORY_ITEMS = 50;

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
2. Parties involved (names and roles — e.g., "Acme Corp" as "Disclosing Party")
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
        message: `Great choice! I'll help you create a ${detectedType}. Who are the parties involved? Please provide the name and role for each party (e.g., "Acme Corp as the Disclosing Party and Beta Inc as the Receiving Party").`,
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

      const response = await openai.chat.completions.create({
        model,
        temperature: 0.3,
        max_tokens: 4096,
        messages: [
          {
            role: 'system',
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
            role: 'user',
            content: `Generate a complete ${contractType} contract.

Variables:
${variableBlock || 'None specified — use standard placeholders'}${templateBlock}${clauseBlock}`,
          },
        ],
      });

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

  const draft = await prisma.contractDraft.create({
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
        risks,
        generatedAt: new Date().toISOString(),
        generatedBy: 'draft-assistant',
        context: {
          parties: context.parties,
          jurisdiction: context.jurisdiction,
          tone: context.tone,
        },
      },
      status: 'DRAFT',
      createdBy: userId,
    },
    select: { id: true, title: true, status: true },
  });

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
    editUrl: `/drafting?draftId=${draft.id}`,
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

  if (body.conversationHistory.length > MAX_HISTORY_ITEMS) {
    body.conversationHistory = body.conversationHistory.slice(-MAX_HISTORY_ITEMS);
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

      try {
        // ---------------------------------------------------------------
        // Action: generate — run the draft generation pipeline
        // ---------------------------------------------------------------
        if (body.action === 'generate') {
          await runGenerationPipeline(tenantId, userId, body.context, emit);
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
        const contextSummary = Object.entries(body.context)
          .filter(([, v]) => v != null && (typeof v !== 'object' || (Array.isArray(v) ? v.length > 0 : Object.keys(v as object).length > 0)))
          .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
          .join('\n');

        const contextBlock = contextSummary
          ? `\n\n## Current Context (already gathered)\n${contextSummary}`
          : '';

        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          { role: 'system', content: SYSTEM_PROMPT + contextBlock },
          ...body.conversationHistory.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          { role: 'user', content: body.message },
        ];

        const response = await openai.chat.completions.create({
          model,
          temperature: 0.7,
          max_tokens: 1024,
          messages,
          tools: AI_TOOLS,
          tool_choice: 'auto',
          stream: true,
        });

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
                      await runGenerationPipeline(tenantId, userId, body.context, emit);
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

        emit('done', { done: true });
      } catch (error: unknown) {
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
        } else if (rawMsg.includes('429') || rawMsg.includes('rate limit') || rawMsg.includes('quota')) {
          safeMessage = 'AI service rate limited. Please try again later.';
        } else if (rawMsg.includes('timeout') || rawMsg.includes('AbortError')) {
          safeMessage = 'Request timed out. Please try again.';
        }

        emit('error', { message: safeMessage });
        emit('done', { done: true });
      } finally {
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
      'X-Request-Id': ctx.requestId,
    },
  });
});
