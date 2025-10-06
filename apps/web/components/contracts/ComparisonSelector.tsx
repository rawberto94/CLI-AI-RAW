'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, GitCompare, Clock } from 'lucide-react'
import { Contract } from '@/lib/contracts/contracts-data-service'
import { getComparisons } from '@/lib/contracts/comparison'
import { formatDateTime } from '@/lib/utils/formatters'

interface ComparisonSelectorProps {
  contracts: Contract[]
  preselectedIds?: string[]
  onCompare: (selectedIds: string[]) => void
  onClose: () => void
}

export function ComparisonSelector({
  contracts,
  preselectedIds = [],
  onCompare,
  onClose,
}: ComparisonSelectorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(preselectedIds)
  )
  const recentComparisons = getComparisons().slice(0, 5)

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds)
    if (newSelection.has(id)) {
      newSelection.delete(id)
    } else {
      if (newSelection.size >= 4) {
        alert('You can compare up to 4 contracts at once')
        return
      }
      newSelection.add(id)
    }
    setSelectedIds(newSelection)
  }

  const handleCompare = () => {
    if (selectedIds.size < 2) {
      alert('Please select at least 2 contracts to compare')
      return
    }
    onCompare(Array.from(selectedIds))
  }

  const handleRecentComparison = (comparison: any) => {
    const ids = comparison.contracts.map((c: Contract) => c.id)
    onCompare(ids)
  }

  const canCompare = selectedIds.size >= 2 && selectedIds.size <= 4

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <GitCompare className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-semibold">Compare Contracts</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Instructions */}
        <p className="text-sm text-gray-600 mb-4">
          Select 2-4 contracts to compare side-by-side
        </p>

        {/* Selection Count */}
        <div className="mb-4">
          <Badge variant={canCompare ? 'default' : 'outline'}>
            {selectedIds.size} selected
            {selectedIds.size > 0 && selectedIds.size < 2 && ' (need at least 2)'}
            {selectedIds.size > 4 && ' (maximum 4)'}
          </Badge>
        </div>

        {/* Contract List */}
        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
          {contracts.map((contract) => {
            const isSelected = selectedIds.has(contract.id)
            return (
              <div
                key={contract.id}
                onClick={() => toggleSelection(contract.id)}
                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="mt-1 w-5 h-5 text-blue-600 rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {contract.filename || contract.originalName || 'Untitled'}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {formatDateTime(contract.uploadDate)}
                    </div>
                    {contract.extractedData?.financial?.totalValue && (
                      <div className="text-sm text-gray-600">
                        Value: $
                        {contract.extractedData.financial.totalValue.toLocaleString()}
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <Badge className="bg-blue-600 text-white">
                      Selected
                    </Badge>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Recent Comparisons */}
        {recentComparisons.length > 0 && (
          <div className="border-t pt-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-gray-500" />
              <h4 className="text-sm font-medium text-gray-700">
                Recent Comparisons
              </h4>
            </div>
            <div className="space-y-2">
              {recentComparisons.map((comparison) => (
                <button
                  key={comparison.id}
                  onClick={() => handleRecentComparison(comparison)}
                  className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="text-sm font-medium text-gray-900">
                    {comparison.name}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {comparison.contracts.length} contracts •{' '}
                    {formatDateTime(comparison.createdAt)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleCompare}
            disabled={!canCompare}
            className="flex-1"
          >
            <GitCompare className="w-4 h-4 mr-2" />
            Compare Selected ({selectedIds.size})
          </Button>
        </div>
      </div>
    </div>
  )
}
