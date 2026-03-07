/**
 * Saved Filter Presets Management
 */

import { FilterOptions } from '@/components/contracts/ContractFiltersPanel'

export interface SavedFilter {
  id: string
  name: string
  description?: string
  filters: FilterOptions
  createdAt: string
  updatedAt: string
  isDefault?: boolean
}

const SAVED_FILTERS_KEY = 'contract-saved-filters'

/**
 * Get all saved filters
 */
export function getSavedFilters(): SavedFilter[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(SAVED_FILTERS_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // Error loading saved filters - silently ignored
  }
  
  return []
}

/**
 * Save a new filter preset
 */
export function saveFilterPreset(
  name: string,
  filters: FilterOptions,
  description?: string
): SavedFilter {
  const newFilter: SavedFilter = {
    id: `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    description,
    filters,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  
  const allFilters = getSavedFilters()
  const updated = [...allFilters, newFilter]
  
  try {
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(updated))
  } catch {
    // Error saving filter preset - silently ignored
  }
  
  return newFilter
}

/**
 * Update an existing filter preset
 */
export function updateFilterPreset(
  id: string,
  updates: Partial<Omit<SavedFilter, 'id' | 'createdAt'>>
): void {
  const allFilters = getSavedFilters()
  const updated = allFilters.map(filter => {
    if (filter.id === id) {
      return {
        ...filter,
        ...updates,
        updatedAt: new Date().toISOString(),
      }
    }
    return filter
  })
  
  try {
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(updated))
  } catch {
    // Error updating filter preset - silently ignored
  }
}

/**
 * Delete a filter preset
 */
export function deleteFilterPreset(id: string): void {
  const allFilters = getSavedFilters()
  const filtered = allFilters.filter(filter => filter.id !== id)
  
  try {
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(filtered))
  } catch {
    // Error deleting filter preset - silently ignored
  }
}

/**
 * Get a specific filter preset by ID
 */
export function getFilterPreset(id: string): SavedFilter | undefined {
  const allFilters = getSavedFilters()
  return allFilters.find(filter => filter.id === id)
}

/**
 * Set a filter as default
 */
export function setDefaultFilter(id: string): void {
  const allFilters = getSavedFilters()
  const updated = allFilters.map(filter => ({
    ...filter,
    isDefault: filter.id === id,
  }))
  
  try {
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(updated))
  } catch {
    // Error setting default filter - silently ignored
  }
}

/**
 * Get the default filter
 */
export function getDefaultFilter(): SavedFilter | undefined {
  const allFilters = getSavedFilters()
  return allFilters.find(filter => filter.isDefault)
}

/**
 * Create some default filter presets
 */
export function createDefaultPresets(): void {
  const existing = getSavedFilters()
  if (existing.length > 0) return // Don't create if presets already exist
  
  const defaultPresets: Omit<SavedFilter, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
      name: 'High Value Contracts',
      description: 'Contracts worth over $500,000',
      filters: {
        search: '',
        status: ['completed'],
        dateRange: { from: '', to: '' },
        valueRange: { min: 500000, max: 0 },
        contractType: [],
        riskLevel: [],
        complianceScore: { min: 0, max: 0 },
        clients: [],
        suppliers: [],
      },
    },
    {
      name: 'High Risk',
      description: 'Contracts with high or critical risk',
      filters: {
        search: '',
        status: ['completed'],
        dateRange: { from: '', to: '' },
        valueRange: { min: 0, max: 0 },
        contractType: [],
        riskLevel: ['High', 'Critical'],
        complianceScore: { min: 0, max: 0 },
        clients: [],
        suppliers: [],
      },
    },
    {
      name: 'Recent Uploads',
      description: 'Contracts uploaded in the last 30 days',
      filters: {
        search: '',
        status: [],
        dateRange: {
          from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] ?? '',
          to: new Date().toISOString().split('T')[0] ?? '',
        },
        valueRange: { min: 0, max: 0 },
        contractType: [],
        riskLevel: [],
        complianceScore: { min: 0, max: 0 },
        clients: [],
        suppliers: [],
      },
    },
    {
      name: 'Compliance Issues',
      description: 'Contracts with compliance score below 70',
      filters: {
        search: '',
        status: ['completed'],
        dateRange: { from: '', to: '' },
        valueRange: { min: 0, max: 0 },
        contractType: [],
        riskLevel: [],
        complianceScore: { min: 0, max: 70 },
        clients: [],
        suppliers: [],
      },
    },
  ]
  
  defaultPresets.forEach(preset => {
    saveFilterPreset(preset.name, preset.filters, preset.description)
  })
}
