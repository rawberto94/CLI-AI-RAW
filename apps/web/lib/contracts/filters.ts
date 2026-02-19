/**
 * @deprecated – Use `applyContractFilters` from `@/lib/contracts/apply-filters` instead.
 * This file is retained only for legacy component compatibility and will be removed.
 *
 * Filter utilities for contract components
 * Handles filter logic, validation, and state management
 */

import { useCallback } from 'react'
import { format, isAfter, isBefore, parseISO } from 'date-fns'

// Types
export interface FilterOption {
  value: string
  label: string
  count?: number
  color?: string
}

export interface FilterGroup {
  key: string
  label: string
  type: 'select' | 'multiselect' | 'daterange' | 'numberrange' | 'boolean'
  options?: FilterOption[]
  placeholder?: string
  min?: number
  max?: number
}

export interface DateRange {
  from?: Date
  to?: Date
}

export interface NumberRange {
  min?: number
  max?: number
}

// Contract status options
export const CONTRACT_STATUS_OPTIONS: FilterOption[] = [
  { value: 'uploaded', label: 'Uploaded', color: 'blue' },
  { value: 'processing', label: 'Processing', color: 'yellow' },
  { value: 'completed', label: 'Completed', color: 'green' },
  { value: 'failed', label: 'Failed', color: 'red' },
  { value: 'pending', label: 'Pending', color: 'gray' },
]

// Contract type options
export const CONTRACT_TYPE_OPTIONS: FilterOption[] = [
  { value: 'nda', label: 'NDA' },
  { value: 'msa', label: 'MSA' },
  { value: 'sow', label: 'SOW' },
  { value: 'employment', label: 'Employment' },
  { value: 'vendor', label: 'Vendor Agreement' },
  { value: 'lease', label: 'Lease' },
  { value: 'other', label: 'Other' },
]

// Risk level options
export const RISK_LEVEL_OPTIONS: FilterOption[] = [
  { value: 'low', label: 'Low Risk', color: 'green' },
  { value: 'medium', label: 'Medium Risk', color: 'yellow' },
  { value: 'high', label: 'High Risk', color: 'red' },
]

// Filter groups configuration
export const FILTER_GROUPS: FilterGroup[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'multiselect',
    options: CONTRACT_STATUS_OPTIONS,
    placeholder: 'Select status...',
  },
  {
    key: 'contractType',
    label: 'Contract Type',
    type: 'multiselect',
    options: CONTRACT_TYPE_OPTIONS,
    placeholder: 'Select type...',
  },
  {
    key: 'riskLevel',
    label: 'Risk Level',
    type: 'multiselect',
    options: RISK_LEVEL_OPTIONS,
    placeholder: 'Select risk level...',
  },
  {
    key: 'dateRange',
    label: 'Date Range',
    type: 'daterange',
    placeholder: 'Select date range...',
  },
  {
    key: 'valueRange',
    label: 'Contract Value',
    type: 'numberrange',
    placeholder: 'Enter value range...',
    min: 0,
    max: 10000000,
  },
]

// Filter validation
export const validateDateRange = (range: DateRange): boolean => {
  if (!range.from || !range.to) return true
  return isBefore(range.from, range.to) || range.from.getTime() === range.to.getTime()
}

export const validateNumberRange = (range: NumberRange): boolean => {
  if (range.min === undefined || range.max === undefined) return true
  return range.min <= range.max
}

// Filter formatting
export const formatDateRange = (range: DateRange): string => {
  if (!range.from && !range.to) return ''
  if (range.from && !range.to) return `From ${format(range.from, 'MMM d, yyyy')}`
  if (!range.from && range.to) return `Until ${format(range.to, 'MMM d, yyyy')}`
  return `${format(range.from!, 'MMM d, yyyy')} - ${format(range.to!, 'MMM d, yyyy')}`
}

export const formatNumberRange = (range: NumberRange, currency = 'USD'): string => {
  if (range.min === undefined && range.max === undefined) return ''
  
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
  
  if (range.min !== undefined && range.max === undefined) {
    return `From ${formatter.format(range.min)}`
  }
  if (range.min === undefined && range.max !== undefined) {
    return `Up to ${formatter.format(range.max)}`
  }
  return `${formatter.format(range.min!)} - ${formatter.format(range.max!)}`
}

// Filter application
export const applyFilters = <T extends Record<string, any>>(
  items: T[],
  filters: Record<string, any>
): T[] => {
  return items.filter(item => {
    // Check each filter
    for (const [key, value] of Object.entries(filters)) {
      if (!value) continue

      // Array filters (status, type, etc.)
      if (Array.isArray(value) && value.length > 0) {
        if (!value.includes(item[key])) return false
      }

      // Date range filter
      if (key === 'dateRange' && value.from && value.to) {
        const itemDate = item.uploadedAt || item.createdAt
        if (!itemDate) return false
        const date = typeof itemDate === 'string' ? parseISO(itemDate) : itemDate
        if (isBefore(date, value.from) || isAfter(date, value.to)) return false
      }

      // Number range filter
      if (key === 'valueRange' && (value.min !== undefined || value.max !== undefined)) {
        const itemValue = item.totalValue || item.value || 0
        if (value.min !== undefined && itemValue < value.min) return false
        if (value.max !== undefined && itemValue > value.max) return false
      }

      // String filter
      if (typeof value === 'string' && value.trim()) {
        const itemValue = String(item[key] || '').toLowerCase()
        if (!itemValue.includes(value.toLowerCase())) return false
      }
    }

    return true
  })
}

// Filter persistence
export const saveFiltersToStorage = (key: string, filters: Record<string, any>) => {
  try {
    localStorage.setItem(`contract-filters-${key}`, JSON.stringify(filters))
  } catch {
    // Failed to save filters to storage
  }
}

export const loadFiltersFromStorage = (key: string): Record<string, any> | null => {
  try {
    const saved = localStorage.getItem(`contract-filters-${key}`)
    if (saved) {
      const filters = JSON.parse(saved)
      // Parse dates
      if (filters.dateRange) {
        if (filters.dateRange.from) filters.dateRange.from = new Date(filters.dateRange.from)
        if (filters.dateRange.to) filters.dateRange.to = new Date(filters.dateRange.to)
      }
      return filters
    }
  } catch {
    // Failed to load filters from storage
  }
  return null
}

// Custom hook for filter management
export const useContractFilters = (initialFilters: Record<string, any> = {}) => {
  const [filters, setFilters] = React.useState(initialFilters)

  const updateFilter = useCallback((key: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }, [])

  const removeFilter = useCallback((key: string) => {
    setFilters(prev => {
      const newFilters = { ...prev }
      delete newFilters[key]
      return newFilters
    })
  }, [])

  const clearAllFilters = useCallback(() => {
    setFilters({})
  }, [])

  const hasActiveFilters = useCallback(() => {
    return Object.values(filters).some(value => {
      if (Array.isArray(value)) return value.length > 0
      if (typeof value === 'object' && value !== null) {
        return Object.values(value).some(v => v !== undefined && v !== null)
      }
      return value !== undefined && value !== null && value !== ''
    })
  }, [filters])

  const getActiveFilterCount = useCallback(() => {
    return Object.entries(filters).reduce((count, [key, value]) => {
      if (Array.isArray(value)) return count + value.length
      if (typeof value === 'object' && value !== null) {
        return count + Object.values(value).filter(v => v !== undefined && v !== null).length
      }
      return value !== undefined && value !== null && value !== '' ? count + 1 : count
    }, 0)
  }, [filters])

  return {
    filters,
    updateFilter,
    removeFilter,
    clearAllFilters,
    hasActiveFilters: hasActiveFilters(),
    activeFilterCount: getActiveFilterCount(),
  }
}

// Import React for the hook
import React from 'react'
