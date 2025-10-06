'use client'

import { useState } from 'react'
// eslint-disable-next-line import/order
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface FilterOption {
  id: string
  label: string
  count?: number
}

export interface FilterGroup {
  id: string
  label: string
  options: FilterOption[]
  multiSelect?: boolean
}

interface FilterPanelProps {
  filterGroups: FilterGroup[]
  selectedFilters: Record<string, string[]>
  onFilterChange: (groupId: string, optionIds: string[]) => void
  onClearAll: () => void
  collapsible?: boolean
}

export function FilterPanel({
  filterGroups,
  selectedFilters,
  onFilterChange,
  onClearAll,
  collapsible = true
}: FilterPanelProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(filterGroups.map((g) => g.id))
  )

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId)
    } else {
      newExpanded.add(groupId)
    }
    setExpandedGroups(newExpanded)
  }

  const handleOptionToggle = (groupId: string, optionId: string) => {
    const group = filterGroups.find((g) => g.id === groupId)
    if (group === undefined) return

    const currentSelections = selectedFilters[groupId] ?? []

    if (group.multiSelect !== false) {
      // Multi-select: toggle the option
      const newSelections = currentSelections.includes(optionId)
        ? currentSelections.filter((id) => id !== optionId)
        : [...currentSelections, optionId]
      onFilterChange(groupId, newSelections)
    } else {
      // Single-select: replace with new selection
      const newSelections = currentSelections.includes(optionId) ? [] : [optionId]
      onFilterChange(groupId, newSelections)
    }
  }

  const totalSelectedCount = Object.values(selectedFilters).reduce(
    (sum, selections) => sum + selections.length,
    0
  )

  return (
    <Card className="shadow-md border-2 border-gray-200">
      <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-600" />
            <span>Filters</span>
            {totalSelectedCount > 0 && (
              <Badge className="bg-blue-600 text-white">
                {totalSelectedCount}
              </Badge>
            )}
          </div>
          {totalSelectedCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X className="w-4 h-4 mr-1" />
              Clear All
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {filterGroups.map((group) => {
          const isExpanded = expandedGroups.has(group.id)
          const selectedCount = selectedFilters[group.id]?.length ?? 0

          return (
            <div
              key={group.id}
              className="border-b border-gray-200 last:border-0 pb-4 last:pb-0"
            >
              {/* Group Header */}
              <button
                onClick={() => collapsible && toggleGroup(group.id)}
                className="w-full flex items-center justify-between mb-3 hover:text-blue-600 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-gray-700">
                    {group.label}
                  </span>
                  {selectedCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {selectedCount}
                    </Badge>
                  )}
                </div>
                {collapsible && (
                  <div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                )}
              </button>

              {/* Group Options */}
              {isExpanded && (
                <div className="space-y-2 animate-fade-in">
                  {group.options.map((option) => {
                    const isSelected =
                      selectedFilters[group.id]?.includes(option.id) ?? false

                    return (
                      <button
                        key={option.id}
                        onClick={() => handleOptionToggle(group.id, option.id)}
                        className={`
                          w-full flex items-center justify-between p-2 rounded-lg
                          transition-all duration-200
                          ${
                            isSelected
                              ? 'bg-blue-50 border-2 border-blue-200 text-blue-900'
                              : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100 hover:border-gray-200'
                          }
                        `}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`
                              w-4 h-4 rounded border-2 flex items-center justify-center
                              transition-all duration-200
                              ${
                                isSelected
                                  ? 'bg-blue-600 border-blue-600'
                                  : 'border-gray-300'
                              }
                            `}
                          >
                            {isSelected && (
                              <svg
                                className="w-3 h-3 text-white"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm font-medium">
                            {option.label}
                          </span>
                        </div>
                        {option.count !== undefined && (
                          <Badge
                            variant="outline"
                            className="text-xs bg-white"
                          >
                            {option.count}
                          </Badge>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// Active filters display component
export function ActiveFilters({
  filterGroups,
  selectedFilters,
  onRemoveFilter,
  onClearAll
}: {
  filterGroups: FilterGroup[]
  selectedFilters: Record<string, string[]>
  onRemoveFilter: (groupId: string, optionId: string) => void
  onClearAll: () => void
}) {
  const activeFilters: Array<{
    groupId: string
    groupLabel: string
    optionId: string
    optionLabel: string
  }> = []

  Object.entries(selectedFilters).forEach(([groupId, optionIds]) => {
    const group = filterGroups.find((g) => g.id === groupId)
    if (group === undefined) return

    optionIds.forEach((optionId) => {
      const option = group.options.find((o) => o.id === optionId)
      if (option !== undefined) {
        activeFilters.push({
          groupId,
          groupLabel: group.label,
          optionId,
          optionLabel: option.label
        })
      }
    })
  })

  if (activeFilters.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <span className="text-sm font-semibold text-gray-700">
        Active Filters:
      </span>
      {activeFilters.map((filter, index) => (
        <Badge
          key={index}
          className="bg-blue-600 text-white hover:bg-blue-700 cursor-pointer transition-colors"
          onClick={() => onRemoveFilter(filter.groupId, filter.optionId)}
        >
          {filter.groupLabel}: {filter.optionLabel}
          <X className="w-3 h-3 ml-1" />
        </Badge>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearAll}
        className="text-red-600 hover:text-red-700 hover:bg-red-50 ml-auto"
      >
        Clear All
      </Button>
    </div>
  )
}
