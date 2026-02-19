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
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

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
  { id: 'employment', label: 'Employment', icon: '👥', desc: 'Employment Contract' },
  { id: 'lease', label: 'Lease', icon: '🏢', desc: 'Lease Agreement' },
  { id: 'vendor', label: 'Vendor', icon: '🤝', desc: 'Vendor Agreement' },
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
}: {
  draft: Draft
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
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
                      onClick={() => onDelete(draft.id)}
                      className="gap-2 cursor-pointer text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
}: {
  template: Template
  onClick: () => void
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
    <motion.button
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="text-left w-full"
    >
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
            <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-violet-500 transition-colors flex-shrink-0 mt-1" />
          </div>
        </CardContent>
      </Card>
    </motion.button>
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

  // Fetch templates via React Query
  const { data: templatesData, isLoading: templatesLoading } = useTemplates()
  const templates: Template[] = useMemo(() => {
    if (!templatesData?.templates) return []
    return (templatesData.templates as Template[])
      .filter((t) => t.status === 'active')
      .slice(0, 12)
  }, [templatesData])

  // Fetch drafts
  const fetchDrafts = useCallback(async () => {
    try {
      setDraftsLoading(true)
      const res = await fetch('/api/drafts?limit=50&sortBy=updatedAt&sortOrder=desc')
      if (res.ok) {
        const data = await res.json()
        setDrafts(data.data?.drafts || [])
      }
    } catch (err) {
      console.error('Failed to load drafts:', err)
    } finally {
      setDraftsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDrafts()
  }, [fetchDrafts])

  // Derived data
  const recentDrafts = useMemo(() => {
    if (!searchQuery) return drafts
    const q = searchQuery.toLowerCase()
    return drafts.filter(
      (d) =>
        (d.title || '').toLowerCase().includes(q) ||
        (d.template?.name || '').toLowerCase().includes(q),
    )
  }, [drafts, searchQuery])

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
      const draft = drafts.find((d) => d.id === id)
      if (!draft) return
      try {
        const res = await fetch('/api/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `${draft.title} (Copy)`,
            content: draft.content || '',
            type: draft.type || 'contract',
            status: 'DRAFT',
            sourceType: draft.sourceType || 'blank',
          }),
        })
        if (res.ok) {
          toast.success('Draft duplicated')
          fetchDrafts()
        }
      } catch {
        toast.error('Failed to duplicate draft')
      }
    },
    [drafts, fetchDrafts],
  )

  const handleAIGenerate = useCallback(() => {
    if (!aiPrompt.trim()) {
      toast.error('Please describe what you want to draft')
      return
    }
    setIsGenerating(true)
    const params = new URLSearchParams({ mode: 'ai', prompt: aiPrompt })
    router.push(`/drafting/copilot?${params.toString()}`)
    setIsGenerating(false)
  }, [aiPrompt, router])

  const handleTemplateUse = useCallback(
    (template: Template) => {
      router.push(
        `/drafting/copilot?template=${template.id}&name=${encodeURIComponent(template.name)}`,
      )
    },
    [router],
  )

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
                New Document
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/40 text-white hover:bg-white/10 font-semibold rounded-xl px-6"
                onClick={() => setActiveTab('templates')}
              >
                <LayoutTemplate className="h-5 w-5 mr-2" />
                Browse Templates
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
                    <Button
                      size="lg"
                      className="bg-white text-violet-700 hover:bg-violet-50 font-semibold shadow-lg rounded-xl px-8"
                      onClick={() => router.push('/drafting/copilot?mode=blank')}
                    >
                      <Sparkles className="h-5 w-5 mr-2" />
                      Start AI Copilot
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  )
}
