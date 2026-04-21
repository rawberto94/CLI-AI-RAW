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

import React, { useState, useEffect, useRef, useCallback } from 'react'
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
// Component
// ---------------------------------------------------------------------------

export function DraftInterviewChat({ open, onOpenChange, prompt, detected, onComplete }: Props) {
  const [messages, setMessages] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [finalized, setFinalized] = useState<InterviewBrief | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const initFiredRef = useRef(false)

  // Reset on (re-)open
  useEffect(() => {
    if (open) {
      setMessages([])
      setInput('')
      setFinalized(null)
      setError(null)
      initFiredRef.current = false
    }
  }, [open])

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

  const callInterview = useCallback(
    async (history: ChatTurn[]) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/ai/agents/draft-interview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': getCsrfToken(),
          },
          credentials: 'same-origin',
          body: JSON.stringify({
            messages: history,
            originalPrompt: prompt,
            detected,
          }),
        })
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}))
          throw new Error(errBody?.error?.message || errBody?.message || `HTTP ${res.status}`)
        }
        const body = await res.json()
        const data = body?.data ?? body
        const assistantContent: string = data.content || 'Could you tell me a bit more?'
        setMessages((prev) => [...prev, { role: 'assistant', content: assistantContent }])
        if (data.finalized && data.brief?.enrichedPrompt) {
          setFinalized(data.brief)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'AI is temporarily unavailable')
      } finally {
        setLoading(false)
      }
    },
    [prompt, detected],
  )

  // Kick off the AI's opening question as soon as the dialog opens
  useEffect(() => {
    if (!open) return
    if (initFiredRef.current) return
    if (!prompt.trim()) return
    initFiredRef.current = true
    void callInterview([])
  }, [open, prompt, callInterview])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || loading || finalized) return
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    setInput('')
    await callInterview(next)
  }, [input, loading, finalized, messages, callInterview])

  const handleSkip = useCallback(() => {
    // Synthesise a brief from what we have without calling the AI again.
    if (finalized?.enrichedPrompt) {
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
    onComplete(lines.join('\n'), { enrichedPrompt: lines.join('\n') })
  }, [finalized, prompt, detected, messages, onComplete])

  const handleGenerateFromBrief = useCallback(() => {
    if (finalized?.enrichedPrompt) {
      onComplete(finalized.enrichedPrompt, finalized)
    }
  }, [finalized, onComplete])

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
            </div>
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
            {messages.map((m, i) => (
              <motion.div
                key={i}
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
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="mr-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-400 text-white">
                  <Wand2 className="h-3 w-3" />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm">
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Thinking…
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
                  <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-violet-700">
                    <CheckCircle2 className="h-3 w-3" />
                    Interview complete — brief ready
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(finalized).map(([k, v]) => {
                      if (!v || k === 'enrichedPrompt') return null
                      const value = Array.isArray(v) ? v.join(', ') : String(v)
                      if (!value) return null
                      return (
                        <span
                          key={k}
                          className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-white px-2 py-0.5 text-[11px] font-medium text-violet-800"
                        >
                          <span className="text-violet-500">{k}:</span> {value}
                        </span>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-[12px] text-rose-800">
                {error}
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
