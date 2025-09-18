/**
 * Troubleshooting Dashboard Service
 * Provides actionable error information and troubleshooting insights
 */

import pino from 'pino';
import { EventEmitter } from 'events';
import { distributedTracingService, RequestTrace, TraceSpan } from './distributed-tracing.service';
import { systemMonitoringService } from './system-monitoring.service';
import { resilienceCoordinatorService } from './resilience-coordinator.service';

const logger = pino({ name: 'troubleshooting-dashboard' });

export interface DashboardConfig {
  enabled: boolean;
  analysis: {
    timeWindow: number; // milliseconds
    errorThreshold: number;
    performanceThreshold: number;
    alertThreshold: number;
  };
  insights: {
    enablePatternDetection: boolean;
    enableRootCauseAnalysis: boolean;
    enablePredictiveAnalysis: boolean;
  };
  notifications: {
    enableAlerts: boolean;
    alertChannels: string[];
    escalationDelay: number;
  };
}

export interface SystemIssue {
  id: string;
  type: 'error' | 'performance' | 'availability' | 'capacity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedServices: string[];
  firstSeen: Date;
  lastSeen: Date;
  occurrences: number;
  status: 'active' | 'investigating' | 'resolved';
  rootCause?: string;
  resolution?: string;
  relatedTraces: string[];
  metrics: {
    errorRate: number;
    affectedUsers: number;
    impactScore: number;
  };
  troubleshooting: {
    symptoms: string[];
    possibleCauses: string[];
    diagnosticSteps: string[];
    recommendations: string[];
  };
}

export interface PerformanceInsight {
  id: string;
  category: 'latency' | 'throughput' | 'errors' | 'resources';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  trend: 'improving' | 'stable' | 'degrading';
  metrics: {
    current: number;
    baseline: number;
    change: number;
    unit: string;
  };
  recommendations: string[];
  actionItems: {
    priority: 'low' | 'medium' | 'high';
    action: string;
    estimatedEffort: string;
    expectedImpact: string;
  }[];
}

export interface TroubleshootingReport {
  id: string;
  timestamp: Date;
  timeRange: {
    start: Date;
    end: Date;
  };
  summary: {
    totalIssues: number;
    criticalIssues: number;
    resolvedIssues: number;
    systemHealth: number;
    uptime: number;
  };
  issues: SystemIssue[];
  insights: PerformanceInsight[];
  systemMetrics: {
    requests: {
      total: number;
      errors: number;
      errorRate: number;
      averageLatency: number;
    };
    services: {
      total: number;
      healthy: number;
      degraded: number;
      failed: number;
    };
    resources: {
      cpuUsage: number;
      memoryUsage: number;
      diskUsage: number;
    };
  };
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldown: number; // milliseconds
  lastTriggered?: Date;
}

export class TroubleshootingDashboardService extends EventEmitter {
  private config: DashboardConfig;
  private issues = new Map<string, SystemIssue>();
  private insights = new Map<string, PerformanceInsight>();
  private alertRules = new Map<string, AlertRule>();
  private reports: TroubleshootingReport[] = [];
  private analysisInterval: NodeJS.Timeout | null = null;
  private startTime = new Date();

  constructor(config: Partial<DashboardConfig> = {}) {
    super();
    
    this.config = {
      enabled: true,
      analysis: {
        timeWindow: 15 * 60 * 1000, // 15 minutes
        errorThreshold: 0.05, // 5% error rate
        performanceThreshold: 2000, // 2 seconds
        alertThreshold: 3 // 3 occurrences
      },
      insights: {
        enablePatternDetection: true,
        enableRootCauseAnalysis: true,
        enablePredictiveAnalysis: true
      },
      notifications: {
        enableAlerts: true,
        alertChannels: ['log', 'event'],
        escalationDelay: 300000 // 5 minutes
      },
      ...config
    };

    this.initializeDefaultAlertRules();
    this.startAnalysis();
    this.setupEventListeners();

    logger.info('Troubleshooting dashboard service initialized');
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultAlertRules(): void {
    const defaultRules: Omit<AlertRule, 'id'>[] = [
      {
        name: 'High Error Rate',
        condition: 'error_rate > threshold',
        threshold: 0.05,
        severity: 'high',
        enabled: true,
        cooldown: 300000 // 5 minutes
      },
      {
        name: 'High Response Time',
        condition: 'avg_response_time > threshold',
        threshold: 2000,
        severity: 'medium',
        enabled: true,
        cooldown: 300000
      },
      {
        name: 'Service Down',
        condition: 'service_availability < threshold',
        threshold: 0.95,
        severity: 'critical',
        enabled: true,
        cooldown: 60000 // 1 minute
      },
      {
        name: 'High Memory Usage',
        condition: 'memory_usage > threshold',
        threshold: 0.85,
        severity: 'medium',
        enabled: true,
        cooldown: 600000 // 10 minutes
      },
      {
        name: 'Circuit Breaker Open',
        condition: 'circuit_breaker_open > threshold',
        threshold: 0,
        severity: 'high',
        enabled: true,
        cooldown: 180000 // 3 minutes
      }
    ];

    defaultRules.forEach(rule => {
      const id = this.generateId();
      this.alertRules.set(id, { ...rule, id });
    });
  }

  /**
   * Setup event listeners for system events
   */
  private setupEventListeners(): void {
    if (!this.config.enabled) return;

    // Listen to tracing events
    distributedTracingService.on('trace_completed', (event) => {
      this.analyzeTrace(event.trace);
    });

    // Listen to monitoring events
    systemMonitoringService.on('alert_created', (alert) => {
      this.handleSystemAlert(alert);
    });

    // Listen to resilience events
    resilienceCoordinatorService.on('service_degraded', (event) => {
      this.handleServiceDegradation(event);
    });
  }

  /**
   * Start continuous analysis
   */
  private startAnalysis(): void {
    if (!this.config.enabled) return;

    this.analysisInterval = setInterval(() => {
      this.performSystemAnalysis();
    }, this.config.analysis.timeWindow);

    // Perform initial analysis
    this.performSystemAnalysis();
  }

  /**
   * Analyze a completed trace for issues
   */
  private analyzeTrace(trace: RequestTrace): void {
    // Check for errors
    if (trace.metrics.errorSpans > 0) {
      this.createOrUpdateIssue({
        type: 'error',
        title: 'Request Errors Detected',
        description: `Request ${trace.traceId} encountered ${trace.metrics.errorSpans} errors`,
        affectedServices: [...new Set(trace.spans.filter(s => s.status === 'error').map(s => s.serviceName))],
        traceId: trace.traceId,
        severity: trace.metrics.errorSpans > 3 ? 'high' : 'medium'
      });
    }

    // Check for performance issues
    if (trace.duration && trace.duration > this.config.analysis.performanceThreshold) {
      this.createOrUpdateIssue({
        type: 'performance',
        title: 'Slow Request Performance',
        description: `Request took ${trace.duration}ms (threshold: ${this.config.analysis.performanceThreshold}ms)`,
        affectedServices: [...new Set(trace.spans.map(s => s.serviceName))],
        traceId: trace.traceId,
        severity: trace.duration > this.config.analysis.performanceThreshold * 2 ? 'high' : 'medium'
      });
    }

    // Check for resource issues
    if (trace.metrics.databaseCalls > 20) {
      this.createOrUpdateIssue({
        type: 'performance',
        title: 'Excessive Database Calls',
        description: `Request made ${trace.metrics.databaseCalls} database calls`,
        affectedServices: ['database'],
        traceId: trace.traceId,
        severity: 'medium'
      });
    }
  }

  /**
   * Handle system alerts
   */
  private handleSystemAlert(alert: any): void {
    this.createOrUpdateIssue({
      type: alert.type === 'resource' ? 'capacity' : 'error',
      title: alert.message,
      description: `System alert: ${alert.message}`,
      affectedServices: [alert.service],
      severity: alert.severity,
      alertId: alert.id
    });
  }

  /**
   * Handle service degradation events
   */
  private handleServiceDegradation(event: any): void {
    this.createOrUpdateIssue({
      type: 'availability',
      title: 'Service Degradation',
      description: `Service ${event.service} is degraded: ${event.reason}`,
      affectedServices: [event.service],
      severity: 'high'
    });
  }

  /**
   * Create or update a system issue
   */
  private createOrUpdateIssue(params: {
    type: 'error' | 'performance' | 'availability' | 'capacity';
    title: string;
    description: string;
    affectedServices: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
    traceId?: string;
    alertId?: string;
  }): void {
    // Generate issue key based on type and affected services
    const issueKey = `${params.type}-${params.affectedServices.sort().join('-')}`;
    const existingIssue = this.issues.get(issueKey);

    if (existingIssue) {
      // Update existing issue
      existingIssue.lastSeen = new Date();
      existingIssue.occurrences++;
      existingIssue.description = params.description; // Update with latest description
      
      if (params.traceId && !existingIssue.relatedTraces.includes(params.traceId)) {
        existingIssue.relatedTraces.push(params.traceId);
      }

      // Escalate severity if needed
      if (existingIssue.occurrences >= this.config.analysis.alertThreshold) {
        existingIssue.severity = this.escalateSeverity(existingIssue.severity);
      }

      this.emit('issue_updated', existingIssue);
    } else {
      // Create new issue
      const issue: SystemIssue = {
        id: this.generateId(),
        type: params.type,
        severity: params.severity,
        title: params.title,
        description: params.description,
        affectedServices: params.affectedServices,
        firstSeen: new Date(),
        lastSeen: new Date(),
        occurrences: 1,
        status: 'active',
        relatedTraces: params.traceId ? [params.traceId] : [],
        metrics: {
          errorRate: 0,
          affectedUsers: 0,
          impactScore: this.calculateImpactScore(params.type, params.severity)
        },
        troubleshooting: this.generateTroubleshootingInfo(params.type, params.affectedServices)
      };

      this.issues.set(issueKey, issue);
      this.emit('issue_created', issue);

      logger.warn({
        issueId: issue.id,
        type: issue.type,
        severity: issue.severity,
        title: issue.title
      }, 'New system issue detected');
    }
  }

  /**
   * Perform comprehensive system analysis
   */
  private async performSystemAnalysis(): Promise<void> {
    try {
      // Get system metrics
      const systemMetrics = systemMonitoringService.getCurrentMetrics();
      const resilienceMetrics = resilienceCoordinatorService.getResilienceMetrics();
      const tracingMetrics = distributedTracingService.getMetrics();

      // Analyze patterns and generate insights
      if (this.config.insights.enablePatternDetection) {
        this.detectPatterns();
      }

      if (this.config.insights.enableRootCauseAnalysis) {
        this.performRootCauseAnalysis();
      }

      if (this.config.insights.enablePredictiveAnalysis) {
        this.performPredictiveAnalysis();
      }

      // Check alert rules
      this.checkAlertRules();

      // Generate performance insights
      this.generatePerformanceInsights(systemMetrics, resilienceMetrics, tracingMetrics);

      // Clean up resolved issues
      this.cleanupResolvedIssues();

    } catch (error) {
      logger.error({ error }, 'Error during system analysis');
    }
  }

  /**
   * Detect patterns in system behavior
   */
  private detectPatterns(): void {
    const recentTraces = distributedTracingService.searchTraces({
      startTime: new Date(Date.now() - this.config.analysis.timeWindow),
      limit: 1000
    });

    // Pattern: Recurring errors in same service
    const errorsByService = new Map<string, number>();
    recentTraces.forEach(trace => {
      trace.spans.filter(s => s.status === 'error').forEach(span => {
        errorsByService.set(span.serviceName, (errorsByService.get(span.serviceName) || 0) + 1);
      });
    });

    errorsByService.forEach((count, service) => {
      if (count >= 5) { // 5 or more errors in time window
        this.createOrUpdateIssue({
          type: 'error',
          title: 'Recurring Service Errors',
          description: `${service} service has ${count} errors in the last ${this.config.analysis.timeWindow / 60000} minutes`,
          affectedServices: [service],
          severity: count >= 10 ? 'high' : 'medium'
        });
      }
    });

    // Pattern: Performance degradation trend
    const performanceByService = new Map<string, number[]>();
    recentTraces.forEach(trace => {
      trace.spans.forEach(span => {
        if (span.duration) {
          if (!performanceByService.has(span.serviceName)) {
            performanceByService.set(span.serviceName, []);
          }
          performanceByService.get(span.serviceName)!.push(span.duration);
        }
      });
    });

    performanceByService.forEach((durations, service) => {
      if (durations.length >= 10) {
        const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
        if (avgDuration > this.config.analysis.performanceThreshold) {
          this.createOrUpdateIssue({
            type: 'performance',
            title: 'Service Performance Degradation',
            description: `${service} service average response time is ${avgDuration.toFixed(0)}ms`,
            affectedServices: [service],
            severity: avgDuration > this.config.analysis.performanceThreshold * 2 ? 'high' : 'medium'
          });
        }
      }
    });
  }

  /**
   * Perform root cause analysis
   */
  private performRootCauseAnalysis(): void {
    const activeIssues = Array.from(this.issues.values()).filter(i => i.status === 'active');

    activeIssues.forEach(issue => {
      if (!issue.rootCause && issue.relatedTraces.length > 0) {
        // Analyze related traces for root cause
        const traces = issue.relatedTraces
          .map(traceId => distributedTracingService.getTrace(traceId))
          .filter(trace => trace !== undefined) as RequestTrace[];

        if (traces.length > 0) {
          const rootCause = this.identifyRootCause(traces, issue.type);
          if (rootCause) {
            issue.rootCause = rootCause;
            this.emit('root_cause_identified', { issue, rootCause });
          }
        }
      }
    });
  }

  /**
   * Perform predictive analysis
   */
  private performPredictiveAnalysis(): void {
    // Simple trend analysis - in production, this would use more sophisticated ML
    const recentMetrics = systemMonitoringService.getMetricsHistory(1); // Last hour
    
    if (recentMetrics.length >= 4) { // Need at least 4 data points
      const latestMetrics = recentMetrics.slice(-4);
      
      // Analyze error rate trend
      const errorRates = latestMetrics.map(m => m.performance.errors.errorRate);
      const errorTrend = this.calculateTrend(errorRates);
      
      if (errorTrend > 0.02) { // Error rate increasing by 2% per measurement
        this.createOrUpdateIssue({
          type: 'error',
          title: 'Predicted Error Rate Increase',
          description: `Error rate is trending upward (${(errorTrend * 100).toFixed(2)}% per measurement)`,
          affectedServices: ['system'],
          severity: 'medium'
        });
      }

      // Analyze response time trend
      const responseTimes = latestMetrics.map(m => m.performance.responseTime.p95);
      const responseTrend = this.calculateTrend(responseTimes);
      
      if (responseTrend > 100) { // Response time increasing by 100ms per measurement
        this.createOrUpdateIssue({
          type: 'performance',
          title: 'Predicted Performance Degradation',
          description: `Response time is trending upward (${responseTrend.toFixed(0)}ms per measurement)`,
          affectedServices: ['system'],
          severity: 'medium'
        });
      }
    }
  }

  /**
   * Check alert rules against current metrics
   */
  private checkAlertRules(): void {
    const currentMetrics = systemMonitoringService.getCurrentMetrics();
    const resilienceMetrics = resilienceCoordinatorService.getResilienceMetrics();
    
    if (!currentMetrics) return;

    this.alertRules.forEach(rule => {
      if (!rule.enabled) return;

      // Check cooldown
      if (rule.lastTriggered && 
          Date.now() - rule.lastTriggered.getTime() < rule.cooldown) {
        return;
      }

      let shouldTrigger = false;
      let currentValue = 0;

      switch (rule.condition) {
        case 'error_rate > threshold':
          currentValue = currentMetrics.performance.errors.errorRate;
          shouldTrigger = currentValue > rule.threshold;
          break;
        case 'avg_response_time > threshold':
          currentValue = currentMetrics.performance.responseTime.p95;
          shouldTrigger = currentValue > rule.threshold;
          break;
        case 'service_availability < threshold':
          currentValue = resilienceMetrics.overallSystemHealth / 100;
          shouldTrigger = currentValue < rule.threshold;
          break;
        case 'memory_usage > threshold':
          currentValue = currentMetrics.system.memory.percentage / 100;
          shouldTrigger = currentValue > rule.threshold;
          break;
        case 'circuit_breaker_open > threshold':
          currentValue = resilienceMetrics.circuitsOpen;
          shouldTrigger = currentValue > rule.threshold;
          break;
      }

      if (shouldTrigger) {
        rule.lastTriggered = new Date();
        
        this.emit('alert_triggered', {
          rule,
          currentValue,
          threshold: rule.threshold
        });

        logger.warn({
          ruleName: rule.name,
          currentValue,
          threshold: rule.threshold,
          severity: rule.severity
        }, 'Alert rule triggered');
      }
    });
  }

  /**
   * Generate performance insights
   */
  private generatePerformanceInsights(systemMetrics: any, resilienceMetrics: any, tracingMetrics: any): void {
    const insights: Omit<PerformanceInsight, 'id'>[] = [];

    // Response time insight
    if (systemMetrics?.performance.responseTime.p95) {
      insights.push({
        category: 'latency',
        title: 'Response Time Analysis',
        description: `95th percentile response time is ${systemMetrics.performance.responseTime.p95.toFixed(0)}ms`,
        impact: systemMetrics.performance.responseTime.p95 > 2000 ? 'high' : 
                systemMetrics.performance.responseTime.p95 > 1000 ? 'medium' : 'low',
        trend: 'stable', // Would calculate from historical data
        metrics: {
          current: systemMetrics.performance.responseTime.p95,
          baseline: 1000,
          change: systemMetrics.performance.responseTime.p95 - 1000,
          unit: 'ms'
        },
        recommendations: systemMetrics.performance.responseTime.p95 > 2000 ? [
          'Implement caching for frequently accessed data',
          'Optimize database queries',
          'Consider CDN for static assets'
        ] : ['Monitor response time trends'],
        actionItems: [{
          priority: systemMetrics.performance.responseTime.p95 > 2000 ? 'high' : 'medium',
          action: 'Review slow endpoints and optimize',
          estimatedEffort: '1-2 days',
          expectedImpact: '20-30% response time improvement'
        }]
      });
    }

    // Error rate insight
    if (systemMetrics?.performance.errors.errorRate) {
      insights.push({
        category: 'errors',
        title: 'Error Rate Analysis',
        description: `Current error rate is ${(systemMetrics.performance.errors.errorRate * 100).toFixed(2)}%`,
        impact: systemMetrics.performance.errors.errorRate > 0.05 ? 'high' : 
                systemMetrics.performance.errors.errorRate > 0.02 ? 'medium' : 'low',
        trend: 'stable',
        metrics: {
          current: systemMetrics.performance.errors.errorRate * 100,
          baseline: 1,
          change: (systemMetrics.performance.errors.errorRate * 100) - 1,
          unit: '%'
        },
        recommendations: systemMetrics.performance.errors.errorRate > 0.05 ? [
          'Implement better error handling',
          'Add circuit breakers for external services',
          'Review and fix common error patterns'
        ] : ['Continue monitoring error patterns'],
        actionItems: [{
          priority: systemMetrics.performance.errors.errorRate > 0.05 ? 'high' : 'low',
          action: 'Analyze error logs and implement fixes',
          estimatedEffort: '2-3 days',
          expectedImpact: '50% error rate reduction'
        }]
      });
    }

    // System health insight
    insights.push({
      category: 'resources',
      title: 'System Health Overview',
      description: `Overall system health is ${resilienceMetrics.overallSystemHealth}%`,
      impact: resilienceMetrics.overallSystemHealth < 70 ? 'high' : 
              resilienceMetrics.overallSystemHealth < 90 ? 'medium' : 'low',
      trend: 'stable',
      metrics: {
        current: resilienceMetrics.overallSystemHealth,
        baseline: 95,
        change: resilienceMetrics.overallSystemHealth - 95,
        unit: '%'
      },
      recommendations: resilienceMetrics.overallSystemHealth < 90 ? [
        'Investigate degraded services',
        'Scale resources if needed',
        'Review system capacity'
      ] : ['Maintain current monitoring'],
      actionItems: [{
        priority: resilienceMetrics.overallSystemHealth < 70 ? 'high' : 'medium',
        action: 'Address service health issues',
        estimatedEffort: '1-2 days',
        expectedImpact: 'Restore system health to >95%'
      }]
    });

    // Update insights
    insights.forEach(insight => {
      const id = this.generateId();
      this.insights.set(id, { ...insight, id });
    });

    // Keep only recent insights (last 10)
    if (this.insights.size > 10) {
      const sortedInsights = Array.from(this.insights.entries())
        .sort(([, a], [, b]) => a.id.localeCompare(b.id));
      
      const toRemove = sortedInsights.slice(0, this.insights.size - 10);
      toRemove.forEach(([id]) => this.insights.delete(id));
    }
  }

  /**
   * Generate troubleshooting report
   */
  generateTroubleshootingReport(): TroubleshootingReport {
    const now = new Date();
    const timeRange = {
      start: new Date(now.getTime() - this.config.analysis.timeWindow),
      end: now
    };

    const activeIssues = Array.from(this.issues.values()).filter(i => i.status === 'active');
    const resolvedIssues = Array.from(this.issues.values()).filter(i => i.status === 'resolved');
    const criticalIssues = activeIssues.filter(i => i.severity === 'critical');

    const systemMetrics = systemMonitoringService.getCurrentMetrics();
    const resilienceMetrics = resilienceCoordinatorService.getResilienceMetrics();
    const tracingMetrics = distributedTracingService.getMetrics();

    const report: TroubleshootingReport = {
      id: this.generateId(),
      timestamp: now,
      timeRange,
      summary: {
        totalIssues: activeIssues.length,
        criticalIssues: criticalIssues.length,
        resolvedIssues: resolvedIssues.length,
        systemHealth: resilienceMetrics.overallSystemHealth,
        uptime: Date.now() - this.startTime.getTime()
      },
      issues: activeIssues,
      insights: Array.from(this.insights.values()),
      systemMetrics: {
        requests: {
          total: systemMetrics?.application.requestCount || 0,
          errors: systemMetrics?.application.errorCount || 0,
          errorRate: systemMetrics?.performance.errors.errorRate || 0,
          averageLatency: systemMetrics?.performance.responseTime.p95 || 0
        },
        services: {
          total: resilienceMetrics.totalServices,
          healthy: resilienceMetrics.healthyServices,
          degraded: resilienceMetrics.degradedServices,
          failed: resilienceMetrics.failedServices
        },
        resources: {
          cpuUsage: systemMetrics?.system.cpu.usage || 0,
          memoryUsage: systemMetrics?.system.memory.percentage || 0,
          diskUsage: systemMetrics?.system.disk.percentage || 0
        }
      },
      recommendations: this.generateRecommendations(activeIssues, Array.from(this.insights.values()))
    };

    this.reports.push(report);

    // Keep only last 24 reports
    if (this.reports.length > 24) {
      this.reports = this.reports.slice(-24);
    }

    return report;
  }

  /**
   * Get current system issues
   */
  getActiveIssues(): SystemIssue[] {
    return Array.from(this.issues.values()).filter(i => i.status === 'active');
  }

  /**
   * Get performance insights
   */
  getPerformanceInsights(): PerformanceInsight[] {
    return Array.from(this.insights.values());
  }

  /**
   * Get troubleshooting reports
   */
  getTroubleshootingReports(limit: number = 10): TroubleshootingReport[] {
    return this.reports.slice(-limit);
  }

  /**
   * Resolve an issue
   */
  resolveIssue(issueId: string, resolution: string): boolean {
    const issue = Array.from(this.issues.values()).find(i => i.id === issueId);
    if (!issue) return false;

    issue.status = 'resolved';
    issue.resolution = resolution;

    this.emit('issue_resolved', issue);
    return true;
  }

  /**
   * Helper methods
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private escalateSeverity(currentSeverity: 'low' | 'medium' | 'high' | 'critical'): 'low' | 'medium' | 'high' | 'critical' {
    switch (currentSeverity) {
      case 'low': return 'medium';
      case 'medium': return 'high';
      case 'high': return 'critical';
      case 'critical': return 'critical';
    }
  }

  private calculateImpactScore(type: string, severity: string): number {
    const typeWeight = { error: 3, performance: 2, availability: 4, capacity: 2 };
    const severityWeight = { low: 1, medium: 2, high: 3, critical: 4 };
    
    return (typeWeight[type as keyof typeof typeWeight] || 1) * 
           (severityWeight[severity as keyof typeof severityWeight] || 1);
  }

  private generateTroubleshootingInfo(type: string, affectedServices: string[]): SystemIssue['troubleshooting'] {
    const troubleshooting: SystemIssue['troubleshooting'] = {
      symptoms: [],
      possibleCauses: [],
      diagnosticSteps: [],
      recommendations: []
    };

    switch (type) {
      case 'error':
        troubleshooting.symptoms = ['Increased error rates', 'Failed requests', 'Exception logs'];
        troubleshooting.possibleCauses = ['Service failures', 'Network issues', 'Invalid input data', 'Resource exhaustion'];
        troubleshooting.diagnosticSteps = [
          'Check service logs for error details',
          'Verify service health endpoints',
          'Review recent deployments',
          'Check resource utilization'
        ];
        troubleshooting.recommendations = [
          'Implement retry logic with exponential backoff',
          'Add circuit breakers for external dependencies',
          'Improve error handling and logging',
          'Set up monitoring alerts'
        ];
        break;

      case 'performance':
        troubleshooting.symptoms = ['Slow response times', 'High latency', 'Timeout errors'];
        troubleshooting.possibleCauses = ['Database bottlenecks', 'Network latency', 'Resource contention', 'Inefficient algorithms'];
        troubleshooting.diagnosticSteps = [
          'Profile application performance',
          'Check database query performance',
          'Monitor resource utilization',
          'Analyze network latency'
        ];
        troubleshooting.recommendations = [
          'Optimize database queries',
          'Implement caching strategies',
          'Scale resources horizontally',
          'Use CDN for static content'
        ];
        break;

      case 'availability':
        troubleshooting.symptoms = ['Service unavailable', 'Connection failures', 'Health check failures'];
        troubleshooting.possibleCauses = ['Service crashes', 'Network partitions', 'Resource exhaustion', 'Configuration errors'];
        troubleshooting.diagnosticSteps = [
          'Check service status and logs',
          'Verify network connectivity',
          'Review resource availability',
          'Validate configuration settings'
        ];
        troubleshooting.recommendations = [
          'Implement health checks and auto-restart',
          'Set up redundancy and failover',
          'Monitor resource usage',
          'Use infrastructure as code'
        ];
        break;

      case 'capacity':
        troubleshooting.symptoms = ['Resource exhaustion', 'Queue buildup', 'Throttling errors'];
        troubleshooting.possibleCauses = ['Traffic spikes', 'Resource limits', 'Memory leaks', 'Inefficient resource usage'];
        troubleshooting.diagnosticSteps = [
          'Monitor resource utilization trends',
          'Analyze traffic patterns',
          'Check for memory leaks',
          'Review capacity planning'
        ];
        troubleshooting.recommendations = [
          'Implement auto-scaling',
          'Optimize resource usage',
          'Set up capacity alerts',
          'Plan for traffic growth'
        ];
        break;
    }

    return troubleshooting;
  }

  private identifyRootCause(traces: RequestTrace[], issueType: string): string | null {
    // Simple root cause analysis - in production, this would be more sophisticated
    const errorSpans = traces.flatMap(t => t.spans.filter(s => s.status === 'error'));
    
    if (errorSpans.length === 0) return null;

    // Find most common error
    const errorCounts = new Map<string, number>();
    errorSpans.forEach(span => {
      const key = `${span.serviceName}:${span.error?.message || 'unknown'}`;
      errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
    });

    const mostCommonError = Array.from(errorCounts.entries())
      .sort(([, a], [, b]) => b - a)[0];

    return mostCommonError ? mostCommonError[0] : null;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    // Simple linear regression slope
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + (i * val), 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;

    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  private generateRecommendations(issues: SystemIssue[], insights: PerformanceInsight[]): {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  } {
    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];

    // Immediate actions for critical issues
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      immediate.push('Address critical system issues immediately');
      immediate.push('Activate incident response procedures');
    }

    // High-impact insights
    const highImpactInsights = insights.filter(i => i.impact === 'high');
    highImpactInsights.forEach(insight => {
      insight.actionItems.forEach(action => {
        if (action.priority === 'high') {
          immediate.push(action.action);
        } else {
          shortTerm.push(action.action);
        }
      });
    });

    // General recommendations
    if (issues.some(i => i.type === 'performance')) {
      shortTerm.push('Implement performance monitoring and optimization');
    }

    if (issues.some(i => i.type === 'error')) {
      shortTerm.push('Enhance error handling and recovery mechanisms');
    }

    longTerm.push('Implement predictive analytics for proactive issue detection');
    longTerm.push('Establish comprehensive monitoring and alerting');
    longTerm.push('Regular system health reviews and capacity planning');

    return { immediate, shortTerm, longTerm };
  }

  private cleanupResolvedIssues(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [key, issue] of this.issues.entries()) {
      if (issue.status === 'resolved' && issue.lastSeen.getTime() < cutoffTime) {
        this.issues.delete(key);
      }
    }
  }

  /**
   * Health check for the dashboard service
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    uptime: number;
    activeIssues: number;
    criticalIssues: number;
    insights: number;
    reports: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    const activeIssues = this.getActiveIssues();
    const criticalIssues = activeIssues.filter(i => i.severity === 'critical');

    if (criticalIssues.length > 0) {
      issues.push(`${criticalIssues.length} critical issues detected`);
    }

    if (activeIssues.length > 50) {
      issues.push('High number of active issues');
    }

    return {
      healthy: issues.length === 0,
      uptime: Date.now() - this.startTime.getTime(),
      activeIssues: activeIssues.length,
      criticalIssues: criticalIssues.length,
      insights: this.insights.size,
      reports: this.reports.length,
      issues
    };
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down troubleshooting dashboard service');

    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }

    this.removeAllListeners();
    logger.info('Troubleshooting dashboard service shutdown complete');
  }
}

export const troubleshootingDashboardService = new TroubleshootingDashboardService({
  enabled: true,
  analysis: {
    timeWindow: 15 * 60 * 1000, // 15 minutes
    errorThreshold: 0.05,
    performanceThreshold: 2000,
    alertThreshold: 3
  },
  insights: {
    enablePatternDetection: true,
    enableRootCauseAnalysis: true,
    enablePredictiveAnalysis: true
  },
  notifications: {
    enableAlerts: true,
    alertChannels: ['log', 'event'],
    escalationDelay: 300000
  }
});