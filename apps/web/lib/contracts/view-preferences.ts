/**
 * View Preferences Management
 */

import { TableColumn, DEFAULT_COLUMNS } from './table-config'

export type ViewMode = 'card' | 'table'

export interface ViewPreferences {
  viewMode: ViewMode
  columns: TableColumn[]
  density?: 'comfortable' | 'compact' | 'spacious'
}

const VIEW_PREFS_KEY = 'contract-view-preferences'

export function loadViewPreferences(): ViewPreferences {
  if (typeof window === 'undefined') {
    return {
      viewMode: 'card',
      columns: DEFAULT_COLUMNS,
      density: 'comfortable',
    }
  }
  
  try {
    const stored = localStorage.getItem(VIEW_PREFS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        viewMode: parsed.viewMode || 'card',
        columns: parsed.columns || DEFAULT_COLUMNS,
        density: parsed.density || 'comfortable',
      }
    }
  } catch (error) {
    console.error('Error loading view preferences:', error)
  }
  
  return {
    viewMode: 'card',
    columns: DEFAULT_COLUMNS,
    density: 'comfortable',
  }
}

export function saveViewPreferences(prefs: Partial<ViewPreferences>): void {
  if (typeof window === 'undefined') return
  
  try {
    const current = loadViewPreferences()
    const updated = { ...current, ...prefs }
    localStorage.setItem(VIEW_PREFS_KEY, JSON.stringify(updated))
  } catch (error) {
    console.error('Error saving view preferences:', error)
  }
}

export function getViewMode(): ViewMode {
  const prefs = loadViewPreferences()
  return prefs.viewMode
}

export function setViewMode(mode: ViewMode): void {
  saveViewPreferences({ viewMode: mode })
}
