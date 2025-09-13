"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export type RiskItem = { area: string; score: number; severity: "Low" | "Medium" | "High"; note?: string }
export function RiskTab({ items }: { items?: RiskItem[] }) {
  const data = items ?? [
    { area: "Liability", score: 78, severity: "High", note: "Cap missing" },
    { area: "Termination", score: 55, severity: "Medium" },
  ]
  return (
    <Card>
      <CardHeader><CardTitle>Risk Overview</CardTitle></CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {data.map((r, i) => (
            <div key={i} className="flex items-center justify-between rounded border p-3">
              <div>
                <div className="font-medium">{r.area}</div>
                {r.note && <div className="text-xs text-muted-foreground">{r.note}</div>}
              </div>
              <div className={`text-xs px-2 py-0.5 rounded ${
                r.severity === "High" ? "bg-red-100 text-red-800" :
                r.severity === "Medium" ? "bg-amber-100 text-amber-800" :
                "bg-emerald-100 text-emerald-800"
              }`}>Score {r.score}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
