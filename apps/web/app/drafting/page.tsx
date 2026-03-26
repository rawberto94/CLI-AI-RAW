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
import { cn } from '@/lib/utils'
import { sanitizeHtml } from '@/lib/security/sanitize'
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
  Shield,
  Zap,
  Brain,
  MessageSquare,
  Lightbulb,
  PenTool,
  Target,
  RefreshCw,
  LayoutTemplate,
  Bot,
  FileCheck,
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
import { InteractiveDraftChat } from '@/components/drafting/InteractiveDraftChat'
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

const AI_CAPABILITIES = [
  {
    icon: Brain,
    title: 'AI Auto-Complete',
    description: 'Intelligent clause suggestions as you type, powered by your contract library',
    color: 'violet' as const,
  },
  {
    icon: Shield,
    title: 'Risk Detection',
    description: 'Real-time risk analysis flags problematic clauses before they become issues',
    color: 'red' as const,
  },
  {
    icon: MessageSquare,
    title: 'AI Chat Copilot',
    description: 'Ask questions about clauses, get rewriting suggestions, or generate new sections',
    color: 'blue' as const,
  },
  {
    icon: Zap,
    title: 'Smart Templates',
    description: 'AI fills variables, adapts language by jurisdiction, and ensures compliance',
    color: 'amber' as const,
  },
  {
    icon: Target,
    title: 'Compliance Check',
    description: 'Automated regulatory compliance scanning against your policy library',
    color: 'emerald' as const,
  },
  {
    icon: Lightbulb,
    title: 'Clause Library',
    description: 'Access pre-approved clauses with AI-powered relevance ranking',
    color: 'purple' as const,
  },
]

const QUICK_STARTS = [
  { id: 'nda', label: 'NDA', icon: '🔒', desc: 'Non-Disclosure Agreement' },
  { id: 'msa', label: 'MSA', icon: '📋', desc: 'Master Services Agreement' },
  { id: 'sow', label: 'SOW', icon: '📝', desc: 'Statement of Work' },
  { id: 'rfx-award', label: 'RFx Award', icon: '🏆', desc: 'Contract from RFx Award' },
  { id: 'employment', label: 'Employment', icon: '👥', desc: 'Employment Contract' },
  { id: 'lease', label: 'Lease', icon: '🏢', desc: 'Lease Agreement' },
  { id: 'vendor', label: 'Vendor', icon: '🤝', desc: 'Vendor Agreement' },
  { id: 'amendment', label: 'Amendment', icon: '📎', desc: 'Contract Amendment' },
]

const colorMap: Record<string, { bg: string; text: string; gradient: string }> = {
  violet: { bg: 'bg-violet-50', text: 'text-violet-600', gradient: 'from-violet-500 to-purple-600' },
  red: { bg: 'bg-red-50', text: 'text-red-600', gradient: 'from-red-500 to-rose-600' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', gradient: 'from-blue-500 to-indigo-600' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', gradient: 'from-amber-500 to-orange-600' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', gradient: 'from-emerald-500 to-teal-600' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', gradient: 'from-purple-500 to-pink-600' },
}

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
      <Card className="group bg-white border-slate-200/80 hover:border-violet-300 hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden">
        <CardContent className="p-0">
          <div className="h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div
                className="flex-1 min-w-0"
                onClick={() => router.push(`/drafting/copilot?draft=${draft.id}`)}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <FileText className="h-4 w-4 text-violet-500 flex-shrink-0" />
                  <h3 className="font-semibold text-slate-900 truncate text-sm">
                    {draft.title || 'Untitled Draft'}
                  </h3>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {timeAgo}
                  </span>
                  {draft.template && (
                    <span className="flex items-center gap-1">
                      <LayoutTemplate className="h-3 w-3" />
                      {draft.template.name}
                    </span>
                  )}
                  {draft.sourceType && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {draft.sourceType === 'template'
                        ? 'From template'
                        : draft.sourceType === 'ai'
                          ? 'AI Generated'
                          : 'Blank'}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  className={cn(
                    'text-[10px] font-medium px-2 py-0.5 border-0',
                    statusColors[draft.status] || statusColors.DRAFT,
                  )}
                >
                  {draft.status === 'DRAFT'
                    ? 'Draft'
                    : draft.status === 'IN_PROGRESS'
                      ? 'In Progress'
                      : draft.status}
                </Badge>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-slate-100 transition-all">
                      <MoreHorizontal className="h-4 w-4 text-slate-400" />
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
      <Card className="bg-white border-slate-200/80 hover:border-violet-300 hover:shadow-md transition-all duration-200 overflow-hidden group">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl flex-shrink-0">{icon}</span>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-slate-900 text-sm truncate group-hover:text-violet-700 transition-colors">
                {template.name}
              </h4>
              {template.description && (
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                  {template.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2">
                {template.category && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {template.category}
                  </Badge>
                )}
                {(template.usageCount ?? 0) > 0 && (
                  <span className="text-[10px] text-slate-400">
                    {template.usageCount} uses
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1 flex-shrink-0 mt-0.5">
              <button
                onClick={(e) => { e.stopPropagation(); onPreview(); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                title="Preview template"
              >
                <Search className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onClick(); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                title="Use template"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color = 'violet',
}: {
  icon: React.ElementType
  label: string
  value: number | string
  color?: string
}) {
  const c = colorMap[color] || colorMap.violet
  return (
    <Card className={cn('border-0 shadow-sm hover:shadow-md transition-shadow', c.bg)}>
      <CardContent className="p-4 flex items-center gap-3">
        <div
          className={cn(
            'p-2.5 rounded-xl bg-gradient-to-br text-white shadow-md',
            c.gradient,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xl font-bold text-slate-900">{value}</p>
          <p className={cn('text-xs font-medium', c.text)}>{label}</p>
        </div>
      </CardContent>
    </Card>
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
  const [activeTab, setActiveTab] = useState('drafts')
  const [aiPrompt, setAiPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [showAgenticDialog, setShowAgenticDialog] = useState(false)
  const [showGuidedDrafting, setShowGuidedDrafting] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)
  const [previewContent, setPreviewContent] = useState<string>('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')

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
      if (searchQuery.trim()) params.set('search', searchQuery.trim())
      if (statusFilter) params.set('status', statusFilter)
      if (dateFrom) params.set('dateFrom', new Date(dateFrom).toISOString())
      if (dateTo) params.set('dateTo', new Date(dateTo + 'T23:59:59').toISOString())
      const res = await fetch(`/api/drafts?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setDrafts(data.data?.drafts || [])
      }
    } catch (err) {
      console.error('Failed to load drafts:', err)
    } finally {
      setDraftsLoading(false)
    }
  }, [searchQuery, statusFilter, dateFrom, dateTo])

  useEffect(() => {
    fetchDrafts()
  }, [fetchDrafts])

  // Derived data — server already filters by search/status/date
  const recentDrafts = useMemo(() => drafts, [drafts])

  const filteredTemplates = useMemo(() => {
    if (!searchQuery) return templates
    const q = searchQuery.toLowerCase()
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q),
    )
  }, [templates, searchQuery])

  const stats = useMemo(
    () => ({
      totalDrafts: drafts.length,
      inProgress: drafts.filter(
        (d) => d.status === 'IN_PROGRESS' || d.status === 'DRAFT',
      ).length,
      fromTemplates: drafts.filter((d) => d.sourceType === 'template').length,
      aiGenerated: drafts.filter((d) => d.sourceType === 'ai').length,
      templatesAvailable: templates.length,
    }),
    [drafts, templates],
  )

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
    (template: Template) => {
      router.push(
        `/drafting/copilot?template=${template.id}&name=${encodeURIComponent(template.name)}`,
      )
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
    <div className="min-h-screen bg-slate-50">
      {/* Sticky Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 px-6 py-3 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <PageBreadcrumb />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* ============ HERO SECTION ============ */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-pink-600 p-8 text-white"
        >
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full translate-y-1/2 -translate-x-1/4" />
          </div>

          <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <PenTool className="h-7 w-7" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">Document Studio</h1>
                  <p className="text-violet-100 text-base mt-1">
                    Draft, generate, and collaborate on contracts with AI-powered
                    intelligence
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                  <Sparkles className="h-3 w-3 mr-1" /> AI Copilot
                </Badge>
                <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                  <Shield className="h-3 w-3 mr-1" /> Risk Detection
                </Badge>
                <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                  <BookOpen className="h-3 w-3 mr-1" /> Clause Library
                </Badge>
                <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                  <FileCheck className="h-3 w-3 mr-1" /> Compliance Check
                </Badge>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                className="bg-white text-violet-700 hover:bg-violet-50 font-semibold shadow-lg shadow-black/20 rounded-xl px-6"
                onClick={() => router.push('/drafting/copilot?mode=blank')}
              >
                <Plus className="h-5 w-5 mr-2" />
                <div className="text-left">
                  <div>New Document</div>
                  <div className="text-[10px] font-normal opacity-70">Blank canvas with AI copilot</div>
                </div>
              </Button>
              <Button
                size="lg"
                className="bg-white/20 text-white hover:bg-white/30 font-semibold shadow-lg shadow-black/10 rounded-xl px-6 backdrop-blur-sm border border-white/30"
                onClick={() => setShowAgenticDialog(true)}
              >
                <Sparkles className="h-5 w-5 mr-2" />
                <div className="text-left">
                  <div>Generate with AI</div>
                  <div className="text-[10px] font-normal opacity-70">6-step agentic pipeline</div>
                </div>
              </Button>
              <Button
                size="lg"
                className="bg-white/20 text-white hover:bg-white/30 font-semibold shadow-lg shadow-black/10 rounded-xl px-6 backdrop-blur-sm border border-white/30"
                onClick={() => setShowGuidedDrafting(true)}
              >
                <MessageSquare className="h-5 w-5 mr-2" />
                <div className="text-left">
                  <div>Guided Drafting</div>
                  <div className="text-[10px] font-normal opacity-70">Interactive AI assistant</div>
                </div>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/40 text-white hover:bg-white/10 font-semibold rounded-xl px-6"
                onClick={() => setActiveTab('templates')}
              >
                <LayoutTemplate className="h-5 w-5 mr-2" />
                <div className="text-left">
                  <div>Browse Templates</div>
                  <div className="text-[10px] font-normal opacity-70">Start from a pre-built template</div>
                </div>
              </Button>
            </div>
          </div>
        </motion.div>

        {/* ============ STATS ROW ============ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-4"
        >
          <StatCard icon={FileText} label="Total Drafts" value={stats.totalDrafts} color="violet" />
          <StatCard icon={Edit3} label="In Progress" value={stats.inProgress} color="blue" />
          <StatCard icon={LayoutTemplate} label="From Templates" value={stats.fromTemplates} color="amber" />
          <StatCard icon={Bot} label="AI Generated" value={stats.aiGenerated} color="purple" />
          <StatCard icon={BookOpen} label="Templates" value={stats.templatesAvailable} color="emerald" />
        </motion.div>

        {/* ============ AI QUICK GENERATE ============ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="border-violet-200/60 bg-gradient-to-r from-violet-50/80 via-white to-purple-50/80 shadow-sm overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl text-white shadow-md">
                  <Wand2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">
                    AI Contract Generator
                  </h3>
                  <p className="text-sm text-slate-500">
                    Describe what you need and AI will draft it for you
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Input
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder='e.g. "Draft an NDA for a software consulting engagement with a 2-year term"'
                    className="h-12 pl-4 pr-4 text-sm border-slate-200 focus:border-violet-400 focus:ring-violet-400/20 rounded-xl bg-white"
                    onKeyDown={(e) => e.key === 'Enter' && handleAIGenerate()}
                  />
                </div>
                <Button
                  onClick={handleAIGenerate}
                  disabled={isGenerating || !aiPrompt.trim()}
                  className="h-12 px-6 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl font-medium shadow-lg shadow-violet-500/25"
                >
                  {isGenerating ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Generate
                </Button>
              </div>
              {/* Quick suggestion chips */}
              <div className="flex flex-wrap gap-2 mt-3">
                {[
                  'NDA for tech partnership',
                  'MSA with SaaS vendor',
                  'Employment contract',
                  'Consulting SOW',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setAiPrompt(suggestion)}
                    className="text-xs px-3 py-1.5 rounded-full bg-violet-100/80 text-violet-700 hover:bg-violet-200 transition-colors font-medium"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ============ QUICK START CARDS ============ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-900">Quick Start</h2>
            <Link
              href="/templates"
              className="text-sm text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1"
            >
              All templates <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {QUICK_STARTS.map((item) => (
              <motion.button
                key={item.id}
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  // Special routes for RFx Award and Amendment flows
                  if (item.id === 'rfx-award') {
                    router.push('/rfx?tab=awarded')
                    return
                  }
                  if (item.id === 'amendment') {
                    router.push('/contracts?action=amend')
                    return
                  }
                  const match = templates.find(
                    (t) =>
                      t.name.toLowerCase().includes(item.id) ||
                      t.name.toLowerCase().includes(item.label.toLowerCase()),
                  )
                  if (match) {
                    handleTemplateUse(match)
                  } else {
                    router.push(`/drafting/copilot?mode=blank&type=${item.id}`)
                  }
                }}
                className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-slate-200/80 hover:border-violet-300 hover:shadow-md transition-all text-center group"
              >
                <span className="text-2xl">{item.icon}</span>
                <span className="text-sm font-semibold text-slate-800 group-hover:text-violet-700 transition-colors">
                  {item.label}
                </span>
                <span className="text-[10px] text-slate-400 leading-tight">
                  {item.desc}
                </span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* ============ TABBED CONTENT ============ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <TabsList className="bg-slate-100 p-1 rounded-xl">
                <TabsTrigger
                  value="drafts"
                  className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 gap-2"
                >
                  <FileText className="h-4 w-4" />
                  My Drafts
                  {drafts.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                      {drafts.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="templates"
                  className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 gap-2"
                >
                  <BookOpen className="h-4 w-4" />
                  Templates
                  {templates.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                      {templates.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="ai"
                  className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  AI Capabilities
                </TabsTrigger>
              </TabsList>

              {/* Search */}
              {(activeTab === 'drafts' || activeTab === 'templates') && (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-full sm:w-60">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={
                        activeTab === 'drafts'
                          ? 'Search drafts...'
                          : 'Search templates...'
                      }
                      className="pl-9 h-9 rounded-lg text-sm"
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
                  {activeTab === 'drafts' && (
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
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

                  {/* Date Range (drafts tab only) */}
                  {activeTab === 'drafts' && (
                    <>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="h-9 px-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        aria-label="From date"
                      />
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="h-9 px-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
                        aria-label="To date"
                      />
                      {(statusFilter || dateFrom || dateTo) && (
                        <button
                          onClick={() => { setStatusFilter(''); setDateFrom(''); setDateTo(''); }}
                          className="h-9 px-3 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                        >
                          Clear filters
                        </button>
                      )}
                    </>
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

            {/* ── AI CAPABILITIES TAB ── */}
            <TabsContent value="ai" className="space-y-6 mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {AI_CAPABILITIES.map((cap, idx) => {
                  const c = colorMap[cap.color] || colorMap.violet
                  return (
                    <motion.div
                      key={cap.title}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <Card
                        className={cn(
                          'border-0 shadow-sm hover:shadow-lg transition-all duration-200 group overflow-hidden',
                          c.bg,
                        )}
                      >
                        <CardContent className="p-6">
                          <div
                            className={cn(
                              'p-3 rounded-xl bg-gradient-to-br text-white shadow-md w-fit mb-4',
                              c.gradient,
                            )}
                          >
                            <cap.icon className="h-5 w-5" />
                          </div>
                          <h3 className="font-semibold text-slate-900 mb-1.5">
                            {cap.title}
                          </h3>
                          <p className="text-sm text-slate-600 leading-relaxed">
                            {cap.description}
                          </p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </div>

              {/* CTA banner */}
              <Card className="bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 border-0 text-white overflow-hidden">
                <CardContent className="p-8 text-center relative">
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/3" />
                  </div>
                  <div className="relative">
                    <div className="mx-auto w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4">
                      <Sparkles className="h-7 w-7" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">
                      Ready to draft with AI?
                    </h3>
                    <p className="text-violet-100 mb-6 max-w-md mx-auto">
                      Experience intelligent contract drafting with real-time
                      suggestions, risk detection, and compliance checks.
                    </p>
                    <div className="flex justify-center gap-3">
                      <Button
                        size="lg"
                        className="bg-white text-violet-700 hover:bg-violet-50 font-semibold shadow-lg rounded-xl px-8"
                        onClick={() => setShowAgenticDialog(true)}
                      >
                        <Sparkles className="h-5 w-5 mr-2" />
                        Generate with AI
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        className="border-white/40 text-white hover:bg-white/10 font-semibold rounded-xl px-6"
                        onClick={() => router.push('/drafting/copilot?mode=blank')}
                      >
                        <PenTool className="h-5 w-5 mr-2" />
                        Blank + Copilot
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
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

      {/* Interactive Guided Drafting */}
      {showGuidedDrafting && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-5xl h-[85vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden">
            <InteractiveDraftChat
              onDraftCreated={(draftId, editUrl) => {
                setShowGuidedDrafting(false)
                router.push(editUrl)
              }}
              onClose={() => {
                setShowGuidedDrafting(false)
                fetchDrafts()
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
