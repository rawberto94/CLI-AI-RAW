'use client'

import React, { createContext, useContext, useCallback, useMemo, useEffect, useState } from 'react'

// ============================================================================
// TYPES
// ============================================================================

interface Experiment {
  id: string
  name: string
  variants: string[]
  defaultVariant: string
  enabled: boolean
}

interface _ExperimentResult {
  experimentId: string
  variant: string
  userId?: string
  timestamp: Date
}

interface ABTestingContextType {
  getVariant: (experimentId: string) => string
  trackEvent: (experimentId: string, eventName: string, data?: Record<string, any>) => void
  isVariant: (experimentId: string, variant: string) => boolean
  experiments: Map<string, Experiment>
}

// ============================================================================
// EXPERIMENT DEFINITIONS
// ============================================================================

const EXPERIMENTS: Experiment[] = [
  {
    id: 'contract_detail_layout',
    name: 'Contract Detail Page Layout',
    variants: ['control', 'compact', 'expanded'],
    defaultVariant: 'control',
    enabled: true,
  },
  {
    id: 'floating_actions_position',
    name: 'Floating Actions Position',
    variants: ['bottom-right', 'bottom-center', 'sidebar'],
    defaultVariant: 'bottom-right',
    enabled: true,
  },
  {
    id: 'timeline_style',
    name: 'Contract Timeline Style',
    variants: ['horizontal', 'vertical', 'minimal'],
    defaultVariant: 'horizontal',
    enabled: true,
  },
  {
    id: 'quick_actions_visibility',
    name: 'Quick Actions Visibility',
    variants: ['always', 'hover', 'collapsed'],
    defaultVariant: 'always',
    enabled: true,
  },
]

// ============================================================================
// STORAGE HELPERS
// ============================================================================

const STORAGE_KEY = 'ab_experiments'

function getStoredVariants(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function setStoredVariant(experimentId: string, variant: string): void {
  if (typeof window === 'undefined') return
  try {
    const stored = getStoredVariants()
    stored[experimentId] = variant
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch {
    // Storage failed silently
  }
}

function selectVariant(experiment: Experiment): string {
  // Check for stored variant first (sticky)
  const stored = getStoredVariants()
  if (stored[experiment.id]) {
    return stored[experiment.id]
  }

  // Random selection with equal weights
  if (!experiment.enabled) {
    return experiment.defaultVariant
  }

  const randomIndex = Math.floor(Math.random() * experiment.variants.length)
  const variant = experiment.variants[randomIndex]
  
  // Store for consistency
  setStoredVariant(experiment.id, variant)
  
  return variant
}

// ============================================================================
// CONTEXT
// ============================================================================

const ABTestingContext = createContext<ABTestingContextType | null>(null)

export function ABTestingProvider({ children }: { children: React.ReactNode }) {
  const [experiments] = useState(() => {
    const map = new Map<string, Experiment>()
    EXPERIMENTS.forEach(exp => map.set(exp.id, exp))
    return map
  })

  const [variants, setVariants] = useState<Record<string, string>>({})

  // Initialize variants on mount
  useEffect(() => {
    const initialVariants: Record<string, string> = {}
    EXPERIMENTS.forEach(exp => {
      initialVariants[exp.id] = selectVariant(exp)
    })
    setVariants(initialVariants)
  }, [])

  const getVariant = useCallback((experimentId: string): string => {
    return variants[experimentId] || experiments.get(experimentId)?.defaultVariant || 'control'
  }, [variants, experiments])

  const isVariant = useCallback((experimentId: string, variant: string): boolean => {
    return getVariant(experimentId) === variant
  }, [getVariant])

  const trackEvent = useCallback((
    experimentId: string, 
    eventName: string, 
    data?: Record<string, any>
  ) => {
    const variant = getVariant(experimentId)
    const event = {
      experimentId,
      variant,
      eventName,
      data,
      timestamp: new Date().toISOString(),
    }

    // Send to analytics endpoint
    if (typeof window !== 'undefined') {
      // Could integrate with analytics service here
      // For now, store in session storage for debugging
      try {
        const events = JSON.parse(sessionStorage.getItem('ab_events') || '[]')
        events.push(event)
        sessionStorage.setItem('ab_events', JSON.stringify(events.slice(-100)))
      } catch {
        // Ignore storage errors
      }
    }
  }, [getVariant])

  const value = useMemo(() => ({
    getVariant,
    trackEvent,
    isVariant,
    experiments,
  }), [getVariant, trackEvent, isVariant, experiments])

  return (
    <ABTestingContext.Provider value={value}>
      {children}
    </ABTestingContext.Provider>
  )
}

// ============================================================================
// HOOKS
// ============================================================================

export function useABTesting() {
  const context = useContext(ABTestingContext)
  if (!context) {
    // Return safe defaults when not wrapped in provider
    return {
      getVariant: () => 'control',
      trackEvent: () => {},
      isVariant: () => false,
      experiments: new Map(),
    }
  }
  return context
}

export function useExperiment(experimentId: string) {
  const { getVariant, trackEvent, isVariant } = useABTesting()
  
  const variant = getVariant(experimentId)
  
  const track = useCallback((eventName: string, data?: Record<string, any>) => {
    trackEvent(experimentId, eventName, data)
  }, [experimentId, trackEvent])

  const is = useCallback((variantName: string) => {
    return isVariant(experimentId, variantName)
  }, [experimentId, isVariant])

  return { variant, track, is }
}

// ============================================================================
// COMPONENTS
// ============================================================================

interface ExperimentProps {
  id: string
  children: React.ReactNode | ((variant: string) => React.ReactNode)
}

export function Experiment({ id, children }: ExperimentProps) {
  const { variant } = useExperiment(id)

  if (typeof children === 'function') {
    return <>{children(variant)}</>
  }

  return <>{children}</>
}

interface VariantProps {
  experimentId: string
  variant: string
  children: React.ReactNode
}

export function Variant({ experimentId, variant, children }: VariantProps) {
  const { is } = useExperiment(experimentId)

  if (!is(variant)) {
    return null
  }

  return <>{children}</>
}

// ============================================================================
// FEATURE FLAGS (SIMPLE VERSION)
// ============================================================================

const FEATURE_FLAGS: Record<string, boolean> = {
  'contract_notes': true,
  'contract_timeline': true,
  'related_contracts': true,
  'contract_search': true,
  'floating_actions': true,
  'keyboard_shortcuts': true,
  'drag_reorder': true,
  'advanced_export': true,
}

export function useFeatureFlag(flagName: string): boolean {
  return FEATURE_FLAGS[flagName] ?? false
}

interface FeatureFlagProps {
  flag: string
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function FeatureFlag({ flag, children, fallback = null }: FeatureFlagProps) {
  const enabled = useFeatureFlag(flag)
  return <>{enabled ? children : fallback}</>
}
