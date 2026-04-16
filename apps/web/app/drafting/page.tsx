'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const updatedDate = new Date(draft.updatedAt)
  const diffMs = Date.now() - updatedDate.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  let timeAgo = 'Just now'
  if (diffDays > 0) timeAgo = `${diffDays}d ago`
  else if (diffHours > 0) timeAgo = `${diffHours}h ago`
  else if (diffMins > 0) timeAgo = `${diffMins}m ago`

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-600',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    REVIEW: 'bg-amber-100 text-amber-700',
    COMPLETED: 'bg-emerald-100 text-emerald-700',
  }

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
      <Card className="group cursor-pointer rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-violet-600 transition-colors group-hover:bg-violet-50"
              onClick={() => router.push(`/drafting/copilot?draft=${draft.id}`)}
              aria-label={`Open ${draft.title || 'Untitled Draft'}`}
            >
              <FileText className="h-4 w-4" />
            </button>

            <div
              className="min-w-0 flex-1"
              onClick={() => router.push(`/drafting/copilot?draft=${draft.id}`)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-slate-900">
                    {draft.title || 'Untitled Draft'}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Edited {timeAgo}
                    {draft.template ? ` · ${draft.template.name}` : ''}
                  </p>
                </div>
                <Badge
                  className={cn(
                    'shrink-0 border-0 px-2 py-0.5 text-[10px] font-medium',
                    statusColors[draft.status] || statusColors.DRAFT,
                  )}
                >
                  {draft.status === 'DRAFT'
                    ? 'Draft'
                    : draft.status === 'IN_PROGRESS'
                      ? 'In Progress'
                      : draft.status}
                </Badge>
              </div>
            </div>

            <div className="shrink-0">
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
                    onClick={() => setShowDeleteConfirm(true)}
                    className="gap-2 cursor-pointer text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete draft?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete &ldquo;{draft.title}&rdquo;. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(draft.id)}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
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
  const categoryIcons: Record<string, string> = {
    Technology: '💻',
    Services: '🛠️',
    Legal: '⚖️',
    HR: '👥',
    Procurement: '📦',
    Finance: '💰',
    Renewal: '🔄',
    Default: '📄',
  }
  const icon = categoryIcons[template.category || ''] || categoryIcons.Default

  return (
    <div className="text-left w-full">
      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-lg">
              {icon}
            </div>
            <div className="min-w-0 flex-1">
              {template.category && (
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                  {template.category}
                </p>
              )}
              <h4 className="mt-1 truncate text-sm font-semibold text-slate-900">
                {template.name}
              </h4>
              {template.description && (
                <p className="mt-1 text-xs leading-5 text-slate-500 line-clamp-2">
                  {template.description}
                </p>
              )}
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); onPreview() }}
                  className="text-xs font-medium text-slate-500 transition-colors hover:text-violet-700"
                  title="Preview template"
                >
                  Preview
                </button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 rounded-full bg-slate-900 px-3 text-xs text-white hover:bg-slate-800"
                  onClick={(e) => {
                    e.stopPropagation()
                    onClick()
                  }}
                >
                  Use template
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}



// ============================================================================
// Main Component
// ============================================================================

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

  // Fetch templates via React Query
  const { data: templatesData, isLoading: templatesLoading } = useTemplates()
  const templates: Template[] = useMemo(() => {
    if (!templatesData?.templates) return []
    return (templatesData.templates as Template[])
      .filter((t) => t.status === 'active')
      .slice(0, 12)
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
    try {
      const res = await fetch(`/api/drafts/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setDrafts((prev) => prev.filter((d) => d.id !== id))
        toast.success('Draft deleted')
      } else {
        toast.error('Failed to delete draft')
      }
    } catch {
      toast.error('Failed to delete draft')
    }
  }, [])

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

  const handleAIGenerate = useCallback(() => {
    if (!aiPrompt.trim()) {
      toast.error('Please describe what you want to draft')
      return
    }
    setShowAgenticDialog(true)
  }, [aiPrompt])

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
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]"
        >
          <Card className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <CardContent className="p-6 sm:p-8">
              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                    Drafting studio
                  </p>
                  <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                    Draft in one calm workspace.
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
                    Start from a prompt, an approved template, or a blank page, then bring AI in only when you need help.
                  </p>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 sm:p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-900">
                    <Wand2 className="h-4 w-4 text-violet-600" />
                    Describe the document you want
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder='e.g. "Draft an NDA for a software consulting engagement with a 2-year term"'
                      className="h-12 rounded-full border-slate-200 bg-white px-5 text-sm shadow-sm focus:border-violet-400 focus:ring-violet-400/20"
                      onKeyDown={(e) => e.key === 'Enter' && handleAIGenerate()}
                    />
                    <Button
                      onClick={handleAIGenerate}
                      disabled={!aiPrompt.trim()}
                      className="h-12 rounded-full bg-slate-950 px-5 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate with AI
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      'NDA for tech partnership',
                      'MSA with SaaS vendor',
                      'Employment contract',
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setAiPrompt(suggestion)}
                        className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    size="lg"
                    className="rounded-full bg-violet-600 px-5 text-white hover:bg-violet-700"
                    onClick={() => router.push('/drafting/copilot?mode=blank')}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Start blank
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-full border-slate-300 bg-white px-5 text-slate-700 hover:bg-slate-100"
                    onClick={() => setActiveTab('templates')}
                  >
                    <BookOpen className="mr-2 h-4 w-4" />
                    Browse templates
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
                  <span>
                    <span className="font-semibold text-slate-900">{drafts.length}</span> recent drafts
                  </span>
                  <span>
                    <span className="font-semibold text-slate-900">{templates.length}</span> approved templates
                  </span>
                  <span>
                    AI stays in the drafting flow instead of taking over the page.
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <CardContent className="flex h-full flex-col p-6 sm:p-7">
              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold text-slate-950">Popular starts</h2>
                <p className="text-sm leading-6 text-slate-500">
                  Jump into a common document and refine it in the editor.
                </p>
              </div>

              <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
                {DRAFTING_QUICK_STARTS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      const match = templates.find(
                        (t) => {
                          const lowerName = t.name.toLowerCase()
                          return item.searchTerms.some((term) => lowerName.includes(term))
                        },
                      )
                      if (match) {
                        handleTemplateUse(match, item.id)
                      } else {
                        router.push(`/drafting/copilot?mode=blank&type=${item.id}`)
                      }
                    }}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-100"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-xl shadow-sm">
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                      <div className="text-xs leading-5 text-slate-500">{item.desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-900">Need a proven structure?</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Start from your approved templates and use AI once the draft is open.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('templates')}
                  className="mt-3 text-sm font-medium text-violet-700 transition-colors hover:text-violet-900"
                >
                  Browse template library
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

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
                  {templates.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                      {templates.length}
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
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={
                        activeTab === 'drafts'
                          ? 'Search drafts...'
                          : 'Search templates...'
                      }
                      className="h-10 rounded-full border-slate-200 bg-white pl-9 text-sm shadow-sm"
                    />
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
