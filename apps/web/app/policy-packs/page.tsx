'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DashboardLayout } from '@/components/layout/AppLayout'
import { PageBreadcrumb } from '@/components/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Shield, Plus, Loader2, Search, ChevronRight, Star, Upload } from 'lucide-react'
import { toast } from 'sonner'

interface PolicyPack {
  id: string
  name: string
  description?: string | null
  version: number
  status: string
  mode: string
  isDefault: boolean
  updatedAt: string
  _count?: { rules: number; evaluations: number }
}

async function fetchPacks(): Promise<PolicyPack[]> {
  const res = await fetch('/api/policy-packs')
  if (!res.ok) throw new Error('Failed to load policy packs')
  const json = await res.json()
  return json.data?.packs || json.packs || []
}

export default function PolicyPacksPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [mode, setMode] = useState<'advisory' | 'gate'>('advisory')

  const { data: packs = [], isLoading } = useQuery({
    queryKey: ['policy-packs'],
    queryFn: fetchPacks,
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/policy-packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, mode, rules: [] }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error?.message || err.message || 'Create failed')
      }
      return res.json()
    },
    onSuccess: (json) => {
      toast.success('Policy pack created')
      setOpen(false)
      setName('')
      setDescription('')
      qc.invalidateQueries({ queryKey: ['policy-packs'] })
      const pack = json.data?.pack || json.pack
      if (pack?.id) router.push(`/policy-packs/${pack.id}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const importStarter = useMutation({
    mutationFn: async (starter: 'global-baseline' | 'data-protection' | 'consistency-checks') => {
      // Load from public path via import API with embedded starter content
      const starters: Record<string, object> = {
        'global-baseline': {
          name: 'Global Baseline (buy-side)',
          description: 'Core buy-side governance checks',
          mode: 'advisory',
          isDefault: true,
          publish: true,
          rules: [
            {
              code: 'RF-UNLIMITED-LIAB',
              title: 'No unlimited liability language',
              kind: 'PATTERN',
              severity: 'CRITICAL',
              category: 'limitation_of_liability',
              match: {
                mode: 'must_not_match',
                patterns: ['unlimited liability', 'without limitation as to amount'],
                isRegex: false,
                caseSensitive: false,
              },
            },
            {
              code: 'PAY-001',
              title: 'Payment terms must not exceed 60 days',
              kind: 'FIELD',
              severity: 'HIGH',
              category: 'payment',
              assert: { path: 'financial.paymentTermsDays', op: 'lte', value: 60, onMissing: 'flag' },
            },
            {
              code: 'CONS-DATES',
              title: 'Effective date before expiration',
              kind: 'FIELD',
              severity: 'HIGH',
              category: 'other',
              assert: {
                path: 'overview.effectiveDate',
                op: 'lt',
                pathB: 'overview.expirationDate',
                onMissing: 'pass',
              },
            },
          ],
        },
        'data-protection': {
          name: 'Data Protection',
          description: 'DPA/GDPR checks',
          mode: 'advisory',
          rules: [
            {
              code: 'DPA-003',
              title: 'Breach notification within 72 hours',
              kind: 'PATTERN',
              severity: 'CRITICAL',
              category: 'data_protection',
              match: {
                mode: 'must_match',
                patterns: ['72 hours', 'without undue delay', 'breach notification'],
                isRegex: false,
                caseSensitive: false,
              },
            },
          ],
        },
        'consistency-checks': {
          name: 'Consistency Checks',
          description: 'Zero-token internal coherence',
          mode: 'advisory',
          rules: [
            {
              code: 'CONS-DATES',
              title: 'Effective date before expiration',
              kind: 'FIELD',
              severity: 'HIGH',
              category: 'other',
              assert: {
                path: 'overview.effectiveDate',
                op: 'lt',
                pathB: 'overview.expirationDate',
                onMissing: 'pass',
              },
            },
          ],
        },
      }
      const body = starters[starter]
      const res = await fetch('/api/policy-packs/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Import failed')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Starter pack imported')
      qc.invalidateQueries({ queryKey: ['policy-packs'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const filtered = packs.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(search.toLowerCase()),
  )

  const statusBadge = (status: string) => {
    const s = status.toLowerCase()
    if (s === 'active') return <Badge className="bg-green-600">active</Badge>
    if (s === 'draft') return <Badge variant="secondary">draft</Badge>
    return <Badge variant="outline">{status}</Badge>
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <PageBreadcrumb items={[{ label: 'Policy Packs', href: '/policy-packs', current: true }]} />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-7 w-7 text-violet-600" />
              Policy Packs
            </h1>
            <p className="text-gray-500 mt-1">
              Machine-checkable rules evaluated on every contract upload
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => importStarter.mutate('global-baseline')}>
              <Upload className="h-4 w-4 mr-2" />
              Import baseline
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New pack
            </Button>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Search packs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              No policy packs yet. Create one or import the Global Baseline starter.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((pack) => (
              <Card
                key={pack.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/policy-packs/${pack.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {pack.isDefault && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
                      {pack.name}
                    </CardTitle>
                    {statusBadge(pack.status)}
                  </div>
                  <CardDescription className="line-clamp-2">
                    {pack.description || 'No description'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between text-sm text-gray-500">
                  <span>
                    v{pack.version} · {pack.mode} · {pack._count?.rules ?? 0} rules
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create policy pack</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Buy-side MSA" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div>
                <Label>Mode</Label>
                <select
                  className="w-full border rounded-md h-10 px-3 bg-background"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as 'advisory' | 'gate')}
                >
                  <option value="advisory">Advisory (flag only)</option>
                  <option value="gate">Gate (route to review on FAIL)</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!name || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
