/**
 * UX Metrics Collector
 * 
 * Collects and tracks UX-related metrics for analytics and monitoring
 */

export interface UXMetricEvent {
  eventType: string
  eventCategory: string
  userId?: string
  sessionId?: string
  timestamp: Date
  metadata?: Record<string, any>
}

export class UXMetricsCollector {
  private sessionId: string
  private userId?: string
  private events: UXMetricEvent[] = []
  private flushInterval: number = 30000 // 30 seconds
  private flushTimer?: NodeJS.Timeout

  constructor() {
    this.sessionId = this.generateSessionId()
    this.startAutoFlush()
  }

  /**
   * Set the current user ID
   */
  setUserId(userId: string) {
    this.userId = userId
  }

  /**
   * Track onboarding completion
   */
  trackOnboardingComplete(data: {
    role: string
    goals: string[]
    timeSpent: number
    stepsCompleted: number
  }) {
    this.track({
      eventType: 'onboarding_completed',
      eventCategory: 'onboarding',
      metadata: data
    })
  }

  /**
   * Track onboarding skip
   */
  trackOnboardingSkip(data: {
    currentStep: number
    totalSteps: number
    timeSpent: number
  }) {
    this.track({
      eventType: 'onboarding_skipped',
      eventCategory: 'onboarding',
      metadata: data
    })
  }

  /**
   * Track onboarding step
   */
  trackOnboardingStep(data: {
    step: number
    stepName: string
    timeSpent: number
  }) {
    this.track({
      eventType: 'onboarding_step',
      eventCategory: 'onboarding',
      metadata: data
    })
  }

  /**
   * Track dashboard customization
   */
  trackDashboardCustomization(data: {
    action: 'widget_added' | 'widget_removed' | 'widget_moved' | 'layout_changed'
    widgetType?: string
    layoutName?: string
  }) {
    this.track({
      eventType: 'dashboard_customization',
      eventCategory: 'dashboard',
      metadata: data
    })
  }

  /**
   * Track dashboard view change
   */
  trackDashboardViewChange(data: {
    fromView: string
    toView: string
  }) {
    this.track({
      eventType: 'dashboard_view_change',
      eventCategory: 'dashboard',
      metadata: data
    })
  }

  /**
   * Track help content usage
   */
  trackHelpContentView(data: {
    contentId: string
    contentType: 'tooltip' | 'tour' | 'article' | 'video'
    source: string
  }) {
    this.track({
      eventType: 'help_content_viewed',
      eventCategory: 'help',
      metadata: data
    })
  }

  /**
   * Track tour completion
   */
  trackTourComplete(data: {
    tourId: string
    tourName: string
    stepsCompleted: number
    timeSpent: number
  }) {
    this.track({
      eventType: 'tour_completed',
      eventCategory: 'help',
      metadata: data
    })
  }

  /**
   * Track tour skip
   */
  trackTourSkip(data: {
    tourId: string
    tourName: string
    currentStep: number
    totalSteps: number
  }) {
    this.track({
      eventType: 'tour_skipped',
      eventCategory: 'help',
      metadata: data
    })
  }

  /**
   * Track help search
   */
  trackHelpSearch(data: {
    query: string
    resultsCount: number
  }) {
    this.track({
      eventType: 'help_search',
      eventCategory: 'help',
      metadata: data
    })
  }

  /**
   * Track widget interaction
   */
  trackWidgetInteraction(data: {
    widgetType: string
    action: string
    metadata?: Record<string, any>
  }) {
    this.track({
      eventType: 'widget_interaction',
      eventCategory: 'dashboard',
      metadata: data
    })
  }

  /**
   * Track progress tracking usage
   */
  trackProgressTracking(data: {
    action: 'viewed' | 'backgrounded' | 'cancelled'
    jobType: string
    stage?: string
  }) {
    this.track({
      eventType: 'progress_tracking',
      eventCategory: 'progress',
      metadata: data
    })
  }

  /**
   * Track keyboard shortcut usage
   */
  trackKeyboardShortcut(data: {
    shortcutId: string
    shortcutKey: string
  }) {
    this.track({
      eventType: 'keyboard_shortcut',
      eventCategory: 'interaction',
      metadata: data
    })
  }

  /**
   * Track feature discovery
   */
  trackFeatureDiscovery(data: {
    featureName: string
    source: string
  }) {
    this.track({
      eventType: 'feature_discovered',
      eventCategory: 'engagement',
      metadata: data
    })
  }

  /**
   * Track error occurrence
   */
  trackError(data: {
    component: string
    error: string
    errorType: string
  }) {
    this.track({
      eventType: 'error_occurred',
      eventCategory: 'error',
      metadata: data
    })
  }

  /**
   * Track performance metric
   */
  trackPerformance(data: {
    metric: string
    value: number
    unit: string
  }) {
    this.track({
      eventType: 'performance_metric',
      eventCategory: 'performance',
      metadata: data
    })
  }

  /**
   * Generic track method
   */
  private track(event: Omit<UXMetricEvent, 'userId' | 'sessionId' | 'timestamp'>) {
    const metricEvent: UXMetricEvent = {
      ...event,
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: new Date()
    }

    this.events.push(metricEvent)

    // Flush if we have too many events
    if (this.events.length >= 50) {
      this.flush()
    }
  }

  /**
   * Flush events to server
   */
  private async flush() {
    if (this.events.length === 0) return

    const eventsToSend = [...this.events]
    this.events = []

    try {
      await fetch('/api/analytics/ux-metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ events: eventsToSend })
      })
    } catch (error) {
      console.error('Failed to send UX metrics:', error)
      // Re-add events if send failed
      this.events.unshift(...eventsToSend)
    }
  }

  /**
   * Start auto-flush timer
   */
  private startAutoFlush() {
    this.flushTimer = setInterval(() => {
      this.flush()
    }, this.flushInterval)
  }

  /**
   * Stop auto-flush timer
   */
  stopAutoFlush() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2)}`
  }
}

// Global instance
export const uxMetrics = typeof window !== 'undefined' ? new UXMetricsCollector() : null

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (uxMetrics) {
      uxMetrics.stopAutoFlush()
    }
  })
}
