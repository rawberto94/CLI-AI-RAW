/**
 * Default Dashboard Layouts by Role
 * 
 * Defines the initial widget configuration for each user role
 */

export interface DashboardWidget {
  id: string
  type: string
  position: { x: number; y: number; w: number; h: number }
  config?: Record<string, any>
}

export interface DashboardLayout {
  widgets: DashboardWidget[]
  columns: number
}

export const DEFAULT_LAYOUTS: Record<string, DashboardLayout> = {
  'procurement-manager': {
    columns: 12,
    widgets: [
      {
        id: 'contract-overview',
        type: 'contract-overview',
        position: { x: 0, y: 0, w: 6, h: 4 }
      },
      {
        id: 'supplier-performance',
        type: 'supplier-performance',
        position: { x: 6, y: 0, w: 6, h: 4 }
      },
      {
        id: 'spend-analysis',
        type: 'spend-analysis',
        position: { x: 0, y: 4, w: 8, h: 5 }
      },
      {
        id: 'recent-activity',
        type: 'recent-activity',
        position: { x: 8, y: 4, w: 4, h: 5 }
      },
      {
        id: 'renewal-alerts',
        type: 'renewal-alerts',
        position: { x: 0, y: 9, w: 6, h: 4 }
      },
      {
        id: 'quick-actions',
        type: 'quick-actions',
        position: { x: 6, y: 9, w: 6, h: 4 },
        config: {
          actions: ['upload-contract', 'search-contracts', 'supplier-benchmarks', 'rate-intelligence']
        }
      }
    ]
  },

  'analyst': {
    columns: 12,
    widgets: [
      {
        id: 'analytics-overview',
        type: 'analytics-overview',
        position: { x: 0, y: 0, w: 12, h: 4 }
      },
      {
        id: 'rate-benchmarking',
        type: 'rate-benchmarking',
        position: { x: 0, y: 4, w: 6, h: 5 }
      },
      {
        id: 'compliance-trends',
        type: 'compliance-trends',
        position: { x: 6, y: 4, w: 6, h: 5 }
      },
      {
        id: 'data-quality',
        type: 'data-quality',
        position: { x: 0, y: 9, w: 4, h: 4 }
      },
      {
        id: 'processing-queue',
        type: 'processing-queue',
        position: { x: 4, y: 9, w: 4, h: 4 }
      },
      {
        id: 'recent-reports',
        type: 'recent-reports',
        position: { x: 8, y: 9, w: 4, h: 4 }
      }
    ]
  },

  'executive': {
    columns: 12,
    widgets: [
      {
        id: 'executive-summary',
        type: 'executive-summary',
        position: { x: 0, y: 0, w: 12, h: 5 }
      },
      {
        id: 'portfolio-value',
        type: 'portfolio-value',
        position: { x: 0, y: 5, w: 6, h: 4 }
      },
      {
        id: 'risk-overview',
        type: 'risk-overview',
        position: { x: 6, y: 5, w: 6, h: 4 }
      },
      {
        id: 'key-metrics',
        type: 'key-metrics',
        position: { x: 0, y: 9, w: 8, h: 4 }
      },
      {
        id: 'strategic-insights',
        type: 'strategic-insights',
        position: { x: 8, y: 9, w: 4, h: 4 }
      }
    ]
  },

  'legal': {
    columns: 12,
    widgets: [
      {
        id: 'compliance-dashboard',
        type: 'compliance-dashboard',
        position: { x: 0, y: 0, w: 8, h: 5 }
      },
      {
        id: 'risk-alerts',
        type: 'risk-alerts',
        position: { x: 8, y: 0, w: 4, h: 5 }
      },
      {
        id: 'clause-analysis',
        type: 'clause-analysis',
        position: { x: 0, y: 5, w: 6, h: 4 }
      },
      {
        id: 'contract-review-queue',
        type: 'contract-review-queue',
        position: { x: 6, y: 5, w: 6, h: 4 }
      },
      {
        id: 'regulatory-updates',
        type: 'regulatory-updates',
        position: { x: 0, y: 9, w: 6, h: 4 }
      },
      {
        id: 'recent-activity',
        type: 'recent-activity',
        position: { x: 6, y: 9, w: 6, h: 4 }
      }
    ]
  },

  'finance': {
    columns: 12,
    widgets: [
      {
        id: 'financial-overview',
        type: 'financial-overview',
        position: { x: 0, y: 0, w: 12, h: 4 }
      },
      {
        id: 'spend-analysis',
        type: 'spend-analysis',
        position: { x: 0, y: 4, w: 8, h: 5 }
      },
      {
        id: 'budget-tracking',
        type: 'budget-tracking',
        position: { x: 8, y: 4, w: 4, h: 5 }
      },
      {
        id: 'payment-schedule',
        type: 'payment-schedule',
        position: { x: 0, y: 9, w: 6, h: 4 }
      },
      {
        id: 'cost-savings',
        type: 'cost-savings',
        position: { x: 6, y: 9, w: 6, h: 4 }
      }
    ]
  },

  'default': {
    columns: 12,
    widgets: [
      {
        id: 'welcome',
        type: 'welcome',
        position: { x: 0, y: 0, w: 12, h: 3 }
      },
      {
        id: 'contract-overview',
        type: 'contract-overview',
        position: { x: 0, y: 3, w: 8, h: 5 }
      },
      {
        id: 'recent-activity',
        type: 'recent-activity',
        position: { x: 8, y: 3, w: 4, h: 5 }
      },
      {
        id: 'quick-actions',
        type: 'quick-actions',
        position: { x: 0, y: 8, w: 12, h: 3 }
      }
    ]
  }
}

/**
 * Get default layout for a specific role
 */
export function getDefaultLayout(role?: string): DashboardLayout {
  if (!role) {
    return DEFAULT_LAYOUTS.default
  }

  return DEFAULT_LAYOUTS[role] || DEFAULT_LAYOUTS.default
}

/**
 * Get available widget types for a role
 */
export function getAvailableWidgets(role?: string): string[] {
  const layout = getDefaultLayout(role)
  return layout.widgets.map(w => w.type)
}
