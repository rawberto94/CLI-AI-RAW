/**
 * Widget Suggestion Engine
 * 
 * Analyzes user behavior and provides intelligent widget recommendations
 * based on role, activity patterns, and usage history.
 */

import { PrismaClient } from '@prisma/client'
import { UserRole } from './default-layouts'

const prisma = new PrismaClient()

export interface WidgetSuggestion {
  widgetType: string
  reason: string
  confidence: number
  priority: number
  category: 'role-based' | 'activity-based' | 'trending' | 'complementary'
}

export interface UserActivity {
  widgetType?: string
  action: string
  timestamp: Date
  metadata?: Record<string, any>
}

export class WidgetSuggestionEngine {
  private userId: string
  private role: UserRole
  private currentWidgets: string[]
  private activityHistory: UserActivity[]

  constructor(
    userId: string,
    role: UserRole,
    currentWidgets: string[],
    activityHistory: UserActivity[]
  ) {
    this.userId = userId
    this.role = role
    this.currentWidgets = currentWidgets
    this.activityHistory = activityHistory
  }

  /**
   * Generate personalized widget suggestions
   */
  async generateSuggestions(): Promise<WidgetSuggestion[]> {
    const suggestions: WidgetSuggestion[] = []

    // Get role-based suggestions
    const roleSuggestions = this.getRoleBasedSuggestions()
    suggestions.push(...roleSuggestions)

    // Get activity-based suggestions
    const activitySuggestions = this.getActivityBasedSuggestions()
    suggestions.push(...activitySuggestions)

    // Get complementary widget suggestions
    const complementarySuggestions = this.getComplementarySuggestions()
    suggestions.push(...complementarySuggestions)

    // Get trending widget suggestions
    const trendingSuggestions = await this.getTrendingSuggestions()
    suggestions.push(...trendingSuggestions)

    // Remove duplicates and filter out already added widgets
    const uniqueSuggestions = this.deduplicateAndFilter(suggestions)

    // Sort by priority and confidence
    uniqueSuggestions.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority
      }
      return b.confidence - a.confidence
    })

    // Return top suggestions
    return uniqueSuggestions.slice(0, 5)
  }

  /**
   * Get suggestions based on user role
   */
  private getRoleBasedSuggestions(): WidgetSuggestion[] {
    const suggestions: WidgetSuggestion[] = []

    const roleWidgets: Record<UserRole, Array<{ type: string; reason: string; priority: number }>> = {
      'procurement-manager': [
        {
          type: 'upcoming-renewals',
          reason: 'Stay ahead of contract renewals and avoid service disruptions',
          priority: 1
        },
        {
          type: 'savings-pipeline',
          reason: 'Track and report on cost savings initiatives',
          priority: 1
        },
        {
          type: 'supplier-performance',
          reason: 'Monitor supplier performance and manage relationships',
          priority: 2
        }
      ],
      'analyst': [
        {
          type: 'spend-analysis',
          reason: 'Analyze spending patterns and identify optimization opportunities',
          priority: 1
        },
        {
          type: 'rate-benchmarking',
          reason: 'Compare rates against market benchmarks',
          priority: 1
        },
        {
          type: 'data-quality',
          reason: 'Ensure data accuracy for reliable analytics',
          priority: 2
        }
      ],
      'executive': [
        {
          type: 'roi-summary',
          reason: 'Track overall return on investment and strategic metrics',
          priority: 1
        },
        {
          type: 'portfolio-health',
          reason: 'Monitor portfolio health and risk exposure',
          priority: 1
        },
        {
          type: 'savings-realized',
          reason: 'View realized savings and cost reduction achievements',
          priority: 2
        }
      ],
      'legal': [
        {
          type: 'compliance-dashboard',
          reason: 'Monitor compliance status across all contracts',
          priority: 1
        },
        {
          type: 'contract-risks',
          reason: 'Identify and mitigate contract-related risks',
          priority: 1
        },
        {
          type: 'clause-analysis',
          reason: 'Review non-standard and risky contract clauses',
          priority: 2
        }
      ],
      'finance': [
        {
          type: 'budget-tracking',
          reason: 'Track budget vs actual spending',
          priority: 1
        },
        {
          type: 'payment-tracking',
          reason: 'Monitor payment schedules and cash flow',
          priority: 1
        },
        {
          type: 'cost-analysis',
          reason: 'Analyze cost trends and variances',
          priority: 2
        }
      ]
    }

    const roleSpecificWidgets = roleWidgets[this.role] || []

    for (const widget of roleSpecificWidgets) {
      if (!this.currentWidgets.includes(widget.type)) {
        suggestions.push({
          widgetType: widget.type,
          reason: widget.reason,
          confidence: 0.85,
          priority: widget.priority,
          category: 'role-based'
        })
      }
    }

    return suggestions
  }

  /**
   * Get suggestions based on user activity patterns
   */
  private getActivityBasedSuggestions(): WidgetSuggestion[] {
    const suggestions: WidgetSuggestion[] = []

    // Count activity by type
    const activityCounts = this.activityHistory.reduce((acc, activity) => {
      const key = activity.action
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Define activity-to-widget mappings
    const activityMappings = [
      {
        activities: ['contract-view', 'contract-search'],
        threshold: 5,
        widget: 'upcoming-renewals',
        reason: 'You frequently work with contracts. Track upcoming renewals.',
        confidence: 0.80
      },
      {
        activities: ['supplier-view', 'supplier-search'],
        threshold: 3,
        widget: 'supplier-performance',
        reason: 'You often review suppliers. Monitor their performance metrics.',
        confidence: 0.78
      },
      {
        activities: ['rate-view', 'benchmarking'],
        threshold: 2,
        widget: 'rate-benchmarking',
        reason: 'You check rates frequently. Compare against market benchmarks.',
        confidence: 0.82
      },
      {
        activities: ['data-upload', 'file-upload'],
        threshold: 5,
        widget: 'data-quality',
        reason: 'You upload data regularly. Monitor data quality scores.',
        confidence: 0.75
      },
      {
        activities: ['financial-view', 'budget-view'],
        threshold: 3,
        widget: 'spend-analysis',
        reason: 'You review financial data often. Analyze spending patterns.',
        confidence: 0.77
      },
      {
        activities: ['compliance-check', 'risk-assessment'],
        threshold: 2,
        widget: 'compliance-dashboard',
        reason: 'You perform compliance checks. Get a comprehensive overview.',
        confidence: 0.83
      }
    ]

    for (const mapping of activityMappings) {
      const totalActivity = mapping.activities.reduce(
        (sum, activity) => sum + (activityCounts[activity] || 0),
        0
      )

      if (
        totalActivity >= mapping.threshold &&
        !this.currentWidgets.includes(mapping.widget)
      ) {
        suggestions.push({
          widgetType: mapping.widget,
          reason: mapping.reason,
          confidence: mapping.confidence,
          priority: 2,
          category: 'activity-based'
        })
      }
    }

    return suggestions
  }

  /**
   * Get complementary widget suggestions based on current widgets
   */
  private getComplementarySuggestions(): WidgetSuggestion[] {
    const suggestions: WidgetSuggestion[] = []

    // Define widget pairs that work well together
    const complementaryPairs: Record<string, Array<{ widget: string; reason: string }>> = {
      'upcoming-renewals': [
        {
          widget: 'contract-status',
          reason: 'Complement renewal tracking with overall contract status'
        },
        {
          widget: 'supplier-performance',
          reason: 'Review supplier performance before renewals'
        }
      ],
      'spend-analysis': [
        {
          widget: 'budget-tracking',
          reason: 'Compare spending against budget allocations'
        },
        {
          widget: 'savings-pipeline',
          reason: 'Identify savings opportunities from spend analysis'
        }
      ],
      'rate-benchmarking': [
        {
          widget: 'savings-pipeline',
          reason: 'Track savings from rate optimizations'
        },
        {
          widget: 'supplier-performance',
          reason: 'Evaluate supplier rates alongside performance'
        }
      ],
      'compliance-dashboard': [
        {
          widget: 'contract-risks',
          reason: 'Identify risks alongside compliance issues'
        },
        {
          widget: 'clause-analysis',
          reason: 'Deep dive into specific compliance-related clauses'
        }
      ],
      'roi-summary': [
        {
          widget: 'savings-realized',
          reason: 'Break down ROI with detailed savings metrics'
        },
        {
          widget: 'portfolio-health',
          reason: 'Assess portfolio health impact on ROI'
        }
      ]
    }

    for (const currentWidget of this.currentWidgets) {
      const complements = complementaryPairs[currentWidget] || []
      for (const complement of complements) {
        if (!this.currentWidgets.includes(complement.widget)) {
          suggestions.push({
            widgetType: complement.widget,
            reason: complement.reason,
            confidence: 0.70,
            priority: 3,
            category: 'complementary'
          })
        }
      }
    }

    return suggestions
  }

  /**
   * Get trending widget suggestions based on what other users are adding
   */
  private async getTrendingSuggestions(): Promise<WidgetSuggestion[]> {
    const suggestions: WidgetSuggestion[] = []

    try {
      // Get widget additions from the last 30 days
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const recentAdditions = await prisma.widgetAnalytics.findMany({
        where: {
          action: 'widget-added',
          timestamp: {
            gte: thirtyDaysAgo
          }
        },
        select: {
          widgetType: true
        }
      })

      // Count widget additions
      const widgetCounts = recentAdditions.reduce((acc, addition) => {
        const type = addition.widgetType || 'unknown'
        acc[type] = (acc[type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      // Get top 3 trending widgets
      const trending = Object.entries(widgetCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .filter(([widget]) => !this.currentWidgets.includes(widget))

      for (const [widget, count] of trending) {
        suggestions.push({
          widgetType: widget,
          reason: `Popular choice: ${count} users added this recently`,
          confidence: 0.65,
          priority: 4,
          category: 'trending'
        })
      }
    } catch (error) {
      console.error('Error fetching trending widgets:', error)
    }

    return suggestions
  }

  /**
   * Remove duplicate suggestions and filter out already added widgets
   */
  private deduplicateAndFilter(suggestions: WidgetSuggestion[]): WidgetSuggestion[] {
    const seen = new Set<string>()
    const unique: WidgetSuggestion[] = []

    for (const suggestion of suggestions) {
      if (
        !seen.has(suggestion.widgetType) &&
        !this.currentWidgets.includes(suggestion.widgetType)
      ) {
        seen.add(suggestion.widgetType)
        unique.push(suggestion)
      }
    }

    return unique
  }

  /**
   * Track when a user accepts a suggestion
   */
  static async trackSuggestionAccepted(
    userId: string,
    widgetType: string,
    suggestionCategory: string
  ): Promise<void> {
    try {
      await prisma.widgetAnalytics.create({
        data: {
          userId,
          widgetType,
          action: 'suggestion-accepted',
          metadata: {
            category: suggestionCategory,
            timestamp: new Date().toISOString()
          }
        }
      })
    } catch (error) {
      console.error('Error tracking suggestion acceptance:', error)
    }
  }

  /**
   * Track when a user dismisses a suggestion
   */
  static async trackSuggestionDismissed(
    userId: string,
    widgetType: string,
    suggestionCategory: string
  ): Promise<void> {
    try {
      await prisma.widgetAnalytics.create({
        data: {
          userId,
          widgetType,
          action: 'suggestion-dismissed',
          metadata: {
            category: suggestionCategory,
            timestamp: new Date().toISOString()
          }
        }
      })
    } catch (error) {
      console.error('Error tracking suggestion dismissal:', error)
    }
  }
}

/**
 * Factory function to create a suggestion engine instance
 */
export async function createSuggestionEngine(userId: string): Promise<WidgetSuggestionEngine> {
  // Get user preferences
  const preferences = await prisma.userPreferences.findUnique({
    where: { userId }
  })

  const role = (preferences?.role as UserRole) || 'analyst'
  const currentLayout = preferences?.dashboardLayout as any
  const currentWidgets = currentLayout?.widgets?.map((w: any) => w.type) || []

  // Get recent activity
  const activityHistory = await prisma.widgetAnalytics.findMany({
    where: { userId },
    orderBy: { timestamp: 'desc' },
    take: 100
  })

  return new WidgetSuggestionEngine(userId, role, currentWidgets, activityHistory)
}
