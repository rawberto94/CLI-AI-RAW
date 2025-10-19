/**
 * Performance Monitoring Service
 * 
 * Monitors and tracks performance metrics for UX components
 */

import { uxMetrics } from '../analytics/ux-metrics-collector'

export interface PerformanceMetric {
  name: string
  value: number
  unit: 'ms' | 'bytes' | 'count'
  timestamp: Date
  metadata?: Record<string, any>
}

export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map()
  private thresholds: Map<string, number> = new Map()
  private observers: PerformanceObserver[] = []

  constructor() {
    this.setupDefaultThresholds()
    this.setupPerformanceObservers()
  }

  /**
   * Setup default performance thresholds
   */
  private setupDefaultThresholds() {
    this.thresholds.set('dashboard_load', 1000) // 1 second
    this.thresholds.set('widget_render', 500) // 500ms
    this.thresholds.set('websocket_connect', 2000) // 2 seconds
    this.thresholds.set('help_content_load', 300) // 300ms
    this.thresholds.set('api_response', 1000) // 1 second
  }

  /**
   * Setup performance observers
   */
  private setupPerformanceObservers() {
    if (typeof window === 'undefined' || !window.PerformanceObserver) {
      return
    }

    try {
      // Observe long tasks
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric({
            name: 'long_task',
            value: entry.duration,
            unit: 'ms',
            timestamp: new Date(),
            metadata: {
              entryType: entry.entryType,
              startTime: entry.startTime
            }
          })

          // Alert if task is too long
          if (entry.duration > 100) {
            console.warn(`Long task detected: ${entry.duration}ms`)
          }
        }
      })
      longTaskObserver.observe({ entryTypes: ['longtask'] })
      this.observers.push(longTaskObserver)
    } catch (error) {
      console.warn('Long task observer not supported')
    }

    try {
      // Observe layout shifts
      const layoutShiftObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutShift = entry as any
          if (layoutShift.hadRecentInput) continue

          this.recordMetric({
            name: 'layout_shift',
            value: layoutShift.value,
            unit: 'count',
            timestamp: new Date(),
            metadata: {
              sources: layoutShift.sources
            }
          })
        }
      })
      layoutShiftObserver.observe({ entryTypes: ['layout-shift'] })
      this.observers.push(layoutShiftObserver)
    } catch (error) {
      console.warn('Layout shift observer not supported')
    }
  }

  /**
   * Measure dashboard load time
   */
  measureDashboardLoad(startTime: number) {
    const duration = performance.now() - startTime
    this.recordMetric({
      name: 'dashboard_load',
      value: duration,
      unit: 'ms',
      timestamp: new Date()
    })

    this.checkThreshold('dashboard_load', duration)
    
    if (uxMetrics) {
      uxMetrics.trackPerformance({
        metric: 'dashboard_load',
        value: duration,
        unit: 'ms'
      })
    }

    return duration
  }

  /**
   * Measure widget render time
   */
  measureWidgetRender(widgetType: string, startTime: number) {
    const duration = performance.now() - startTime
    this.recordMetric({
      name: 'widget_render',
      value: duration,
      unit: 'ms',
      timestamp: new Date(),
      metadata: { widgetType }
    })

    this.checkThreshold('widget_render', duration)

    if (uxMetrics) {
      uxMetrics.trackPerformance({
        metric: `widget_render_${widgetType}`,
        value: duration,
        unit: 'ms'
      })
    }

    return duration
  }

  /**
   * Measure WebSocket connection time
   */
  measureWebSocketConnect(startTime: number) {
    const duration = performance.now() - startTime
    this.recordMetric({
      name: 'websocket_connect',
      value: duration,
      unit: 'ms',
      timestamp: new Date()
    })

    this.checkThreshold('websocket_connect', duration)

    if (uxMetrics) {
      uxMetrics.trackPerformance({
        metric: 'websocket_connect',
        value: duration,
        unit: 'ms'
      })
    }

    return duration
  }

  /**
   * Measure help content load time
   */
  measureHelpContentLoad(contentId: string, startTime: number) {
    const duration = performance.now() - startTime
    this.recordMetric({
      name: 'help_content_load',
      value: duration,
      unit: 'ms',
      timestamp: new Date(),
      metadata: { contentId }
    })

    this.checkThreshold('help_content_load', duration)

    if (uxMetrics) {
      uxMetrics.trackPerformance({
        metric: 'help_content_load',
        value: duration,
        unit: 'ms'
      })
    }

    return duration
  }

  /**
   * Measure API response time
   */
  measureAPIResponse(endpoint: string, startTime: number) {
    const duration = performance.now() - startTime
    this.recordMetric({
      name: 'api_response',
      value: duration,
      unit: 'ms',
      timestamp: new Date(),
      metadata: { endpoint }
    })

    this.checkThreshold('api_response', duration)

    if (uxMetrics) {
      uxMetrics.trackPerformance({
        metric: `api_response_${endpoint}`,
        value: duration,
        unit: 'ms'
      })
    }

    return duration
  }

  /**
   * Record a custom metric
   */
  recordMetric(metric: PerformanceMetric) {
    const metrics = this.metrics.get(metric.name) || []
    metrics.push(metric)
    
    // Keep only last 100 metrics per type
    if (metrics.length > 100) {
      metrics.shift()
    }
    
    this.metrics.set(metric.name, metrics)
  }

  /**
   * Get metrics by name
   */
  getMetrics(name: string): PerformanceMetric[] {
    return this.metrics.get(name) || []
  }

  /**
   * Get average metric value
   */
  getAverageMetric(name: string): number {
    const metrics = this.getMetrics(name)
    if (metrics.length === 0) return 0

    const sum = metrics.reduce((acc, m) => acc + m.value, 0)
    return sum / metrics.length
  }

  /**
   * Get all metrics summary
   */
  getSummary() {
    const summary: Record<string, any> = {}

    for (const [name, metrics] of this.metrics) {
      const values = metrics.map(m => m.value)
      summary[name] = {
        count: metrics.length,
        average: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        latest: metrics[metrics.length - 1]?.value || 0
      }
    }

    return summary
  }

  /**
   * Check if metric exceeds threshold
   */
  private checkThreshold(name: string, value: number) {
    const threshold = this.thresholds.get(name)
    if (threshold && value > threshold) {
      console.warn(`Performance threshold exceeded for ${name}: ${value}ms > ${threshold}ms`)
      
      // Track performance degradation
      if (uxMetrics) {
        uxMetrics.trackError({
          component: 'performance_monitor',
          error: `Threshold exceeded: ${name}`,
          errorType: 'performance'
        })
      }
    }
  }

  /**
   * Set custom threshold
   */
  setThreshold(name: string, value: number) {
    this.thresholds.set(name, value)
  }

  /**
   * Cleanup observers
   */
  cleanup() {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
  }
}

// Global instance
export const performanceMonitor = typeof window !== 'undefined' 
  ? new PerformanceMonitor() 
  : null

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (performanceMonitor) {
      performanceMonitor.cleanup()
    }
  })
}

/**
 * React hook for performance monitoring
 */
export function usePerformanceMonitor(componentName: string) {
  const startTime = performance.now()

  return {
    measureRender: () => {
      if (performanceMonitor) {
        return performanceMonitor.measureWidgetRender(componentName, startTime)
      }
      return 0
    },
    recordMetric: (name: string, value: number, unit: 'ms' | 'bytes' | 'count' = 'ms') => {
      if (performanceMonitor) {
        performanceMonitor.recordMetric({
          name: `${componentName}_${name}`,
          value,
          unit,
          timestamp: new Date(),
          metadata: { component: componentName }
        })
      }
    }
  }
}
