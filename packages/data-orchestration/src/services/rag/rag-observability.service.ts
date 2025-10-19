/**
 * RAG Observability Service (Phase 10)
 * 
 * Comprehensive logging, monitoring, and debugging for RAG operations
 */

import pino from 'pino'

const logger = pino({ name: 'rag-observability' })

export interface RAGTrace {
  traceId: string
  operation: string
  startTime: Date
  endTime?: Date
  duration?: number
  status: 'pending' | 'success' | 'error'
  metadata: {
    tenantId: string
    userId?: string
    query?: string
    retrievalResults?: number
    tokensUsed?: number
    cost?: number
  }
  steps: Array<{
    name: string
    startTime: Date
    endTime: Date
    duration: number
    status: 'success' | 'error'
    metadata?: Record<string, any>
  }>
  error?: {
    message: string
    stack?: string
    code?: string
  }
}

export interface RAGMetrics {
  timestamp: Date
  tenantId: string
  metrics: {
    latency: {
      p50: number
      p95: number
      p99: number
      avg: number
    }
    accuracy: {
      relevanceScore: number
      confidenceScore: number
      userSatisfaction: number
    }
    cost: {
      totalCost: number
      costPerQuery: number
      tokensUsed: number
    }
    errors: {
      totalErrors: number
      errorRate: number
      errorsByType: Record<string, number>
    }
    usage: {
      totalQueries: number
      uniqueUsers: number
      avgQueriesPerUser: number
    }
  }
}

export interface Alert {
  id: string
  type: 'latency' | 'accuracy' | 'cost' | 'error' | 'degradation'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  timestamp: Date
  metadata: Record<string, any>
  resolved: boolean
}

export class RAGObservabilityService {
  private static instance: RAGObservabilityService
  private traces: Map<string, RAGTrace> = new Map()
  private metrics: RAGMetrics[] = []
  private alerts: Alert[] = []
  private thresholds = {
    latencyP95: 2000, // ms
    latencyP99: 5000, // ms
    minAccuracy: 0.7,
    maxErrorRate: 0.05,
    maxCostPerQuery: 0.10 // USD
  }

  private constructor() {
    // Start metrics collection
    this.startMetricsCollection()
  }

  static getInstance(): RAGObservabilityService {
    if (!RAGObservabilityService.instance) {
      RAGObservabilityService.instance = new RAGObservabilityService()
    }
    return RAGObservabilityService.instance
  }

  /**
   * Start tracing a RAG operation
   */
  startTrace(
    operation: string,
    tenantId: string,
    metadata?: Record<string, any>
  ): string {
    const traceId = `trace:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`

    const trace: RAGTrace = {
      traceId,
      operation,
      startTime: new Date(),
      status: 'pending',
      metadata: {
        tenantId,
        ...metadata
      },
      steps: []
    }

    this.traces.set(traceId, trace)

    logger.info({ traceId, operation, tenantId }, 'Trace started')

    return traceId
  }

  /**
   * Add a step to a trace
   */
  addTraceStep(
    traceId: string,
    stepName: string,
    status: 'success' | 'error',
    metadata?: Record<string, any>
  ): void {
    const trace = this.traces.get(traceId)
    if (!trace) return

    const step = {
      name: stepName,
      startTime: new Date(),
      endTime: new Date(),
      duration: 0,
      status,
      metadata
    }

    trace.steps.push(step)
  }

  /**
   * End a trace
   */
  endTrace(
    traceId: string,
    status: 'success' | 'error',
    error?: { message: string; stack?: string; code?: string }
  ): void {
    const trace = this.traces.get(traceId)
    if (!trace) return

    trace.endTime = new Date()
    trace.duration = trace.endTime.getTime() - trace.startTime.getTime()
    trace.status = status
    if (error) trace.error = error

    logger.info({
      traceId,
      operation: trace.operation,
      duration: trace.duration,
      status
    }, 'Trace completed')

    // Check for performance issues
    if (trace.duration > this.thresholds.latencyP99) {
      this.createAlert({
        type: 'latency',
        severity: 'high',
        message: `Query took ${trace.duration}ms (threshold: ${this.thresholds.latencyP99}ms)`,
        metadata: { traceId, duration: trace.duration }
      })
    }
  }

  /**
   * Get trace details
   */
  getTrace(traceId: string): RAGTrace | undefined {
    return this.traces.get(traceId)
  }

  /**
   * Get recent traces
   */
  getRecentTraces(tenantId: string, limit: number = 50): RAGTrace[] {
    return Array.from(this.traces.values())
      .filter(t => t.metadata.tenantId === tenantId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, limit)
  }

  /**
   * Record metrics
   */
  recordMetrics(tenantId: string, metrics: Partial<RAGMetrics['metrics']>): void {
    const existingMetrics = this.metrics.find(
      m => m.tenantId === tenantId && 
      m.timestamp.getTime() > Date.now() - 60000 // Last minute
    )

    if (existingMetrics) {
      // Update existing metrics
      Object.assign(existingMetrics.metrics, metrics)
    } else {
      // Create new metrics entry
      this.metrics.push({
        timestamp: new Date(),
        tenantId,
        metrics: metrics as RAGMetrics['metrics']
      })
    }

    // Check thresholds
    this.checkMetricThresholds(tenantId, metrics)
  }

  /**
   * Get current metrics
   */
  getMetrics(tenantId: string, timeRange?: { start: Date; end: Date }): RAGMetrics[] {
    let filtered = this.metrics.filter(m => m.tenantId === tenantId)

    if (timeRange) {
      filtered = filtered.filter(
        m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
      )
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  /**
   * Calculate aggregated metrics
   */
  getAggregatedMetrics(tenantId: string, period: 'hour' | 'day' | 'week'): {
    latency: { p50: number; p95: number; p99: number }
    accuracy: number
    cost: number
    errorRate: number
    totalQueries: number
  } {
    const now = Date.now()
    const periodMs = {
      hour: 3600000,
      day: 86400000,
      week: 604800000
    }[period]

    const recentMetrics = this.metrics.filter(
      m => m.tenantId === tenantId && now - m.timestamp.getTime() < periodMs
    )

    if (recentMetrics.length === 0) {
      return {
        latency: { p50: 0, p95: 0, p99: 0 },
        accuracy: 0,
        cost: 0,
        errorRate: 0,
        totalQueries: 0
      }
    }

    // Calculate averages
    const avgLatency = {
      p50: recentMetrics.reduce((sum, m) => sum + (m.metrics.latency?.p50 || 0), 0) / recentMetrics.length,
      p95: recentMetrics.reduce((sum, m) => sum + (m.metrics.latency?.p95 || 0), 0) / recentMetrics.length,
      p99: recentMetrics.reduce((sum, m) => sum + (m.metrics.latency?.p99 || 0), 0) / recentMetrics.length
    }

    const avgAccuracy = recentMetrics.reduce(
      (sum, m) => sum + (m.metrics.accuracy?.relevanceScore || 0), 0
    ) / recentMetrics.length

    const totalCost = recentMetrics.reduce((sum, m) => sum + (m.metrics.cost?.totalCost || 0), 0)
    const totalQueries = recentMetrics.reduce((sum, m) => sum + (m.metrics.usage?.totalQueries || 0), 0)
    const totalErrors = recentMetrics.reduce((sum, m) => sum + (m.metrics.errors?.totalErrors || 0), 0)

    return {
      latency: avgLatency,
      accuracy: avgAccuracy,
      cost: totalCost,
      errorRate: totalQueries > 0 ? totalErrors / totalQueries : 0,
      totalQueries
    }
  }

  /**
   * Create an alert
   */
  private createAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'resolved'>): void {
    const newAlert: Alert = {
      ...alert,
      id: `alert:${Date.now()}`,
      timestamp: new Date(),
      resolved: false
    }

    this.alerts.push(newAlert)

    logger.warn({
      alertId: newAlert.id,
      type: newAlert.type,
      severity: newAlert.severity,
      message: newAlert.message
    }, 'Alert created')
  }

  /**
   * Get active alerts
   */
  getAlerts(tenantId?: string, severity?: Alert['severity']): Alert[] {
    let filtered = this.alerts.filter(a => !a.resolved)

    if (tenantId) {
      filtered = filtered.filter(a => a.metadata.tenantId === tenantId)
    }

    if (severity) {
      filtered = filtered.filter(a => a.severity === severity)
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.resolved = true
      logger.info({ alertId }, 'Alert resolved')
    }
  }

  /**
   * Get debugging information for a query
   */
  getDebugInfo(traceId: string): {
    trace: RAGTrace | undefined
    relatedTraces: RAGTrace[]
    metrics: RAGMetrics[]
    recommendations: string[]
  } {
    const trace = this.traces.get(traceId)
    if (!trace) {
      return {
        trace: undefined,
        relatedTraces: [],
        metrics: [],
        recommendations: []
      }
    }

    // Find related traces (same query or tenant)
    const relatedTraces = Array.from(this.traces.values())
      .filter(t => 
        t.traceId !== traceId &&
        (t.metadata.query === trace.metadata.query || t.metadata.tenantId === trace.metadata.tenantId)
      )
      .slice(0, 5)

    // Get metrics around the same time
    const metrics = this.metrics.filter(m =>
      m.tenantId === trace.metadata.tenantId &&
      Math.abs(m.timestamp.getTime() - trace.startTime.getTime()) < 300000 // 5 minutes
    )

    // Generate recommendations
    const recommendations = this.generateDebugRecommendations(trace)

    return { trace, relatedTraces, metrics, recommendations }
  }

  private checkMetricThresholds(tenantId: string, metrics: Partial<RAGMetrics['metrics']>): void {
    // Check latency
    if (metrics.latency?.p95 && metrics.latency.p95 > this.thresholds.latencyP95) {
      this.createAlert({
        type: 'latency',
        severity: 'medium',
        message: `P95 latency is ${metrics.latency.p95}ms (threshold: ${this.thresholds.latencyP95}ms)`,
        metadata: { tenantId, latency: metrics.latency.p95 }
      })
    }

    // Check accuracy
    if (metrics.accuracy?.relevanceScore && metrics.accuracy.relevanceScore < this.thresholds.minAccuracy) {
      this.createAlert({
        type: 'accuracy',
        severity: 'high',
        message: `Relevance score is ${metrics.accuracy.relevanceScore} (threshold: ${this.thresholds.minAccuracy})`,
        metadata: { tenantId, accuracy: metrics.accuracy.relevanceScore }
      })
    }

    // Check cost
    if (metrics.cost?.costPerQuery && metrics.cost.costPerQuery > this.thresholds.maxCostPerQuery) {
      this.createAlert({
        type: 'cost',
        severity: 'medium',
        message: `Cost per query is $${metrics.cost.costPerQuery} (threshold: $${this.thresholds.maxCostPerQuery})`,
        metadata: { tenantId, cost: metrics.cost.costPerQuery }
      })
    }

    // Check error rate
    if (metrics.errors?.errorRate && metrics.errors.errorRate > this.thresholds.maxErrorRate) {
      this.createAlert({
        type: 'error',
        severity: 'high',
        message: `Error rate is ${(metrics.errors.errorRate * 100).toFixed(1)}% (threshold: ${(this.thresholds.maxErrorRate * 100).toFixed(1)}%)`,
        metadata: { tenantId, errorRate: metrics.errors.errorRate }
      })
    }
  }

  private generateDebugRecommendations(trace: RAGTrace): string[] {
    const recommendations: string[] = []

    if (trace.duration && trace.duration > 3000) {
      recommendations.push('Consider optimizing vector search queries')
      recommendations.push('Check if embedding generation is cached')
    }

    if (trace.error) {
      recommendations.push(`Error occurred: ${trace.error.message}`)
      recommendations.push('Check logs for detailed stack trace')
    }

    if (trace.metadata.retrievalResults === 0) {
      recommendations.push('No results found - consider adjusting search parameters')
      recommendations.push('Verify that contracts are properly indexed')
    }

    return recommendations
  }

  private startMetricsCollection(): void {
    // Collect metrics every minute
    setInterval(() => {
      this.collectSystemMetrics()
    }, 60000)
  }

  private collectSystemMetrics(): void {
    // Calculate metrics from recent traces
    const recentTraces = Array.from(this.traces.values()).filter(
      t => t.endTime && Date.now() - t.endTime.getTime() < 60000
    )

    if (recentTraces.length === 0) return

    const durations = recentTraces.map(t => t.duration || 0).sort((a, b) => a - b)
    const p50 = durations[Math.floor(durations.length * 0.5)]
    const p95 = durations[Math.floor(durations.length * 0.95)]
    const p99 = durations[Math.floor(durations.length * 0.99)]

    const errors = recentTraces.filter(t => t.status === 'error').length
    const errorRate = errors / recentTraces.length

    // Group by tenant and record metrics
    const tenantGroups = new Map<string, RAGTrace[]>()
    for (const trace of recentTraces) {
      const tenantId = trace.metadata.tenantId
      if (!tenantGroups.has(tenantId)) {
        tenantGroups.set(tenantId, [])
      }
      tenantGroups.get(tenantId)!.push(trace)
    }

    for (const [tenantId, traces] of tenantGroups.entries()) {
      this.recordMetrics(tenantId, {
        latency: { p50, p95, p99, avg: durations.reduce((a, b) => a + b, 0) / durations.length },
        errors: { totalErrors: errors, errorRate, errorsByType: {} },
        usage: { totalQueries: traces.length, uniqueUsers: 0, avgQueriesPerUser: 0 }
      })
    }
  }
}

export const ragObservabilityService = RAGObservabilityService.getInstance()
