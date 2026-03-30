'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

export interface HeatMapCell {
  label: string
  value: number
  details?: string
}

export interface HeatMapRow {
  category: string
  cells: HeatMapCell[]
}

export interface PortfolioHeatMapProps {
  data: HeatMapRow[]
  columnLabels: string[]
  title?: string
  description?: string
  /** Label for the value shown in tooltips */
  valueLabel?: string
  /** Color scheme: 'risk' (green→red), 'activity' (light→purple) */
  colorScheme?: 'risk' | 'activity'
}

// ── Color Helpers ────────────────────────────────────────────────────────────

function getRiskColor(normalized: number): string {
  if (normalized === 0) return 'bg-slate-50 text-slate-400'
  if (normalized < 0.2) return 'bg-green-100 text-green-800'
  if (normalized < 0.4) return 'bg-lime-100 text-lime-800'
  if (normalized < 0.6) return 'bg-amber-100 text-amber-800'
  if (normalized < 0.8) return 'bg-orange-100 text-orange-800'
  return 'bg-red-100 text-red-800'
}

function getActivityColor(normalized: number): string {
  if (normalized === 0) return 'bg-slate-50 text-slate-400'
  if (normalized < 0.2) return 'bg-violet-50 text-violet-600'
  if (normalized < 0.4) return 'bg-violet-100 text-violet-700'
  if (normalized < 0.6) return 'bg-violet-200 text-violet-800'
  if (normalized < 0.8) return 'bg-violet-300 text-violet-900'
  return 'bg-violet-400 text-white'
}

// ── Component ────────────────────────────────────────────────────────────────

export function PortfolioHeatMap({
  data,
  columnLabels,
  title = 'Portfolio Heat Map',
  description,
  valueLabel = 'contracts',
  colorScheme = 'risk',
}: PortfolioHeatMapProps) {
  const { min, max } = useMemo(() => {
    const allValues = data.flatMap(r => r.cells.map(c => c.value))
    return {
      min: Math.min(0, ...allValues),
      max: Math.max(1, ...allValues),
    }
  }, [data])

  const normalize = (v: number) => (max === min ? 0 : (v - min) / (max - min))
  const getColor = colorScheme === 'risk' ? getRiskColor : getActivityColor

  // Summary stats
  const totalContracts = data.reduce((s, r) => s + r.cells.reduce((a, c) => a + c.value, 0), 0)
  const peakCell = data.reduce<{ category: string; label: string; value: number }>(
    (best, row) => {
      const maxCell = row.cells.reduce((a, c) => (c.value > a.value ? c : a), row.cells[0])
      return maxCell && maxCell.value > best.value
        ? { category: row.category, label: maxCell.label, value: maxCell.value }
        : best
    },
    { category: '', label: '', value: 0 }
  )

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <CardDescription className="text-xs mt-0.5">{description}</CardDescription>}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>Total: <strong className="text-slate-700">{totalContracts}</strong></span>
            {peakCell.category && (
              <span>
                Peak: <strong className="text-slate-700">{peakCell.value}</strong> ({peakCell.category} / {peakCell.label})
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left text-[11px] font-medium text-slate-500 py-1.5 pr-3 min-w-[120px]">
                  Category
                </th>
                {columnLabels.map(label => (
                  <th key={label} className="text-center text-[11px] font-medium text-slate-500 py-1.5 px-1 min-w-[52px]">
                    {label}
                  </th>
                ))}
                <th className="text-right text-[11px] font-medium text-slate-500 py-1.5 pl-3 min-w-[50px]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => {
                const rowTotal = row.cells.reduce((a, c) => a + c.value, 0)
                return (
                  <tr key={row.category} className="group">
                    <td className="text-xs font-medium text-slate-700 py-1 pr-3 whitespace-nowrap">
                      {row.category}
                    </td>
                    {row.cells.map((cell, i) => (
                      <td key={i} className="p-0.5">
                        <div
                          className={cn(
                            'rounded-md text-center text-xs font-semibold py-2 px-1 transition-transform hover:scale-105 cursor-default',
                            getColor(normalize(cell.value))
                          )}
                          title={`${cell.label}: ${cell.value} ${valueLabel}${cell.details ? ` — ${cell.details}` : ''}`}
                        >
                          {cell.value > 0 ? cell.value : '–'}
                        </div>
                      </td>
                    ))}
                    <td className="text-right text-xs font-semibold text-slate-700 py-1 pl-3">
                      {rowTotal}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-500 mr-1">Low</span>
            {[0, 0.2, 0.4, 0.6, 0.8, 1].map(v => (
              <div key={v} className={cn('w-5 h-3 rounded-sm', getColor(v))} />
            ))}
            <span className="text-[10px] text-slate-500 ml-1">High</span>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {data.length} categories × {columnLabels.length} periods
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
