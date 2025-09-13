"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function ReportsTab({ notes }: { notes?: string[] }) {
  const data = notes ?? ["Top 5 risks consolidated", "Policy pack PS-2025.3 applied"]
  return (
    <Card>
      <CardHeader><CardTitle>Reports</CardTitle></CardHeader>
      <CardContent>
        <ul className="list-disc pl-5 text-sm text-muted-foreground">
          {data.map((n, i) => (<li key={i}>{n}</li>))}
        </ul>
      </CardContent>
    </Card>
  )
}
