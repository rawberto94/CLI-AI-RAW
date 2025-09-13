"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Finding = { rule: string; severity: "Low" | "Medium" | "High"; status: "Passed" | "Warning" | "Failed"; location?: string }
type ComplianceProps = {
  summary?: { totalChecks: number; passed: number; warnings: number; failures: number }
  findings?: Finding[]
}

export function ComplianceTab({ summary, findings }: ComplianceProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Compliance</h2>
          <p className="text-sm text-muted-foreground">Policy pack: PS-2025.3</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">Export</Button>
          <Button size="sm">Re-run checks</Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total Checks</CardTitle>
          </CardHeader>
          <CardContent>
      <div className="text-2xl font-semibold">{summary?.totalChecks ?? 128}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Passed</CardTitle>
          </CardHeader>
          <CardContent>
      <div className="text-2xl font-semibold">{summary?.passed ?? 112}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Warnings</CardTitle>
          </CardHeader>
          <CardContent>
      <div className="text-2xl font-semibold">{summary?.warnings ?? 11}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Failures</CardTitle>
          </CardHeader>
          <CardContent>
      <div className="text-2xl font-semibold">{summary?.failures ?? 5}</div>
          </CardContent>
        </Card>
      </div>

      {/* Findings table */}
      <Card>
        <CardHeader>
          <CardTitle>Findings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(findings ?? [
                  { rule: "Termination clause length", severity: "Medium", status: "Warning", location: "Section 7" },
                  { rule: "Liability cap", severity: "High", status: "Failed", location: "Section 9" },
                ]).map((f, i) => (
                  <TableRow key={i}>
                    <TableCell>{f.rule}</TableCell>
                    <TableCell>
                      <span className={
                        `inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ` +
                        (f.severity === "High"
                          ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                          : f.severity === "Medium"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300")
                      }>
                        {f.severity}
                      </span>
                    </TableCell>
                    <TableCell>{f.status}</TableCell>
                    <TableCell>{f.location ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Trend placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Trend</CardTitle>
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
