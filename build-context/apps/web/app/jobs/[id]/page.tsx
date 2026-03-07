"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BackButton } from "@/components/ui/back-button"
import { ComplianceTab } from "@/app/components/tabs/ComplianceTab"
import { FinancialsTab } from "@/app/components/tabs/FinancialsTab"
import { BenchmarksTab } from "@/app/components/tabs/BenchmarksTab"

type JobApi = {
  id: string
  status: "queued" | "processing" | "completed" | "failed"
  progress: number
  result?: {
    kpis: { totalChecks: number; passed: number; warnings: number; failures: number }
    compliance: { findings: Array<{ rule: string; severity: string; status: string; location?: string }> }
    financials: { roles: Array<{
      role: string;
      uom: string;
      rate: string | number;
      p75: string | number;
      delta: string;
      currency?: string;
      dailyUsd?: number;
      seniority?: string;
      mappingConfidence?: number;
    }> }
  }
  error?: string
}

export default function JobPage() {
  const params = useParams()
  const id = params?.id as string
  const [data, setData] = useState<JobApi | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let timer: any
    async function poll() {
      try {
        const res = await fetch(`/api/jobs/${id}`)
        if (!res.ok) {
          setError("Job not found")
          return
        }
        const j = (await res.json()) as JobApi
        setData(j)
        if (j.status === "completed" || j.status === "failed") return
        timer = setTimeout(poll, 1000)
      } catch (e: any) {
        setError(e?.message || "Failed to fetch")
      }
    }
    if (id) poll()
    return () => clearTimeout(timer)
  }, [id])

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!data) return <p>Loading…</p>

  if (data.status !== "completed") {
    return (
      <div className="space-y-4">
        <BackButton hrefFallback="/contracts" />
        <Card>
        <CardHeader>
          <CardTitle>Processing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-2 w-full overflow-hidden rounded bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ inlineSize: `${Math.max(5, data.progress)}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Status: {data.status}</p>
        </CardContent>
        </Card>
      </div>
    )
  }

  // Present results in existing cards/tables
  return (
    <div className="space-y-4">
      <BackButton hrefFallback="/contracts" />
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <div className="text-sm text-muted-foreground">Total Checks</div>
              <div className="text-2xl font-semibold">{data.result!.kpis.totalChecks}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Passed</div>
              <div className="text-2xl font-semibold">{data.result!.kpis.passed}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ComplianceTab
        summary={data.result!.kpis}
        findings={data.result!.compliance.findings as any}
      />
      <FinancialsTab
        summary={{
          totalRoles: data.result!.financials.roles.length,
          outliers: data.result!.financials.roles.filter(r => String(r.delta).startsWith("+")).length,
          medianDelta: "—",
          currencies: "USD",
        }}
        roles={data.result!.financials.roles as any}
      />
      {/* Benchmarks derived from financial roles */}
      <BenchmarksTab
        items={(data.result!.financials.roles || []).slice(0, 6).map(r => {
          const p75Num = Number(r.p75)
          const p75 = Number.isFinite(p75Num) && p75Num > 0 ? Math.round(p75Num) : 550
          const p50 = Math.round(p75 * 0.9)
          const p90 = Math.round(p75 * 1.2)
          const current = typeof r.dailyUsd === 'number' ? r.dailyUsd : Number(r.rate)
          return {
            metric: `${r.role} (${(r as any).seniority ?? r.uom ?? ''}) Day Rate`,
            current: Number.isFinite(current) && current > 0 ? current : r.rate,
            p50,
            p75,
            p90,
          }
        })}
      />
    </div>
  )
}
