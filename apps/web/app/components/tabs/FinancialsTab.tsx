"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { convertCurrency } from "@/lib/fx"

type RoleRow = {
  role: string
  uom: string
  rate: string | number
  p75: string | number
  delta: string
  currency?: string
  dailyUsd?: number
  seniority?: string
  original?: { currency?: string; uom?: string; amount?: number }
  mappingConfidence?: number
  approved?: boolean
}
type FinancialsProps = {
  summary?: { totalRoles?: number; outliers?: number; medianDelta?: string; currencies?: string }
  roles?: RoleRow[]
}

function toCSV(rows: RoleRow[]): string {
  const header = [
    'role','seniority','uom','rate','currency','dailyUsd','p75','delta','orig_amount','orig_currency','orig_uom'
  ];
  const lines = rows.map(r => [
    r.role,
    r.seniority ?? '',
    r.uom,
    String(r.rate ?? ''),
    r.currency ?? '',
    typeof r.dailyUsd === 'number' ? String(r.dailyUsd) : '',
    String(r.p75 ?? ''),
    r.delta,
    r.original?.amount ?? '',
    r.original?.currency ?? '',
    r.original?.uom ?? '',
  ].map(v => String(v).replace(/"/g,'""'))
    .map(v => /[,"]/.test(v) ? `"${v}"` : v)
    .join(','));
  return [header.join(','), ...lines].join('\n');
}

export function FinancialsTab({ summary, roles }: FinancialsProps) {
  const initial = useMemo(() => roles ?? [], [roles])
  const [rows, setRows] = useState<RoleRow[]>(initial)
  // keep local edits in sync when new data arrives (e.g., when job completes)
  // simple strategy: if no local approvals/edits yet (all undefined), reset to incoming
  const hasLocalEdits = useMemo(() => rows.some(r => r.approved !== undefined), [rows])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!hasLocalEdits) setRows(initial) }, [initial])
  const pathname = usePathname()
  const jobId = useMemo(() => {
    const m = pathname?.match(/jobs\/([^/]+)/)
    return m?.[1]
  }, [pathname])

  const onExport = () => {
    const csv = toCSV(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'rate_card_normalized.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const onCellChange = (i: number, key: keyof RoleRow, value: string) => {
    setRows(curr => curr.map((r, idx) => {
      if (idx !== i) return r
      const next: RoleRow = { ...r, [key]: value }
      // recompute derived fields when UoM or rate change
    if (key === 'uom' || key === 'rate' || key === 'currency') {
        const amt = parseFloat(String(next.rate ?? ''))
        const u = String(next.uom || '').toLowerCase()
        if (!Number.isNaN(amt)) {
          let daily = amt
          if (u === 'hour' || u === 'hr' || u === 'h') daily = amt * 8
          else if (u === 'month' || u === 'mo') daily = amt / 22
          else if (u === 'year' || u === 'yr' || u === 'annum') daily = amt / (22 * 12)
      // convert to USD if a non-USD currency is set
      const cur = (next.currency || 'USD').toUpperCase()
      const dailyUsd = convertCurrency(daily, cur, 'USD')
      next.dailyUsd = Math.round(dailyUsd)
          const bench = typeof next.p75 === 'number' ? next.p75 : 550
          const deltaNum = Math.round(((next.dailyUsd - Number(bench)) / Number(bench)) * 100)
          next.delta = `${deltaNum >= 0 ? '+' : ''}${deltaNum}%`
        }
      }
      return next
    }))
  }
  const onToggleApprove = (i: number) => {
    setRows(curr => curr.map((r, idx) => idx === i ? { ...r, approved: !r.approved } : r))
  }
  const onSave = async () => {
    if (!jobId) return
    await fetch(`/api/jobs/${jobId}/financials`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roles: rows, approved: rows.every(r => r.approved) }),
    })
  }
  const onAddRow = () => {
    setRows(curr => ([
      ...curr,
      {
        role: 'Consultant',
        seniority: 'Mid',
        uom: 'Day',
        rate: 500,
        currency: 'USD',
        dailyUsd: 500,
        p75: 550,
        delta: '-9%',
        approved: false,
      },
    ]))
  }
  const onRemoveRow = (i: number) => {
    setRows(curr => curr.filter((_, idx) => idx !== i))
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Financials</h2>
          <p className="text-sm text-muted-foreground">Benchmark baseline: USD/day · Normalization: 8h/day · 22 working days/month</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onExport}>Export CSV</Button>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{summary?.totalRoles ?? (roles?.length ?? 35)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Outliers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{summary?.outliers ?? 6}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Median Δ vs P75</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{summary?.medianDelta ?? "+3.2%"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Currencies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{summary?.currencies ?? "USD"}</div>
          </CardContent>
        </Card>
      </div>

      {/* Rate Card Table */}
      <Card>
        <CardHeader>
          <CardTitle>Rate Card</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Seniority</TableHead>
                  <TableHead>UoM</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Daily (USD)</TableHead>
                  <TableHead>P75 (USD/day)</TableHead>
                  <TableHead>Δ vs P75</TableHead>
                  <TableHead>Approved</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows ?? [
                  { role: "Analyst", uom: "Day", rate: "600", p75: "550", delta: "+9%", currency: "USD", dailyUsd: 600, seniority: "Junior" },
                  { role: "Senior Consultant", uom: "Month", rate: "9000", p75: "10000", delta: "-10%", currency: "USD", dailyUsd: 409, seniority: "Senior" },
                ]).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <input className="w-36 bg-transparent outline-none" value={r.role}
                        onChange={e => onCellChange(i, 'role', e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <input className="w-32 bg-transparent outline-none" value={r.seniority ?? ''}
                        onChange={e => onCellChange(i, 'seniority', e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <input className="w-20 bg-transparent outline-none" value={r.uom}
                        onChange={e => onCellChange(i, 'uom', e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <input className="w-32 bg-transparent outline-none" value={String(r.rate)}
                        onChange={e => onCellChange(i, 'rate', e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <select className="w-24 bg-transparent outline-none" value={r.currency ?? 'USD'}
                        onChange={e => onCellChange(i, 'currency', e.target.value)}>
                        {['USD','EUR','GBP','INR','CAD','AUD'].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {r.original ? (
                        <span className="ml-2 text-xs text-muted-foreground">({r.original.amount} {r.original.currency}/{r.original.uom})</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {typeof r.dailyUsd === 'number' ? `$${r.dailyUsd}` : '—'}
                      {typeof r.mappingConfidence === 'number' && (
                        <span className="ml-2 text-xs text-muted-foreground">conf {Math.round(r.mappingConfidence * 100)}%</span>
                      )}
                    </TableCell>
                    <TableCell>{typeof r.p75 === 'number' ? `$${r.p75}` : r.p75}</TableCell>
                    <TableCell>
                      <span className={
                        `inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ` +
                        (String(r.delta).startsWith("-")
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300")
                      }>
                        {r.delta}
                      </span>
                    </TableCell>
                    <TableCell>
                      <input type="checkbox" checked={!!r.approved} onChange={() => onToggleApprove(i)} />
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => onRemoveRow(i)}>Remove</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <div className="flex items-center justify-end gap-2 px-6 pb-4">
          <Button variant="outline" size="sm" onClick={onAddRow}>Add row</Button>
          <Button variant="outline" size="sm" onClick={() => setRows(initial)}>Reset</Button>
          <Button size="sm" onClick={onSave}>Save</Button>
        </div>
      </Card>

      {/* Chart placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Distribution (box plot)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 w-full rounded-md border border-dashed text-sm text-muted-foreground grid place-items-center">
            Chart placeholder
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
