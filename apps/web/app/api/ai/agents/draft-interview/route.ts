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
import { containsBannedWord } from '@/lib/ai/drafting-safety'
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
  /** Running brief with whatever has been captured so far. Populated every turn,
   *  not just on finalize. Useful to show the user a live "here's what I've
   *  understood so far" panel during the interview. */
  partialBrief?: InterviewBrief
  /** Short clickable answer suggestions the AI surfaced for the current question.
   *  e.g. ["Buyer", "Seller", "Mutual"]. Optional — only present when the AI
   *  decides the question is narrow/option-style. */
  quickAnswers?: string[]
}

type DraftInterviewSafetyMode = 'standard' | 'strict'

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
  "partialBrief": { <structured brief with every field you already know — INCLUDE THIS ON EVERY TURN, even early ones. Omit fields you don't yet know.> },
  "quickAnswers": [ <0–5 short strings> ],
  "brief": { <structured brief — only when finalized is true, otherwise omit or null> }
}

Rules for partialBrief:
- Include on EVERY turn so the user sees what you've understood so far.
- Only fill fields you are confident about based on the conversation so far.
- Keep each field short (a few words at most).

Rules for quickAnswers:
- Only populate when the question you're asking has clear discrete answer options (e.g. "Buyer or seller?", "3 years, 5 years, or perpetual?").
- Each string is a SHORT label the user can click as their answer (max 3–4 words).
- Omit or empty array if the question is genuinely open-ended (e.g. "What's the counterparty's legal name?").
- Never more than 5 options.

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

function normalizeInterviewPrompt(originalPrompt: string): string {
  // Pass-through. We deliberately do NOT rewrite the user's wording \u2014
  // the user's exact phrasing is what we send to the model. The only
  // gating is the explicit BANNED_PATTERNS check upstream.
  return originalPrompt.trim().replace(/\s+/g, ' ')
}

function summarizePromptForStrictSafety(originalPrompt: string): string {
  const normalized = normalizeInterviewPrompt(originalPrompt).toLowerCase()

  if (/\bconfidentiality agreement\b|\bnda\b|\bnon-disclosure\b/.test(normalized)) return 'a confidentiality agreement'
  if (/\bmaster services? agreement\b|\bmsa\b/.test(normalized)) return 'a master services agreement'
  if (/\bstatement of work\b|\bsow\b/.test(normalized)) return 'a statement of work'
  if (/\bconsulting\b|\bconsultancy\b|\bservices\b/.test(normalized)) return 'a services-related agreement'

  return 'a commercial contract'
}

function buildOpeningMessage(
  originalPrompt: string,
  detected: Record<string, unknown>,
  safetyMode: DraftInterviewSafetyMode = 'standard',
): string {
  const normalizedPrompt = normalizeInterviewPrompt(originalPrompt)
  const parts: string[] = []

  if (safetyMode === 'strict') {
    parts.push(`The user wants help drafting ${summarizePromptForStrictSafety(originalPrompt)}.`)
    parts.push('Use neutral business language, avoid repeating the user\'s raw wording, and start with the single most important scoping question.')
  } else {
    parts.push(`User's request in plain business language: "${normalizedPrompt}"`)
  }

  if (detected && Object.keys(detected).length > 0) {
    parts.push(`\nClient-side analyzer already detected: ${JSON.stringify(detected, null, 2)}`)
    parts.push('Do NOT ask the user about anything already detected above.')
  }
  parts.push('\nBegin the interview with your FIRST question. Reply with the JSON object described in the system prompt.')
  return parts.join('\n')
}

function buildInterviewMessages(
  originalPrompt: string,
  detected: Record<string, unknown>,
  history: InterviewMessage[],
  safetyMode: DraftInterviewSafetyMode = 'standard',
) {
  return [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: buildOpeningMessage(originalPrompt, detected, safetyMode) },
    ...history.map(m => ({ role: m.role, content: m.content })),
  ]
}

function buildLocalFallbackTurn(
  originalPrompt: string,
  detected: Record<string, unknown>,
  history: InterviewMessage[],
): InterviewResponse {
  // Local deterministic interview turn used when Azure's content filter
  // refuses to play ball. Picks the next sensible scoping question based on
  // what we already know, with no AI roundtrip — so the safety filter has
  // nothing to flag.
  const summary = summarizePromptForStrictSafety(originalPrompt)

  const det = detected as {
    contractType?: unknown
    ourRole?: unknown
    counterparty?: unknown
    term?: unknown
    governingLaw?: unknown
  }
  const knownContractType = typeof det.contractType === 'string' ? det.contractType : undefined
  const knownRole = typeof det.ourRole === 'string' ? det.ourRole : undefined
  const knownCounterparty = typeof det.counterparty === 'string' ? det.counterparty : undefined
  const knownTerm = typeof det.term === 'string' ? det.term : undefined
  const knownGoverningLaw = typeof det.governingLaw === 'string' ? det.governingLaw : undefined

  const partialBrief: InterviewBrief = {
    ...(knownContractType ? { contractType: knownContractType } : {}),
    ...(knownRole ? { ourRole: knownRole } : {}),
    ...(knownCounterparty ? { counterparty: knownCounterparty } : {}),
    ...(knownTerm ? { term: knownTerm } : {}),
    ...(knownGoverningLaw ? { governingLaw: knownGoverningLaw } : {}),
  }

  if (!knownRole) {
    return {
      role: 'assistant',
      content: `Got it — you're looking for ${knownContractType ? `a ${knownContractType.toLowerCase()}` : summary}. Which side are you drafting for: yours or the counterparty's?`,
      finalized: false,
      partialBrief,
      quickAnswers: ['Our side', 'Counterparty', 'Mutual'],
    }
  }
  if (!knownCounterparty) {
    return {
      role: 'assistant',
      content: `Thanks. Who's the counterparty — what's their legal name?`,
      finalized: false,
      partialBrief,
    }
  }
  if (!knownTerm) {
    return {
      role: 'assistant',
      content: `How long should the agreement run for?`,
      finalized: false,
      partialBrief,
      quickAnswers: ['1 year', '2 years', '3 years', 'Open-ended'],
    }
  }
  if (!knownGoverningLaw) {
    return {
      role: 'assistant',
      content: `Which jurisdiction's law should govern the contract?`,
      finalized: false,
      partialBrief,
      quickAnswers: ['Delaware', 'New York', 'England & Wales', 'Switzerland'],
    }
  }

  const turnNumber = history.length
  const closingNudge = turnNumber >= 2
    ? 'Anything else unusual we should bake in? Otherwise say "ready" and I\'ll generate the draft.'
    : 'Anything else specific you want included — payment terms, liability cap, or unusual clauses?'

  return {
    role: 'assistant',
    content: closingNudge,
    finalized: false,
    partialBrief,
    quickAnswers: ['Standard payment terms', 'Add liability cap', 'Ready to draft'],
  }
}

function isContentFilteredError(error: unknown): error is Error & { code?: string; status?: number } {
  const raw = error instanceof Error ? error.message : String(error)

  return /content[_ ]filter|content management policy|responsible ai/i.test(raw) ||
    (error as { code?: string } | undefined)?.code === 'content_filter' ||
    ((error as { status?: number } | undefined)?.status === 400 && /filter/i.test(raw))
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

  // The only filter we apply locally is a tiny explicit blocklist.
  // Industry jargon, acronyms, blunt B2B wording — all accepted as-is.
  const banCheck = containsBannedWord(originalPrompt)
  if (banCheck.banned) {
    return createErrorResponse(ctx, 'CONTENT_NOT_ALLOWED', banCheck.reason, 400)
  }

  const history: InterviewMessage[] = Array.isArray(body.messages)
    ? body.messages
        .filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
        .slice(-20) // cap history
    : []

  // Same banned-word check on the latest user reply, if any.
  const lastUserTurn = [...history].reverse().find(m => m.role === 'user')
  if (lastUserTurn) {
    const turnCheck = containsBannedWord(lastUserTurn.content)
    if (turnCheck.banned) {
      return createErrorResponse(ctx, 'CONTENT_NOT_ALLOWED', turnCheck.reason, 400)
    }
  }

  const detected = body.detected && typeof body.detected === 'object' ? body.detected : {}

  const openai = createOpenAIClient()
  const model = getDeploymentName()

  // First turn — seed with the user's opening prompt + detected signals.
  // Subsequent turns — the user's latest reply is already the last entry in history.
  const messages = buildInterviewMessages(originalPrompt, detected as Record<string, unknown>, history)

  try {
    let completion
    try {
      completion = await openai.chat.completions.create({
        model,
        temperature: 0.4,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
        messages,
      })
    } catch (error) {
      if (!isContentFilteredError(error)) {
        throw error
      }

      logger.info('[draft-interview] Content filter tripped; retrying with neutralized opening prompt', {
        promptSnippet: originalPrompt.slice(0, 120),
      })

      const strictMessages = buildInterviewMessages(
        originalPrompt,
        detected as Record<string, unknown>,
        history,
        'strict',
      )

      try {
        completion = await openai.chat.completions.create({
          model,
          temperature: 0.4,
          max_tokens: 1200,
          response_format: { type: 'json_object' },
          messages: strictMessages,
        })
      } catch (retryError) {
        if (isContentFilteredError(retryError)) {
          logger.info('[draft-interview] Content filter persisted after neutral retry — falling back to deterministic interview turn', {
            promptSnippet: originalPrompt.slice(0, 120),
          })
          // The Azure content filter occasionally misreads benign B2B
          // language (industry jargon, acronyms like NDA / RFP, etc.).
          // Rather than blocking the user with a "rephrase your request"
          // wall, synthesize a safe deterministic interview turn locally
          // so the flow keeps moving. The user can answer it normally and
          // we'll go back to AI-driven turns on the next round.
          const fallback = buildLocalFallbackTurn(originalPrompt, detected as Record<string, unknown>, history)
          return createSuccessResponse(ctx, fallback)
        }

        throw retryError
      }
    }

    const raw = completion.choices[0]?.message?.content?.trim() || ''
    let parsed: {
      content?: string
      finalized?: boolean
      brief?: InterviewBrief
      partialBrief?: InterviewBrief
      quickAnswers?: unknown
    } = {}
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      logger.warn('[draft-interview] Non-JSON AI response', { raw: raw.slice(0, 500) })
      // Soft fallback — treat entire response as the assistant message.
      parsed = { content: raw, finalized: false }
    }

    // Sanitise quickAnswers — strings only, trimmed, max 5, max 40 chars each.
    let quickAnswers: string[] | undefined
    if (Array.isArray(parsed.quickAnswers)) {
      quickAnswers = parsed.quickAnswers
        .filter((s): s is string => typeof s === 'string')
        .map(s => s.trim())
        .filter(s => s.length > 0 && s.length <= 40)
        .slice(0, 5)
      if (quickAnswers.length === 0) quickAnswers = undefined
    }

    const response: InterviewResponse = {
      role: 'assistant',
      content: String(parsed.content || 'Could you say a bit more about what you need?'),
      finalized: Boolean(parsed.finalized),
      brief: parsed.finalized && parsed.brief ? parsed.brief : undefined,
      partialBrief: parsed.partialBrief && typeof parsed.partialBrief === 'object' ? parsed.partialBrief : undefined,
      quickAnswers,
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
    const raw = err instanceof Error ? err.message : String(err)
    logger.error('[draft-interview] AI call failed', { error: raw })
    return createErrorResponse(
      ctx,
      'AI_INTERVIEW_FAILED',
      err instanceof Error ? err.message : 'AI interview failed',
      500,
    )
  }
}

export const POST = withAuthApiHandler(handler)
