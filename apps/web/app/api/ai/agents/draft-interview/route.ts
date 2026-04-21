/**
 * Conversational Drafting Interview API
 * ----------------------------------------------------------------------------
 * POST /api/ai/agents/draft-interview
 *
 * A real back-and-forth between the user and the AI to scope a contract draft.
 * The AI asks ONE targeted follow-up question at a time, reacts to the user's
 * last answer, and signals when it has enough information to generate the
 * document. At that point it returns a structured `brief` that the frontend
 * hands off to the existing /api/ai/agents/draft pipeline.
 *
 * Request body:
 *   {
 *     messages: [{ role: 'user' | 'assistant', content: string }],
 *     originalPrompt: string,
 *     detected?: { ...client-side prompt analyzer output... }
 *   }
 *
 * Response body:
 *   {
 *     role: 'assistant',
 *     content: string,               // the AI's next question OR final handoff
 *     finalized: boolean,            // true = ready to generate
 *     brief?: {                      // structured summary (present when finalized)
 *       contractType?: string
 *       ourRole?: string
 *       counterparty?: string
 *       term?: string
 *       renewal?: string
 *       governingLaw?: string
 *       liabilityCap?: string
 *       paymentTerms?: string
 *       confidentiality?: string
 *       tone?: string
 *       specialTerms?: string[]
 *       enrichedPrompt?: string      // rendered prompt for downstream pipeline
 *     }
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  withAuthApiHandler,
  createSuccessResponse,
  createErrorResponse,
  type AuthenticatedApiContext,
} from '@/lib/api-middleware'
import { createOpenAIClient, hasAIClientConfig, getDeploymentName } from '@/lib/openai-client'
import { logger } from '@/lib/logger'

interface InterviewMessage {
  role: 'user' | 'assistant'
  content: string
}

interface InterviewRequest {
  messages?: InterviewMessage[]
  originalPrompt?: string
  detected?: Record<string, unknown>
}

interface InterviewBrief {
  contractType?: string
  ourRole?: string
  counterparty?: string
  term?: string
  renewal?: string
  governingLaw?: string
  liabilityCap?: string
  paymentTerms?: string
  confidentiality?: string
  tone?: string
  specialTerms?: string[]
  enrichedPrompt?: string
}

interface InterviewResponse {
  role: 'assistant'
  content: string
  finalized: boolean
  brief?: InterviewBrief
}

const SYSTEM_PROMPT = `You are a senior contract attorney conducting a friendly, efficient scoping interview with a user who wants you to draft a contract.

Goal: Gather just enough information to produce a tailored, precise contract — NOT a generic template. You talk like an experienced lawyer on a real call: warm, curious, specific, and decisive. Do NOT pretend to draft until you have the essentials.

How to run the conversation:
1. Read what the user has already said and what the client-side analyzer already detected (provided to you). Do NOT ask for facts already stated or detected.
2. Ask exactly ONE question per turn. Short, conversational, specific. No "multiple question" dumps.
3. Prefer binary or narrow-option questions (e.g. "Are you the buyer or the seller here?") over open-ended ones.
4. If the user's answer is ambiguous, ask a clarifying follow-up before moving on.
5. Acknowledge what you just learned in one short line before asking the next thing — this feels like a real conversation, not a form.
6. Cover these essentials (skipping anything already known): contract type, which side we represent, counterparty name, term length, renewal, governing law, liability cap, payment terms, confidentiality obligations, tone, and any unusual/unique requirements. Stop as soon as you have enough — usually 3–6 questions.
7. When you have enough, do NOT ask more questions. Instead, reply with a short confirmation summary and set finalized=true with a complete brief.

Response format:
You MUST respond with a single JSON object (no markdown, no code fences) of the shape:
{
  "content": "<what you say to the user>",
  "finalized": <boolean>,
  "brief": { <structured brief — only when finalized is true, otherwise omit or null> }
}

When finalized=true, the brief MUST include:
- contractType, ourRole, counterparty (or null), term, renewal, governingLaw, liabilityCap, paymentTerms, confidentiality, tone
- specialTerms: array of strings (any unusual requirements the user mentioned)
- enrichedPrompt: a 3–8 sentence drafting brief that synthesizes everything we learned — written as instructions a senior attorney would give their associate. This is what the drafter will use; it MUST be specific and MUST reference the user's concrete values.

Examples of good questions (one per turn):
- "Got it — an NDA. Are you the disclosing party, the receiving party, or is it mutual?"
- "Thanks. What's the counterparty's legal name, and roughly what industry are they in?"
- "How long should confidentiality survive after the agreement ends — 3 years, 5 years, or perpetual for trade secrets?"

Examples of bad behavior (never do this):
- Asking 5 questions at once.
- Asking for a fact the user already stated.
- Generating draft language in the interview phase.
- Setting finalized=true before covering the essentials.`

function buildOpeningMessage(originalPrompt: string, detected: Record<string, unknown>): string {
  const parts: string[] = []
  parts.push(`User's original request: "${originalPrompt.trim()}"`)
  if (detected && Object.keys(detected).length > 0) {
    parts.push(`\nClient-side analyzer already detected: ${JSON.stringify(detected, null, 2)}`)
    parts.push('Do NOT ask the user about anything already detected above.')
  }
  parts.push('\nBegin the interview with your FIRST question. Reply with the JSON object described in the system prompt.')
  return parts.join('\n')
}

async function handler(req: NextRequest, ctx: AuthenticatedApiContext) {
  if (!hasAIClientConfig()) {
    return createErrorResponse(
      ctx,
      'AI_NOT_CONFIGURED',
      'AI is not configured. Set AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT.',
      503,
    )
  }

  let body: InterviewRequest
  try {
    body = await req.json()
  } catch {
    return createErrorResponse(ctx, 'INVALID_JSON', 'Invalid JSON body', 400)
  }

  const originalPrompt = (body.originalPrompt || '').trim()
  if (!originalPrompt) {
    return createErrorResponse(ctx, 'MISSING_PROMPT', 'originalPrompt is required', 400)
  }

  const history: InterviewMessage[] = Array.isArray(body.messages)
    ? body.messages
        .filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
        .slice(-20) // cap history
    : []

  const detected = body.detected && typeof body.detected === 'object' ? body.detected : {}

  const openai = createOpenAIClient()
  const model = getDeploymentName()

  // First turn — seed with the user's opening prompt + detected signals.
  // Subsequent turns — the user's latest reply is already the last entry in history.
  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: buildOpeningMessage(originalPrompt, detected as Record<string, unknown>) },
    ...history.map(m => ({ role: m.role, content: m.content })),
  ]

  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.4,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages,
    })

    const raw = completion.choices[0]?.message?.content?.trim() || ''
    let parsed: { content?: string; finalized?: boolean; brief?: InterviewBrief } = {}
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      logger.warn('[draft-interview] Non-JSON AI response', { raw: raw.slice(0, 500) })
      // Soft fallback — treat entire response as the assistant message.
      parsed = { content: raw, finalized: false }
    }

    const response: InterviewResponse = {
      role: 'assistant',
      content: String(parsed.content || 'Could you say a bit more about what you need?'),
      finalized: Boolean(parsed.finalized),
      brief: parsed.finalized && parsed.brief ? parsed.brief : undefined,
    }

    // Defensive: if finalized but no enrichedPrompt, synthesize one.
    if (response.finalized && response.brief && !response.brief.enrichedPrompt) {
      const b = response.brief
      const lines: string[] = [originalPrompt, '', '--- Drafting brief (from interview) ---']
      if (b.contractType) lines.push(`Contract type: ${b.contractType}`)
      if (b.ourRole) lines.push(`We are drafting for the: ${b.ourRole}`)
      if (b.counterparty) lines.push(`Counterparty: ${b.counterparty}`)
      if (b.term) lines.push(`Term: ${b.term}`)
      if (b.renewal) lines.push(`Renewal: ${b.renewal}`)
      if (b.governingLaw) lines.push(`Governing law: ${b.governingLaw}`)
      if (b.liabilityCap) lines.push(`Liability cap: ${b.liabilityCap}`)
      if (b.paymentTerms) lines.push(`Payment terms: ${b.paymentTerms}`)
      if (b.confidentiality) lines.push(`Confidentiality: ${b.confidentiality}`)
      if (b.tone) lines.push(`Tone: ${b.tone}`)
      if (b.specialTerms && b.specialTerms.length) {
        lines.push('Special terms/unusual requirements:')
        for (const t of b.specialTerms) lines.push(`  - ${t}`)
      }
      lines.push('')
      lines.push('Use every value above verbatim in the generated contract. Do NOT leave [___] placeholders for any value specified above. Where a value is not specified, infer a reasonable default and mark with [TBD] so the reviewer can catch it.')
      response.brief.enrichedPrompt = lines.join('\n')
    }

    return createSuccessResponse(ctx, response)
  } catch (err) {
    logger.error('[draft-interview] AI call failed', { error: err instanceof Error ? err.message : String(err) })
    return createErrorResponse(
      ctx,
      'AI_INTERVIEW_FAILED',
      err instanceof Error ? err.message : 'AI interview failed',
      500,
    )
  }
}

export const POST = withAuthApiHandler(handler)
