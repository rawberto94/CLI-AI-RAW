'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Save,
  Trash2,
  Star,
  Plus,
  X,
  Check,
} from 'lucide-react'
import {
  getSavedFilters,
  saveFilterPreset,
  deleteFilterPreset,
  setDefaultFilter,
  createDefaultPresets,
  type SavedFilter,
} from '@/lib/contracts/saved-filters'
import { type FilterOptions } from './ContractFiltersPanel'

interface SavedFiltersPanelProps {
  currentFilters: FilterOptions
  onApply: (filters: FilterOptions) => void
  onClose?: () => void
}

export function SavedFiltersPanel({
  currentFilters,
  onApply,
  onClose,
}: SavedFiltersPanelProps) {
  const [filters, setFilters] = useState<SavedFilter[]>([])
  const [showSave, setShowSave] = useState(false)
  const [newFilterName, setNewFilterName] = useState('')
  const [newFilterDesc, setNewFilterDesc] = useState('')

  useEffect(() => {
    loadFilters()
  }, [])

  const loadFilters = () => {
    let savedFilters = getSavedFilters()
    
    // Create default presets if none exist
    if (savedFilters.length === 0) {
      createDefaultPresets()
      savedFilters = getSavedFilters()
    }
    
    setFilters(savedFilters)
  }

  const handleSave = () => {
    if (!newFilterName.trim()) return

    saveFilterPreset(newFilterName.trim(), currentFilters, newFilterDesc.trim() || undefined)
    setNewFilterName('')
    setNewFilterDesc('')
    setShowSave(false)
    loadFilters()
  }

  const handleDelete = (id: string) => {
    if (confirm('Delete this filter preset?')) {
      deleteFilterPreset(id)
      loadFilters()
    }
  }

  const handleSetDefault = (id: string) => {
    setDefaultFilter(id)
    loadFilters()
  }

  const getActiveFilterCount = (filterOptions: FilterOptions): number => {
    let count = 0
    if (filterOptions.search) count++
    if (filterOptions.status?.length) count++
    if (filterOptions.contractType?.length) count++
    if (filterOptions.clients?.length) count++
    if (filterOptions.suppliers?.length) count++
    if (filterOptions.riskLevel?.length) count++
    if (filterOptions.dateRange?.from || filterOptions.dateRange?.to) count++
    if (filterOptions.valueRange?.min || filterOptions.valueRange?.max) count++
    if (filterOptions.complianceScore?.min || filterOptions.complianceScore?.max) count++
    return count
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Save className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold">Saved Filters</h3>
          <Badge variant="outline" className="text-xs">
            {filters.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowSave(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Save Current
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Save New Filter Form */}
      {showSave && (
        <div className="p-4 border-b border-gray-100 bg-blue-50 space-y-3">
          <Input
            placeholder="Filter name (e.g., High Value Contracts)"
            value={newFilterName}
            onChange={(e) => setNewFilterName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <Input
            placeholder="Description (optional)"
            value={newFilterDesc}
            onChange={(e) => setNewFilterDesc(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <div className="flex gap-2">
            <Button onClick={handleSave} size="sm" className="flex-1">
              <Check className="w-4 h-4 mr-1" />
              Save
            </Button>
            <Button onClick={() => setShowSave(false)} variant="outline" size="sm">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Filters List */}
      <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
        {filters.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Save className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No saved filters yet</p>
            <p className="text-sm">Save your current filters to reuse them later</p>
          </div>
        ) : (
          filters.map((filter) => (
            <div
              key={filter.id}
              className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors group"
            >
              {/* Default Star */}
              <button
                onClick={() => handleSetDefault(filter.id)}
                className="mt-1"
                title={filter.isDefault ? 'Default filter' : 'Set as default'}
              >
                <Star
                  className={`w-4 h-4 ${
                    filter.isDefault
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300 group-hover:text-gray-400'
                  }`}
                />
              </button>

              {/* Filter Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-gray-900">{filter.name}</h4>
                  <Badge variant="outline" className="text-xs">
                    {getActiveFilterCount(filter.filters)} filters
                  </Badge>
                  {filter.isDefault && (
                    <Badge className="text-xs bg-yellow-100 text-yellow-800">
                      Default
                    </Badge>
                  )}
                </div>
                {filter.description && (
                  <p className="text-sm text-gray-600">{filter.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Updated {new Date(filter.updatedAt).toLocaleDateString()}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onApply(filter.filters)}
                >
                  Apply
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(filter.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
