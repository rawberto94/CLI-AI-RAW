'use client'

/**
 * DraftInterviewChat
 * ----------------------------------------------------------------------------
 * A true conversational interview between the user and the AI before drafting.
 *
 * Flow:
 *   1. User types a prompt on the landing and hits Generate.
 *   2. This dialog opens. The AI (via POST /api/ai/agents/draft-interview)
 *      reads the user's prompt + anything the client-side analyzer detected
 *      and asks ONE targeted follow-up question.
 *   3. The user answers. The AI reads the answer and asks the next question,
 *      reacting to what was just said. This is a real chat, not a form.
 *   4. When the AI has enough information, it sets `finalized=true` and
 *      returns a structured `brief` with an `enrichedPrompt`.
 *   5. We hand off the enrichedPrompt to the existing agentic draft pipeline.
 *
 * The user can jump in at any point with "Let's just draft it now" to skip
 * ahead — we forward whatever has been discussed so far.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  Wand2,
  Sparkles,
  Send,
  SkipForward,
  Loader2,
  CornerDownLeft,
  CheckCircle2,
  RotateCcw,
  RefreshCw,
  ListChecks,
  Pencil,
  Check,
  X,
  Lightbulb,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InterviewDetected {
  contractType?: string
  term?: string
  notice?: string
  paymentTerms?: string
  cap?: string
  governingLaw?: string
  renewal?: string
  partyA?: string
  partyB?: string
  clauses: string[]
}

interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
  /** Quick-answer chips surfaced by the AI for option-style questions.
   *  Only populated on assistant turns. */
  quickAnswers?: string[]
}

export interface InterviewBrief {
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

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  prompt: string
  detected: InterviewDetected
  onComplete: (enrichedPrompt: string, brief: InterviewBrief) => void
}

// ---------------------------------------------------------------------------
// CSRF helper — reads the csrf_token cookie
// ---------------------------------------------------------------------------

function getCsrfToken(): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

// ---------------------------------------------------------------------------
// Session persistence — so closing the dialog accidentally doesn't wipe state
// ---------------------------------------------------------------------------

const PERSIST_PREFIX = 'contigo.draft-interview.v1.'
const PERSIST_TTL_MS = 60 * 60 * 1000 // 1 hour

function hashPrompt(s: string): string {
  // Tiny stable hash — good enough for a sessionStorage key.
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h).toString(36)
}

interface PersistedState {
  messages: ChatTurn[]
  partialBrief: InterviewBrief | null
  finalized: InterviewBrief | null
  savedAt: number
}

function loadPersisted(prompt: string): PersistedState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(PERSIST_PREFIX + hashPrompt(prompt))
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedState
    if (!parsed || typeof parsed.savedAt !== 'number') return null
    if (Date.now() - parsed.savedAt > PERSIST_TTL_MS) return null
    if (!Array.isArray(parsed.messages) || parsed.messages.length === 0) return null
    return parsed
  } catch {
    return null
  }
}

function savePersisted(prompt: string, state: Omit<PersistedState, 'savedAt'>): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(
      PERSIST_PREFIX + hashPrompt(prompt),
      JSON.stringify({ ...state, savedAt: Date.now() }),
    )
  } catch {
    // quota / disabled — ignore
  }
}

function clearPersisted(prompt: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(PERSIST_PREFIX + hashPrompt(prompt))
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Running-brief chip labels — keep order stable and human-readable
// ---------------------------------------------------------------------------

const BRIEF_FIELD_LABELS: Array<[keyof InterviewBrief, string]> = [
  ['contractType', 'Type'],
  ['ourRole', 'Our role'],
  ['counterparty', 'Counterparty'],
  ['term', 'Term'],
  ['renewal', 'Renewal'],
  ['governingLaw', 'Governing law'],
  ['liabilityCap', 'Cap'],
  ['paymentTerms', 'Payment'],
  ['confidentiality', 'Confidentiality'],
  ['tone', 'Tone'],
]

// Loading phrases that cycle while the AI is "thinking"
const THINKING_PHRASES = [
  'Reading your brief…',
  'Thinking about jurisdiction…',
  'Weighing risk posture…',
  'Mapping counterparty leverage…',
  'Picking the right clause set…',
  'Framing the next question…',
]

// Minimum number of captured fields before we surface the prominent
// "Draft with what we have" CTA to the user mid-interview.
const DRAFT_NOW_MIN_FIELDS = 3

// Rebuild the downstream drafting prompt from the brief fields. We regenerate
// client-side (instead of trusting the AI's original enrichedPrompt) whenever
// the user edits any field — this keeps the prompt consistent with the UI.
function rebuildEnrichedPrompt(originalPrompt: string, b: InterviewBrief): string {
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
  return lines.join('\n')
}

// Count "substantive" non-empty fields in a brief — used to decide whether
// we're confident enough to show the mid-conversation "Draft now" CTA.
function countBriefFields(b: InterviewBrief | null): number {
  if (!b) return 0
  let n = 0
  for (const [key] of BRIEF_FIELD_LABELS) {
    const v = b[key]
    if (typeof v === 'string' && v.trim().length > 0) n++
  }
  if (Array.isArray(b.specialTerms) && b.specialTerms.length > 0) n++
  return n
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DraftInterviewChat({ open, onOpenChange, prompt, detected, onComplete }: Props) {
  const [messages, setMessages] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [finalized, setFinalized] = useState<InterviewBrief | null>(null)
  const [partialBrief, setPartialBrief] = useState<InterviewBrief | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [thinkingIdx, setThinkingIdx] = useState(0)
  /** When the user clicks the pencil next to a brief field, we capture which
   *  field is being edited and buffer its in-flight value. Empty = not editing. */
  const [editingField, setEditingField] = useState<keyof InterviewBrief | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const initFiredRef = useRef(false)
  const resumedRef = useRef(false)

  // Reset on (re-)open — but if we have a persisted conversation for this
  // prompt, hydrate from it instead of starting fresh. This means a user who
  // accidentally dismisses the dialog can reopen it and pick up right where
  // they left off.
  useEffect(() => {
    if (open) {
      setInput('')
      setError(null)
      setEditingField(null)
      setEditingValue('')
      const restored = loadPersisted(prompt)
      if (restored && restored.messages.length > 0) {
        setMessages(restored.messages)
        setPartialBrief(restored.partialBrief)
        setFinalized(restored.finalized)
        initFiredRef.current = true // don't re-kick the opener
        resumedRef.current = true
      } else {
        setMessages([])
        setPartialBrief(null)
        setFinalized(null)
        initFiredRef.current = false
        resumedRef.current = false
      }
    }
  }, [open, prompt])

  // Persist every state change while the dialog is open, so closing and
  // reopening doesn't drop the conversation.
  useEffect(() => {
    if (!open) return
    if (messages.length === 0 && !finalized) return
    savePersisted(prompt, { messages, partialBrief, finalized })
  }, [open, prompt, messages, partialBrief, finalized])

  // Auto-scroll to bottom on new turn
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading, finalized])

  // Focus textarea when dialog opens and after each assistant turn
  useEffect(() => {
    if (open && !finalized && !loading) {
      const t = setTimeout(() => inputRef.current?.focus(), 120)
      return () => clearTimeout(t)
    }
  }, [open, finalized, loading, messages.length])

  // Cycle through "thinking…" phrases while waiting for the AI so the user
  // gets continuous feedback during the 3–5s LLM latency.
  useEffect(() => {
    if (!loading) return
    setThinkingIdx(0)
    const id = window.setInterval(() => {
      setThinkingIdx((i) => (i + 1) % THINKING_PHRASES.length)
    }, 1800)
    return () => window.clearInterval(id)
  }, [loading])

  const callInterview = useCallback(
    async (history: ChatTurn[], originalPromptOverride?: string) => {
      setLoading(true)
      setError(null)
      setErrorCode(null)
      try {
        const res = await fetch('/api/ai/agents/draft-interview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': getCsrfToken(),
          },
          credentials: 'same-origin',
          body: JSON.stringify({
            // Strip client-only metadata (quickAnswers) before sending
            messages: history.map(({ role, content }) => ({ role, content })),
            originalPrompt: originalPromptOverride ?? prompt,
            detected,
          }),
        })
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}))
          const code = errBody?.error?.code || errBody?.code
          const msg = errBody?.error?.message || errBody?.message || `HTTP ${res.status}`
          const thrown = new Error(msg) as Error & { code?: string }
          thrown.code = code
          throw thrown
        }
        const body = await res.json()
        const data = body?.data ?? body
        const assistantContent: string = data.content || 'Could you tell me a bit more?'
        const quickAnswers: string[] | undefined = Array.isArray(data.quickAnswers)
          ? data.quickAnswers.filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0)
          : undefined
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: assistantContent, quickAnswers },
        ])
        if (data.partialBrief && typeof data.partialBrief === 'object') {
          setPartialBrief(data.partialBrief as InterviewBrief)
        }
        if (data.finalized && data.brief?.enrichedPrompt) {
          setFinalized(data.brief)
        }
      } catch (e) {
        const code = (e as { code?: string })?.code
        setErrorCode(code ?? null)
        setError(e instanceof Error ? e.message : 'AI is temporarily unavailable')
      } finally {
        setLoading(false)
      }
    },
    [prompt, detected],
  )

  // Kick off the AI's opening question as soon as the dialog opens (unless we
  // restored a prior conversation, in which case initFiredRef is already set).
  useEffect(() => {
    if (!open) return
    if (initFiredRef.current) return
    if (!prompt.trim()) return
    initFiredRef.current = true
    void callInterview([])
  }, [open, prompt, callInterview])

  const handleSend = useCallback(
    async (override?: string) => {
      const text = (override ?? input).trim()
      if (!text || loading || finalized) return
      // If the first turn was rejected by the content filter, treat the user's
      // next message as a replacement for the flagged opening prompt — otherwise
      // the server re-embeds the flagged phrase and trips the filter again.
      if (errorCode === 'CONTENT_FILTERED' && messages.length === 0) {
        setInput('')
        await callInterview([], text)
        return
      }
      const next: ChatTurn[] = [...messages, { role: 'user' as const, content: text }]
      setMessages(next)
      setInput('')
      await callInterview(next)
    },
    [input, loading, finalized, messages, callInterview, errorCode],
  )

  const handleRetry = useCallback(async () => {
    setError(null)
    setErrorCode(null)
    await callInterview(messages)
  }, [messages, callInterview])

  const handleStartOver = useCallback(() => {
    clearPersisted(prompt)
    setMessages([])
    setPartialBrief(null)
    setFinalized(null)
    setInput('')
    setError(null)
    setErrorCode(null)
    setEditingField(null)
    setEditingValue('')
    initFiredRef.current = false
    resumedRef.current = false
    // Kick the opener again on next tick
    setTimeout(() => {
      if (!initFiredRef.current && prompt.trim()) {
        initFiredRef.current = true
        void callInterview([])
      }
    }, 0)
  }, [prompt, callInterview])

  const handleSkip = useCallback(() => {
    // Synthesise a brief from what we have without calling the AI again.
    if (finalized?.enrichedPrompt) {
      clearPersisted(prompt)
      onComplete(finalized.enrichedPrompt, finalized)
      return
    }
    // Fall back to raw prompt + detected signals.
    const lines: string[] = [prompt, '', '--- Drafting brief ---']
    if (detected.contractType) lines.push(`Contract type: ${detected.contractType}`)
    if (detected.term) lines.push(`Term: ${detected.term}`)
    if (detected.governingLaw) lines.push(`Governing law: ${detected.governingLaw}`)
    if (detected.cap) lines.push(`Liability cap: ${detected.cap}`)
    if (detected.paymentTerms) lines.push(`Payment terms: ${detected.paymentTerms}`)
    if (detected.renewal) lines.push(`Renewal: ${detected.renewal}`)
    if (detected.notice) lines.push(`Notice period: ${detected.notice}`)
    if (detected.partyA || detected.partyB) {
      lines.push(`Parties: ${[detected.partyA, detected.partyB].filter(Boolean).join(' and ')}`)
    }
    if (detected.clauses.length) lines.push(`Required clauses: ${detected.clauses.join(', ')}`)
    // Append the conversation for additional context.
    if (messages.length > 0) {
      lines.push('')
      lines.push('--- Interview transcript ---')
      for (const m of messages) lines.push(`${m.role === 'user' ? 'User' : 'Interviewer'}: ${m.content}`)
    }
    lines.push('')
    lines.push('Use every value above. Do NOT leave [___] placeholders for anything specified. Where values are missing, use a reasonable default and mark [TBD].')
    clearPersisted(prompt)
    onComplete(lines.join('\n'), { enrichedPrompt: lines.join('\n') })
  }, [finalized, prompt, detected, messages, onComplete])

  const handleGenerateFromBrief = useCallback(() => {
    if (finalized?.enrichedPrompt) {
      clearPersisted(prompt)
      onComplete(finalized.enrichedPrompt, finalized)
    }
  }, [finalized, prompt, onComplete])

  // Begin editing a finalized-brief field in place. The pencil icon on each
  // chip calls this; Enter/blur commits, Escape cancels.
  const beginEditField = useCallback((field: keyof InterviewBrief, current: unknown) => {
    setEditingField(field)
    setEditingValue(typeof current === 'string' ? current : Array.isArray(current) ? current.join(', ') : '')
  }, [])

  const cancelEditField = useCallback(() => {
    setEditingField(null)
    setEditingValue('')
  }, [])

  const commitEditField = useCallback(() => {
    if (!editingField) return
    const next = editingValue.trim()
    setFinalized((prev) => {
      if (!prev) return prev
      const updated: InterviewBrief = { ...prev }
      if (editingField === 'specialTerms') {
        updated.specialTerms = next
          ? next.split(',').map(s => s.trim()).filter(Boolean)
          : undefined
      } else if (next) {
        // Type-safe assignment: we only edit string fields via the chips, so
        // this cast is narrow.
        ;(updated as Record<string, unknown>)[editingField as string] = next
      } else {
        ;(updated as Record<string, unknown>)[editingField as string] = undefined
      }
      // Recompute enrichedPrompt so the downstream drafter sees the edited values.
      updated.enrichedPrompt = rebuildEnrichedPrompt(prompt, updated)
      return updated
    })
    setEditingField(null)
    setEditingValue('')
  }, [editingField, editingValue, prompt])

  // Jump straight to drafting from mid-interview state. Unlike the existing
  // footer "Skip" link, this is a prominent CTA we surface once the AI has
  // captured enough context (see `canDraftNow` below).
  const handleDraftWithWhatWeHave = useCallback(() => {
    const base = partialBrief ?? {}
    const enrichedPrompt = rebuildEnrichedPrompt(prompt, base)
    const brief: InterviewBrief = { ...base, enrichedPrompt }
    clearPersisted(prompt)
    onComplete(enrichedPrompt, brief)
  }, [partialBrief, prompt, onComplete])

  // Running-brief chips — prefer the finalized brief, otherwise show whatever
  // the AI has captured so far on the last partialBrief update.
  const briefChips = useMemo(() => {
    const source = finalized ?? partialBrief
    if (!source) return []
    const chips: Array<{ label: string; value: string }> = []
    for (const [key, label] of BRIEF_FIELD_LABELS) {
      const raw = source[key]
      if (!raw) continue
      const value = Array.isArray(raw) ? raw.join(', ') : String(raw)
      if (!value.trim()) continue
      chips.push({ label, value: value.length > 36 ? `${value.slice(0, 33)}…` : value })
    }
    // Special terms rendered as one chip summarising the count
    const special = source.specialTerms
    if (Array.isArray(special) && special.length > 0) {
      chips.push({ label: 'Special', value: `${special.length} requirement${special.length === 1 ? '' : 's'}` })
    }
    return chips
  }, [finalized, partialBrief])

  // Identify the index of the most recent assistant turn so we only render
  // quick-answer chips under the *current* question (older ones look weird).
  const lastAssistantIdx = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return i
    }
    return -1
  }, [messages])

  // Gate the mid-interview "Draft with what we have" CTA: show only once the
  // AI has captured a meaningful amount of context but has not yet finalized.
  const canDraftNow = useMemo(() => {
    if (finalized) return false
    if (loading) return false
    return countBriefFields(partialBrief) >= DRAFT_NOW_MIN_FIELDS
  }, [finalized, loading, partialBrief])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        {/* Header */}
        <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-[#0b0a1a] via-[#161235] to-[#1d1548] px-6 py-5 text-white">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br from-fuchsia-500/30 via-violet-500/25 to-transparent blur-3xl"
          />
          <DialogHeader className="relative">
            <div className="flex items-center gap-3">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-400 text-white shadow-[0_8px_24px_-8px_rgba(168,85,247,0.6)]">
                <Wand2 className="h-4 w-4" />
                <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[#161235]" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold text-white">
                  Scoping your draft with you
                </DialogTitle>
                <DialogDescription className="text-xs text-white/60">
                  A quick chat so we can draft exactly what you need — not a generic template.
                </DialogDescription>
              </div>
              {finalized && (
                <span className="hidden items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200 sm:inline-flex">
                  <CheckCircle2 className="h-3 w-3" />
                  Ready to draft
                </span>
              )}
              {!finalized && messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleStartOver}
                  disabled={loading}
                  title="Start the interview over"
                  className="hidden items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/70 transition-colors hover:border-white/30 hover:bg-white/[0.08] hover:text-white disabled:opacity-40 sm:inline-flex"
                >
                  <RotateCcw className="h-3 w-3" />
                  Start over
                </button>
              )}
            </div>
            {/* Running-brief strip — always visible once the AI captures anything */}
            <AnimatePresence initial={false}>
              {briefChips.length > 0 && (
                <motion.div
                  key="brief-strip"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-3 flex flex-wrap items-center gap-1.5"
                >
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
                    <ListChecks className="h-3 w-3" />
                    Captured
                  </span>
                  {briefChips.map((c) => (
                    <span
                      key={c.label}
                      className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-white/85 backdrop-blur-sm"
                    >
                      <span className="text-white/50">{c.label}:</span>
                      <span>{c.value}</span>
                    </span>
                  ))}
                  {resumedRef.current && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                      Resumed
                    </span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </DialogHeader>
        </div>

        {/* Chat body */}
        <div
          ref={scrollRef}
          className="max-h-[420px] min-h-[280px] overflow-y-auto bg-slate-50/50 px-5 py-5"
        >
          {/* Original prompt echo */}
          <div className="mx-auto mb-4 max-w-[90%] rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <Sparkles className="h-3 w-3" />
              Your request
            </div>
            <p className="text-[13px] leading-snug text-slate-800">{prompt}</p>
          </div>

          <div className="space-y-3">
            {messages.map((m, i) => {
              const showQuickAnswers =
                m.role === 'assistant' &&
                i === lastAssistantIdx &&
                !finalized &&
                !loading &&
                Array.isArray(m.quickAnswers) &&
                m.quickAnswers.length > 0
              return (
                <div key={i}>
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    {m.role === 'assistant' && (
                      <div className="mr-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-400 text-white">
                        <Wand2 className="h-3 w-3" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px] leading-[1.55]',
                        m.role === 'user'
                          ? 'bg-slate-900 text-white'
                          : 'border border-slate-200 bg-white text-slate-800 shadow-sm',
                      )}
                    >
                      {m.content}
                    </div>
                  </motion.div>
                  {showQuickAnswers && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, delay: 0.08 }}
                      className="ml-8 mt-1.5 flex flex-wrap gap-1.5"
                    >
                      {m.quickAnswers!.map((ans) => (
                        <button
                          key={ans}
                          type="button"
                          onClick={() => void handleSend(ans)}
                          className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-white px-2.5 py-1 text-[11px] font-medium text-violet-700 shadow-sm transition-colors hover:border-violet-400 hover:bg-violet-50 active:bg-violet-100"
                        >
                          {ans}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </div>
              )
            })}

            {loading && (
              <div className="flex justify-start">
                <div className="mr-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-400 text-white">
                  <Wand2 className="h-3 w-3" />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm">
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={thinkingIdx}
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -3 }}
                        transition={{ duration: 0.25 }}
                      >
                        {THINKING_PHRASES[thinkingIdx]}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                </div>
              </div>
            )}

            <AnimatePresence>
              {finalized && (
                <motion.div
                  key="brief"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-fuchsia-50/60 p-4"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-violet-700">
                      <CheckCircle2 className="h-3 w-3" />
                      Interview complete — brief ready
                    </div>
                    <span className="text-[10px] font-medium text-violet-600/80">
                      Click any field to edit
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.entries(finalized) as Array<[keyof InterviewBrief, unknown]>).map(([k, v]) => {
                      if (!v || k === 'enrichedPrompt') return null
                      const value = Array.isArray(v) ? v.join(', ') : String(v)
                      if (!value) return null
                      const isEditing = editingField === k
                      if (isEditing) {
                        return (
                          <span
                            key={k as string}
                            className="inline-flex items-center gap-1 rounded-full border border-violet-400 bg-white px-2 py-0.5 text-[11px] font-medium text-violet-900 shadow-sm ring-2 ring-violet-200/60"
                          >
                            <span className="text-violet-500">{k}:</span>
                            <input
                              autoFocus
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  commitEditField()
                                } else if (e.key === 'Escape') {
                                  e.preventDefault()
                                  cancelEditField()
                                }
                              }}
                              onBlur={() => {
                                // Defer so clicking check/x buttons registers first
                                setTimeout(() => {
                                  if (editingField === k) commitEditField()
                                }, 80)
                              }}
                              className="min-w-[6rem] border-none bg-transparent p-0 text-[11px] font-medium text-violet-900 outline-none"
                              style={{ width: `${Math.max(editingValue.length + 1, 8)}ch` }}
                            />
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={commitEditField}
                              title="Save"
                              className="ml-0.5 rounded-full text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={cancelEditField}
                              title="Cancel"
                              className="rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        )
                      }
                      return (
                        <button
                          key={k as string}
                          type="button"
                          onClick={() => beginEditField(k, v)}
                          title={`Edit ${k}`}
                          className="group inline-flex items-center gap-1 rounded-full border border-violet-200 bg-white px-2 py-0.5 text-[11px] font-medium text-violet-800 transition-all hover:border-violet-400 hover:bg-violet-50"
                        >
                          <span className="text-violet-500">{k}:</span> {value}
                          <Pencil className="h-2.5 w-2.5 text-violet-400 opacity-0 transition-opacity group-hover:opacity-100" />
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {error && errorCode === 'CONTENT_FILTERED' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12px] text-amber-900">
                <div className="flex items-start gap-2">
                  <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <div className="flex-1 space-y-1.5">
                    <p className="font-medium">Let&apos;s rephrase that request</p>
                    <p className="text-amber-800/90">
                      You didn&apos;t do anything wrong. A phrase in your request may have been misread by our AI
                      safety filter, usually because of industry jargon. Try neutral wording:
                    </p>
                    <ul className="ml-3 list-disc space-y-0.5 text-amber-800/90">
                      <li><span className="font-medium">body lease / body shopping</span> → consultant secondment, staff augmentation</li>
                      <li><span className="font-medium">kill fee</span> → early-termination fee</li>
                      <li><span className="font-medium">hit list / target</span> → shortlist, objective</li>
                    </ul>
                    <p className="pt-1 text-amber-800/80">
                      Edit your request below and press <span className="font-medium">Send</span>, or skip the
                      interview to draft with what we already have.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {error && errorCode !== 'CONTENT_FILTERED' && (
              <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12px] text-rose-800">
                <span className="flex-1">{error}</span>
                <button
                  type="button"
                  onClick={() => void handleRetry()}
                  disabled={loading}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-rose-300 bg-white px-2.5 py-1 text-[11px] font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
                >
                  <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
                  Retry
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Input bar */}
        <div className="border-t border-slate-200 bg-white px-5 py-4">
          {finalized ? (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setFinalized(null)
                  setInput('')
                  inputRef.current?.focus()
                }}
                className="text-[12px] font-medium text-slate-500 hover:text-slate-800"
              >
                Add more context
              </button>
              <Button
                size="sm"
                onClick={handleGenerateFromBrief}
                className="gap-1.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400 text-white hover:brightness-110"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Draft the contract now
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Mid-interview CTA: show once the AI has captured enough fields.
                  Gives the user an explicit way to stop answering and go draft. */}
              <AnimatePresence>
                {canDraftNow && (
                  <motion.div
                    key="draft-now"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-fuchsia-50 px-3 py-2"
                  >
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-violet-700">
                      <Sparkles className="h-3 w-3" />
                      Got enough to draft — or keep answering for a sharper fit.
                    </span>
                    <button
                      type="button"
                      onClick={handleDraftWithWhatWeHave}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400 px-3 py-1 text-[11px] font-semibold text-white shadow-sm transition-all hover:brightness-110"
                    >
                      Draft with this
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex items-end gap-2">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void handleSend()
                    }
                  }}
                  placeholder={loading ? 'Waiting for the AI…' : 'Reply to the AI…'}
                  rows={2}
                  disabled={loading}
                  className="min-h-[44px] resize-none"
                />
                <Button
                  size="sm"
                  onClick={() => void handleSend()}
                  disabled={!input.trim() || loading}
                  className="gap-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400 text-white hover:brightness-110"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send
                </Button>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <CornerDownLeft className="h-3 w-3" />
                  Enter to send · Shift+Enter for newline
                </span>
                <button
                  type="button"
                  onClick={handleSkip}
                  className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-slate-800"
                >
                  <SkipForward className="h-3 w-3" />
                  Skip & draft with what we have
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default DraftInterviewChat
