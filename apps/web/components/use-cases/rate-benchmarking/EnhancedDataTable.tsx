'use client'

import { useState } from 'react'
// eslint-disable-next-line import/order
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

interface Column<T> {
  key: string
  label: string
  sortable?: boolean
  render?: (value: T) => React.ReactNode
  align?: 'left' | 'center' | 'right'
  width?: string
}

interface EnhancedDataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  onRowClick?: (row: T) => void
  highlightRow?: (row: T) => boolean
  emptyMessage?: string
}

export function EnhancedDataTable<T extends Record<string, unknown>>({
  data,
  columns,
  onRowClick,
  highlightRow,
  emptyMessage = 'No data available'
}: EnhancedDataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  // Reserved for future expandable rows feature
  // const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(columnKey)
      setSortDirection('asc')
    }
  }

  const sortedData = [...data].sort((a, b) => {
    if (sortColumn === null) return 0

    const aVal = a[sortColumn]
    const bVal = b[sortColumn]

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal)
    }

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    }

    return 0
  })

  // Reserved for future expandable row functionality
  // const toggleRowExpansion = (index: number) => {
  //   const newExpanded = new Set(expandedRows)
  //   if (newExpanded.has(index)) {
  //     newExpanded.delete(index)
  //   } else {
  //     newExpanded.add(index)
  //   }
  //   setExpandedRows(newExpanded)
  // }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
      <table className="w-full">
        <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`py-4 px-4 text-${column.align ?? 'left'} ${
                  column.width ?? ''
                }`}
              >
                {column.sortable !== false ? (
                  <button
                    onClick={() => handleSort(column.key)}
                    className="flex items-center gap-2 font-semibold text-gray-700 hover:text-blue-600 transition-colors duration-200 group"
                  >
                    <span>{column.label}</span>
                    <div className="relative w-4 h-4">
                      {sortColumn === column.key ? (
                        sortDirection === 'asc' ? (
                          <ChevronUp className="w-4 h-4 text-blue-600" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-blue-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity" />
                      )}
                    </div>
                  </button>
                ) : (
                  <span className="font-semibold text-gray-700">
                    {column.label}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, index) => {
            const isHighlighted = highlightRow?.(row) ?? false
            // const isExpanded = expandedRows.has(index) // Reserved for future use

            return (
              <tr
                key={index}
                onClick={() => onRowClick?.(row)}
                className={`
                  border-b border-gray-100 transition-all duration-200
                  ${onRowClick !== undefined ? 'cursor-pointer' : ''}
                  ${
                    isHighlighted
                      ? 'bg-blue-50 hover:bg-blue-100'
                      : 'hover:bg-gray-50'
                  }
                  animate-fade-in
                `}
                style={{ animationDelay: `${index * 0.03}s` }}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`py-4 px-4 text-${column.align ?? 'left'}`}
                  >
                    {column.render !== undefined
                      ? column.render(row)
                      : (row[column.key] != null ? String(row[column.key]) : '')}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Utility components for common table cells
export function StatusBadge({
  status,
  label
}: {
  status: 'success' | 'warning' | 'error' | 'info'
  label: string
}) {
  const styles = {
    success: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-orange-100 text-orange-800 border-orange-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200'
  }

  return (
    <Badge className={`${styles[status]} border`} variant="outline">
      {label}
    </Badge>
  )
}

export function TrendIndicator({
  value,
  showValue = true
}: {
  value: number
  showValue?: boolean
}) {
  const isPositive = value > 0
  const isNeutral = value === 0

  return (
    <div
      className={`flex items-center gap-1 font-semibold ${
        isNeutral
          ? 'text-gray-600'
          : isPositive
          ? 'text-red-600'
          : 'text-green-600'
      }`}
    >
      {!isNeutral && (
        <span className="text-lg">
          {isPositive ? '↑' : '↓'}
        </span>
      )}
      {showValue && (
        <span>
          {isPositive ? '+' : ''}
          {value.toFixed(1)}%
        </span>
      )}
    </div>
  )
}

export function ProgressBar({
  value,
  max = 100,
  color = 'blue'
}: {
  value: number
  max?: number
  color?: 'blue' | 'green' | 'orange' | 'red'
}) {
  const percentage = Math.min((value / max) * 100, 100)

  const colors = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    orange: 'bg-orange-600',
    red: 'bg-red-600'
  }

  return (
    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
      <div
        className={`${colors[color]} h-full rounded-full transition-all duration-500 ease-out`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}
