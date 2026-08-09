'use client'

import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DashboardLayout } from '@/components/layout/AppLayout'
import { PageBreadcrumb } from '@/components/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Loader2, ArrowLeft, Plus, Rocket, FlaskConical } from 'lucide-react'
import { toast } from 'sonner'

export default function PolicyPackDetailPage() {
  const params = useParams()
  const id = String(params?.id || '')
  const router = useRouter()
  const qc = useQueryClient()
  const [ruleOpen, setRuleOpen] = useState(false)
  const [ruleForm, setRuleForm] = useState({
    code: '',
    title: '',
    kind: 'PATTERN',
    severity: 'HIGH',
    category: 'other',
    pattern: '',
    mode: 'must_not_match',
  })
  const [testText, setTestText] = useState('')
  const [testResult, setTestResult] = useState<string | null>(null)

  const { data: pack, isLoading } = useQuery({
    queryKey: ['policy-pack', id],
    queryFn: async () => {
      const res = await fetch(`/api/policy-packs/${id}`)
      if (!res.ok) throw new Error('Failed to load pack')
      const json = await res.json()
      return json.data?.pack || json.pack
    },
    enabled: Boolean(id),
  })

  const publish = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/policy-packs/${id}/publish`, { method: 'POST' })
      if (!res.ok) throw new Error('Publish failed')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Pack published')
      qc.invalidateQueries({ queryKey: ['policy-pack', id] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const dryRun = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/policy-packs/${id}/dry-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleSize: 20 }),
      })
      if (!res.ok) throw new Error('Dry-run failed')
      return res.json()
    },
    onSuccess: (json) => {
      const s = json.data?.summary || json.summary
      toast.success(
        `Dry-run: ${s?.fail ?? 0} fail, ${s?.review ?? 0} review, ${s?.pass ?? 0} pass (avg ${s?.avgPolicyScore ?? '—'})`,
      )
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const addRule = useMutation({
    mutationFn: async () => {
      const body: any = {
        code: ruleForm.code,
        title: ruleForm.title,
        kind: ruleForm.kind,
        severity: ruleForm.severity,
        category: ruleForm.category,
      }
      if (ruleForm.kind === 'PATTERN') {
        body.match = {
          mode: ruleForm.mode,
          patterns: [ruleForm.pattern],
          isRegex: false,
          caseSensitive: false,
        }
      }
      const res = await fetch(`/api/policy-packs/${id}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error?.message || 'Add rule failed')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Rule added')
      setRuleOpen(false)
      qc.invalidateQueries({ queryKey: ['policy-pack', id] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const runLocalPatternTest = () => {
    if (!ruleForm.pattern || !testText) {
      setTestResult('Enter pattern and sample text')
      return
    }
    const re = new RegExp(ruleForm.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    const matched = re.test(testText)
    if (ruleForm.mode === 'must_not_match') {
      setTestResult(matched ? 'VIOLATION — forbidden pattern found' : 'PASS — pattern not present')
    } else {
      setTestResult(matched ? 'PASS — required pattern found' : 'MISSING — required pattern not found')
    }
  }

  if (isLoading || !pack) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </div>
      </DashboardLayout>
    )
  }

  const rules = pack.rules || []

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <PageBreadcrumb
          items={[
            { label: 'Policy Packs', href: '/policy-packs' },
            { label: pack.name, href: `/policy-packs/${id}`, current: true },
          ]}
        />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => router.push('/policy-packs')}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <h1 className="text-2xl font-bold">{pack.name}</h1>
            <p className="text-gray-500 mt-1">{pack.description || 'No description'}</p>
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary">{pack.status}</Badge>
              <Badge variant="outline">{pack.mode}</Badge>
              <Badge variant="outline">v{pack.version}</Badge>
              <span className="text-sm text-gray-500">{rules.length} rules</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => dryRun.mutate()} disabled={dryRun.isPending}>
              {dryRun.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FlaskConical className="h-4 w-4 mr-2" />}
              Dry-run
            </Button>
            {pack.status === 'draft' && (
              <Button onClick={() => publish.mutate()} disabled={publish.isPending}>
                {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Rocket className="h-4 w-4 mr-2" />}
                Publish
              </Button>
            )}
            {pack.status !== 'active' && (
              <Button variant="secondary" onClick={() => setRuleOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add rule
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rules.length === 0 ? (
              <p className="text-gray-500 text-sm">No rules yet.</p>
            ) : (
              rules.map((r: any) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border"
                >
                  <div>
                    <p className="font-mono text-xs text-gray-500">{r.code}</p>
                    <p className="font-medium">{r.title}</p>
                    <p className="text-xs text-gray-500">
                      {r.kind} · {r.category}
                      {!r.isActive && ' · inactive'}
                    </p>
                  </div>
                  <Badge
                    variant={
                      ['CRITICAL', 'BLOCKER'].includes(String(r.severity).toUpperCase())
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {r.severity}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add rule</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Code</Label>
                <Input value={ruleForm.code} onChange={(e) => setRuleForm({ ...ruleForm, code: e.target.value })} placeholder="RF-EXAMPLE" />
              </div>
              <div>
                <Label>Title</Label>
                <Input value={ruleForm.title} onChange={(e) => setRuleForm({ ...ruleForm, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Severity</Label>
                  <select
                    className="w-full border rounded-md h-10 px-2 bg-background"
                    value={ruleForm.severity}
                    onChange={(e) => setRuleForm({ ...ruleForm, severity: e.target.value })}
                  >
                    {['BLOCKER', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Category</Label>
                  <Input value={ruleForm.category} onChange={(e) => setRuleForm({ ...ruleForm, category: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Pattern (must not match)</Label>
                <Input
                  value={ruleForm.pattern}
                  onChange={(e) => setRuleForm({ ...ruleForm, pattern: e.target.value })}
                  placeholder="unlimited liability"
                />
              </div>
              <div>
                <Label>Test against text (local, free)</Label>
                <Textarea value={testText} onChange={(e) => setTestText(e.target.value)} rows={3} />
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={runLocalPatternTest}>
                  Test pattern
                </Button>
                {testResult && <p className="text-sm mt-2 font-medium">{testResult}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRuleOpen(false)}>Cancel</Button>
              <Button disabled={!ruleForm.code || !ruleForm.title || addRule.isPending} onClick={() => addRule.mutate()}>
                {addRule.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
