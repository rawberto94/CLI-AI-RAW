/**
 * Agentic Contract Drafting API
 *
 * POST /api/ai/agents/draft — Multi-step agentic contract drafting with streaming
 *
 * Orchestrates the full contract drafting pipeline:
 *   1. Intent Detection   — Determine contract type and requirements
 *   2. Template Selection  — Match to best template from library
 *   3. Clause Recommendation — Suggest relevant clauses from clause library
 *   4. AI Generation       — Generate draft content using Azure OpenAI
 *   5. Risk Analysis        — Analyze generated content for risks
 *   6. Draft Creation       — Save to database as ContractDraft
 *
 * Streams progress via SSE so the frontend can show each step in real-time.
 *
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  withAuthApiHandler,
  createSuccessResponse,
  createErrorResponse,
  type AuthenticatedApiContext,
} from '@/lib/api-middleware';
import { createOpenAIClient, hasAIClientConfig } from '@/lib/openai-client';
import { checkRateLimit, rateLimitResponse, AI_RATE_LIMITS } from '@/lib/ai/rate-limit';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentDraftRequest {
  /** Free-text description of what the user wants (agentic mode) */
  prompt?: string;
  /** Explicit contract type: NDA, MSA, SOW, SLA, AMENDMENT, etc. */
  contractType?: string;
  /** Template ID to use (skips template selection step) */
  templateId?: string;
  /** Variables to fill into the template */
  variables?: Record<string, string>;
  /** Specific clause IDs to include */
  clauseIds?: string[];
  /** Tone: formal | standard | plain-english */
  tone?: 'formal' | 'standard' | 'plain-english';
  /** Jurisdiction for governing law */
  jurisdiction?: string;
  /** Additional instructions for the AI */
  instructions?: string;
  /** Whether to stream SSE events (default: true) */
  stream?: boolean;
  /** Title for the saved draft */
  title?: string;
}

interface AgentStep {
  step: number;
  name: string;
  status: 'running' | 'completed' | 'skipped' | 'failed';
  result?: unknown;
  error?: string;
  durationMs?: number;
}

// ---------------------------------------------------------------------------
// SSE Helpers
// ---------------------------------------------------------------------------

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ---------------------------------------------------------------------------
// Agent Steps
// ---------------------------------------------------------------------------

/** Step 1: Detect intent from free-text prompt */
async function detectIntent(
  prompt: string,
  openai: ReturnType<typeof createOpenAIClient>,
  model: string
): Promise<{ contractType: string; title: string; variables: Record<string, string>; instructions: string }> {
  const response = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a contract intelligence assistant. Analyze the user's request and extract structured intent.

Return JSON with:
- contractType: one of NDA, MSA, SOW, SLA, AMENDMENT, RENEWAL, EMPLOYMENT, LEASE, LICENSE, OTHER
- title: a concise title for the contract
- variables: key-value pairs extracted from the request (partyA, partyB, effectiveDate, etc.)
- instructions: any specific instructions or requirements mentioned`,
      },
      { role: 'user', content: prompt },
    ],
  });

  const content = response.choices[0]?.message?.content || '{}';
  try {
    return JSON.parse(content);
  } catch {
    return { contractType: 'MSA', title: 'Contract Draft', variables: {}, instructions: prompt };
  }
}

/** Step 2: Select best matching template */
async function selectTemplate(
  tenantId: string,
  contractType: string
): Promise<{ id: string; name: string; content: string; clauses: unknown; structure: unknown } | null> {
  // Try exact match on contract type keywords
  const typeMap: Record<string, string[]> = {
    NDA: ['NDA', 'Non-Disclosure', 'Confidentiality'],
    MSA: ['MSA', 'Master Service', 'Service Agreement'],
    SOW: ['SOW', 'Statement of Work', 'Project'],
    SLA: ['SLA', 'Service Level'],
  };

  const keywords = typeMap[contractType.toUpperCase()] || [contractType];

  const templates = await prisma.contractTemplate.findMany({
    where: {
      tenantId,
      isActive: true,
      OR: keywords.map(k => ({ name: { contains: k, mode: 'insensitive' as const } })),
    },
    orderBy: { usageCount: 'desc' },
    take: 1,
  });

  if (templates.length === 0) {
    // Fallback: get any active template
    const fallback = await prisma.contractTemplate.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { usageCount: 'desc' },
    });
    if (!fallback) return null;
    const meta = fallback.metadata as Record<string, unknown> || {};
    return {
      id: fallback.id,
      name: fallback.name,
      content: (meta.content as string) || '',
      clauses: fallback.clauses,
      structure: fallback.structure,
    };
  }

  const t = templates[0];
  const meta = t.metadata as Record<string, unknown> || {};
  return {
    id: t.id,
    name: t.name,
    content: (meta.content as string) || '',
    clauses: t.clauses,
    structure: t.structure,
  };
}

/** Step 3: Recommend clauses from clause library */
async function recommendClauses(
  tenantId: string,
  contractType: string,
  explicitIds?: string[]
): Promise<Array<{ id: string; title: string; category: string; content: string; riskLevel: string }>> {
  // If explicit IDs provided, fetch those
  if (explicitIds && explicitIds.length > 0) {
    const clauses = await prisma.clauseLibrary.findMany({
      where: { id: { in: explicitIds }, tenantId },
      select: { id: true, title: true, category: true, content: true, riskLevel: true },
    });
    return clauses;
  }

  // Auto-recommend based on contract type — get standard + mandatory clauses
  const clauses = await prisma.clauseLibrary.findMany({
    where: {
      tenantId,
      OR: [
        { isStandard: true },
        { isMandatory: true },
        { contractTypes: { array_contains: [contractType.toUpperCase()] } },
      ],
    },
    select: { id: true, title: true, category: true, content: true, riskLevel: true },
    orderBy: [{ isMandatory: 'desc' }, { isStandard: 'desc' }, { usageCount: 'desc' }],
    take: 10,
  });

  return clauses;
}

/** Step 4: Generate draft content via AI */
async function generateDraftContent(
  openai: ReturnType<typeof createOpenAIClient>,
  model: string,
  params: {
    contractType: string;
    template: { name: string; content: string } | null;
    clauses: Array<{ title: string; category: string; content: string }>;
    variables: Record<string, string>;
    tone: string;
    jurisdiction: string;
    instructions: string;
  }
): Promise<{ html: string; plainText: string }> {
  const variableBlock = Object.entries(params.variables)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  const templateBlock = params.template
    ? `\n\nBase Template (${params.template.name}):\n${params.template.content.slice(0, 6000)}`
    : '';

  const clauseBlock =
    params.clauses.length > 0
      ? `\n\nApproved Clauses to incorporate:\n${params.clauses.map(c => `[${c.category}] ${c.title}\n${c.content}`).join('\n\n')}`
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
- Tone: ${params.tone}
- Jurisdiction: ${params.jurisdiction}
- Replace template variables ({{variableName}}) with provided values
- Use placeholder brackets [___] only for values NOT provided
- Be thorough and complete — this should be ready for legal review

Do NOT include any markdown. Return ONLY HTML content.`,
      },
      {
        role: 'user',
        content: `Generate a complete ${params.contractType} contract.

Variables:
${variableBlock || 'None specified — use standard placeholders'}${templateBlock}${clauseBlock}${params.instructions ? `\n\nAdditional Instructions:\n${params.instructions}` : ''}`,
      },
    ],
  });

  const html = response.choices[0]?.message?.content || '';
  const plainText = html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { html, plainText };
}

/** Step 5: Analyze risks in generated content */
async function analyzeRisks(
  openai: ReturnType<typeof createOpenAIClient>,
  model: string,
  content: string,
  contractType: string
): Promise<Array<{ category: string; severity: string; description: string; clause: string; suggestion: string }>> {
  const response = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a legal risk analyst. Analyze the contract draft and identify potential risks, missing clauses, or problematic language.

Return JSON with:
{
  "risks": [
    {
      "category": "LIABILITY|COMPLIANCE|FINANCIAL|OPERATIONAL|IP|DATA_PRIVACY|TERMINATION",
      "severity": "LOW|MEDIUM|HIGH|CRITICAL",
      "description": "Brief description of the risk",
      "clause": "The specific clause or section with the issue",
      "suggestion": "Recommended improvement"
    }
  ]
}

Be practical — focus on genuinely risky items, not minor style issues. Limit to the top 5-8 most important risks.`,
      },
      {
        role: 'user',
        content: `Analyze this ${contractType} contract for risks:\n\n${content.slice(0, 8000)}`,
      },
    ],
  });

  const parsed = JSON.parse(response.choices[0]?.message?.content || '{"risks":[]}');
  return parsed.risks || [];
}

/** Step 6: Save draft to database */
async function saveDraft(
  tenantId: string,
  userId: string,
  params: {
    title: string;
    contractType: string;
    templateId: string | null;
    content: string;
    clauses: Array<{ id: string; title: string; category: string }>;
    variables: Record<string, string>;
    risks: unknown[];
  }
): Promise<{ id: string; title: string; status: string }> {
  const draft = await prisma.contractDraft.create({
    data: {
      tenantId,
      title: params.title,
      type: params.contractType,
      sourceType: params.templateId ? 'TEMPLATE' : 'NEW',
      templateId: params.templateId,
      content: params.content,
      clauses: params.clauses.map(c => ({ id: c.id, title: c.title, category: c.category })),
      variables: params.variables,
      structure: {
        risks: params.risks,
        generatedAt: new Date().toISOString(),
        generatedBy: 'agent',
      },
      status: 'DRAFT',
      createdBy: userId,
    },
    select: { id: true, title: true, status: true },
  });

  // Increment template usage count
  if (params.templateId) {
    await prisma.contractTemplate.update({
      where: { id: params.templateId },
      data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
    }).catch(() => {});
  }

  return draft;
}

// ---------------------------------------------------------------------------
// POST Handler — Agentic Drafting Orchestration
// ---------------------------------------------------------------------------

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { tenantId, userId } = ctx;

  // Rate limit: 10 req/min (expensive AI operation)
  const rl = checkRateLimit(tenantId, userId, '/api/ai/agents/draft', AI_RATE_LIMITS.standard);
  if (!rl.allowed) return rateLimitResponse(rl, ctx.requestId);

  const body = (await request.json()) as AgentDraftRequest;

  // Validate: need either prompt or contractType
  if (!body.prompt && !body.contractType) {
    return createErrorResponse(
      ctx,
      'VALIDATION_ERROR',
      'Either "prompt" (free-text description) or "contractType" is required.',
      400
    );
  }

  const shouldStream = body.stream !== false;
  const model = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
  const hasAI = hasAIClientConfig();

  // Non-streaming mode (simple JSON response)
  if (!shouldStream) {
    return executeNonStreaming(ctx, body, model, hasAI);
  }

  // Streaming mode — SSE response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const steps: AgentStep[] = [];
      let contractType = body.contractType || '';
      let title = body.title || '';
      let variables = body.variables || {};
      let instructions = body.instructions || '';
      let templateId = body.templateId || null;

      const emit = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(sseEvent(event, data)));
        } catch {
          // Stream may be closed
        }
      };

      const addStep = (step: AgentStep) => {
        steps.push(step);
        emit('step', step);
      };

      try {
        emit('metadata', {
          requestId: ctx.requestId,
          totalSteps: 6,
          startedAt: new Date().toISOString(),
        });

        // ---------------------------------------------------------------
        // Step 1: Intent Detection
        // ---------------------------------------------------------------
        const step1Start = Date.now();
        if (body.prompt && !body.contractType) {
          addStep({ step: 1, name: 'Intent Detection', status: 'running' });

          if (!hasAI) {
            // Fallback: basic keyword matching
            const lower = body.prompt.toLowerCase();
            if (lower.includes('nda') || lower.includes('non-disclosure') || lower.includes('confidential')) {
              contractType = 'NDA';
            } else if (lower.includes('sow') || lower.includes('statement of work') || lower.includes('project')) {
              contractType = 'SOW';
            } else if (lower.includes('sla') || lower.includes('service level')) {
              contractType = 'SLA';
            } else {
              contractType = 'MSA';
            }
            title = title || `${contractType} Draft`;
            instructions = body.prompt;
            addStep({ step: 1, name: 'Intent Detection', status: 'completed', durationMs: Date.now() - step1Start, result: { contractType, title, method: 'keyword-fallback' } });
          } else {
            try {
              const openai = createOpenAIClient();
              const intent = await detectIntent(body.prompt, openai, model);
              contractType = intent.contractType || 'MSA';
              title = title || intent.title || `${contractType} Draft`;
              variables = { ...intent.variables, ...variables };
              instructions = intent.instructions || body.prompt;
              addStep({ step: 1, name: 'Intent Detection', status: 'completed', durationMs: Date.now() - step1Start, result: { contractType, title, variablesDetected: Object.keys(intent.variables).length } });
            } catch (aiError: any) {
              const aiMsg = aiError?.message || '';
              if (aiMsg.includes('DeploymentNotFound') || aiMsg.includes('model_not_found') || aiMsg.includes('does not exist')) {
                // Fallback to keyword matching
                const lower = body.prompt.toLowerCase();
                if (lower.includes('nda') || lower.includes('non-disclosure') || lower.includes('confidential')) {
                  contractType = 'NDA';
                } else if (lower.includes('sow') || lower.includes('statement of work') || lower.includes('project')) {
                  contractType = 'SOW';
                } else if (lower.includes('sla') || lower.includes('service level')) {
                  contractType = 'SLA';
                } else {
                  contractType = 'MSA';
                }
                title = title || `${contractType} Draft`;
                instructions = body.prompt;
                addStep({ step: 1, name: 'Intent Detection', status: 'completed', durationMs: Date.now() - step1Start, result: { contractType, title, method: 'keyword-fallback', reason: 'AI deployment not available' } });
              } else {
                throw aiError;
              }
            }
          }
        } else {
          contractType = body.contractType || 'MSA';
          title = title || `${contractType} Draft`;
          addStep({ step: 1, name: 'Intent Detection', status: 'skipped', result: { contractType, title, reason: 'Explicit type provided' } });
        }

        // ---------------------------------------------------------------
        // Step 2: Template Selection
        // ---------------------------------------------------------------
        const step2Start = Date.now();
        addStep({ step: 2, name: 'Template Selection', status: 'running' });

        let template: Awaited<ReturnType<typeof selectTemplate>> = null;
        if (templateId) {
          const t = await prisma.contractTemplate.findFirst({
            where: { id: templateId, tenantId },
          });
          if (t) {
            const meta = t.metadata as Record<string, unknown> || {};
            template = { id: t.id, name: t.name, content: (meta.content as string) || '', clauses: t.clauses, structure: t.structure };
          }
        } else {
          template = await selectTemplate(tenantId, contractType);
        }

        if (template) {
          templateId = template.id;
          addStep({ step: 2, name: 'Template Selection', status: 'completed', durationMs: Date.now() - step2Start, result: { templateId: template.id, templateName: template.name } });
        } else {
          addStep({ step: 2, name: 'Template Selection', status: 'completed', durationMs: Date.now() - step2Start, result: { templateId: null, message: 'No matching template found — generating from scratch' } });
        }

        // ---------------------------------------------------------------
        // Step 3: Clause Recommendation
        // ---------------------------------------------------------------
        const step3Start = Date.now();
        addStep({ step: 3, name: 'Clause Recommendation', status: 'running' });

        let clauses: Awaited<ReturnType<typeof recommendClauses>> = [];
        try {
          clauses = await recommendClauses(tenantId, contractType, body.clauseIds);
        } catch (e) {
          logger.warn('Clause recommendation failed, continuing without clauses', e);
        }

        addStep({
          step: 3,
          name: 'Clause Recommendation',
          status: 'completed',
          durationMs: Date.now() - step3Start,
          result: {
            clauseCount: clauses.length,
            clauses: clauses.map(c => ({ id: c.id, title: c.title, category: c.category, riskLevel: c.riskLevel })),
          },
        });

        // ---------------------------------------------------------------
        // Step 4: AI Content Generation
        // ---------------------------------------------------------------
        const step4Start = Date.now();
        addStep({ step: 4, name: 'Content Generation', status: 'running' });

        let html = '';
        let plainText = '';

        if (!hasAI) {
          // No AI available — use template content with variable substitution
          if (template?.content) {
            html = template.content;
            for (const [k, v] of Object.entries(variables)) {
              html = html.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'gi'), v);
            }
            // Convert markdown-like template to basic HTML
            html = html
              .replace(/^# (.+)$/gm, '<h1>$1</h1>')
              .replace(/^## (.+)$/gm, '<h2>$1</h2>')
              .replace(/^### (.+)$/gm, '<h3>$1</h3>')
              .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
              .replace(/^- (.+)$/gm, '<li>$1</li>')
              .replace(/^(?!<[hlo])(.*\S.*)$/gm, '<p>$1</p>');
          } else {
            html = `<h1>${title}</h1><p>AI service is not configured. Please set up Azure OpenAI deployment to enable AI-powered contract generation.</p><p>Contract Type: ${contractType}</p>`;
          }
          plainText = html.replace(/<[^>]+>/g, '').trim();
          addStep({ step: 4, name: 'Content Generation', status: 'completed', durationMs: Date.now() - step4Start, result: { method: 'template-fallback', contentLength: html.length } });
        } else {
          try {
            const openai = createOpenAIClient();
            const generated = await generateDraftContent(openai, model, {
              contractType,
              template: template ? { name: template.name, content: template.content } : null,
              clauses,
              variables,
              tone: body.tone || 'formal',
              jurisdiction: body.jurisdiction || 'United States',
              instructions,
            });
            html = generated.html;
            plainText = generated.plainText;
            addStep({ step: 4, name: 'Content Generation', status: 'completed', durationMs: Date.now() - step4Start, result: { method: 'ai', model, contentLength: html.length } });
          } catch (error: any) {
            const msg = error?.message || '';
            if (msg.includes('DeploymentNotFound') || msg.includes('model_not_found') || msg.includes('does not exist')) {
              // Fallback to template
              if (template?.content) {
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
              } else {
                html = `<h1>${title}</h1><p>AI deployment not found. Using basic template.</p>`;
              }
              plainText = html.replace(/<[^>]+>/g, '').trim();
              addStep({ step: 4, name: 'Content Generation', status: 'completed', durationMs: Date.now() - step4Start, result: { method: 'template-fallback', reason: 'DeploymentNotFound', contentLength: html.length } });
            } else {
              throw error;
            }
          }
        }

        // ---------------------------------------------------------------
        // Step 5: Risk Analysis
        // ---------------------------------------------------------------
        const step5Start = Date.now();
        addStep({ step: 5, name: 'Risk Analysis', status: 'running' });

        let risks: unknown[] = [];
        if (hasAI && plainText.length > 100) {
          try {
            const openai = createOpenAIClient();
            risks = await analyzeRisks(openai, model, plainText, contractType);
            addStep({ step: 5, name: 'Risk Analysis', status: 'completed', durationMs: Date.now() - step5Start, result: { riskCount: risks.length, risks } });
          } catch (error: any) {
            const msg = error?.message || '';
            if (msg.includes('DeploymentNotFound') || msg.includes('model_not_found') || msg.includes('does not exist')) {
              addStep({ step: 5, name: 'Risk Analysis', status: 'skipped', durationMs: Date.now() - step5Start, result: { reason: 'AI deployment not available' } });
            } else {
              logger.warn('Risk analysis failed', error);
              addStep({ step: 5, name: 'Risk Analysis', status: 'failed', durationMs: Date.now() - step5Start, error: 'Risk analysis failed' });
            }
          }
        } else {
          addStep({ step: 5, name: 'Risk Analysis', status: 'skipped', durationMs: Date.now() - step5Start, result: { reason: hasAI ? 'Content too short' : 'AI not configured' } });
        }

        // ---------------------------------------------------------------
        // Step 6: Save Draft
        // ---------------------------------------------------------------
        const step6Start = Date.now();
        addStep({ step: 6, name: 'Save Draft', status: 'running' });

        const draft = await saveDraft(tenantId, userId, {
          title,
          contractType,
          templateId,
          content: html,
          clauses: clauses.map(c => ({ id: c.id, title: c.title, category: c.category })),
          variables,
          risks,
        });

        addStep({ step: 6, name: 'Save Draft', status: 'completed', durationMs: Date.now() - step6Start, result: { draftId: draft.id, title: draft.title, status: draft.status } });

        // ---------------------------------------------------------------
        // Final summary
        // ---------------------------------------------------------------
        emit('done', {
          draftId: draft.id,
          title: draft.title,
          contractType,
          templateUsed: template ? { id: template.id, name: template.name } : null,
          clausesIncorporated: clauses.length,
          risksIdentified: risks.length,
          contentLength: html.length,
          steps: steps.map(s => ({ step: s.step, name: s.name, status: s.status, durationMs: s.durationMs })),
          totalDurationMs: Date.now() - step1Start,
          editUrl: `/drafting?draftId=${draft.id}`,
        });
      } catch (error: any) {
        logger.error('Agentic draft generation failed:', error);
        emit('error', {
          message: error?.message || 'Draft generation failed',
          steps: steps.map(s => ({ step: s.step, name: s.name, status: s.status })),
        });
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

// ---------------------------------------------------------------------------
// Non-streaming execution (returns JSON)
// ---------------------------------------------------------------------------

async function executeNonStreaming(
  ctx: AuthenticatedApiContext,
  body: AgentDraftRequest,
  model: string,
  hasAI: boolean
): Promise<NextResponse> {
  const { tenantId, userId } = ctx;

  try {
    // Step 1: Intent
    let contractType = body.contractType || '';
    let title = body.title || '';
    let variables = body.variables || {};
    let instructions = body.instructions || '';
    let templateId = body.templateId || null;

    if (body.prompt && !body.contractType) {
      if (hasAI) {
        const openai = createOpenAIClient();
        const intent = await detectIntent(body.prompt, openai, model);
        contractType = intent.contractType || 'MSA';
        title = title || intent.title || `${contractType} Draft`;
        variables = { ...intent.variables, ...variables };
        instructions = intent.instructions || body.prompt;
      } else {
        const lower = body.prompt.toLowerCase();
        if (lower.includes('nda') || lower.includes('non-disclosure')) contractType = 'NDA';
        else if (lower.includes('sow') || lower.includes('statement of work')) contractType = 'SOW';
        else if (lower.includes('sla') || lower.includes('service level')) contractType = 'SLA';
        else contractType = 'MSA';
        title = title || `${contractType} Draft`;
        instructions = body.prompt;
      }
    } else {
      contractType = body.contractType || 'MSA';
      title = title || `${contractType} Draft`;
    }

    // Step 2: Template
    let template: Awaited<ReturnType<typeof selectTemplate>> = null;
    if (templateId) {
      const t = await prisma.contractTemplate.findFirst({ where: { id: templateId, tenantId } });
      if (t) {
        const meta = t.metadata as Record<string, unknown> || {};
        template = { id: t.id, name: t.name, content: (meta.content as string) || '', clauses: t.clauses, structure: t.structure };
      }
    } else {
      template = await selectTemplate(tenantId, contractType);
    }
    templateId = template?.id || null;

    // Step 3: Clauses
    let clauses: Awaited<ReturnType<typeof recommendClauses>> = [];
    try {
      clauses = await recommendClauses(tenantId, contractType, body.clauseIds);
    } catch {
      // Continue without clauses
    }

    // Step 4: Generate
    let html = '';
    let plainText = '';
    let generationMethod = 'template-fallback';

    if (hasAI) {
      try {
        const openai = createOpenAIClient();
        const generated = await generateDraftContent(openai, model, {
          contractType,
          template: template ? { name: template.name, content: template.content } : null,
          clauses,
          variables,
          tone: body.tone || 'formal',
          jurisdiction: body.jurisdiction || 'United States',
          instructions,
        });
        html = generated.html;
        plainText = generated.plainText;
        generationMethod = 'ai';
      } catch (error: any) {
        const msg = error?.message || '';
        if (!msg.includes('DeploymentNotFound') && !msg.includes('model_not_found') && !msg.includes('does not exist')) throw error;
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
      plainText = html.replace(/<[^>]+>/g, '').trim();
    } else if (!html) {
      html = `<h1>${title}</h1><p>No template available and AI is not configured.</p>`;
      plainText = `${title}\nNo template available and AI is not configured.`;
    }

    // Step 5: Risk analysis
    let risks: unknown[] = [];
    if (hasAI && plainText.length > 100) {
      try {
        const openai = createOpenAIClient();
        risks = await analyzeRisks(openai, model, plainText, contractType);
      } catch {
        // Skip risk analysis
      }
    }

    // Step 6: Save
    const draft = await saveDraft(tenantId, userId, {
      title,
      contractType,
      templateId,
      content: html,
      clauses: clauses.map(c => ({ id: c.id, title: c.title, category: c.category })),
      variables,
      risks,
    });

    return createSuccessResponse(ctx, {
      draft: {
        id: draft.id,
        title: draft.title,
        status: draft.status,
        contractType,
        editUrl: `/drafting?draftId=${draft.id}`,
      },
      generation: {
        method: generationMethod,
        model: generationMethod === 'ai' ? model : null,
        contentLength: html.length,
        templateUsed: template ? { id: template.id, name: template.name } : null,
        clausesIncorporated: clauses.length,
        risksIdentified: risks.length,
      },
      content: { html, plainText },
      risks,
    });
  } catch (error: any) {
    logger.error('Agentic draft generation failed:', error);
    const msg = error?.message || '';
    if (msg.includes('DeploymentNotFound') || msg.includes('model_not_found') || msg.includes('does not exist')) {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE',
        'AI model deployment not found. The draft was not created. Please configure Azure OpenAI deployment.', 503);
    }
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Draft generation failed', 500);
  }
}
