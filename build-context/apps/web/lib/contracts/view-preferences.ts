/**
 * View Preferences Management
 */

import { TableColumn, DEFAULT_COLUMNS } from './table-config'
import type { ViewMode } from './types'

export interface ViewPreferences {
  viewMode: ViewMode
  columns: TableColumn[]
  density?: 'comfortable' | 'compact' | 'spacious'
}

const VIEW_PREFS_KEY = 'contract-view-preferences'

export function loadViewPreferences(): ViewPreferences {
  if (typeof window === 'undefined') {
    return {
      viewMode: 'cards',
      columns: DEFAULT_COLUMNS,
      density: 'comfortable',
    }
  }
  
  try {
    const stored = localStorage.getItem(VIEW_PREFS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        viewMode: parsed.viewMode || 'cards',
        columns: parsed.columns || DEFAULT_COLUMNS,
        density: parsed.density || 'comfortable',
      }
    }
  } catch {
    // Error loading view preferences - silently ignored
  }
  
  return {
    viewMode: 'cards',
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
  } catch {
    // Error saving view preferences - silently ignored
  }
}

export function getViewMode(): ViewMode {
  const prefs = loadViewPreferences()
  return prefs.viewMode
}

export function setViewMode(mode: ViewMode): void {
  saveViewPreferences({ viewMode: mode })
}
