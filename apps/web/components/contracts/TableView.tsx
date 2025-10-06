'use client'

import React, { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CheckCircle,
  AlertTriangle,
  Loader2,
  Clock,
  Eye,
  Edit3,
  MoreHorizontal,
} from 'lucide-react'
import Link from 'next/link'
import { Contract } from '@/lib/contracts/contracts-data-service'
import { TableColumn, getNestedValue } from '@/lib/contracts/table-config'
import { getContractTags, getTagById, getTagColor } from '@/lib/contracts/tags'
import { formatCurrency, formatDateTime, formatFileSize } from '@/lib/utils/formatters'
import { ContextMenu } from './ContextMenu'
import { InlineEditor } from './InlineEditor'

interface TableViewProps {
  contracts: Contract[]
  columns: TableColumn[]
  selectedIds: Set<string>
  onToggleSelection: (id: string) => void
  onSelectAll: () => void
  onClearSelection: () => void
  onSort: (columnId: string) => void
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
}

export function TableView({
  contracts,
  columns,
  selectedIds,
  onToggleSelection,
  onSelectAll,
  onClearSelection,
  onSort,
  sortBy,
  sortDirection = 'desc',
}: TableViewProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    contractId: string
  } | null>(null)
  const [editingCell, setEditingCell] = useState<{
    contractId: string
    columnId: string
  } | null>(null)

  const visibleColumns = useMemo(() => {
    return columns.filter(col => col.visible)
  }, [columns])

  const allSelected = contracts.length > 0 && contracts.every(c => selectedIds.has(c.id))
  const someSelected = selectedIds.size > 0 && !allSelected

  const handleContextMenu = (e: React.MouseEvent, contractId: string) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      contractId,
    })
  }

  const handleCellDoubleClick = (contractId: string, columnId: string) => {
    const column = columns.find(col => col.id === columnId)
    if (column?.editable) {
      setEditingCell({ contractId, columnId })
    }
  }

  const formatCellValue = (contract: Contract, column: TableColumn): React.ReactNode => {
    const value = getNestedValue(contract, column.key)

    switch (column.id) {
      case 'status':
        return <StatusBadge status={value} />
      
      case 'value':
        const currency = getNestedValue(contract, 'extractedData.financial.currency') || 'USD'
        return value ? formatCurrency(value, currency) : '-'
      
      case 'date':
        return value ? formatDateTime(value) : '-'
      
      case 'size':
        return value ? formatFileSize(value) : '-'
      
      case 'parties':
        return Array.isArray(value) ? (
          <div className="flex flex-wrap gap-1">
            {value.slice(0, 2).map((party, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {party}
              </Badge>
            ))}
            {value.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{value.length - 2}
              </Badge>
            )}
          </div>
        ) : '-'
      
      case 'risk':
      case 'compliance':
        return value !== undefined ? (
          <span className={`font-medium ${
            column.id === 'risk'
              ? value >= 80 ? 'text-red-600' : value >= 50 ? 'text-yellow-600' : 'text-green-600'
              : value >= 90 ? 'text-green-600' : value >= 70 ? 'text-blue-600' : 'text-red-600'
          }`}>
            {value}
          </span>
        ) : '-'
      
      default:
        return value || '-'
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {/* Selection Header */}
              <th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someSelected
                  }}
                  onChange={() => allSelected ? onClearSelection() : onSelectAll()}
                  className="w-4 h-4 text-blue-600 rounded"
                />
              </th>
              
              {/* Column Headers */}
              {visibleColumns.map((column) => (
                <th
                  key={column.id}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  style={{ width: column.width }}
                  onClick={() => column.sortable && onSort(column.id)}
                >
                  <div className="flex items-center gap-2">
                    {column.label}
                    {column.sortable && sortBy === column.id && (
                      <span className="text-blue-600">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
              
              {/* Actions Header */}
              <th className="w-24 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          
          <tbody className="bg-white divide-y divide-gray-200">
            {contracts.map((contract) => (
              <tr
                key={contract.id}
                className={`hover:bg-gray-50 transition-colors ${
                  selectedIds.has(contract.id) ? 'bg-blue-50' : ''
                }`}
                onContextMenu={(e) => handleContextMenu(e, contract.id)}
              >
                {/* Selection Cell */}
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(contract.id)}
                    onChange={() => onToggleSelection(contract.id)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                </td>
                
                {/* Data Cells */}
                {visibleColumns.map((column) => (
                  <td
                    key={column.id}
                    className="px-4 py-3 text-sm text-gray-900 cursor-pointer"
                    onDoubleClick={() => handleCellDoubleClick(contract.id, column.id)}
                  >
                    {editingCell?.contractId === contract.id && editingCell?.columnId === column.id ? (
                      <InlineEditor
                        value={getNestedValue(contract, column.key)}
                        onSave={(value) => {
                          // Handle save
                          setEditingCell(null)
                        }}
                        onCancel={() => setEditingCell(null)}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        {formatCellValue(contract, column)}
                        {column.id === 'name' && (
                          <div className="flex gap-1">
                            {getContractTags(contract.id).slice(0, 2).map(tagId => {
                              const tag = getTagById(tagId)
                              if (!tag) return null
                              return (
                                <Badge key={tagId} className={getTagColor(tag.color) + ' text-xs'}>
                                  {tag.name}
                                </Badge>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                ))}
                
                {/* Actions Cell */}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link href={`/contracts/${contract.id}`}>
                      <Button size="sm" variant="ghost">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCellDoubleClick(contract.id, 'name')}
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => handleContextMenu(e as any, contract.id)}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          contractId={contextMenu.contractId}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}

// Status Badge Component
function StatusBadge({ status }: { status: string }) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          className: 'bg-green-100 text-green-800',
          label: 'Completed'
        }
      case 'processing':
        return {
          icon: <Loader2 className="w-4 h-4 animate-spin" />,
          className: 'bg-blue-100 text-blue-800',
          label: 'Processing'
        }
      case 'failed':
        return {
          icon: <AlertTriangle className="w-4 h-4" />,
          className: 'bg-red-100 text-red-800',
          label: 'Failed'
        }
      default:
        return {
          icon: <Clock className="w-4 h-4" />,
          className: 'bg-gray-100 text-gray-800',
          label: 'Pending'
        }
    }
  }

  const config = getStatusConfig(status)
  
  return (
    <Badge className={config.className}>
      <div className="flex items-center gap-1">
        {config.icon}
        {config.label}
      </div>
    </Badge>
  )
}
