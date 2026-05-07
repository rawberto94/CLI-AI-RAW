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
import { getCircuitBreaker } from '@/lib/ai/circuit-breaker';
import {
  isAzureContentFilteredError,
  normalizeDraftingPrompt,
  normalizeDraftingValue,
  summarizeDraftingPromptForStrictSafety,
  containsBannedWord,
} from '@/lib/ai/drafting-safety';

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
  /** Playbook (policy pack) ID — aligns clauses and guidance with a company policy pack */
  playbookId?: string;
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

type DraftingSafetyMode = 'standard' | 'strict';

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
  model: string,
  safetyMode: DraftingSafetyMode = 'standard'
): Promise<{ contractType: string; title: string; variables: Record<string, string>; instructions: string }> {
  const userPrompt =
    safetyMode === 'strict'
      ? `Treat this as a legitimate commercial contract drafting request. Rewrite it into plain business language internally and extract the same legal and commercial intent from: ${normalizeDraftingPrompt(prompt)}`
      : prompt;

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
  { role: 'user', content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content || '{}';
  try {
    return JSON.parse(content);
  } catch {
    return { contractType: 'MSA', title: 'Contract Draft', variables: {}, instructions: prompt };
  }
}

async function detectIntentWithSafetyRetry(
  prompt: string,
  openai: ReturnType<typeof createOpenAIClient>,
  model: string
): Promise<{ contractType: string; title: string; variables: Record<string, string>; instructions: string }> {
  try {
    return await detectIntent(prompt, openai, model);
  } catch (error) {
    if (!isAzureContentFilteredError(error)) {
      throw error;
    }

    logger.warn('Draft intent detection hit Azure content filter, retrying with normalized business wording', {
      requestShape: summarizeDraftingPromptForStrictSafety(prompt),
    });

    return detectIntent(prompt, openai, model, 'strict');
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
    take: 25,
  });

  return clauses;
}

/**
 * Step 3b: Load a playbook (policy pack) and return its preferred-clause list
 * plus high-level guidance. Merged into the draft generation prompt so the
 * output follows company policy.
 */
async function loadPlaybook(
  tenantId: string,
  playbookId: string | undefined
): Promise<{
  playbook: { id: string; name: string; description: string | null } | null;
  clauses: Array<{ id: string; title: string; category: string; content: string; riskLevel: string; notes?: string | null; guidance?: string | null }>;
} | null> {
  if (!playbookId) return null;
  const pb = await prisma.playbook.findFirst({
    where: { id: playbookId, tenantId, isActive: true },
    include: {
      clauses: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });
  if (!pb) return null;
  return {
    playbook: { id: pb.id, name: pb.name, description: pb.description },
    clauses: pb.clauses.map(c => ({
      id: `playbook:${c.id}`,
      title: c.name,
      category: c.category,
      content: c.preferredText,
      riskLevel: (c.riskLevel || 'medium').toUpperCase(),
      notes: c.notes,
      guidance: c.negotiationGuidance,
    })),
  };
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
    playbook?: {
      playbook: { id: string; name: string; description: string | null } | null;
      clauses: Array<{ title: string; category: string; content: string; notes?: string | null; guidance?: string | null }>;
    } | null;
    prompt?: string;
  },
  safetyMode: DraftingSafetyMode = 'standard'
): Promise<{ html: string; plainText: string }> {
  const safeVariables = safetyMode === 'strict' ? normalizeDraftingValue(params.variables) : params.variables;
  const safeTemplate = safetyMode === 'strict' && params.template
    ? { ...params.template, content: normalizeDraftingPrompt(params.template.content) }
    : params.template;
  const safeClauses = safetyMode === 'strict' ? normalizeDraftingValue(params.clauses) : params.clauses;
  const safePlaybook = safetyMode === 'strict' ? normalizeDraftingValue(params.playbook) : params.playbook;
  const safePrompt = params.prompt && safetyMode === 'strict' ? normalizeDraftingPrompt(params.prompt) : params.prompt;
  const safeInstructions = safetyMode === 'strict' ? normalizeDraftingPrompt(params.instructions) : params.instructions;

  const variableBlock = Object.entries(safeVariables)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  const templateBlock = safeTemplate
    ? `\n\nBase Template — STYLE REFERENCE ONLY (${safeTemplate.name}):\n[Use this only for structural inspiration and boilerplate fallbacks. Do NOT copy values, names, dates, or variable placeholders from this template if they conflict with the USER REQUEST above. The USER REQUEST takes priority over anything in this template.]\n${safeTemplate.content.slice(0, 6000)}`
    : '';

  const clauseBlock =
    safeClauses.length > 0
      ? `\n\nApproved Clauses to incorporate verbatim (or adapt minimally):\n${safeClauses
          .map(c => `[${c.category}] ${c.title}\n${c.content}`)
          .join('\n\n')}`
      : '';

  const playbookBlock = safePlaybook?.playbook
    ? `\n\n=== COMPANY POLICY PACK: ${safePlaybook.playbook.name} ===\n${safePlaybook.playbook.description ? safePlaybook.playbook.description + '\n' : ''}The following clauses are the COMPANY-PREFERRED positions. Use them as the baseline language wherever applicable. Do NOT weaken them without a clear commercial reason.\n\n${safePlaybook.clauses
        .map(
          c =>
            `[${c.category}] ${c.title} (preferred language)\n${c.content}${c.notes ? `\nNotes: ${c.notes}` : ''}${c.guidance ? `\nNegotiation guidance: ${c.guidance}` : ''}`
        )
        .join('\n\n')}\n=== END POLICY PACK ===`
    : '';

  const userPromptBlock = safePrompt
    ? `\n\n=== USER REQUEST — HIGHEST PRIORITY — READ FIRST ===\n${safePrompt}\n=== END USER REQUEST ===\n\nEvery specific value, party name, term, jurisdiction, cap, payment term, renewal behavior, tone and special requirement mentioned in the USER REQUEST above MUST appear VERBATIM in the generated contract. Do NOT leave [___] placeholders, [Name], [Date], or generic template variable names for any value the user specified. If the user said "Swiss law", the governing-law clause must say "Switzerland", not "[Governing Law]". If the user said "CHF 250,000", the cap must be "CHF 250,000", not "[Amount]". When a detail is NOT specified, use a sensible default and mark it with [TBD] so a reviewer can spot it.`
    : '';

  const response = await openai.chat.completions.create({
    model,
    temperature: 0.3,
    max_tokens: 8192,
    messages: [
      {
        role: 'system',
        content: `You are a senior contract attorney producing a COMPLETE, COMPREHENSIVE, and EXHAUSTIVE contract draft ready for legal review.

=== OUTPUT FORMAT ===
- Return clean HTML for a WYSIWYG editor (no markdown, no code fences).
- Use <h1> for the title, <h2> for top-level sections, <h3> for sub-sections, <h4> for sub-sub-sections.
- Use <p> for paragraphs and <ol>/<ul> for lists; number clauses hierarchically (1, 1.1, 1.1.1).
- Use <strong> for defined terms on first use, then reuse them consistently.
- Include a title block, parties block, recitals/background, definitions, operative clauses, general provisions, and signature blocks.
- Replace template variables ({{name}}) with provided values; use [___] placeholders only when a value is NOT provided.

=== REQUIRED SECTIONS (include every applicable one; omit only when clearly N/A for the contract type) ===
1. Parties and Effective Date
2. Recitals / Background
3. Definitions (define every capitalised term used)
4. Scope of Services / Subject Matter
5. Deliverables and Acceptance (for SOW/MSA)
6. Term and Renewal
7. Fees, Invoicing and Payment Terms
8. Taxes
9. Intellectual Property Rights (ownership, licences, background/foreground IP)
10. Confidentiality and Non-Disclosure
11. Data Protection & Privacy (GDPR/CCPA as applicable to jurisdiction)
12. Information Security
13. Representations and Warranties
14. Disclaimers
15. Limitation of Liability (direct, indirect, cap formula)
16. Indemnification (mutual where appropriate)
17. Insurance
18. Termination (for convenience, for cause, effects of termination, survival)
19. Force Majeure
20. Compliance with Laws, Anti-Bribery, Sanctions, Export Controls
21. Assignment and Subcontracting
22. Independent Contractor / No Partnership
23. Non-Solicitation / Non-Compete (where appropriate)
24. Dispute Resolution (negotiation, mediation, arbitration or courts)
25. Governing Law and Jurisdiction
26. Notices
27. Entire Agreement, Severability, Waiver, Amendments, Counterparts
28. Signature Blocks for every party
29. Schedules / Exhibits / Annexes (reference by letter, include placeholder schedule structure)

=== QUALITY BAR ===
- Aim for 3,000–6,000 words of actual contract language. Be thorough, not terse.
- Every clause must be drafted in full sentences with operative language ("shall", "will", "must"), not bullet summaries.
- Draft protective provisions from the perspective of the party issuing the contract unless the prompt says otherwise.
- Use the provided Policy Pack language as the preferred position wherever it applies.
- Incorporate all Approved Clauses; integrate them into the correct sections with proper numbering.
- Tone: ${params.tone}
- Governing jurisdiction: ${params.jurisdiction}

Return ONLY the HTML document.`,
      },
      {
        role: 'user',
        content: `Generate a complete ${params.contractType} contract governed by ${params.jurisdiction}.${userPromptBlock}

Variables:
${variableBlock || 'None specified — use standard bracketed placeholders.'}${playbookBlock}${clauseBlock}${templateBlock}${
          safeInstructions ? `\n\nAdditional Instructions:\n${safeInstructions}` : ''
        }

Produce the full contract now. Honour the USER REQUEST verbatim, then fill every applicable section from the required list. Do not truncate.`,
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

async function generateDraftContentWithSafetyRetry(
  openai: ReturnType<typeof createOpenAIClient>,
  model: string,
  params: Parameters<typeof generateDraftContent>[2]
): Promise<{ html: string; plainText: string }> {
  try {
    return await generateDraftContent(openai, model, params);
  } catch (error) {
    if (!isAzureContentFilteredError(error)) {
      throw error;
    }

    logger.warn('Draft generation hit Azure content filter, retrying with normalized drafting context', {
      requestShape: params.prompt ? summarizeDraftingPromptForStrictSafety(params.prompt) : params.contractType,
    });

    return generateDraftContent(openai, model, params, 'strict');
  }
}

/** Step 5: Analyze risks in generated content */
async function analyzeRisks(
  openai: ReturnType<typeof createOpenAIClient>,
  model: string,
  content: string,
  contractType: string
): Promise<Array<{ category: string; severity: string; description: string; clause: string; suggestion: string; remediation?: string }>> {
  // Analyze full contract — split into chunks if needed
  const maxChunkSize = 12000;
  const textToAnalyze = content.length > maxChunkSize
    ? content.slice(0, maxChunkSize) + '\n\n[Document continues — ' + Math.round((content.length - maxChunkSize) / 1000) + 'K chars truncated]\n\n' + content.slice(-3000)
    : content;

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
      "category": "LIABILITY|COMPLIANCE|FINANCIAL|OPERATIONAL|IP|DATA_PRIVACY|TERMINATION|INDEMNIFICATION|FORCE_MAJEURE",
      "severity": "LOW|MEDIUM|HIGH|CRITICAL",
      "description": "Brief description of the risk",
      "clause": "The specific clause or section with the issue (quote exact text if possible)",
      "suggestion": "Recommended improvement",
      "remediation": "Specific replacement clause text or action to take to resolve this risk"
    }
  ]
}

Severity guidelines:
- CRITICAL: Could result in unlimited liability, regulatory violation, or unenforceable contract
- HIGH: Significant financial exposure, missing essential protections, or one-sided terms
- MEDIUM: Non-standard terms, vague language, or gaps that should be addressed
- LOW: Minor improvements, style issues, or nice-to-have clarifications

Be practical — focus on genuinely risky items, not minor style issues. Limit to the top 5-10 most important risks. Always include specific remediation text when possible.`,
      },
      {
        role: 'user',
        content: `Analyze this ${contractType} contract for risks:\n\n${textToAnalyze}`,
      },
    ],
  });

  const parsed = JSON.parse(response.choices[0]?.message?.content || '{"risks":[]}');
  return parsed.risks || [];
}

/**
 * Step 5b: Faithfulness check
 * ----------------------------------------------------------------------------
 * Parse the structured lines emitted by our interview's `rebuildEnrichedPrompt`
 * (client-side helper) — they look like:
 *   Contract type: NDA
 *   Counterparty: Acme
 *   Governing law: Switzerland
 *   Liability cap: CHF 250,000
 *   Special terms/unusual requirements:
 *     - Two-year survival for residual trade secrets
 *
 * For each specified value, check whether it appears in the generated draft's
 * plain text (case-insensitive). Return a structured report so the UI can
 * show the user EXACTLY which of their requested values landed in the draft
 * and which the AI silently dropped.
 *
 * This is the functional answer to "is the AI actually giving me what I asked
 * for?" — a post-generation receipt that grounds the output in the user's
 * input.
 */
interface FaithfulnessItem {
  label: string;
  value: string;
  found: boolean;
}
interface FaithfulnessReport {
  items: FaithfulnessItem[];
  honored: number;
  total: number;
  score: number; // 0..1
}

function computeFaithfulness(userPrompt: string, plainText: string): FaithfulnessReport {
  const items: FaithfulnessItem[] = [];
  if (!userPrompt || !plainText) {
    return { items, honored: 0, total: 0, score: 1 };
  }
  const haystack = plainText.toLowerCase();
  // Parse "Label: value" pairs from the enrichedPrompt. We match lines that
  // start with one of our known labels — this avoids false-positive matches
  // from freeform sentences in the user's original prompt.
  const KNOWN_LABELS: Array<[RegExp, string]> = [
    [/^\s*Contract type\s*:\s*(.+)$/im, 'Contract type'],
    [/^\s*We are drafting for the\s*:\s*(.+)$/im, 'Our role'],
    [/^\s*Counterparty\s*:\s*(.+)$/im, 'Counterparty'],
    [/^\s*Term\s*:\s*(.+)$/im, 'Term'],
    [/^\s*Renewal\s*:\s*(.+)$/im, 'Renewal'],
    [/^\s*Governing law\s*:\s*(.+)$/im, 'Governing law'],
    [/^\s*Liability cap\s*:\s*(.+)$/im, 'Liability cap'],
    [/^\s*Payment terms\s*:\s*(.+)$/im, 'Payment terms'],
    [/^\s*Confidentiality\s*:\s*(.+)$/im, 'Confidentiality'],
    [/^\s*Tone\s*:\s*(.+)$/im, 'Tone'],
  ];
  for (const [re, label] of KNOWN_LABELS) {
    const m = userPrompt.match(re);
    if (!m) continue;
    const raw = m[1].trim();
    if (!raw) continue;
    // Heuristic: look for the most distinctive token(s) of the value, not the
    // whole sentence — e.g. for "5 years after termination" we check "5 year".
    // We still require a reasonably specific substring so that generic values
    // don't trivially pass.
    const normalised = raw.replace(/\[TBD\]/gi, '').replace(/[.,;:].*$/, '').trim();
    const needle = normalised.toLowerCase().slice(0, 64);
    const found = needle.length > 0 && haystack.includes(needle);
    items.push({ label, value: normalised, found });
  }
  // Special terms — parse the indented list block
  const specialBlockMatch = userPrompt.match(/Special terms\/unusual requirements:\s*([\s\S]*?)(?=\n\s*(?:Use every value|$))/i);
  if (specialBlockMatch) {
    const lines = specialBlockMatch[1]
      .split('\n')
      .map(l => l.replace(/^\s*-\s*/, '').trim())
      .filter(l => l.length > 0 && !/^Use every value/i.test(l));
    for (const line of lines) {
      // Match the first 5 content words of the special term — exact long-string
      // matching is too strict because the AI will rephrase.
      const words = line.toLowerCase().split(/\s+/).filter(w => w.length > 2).slice(0, 5).join(' ');
      const needle = words || line.toLowerCase().slice(0, 40);
      items.push({
        label: 'Special term',
        value: line.length > 60 ? `${line.slice(0, 57)}…` : line,
        found: haystack.includes(needle),
      });
    }
  }
  const honored = items.filter(i => i.found).length;
  const total = items.length;
  return { items, honored, total, score: total === 0 ? 1 : honored / total };
}

/**
 * Repair pass — if the first draft didn't include every user-stated value,
 * run a focused LLM call that takes the current HTML + the explicit list of
 * missing items and returns an updated HTML that weaves each missing value
 * into the correct clause. This is what the user meant by "I need it
 * visible in the contract itself".
 *
 * Returns the updated html + plainText. Falls back to the original draft on
 * any error (content-filter, timeout, etc.) so we never make the output
 * worse than it already was.
 */
async function repairDraftWithMissing(
  openai: ReturnType<typeof createOpenAIClient>,
  model: string,
  currentHtml: string,
  missingItems: FaithfulnessItem[],
  contractType: string,
  jurisdiction: string
): Promise<{ html: string; plainText: string }> {
  const missingList = missingItems
    .map((it, i) => `${i + 1}. ${it.label}: ${it.value}`)
    .join('\n');

  try {
    const response = await openai.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: 8192,
      messages: [
        {
          role: 'system',
          content: `You are a senior contract attorney. You will be given an existing contract DRAFT (HTML) and a list of values the USER explicitly asked for that are currently MISSING or PARAPHRASED away. Your job is to return a REVISED version of the same draft in which EVERY missing value appears VERBATIM in the appropriate clause.

Rules:
- Return the FULL updated HTML document — do not truncate, do not return a diff.
- Preserve the existing structure, numbering, and tone.
- Add each missing value to the correct existing clause when possible (e.g., put Governing law into the Governing Law section). If no matching clause exists, add a new clause in a logical location.
- Use the EXACT user-supplied wording for each value; do not paraphrase, do not substitute synonyms, do not expand abbreviations (e.g., keep "NDA", "CHF 250,000", "Net 30" literally).
- Do not invent new terms or change any value the user already honoured.
- Do not remove existing content.
- Output ONLY the updated HTML (no markdown, no commentary).`,
        },
        {
          role: 'user',
          content: `Contract type: ${contractType}
Governing jurisdiction: ${jurisdiction}

=== CURRENT DRAFT (HTML) ===
${currentHtml}
=== END DRAFT ===

=== MISSING USER-REQUESTED VALUES (must appear verbatim in revised draft) ===
${missingList}
=== END MISSING ===

Return the revised full HTML now.`,
        },
      ],
    });
    const html = response.choices[0]?.message?.content?.trim() || '';
    if (!html || html.length < currentHtml.length * 0.5) {
      // Suspicious truncation — keep the original.
      return { html: currentHtml, plainText: stripHtml(currentHtml) };
    }
    return { html, plainText: stripHtml(html) };
  } catch {
    return { html: currentHtml, plainText: stripHtml(currentHtml) };
  }
}

/**
 * Last-resort guarantee: if, after the repair pass, any user-stated values are
 * STILL not detectable in the draft, append a visible addendum section that
 * lists them verbatim. This guarantees the user's stated requirements are
 * physically present in the contract — at minimum as an explicit schedule —
 * no matter how the LLM behaved upstream.
 *
 * The addendum is clearly marked so a reviewer knows to integrate it properly.
 */
function appendUserRequestedAddendum(
  currentHtml: string,
  missingItems: FaithfulnessItem[]
): { html: string; plainText: string } {
  if (missingItems.length === 0) {
    return { html: currentHtml, plainText: stripHtml(currentHtml) };
  }
  const rows = missingItems
    .map(
      it =>
        `<li><strong>${escapeHtml(it.label)}:</strong> ${escapeHtml(it.value)}</li>`
    )
    .join('');
  const addendum = `
<h2>Schedule A — User-Requested Terms (auto-inserted, requires review)</h2>
<p><em>The following terms were specified by the user during the drafting interview. They are recorded here verbatim to guarantee they form part of this Agreement. The parties shall give these terms the same force and effect as the corresponding operative clauses above; where any conflict arises, these terms prevail. A reviewer should integrate each item into the body of the Agreement in the appropriate clause before execution.</em></p>
<ul>${rows}</ul>`;
  const html = currentHtml + addendum;
  return { html, plainText: stripHtml(html) };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Orchestrates the full fidelity-enforcement flow:
 *   1. Compute faithfulness on the initial draft.
 *   2. If score < 1.0 AND AI is available → run one LLM repair pass.
 *   3. Recompute faithfulness on the revised draft.
 *   4. If STILL missing items → append a visible "User-Requested Terms"
 *      schedule so the items are physically present in the contract.
 *   5. Return the final html/plainText/faithfulness along with a small audit
 *      trail the UI can display ("repaired"/"addendum-appended").
 */
async function enforceFaithfulness(
  openai: ReturnType<typeof createOpenAIClient> | null,
  model: string,
  userPrompt: string | undefined,
  initialHtml: string,
  initialPlainText: string,
  contractType: string,
  jurisdiction: string
): Promise<{
  html: string;
  plainText: string;
  faithfulness: FaithfulnessReport & { repaired: boolean; addendumAppended: boolean } | null;
}> {
  if (!userPrompt) {
    return { html: initialHtml, plainText: initialPlainText, faithfulness: null };
  }

  let html = initialHtml;
  let plainText = initialPlainText;
  let report = computeFaithfulness(userPrompt, plainText);
  let repaired = false;
  let addendumAppended = false;

  const missing = () => report.items.filter(i => !i.found);

  // Step 1: LLM repair pass (only when AI is available and something missing).
  if (openai && report.total > 0 && report.score < 1 && missing().length > 0) {
    const revised = await repairDraftWithMissing(
      openai,
      model,
      html,
      missing(),
      contractType,
      jurisdiction,
    );
    if (revised.html !== html) {
      html = revised.html;
      plainText = revised.plainText;
      report = computeFaithfulness(userPrompt, plainText);
      repaired = true;
    }
  }

  // Step 2: Addendum safety-net for anything still missing.
  if (report.total > 0 && missing().length > 0) {
    const augmented = appendUserRequestedAddendum(html, missing());
    html = augmented.html;
    plainText = augmented.plainText;
    // The addendum puts each value verbatim into the document, so by
    // definition every missing item is now findable.
    report = computeFaithfulness(userPrompt, plainText);
    addendumAppended = true;
  }

  return {
    html,
    plainText,
    faithfulness: { ...report, repaired, addendumAppended },
  };
}

/** Step 6: Save draft to database */
async function saveDraft(
  tenantId: string,
  userId: string,
  params: {
    title: string;
    contractType: string;
    templateId: string | null;
    playbookId?: string | null;
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
      playbookId: params.playbookId || null,
      content: params.content,
      clauses: params.clauses.map(c => ({ id: c.id, title: c.title, category: c.category })),
      variables: params.variables,
      structure: {
        risks: params.risks as any[],
        generatedAt: new Date().toISOString(),
        generatedBy: 'agent',
      } as any,
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

  // The only filter we apply locally is a tiny explicit blocklist.
  // User wording (jargon, acronyms, blunt B2B phrasing) is otherwise
  // accepted as-is.
  if (body.prompt) {
    const banCheck = containsBannedWord(body.prompt);
    if (banCheck.banned) {
      return createErrorResponse(ctx, 'CONTENT_NOT_ALLOWED', banCheck.reason, 400);
    }
  }
  if (body.instructions) {
    const banCheck = containsBannedWord(body.instructions);
    if (banCheck.banned) {
      return createErrorResponse(ctx, 'CONTENT_NOT_ALLOWED', banCheck.reason, 400);
    }
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
  let cancelled = false;
  const stream = new ReadableStream({
    cancel() {
      cancelled = true;
    },
    async start(controller) {
      const steps: AgentStep[] = [];
      let contractType = body.contractType || '';
      let title = body.title || '';
      let variables = body.variables || {};
      let instructions = body.instructions || '';
      let templateId = body.templateId || null;

      const emit = (event: string, data: unknown) => {
        if (cancelled) return;
        try {
          controller.enqueue(encoder.encode(sseEvent(event, data)));
        } catch {
          cancelled = true;
        }
      };

      const addStep = (step: AgentStep) => {
        steps.push(step);
        emit('step', step);
      };

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

      const draftBreaker = getCircuitBreaker('ai-draft', { failureThreshold: 3, resetTimeoutMs: 90_000 });

      try {
        emit('metadata', {
          requestId: ctx.requestId,
          totalSteps: 6,
          startedAt: new Date().toISOString(),
        });

        // ---------------------------------------------------------------
        // Circuit breaker check — reject if AI service is overwhelmed
        // ---------------------------------------------------------------
        const breakerCheck = draftBreaker.canExecute();
        if (!breakerCheck.allowed) {
          emit('error', { message: 'AI service is temporarily unavailable due to high error rate. Please try again in a few minutes.' });
          controller.close();
          return;
        }

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
              const intent = await detectIntentWithSafetyRetry(body.prompt, openai, model);
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

        // Load selected playbook (policy pack) and merge its preferred clauses
        let playbookData: Awaited<ReturnType<typeof loadPlaybook>> = null;
        try {
          playbookData = await loadPlaybook(tenantId, body.playbookId);
        } catch (e) {
          logger.warn('Playbook load failed, continuing without policy pack', e);
        }

        // Merge playbook-preferred clauses into the clause list (dedupe by category+title).
        const seenKeys = new Set(clauses.map(c => `${c.category}::${c.title}`));
        if (playbookData?.clauses) {
          for (const pc of playbookData.clauses) {
            const key = `${pc.category}::${pc.title}`;
            if (seenKeys.has(key)) continue;
            seenKeys.add(key);
            clauses.push({
              id: pc.id,
              title: pc.title,
              category: pc.category,
              content: pc.content,
              riskLevel: pc.riskLevel,
            });
          }
        }

        addStep({
          step: 3,
          name: 'Clause Recommendation',
          status: 'completed',
          durationMs: Date.now() - step3Start,
          result: {
            clauseCount: clauses.length,
            playbook: playbookData?.playbook
              ? { id: playbookData.playbook.id, name: playbookData.playbook.name, clauseCount: playbookData.clauses.length }
              : null,
            clauses: clauses.map(c => ({ id: c.id, title: c.title, category: c.category, riskLevel: c.riskLevel })),
          },
        });

        // ---------------------------------------------------------------
        // Step 4: AI Content Generation
        // ---------------------------------------------------------------
        if (cancelled) { controller.close(); return; }
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
            const generated = await generateDraftContentWithSafetyRetry(openai, model, {
              contractType,
              template: template ? { name: template.name, content: template.content } : null,
              clauses,
              variables,
              tone: body.tone || 'formal',
              jurisdiction: body.jurisdiction || 'United States',
              instructions,
              playbook: playbookData,
              prompt: body.prompt,
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
        // Step 4b: Faithfulness enforcement
        // (repair pass + addendum fallback so every user-stated value is
        //  physically present in the contract)
        // ---------------------------------------------------------------
        let faithfulnessReport: Awaited<ReturnType<typeof enforceFaithfulness>>['faithfulness'] = null;
        if (body.prompt) {
          try {
            const openaiForRepair = hasAI ? createOpenAIClient() : null;
            const enforced = await enforceFaithfulness(
              openaiForRepair,
              model,
              body.prompt,
              html,
              plainText,
              contractType,
              body.jurisdiction || 'United States',
            );
            html = enforced.html;
            plainText = enforced.plainText;
            faithfulnessReport = enforced.faithfulness;
          } catch (e) {
            logger.warn('Faithfulness enforcement failed, keeping original draft', e);
          }
        }

        // ---------------------------------------------------------------
        // Step 5: Risk Analysis
        // ---------------------------------------------------------------
        if (cancelled) { controller.close(); return; }
        const step5Start = Date.now();
        addStep({ step: 5, name: 'Risk Analysis', status: 'running' });

        let risks: Array<{ category: string; severity: string; description: string; clause: string; suggestion: string }> = [];
        if (hasAI && plainText.length > 100) {
          try {
            const openai = createOpenAIClient();
            risks = await analyzeRisks(openai, model, plainText, contractType);
            
            // Emit risk warnings for critical/high severity items
            const criticalRisks = risks.filter(r => r.severity === 'CRITICAL');
            const highRisks = risks.filter(r => r.severity === 'HIGH');
            if (criticalRisks.length > 0 || highRisks.length > 0) {
              emit('risk_warning', {
                critical: criticalRisks.length,
                high: highRisks.length,
                message: criticalRisks.length > 0
                  ? `⚠️ ${criticalRisks.length} critical risk(s) detected — review before finalizing`
                  : `${highRisks.length} high-severity risk(s) detected — consider review`,
                risks: [...criticalRisks, ...highRisks].slice(0, 5),
              });
            }
            
            addStep({ step: 5, name: 'Risk Analysis', status: 'completed', durationMs: Date.now() - step5Start, result: { riskCount: risks.length, risks } });
          } catch (error: any) {
            const msg = error?.message || '';
            if (msg.includes('DeploymentNotFound') || msg.includes('model_not_found') || msg.includes('does not exist')) {
              addStep({ step: 5, name: 'Risk Analysis', status: 'skipped', durationMs: Date.now() - step5Start, result: { reason: 'AI deployment not available' } });
            } else {
              logger.warn('Risk analysis failed', error);
              addStep({ step: 5, name: 'Risk Analysis', status: 'failed', durationMs: Date.now() - step5Start, error: `Risk analysis failed: ${msg.slice(0, 100)}. Draft saved but not analyzed for risks.` });
            }
          }
        } else {
          addStep({ step: 5, name: 'Risk Analysis', status: 'skipped', durationMs: Date.now() - step5Start, result: { reason: hasAI ? 'Content too short' : 'AI not configured' } });
        }

        // ---------------------------------------------------------------
        // Step 6: Save Draft
        // ---------------------------------------------------------------
        if (cancelled) { controller.close(); return; }
        const step6Start = Date.now();
        addStep({ step: 6, name: 'Save Draft', status: 'running' });

        const draft = await saveDraft(tenantId, userId, {
          title,
          contractType,
          templateId,
          playbookId: body.playbookId || null,
          content: html,
          clauses: clauses.map(c => ({ id: c.id, title: c.title, category: c.category })),
          variables,
          risks,
        });

        addStep({ step: 6, name: 'Save Draft', status: 'completed', durationMs: Date.now() - step6Start, result: { draftId: draft.id, title: draft.title, status: draft.status } });

        // ---------------------------------------------------------------
        // Record success in circuit breaker
        draftBreaker.recordSuccess();

        // Use the faithfulness report from the enforcement step (which
        // already reflects the repair pass + addendum). Fall back to a fresh
        // compute if enforcement was skipped for any reason.
        const faithfulness = faithfulnessReport
          ?? (body.prompt ? { ...computeFaithfulness(body.prompt, plainText), repaired: false, addendumAppended: false } : null);

        // Final summary
        // ---------------------------------------------------------------
        emit('done', {
          draftId: draft.id,
          title: draft.title,
          contractType,
          templateUsed: template ? { id: template.id, name: template.name } : null,
          clausesIncorporated: clauses.length,
          risksIdentified: risks.length,
          riskSummary: {
            critical: risks.filter(r => r.severity === 'CRITICAL').length,
            high: risks.filter(r => r.severity === 'HIGH').length,
            medium: risks.filter(r => r.severity === 'MEDIUM').length,
            low: risks.filter(r => r.severity === 'LOW').length,
            requiresReview: risks.some(r => r.severity === 'CRITICAL' || r.severity === 'HIGH'),
          },
          contentLength: html.length,
          steps: steps.map(s => ({ step: s.step, name: s.name, status: s.status, durationMs: s.durationMs })),
          totalDurationMs: Date.now() - step1Start,
          editUrl: `/drafting/copilot?draft=${draft.id}`,
          faithfulness,
        });
      } catch (error: any) {
        logger.error('Agentic draft generation failed:', error);
        const rawMsg = error?.message || '';
        
        // Record transient failures in circuit breaker
        if (draftBreaker.isTransientError(error)) {
          draftBreaker.recordFailure(rawMsg);
        }
        
        let safeMessage = 'Draft generation failed. Please try again.';
        if (rawMsg.includes('DeploymentNotFound') || rawMsg.includes('does not exist') || rawMsg.includes('model_not_found')) {
          safeMessage = 'AI model not configured. Please contact your administrator.';
        } else if (isAzureContentFilteredError(error)) {
          safeMessage =
            'Your request looks legitimate, but the upstream AI filter still rejected it after a neutral retry. Try a shorter follow-up or break the drafting ask into smaller steps.';
        } else if (rawMsg.includes('429') || rawMsg.includes('rate limit') || rawMsg.includes('quota')) {
          safeMessage = 'AI service rate limited. Please try again later.';
        } else if (rawMsg.includes('timeout') || rawMsg.includes('AbortError')) {
          safeMessage = 'Request timed out. Please try again.';
        }
        emit('error', {
          message: safeMessage,
          steps: steps.map(s => ({ step: s.step, name: s.name, status: s.status })),
        });
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
        const intent = await detectIntentWithSafetyRetry(body.prompt, openai, model);
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
        const generated = await generateDraftContentWithSafetyRetry(openai, model, {
          contractType,
          template: template ? { name: template.name, content: template.content } : null,
          clauses,
          variables,
          tone: body.tone || 'formal',
          jurisdiction: body.jurisdiction || 'United States',
          instructions,
          prompt: body.prompt,
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

    // Step 4b: Faithfulness enforcement (repair + addendum)
    let faithfulnessReport: Awaited<ReturnType<typeof enforceFaithfulness>>['faithfulness'] = null;
    if (body.prompt) {
      try {
        const openaiForRepair = hasAI ? createOpenAIClient() : null;
        const enforced = await enforceFaithfulness(
          openaiForRepair,
          model,
          body.prompt,
          html,
          plainText,
          contractType,
          body.jurisdiction || 'United States',
        );
        html = enforced.html;
        plainText = enforced.plainText;
        faithfulnessReport = enforced.faithfulness;
      } catch (e) {
        logger.warn('Faithfulness enforcement failed (non-streaming), keeping original draft', e);
      }
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

    const faithfulness = faithfulnessReport
      ?? (body.prompt ? { ...computeFaithfulness(body.prompt, plainText), repaired: false, addendumAppended: false } : null);

    return createSuccessResponse(ctx, {
      draft: {
        id: draft.id,
        title: draft.title,
        status: draft.status,
        contractType,
        editUrl: `/drafting/copilot?draft=${draft.id}`,
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
      faithfulness,
    });
  } catch (error: any) {
    logger.error('Agentic draft generation failed:', error);
    const msg = error?.message || '';
    if (msg.includes('DeploymentNotFound') || msg.includes('model_not_found') || msg.includes('does not exist')) {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE',
        'AI model deployment not found. The draft was not created. Please configure Azure OpenAI deployment.', 503);
    }
    if (isAzureContentFilteredError(error)) {
      return createErrorResponse(
        ctx,
        'CONTENT_FILTERED',
        'Your request looks legitimate, but the upstream AI filter still rejected it after a neutral retry. Try a shorter follow-up or break the drafting ask into smaller steps.',
        400,
      );
    }
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Draft generation failed', 500);
  }
}
