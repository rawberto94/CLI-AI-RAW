'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useMemo } from 'react'
import { DashboardLayout } from '@/components/layout/AppLayout'
import { PageBreadcrumb } from '@/components/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  PortfolioHeatMap,
  type HeatMapRow,
} from '@/components/analytics/PortfolioHeatMap'
import {
  BarChart3,
  RefreshCcw,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ────────────────────────────────────────────────────────────────────

interface ContractExpiry {
  id: string
  title: string
  contractType?: string
  riskScore?: number
  expirationDate?: string
  totalValue?: number
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const CONTRACT_CATEGORIES = ['MSA', 'NDA', 'SOW', 'SLA', 'License', 'Employment', 'Lease', 'Procurement', 'Other']

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [contracts, setContracts] = useState<ContractExpiry[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch contracts
  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      setLoading(true)
      try {
        const res = await fetch(`/api/contracts?limit=500`)
        if (!res.ok) throw new Error('Failed to fetch')
        const json = await res.json()
        const list = json.data?.contracts || json.contracts || []
        if (!cancelled) setContracts(list)
      } catch {
        toast.error('Failed to load contract data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  // Build heatmap data: contract types × months
  const expirationHeatMap = useMemo(() => {
    const rows: HeatMapRow[] = CONTRACT_CATEGORIES.map(category => ({
      category,
      cells: MONTHS.map((label, monthIdx) => ({
        label,
        value: 0,
        details: '',
      })),
    }))

    let matched = 0
    contracts.forEach(c => {
      if (!c.expirationDate) return
      const d = new Date(c.expirationDate)
      if (d.getFullYear() !== year) return
      const month = d.getMonth()
      const type = c.contractType || 'Other'
      const catIdx = CONTRACT_CATEGORIES.findIndex(cat =>
        type.toLowerCase().includes(cat.toLowerCase())
      )
      const rowIdx = catIdx >= 0 ? catIdx : CONTRACT_CATEGORIES.length - 1
      rows[rowIdx].cells[month].value++
      matched++
    })

    // Filter out empty rows
    const filteredRows = rows.filter(r => r.cells.some(c => c.value > 0))
    return { rows: filteredRows.length > 0 ? filteredRows : rows.slice(0, 5), matched }
  }, [contracts, year])

  // Risk distribution heatmap: risk level × months
  const riskHeatMap = useMemo(() => {
    const riskBuckets = ['Critical (80-100)', 'High (60-79)', 'Medium (40-59)', 'Low (20-39)', 'Minimal (0-19)']
    const rows: HeatMapRow[] = riskBuckets.map(category => ({
      category,
      cells: MONTHS.map((label) => ({ label, value: 0 })),
    }))

    contracts.forEach(c => {
      if (!c.expirationDate) return
      const d = new Date(c.expirationDate)
      if (d.getFullYear() !== year) return
      const score = c.riskScore ?? 0
      let bucketIdx: number
      if (score >= 80) bucketIdx = 0
      else if (score >= 60) bucketIdx = 1
      else if (score >= 40) bucketIdx = 2
      else if (score >= 20) bucketIdx = 3
      else bucketIdx = 4
      rows[bucketIdx].cells[d.getMonth()].value++
    })

    return rows
  }, [contracts, year])

  // Stats
  const expiringThisYear = contracts.filter(c => {
    if (!c.expirationDate) return false
    return new Date(c.expirationDate).getFullYear() === year
  }).length
  const expiringSoon = contracts.filter(c => {
    if (!c.expirationDate) return false
    const d = new Date(c.expirationDate)
    const now = new Date()
    const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 90
  }).length

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <PageBreadcrumb items={[
          { label: 'Analytics', href: '/analytics' },
          { label: 'Portfolio', href: '/analytics/portfolio' },
        ]} />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-violet-600" />
              Portfolio Overview
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Heat map visualization of contract expirations, risk distribution, and activity across your portfolio
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[year - 1, year, year + 1, year + 2].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setYear(new Date().getFullYear())}
            >
              <RefreshCcw className="h-4 w-4 mr-1" />
              Current Year
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-violet-100 rounded-lg"><BarChart3 className="h-5 w-5 text-violet-600" /></div>
            <div><p className="text-2xl font-bold">{contracts.length}</p><p className="text-xs text-slate-500">Total Contracts</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg"><Calendar className="h-5 w-5 text-amber-600" /></div>
            <div><p className="text-2xl font-bold">{expiringThisYear}</p><p className="text-xs text-slate-500">Expiring in {year}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
            <div><p className="text-2xl font-bold">{expiringSoon}</p><p className="text-xs text-slate-500">Expiring in 90 days</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg"><TrendingUp className="h-5 w-5 text-green-600" /></div>
            <div><p className="text-2xl font-bold">{expirationHeatMap.matched}</p><p className="text-xs text-slate-500">With Expiration Dates</p></div>
          </CardContent></Card>
        </div>

        {/* Heatmaps */}
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-64 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        ) : (
          <div className="space-y-6">
            <PortfolioHeatMap
              data={expirationHeatMap.rows}
              columnLabels={MONTHS}
              title="Contract Expirations by Type"
              description={`Breakdown of expiring contracts by type and month for ${year}`}
              valueLabel="contracts"
              colorScheme="risk"
            />
            <PortfolioHeatMap
              data={riskHeatMap}
              columnLabels={MONTHS}
              title="Risk Distribution by Month"
              description={`Distribution of contract risk scores across ${year}`}
              valueLabel="contracts"
              colorScheme="activity"
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
