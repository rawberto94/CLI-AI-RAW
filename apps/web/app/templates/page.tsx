'use client'

/**
 * Contract Templates — list page.
 *
 * Deliberately lean: this page answers four user questions:
 *   1. What templates do I have?
 *   2. Which ones are useful? (usage, favorites)
 *   3. Can I find the one I need fast?
 *   4. How do I act on it? (open, duplicate, delete, create new)
 *
 * Features that are power-user / low-frequency (version history, audit trail,
 * comparison, dependencies, cloud sync, bulk ops, tag AI, analytics) live on
 * the detail page or dedicated tools, not on the primary list.
 */

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import {
  FileText, Plus, Search, Star, MoreHorizontal, Copy, Edit2, Trash2,
  LayoutGrid, List as ListIcon, Filter, Loader2, TrendingUp, Clock,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useTemplates, useDeleteTemplate } from '@/hooks/use-queries'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type TemplateStatus = 'draft' | 'active' | 'archived' | 'pending_approval'

interface ContractTemplate {
  id: string
  name: string
  description?: string
  category?: string
  status: TemplateStatus
  isActive?: boolean
  usageCount?: number
  variables?: number
  clauses?: number | Array<unknown>
  tags?: string[]
  updatedAt?: string
  lastModified?: string
  createdAt?: string
}

type ViewMode = 'grid' | 'list'
type SortKey = 'updated' | 'name' | 'usage'

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (cheap enough to live at module scope)
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_STYLE: Record<string, { dot: string; text: string; bg: string }> = {
  Technology:  { dot: 'bg-violet-500',  text: 'text-violet-700',  bg: 'bg-violet-50'  },
  Services:    { dot: 'bg-sky-500',     text: 'text-sky-700',     bg: 'bg-sky-50'     },
  Legal:       { dot: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50'     },
  HR:          { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  Procurement: { dot: 'bg-orange-500',  text: 'text-orange-700',  bg: 'bg-orange-50'  },
  Finance:     { dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50'   },
  Renewal:     { dot: 'bg-cyan-500',    text: 'text-cyan-700',    bg: 'bg-cyan-50'    },
}
const DEFAULT_CAT = { dot: 'bg-slate-400', text: 'text-slate-700', bg: 'bg-slate-100' }

const STATUS_STYLE: Record<TemplateStatus, { label: string; className: string }> = {
  active:            { label: 'Active',   className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  draft:             { label: 'Draft',    className: 'bg-amber-50 text-amber-700 border-amber-200'       },
  archived:          { label: 'Archived', className: 'bg-slate-100 text-slate-600 border-slate-200'      },
  pending_approval:  { label: 'Review',   className: 'bg-violet-50 text-violet-700 border-violet-200'    },
}

function clauseCount(t: ContractTemplate): number {
  return Array.isArray(t.clauses) ? t.clauses.length : (t.clauses ?? 0)
}

function timeAgo(iso?: string): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(diff) || diff < 0) return '—'
  const m = Math.floor(diff / 60_000)
  if (m < 1)    return 'just now'
  if (m < 60)   return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)   return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30)   return `${d}d ago`
  const mo = Math.floor(d / 30)
  if (mo < 12)  return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const router = useRouter()

  // Data
  const { data, isLoading, isError, refetch } = useTemplates()
  const deleteMutation = useDeleteTemplate()

  // The API middleware wraps responses as `{ success, data, meta }`, but some
  // routes return the raw body. Support both so we don't silently show empty.
  const templates: ContractTemplate[] = React.useMemo(() => {
    const raw = data as unknown as
      | { templates?: ContractTemplate[]; data?: { templates?: ContractTemplate[] } }
      | undefined
    return raw?.templates ?? raw?.data?.templates ?? []
  }, [data])

  // View state (kept small, no localStorage — tabs reset cheaply)
  const [query, setQuery]             = React.useState('')
  const [categoryFilter, setCategory] = React.useState<string>('all')
  const [statusFilter, setStatus]     = React.useState<string>('all')
  const [sortBy, setSortBy]           = React.useState<SortKey>('updated')
  const [view, setView]               = React.useState<ViewMode>('grid')
  const [showFavoritesOnly, setFavOnly] = React.useState(false)

  // Favorites live in localStorage + backend; localStorage is the source of
  // truth for instant UI, the backend call below is best-effort sync.
  const [favorites, setFavorites] = React.useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      return new Set(JSON.parse(localStorage.getItem('template-favorites') || '[]'))
    } catch { return new Set() }
  })

  const toggleFavorite = React.useCallback((id: string) => {
    setFavorites(prev => {
      const next = new Set(prev)
      const willFav = !next.has(id)
      willFav ? next.add(id) : next.delete(id)
      if (typeof window !== 'undefined') {
        localStorage.setItem('template-favorites', JSON.stringify([...next]))
      }
      // Best-effort backend sync — UI stays responsive even if this fails.
      fetch(`/api/templates/${id}/favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: willFav }),
      }).catch(() => { /* ignored */ })
      return next
    })
  }, [])

  // Derived: categories for the filter dropdown
  const categories = React.useMemo(
    () => Array.from(new Set(templates.map(t => t.category).filter(Boolean))) as string[],
    [templates],
  )

  // Derived: filtered + sorted list
  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    const out = templates.filter(t => {
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false
      if (statusFilter !== 'all'   && t.status   !== statusFilter)   return false
      if (showFavoritesOnly        && !favorites.has(t.id))          return false
      if (!q) return true
      return (
        t.name?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.tags?.some(tag => tag.toLowerCase().includes(q))
      )
    })

    out.sort((a, b) => {
      if (sortBy === 'name')  return (a.name || '').localeCompare(b.name || '')
      if (sortBy === 'usage') return (b.usageCount || 0) - (a.usageCount || 0)
      // default: updated desc
      const at = new Date(a.updatedAt || a.lastModified || a.createdAt || 0).getTime()
      const bt = new Date(b.updatedAt || b.lastModified || b.createdAt || 0).getTime()
      return bt - at
    })

    return out
  }, [templates, query, categoryFilter, statusFilter, sortBy, showFavoritesOnly, favorites])

  // Stats — only the four that answer real questions
  const stats = React.useMemo(() => ({
    total:  templates.length,
    active: templates.filter(t => t.status === 'active').length,
    drafts: templates.filter(t => t.status === 'draft').length,
    usage:  templates.reduce((sum, t) => sum + (t.usageCount || 0), 0),
  }), [templates])

  // Delete flow
  const [toDelete, setToDelete] = React.useState<ContractTemplate | null>(null)
  const handleDelete = React.useCallback(async () => {
    if (!toDelete) return
    try {
      await deleteMutation.mutateAsync(toDelete.id)
      toast.success(`Deleted "${toDelete.name}"`)
      setToDelete(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete template')
    }
  }, [toDelete, deleteMutation])

  // Duplicate flow
  const handleDuplicate = React.useCallback(async (t: ContractTemplate) => {
    try {
      const res = await fetch(`/api/templates/${t.id}/duplicate`, { method: 'POST' })
      if (!res.ok) throw new Error(`Duplicate failed (${res.status})`)
      toast.success(`Duplicated "${t.name}"`)
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to duplicate')
    }
  }, [refetch])

  const activeFilterCount =
    (categoryFilter !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0) +
    (showFavoritesOnly ? 1 : 0)

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-violet-600" />
            Contract Templates
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Reusable contracts with variables and clauses. Start from a template to draft in seconds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/contracts/clauses">Clause library</Link>
          </Button>
          <Button asChild size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
            <Link href="/templates/new">
              <Plus className="h-4 w-4 mr-1.5" />
              Create template
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats — four, not twelve */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Total templates"  value={stats.total}  accent="violet" />
        <StatTile label="Active"           value={stats.active} accent="emerald" />
        <StatTile label="Drafts"           value={stats.drafts} accent="amber"   />
        <StatTile
          label="Total uses"
          value={stats.usage}
          accent="sky"
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search templates by name, description, or tag…"
            className="pl-9"
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategory}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending_approval">Review</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={v => setSortBy(v as SortKey)}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Recently updated</SelectItem>
            <SelectItem value="name">Name (A→Z)</SelectItem>
            <SelectItem value="usage">Most used</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={showFavoritesOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFavOnly(v => !v)}
          className={cn(showFavoritesOnly && 'bg-amber-500 hover:bg-amber-600 text-white')}
        >
          <Star className={cn('h-4 w-4 mr-1.5', showFavoritesOnly && 'fill-white')} />
          Favorites
        </Button>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setCategory('all'); setStatus('all'); setFavOnly(false) }}
          >
            Clear filters ({activeFilterCount})
          </Button>
        )}

        <div className="ml-auto flex items-center rounded-md border border-slate-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setView('grid')}
            className={cn(
              'p-1.5 rounded transition-colors',
              view === 'grid' ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:text-slate-700',
            )}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            className={cn(
              'p-1.5 rounded transition-colors',
              view === 'list' ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:text-slate-700',
            )}
            aria-label="List view"
          >
            <ListIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Result count / active filter summary */}
      {!isLoading && templates.length > 0 && (
        <div className="text-xs text-slate-500">
          Showing <span className="font-medium text-slate-700">{visible.length}</span>
          {visible.length !== templates.length && <> of {templates.length}</>} templates
          {query && <> matching &ldquo;{query}&rdquo;</>}
        </div>
      )}

      {/* Body */}
      {isLoading ? (
        <LoadingState view={view} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : templates.length === 0 ? (
        <EmptyLibraryState />
      ) : visible.length === 0 ? (
        <NoResultsState onClear={() => { setQuery(''); setCategory('all'); setStatus('all'); setFavOnly(false) }} />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visible.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              isFavorite={favorites.has(t.id)}
              onFavorite={() => toggleFavorite(t.id)}
              onDuplicate={() => handleDuplicate(t)}
              onDelete={() => setToDelete(t)}
              onUse={() => router.push(`/drafting?templateId=${t.id}`)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {visible.map(t => (
                <TemplateRow
                  key={t.id}
                  template={t}
                  isFavorite={favorites.has(t.id)}
                  onFavorite={() => toggleFavorite(t.id)}
                  onDuplicate={() => handleDuplicate(t)}
                  onDelete={() => setToDelete(t)}
                  onUse={() => router.push(`/drafting?templateId=${t.id}`)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={open => { if (!open) setToDelete(null) }}
        title="Delete template?"
        description={
          toDelete
            ? `"${toDelete.name}" will be permanently removed. This cannot be undone.`
            : ''
        }
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────

function StatTile(props: {
  label: string
  value: number
  accent: 'violet' | 'emerald' | 'amber' | 'sky'
  icon?: React.ReactNode
}) {
  const { label, value, accent, icon } = props
  const ring = {
    violet:  'bg-violet-50 text-violet-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber:   'bg-amber-50 text-amber-700',
    sky:     'bg-sky-50 text-sky-700',
  }[accent]

  return (
    <Card className="border-slate-200">
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
          <div className="text-2xl font-semibold text-slate-900 mt-1">
            {value.toLocaleString()}
          </div>
        </div>
        <div className={cn('h-9 w-9 rounded-full flex items-center justify-center', ring)}>
          {icon ?? <FileText className="h-4 w-4" />}
        </div>
      </CardContent>
    </Card>
  )
}

function CategoryChip({ category }: { category?: string }) {
  if (!category) return null
  const style = CATEGORY_STYLE[category] || DEFAULT_CAT
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border',
        style.bg, style.text, 'border-transparent',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
      {category}
    </span>
  )
}

function StatusBadge({ status }: { status: TemplateStatus }) {
  const s = STATUS_STYLE[status]
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', s.className)}>
      {s.label}
    </Badge>
  )
}

function RowMenu(props: {
  template: ContractTemplate
  onDuplicate: () => void
  onDelete: () => void
}) {
  const { template, onDuplicate, onDelete } = props
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700"
          aria-label="More actions"
          onClick={e => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
        <DropdownMenuItem asChild>
          <Link href={`/templates/${template.id}`}>
            <Edit2 className="h-4 w-4 mr-2" />
            Edit template
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy className="h-4 w-4 mr-2" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onDelete}
          className="text-red-600 focus:text-red-600 focus:bg-red-50"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function TemplateCard(props: {
  template: ContractTemplate
  isFavorite: boolean
  onFavorite: () => void
  onDuplicate: () => void
  onDelete: () => void
  onUse: () => void
}) {
  const { template: t, isFavorite, onFavorite, onDuplicate, onDelete, onUse } = props
  const updated = t.updatedAt || t.lastModified || t.createdAt

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <Card className="h-full flex flex-col border-slate-200 hover:border-violet-300 hover:shadow-sm transition group">
        <CardContent className="p-4 flex flex-col h-full gap-3">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/templates/${t.id}`}
              className="font-semibold text-slate-900 line-clamp-2 group-hover:text-violet-700 transition"
            >
              {t.name}
            </Link>

            <div className="flex items-center shrink-0">
              <button
                type="button"
                onClick={onFavorite}
                className="p-1.5 rounded hover:bg-slate-100"
                aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star
                  className={cn(
                    'h-4 w-4 transition',
                    isFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-300 group-hover:text-slate-400',
                  )}
                />
              </button>
              <RowMenu template={t} onDuplicate={onDuplicate} onDelete={onDelete} />
            </div>
          </div>

          {t.description && (
            <p className="text-sm text-slate-600 line-clamp-2">{t.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <CategoryChip category={t.category} />
            <StatusBadge status={t.status} />
          </div>

          <div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              {typeof t.usageCount === 'number' && t.usageCount > 0 && (
                <span className="inline-flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {t.usageCount} uses
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {timeAgo(updated)}
              </span>
            </div>

            <Button
              size="sm"
              variant="ghost"
              onClick={onUse}
              className="text-violet-700 hover:text-violet-800 hover:bg-violet-50"
            >
              Use →
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function TemplateRow(props: {
  template: ContractTemplate
  isFavorite: boolean
  onFavorite: () => void
  onDuplicate: () => void
  onDelete: () => void
  onUse: () => void
}) {
  const { template: t, isFavorite, onFavorite, onDuplicate, onDelete, onUse } = props
  const updated = t.updatedAt || t.lastModified || t.createdAt

  return (
    <div className="flex items-center gap-4 p-3 hover:bg-slate-50 transition group">
      <button
        type="button"
        onClick={onFavorite}
        className="p-1 rounded hover:bg-white"
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Star
          className={cn(
            'h-4 w-4',
            isFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-300',
          )}
        />
      </button>

      <div className="flex-1 min-w-0">
        <Link href={`/templates/${t.id}`} className="font-medium text-slate-900 hover:text-violet-700 truncate block">
          {t.name}
        </Link>
        {t.description && (
          <p className="text-xs text-slate-500 truncate">{t.description}</p>
        )}
      </div>

      <CategoryChip category={t.category} />
      <StatusBadge status={t.status} />

      <div className="hidden md:flex items-center gap-4 text-xs text-slate-500 w-40 justify-end">
        <span className="inline-flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          {t.usageCount ?? 0}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {timeAgo(updated)}
        </span>
      </div>

      <Button size="sm" variant="outline" onClick={onUse}>Use</Button>
      <RowMenu template={t} onDuplicate={onDuplicate} onDelete={onDelete} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// States
// ─────────────────────────────────────────────────────────────────────────────

function LoadingState({ view }: { view: ViewMode }) {
  const count = view === 'grid' ? 8 : 5
  return view === 'grid' ? (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="border-slate-200 animate-pulse">
          <CardContent className="p-4 space-y-3">
            <div className="h-4 bg-slate-200 rounded w-3/4" />
            <div className="h-3 bg-slate-100 rounded w-full" />
            <div className="h-3 bg-slate-100 rounded w-5/6" />
            <div className="flex gap-2 pt-2">
              <div className="h-5 bg-slate-100 rounded w-16" />
              <div className="h-5 bg-slate-100 rounded w-14" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  ) : (
    <Card><CardContent className="p-0">
      <div className="divide-y divide-slate-100">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="p-3 flex items-center gap-4 animate-pulse">
            <div className="h-4 w-4 bg-slate-200 rounded" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 rounded w-1/3" />
              <div className="h-3 bg-slate-100 rounded w-2/3" />
            </div>
            <div className="h-6 w-20 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    </CardContent></Card>
  )
}

function EmptyLibraryState() {
  return (
    <Card className="border-dashed border-2 border-slate-200">
      <CardContent className="p-12 text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-violet-50 flex items-center justify-center mb-4">
          <FileText className="h-6 w-6 text-violet-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Start your template library</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-5">
          Turn your most-used contracts into reusable templates with variables and clause blocks.
          Save hours on every new deal.
        </p>
        <Button asChild className="bg-violet-600 hover:bg-violet-700 text-white">
          <Link href="/templates/new">
            <Plus className="h-4 w-4 mr-1.5" />
            Create your first template
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function NoResultsState({ onClear }: { onClear: () => void }) {
  return (
    <Card className="border-dashed border-slate-200">
      <CardContent className="p-10 text-center">
        <Filter className="h-8 w-8 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-600 mb-3">No templates match your current filters.</p>
        <Button variant="outline" size="sm" onClick={onClear}>Clear filters</Button>
      </CardContent>
    </Card>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="border-red-200 bg-red-50">
      <CardContent className="p-6 text-center space-y-2">
        <p className="text-sm text-red-800 font-medium">Couldn&apos;t load templates.</p>
        <p className="text-xs text-red-600">
          Check your connection and try again. If this keeps happening, refresh the page.
        </p>
        <Button size="sm" variant="outline" onClick={onRetry} className="mt-2">
          <Loader2 className="h-3.5 w-3.5 mr-1.5" />
          Retry
        </Button>
      </CardContent>
    </Card>
  )
}
