'use client'

/**
 * DraftClarifyDialog
 * ----------------------------------------------------------------------------
 * After the user types a prompt on the drafting landing and clicks Generate,
 * we briefly intercept the flow to ask 4–7 smart, targeted questions that fill
 * the most important gaps (counterparty, role, term, governing law, liability
 * cap, payment terms, tone). The user can answer in seconds — every question
 * has both quick-pick options AND a freeform field — and we then hand off to
 * the existing AgenticDraftDialog with an enriched prompt that combines their
 * original ask + the clarifications.
 *
 * Questions are chosen DYNAMICALLY based on what the prompt analyzer already
 * detected, so the user is never asked something they already said.
 */

import React, { useMemo, useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { Sparkles, Wand2, ArrowRight, Check, SkipForward } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DraftClarifyDetected {
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

export interface DraftClarifyAnswers {
  contractType?: string
  ourRole?: 'buyer' | 'seller' | 'mutual' | 'employer' | 'employee' | 'other'
  counterparty?: string
  term?: string
  renewal?: string
  governingLaw?: string
  liabilityCap?: string
  paymentTerms?: string
  confidentiality?: string
  tone?: 'formal' | 'standard' | 'plain-english'
  extra?: string
}

interface ClarifyQuestion {
  key: keyof DraftClarifyAnswers
  label: string
  hint?: string
  placeholder?: string
  options: string[]
  required?: boolean
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  prompt: string
  detected: DraftClarifyDetected
  onComplete: (enrichedPrompt: string, answers: DraftClarifyAnswers) => void
}

// ---------------------------------------------------------------------------
// Question catalog
// ---------------------------------------------------------------------------

const ALL_QUESTIONS: ClarifyQuestion[] = [
  {
    key: 'contractType',
    label: 'What kind of contract is this?',
    hint: 'Pick the closest match — we will tailor the structure and clauses.',
    placeholder: 'e.g. Master Services Agreement',
    options: ['NDA', 'MSA', 'SOW', 'SaaS Subscription', 'DPA', 'Employment', 'Consulting', 'License', 'Reseller'],
    required: true,
  },
  {
    key: 'ourRole',
    label: 'Which side are we drafting for?',
    hint: 'Drives the bias of the language — buy-side, sell-side, or balanced.',
    options: ['buyer', 'seller', 'mutual', 'employer', 'employee', 'other'],
    required: true,
  },
  {
    key: 'counterparty',
    label: 'Who is the counterparty?',
    hint: 'Name of the other party — leave blank if not yet known.',
    placeholder: 'e.g. Globex Ltd',
    options: [],
  },
  {
    key: 'term',
    label: 'How long should it run?',
    placeholder: 'e.g. 24 months',
    options: ['12 months', '24 months', '3 years', '5 years', 'Indefinite'],
  },
  {
    key: 'renewal',
    label: 'Renewal behavior?',
    options: ['Auto-renew (12 months)', 'Auto-renew (annual)', 'No auto-renew', 'Renew on mutual agreement'],
  },
  {
    key: 'governingLaw',
    label: 'Governing law / jurisdiction?',
    placeholder: 'e.g. Switzerland · Zurich',
    options: ['Switzerland', 'England & Wales', 'Delaware', 'New York', 'California', 'Germany', 'France', 'Singapore'],
  },
  {
    key: 'liabilityCap',
    label: 'Liability cap?',
    placeholder: 'e.g. CHF 250,000',
    options: ['12 months fees', '2x annual fees', 'CHF 250,000', '$1,000,000', 'Uncapped (we strongly advise against)'],
  },
  {
    key: 'paymentTerms',
    label: 'Payment terms?',
    options: ['Net 30', 'Net 45', 'Net 60', 'Upfront annual', 'Monthly in advance', 'Milestone-based'],
  },
  {
    key: 'confidentiality',
    label: 'Confidentiality obligations?',
    options: ['Mutual · 3 years', 'Mutual · 5 years', 'One-way (we are receiving)', 'One-way (we are disclosing)', 'Perpetual for trade secrets'],
  },
  {
    key: 'tone',
    label: 'Tone of voice?',
    options: ['formal', 'standard', 'plain-english'],
  },
]

// ---------------------------------------------------------------------------
// Pick which questions to ask based on detected signals
// ---------------------------------------------------------------------------

function selectQuestions(detected: DraftClarifyDetected): ClarifyQuestion[] {
  const skipKeys = new Set<keyof DraftClarifyAnswers>()
  if (detected.contractType) skipKeys.add('contractType')
  if (detected.term) skipKeys.add('term')
  if (detected.governingLaw) skipKeys.add('governingLaw')
  if (detected.cap) skipKeys.add('liabilityCap')
  if (detected.paymentTerms) skipKeys.add('paymentTerms')
  if (detected.renewal) skipKeys.add('renewal')
  if (detected.partyB || detected.partyA) skipKeys.add('counterparty')

  // Always ask role + tone (cheap, high-value), plus everything not detected.
  const filtered = ALL_QUESTIONS.filter(
    (q) => q.key === 'ourRole' || q.key === 'tone' || !skipKeys.has(q.key),
  )
  // Cap at 7 — keep it fast.
  return filtered.slice(0, 7)
}

// ---------------------------------------------------------------------------
// Build enriched prompt
// ---------------------------------------------------------------------------

function buildEnrichedPrompt(
  original: string,
  answers: DraftClarifyAnswers,
  detected: DraftClarifyDetected,
): string {
  const lines: string[] = []
  lines.push(original.trim())
  lines.push('')
  lines.push('--- Drafting brief ---')
  if (answers.contractType || detected.contractType) {
    lines.push(`Contract type: ${answers.contractType || detected.contractType}`)
  }
  if (answers.ourRole) {
    lines.push(`We are drafting for the: ${answers.ourRole}`)
  }
  if (answers.counterparty) {
    lines.push(`Counterparty: ${answers.counterparty}`)
  } else if (detected.partyA || detected.partyB) {
    lines.push(`Parties: ${[detected.partyA, detected.partyB].filter(Boolean).join(' and ')}`)
  }
  if (answers.term || detected.term) {
    lines.push(`Term: ${answers.term || detected.term}`)
  }
  if (answers.renewal || detected.renewal) {
    lines.push(`Renewal: ${answers.renewal || detected.renewal}`)
  }
  if (answers.governingLaw || detected.governingLaw) {
    lines.push(`Governing law: ${answers.governingLaw || detected.governingLaw}`)
  }
  if (answers.liabilityCap || detected.cap) {
    lines.push(`Liability cap: ${answers.liabilityCap || detected.cap}`)
  }
  if (answers.paymentTerms || detected.paymentTerms) {
    lines.push(`Payment terms: ${answers.paymentTerms || detected.paymentTerms}`)
  }
  if (answers.confidentiality) {
    lines.push(`Confidentiality: ${answers.confidentiality}`)
  }
  if (detected.notice) {
    lines.push(`Notice period: ${detected.notice}`)
  }
  if (detected.clauses.length > 0) {
    lines.push(`Required clauses: ${detected.clauses.join(', ')}`)
  }
  if (answers.tone) {
    lines.push(`Tone: ${answers.tone}`)
  }
  if (answers.extra && answers.extra.trim()) {
    lines.push('')
    lines.push('Additional notes from the user:')
    lines.push(answers.extra.trim())
  }
  lines.push('')
  lines.push('Use the values above verbatim wherever they apply. Do NOT leave [___] placeholders for any field already specified above. If a value is not specified, fill with a reasonable default and mark with [TBD].')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DraftClarifyDialog({ open, onOpenChange, prompt, detected, onComplete }: Props) {
  const questions = useMemo(() => selectQuestions(detected), [detected])
  const [answers, setAnswers] = useState<DraftClarifyAnswers>({})
  const [extra, setExtra] = useState('')
  const [stepIdx, setStepIdx] = useState(0)

  // Reset whenever the dialog re-opens
  useEffect(() => {
    if (open) {
      setAnswers({})
      setExtra('')
      setStepIdx(0)
    }
  }, [open])

  const totalSteps = questions.length + 1 // +1 for the final review
  const isReviewStep = stepIdx === questions.length
  const currentQ = !isReviewStep ? questions[stepIdx] : null

  const setAnswer = (key: keyof DraftClarifyAnswers, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value as never }))
  }

  const handleNext = () => {
    if (stepIdx < totalSteps - 1) setStepIdx(stepIdx + 1)
  }
  const handleBack = () => {
    if (stepIdx > 0) setStepIdx(stepIdx - 1)
  }

  const handleSubmit = () => {
    const enriched = buildEnrichedPrompt(prompt, { ...answers, extra }, detected)
    onComplete(enriched, { ...answers, extra })
  }

  const skipAll = () => {
    const enriched = buildEnrichedPrompt(prompt, { ...answers, extra }, detected)
    onComplete(enriched, { ...answers, extra })
  }

  const progressPct = Math.round(((stepIdx + 1) / totalSteps) * 100)

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
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-400 text-white shadow-[0_8px_24px_-8px_rgba(168,85,247,0.6)]">
                <Wand2 className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold text-white">
                  A few quick questions
                </DialogTitle>
                <DialogDescription className="text-xs text-white/60">
                  So Contigo drafts exactly the contract you need — not a generic template.
                </DialogDescription>
              </div>
              <span className="hidden text-[11px] font-medium text-white/50 sm:block">
                {Math.min(stepIdx + 1, totalSteps)} / {totalSteps}
              </span>
            </div>
            {/* Progress bar */}
            <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-amber-300"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          {/* Original prompt echo */}
          <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <Sparkles className="h-3 w-3" />
              Your request
            </div>
            <p className="line-clamp-2 text-[13px] leading-snug text-slate-700">{prompt}</p>
          </div>

          <AnimatePresence mode="wait">
            {currentQ && (
              <motion.div
                key={currentQ.key}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
              >
                <h3 className="text-[15px] font-semibold text-slate-900">{currentQ.label}</h3>
                {currentQ.hint && (
                  <p className="mt-1 text-[12px] text-slate-500">{currentQ.hint}</p>
                )}

                {currentQ.options.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {currentQ.options.map((opt) => {
                      const selected = answers[currentQ.key] === opt
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setAnswer(currentQ.key, opt)}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all',
                            selected
                              ? 'border-violet-400 bg-violet-50 text-violet-800 shadow-[0_4px_12px_-4px_rgba(139,92,246,0.45)]'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-violet-300 hover:bg-violet-50/50',
                          )}
                        >
                          {selected && <Check className="h-3 w-3" />}
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                )}

                {currentQ.placeholder && (
                  <Input
                    value={(answers[currentQ.key] as string) || ''}
                    onChange={(e) => setAnswer(currentQ.key, e.target.value)}
                    placeholder={currentQ.placeholder}
                    className="mt-3"
                  />
                )}
              </motion.div>
            )}

            {isReviewStep && (
              <motion.div
                key="review"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
              >
                <h3 className="text-[15px] font-semibold text-slate-900">
                  Anything else we should know?
                </h3>
                <p className="mt-1 text-[12px] text-slate-500">
                  Optional — special clauses, unusual terms, internal context, or specific instructions.
                </p>
                <Textarea
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  placeholder="e.g. We need an exclusivity carve-out for our APAC subsidiaries; counterparty insisted on Singapore arbitration."
                  className="mt-3 min-h-[110px]"
                />

                {/* Summary card */}
                <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/40 p-3">
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-violet-700">
                    Brief summary
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(answers).map(([k, v]) =>
                      v ? (
                        <span
                          key={k}
                          className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-white px-2 py-0.5 text-[11px] font-medium text-violet-800"
                        >
                          <span className="text-violet-500">{k}:</span> {String(v)}
                        </span>
                      ) : null,
                    )}
                    {(detected.contractType || detected.term || detected.governingLaw || detected.cap) && (
                      <>
                        {detected.contractType && !answers.contractType && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700">
                            type: {detected.contractType}
                          </span>
                        )}
                        {detected.term && !answers.term && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700">
                            term: {detected.term}
                          </span>
                        )}
                        {detected.governingLaw && !answers.governingLaw && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700">
                            law: {detected.governingLaw}
                          </span>
                        )}
                        {detected.cap && !answers.liabilityCap && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700">
                            cap: {detected.cap}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-6 py-4">
          <button
            type="button"
            onClick={skipAll}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500 hover:text-slate-800"
          >
            <SkipForward className="h-3.5 w-3.5" />
            Skip & generate now
          </button>
          <div className="flex items-center gap-2">
            {stepIdx > 0 && (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                Back
              </Button>
            )}
            {!isReviewStep ? (
              <Button
                size="sm"
                onClick={handleNext}
                className="gap-1.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400 text-white hover:brightness-110"
              >
                Next
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleSubmit}
                className="gap-1.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400 text-white hover:brightness-110"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Generate draft
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default DraftClarifyDialog
