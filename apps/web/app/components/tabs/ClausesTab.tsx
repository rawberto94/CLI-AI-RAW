"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export type Clause = { title: string; status: "OK" | "Needs Review" | "Missing"; snippet?: string }
export function ClausesTab({ items }: { items?: Clause[] }) {
  const data = items ?? [
    { title: "Termination", status: "Needs Review", snippet: "Either party may terminate…" },
    { title: "Liability Cap", status: "Missing" },
  ]
  return (
    <Card>
      <CardHeader><CardTitle>Clauses</CardTitle></CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {data.map((c, i) => (
            <div key={i} className="rounded border p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{c.title}</div>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  c.status === "OK" ? "bg-emerald-100 text-emerald-800" :
                  c.status === "Missing" ? "bg-red-100 text-red-800" :
                  "bg-amber-100 text-amber-800"
                }`}>{c.status}</span>
              </div>
              {c.snippet && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{c.snippet}</p>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
