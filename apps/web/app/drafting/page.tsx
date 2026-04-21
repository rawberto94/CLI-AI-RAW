'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { PageBreadcrumb } from '@/components/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { useTemplates } from '@/hooks/use-queries'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'
import { sanitizeHtml } from '@/lib/security/sanitize'
import { DRAFTING_QUICK_STARTS } from '@/lib/drafting/quick-starts'
import { toast } from 'sonner'
import {
  FileText,
  Plus,
  Sparkles,
  Wand2,
  Clock,
  Search,
  ArrowRight,
  Edit3,
  Trash2,
  Copy,
  MoreHorizontal,
  BookOpen,
  LayoutTemplate,
  Download,
  Link2,
  CornerDownLeft,
  Command as CommandIcon,
  Zap,
  Activity,
  History,
  Paperclip,
  ChevronRight,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { AgenticDraftDialog } from '@/components/drafting/AgenticDraftDialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ============================================================================
// Types
// ============================================================================

interface Draft {
  id: string
  title: string
  content?: string
  status: string
  type?: string
  sourceType?: string
  createdAt: string
  updatedAt: string
  template?: { id: string; name: string; category?: string } | null
  sourceContract?: { id: string; contractTitle?: string | null; supplierName?: string | null } | null
  playbook?: { id: string; name: string; isDefault?: boolean } | null
  createdByUser?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null
}

interface Template {
  id: string
  name: string
  description?: string
  category?: string
  status: string
  usageCount?: number
  createdAt: string
  updatedAt?: string
}

// ============================================================================
// Constants
// ============================================================================

// ============================================================================
// Sub-components
// ============================================================================

function DraftCard({
  draft,
  onDelete,
  onDuplicate,
  onExport,
}: {
  draft: Draft
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onExport: (id: string, format: 'pdf' | 'docx' | 'json') => void
}) {
  const router = useRouter()
  const updatedDate = new Date(draft.updatedAt)
  const diffMs = Date.now() - updatedDate.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  let timeAgo = 'Just now'
  if (diffDays > 0) timeAgo = `${diffDays}d ago`
  else if (diffHours > 0) timeAgo = `${diffHours}h ago`
  else if (diffMins > 0) timeAgo = `${diffMins}m ago`

  // Fresh edit within 10 minutes → live pulse dot.
  const isLive = diffMs < 10 * 60_000

  const statusStyles: Record<string, { dot: string; label: string; text: string }> = {
    DRAFT:            { dot: 'bg-slate-400',   label: 'Draft',            text: 'text-slate-600' },
    IN_PROGRESS:     { dot: 'bg-blue-500',    label: 'In Progress',      text: 'text-blue-700' },
    IN_REVIEW:       { dot: 'bg-amber-500',   label: 'In Review',        text: 'text-amber-700' },
    PENDING_APPROVAL: { dot: 'bg-amber-500',   label: 'Pending Approval', text: 'text-amber-700' },
    APPROVED:        { dot: 'bg-emerald-500', label: 'Approved',         text: 'text-emerald-700' },
    REJECTED:        { dot: 'bg-rose-500',    label: 'Rejected',         text: 'text-rose-700' },
    FINALIZED:       { dot: 'bg-violet-500',  label: 'Finalized',        text: 'text-violet-700' },
    COMPLETED:       { dot: 'bg-emerald-500', label: 'Completed',        text: 'text-emerald-700' },
  }
  const status = statusStyles[draft.status] || statusStyles.DRAFT

  const sourceTypeLabel =
    draft.sourceType === 'RENEWAL'
      ? 'Renewal'
      : draft.sourceType === 'AMENDMENT'
        ? 'Amendment'
        : null

  const counterparty =
    draft.sourceContract?.supplierName ||
    draft.sourceContract?.contractTitle ||
    null

  const ownerInitials = (() => {
    const u = draft.createdByUser
    if (!u) return null
    const first = (u.firstName || '').trim()
    const last = (u.lastName || '').trim()
    if (first || last) return `${first[0] || ''}${last[0] || ''}`.toUpperCase()
    const email = u.email || ''
    return email ? email.slice(0, 2).toUpperCase() : null
  })()

  const templateLabel = draft.template?.name || null
  const categoryLabel = draft.template?.category || null
  const playbookLabel = draft.playbook?.name || null

  const resolvedTitle =
    draft.title && draft.title.trim() && !/^untitled/i.test(draft.title.trim())
      ? draft.title
      : templateLabel || sourceTypeLabel || 'Untitled draft'

  // Strip HTML → text snippet for the live preview.
  const previewText = useMemo(() => {
    if (!draft.content) return ''
    const txt = draft.content
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return txt.length > 180 ? txt.slice(0, 180) + '…' : txt
  }, [draft.content])

  // Approximate word count → progress ring fill.
  const wordCount = useMemo(() => {
    if (!previewText && !draft.content) return 0
    const plain = (draft.content || '')
      .replace(/<[^>]+>/g, ' ')
      .trim()
    if (!plain) return 0
    return plain.split(/\s+/).length
  }, [draft.content, previewText])
  const fillPct = Math.min(100, Math.round((wordCount / 1200) * 100))

  return (
    <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.15 }}>
      <Card className="group relative cursor-pointer overflow-hidden rounded-[20px] border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:border-slate-300 hover:shadow-[0_20px_40px_-20px_rgba(15,23,42,0.25)]">
        {/* Accent top line — switches colour on status */}
        <div className={cn('h-[3px] w-full', {
          'bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400': draft.status === 'FINALIZED',
          'bg-gradient-to-r from-emerald-400 to-teal-400': draft.status === 'APPROVED' || draft.status === 'COMPLETED',
          'bg-gradient-to-r from-amber-400 to-orange-400': draft.status === 'IN_REVIEW' || draft.status === 'PENDING_APPROVAL',
          'bg-gradient-to-r from-blue-400 to-indigo-400': draft.status === 'IN_PROGRESS',
          'bg-gradient-to-r from-slate-200 to-slate-300': !['FINALIZED','APPROVED','COMPLETED','IN_REVIEW','PENDING_APPROVAL','IN_PROGRESS'].includes(draft.status),
        })} />
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <button
              type="button"
              className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 text-slate-700 transition-all group-hover:from-violet-50 group-hover:to-fuchsia-50 group-hover:text-violet-700"
              onClick={() => router.push(`/drafting/copilot?draft=${draft.id}`)}
              aria-label={`Open ${resolvedTitle}`}
            >
              <FileText className="h-[18px] w-[18px]" />
              {isLive && (
                <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                </span>
              )}
            </button>

            <div
              className="min-w-0 flex-1"
              onClick={() => router.push(`/drafting/copilot?draft=${draft.id}`)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="truncate text-[15px] font-semibold leading-tight text-slate-950">
                      {resolvedTitle}
                    </h3>
                    {sourceTypeLabel && (
                      <Badge className="shrink-0 border-0 bg-violet-100 px-1.5 py-0 text-[10px] font-medium text-violet-700">
                        {sourceTypeLabel}
                      </Badge>
                    )}
                  </div>
                  {(templateLabel || counterparty) && (
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                      {templateLabel}
                      {templateLabel && counterparty ? ' · ' : ''}
                      {counterparty}
                    </p>
                  )}
                </div>
                <span className={cn('shrink-0 inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium', status.text)}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
                  {status.label}
                </span>
              </div>

              {/* Live preview snippet (editorial serif feel) */}
              {previewText ? (
                <p className="mt-3 line-clamp-2 text-[12.5px] leading-[1.55] text-slate-600">
                  {previewText}
                </p>
              ) : (
                <p className="mt-3 text-[12.5px] italic leading-[1.55] text-slate-400">
                  Empty draft — start writing or ask the AI to scaffold it.
                </p>
              )}

              {/* Progress line + meta row */}
              <div className="mt-4">
                <div className="flex h-1 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', {
                      'bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400': fillPct >= 100,
                      'bg-gradient-to-r from-violet-400 to-fuchsia-400': fillPct < 100 && fillPct > 0,
                      'bg-slate-200': fillPct === 0,
                    })}
                    style={{ width: `${Math.max(fillPct, 4)}%` }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {timeAgo}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="tabular-nums">{wordCount.toLocaleString()} words</span>
                  {categoryLabel && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="truncate">{categoryLabel}</span>
                    </>
                  )}
                  {playbookLabel && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                        <Zap className="h-2.5 w-2.5" />
                        {playbookLabel}
                      </span>
                    </>
                  )}
                  {ownerInitials && (
                    <span className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[9px] font-semibold text-white" aria-label={
                      draft.createdByUser
                        ? `Owner ${draft.createdByUser.firstName || ''} ${draft.createdByUser.lastName || ''}`.trim() ||
                          draft.createdByUser.email ||
                          undefined
                        : undefined
                    }>
                      {ownerInitials}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="shrink-0 -mr-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem
                    onClick={() => router.push(`/drafting/copilot?draft=${draft.id}`)}
                    className="gap-2 cursor-pointer"
                  >
                    <Edit3 className="h-3.5 w-3.5" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDuplicate(draft.id)}
                    className="gap-2 cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" /> Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      try {
                        const url = `${window.location.origin}/drafting/copilot?draft=${draft.id}`
                        await navigator.clipboard.writeText(url)
                        toast.success('Link copied')
                      } catch {
                        toast.error('Could not copy link')
                      }
                    }}
                    className="gap-2 cursor-pointer"
                  >
                    <Link2 className="h-3.5 w-3.5" /> Copy link
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onExport(draft.id, 'pdf')}
                    className="gap-2 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" /> Export PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onExport(draft.id, 'docx')}
                    className="gap-2 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" /> Export DOCX
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(draft.id)}
                    className="gap-2 cursor-pointer text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Reveal "Open" affordance on hover */}
          <div className="pointer-events-none mt-3 flex items-center justify-end text-[11px] font-medium text-violet-600 opacity-0 transition-opacity group-hover:opacity-100">
            Open
            <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function TemplateQuickCard({
  template,
  onClick,
  onPreview,
}: {
  template: Template
  onClick: () => void
  onPreview: () => void
}) {
  const categoryMeta: Record<string, { icon: string; accent: string; tint: string; text: string }> = {
    Technology:  { icon: '💻', accent: 'from-blue-500 to-cyan-400',    tint: 'from-blue-50 to-cyan-50',    text: 'text-blue-700' },
    Services:    { icon: '🛠️', accent: 'from-amber-500 to-orange-400', tint: 'from-amber-50 to-orange-50', text: 'text-amber-700' },
    Legal:       { icon: '⚖️', accent: 'from-violet-500 to-fuchsia-400', tint: 'from-violet-50 to-fuchsia-50', text: 'text-violet-700' },
    HR:          { icon: '👥', accent: 'from-rose-500 to-pink-400',    tint: 'from-rose-50 to-pink-50',    text: 'text-rose-700' },
    Procurement: { icon: '📦', accent: 'from-emerald-500 to-teal-400', tint: 'from-emerald-50 to-teal-50', text: 'text-emerald-700' },
    Finance:     { icon: '💰', accent: 'from-lime-500 to-emerald-400', tint: 'from-lime-50 to-emerald-50', text: 'text-emerald-700' },
    Renewal:     { icon: '🔄', accent: 'from-indigo-500 to-violet-400', tint: 'from-indigo-50 to-violet-50', text: 'text-indigo-700' },
    Default:     { icon: '📄', accent: 'from-slate-400 to-slate-300',  tint: 'from-slate-50 to-slate-100',  text: 'text-slate-700' },
  }
  const meta = categoryMeta[template.category || ''] || categoryMeta.Default
  const uses = template.usageCount ?? 0
  const isTrending = uses >= 10

  return (
    <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.15 }}>
      <Card className="group relative cursor-pointer overflow-hidden rounded-[20px] border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:border-slate-300 hover:shadow-[0_20px_40px_-20px_rgba(15,23,42,0.25)]">
        {/* Category-tinted accent line */}
        <div className={cn('h-[3px] w-full bg-gradient-to-r', meta.accent)} />
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-lg shadow-sm ring-1 ring-white/60', meta.tint)}>
              <span aria-hidden>{meta.icon}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {template.category && (
                  <span className={cn('inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]', meta.text)}>
                    {template.category}
                  </span>
                )}
                {isTrending && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    <Zap className="h-2.5 w-2.5" />
                    Trending
                  </span>
                )}
              </div>
              <h4 className="mt-2 text-[15px] font-semibold leading-tight text-slate-950 line-clamp-2">
                {template.name}
              </h4>
              {template.description ? (
                <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-[1.55] text-slate-600">
                  {template.description}
                </p>
              ) : (
                <p className="mt-1.5 text-[12.5px] italic leading-[1.55] text-slate-400">
                  No description — preview to see the structure.
                </p>
              )}

              {/* Meta row: uses + preview + use */}
              <div className="mt-4 flex items-center gap-2">
                {uses > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[10.5px] text-slate-500">
                    <span className="tabular-nums font-semibold text-slate-700">{uses}</span>
                    use{uses === 1 ? '' : 's'}
                  </span>
                ) : (
                  <span className="text-[10.5px] text-slate-400">New</span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onPreview() }}
                  className="ml-auto text-xs font-medium text-slate-500 transition-colors hover:text-violet-700"
                  title="Preview template"
                >
                  Preview
                </button>
                <Button
                  type="button"
                  size="sm"
                  className={cn(
                    'h-8 gap-1.5 rounded-full px-3 text-xs font-semibold text-white shadow-sm transition-all hover:brightness-110',
                    'bg-gradient-to-r',
                    meta.accent,
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    onClick()
                  }}
                >
                  Use
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}



// ============================================================================
// Main Component
// ============================================================================

const RECENT_PROMPTS_STORAGE_KEY = 'drafting-recent-prompts'
const RECENT_PROMPTS_MAX = 3

// Rotating verbs in the hero headline — sets the tone of the studio.
const HERO_ROTATING_WORDS = ['Draft', 'Negotiate', 'Redline', 'Close'] as const

// Sample "activity ticker" items — what the AI has been doing across the tenant.
// (Purely visual; no network calls — gives the studio a "living" feel.)
const AI_ACTIVITY_TICKER: { icon: string; text: string; tone: string }[] = [
  { icon: '✨', text: 'Generated NDA from prompt', tone: 'text-violet-300' },
  { icon: '⚑', text: 'Flagged 3 risks in MSA v2', tone: 'text-amber-300' },
  { icon: '✓', text: 'Playbook aligned on SOW',   tone: 'text-emerald-300' },
  { icon: '✎', text: 'Suggested 5 redlines',      tone: 'text-fuchsia-300' },
]

export default function DraftingPage() {
  const router = useRouter()
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [draftsLoading, setDraftsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 300)
  const [activeTab, setActiveTab] = useState('drafts')
  const [aiPrompt, setAiPrompt] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [showAgenticDialog, setShowAgenticDialog] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)
  const [previewContent, setPreviewContent] = useState<string>('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [recentPrompts, setRecentPrompts] = useState<string[]>([])
  const [heroWordIndex, setHeroWordIndex] = useState(0)
  const [promptFocused, setPromptFocused] = useState(false)
  const aiPromptInputRef = useRef<HTMLInputElement | null>(null)
  const listSearchInputRef = useRef<HTMLInputElement | null>(null)

  // Rotating headline word — cycles every 2.6s.
  useEffect(() => {
    const id = window.setInterval(() => {
      setHeroWordIndex((i) => (i + 1) % HERO_ROTATING_WORDS.length)
    }, 2600)
    return () => window.clearInterval(id)
  }, [])

  // Load recent prompts once on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(RECENT_PROMPTS_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          setRecentPrompts(
            parsed.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).slice(0, RECENT_PROMPTS_MAX),
          )
        }
      }
    } catch {
      /* ignore storage errors */
    }
  }, [])

  const recordRecentPrompt = useCallback((prompt: string) => {
    const trimmed = prompt.trim()
    if (!trimmed) return
    setRecentPrompts((prev) => {
      const deduped = [trimmed, ...prev.filter((p) => p !== trimmed)].slice(0, RECENT_PROMPTS_MAX)
      try {
        window.localStorage.setItem(RECENT_PROMPTS_STORAGE_KEY, JSON.stringify(deduped))
      } catch {
        /* ignore storage errors */
      }
      return deduped
    })
  }, [])

  // Cmd/Ctrl+K focuses the AI prompt field — anywhere on /drafting.
  // Uses capture phase + stopImmediatePropagation so the global command-palette
  // shortcut doesn't steal it on this route.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        const target = e.target as HTMLElement | null
        // Let the user's own Cmd+K inside a textarea pass through (rare); otherwise intercept.
        if (target?.tagName === 'TEXTAREA') return
        e.preventDefault()
        e.stopImmediatePropagation()
        aiPromptInputRef.current?.focus()
        aiPromptInputRef.current?.select()
      }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [])

  // "/" focuses the list search (drafts/templates); Escape clears it when it's focused.
  // Capture phase + stopImmediatePropagation so the global "/" → /search shortcut
  // doesn't navigate away while the user is on the drafting studio.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const isEditable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (target as HTMLElement | null)?.isContentEditable
      if (e.key === '/' && !isEditable && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (listSearchInputRef.current) {
          e.preventDefault()
          e.stopImmediatePropagation()
          listSearchInputRef.current.focus()
          listSearchInputRef.current.select()
        }
        return
      }
      if (
        e.key === 'Escape' &&
        target === listSearchInputRef.current &&
        listSearchInputRef.current
      ) {
        if (listSearchInputRef.current.value) {
          e.preventDefault()
          setSearchQuery('')
        } else {
          listSearchInputRef.current.blur()
        }
      }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [])
  const { data: templatesData, isLoading: templatesLoading } = useTemplates()
  const templates: Template[] = useMemo(() => {
    if (!templatesData?.templates) return []
    return (templatesData.templates as Template[])
      .filter((t) => t.status === 'active')
      .slice(0, 12)
  }, [templatesData])

  // Total active templates (used for the hero stat — `templates` is sliced to 12)
  const templatesTotal = useMemo(() => {
    if (!templatesData?.templates) return 0
    return (templatesData.templates as Template[]).filter((t) => t.status === 'active').length
  }, [templatesData])

  // Fetch drafts with server-side filtering
  const fetchDrafts = useCallback(async () => {
    try {
      setDraftsLoading(true)
      const params = new URLSearchParams({ limit: '50', sortBy: 'updatedAt', sortOrder: 'desc' })
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/drafts?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setDrafts(data.data?.drafts || [])
      }
    } catch (err) {
      console.error('Failed to load drafts:', err)
      toast.error('Failed to load drafts')
    } finally {
      setDraftsLoading(false)
    }
  }, [debouncedSearch, statusFilter])

  useEffect(() => {
    fetchDrafts()
  }, [fetchDrafts])

  // Derived data — server already filters by search/status/date
  const recentDrafts = useMemo(() => drafts, [drafts])

  const filteredTemplates = useMemo(() => {
    if (!debouncedSearch) return templates
    const q = debouncedSearch.toLowerCase()
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q),
    )
  }, [templates, debouncedSearch])

  // Handlers
  const handleDeleteDraft = useCallback(async (id: string) => {
    // Snapshot the draft so we can offer a one-click Undo after a successful delete.
    const deleted = drafts.find((d) => d.id === id)
    // Optimistic removal
    setDrafts((prev) => prev.filter((d) => d.id !== id))

    try {
      const res = await fetch(`/api/drafts/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        // Rollback
        if (deleted) setDrafts((prev) => [deleted, ...prev])
        toast.error('Failed to delete draft')
        return
      }

      const restoreDraft = async () => {
        if (!deleted) return
        try {
          const restoreRes = await fetch('/api/drafts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: deleted.title || 'Restored draft',
              type: deleted.type || 'MSA',
              sourceType: deleted.sourceType || 'NEW',
              content: deleted.content || '',
              templateId: deleted.template?.id || null,
              playbookId: deleted.playbook?.id || null,
              sourceContractId: deleted.sourceContract?.id || null,
            }),
          })
          if (restoreRes.ok) {
            toast.success('Draft restored')
            fetchDrafts()
          } else {
            toast.error('Could not restore draft')
          }
        } catch {
          toast.error('Could not restore draft')
        }
      }

      toast.success('Draft deleted', {
        action: deleted
          ? {
              label: 'Undo',
              onClick: () => {
                void restoreDraft()
              },
            }
          : undefined,
        duration: 6000,
      })
    } catch {
      if (deleted) setDrafts((prev) => [deleted, ...prev])
      toast.error('Failed to delete draft')
    }
  }, [drafts, fetchDrafts])

  const handleDuplicateDraft = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/drafts/${id}/duplicate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
        if (res.ok) {
          toast.success('Draft duplicated')
          fetchDrafts()
        } else {
          toast.error('Failed to duplicate draft')
        }
      } catch {
        toast.error('Failed to duplicate draft')
      }
    },
    [fetchDrafts],
  )

  const handleExportDraft = useCallback(
    async (id: string, format: 'pdf' | 'docx' | 'json') => {
      try {
        const res = await fetch(`/api/drafts/${id}/export?format=${format}`)
        if (!res.ok) {
          toast.error('Failed to export draft')
          return
        }
        const blob = await res.blob()
        const disposition = res.headers.get('Content-Disposition') || ''
        const filenameMatch = disposition.match(/filename="(.+?)"/)
        const filename = filenameMatch?.[1] || `draft.${format}`
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success(`Draft exported as ${format.toUpperCase()}`)
      } catch {
        toast.error('Failed to export draft')
      }
    },
    [],
  )

  const handleAIGenerate = useCallback(
    (overridePrompt?: string) => {
      const prompt = (overridePrompt ?? aiPrompt).trim()
      if (!prompt) {
        toast.error('Please describe what you want to draft')
        return
      }
      if (overridePrompt !== undefined) {
        setAiPrompt(overridePrompt)
      }
      recordRecentPrompt(prompt)
      setShowAgenticDialog(true)
    },
    [aiPrompt, recordRecentPrompt],
  )

  const handleTemplateUse = useCallback(
    (template: Template, quickStartType?: string) => {
      const params = new URLSearchParams({
        template: template.id,
        name: template.name,
      })

      if (quickStartType) {
        params.set('type', quickStartType)
      }

      router.push(`/drafting/copilot?${params.toString()}`)
    },
    [router],
  )

  const handleTemplatePreview = useCallback(async (template: Template) => {
    setPreviewTemplate(template)
    setPreviewContent('')
    setPreviewLoading(true)
    try {
      const res = await fetch(`/api/templates/${template.id}`)
      if (res.ok) {
        const data = await res.json()
        const tpl = data?.data?.template || data?.template || data
        setPreviewContent(tpl?.content || tpl?.baseContent || 'No content available')
      }
    } catch {
      setPreviewContent('Failed to load template content')
    } finally {
      setPreviewLoading(false)
    }
  }, [])

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="min-h-screen bg-[#f6f4ef]">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 px-6 py-3 backdrop-blur-xl sm:px-8 lg:px-10">
        <div className="max-w-[1600px] mx-auto">
          <PageBreadcrumb />
        </div>
      </div>

      <div className="mx-auto max-w-[1480px] space-y-8 px-6 py-8 sm:px-8 lg:px-10">
        {/* ============ HERO — dark editorial spotlight ============ */}
        <motion.section
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[32px] border border-slate-900/10 bg-gradient-to-br from-[#0b0a1a] via-[#161235] to-[#1d1548] text-white shadow-[0_30px_80px_-30px_rgba(29,21,72,0.55)]"
        >
          {/* subtle grid + glow backdrop */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)',
              backgroundSize: '44px 44px',
              maskImage: 'radial-gradient(ellipse at 30% 20%, black 40%, transparent 75%)',
              WebkitMaskImage: 'radial-gradient(ellipse at 30% 20%, black 40%, transparent 75%)',
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-gradient-to-br from-fuchsia-500/30 via-violet-500/25 to-transparent blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 left-1/3 h-80 w-80 rounded-full bg-gradient-to-br from-amber-400/20 via-rose-500/15 to-transparent blur-3xl"
          />

          <div className="relative px-6 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-14">
            {/* Top meta row — status pill + activity ticker */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/80 backdrop-blur">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                Drafting studio · AI online
              </span>
              <span className="hidden items-center gap-1.5 text-[11px] text-white/50 sm:inline-flex">
                <Activity className="h-3 w-3" />
                <AnimatePresence mode="wait">
                  <motion.span
                    key={heroWordIndex}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.3 }}
                    className={cn(AI_ACTIVITY_TICKER[heroWordIndex % AI_ACTIVITY_TICKER.length].tone)}
                  >
                    {AI_ACTIVITY_TICKER[heroWordIndex % AI_ACTIVITY_TICKER.length].icon}{' '}
                    {AI_ACTIVITY_TICKER[heroWordIndex % AI_ACTIVITY_TICKER.length].text}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="ml-auto hidden items-center gap-3 text-[11px] text-white/50 md:inline-flex">
                <span className="inline-flex items-center gap-1">
                  <span className="tabular-nums font-semibold text-white">{drafts.length}</span>
                  drafts
                </span>
                <span className="text-white/25">·</span>
                <span className="inline-flex items-center gap-1">
                  <span className="tabular-nums font-semibold text-white">{templatesTotal}</span>
                  templates
                </span>
                <span className="text-white/25">·</span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Autosaved
                </span>
              </span>
            </div>

            {/* Headline with rotating verb */}
            <h1 className="mt-7 max-w-4xl text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-[54px] sm:leading-[1.02]">
              <span className="inline-flex items-baseline gap-3">
                <span className="relative inline-block min-w-[4.5ch] sm:min-w-[5ch]">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={HERO_ROTATING_WORDS[heroWordIndex % HERO_ROTATING_WORDS.length]}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -14 }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                      className="inline-block bg-gradient-to-r from-violet-300 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent"
                    >
                      {HERO_ROTATING_WORDS[heroWordIndex % HERO_ROTATING_WORDS.length]}
                    </motion.span>
                  </AnimatePresence>
                </span>
                <span className="text-white/90">at the speed</span>
              </span>
              <br />
              <span className="text-white/70">of thought.</span>
            </h1>

            <p className="mt-4 max-w-2xl text-[15px] leading-[1.7] text-white/60">
              Describe the contract you need. Contigo drafts it with your playbook, your language, and your approved clauses — in seconds.
            </p>

            {/* Spotlight command bar */}
            <div
              className={cn(
                'relative mt-9 rounded-[24px] border bg-white/[0.04] backdrop-blur-xl transition-all duration-300',
                promptFocused
                  ? 'border-white/30 shadow-[0_0_0_4px_rgba(139,92,246,0.18),0_30px_80px_-30px_rgba(139,92,246,0.55)]'
                  : 'border-white/12 hover:border-white/20',
              )}
            >
              {/* Glowing top border when focused */}
              {promptFocused && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -inset-px rounded-[24px] bg-gradient-to-r from-violet-500/0 via-violet-400/40 to-fuchsia-400/0 opacity-80 blur-[2px]"
                />
              )}
              <div className="relative flex items-start gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-5">
                <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-400 text-white shadow-[0_8px_24px_-8px_rgba(168,85,247,0.6)]">
                  <Wand2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <Input
                    ref={aiPromptInputRef}
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onFocus={() => setPromptFocused(true)}
                    onBlur={() => setPromptFocused(false)}
                    placeholder='Draft an NDA for a software consulting engagement, 2-year term, mutual…'
                    className="h-auto w-full border-0 bg-transparent px-0 py-1 text-[17px] font-medium leading-[1.45] text-white placeholder:text-white/35 focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-[19px]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && aiPrompt.trim()) {
                        e.preventDefault()
                        handleAIGenerate()
                      }
                    }}
                    aria-label="Describe the document you want"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/40">
                    <button
                      type="button"
                      onClick={() => setActiveTab('templates')}
                      className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-medium text-white/60 transition-colors hover:border-white/25 hover:text-white"
                    >
                      <LayoutTemplate className="h-3 w-3" />
                      template
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push('/contracts')}
                      className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-medium text-white/60 transition-colors hover:border-white/25 hover:text-white"
                    >
                      <Paperclip className="h-3 w-3" />
                      attach contract
                    </button>
                    <span className="text-white/25">·</span>
                    <span className="inline-flex items-center gap-1">
                      <CornerDownLeft className="h-3 w-3" />
                      Enter to generate
                    </span>
                    <span className="ml-auto hidden items-center gap-1 sm:inline-flex">
                      <kbd className="rounded border border-white/15 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-white/70">
                        <CommandIcon className="inline h-2.5 w-2.5" />K
                      </kbd>
                      <span>focus</span>
                    </span>
                  </div>
                </div>
                <Button
                  onClick={() => handleAIGenerate()}
                  disabled={!aiPrompt.trim()}
                  className={cn(
                    'h-11 shrink-0 gap-2 rounded-xl px-5 text-sm font-semibold shadow-[0_10px_30px_-10px_rgba(168,85,247,0.7)] transition-all',
                    aiPrompt.trim()
                      ? 'bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400 text-white hover:brightness-110'
                      : 'bg-white/10 text-white/40',
                  )}
                >
                  <Sparkles className="h-4 w-4" />
                  Generate
                </Button>
              </div>
            </div>

            {/* Unified suggestion rail — Recent + Popular + Blank */}
            <div className="mt-6 -mx-2 flex items-stretch gap-2 overflow-x-auto px-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {/* Recent prompts chips */}
              {recentPrompts.length > 0 && (
                <>
                  <div className="flex shrink-0 items-center gap-1.5 pr-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                    <History className="h-3 w-3" />
                    Recent
                  </div>
                  {recentPrompts.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => handleAIGenerate(suggestion)}
                      title={suggestion}
                      className="group shrink-0 max-w-[22rem] truncate rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-white/75 backdrop-blur-sm transition-all hover:border-violet-300/40 hover:bg-violet-500/15 hover:text-white"
                    >
                      {suggestion}
                    </button>
                  ))}
                  <span className="mx-1 shrink-0 self-center text-white/20">·</span>
                </>
              )}
              {/* Quick-start rich chips */}
              <div className="flex shrink-0 items-center gap-1.5 pr-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                <Sparkles className="h-3 w-3" />
                Popular
              </div>
              {DRAFTING_QUICK_STARTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    const match = templates.find((t) => {
                      const lowerName = t.name.toLowerCase()
                      return item.searchTerms.some((term) => lowerName.includes(term))
                    })
                    if (match) {
                      handleTemplateUse(match, item.id)
                    } else {
                      router.push(`/drafting/copilot?mode=blank&type=${item.id}`)
                    }
                  }}
                  className="group shrink-0 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] pl-2 pr-3.5 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm transition-all hover:border-fuchsia-300/40 hover:bg-fuchsia-500/10 hover:text-white"
                  title={item.desc}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[11px]">
                    {item.icon}
                  </span>
                  {item.label}
                  <span className="hidden text-white/40 group-hover:text-white/70 sm:inline">· {item.desc}</span>
                </button>
              ))}
              <span className="mx-1 shrink-0 self-center text-white/20">·</span>
              <button
                type="button"
                onClick={() => router.push('/drafting/copilot?mode=blank')}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-dashed border-white/20 bg-transparent px-3.5 py-1.5 text-xs font-medium text-white/70 transition-all hover:border-white/50 hover:bg-white/5 hover:text-white"
              >
                <Plus className="h-3 w-3" />
                Start blank
              </button>
            </div>
          </div>
        </motion.section>

        {/* ============ CONTINUE EDITING (most-recent resume) ============ */}
        {(() => {
          const mostRecent = drafts[0]
          if (!mostRecent) return null
          const ageMs = Date.now() - new Date(mostRecent.updatedAt).getTime()
          // Show only if the draft was touched in the last 24h — otherwise it's
          // already easy to find in the list below.
          if (ageMs > 24 * 60 * 60 * 1000) return null
          const mins = Math.floor(ageMs / 60000)
          const hrs = Math.floor(mins / 60)
          const ago = hrs > 0 ? `${hrs}h ago` : mins > 0 ? `${mins}m ago` : 'just now'
          const isLive = ageMs < 10 * 60_000
          const title =
            (mostRecent.title && mostRecent.title.trim() && !/^untitled/i.test(mostRecent.title.trim())
              ? mostRecent.title
              : mostRecent.template?.name ||
                (mostRecent.sourceType === 'RENEWAL'
                  ? 'Renewal'
                  : mostRecent.sourceType === 'AMENDMENT'
                    ? 'Amendment'
                    : null)) || 'Untitled draft'
          const plain = (mostRecent.content || '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
          const wordCount = plain ? plain.split(/\s+/).length : 0
          const snippet = plain.length > 200 ? plain.slice(0, 200) + '…' : plain
          const fillPct = Math.min(100, Math.round((wordCount / 1200) * 100))
          const statusLabel =
            mostRecent.status === 'IN_REVIEW' ? 'In Review'
            : mostRecent.status === 'PENDING_APPROVAL' ? 'Pending Approval'
            : mostRecent.status === 'APPROVED' ? 'Approved'
            : mostRecent.status === 'FINALIZED' ? 'Finalized'
            : mostRecent.status === 'IN_PROGRESS' ? 'In Progress'
            : 'Draft'
          return (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
            >
              <div className="group relative overflow-hidden rounded-[24px] border border-violet-200/70 bg-gradient-to-br from-white via-violet-50/60 to-fuchsia-50/40 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:border-violet-300 hover:shadow-[0_20px_40px_-20px_rgba(139,92,246,0.35)]">
                {/* Decorative glow */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-violet-300/40 to-fuchsia-300/20 blur-3xl"
                />
                <button
                  type="button"
                  onClick={() => router.push(`/drafting/copilot?draft=${mostRecent.id}`)}
                  className="relative block w-full p-5 text-left sm:p-6"
                  aria-label={`Continue editing ${title}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-[0_10px_30px_-10px_rgba(139,92,246,0.7)]">
                      <Edit3 className="h-5 w-5" />
                      {isLive && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-violet-700">
                          Continue where you left off
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium text-slate-600 backdrop-blur-sm">
                          <Clock className="h-2.5 w-2.5" />
                          {ago}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium text-slate-600 backdrop-blur-sm">
                          {statusLabel}
                        </span>
                      </div>
                      <h3 className="mt-1.5 truncate text-lg font-semibold tracking-tight text-slate-950">
                        {title}
                      </h3>
                      {snippet ? (
                        <p className="mt-1 line-clamp-2 text-[13px] leading-[1.55] text-slate-600">
                          {snippet}
                        </p>
                      ) : (
                        <p className="mt-1 text-[13px] italic leading-[1.55] text-slate-400">
                          Empty draft — jump back in and start writing.
                        </p>
                      )}

                      {/* Progress strip */}
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-white/60">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400 transition-all"
                            style={{ width: `${Math.max(fillPct, 6)}%` }}
                          />
                        </div>
                        <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
                          {wordCount.toLocaleString()} words
                        </span>
                      </div>
                    </div>

                    <div className="hidden shrink-0 items-center gap-2 sm:flex">
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDuplicateDraft(mostRecent.id)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            e.stopPropagation()
                            handleDuplicateDraft(mostRecent.id)
                          }
                        }}
                        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 text-xs font-medium text-slate-600 backdrop-blur-sm transition-colors hover:border-slate-300 hover:text-slate-900"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Duplicate
                      </span>
                      <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-slate-950 px-4 text-xs font-semibold text-white shadow-sm transition-all group-hover:bg-violet-700">
                        Resume
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                    <ArrowRight className="h-5 w-5 shrink-0 self-center text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-700 sm:hidden" />
                  </div>
                </button>
              </div>
            </motion.div>
          )
        })()}

        {/* ============ TABBED CONTENT ============ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">Pick up where you left off</p>
                  <p className="text-sm text-slate-500">
                    Switch between recent drafts and approved templates.
                  </p>
                </div>
                <TabsList className="rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200">
                <TabsTrigger
                  value="drafts"
                  className="gap-2 rounded-full px-4 data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-none"
                >
                  <FileText className="h-4 w-4" />
                  Drafts
                  {drafts.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                      {drafts.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="templates"
                  className="gap-2 rounded-full px-4 data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-none"
                >
                  <BookOpen className="h-4 w-4" />
                  Templates
                  {templatesTotal > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                      {templatesTotal}
                    </Badge>
                  )}
                </TabsTrigger>
                </TabsList>
              </div>

              {/* Search */}
              {(activeTab === 'drafts' || activeTab === 'templates') && (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      ref={listSearchInputRef}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={
                        activeTab === 'drafts'
                          ? 'Search drafts...'
                          : 'Search templates...'
                      }
                      aria-label={activeTab === 'drafts' ? 'Search drafts' : 'Search templates'}
                      className="h-10 rounded-full border-slate-200 bg-white pl-9 pr-16 text-sm shadow-sm"
                    />
                    {!searchQuery && (
                      <kbd
                        aria-hidden
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-mono text-slate-400"
                      >
                        /
                      </kbd>
                    )}
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-slate-100"
                      >
                        <span className="sr-only">Clear</span>
                        <svg
                          className="h-3.5 w-3.5 text-slate-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Status Filter (drafts tab only) */}
                  {activeTab === 'drafts' && drafts.length > 0 && (
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      aria-label="Filter drafts by status"
                      className="h-10 rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="">All Statuses</option>
                      <option value="DRAFT">Draft</option>
                      <option value="IN_REVIEW">In Review</option>
                      <option value="PENDING_APPROVAL">Pending Approval</option>
                      <option value="APPROVED">Approved</option>
                      <option value="REJECTED">Rejected</option>
                      <option value="FINALIZED">Finalized</option>
                    </select>
                  )}
                  {activeTab === 'drafts' && statusFilter && (
                    <button
                      onClick={() => setStatusFilter('')}
                      className="h-10 rounded-full border border-slate-200 bg-white px-4 text-xs font-medium text-slate-500 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-700"
                    >
                      Clear filter
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ── DRAFTS TAB ── */}
            <TabsContent value="drafts" className="space-y-4 mt-0">
              {draftsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i} className="bg-white border-slate-200">
                      <CardContent className="p-5 space-y-3">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-3 w-1/3" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : recentDrafts.length === 0 ? (
                <Card className="bg-white border-slate-200">
                  <CardContent className="py-16 text-center">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
                      <FileText className="h-8 w-8 text-violet-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">
                      {searchQuery ? 'No drafts found' : 'No drafts yet'}
                    </h3>
                    <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
                      {searchQuery
                        ? `No drafts match "${searchQuery}". Try a different search.`
                        : 'Start your first contract draft from scratch, a template, or let AI generate one for you.'}
                    </p>
                    {!searchQuery && (
                      <div className="flex items-center justify-center gap-3">
                        <Button
                          onClick={() => router.push('/drafting/copilot?mode=blank')}
                          className="bg-violet-600 hover:bg-violet-700 rounded-xl"
                        >
                          <Plus className="h-4 w-4 mr-2" /> Blank Document
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setActiveTab('templates')}
                          className="rounded-xl"
                        >
                          <BookOpen className="h-4 w-4 mr-2" /> From Template
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <>
                  {(debouncedSearch || statusFilter) && (
                    <p className="text-xs text-slate-500">
                      {recentDrafts.length}{' '}
                      {recentDrafts.length === 1 ? 'draft' : 'drafts'}
                      {debouncedSearch ? <> matching &ldquo;<span className="font-medium text-slate-700">{debouncedSearch}</span>&rdquo;</> : null}
                    </p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {recentDrafts.map((draft, idx) => (
                      <motion.div
                        key={draft.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                      >
                        <DraftCard
                          draft={draft}
                          onDelete={handleDeleteDraft}
                          onDuplicate={handleDuplicateDraft}
                          onExport={handleExportDraft}
                        />
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            {/* ── TEMPLATES TAB ── */}
            <TabsContent value="templates" className="space-y-4 mt-0">
              {templatesLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i} className="bg-white border-slate-200">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex gap-3">
                          <Skeleton className="h-10 w-10 rounded-lg" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-full" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredTemplates.length === 0 ? (
                <Card className="bg-white border-slate-200">
                  <CardContent className="py-16 text-center">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
                      <BookOpen className="h-8 w-8 text-violet-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">
                      {searchQuery ? 'No templates found' : 'No active templates'}
                    </h3>
                    <p className="text-sm text-slate-500 mb-6">
                      {searchQuery
                        ? `No templates match "${searchQuery}".`
                        : 'Create templates in the Templates page to use them here.'}
                    </p>
                    <Link href="/templates">
                      <Button className="bg-violet-600 hover:bg-violet-700 rounded-xl">
                        <BookOpen className="h-4 w-4 mr-2" /> Go to Templates
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {debouncedSearch && (
                    <p className="text-xs text-slate-500">
                      {filteredTemplates.length}{' '}
                      {filteredTemplates.length === 1 ? 'template' : 'templates'}
                      {' '}matching &ldquo;<span className="font-medium text-slate-700">{debouncedSearch}</span>&rdquo;
                    </p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredTemplates.map((template, idx) => (
                      <motion.div
                        key={template.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                      >
                        <TemplateQuickCard
                          template={template}
                          onClick={() => handleTemplateUse(template)}
                          onPreview={() => handleTemplatePreview(template)}
                        />
                      </motion.div>
                    ))}
                  </div>
                  {templates.length >= 12 && (
                    <div className="text-center pt-2">
                      <Link href="/templates">
                        <Button variant="outline" className="rounded-xl">
                          View all templates{' '}
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </Link>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

          </Tabs>
        </motion.div>
      </div>

      {/* Template Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5 text-violet-600" />
              {previewTemplate?.name}
            </DialogTitle>
            {previewTemplate?.description && (
              <p className="text-sm text-slate-500 mt-1">{previewTemplate.description}</p>
            )}
          </DialogHeader>
          <div className="flex items-center gap-2 mb-3">
            {previewTemplate?.category && (
              <Badge variant="secondary">{previewTemplate.category}</Badge>
            )}
            {(previewTemplate?.usageCount ?? 0) > 0 && (
              <span className="text-xs text-slate-400">{previewTemplate?.usageCount} uses</span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto border rounded-xl p-4 bg-slate-50 text-sm prose prose-sm max-w-none">
            {previewLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewContent) }} />
            )}
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t">
            <Button variant="outline" onClick={() => setPreviewTemplate(null)}>
              Close
            </Button>
            <Button
              className="bg-violet-600 hover:bg-violet-700"
              onClick={() => {
                if (previewTemplate) handleTemplateUse(previewTemplate)
              }}
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Use Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Agentic Draft Dialog */}
      <AgenticDraftDialog
        open={showAgenticDialog}
        onOpenChange={(open) => {
          setShowAgenticDialog(open)
          if (!open) {
            fetchDrafts()
            setAiPrompt('')
          }
        }}
        initialPrompt={aiPrompt}
      />

    </div>
  )
}
