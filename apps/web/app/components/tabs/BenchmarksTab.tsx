"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Benchmark = { metric: string; current: string | number; p50: string | number; p75: string | number; p90: string | number }
export function BenchmarksTab({ items }: { items?: Benchmark[] }) {
  const data = items ?? [
    { metric: "Analyst Day Rate", current: 600, p50: 520, p75: 550, p90: 700 },
  ]
  return (
    <Card>
      <CardHeader><CardTitle>Benchmarks</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead>Current</TableHead>
                <TableHead>P50</TableHead>
                <TableHead>P75</TableHead>
                <TableHead>P90</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((b, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{b.metric}</TableCell>
                  <TableCell>{b.current}</TableCell>
                  <TableCell>{b.p50}</TableCell>
                  <TableCell>{b.p75}</TableCell>
                  <TableCell>{b.p90}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
