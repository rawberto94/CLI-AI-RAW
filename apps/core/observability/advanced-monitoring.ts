/**
 * Advanced Observability Stack with Predictive Analytics
 * Comprehensive monitoring, tracing, and chaos engineering
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

export interface Trace {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  serviceName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'success' | 'error' | 'timeout';
  tags: Record<string, any>;
  logs: TraceLog[];
  baggage: Record<string, string>;
}

export interface TraceLog {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  fields?: Record<string, any>;
}

export interface Metric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  value: number;
  timestamp: Date;
  labels: Record<string, string>;
  unit?: string;
}

export interface Alert {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'firing' | 'resolved' | 'silenced';
  condition: AlertCondition;
  triggeredAt: Date;
  resolvedAt?: Date;
  description: string;
  runbook?: string;
  notifications: NotificationChannel[];
}

export interface AlertCondition {
  metric: string;
  operator: '>' | '<' | '==' | '!=' | '>=' | '<=';
  threshold: number;
  duration: number; // seconds
  aggregation: 'avg' | 'sum' | 'min' | 'max' | 'count';
}

export interface NotificationChannel {
  type: 'email' | 'slack' | 'webhook' | 'pagerduty';
  config: Record<string, any>;
  enabled: boolean;
}

export interface ChaosExperiment {
  id: string;
  name: string;
  description: string;
  type: 'latency' | 'failure' | 'resource' | 'network' | 'dependency';
  target: {
    service: string;
    method?: string;
    percentage: number; // 0-100
  };
  parameters: Record<string, any>;
  schedule: {
    enabled: boolean;
    cron?: string;
    duration: number; // seconds
  };
  status: 'inactive' | 'running' | 'completed' | 'failed';
  results?: ChaosResult;
  safetyChecks: SafetyCheck[];
}

export interface ChaosResult {
  startTime: Date;
  endTime: Date;
  impactedRequests: number;
  errorRate: number;
  latencyIncrease: number;
  recoveryTime: number;
  observations: string[];
  recommendations: string[];
}

export interface SafetyCheck {
  name: string;
  condition: string;
  enabled: boolean;
  description: string;
}

export interface PredictiveModel {
  id: string;
  name: string;
  type: 'anomaly_detection' | 'capacity_planning' | 'failure_prediction' | 'performance_forecasting';
  features: string[];
  algorithm: 'isolation_forest' | 'lstm' | 'arima' | 'prophet' | 'linear_regression';
  accuracy: number;
  lastTrained: Date;
  predictions: Prediction[];
}

export interface Prediction {
  timestamp: Date;
  metric: string;
  predictedValue: number;
  confidence: number;
  anomalyScore?: number;
  explanation?: string;
}

export interface ServiceHealth {
  serviceName: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  uptime: number; // percentage
  errorRate: number; // percentage
  avgLatency: number; // ms
  throughput: number; // requests/second
  dependencies: ServiceDependency[];
  sla: {
    availability: number; // target percentage
    latency: number; // target ms
    errorRate: number; // target percentage
  };
  healthScore: number; // 0-100
}

export interface ServiceDependency {
  serviceName: string;
  type: 'database' | 'api' | 'queue' | 'cache' | 'external';
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  errorRate: number;
  critical: boolean;
}

export class AdvancedMonitoring extends EventEmitter {
  private traces = new Map<string, Trace[]>();
  private metrics = new Map<string, Metric[]>();
  private alerts = new Map<string, Alert>();
  private chaosExperiments = new Map<string, ChaosExperiment>();
  private predictiveModels = new Map<string, PredictiveModel>();
  private serviceHealth = new Map<string, ServiceHealth>();
  private activeSpans = new Map<string, Trace>();

  constructor() {
    super();
    this.initializeDefaultModels();
    this.startMetricsCollection();
    this.startAnomalyDetection();
    this.startHealthChecks();
  }

  /**
   * Start distributed trace
   */
  startTrace(
    operationName: string,
    serviceName: string,
    parentSpanId?: string,
    tags: Record<string, any> = {}
  ): Trace {
    const trace: Trace = {
      traceId: parentSpanId ? this.getTraceIdFromSpan(parentSpanId) : crypto.randomUUID(),
      spanId: crypto.randomUUID(),
      parentSpanId,
      operationName,
      serviceName,
      startTime: new Date(),
      status: 'success',
      tags: {
        ...tags,
        'span.kind': 'server',
        'service.name': serviceName,
        'operation.name': operationName
      },
      logs: [],
      baggage: {}
    };

    this.activeSpans.set(trace.spanId, trace);
    this.emit('trace:started', trace);

    return trace;
  }

  /**
   * Finish trace
   */
  finishTrace(spanId: string, status: Trace['status'] = 'success', error?: Error): void {
    const trace = this.activeSpans.get(spanId);
    if (!trace) return;

    trace.endTime = new Date();
    trace.duration = trace.endTime.getTime() - trace.startTime.getTime();
    trace.status = status;

    if (error) {
      trace.tags['error'] = true;
      trace.tags['error.message'] = error.message;
      trace.tags['error.stack'] = error.stack;
    }

    // Store trace
    if (!this.traces.has(trace.traceId)) {
      this.traces.set(trace.traceId, []);
    }
    this.traces.get(trace.traceId)!.push(trace);

    this.activeSpans.delete(spanId);
    this.emit('trace:finished', trace);

    // Update service metrics
    this.updateServiceMetrics(trace);
  }

  /**
   * Add log to trace
   */
  addTraceLog(spanId: string, level: TraceLog['level'], message: string, fields?: Record<string, any>): void {
    const trace = this.activeSpans.get(spanId);
    if (!trace) return;

    trace.logs.push({
      timestamp: new Date(),
      level,
      message,
      fields
    });
  }

  /**
   * Record metric
   */
  recordMetric(
    name: string,
    type: Metric['type'],
    value: number,
    labels: Record<string, string> = {},
    unit?: string
  ): void {
    const metric: Metric = {
      name,
      type,
      value,
      timestamp: new Date(),
      labels,
      unit
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(metric);

    // Keep only recent metrics (last 24 hours)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.metrics.set(name, this.metrics.get(name)!.filter(m => m.timestamp > cutoff));

    this.emit('metric:recorded', metric);

    // Check for alert conditions
    this.checkAlertConditions(metric);
  }

  /**
   * Create alert rule
   */
  createAlert(
    name: string,
    condition: AlertCondition,
    severity: Alert['severity'],
    description: string,
    notifications: NotificationChannel[] = [],
    runbook?: string
  ): Alert {
    const alert: Alert = {
      id: crypto.randomUUID(),
      name,
      severity,
      status: 'resolved',
      condition,
      triggeredAt: new Date(),
      description,
      runbook,
      notifications
    };

    this.alerts.set(alert.id, alert);
    this.emit('alert:created', alert);

    return alert;
  }

  /**
   * Create chaos experiment
   */
  createChaosExperiment(experiment: Omit<ChaosExperiment, 'id' | 'status'>): ChaosExperiment {
    const chaosExperiment: ChaosExperiment = {
      id: crypto.randomUUID(),
      ...experiment,
      status: 'inactive'
    };

    this.chaosExperiments.set(chaosExperiment.id, chaosExperiment);
    this.emit('chaos:experiment_created', chaosExperiment);

    return chaosExperiment;
  }

  /**
   * Run chaos experiment
   */
  async runChaosExperiment(experimentId: string): Promise<ChaosResult> {
    const experiment = this.chaosExperiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Chaos experiment ${experimentId} not found`);
    }

    // Check safety conditions
    const safetyChecksPassed = await this.checkSafetyConditions(experiment);
    if (!safetyChecksPassed) {
      throw new Error('Safety checks failed - experiment aborted');
    }

    experiment.status = 'running';
    const startTime = new Date();

    this.emit('chaos:experiment_started', experiment);

    try {
      // Execute chaos experiment
      const result = await this.executeChaosExperiment(experiment);
      
      experiment.status = 'completed';
      experiment.results = result;

      this.emit('chaos:experiment_completed', { experiment, result });
      return result;

    } catch (error) {
      experiment.status = 'failed';
      this.emit('chaos:experiment_failed', { experiment, error });
      throw error;
    }
  }

  /**
   * Train predictive model
   */
  async trainPredictiveModel(
    name: string,
    type: PredictiveModel['type'],
    features: string[],
    algorithm: PredictiveModel['algorithm'] = 'isolation_forest'
  ): Promise<PredictiveModel> {
    const model: PredictiveModel = {
      id: crypto.randomUUID(),
      name,
      type,
      features,
      algorithm,
      accuracy: 0,
      lastTrained: new Date(),
      predictions: []
    };

    // Simulate model training
    const trainingData = await this.prepareTrainingData(features);
    const accuracy = await this.trainModel(algorithm, trainingData);
    
    model.accuracy = accuracy;
    this.predictiveModels.set(model.id, model);

    this.emit('model:trained', model);
    return model;
  }

  /**
   * Generate predictions
   */
  async generatePredictions(modelId: string, horizon: number = 24): Promise<Prediction[]> {
    const model = this.predictiveModels.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    const predictions: Prediction[] = [];
    const now = new Date();

    for (let i = 1; i <= horizon; i++) {
      const timestamp = new Date(now.getTime() + i * 60 * 60 * 1000); // hourly predictions
      
      for (const feature of model.features) {
        const prediction = await this.predictValue(model, feature, timestamp);
        predictions.push(prediction);
      }
    }

    model.predictions = predictions;
    this.emit('predictions:generated', { modelId, predictions });

    return predictions;
  }

  /**
   * Detect anomalies
   */
  async detectAnomalies(serviceName?: string): Promise<{
    anomalies: Array<{
      metric: string;
      timestamp: Date;
      value: number;
      anomalyScore: number;
      severity: 'low' | 'medium' | 'high';
      explanation: string;
    }>;
    summary: {
      totalAnomalies: number;
      severityDistribution: Record<string, number>;
      affectedServices: string[];
    };
  }> {
    const anomalies: any[] = [];
    const affectedServices = new Set<string>();

    // Analyze metrics for anomalies
    for (const [metricName, metricData] of this.metrics.entries()) {
      if (serviceName && !metricName.includes(serviceName)) continue;

      const recentMetrics = metricData.slice(-100); // Last 100 data points
      const anomalyResults = await this.analyzeMetricAnomalies(metricName, recentMetrics);
      
      anomalies.push(...anomalyResults);
      anomalyResults.forEach(anomaly => {
        if (anomaly.metric.includes('.')) {
          affectedServices.add(anomaly.metric.split('.')[0]);
        }
      });
    }

    const severityDistribution = anomalies.reduce((acc, anomaly) => {
      acc[anomaly.severity] = (acc[anomaly.severity] || 0) + 1;
      return acc;
    }, {});

    return {
      anomalies,
      summary: {
        totalAnomalies: anomalies.length,
        severityDistribution,
        affectedServices: Array.from(affectedServices)
      }
    };
  }

  /**
   * Get service health dashboard
   */
  getServiceHealthDashboard(): {
    services: ServiceHealth[];
    overallHealth: number;
    criticalIssues: number;
    slaViolations: number;
    recommendations: string[];
  } {
    const services = Array.from(this.serviceHealth.values());
    const overallHealth = services.reduce((sum, service) => sum + service.healthScore, 0) / services.length;
    
    const criticalIssues = services.filter(s => s.status === 'unhealthy').length;
    const slaViolations = services.filter(s => 
      s.uptime < s.sla.availability ||
      s.avgLatency > s.sla.latency ||
      s.errorRate > s.sla.errorRate
    ).length;

    const recommendations = this.generateHealthRecommendations(services);

    return {
      services,
      overallHealth,
      criticalIssues,
      slaViolations,
      recommendations
    };
  }

  // Private helper methods

  private initializeDefaultModels(): void {
    // Initialize default predictive models
    this.trainPredictiveModel('latency_predictor', 'performance_forecasting', ['response_time', 'throughput'], 'lstm');
    this.trainPredictiveModel('anomaly_detector', 'anomaly_detection', ['cpu_usage', 'memory_usage', 'error_rate'], 'isolation_forest');
    this.trainPredictiveModel('capacity_planner', 'capacity_planning', ['request_count', 'resource_usage'], 'linear_regression');
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000); // Every 30 seconds
  }

  private startAnomalyDetection(): void {
    setInterval(async () => {
      const anomalies = await this.detectAnomalies();
      if (anomalies.anomalies.length > 0) {
        this.emit('anomalies:detected', anomalies);
      }
    }, 300000); // Every 5 minutes
  }

  private startHealthChecks(): void {
    setInterval(() => {
      this.updateServiceHealth();
    }, 60000); // Every minute
  }

  private collectSystemMetrics(): void {
    // Simulate system metrics collection
    const services = ['contract-api', 'processing-worker', 'vector-db', 'graph-engine'];
    
    services.forEach(service => {
      // CPU metrics
      this.recordMetric(
        `${service}.cpu_usage`,
        'gauge',
        Math.random() * 100,
        { service, instance: 'i-123' },
        'percent'
      );

      // Memory metrics
      this.recordMetric(
        `${service}.memory_usage`,
        'gauge',
        Math.random() * 100,
        { service, instance: 'i-123' },
        'percent'
      );

      // Request metrics
      this.recordMetric(
        `${service}.request_count`,
        'counter',
        Math.floor(Math.random() * 1000),
        { service, method: 'POST' }
      );

      // Latency metrics
      this.recordMetric(
        `${service}.response_time`,
        'histogram',
        Math.random() * 1000,
        { service, endpoint: '/api/contracts' },
        'ms'
      );

      // Error metrics
      this.recordMetric(
        `${service}.error_rate`,
        'gauge',
        Math.random() * 5,
        { service },
        'percent'
      );
    });
  }

  private updateServiceHealth(): void {
    const services = ['contract-api', 'processing-worker', 'vector-db', 'graph-engine'];
    
    services.forEach(serviceName => {
      const health: ServiceHealth = {
        serviceName,
        status: this.calculateServiceStatus(serviceName),
        uptime: 95 + Math.random() * 5, // 95-100%
        errorRate: Math.random() * 2, // 0-2%
        avgLatency: 100 + Math.random() * 200, // 100-300ms
        throughput: 50 + Math.random() * 100, // 50-150 rps
        dependencies: this.getServiceDependencies(serviceName),
        sla: {
          availability: 99.9,
          latency: 200,
          errorRate: 1.0
        },
        healthScore: 0
      };

      health.healthScore = this.calculateHealthScore(health);
      this.serviceHealth.set(serviceName, health);
    });
  }

  private calculateServiceStatus(serviceName: string): ServiceHealth['status'] {
    const metrics = this.getRecentMetrics(serviceName);
    
    const avgErrorRate = this.calculateAverage(metrics.filter(m => m.name.includes('error_rate')));
    const avgLatency = this.calculateAverage(metrics.filter(m => m.name.includes('response_time')));
    
    if (avgErrorRate > 5 || avgLatency > 1000) return 'unhealthy';
    if (avgErrorRate > 2 || avgLatency > 500) return 'degraded';
    return 'healthy';
  }

  private calculateHealthScore(health: ServiceHealth): number {
    let score = 100;
    
    // Penalize based on uptime
    score -= (100 - health.uptime) * 2;
    
    // Penalize based on error rate
    score -= health.errorRate * 10;
    
    // Penalize based on latency
    if (health.avgLatency > health.sla.latency) {
      score -= ((health.avgLatency - health.sla.latency) / health.sla.latency) * 20;
    }
    
    // Penalize based on dependency health
    const unhealthyDeps = health.dependencies.filter(d => d.status === 'unhealthy').length;
    score -= unhealthyDeps * 15;
    
    return Math.max(0, Math.min(100, score));
  }

  private getServiceDependencies(serviceName: string): ServiceDependency[] {
    const dependencyMap = {
      'contract-api': [
        { serviceName: 'postgres', type: 'database' as const, critical: true },
        { serviceName: 'redis', type: 'cache' as const, critical: false }
      ],
      'processing-worker': [
        { serviceName: 'rabbitmq', type: 'queue' as const, critical: true },
        { serviceName: 'vector-db', type: 'database' as const, critical: true }
      ],
      'vector-db': [
        { serviceName: 'elasticsearch', type: 'database' as const, critical: true }
      ],
      'graph-engine': [
        { serviceName: 'neo4j', type: 'database' as const, critical: true }
      ]
    };

    return (dependencyMap[serviceName] || []).map(dep => ({
      ...dep,
      status: Math.random() > 0.1 ? 'healthy' : 'degraded' as const,
      latency: Math.random() * 50,
      errorRate: Math.random() * 1
    }));
  }

  private getRecentMetrics(serviceName: string): Metric[] {
    const recentMetrics: Metric[] = [];
    
    for (const [metricName, metrics] of this.metrics.entries()) {
      if (metricName.includes(serviceName)) {
        recentMetrics.push(...metrics.slice(-10)); // Last 10 data points
      }
    }
    
    return recentMetrics;
  }

  private calculateAverage(metrics: Metric[]): number {
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
  }

  private getTraceIdFromSpan(spanId: string): string {
    const span = this.activeSpans.get(spanId);
    return span ? span.traceId : crypto.randomUUID();
  }

  private updateServiceMetrics(trace: Trace): void {
    // Update service-level metrics based on trace
    this.recordMetric(
      `${trace.serviceName}.request_duration`,
      'histogram',
      trace.duration || 0,
      { service: trace.serviceName, operation: trace.operationName },
      'ms'
    );

    if (trace.status === 'error') {
      this.recordMetric(
        `${trace.serviceName}.error_count`,
        'counter',
        1,
        { service: trace.serviceName, operation: trace.operationName }
      );
    }
  }

  private checkAlertConditions(metric: Metric): void {
    for (const alert of this.alerts.values()) {
      if (alert.condition.metric === metric.name) {
        const shouldTrigger = this.evaluateAlertCondition(alert.condition, metric);
        
        if (shouldTrigger && alert.status === 'resolved') {
          alert.status = 'firing';
          alert.triggeredAt = new Date();
          this.emit('alert:triggered', alert);
          this.sendNotifications(alert);
        } else if (!shouldTrigger && alert.status === 'firing') {
          alert.status = 'resolved';
          alert.resolvedAt = new Date();
          this.emit('alert:resolved', alert);
        }
      }
    }
  }

  private evaluateAlertCondition(condition: AlertCondition, metric: Metric): boolean {
    // Simplified condition evaluation
    switch (condition.operator) {
      case '>': return metric.value > condition.threshold;
      case '<': return metric.value < condition.threshold;
      case '>=': return metric.value >= condition.threshold;
      case '<=': return metric.value <= condition.threshold;
      case '==': return metric.value === condition.threshold;
      case '!=': return metric.value !== condition.threshold;
      default: return false;
    }
  }

  private sendNotifications(alert: Alert): void {
    alert.notifications.forEach(channel => {
      if (channel.enabled) {
        this.emit('notification:send', { alert, channel });
      }
    });
  }

  private async checkSafetyConditions(experiment: ChaosExperiment): Promise<boolean> {
    for (const check of experiment.safetyChecks) {
      if (check.enabled) {
        const passed = await this.evaluateSafetyCheck(check);
        if (!passed) {
          this.emit('chaos:safety_check_failed', { experiment, check });
          return false;
        }
      }
    }
    return true;
  }

  private async evaluateSafetyCheck(check: SafetyCheck): Promise<boolean> {
    // Simplified safety check evaluation
    // In production, this would evaluate complex conditions
    return Math.random() > 0.1; // 90% pass rate
  }

  private async executeChaosExperiment(experiment: ChaosExperiment): Promise<ChaosResult> {
    const startTime = new Date();
    
    // Simulate chaos experiment execution
    await new Promise(resolve => setTimeout(resolve, experiment.schedule.duration * 1000));
    
    const endTime = new Date();
    
    // Simulate results
    const result: ChaosResult = {
      startTime,
      endTime,
      impactedRequests: Math.floor(Math.random() * 1000),
      errorRate: Math.random() * 10,
      latencyIncrease: Math.random() * 200,
      recoveryTime: Math.random() * 60,
      observations: [
        'Service recovered within expected time',
        'Error rate increased temporarily',
        'Circuit breaker activated correctly'
      ],
      recommendations: [
        'Consider increasing timeout values',
        'Add more retry logic',
        'Improve monitoring coverage'
      ]
    };

    return result;
  }

  private async prepareTrainingData(features: string[]): Promise<any[]> {
    // Simulate training data preparation
    const data: any[] = [];
    
    for (let i = 0; i < 1000; i++) {
      const dataPoint: any = {};
      features.forEach(feature => {
        dataPoint[feature] = Math.random() * 100;
      });
      data.push(dataPoint);
    }
    
    return data;
  }

  private async trainModel(algorithm: string, data: any[]): Promise<number> {
    // Simulate model training
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Return mock accuracy
    return 0.85 + Math.random() * 0.1; // 85-95% accuracy
  }

  private async predictValue(model: PredictiveModel, feature: string, timestamp: Date): Promise<Prediction> {
    // Simulate prediction generation
    const baseValue = Math.random() * 100;
    const noise = (Math.random() - 0.5) * 20;
    
    return {
      timestamp,
      metric: feature,
      predictedValue: baseValue + noise,
      confidence: model.accuracy,
      anomalyScore: Math.random(),
      explanation: `Predicted based on ${model.algorithm} model`
    };
  }

  private async analyzeMetricAnomalies(metricName: string, metrics: Metric[]): Promise<any[]> {
    const anomalies: any[] = [];
    
    if (metrics.length < 10) return anomalies;
    
    // Simple statistical anomaly detection
    const values = metrics.map(m => m.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
    
    metrics.forEach(metric => {
      const zScore = Math.abs((metric.value - mean) / stdDev);
      
      if (zScore > 3) { // 3 standard deviations
        anomalies.push({
          metric: metricName,
          timestamp: metric.timestamp,
          value: metric.value,
          anomalyScore: zScore / 3,
          severity: zScore > 4 ? 'high' : zScore > 3.5 ? 'medium' : 'low',
          explanation: `Value ${metric.value} is ${zScore.toFixed(2)} standard deviations from mean ${mean.toFixed(2)}`
        });
      }
    });
    
    return anomalies;
  }

  private generateHealthRecommendations(services: ServiceHealth[]): string[] {
    const recommendations: string[] = [];
    
    services.forEach(service => {
      if (service.healthScore < 80) {
        recommendations.push(`Investigate ${service.serviceName} - health score is ${service.healthScore.toFixed(1)}`);
      }
      
      if (service.errorRate > service.sla.errorRate) {
        recommendations.push(`Reduce error rate for ${service.serviceName} - currently ${service.errorRate.toFixed(2)}%`);
      }
      
      if (service.avgLatency > service.sla.latency) {
        recommendations.push(`Optimize latency for ${service.serviceName} - currently ${service.avgLatency.toFixed(0)}ms`);
      }
    });
    
    return recommendations;
  }

  // Public API methods

  getTraces(traceId?: string, limit = 100): Trace[] {
    if (traceId) {
      return this.traces.get(traceId) || [];
    }
    
    const allTraces: Trace[] = [];
    for (const traces of this.traces.values()) {
      allTraces.push(...traces);
    }
    
    return allTraces
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, limit);
  }

  getMetrics(name?: string, limit = 1000): Metric[] {
    if (name) {
      return (this.metrics.get(name) || []).slice(-limit);
    }
    
    const allMetrics: Metric[] = [];
    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics);
    }
    
    return allMetrics
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getAlerts(status?: Alert['status']): Alert[] {
    const alerts = Array.from(this.alerts.values());
    return status ? alerts.filter(a => a.status === status) : alerts;
  }

  getChaosExperiments(): ChaosExperiment[] {
    return Array.from(this.chaosExperiments.values());
  }

  getPredictiveModels(): PredictiveModel[] {
    return Array.from(this.predictiveModels.values());
  }

  getObservabilityStats(): {
    traces: { total: number; active: number; errorRate: number };
    metrics: { total: number; uniqueNames: number; recentCount: number };
    alerts: { total: number; firing: number; resolved: number };
    experiments: { total: number; running: number; completed: number };
    models: { total: number; accuracy: number };
  } {
    const allTraces = this.getTraces();
    const allMetrics = this.getMetrics();
    const alerts = this.getAlerts();
    const experiments = this.getChaosExperiments();
    const models = this.getPredictiveModels();

    const recentMetrics = allMetrics.filter(m => 
      m.timestamp > new Date(Date.now() - 60 * 60 * 1000) // Last hour
    );

    return {
      traces: {
        total: allTraces.length,
        active: this.activeSpans.size,
        errorRate: allTraces.filter(t => t.status === 'error').length / allTraces.length * 100
      },
      metrics: {
        total: allMetrics.length,
        uniqueNames: this.metrics.size,
        recentCount: recentMetrics.length
      },
      alerts: {
        total: alerts.length,
        firing: alerts.filter(a => a.status === 'firing').length,
        resolved: alerts.filter(a => a.status === 'resolved').length
      },
      experiments: {
        total: experiments.length,
        running: experiments.filter(e => e.status === 'running').length,
        completed: experiments.filter(e => e.status === 'completed').length
      },
      models: {
        total: models.length,
        accuracy: models.reduce((sum, m) => sum + m.accuracy, 0) / models.length
      }
    };
  }
}

// Export singleton instance
export const advancedMonitoring = new AdvancedMonitoring();