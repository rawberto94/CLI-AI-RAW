'use client'

import React, { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { DashboardLayout } from '@/components/layout/AppLayout'
import { PageBreadcrumb } from '@/components/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  BookOpen,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Shield,
  AlertTriangle,
  Target,
  Loader2,
  Search,
  Copy,
  Star,
  ChevronRight,
  FileText,
  Scale,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ── Types ────────────────────────────────────────────────────────────────────

interface PlaybookClause {
  id: string
  category: string
  name: string
  preferredText: string
  minimumAcceptable?: string
  walkawayTriggers: string[]
  riskLevel: string
  notes?: string
  negotiationGuidance?: string
  sortOrder: number
  isActive: boolean
}

interface PlaybookRedFlag {
  id: string
  pattern: string
  category: string
  severity: string
  explanation: string
  suggestion: string
  isRegex: boolean
  isActive: boolean
}

interface Playbook {
  id: string
  name: string
  description?: string
  contractTypes: string[]
  isDefault: boolean
  isActive: boolean
  version: number
  criticalCountThreshold: number
  highRiskScoreThreshold: number
  acceptableScoreThreshold: number
  preferredLanguage: Record<string, string>
  clauses?: PlaybookClause[]
  redFlags?: PlaybookRedFlag[]
  createdAt: string
  updatedAt: string
  _count?: { clauses: number; redFlags: number; reviews: number }
}

// ── API Hooks ────────────────────────────────────────────────────────────────

function usePlaybooks() {
  return useQuery<Playbook[]>({
    queryKey: ['playbooks'],
    queryFn: async () => {
      const res = await fetch('/api/playbooks')
      if (!res.ok) throw new Error('Failed to fetch playbooks')
      const data = await res.json()
      return data.data?.playbooks || data.playbooks || []
    },
  })
}

function usePlaybook(id: string | null) {
  return useQuery<Playbook>({
    queryKey: ['playbook', id],
    queryFn: async () => {
      const res = await fetch(`/api/playbooks/${id}`)
      if (!res.ok) throw new Error('Failed to fetch playbook')
      const data = await res.json()
      return data.data?.playbook || data.playbook
    },
    enabled: !!id,
  })
}

// ── Constants ────────────────────────────────────────────────────────────────

const CONTRACT_TYPES = ['MSA', 'NDA', 'SOW', 'SLA', 'License', 'Employment', 'Lease', 'Procurement', 'Distribution', 'Partnership']
const CLAUSE_CATEGORIES = ['liability', 'indemnification', 'termination', 'confidentiality', 'ip_ownership', 'warranty', 'limitation_of_liability', 'force_majeure', 'governing_law', 'dispute_resolution', 'non_compete', 'non_solicitation', 'data_protection', 'payment_terms', 'insurance']
const RISK_LEVELS = ['critical', 'high', 'medium', 'low']
const SEVERITY_LEVELS = ['critical', 'high', 'medium', 'low']

const RISK_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-green-100 text-green-700 border-green-200',
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function PlaybooksPage() {
  const queryClient = useQueryClient()
  const { data: playbooks = [], isLoading } = usePlaybooks()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Playbook | null>(null)

  // Fetch detail when viewing
  const { data: detailPlaybook, isLoading: detailLoading } = usePlaybook(detailId)

  // ── Mutations ────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/playbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create playbook')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbooks'] })
      setCreateOpen(false)
      toast.success('Playbook created')
    },
    onError: () => toast.error('Failed to create playbook'),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/playbooks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update playbook')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbooks'] })
      setEditId(null)
      toast.success('Playbook updated')
    },
    onError: () => toast.error('Failed to update playbook'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/playbooks/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete playbook')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbooks'] })
      setDeleteTarget(null)
      toast.success('Playbook deleted')
    },
    onError: () => toast.error('Failed to delete playbook'),
  })

  const duplicateMutation = useMutation({
    mutationFn: async (playbook: Playbook) => {
      const res = await fetch('/api/playbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${playbook.name} (Copy)`,
          description: playbook.description,
          contractTypes: playbook.contractTypes,
          riskThresholds: {
            criticalCountThreshold: playbook.criticalCountThreshold,
            highRiskScoreThreshold: playbook.highRiskScoreThreshold,
            acceptableScoreThreshold: playbook.acceptableScoreThreshold,
          },
        }),
      })
      if (!res.ok) throw new Error('Failed to duplicate')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playbooks'] })
      toast.success('Playbook duplicated')
    },
    onError: () => toast.error('Failed to duplicate playbook'),
  })

  // ── Filter ───────────────────────────────────────────────────────────────

  const filtered = playbooks.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  )

  // ── Render Helpers ───────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <PageBreadcrumb items={[{ label: 'Playbooks', href: '/playbooks' }]} />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-violet-600" />
              Legal Playbooks
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Define preferred clauses, risk thresholds, and negotiation positions for automated contract review
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="bg-violet-600 hover:bg-violet-700 text-white">
            <Plus className="h-4 w-4 mr-2" />
            New Playbook
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search playbooks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="border-slate-200">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-lg"><BookOpen className="h-5 w-5 text-violet-600" /></div>
              <div><p className="text-2xl font-bold">{playbooks.length}</p><p className="text-xs text-slate-500">Total Playbooks</p></div>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg"><Star className="h-5 w-5 text-green-600" /></div>
              <div><p className="text-2xl font-bold">{playbooks.filter(p => p.isDefault).length}</p><p className="text-xs text-slate-500">Default</p></div>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg"><Shield className="h-5 w-5 text-amber-600" /></div>
              <div><p className="text-2xl font-bold">{playbooks.reduce((s, p) => s + (p._count?.clauses || p.clauses?.length || 0), 0)}</p><p className="text-xs text-slate-500">Total Clauses</p></div>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
              <div><p className="text-2xl font-bold">{playbooks.reduce((s, p) => s + (p._count?.redFlags || p.redFlags?.length || 0), 0)}</p><p className="text-xs text-slate-500">Red Flags</p></div>
            </CardContent>
          </Card>
        </div>

        {/* Playbook Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed border-slate-300">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <BookOpen className="h-12 w-12 text-slate-300 mb-4" />
              <h3 className="font-semibold text-slate-700 mb-1">
                {search ? 'No playbooks match your search' : 'No playbooks yet'}
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                {search ? 'Try a different search term' : 'Create your first legal playbook to standardize contract review'}
              </p>
              {!search && (
                <Button onClick={() => setCreateOpen(true)} variant="outline">
                  <Plus className="h-4 w-4 mr-2" /> Create Playbook
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}
          >
            <AnimatePresence mode="popLayout">
              {filtered.map((playbook) => (
                <motion.div
                  key={playbook.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <Card
                    className="border-slate-200 hover:border-violet-300 hover:shadow-md transition-all cursor-pointer group"
                    onClick={() => setDetailId(playbook.id)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base truncate flex items-center gap-2">
                            {playbook.name}
                            {playbook.isDefault && (
                              <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">Default</Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="text-xs line-clamp-2 mt-1">
                            {playbook.description || 'No description'}
                          </CardDescription>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onSelect={() => setEditId(playbook.id)}>
                              <Pencil className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => duplicateMutation.mutate(playbook)}>
                              <Copy className="h-4 w-4 mr-2" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => setDeleteTarget(playbook)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {/* Contract Types */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {(playbook.contractTypes as string[]).slice(0, 4).map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0">
                            {t}
                          </Badge>
                        ))}
                        {(playbook.contractTypes as string[]).length > 4 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-400">
                            +{(playbook.contractTypes as string[]).length - 4}
                          </Badge>
                        )}
                      </div>

                      {/* Metrics */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-50 rounded-md p-2">
                          <p className="text-sm font-semibold">{playbook._count?.clauses || playbook.clauses?.length || 0}</p>
                          <p className="text-[10px] text-slate-500">Clauses</p>
                        </div>
                        <div className="bg-slate-50 rounded-md p-2">
                          <p className="text-sm font-semibold">{playbook._count?.redFlags || playbook.redFlags?.length || 0}</p>
                          <p className="text-[10px] text-slate-500">Red Flags</p>
                        </div>
                        <div className="bg-slate-50 rounded-md p-2">
                          <p className="text-sm font-semibold">{playbook._count?.reviews || 0}</p>
                          <p className="text-[10px] text-slate-500">Reviews</p>
                        </div>
                      </div>

                      {/* Risk Thresholds */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                        <span>Risk threshold: {playbook.highRiskScoreThreshold}+</span>
                        <span className="flex items-center gap-1 text-violet-600 group-hover:text-violet-700">
                          View <ChevronRight className="h-3 w-3" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ═══ Create/Edit Dialog ═══ */}
        <PlaybookFormDialog
          open={createOpen || !!editId}
          onOpenChange={(open) => {
            if (!open) { setCreateOpen(false); setEditId(null) }
          }}
          editId={editId}
          onSubmit={(data) => {
            if (editId) {
              updateMutation.mutate({ id: editId, data })
            } else {
              createMutation.mutate(data)
            }
          }}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
        />

        {/* ═══ Detail Dialog ═══ */}
        <Dialog open={!!detailId} onOpenChange={(open) => { if (!open) setDetailId(null) }}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            {detailLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-violet-500" /></div>
            ) : detailPlaybook ? (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-violet-600" />
                    {detailPlaybook.name}
                    {detailPlaybook.isDefault && (
                      <Badge className="bg-green-100 text-green-700 border-0 text-xs">Default</Badge>
                    )}
                  </DialogTitle>
                  <DialogDescription>{detailPlaybook.description || 'No description'}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                  {/* Contract Types */}
                  <div>
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Contract Types</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {(detailPlaybook.contractTypes as string[]).map(t => (
                        <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                      ))}
                      {(detailPlaybook.contractTypes as string[]).length === 0 && (
                        <span className="text-sm text-slate-400">All types</span>
                      )}
                    </div>
                  </div>

                  {/* Risk Thresholds */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-red-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-red-700">{detailPlaybook.criticalCountThreshold}</p>
                      <p className="text-[11px] text-red-600">Critical Threshold</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-orange-700">{detailPlaybook.highRiskScoreThreshold}</p>
                      <p className="text-[11px] text-orange-600">High Risk Score</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-green-700">{detailPlaybook.acceptableScoreThreshold}</p>
                      <p className="text-[11px] text-green-600">Acceptable Score</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Clauses */}
                  <div>
                    <h3 className="font-semibold text-sm flex items-center gap-2 mb-2">
                      <Scale className="h-4 w-4 text-violet-600" />
                      Playbook Clauses ({detailPlaybook.clauses?.length || 0})
                    </h3>
                    {detailPlaybook.clauses && detailPlaybook.clauses.length > 0 ? (
                      <div className="space-y-2">
                        {detailPlaybook.clauses.map((clause) => (
                          <div key={clause.id} className="border rounded-lg p-3 text-sm">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium">{clause.name}</span>
                              <Badge className={cn('text-[10px] border', RISK_COLORS[clause.riskLevel])}>
                                {clause.riskLevel}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500 mb-1">Category: {clause.category}</p>
                            <p className="text-xs text-slate-600 line-clamp-2">{clause.preferredText}</p>
                            {clause.negotiationGuidance && (
                              <p className="text-xs text-violet-600 mt-1 italic">{clause.negotiationGuidance}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">No clauses defined yet</p>
                    )}
                  </div>

                  <Separator />

                  {/* Red Flags */}
                  <div>
                    <h3 className="font-semibold text-sm flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      Red Flags ({detailPlaybook.redFlags?.length || 0})
                    </h3>
                    {detailPlaybook.redFlags && detailPlaybook.redFlags.length > 0 ? (
                      <div className="space-y-2">
                        {detailPlaybook.redFlags.map((rf) => (
                          <div key={rf.id} className="border border-red-100 bg-red-50/50 rounded-lg p-3 text-sm">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-red-800">{rf.category}</span>
                              <Badge className={cn('text-[10px] border', RISK_COLORS[rf.severity])}>
                                {rf.severity}
                              </Badge>
                            </div>
                            <p className="text-xs text-red-700 font-mono">{rf.pattern}</p>
                            <p className="text-xs text-slate-600 mt-1">{rf.explanation}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">No red flags defined yet</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400 py-8 text-center">Playbook not found</p>
            )}
          </DialogContent>
        </Dialog>

        {/* ═══ Delete Confirmation ═══ */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Playbook</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}

// ── Form Dialog Component ────────────────────────────────────────────────────

function PlaybookFormDialog({
  open,
  onOpenChange,
  editId,
  onSubmit,
  isSubmitting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editId: string | null
  onSubmit: (data: Record<string, unknown>) => void
  isSubmitting: boolean
}) {
  const { data: existingPlaybook } = usePlaybook(editId)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [isDefault, setIsDefault] = useState(false)
  const [riskHigh, setRiskHigh] = useState(70)
  const [riskAcceptable, setRiskAcceptable] = useState(40)
  const [criticalCount, setCriticalCount] = useState(2)

  // Populate form when editing
  React.useEffect(() => {
    if (existingPlaybook) {
      setName(existingPlaybook.name)
      setDescription(existingPlaybook.description || '')
      setSelectedTypes(existingPlaybook.contractTypes as string[])
      setIsDefault(existingPlaybook.isDefault)
      setRiskHigh(existingPlaybook.highRiskScoreThreshold)
      setRiskAcceptable(existingPlaybook.acceptableScoreThreshold)
      setCriticalCount(existingPlaybook.criticalCountThreshold)
    } else if (!editId) {
      setName('')
      setDescription('')
      setSelectedTypes([])
      setIsDefault(false)
      setRiskHigh(70)
      setRiskAcceptable(40)
      setCriticalCount(2)
    }
  }, [existingPlaybook, editId])

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('Playbook name is required')
      return
    }
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      contractTypes: selectedTypes,
      isDefault,
      riskThresholds: {
        highRiskScoreThreshold: riskHigh,
        acceptableScoreThreshold: riskAcceptable,
        criticalCountThreshold: criticalCount,
      },
    })
  }

  const toggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editId ? 'Edit Playbook' : 'Create New Playbook'}</DialogTitle>
          <DialogDescription>
            {editId ? 'Update playbook settings and thresholds' : 'Define a legal playbook for standardized contract review'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Name */}
          <div>
            <Label htmlFor="pb-name">Name</Label>
            <Input id="pb-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Standard SaaS Review" />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="pb-desc">Description</Label>
            <Textarea id="pb-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this playbook covers..." rows={2} />
          </div>

          {/* Contract Types */}
          <div>
            <Label>Contract Types (leave empty for all types)</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {CONTRACT_TYPES.map((type) => (
                <Badge
                  key={type}
                  variant={selectedTypes.includes(type) ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer transition-colors',
                    selectedTypes.includes(type)
                      ? 'bg-violet-600 hover:bg-violet-700 text-white'
                      : 'hover:bg-violet-50'
                  )}
                  onClick={() => toggleType(type)}
                >
                  {type}
                </Badge>
              ))}
            </div>
          </div>

          {/* Default Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Default Playbook</Label>
              <p className="text-xs text-slate-500">Use as the default for legal reviews</p>
            </div>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </div>

          <Separator />

          {/* Risk Thresholds */}
          <div>
            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Risk Thresholds</Label>
            <div className="grid grid-cols-3 gap-3 mt-2">
              <div>
                <Label htmlFor="risk-critical" className="text-xs">Critical Count</Label>
                <Input id="risk-critical" type="number" min={1} max={10} value={criticalCount} onChange={(e) => setCriticalCount(Number(e.target.value))} />
              </div>
              <div>
                <Label htmlFor="risk-high" className="text-xs">High Risk Score</Label>
                <Input id="risk-high" type="number" min={0} max={100} value={riskHigh} onChange={(e) => setRiskHigh(Number(e.target.value))} />
              </div>
              <div>
                <Label htmlFor="risk-accept" className="text-xs">Acceptable Score</Label>
                <Input id="risk-accept" type="number" min={0} max={100} value={riskAcceptable} onChange={(e) => setRiskAcceptable(Number(e.target.value))} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim()}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editId ? 'Save Changes' : 'Create Playbook'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
