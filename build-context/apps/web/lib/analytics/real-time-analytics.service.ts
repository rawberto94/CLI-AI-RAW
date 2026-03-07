/**
 * Real-Time Analytics Service
 * 
 * Provides real-time metrics aggregation, streaming updates,
 * and analytics event processing for the platform.
 * 
 * Features:
 * - Real-time metric calculation and caching
 * - Time-series data aggregation
 * - Anomaly detection
 * - Performance monitoring
 * - Custom metric definitions
 */

import Redis from 'ioredis';

// ============================================================================
// TYPES
// ============================================================================

export interface MetricDefinition {
  id: string;
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
  unit?: string;
  description?: string;
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'p50' | 'p95' | 'p99';
  tags?: string[];
}

export interface MetricDataPoint {
  timestamp: Date;
  value: number;
  tags?: Record<string, string>;
}

export interface TimeSeriesQuery {
  metricId: string;
  startTime: Date;
  endTime: Date;
  interval: '1m' | '5m' | '15m' | '1h' | '6h' | '1d' | '7d';
  tags?: Record<string, string>;
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
}

export interface TimeSeriesResult {
  metricId: string;
  interval: string;
  dataPoints: Array<{
    timestamp: string;
    value: number;
    metadata?: Record<string, unknown>;
  }>;
  summary: {
    min: number;
    max: number;
    avg: number;
    total: number;
    count: number;
  };
}

export interface DashboardMetrics {
  contracts: {
    total: number;
    active: number;
    expiringSoon: number;
    recentlyCreated: number;
    byStatus: Record<string, number>;
    totalValue: number;
  };
  approvals: {
    pending: number;
    approved: number;
    rejected: number;
    avgProcessingTime: number;
    bottlenecks: Array<{ step: string; avgWait: number }>;
  };
  extraction: {
    processed: number;
    successRate: number;
    avgConfidence: number;
    fieldAccuracy: Record<string, number>;
  };
  users: {
    active: number;
    totalSessions: number;
    avgSessionDuration: number;
    topPages: Array<{ path: string; views: number }>;
  };
  system: {
    apiLatency: number;
    errorRate: number;
    throughput: number;
    activeConnections: number;
  };
}

export interface AnomalyAlert {
  id: string;
  metricId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'spike' | 'drop' | 'trend' | 'threshold';
  message: string;
  value: number;
  expectedValue: number;
  deviation: number;
  timestamp: Date;
  resolved: boolean;
}

export interface AnalyticsEvent {
  eventType: string;
  tenantId?: string;
  userId?: string;
  entityType?: string;
  entityId?: string;
  action: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const METRIC_TTL_SECONDS = 86400; // 24 hours
const AGGREGATION_INTERVALS = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '6h': 21600,
  '1d': 86400,
  '7d': 604800,
};

const DEFAULT_METRICS: MetricDefinition[] = [
  { id: 'contracts.created', name: 'Contracts Created', type: 'counter', aggregation: 'sum' },
  { id: 'contracts.value', name: 'Contract Value', type: 'gauge', unit: 'USD', aggregation: 'sum' },
  { id: 'approvals.processing_time', name: 'Approval Processing Time', type: 'timer', unit: 'ms', aggregation: 'avg' },
  { id: 'extraction.success_rate', name: 'Extraction Success Rate', type: 'gauge', unit: 'percent', aggregation: 'avg' },
  { id: 'api.latency', name: 'API Latency', type: 'histogram', unit: 'ms', aggregation: 'p95' },
  { id: 'api.requests', name: 'API Requests', type: 'counter', aggregation: 'sum' },
  { id: 'api.errors', name: 'API Errors', type: 'counter', aggregation: 'sum' },
  { id: 'users.active', name: 'Active Users', type: 'gauge', aggregation: 'max' },
  { id: 'system.memory', name: 'Memory Usage', type: 'gauge', unit: 'MB', aggregation: 'avg' },
  { id: 'system.cpu', name: 'CPU Usage', type: 'gauge', unit: 'percent', aggregation: 'avg' },
];

// ============================================================================
// SERVICE
// ============================================================================

export class RealTimeAnalyticsService {
  private redis: InstanceType<typeof Redis> | null = null;
  private metricsCache: Map<string, MetricDataPoint[]> = new Map();
  private alertsCache: AnomalyAlert[] = [];
  private eventBuffer: AnalyticsEvent[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.initializeRedis();
    this.startEventFlush();
  }

  // --------------------------------------------------------------------------
  // INITIALIZATION
  // --------------------------------------------------------------------------

  private async initializeRedis(): Promise<void> {
    const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`;
    
    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => Math.min(times * 100, 3000),
        lazyConnect: true,
      });

      this.redis.on('error', () => {
        // Handle silently, fall back to memory
      });

      await this.redis.connect();
    } catch {
      this.redis = null;
      console.log('[Analytics] Redis unavailable, using memory cache');
    }
  }

  private startEventFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flushEventBuffer();
    }, 5000); // Flush every 5 seconds
  }

  public destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushEventBuffer();
    this.redis?.disconnect();
  }

  // --------------------------------------------------------------------------
  // METRIC RECORDING
  // --------------------------------------------------------------------------

  /**
   * Record a metric value
   */
  async recordMetric(
    metricId: string,
    value: number,
    tags?: Record<string, string>
  ): Promise<void> {
    const timestamp = new Date();
    const dataPoint: MetricDataPoint = { timestamp, value, tags };

    // Store in Redis if available
    if (this.redis) {
      const key = this.getMetricKey(metricId, tags);
      const bucket = this.getTimeBucket(timestamp, '1m');
      
      try {
        const pipeline = this.redis.pipeline();
        
        // Add to sorted set with timestamp as score
        pipeline.zadd(key, timestamp.getTime(), JSON.stringify(dataPoint));
        
        // Trim old data
        const cutoff = Date.now() - (METRIC_TTL_SECONDS * 1000);
        pipeline.zremrangebyscore(key, 0, cutoff);
        
        // Set expiration
        pipeline.expire(key, METRIC_TTL_SECONDS);
        
        // Update aggregated buckets
        for (const [interval, seconds] of Object.entries(AGGREGATION_INTERVALS)) {
          const aggKey = `${key}:${interval}:${this.getTimeBucket(timestamp, interval as keyof typeof AGGREGATION_INTERVALS)}`;
          pipeline.hincrby(aggKey, 'sum', Math.round(value * 100)); // Store as int for precision
          pipeline.hincrby(aggKey, 'count', 1);
          pipeline.expire(aggKey, seconds * 2);
        }
        
        await pipeline.exec();
      } catch {
        // Fall back to memory
        this.storeInMemory(metricId, dataPoint);
      }
    } else {
      this.storeInMemory(metricId, dataPoint);
    }

    // Check for anomalies
    await this.checkAnomaly(metricId, value, tags);
  }

  /**
   * Increment a counter metric
   */
  async incrementCounter(
    metricId: string,
    amount: number = 1,
    tags?: Record<string, string>
  ): Promise<void> {
    await this.recordMetric(metricId, amount, tags);
  }

  /**
   * Record a timing metric
   */
  async recordTiming(
    metricId: string,
    durationMs: number,
    tags?: Record<string, string>
  ): Promise<void> {
    await this.recordMetric(metricId, durationMs, tags);
  }

  /**
   * Set a gauge value
   */
  async setGauge(
    metricId: string,
    value: number,
    tags?: Record<string, string>
  ): Promise<void> {
    if (this.redis) {
      const key = `gauge:${this.getMetricKey(metricId, tags)}`;
      await this.redis.set(key, value, 'EX', METRIC_TTL_SECONDS);
    }
    await this.recordMetric(metricId, value, tags);
  }

  // --------------------------------------------------------------------------
  // TIME SERIES QUERIES
  // --------------------------------------------------------------------------

  /**
   * Query time series data
   */
  async queryTimeSeries(query: TimeSeriesQuery): Promise<TimeSeriesResult> {
    const { metricId, startTime, endTime, interval, tags, aggregation = 'avg' } = query;
    
    if (this.redis) {
      try {
        return await this.queryTimeSeriesFromRedis(metricId, startTime, endTime, interval, tags, aggregation);
      } catch {
        // Fall back to memory
      }
    }

    return this.queryTimeSeriesFromMemory(metricId, startTime, endTime, interval, aggregation);
  }

  private async queryTimeSeriesFromRedis(
    metricId: string,
    startTime: Date,
    endTime: Date,
    interval: keyof typeof AGGREGATION_INTERVALS,
    tags: Record<string, string> | undefined,
    aggregation: string
  ): Promise<TimeSeriesResult> {
    const key = this.getMetricKey(metricId, tags);
    const intervalSeconds = AGGREGATION_INTERVALS[interval];
    
    const dataPoints: Array<{ timestamp: string; value: number }> = [];
    let min = Infinity;
    let max = -Infinity;
    let total = 0;
    let count = 0;

    // Iterate through time buckets
    let currentTime = new Date(startTime);
    while (currentTime <= endTime) {
      const bucket = this.getTimeBucket(currentTime, interval);
      const aggKey = `${key}:${interval}:${bucket}`;
      
      const data = await this.redis!.hgetall(aggKey);
      
      if (data && data.sum && data.count) {
        const sum = parseInt(data.sum, 10) / 100; // Convert back from int
        const cnt = parseInt(data.count, 10);
        const avg = cnt > 0 ? sum / cnt : 0;
        
        let value: number;
        switch (aggregation) {
          case 'sum':
            value = sum;
            break;
          case 'count':
            value = cnt;
            break;
          case 'min':
          case 'max':
          case 'avg':
          default:
            value = avg;
        }
        
        dataPoints.push({
          timestamp: currentTime.toISOString(),
          value: Math.round(value * 100) / 100,
        });
        
        min = Math.min(min, value);
        max = Math.max(max, value);
        total += value;
        count++;
      }
      
      currentTime = new Date(currentTime.getTime() + (intervalSeconds * 1000));
    }

    return {
      metricId,
      interval,
      dataPoints,
      summary: {
        min: min === Infinity ? 0 : min,
        max: max === -Infinity ? 0 : max,
        avg: count > 0 ? total / count : 0,
        total,
        count,
      },
    };
  }

  private queryTimeSeriesFromMemory(
    metricId: string,
    startTime: Date,
    endTime: Date,
    interval: keyof typeof AGGREGATION_INTERVALS,
    aggregation: string
  ): TimeSeriesResult {
    const key = this.getMetricKey(metricId);
    const points = this.metricsCache.get(key) || [];
    
    const filteredPoints = points.filter(
      p => p.timestamp >= startTime && p.timestamp <= endTime
    );

    const intervalSeconds = AGGREGATION_INTERVALS[interval];
    const buckets = new Map<string, number[]>();

    // Group by time bucket
    for (const point of filteredPoints) {
      const bucket = this.getTimeBucket(point.timestamp, interval);
      if (!buckets.has(bucket)) {
        buckets.set(bucket, []);
      }
      buckets.get(bucket)!.push(point.value);
    }

    const dataPoints: Array<{ timestamp: string; value: number }> = [];
    let min = Infinity;
    let max = -Infinity;
    let total = 0;
    let count = 0;

    // Calculate aggregations
    for (const [bucket, values] of buckets.entries()) {
      let value: number;
      switch (aggregation) {
        case 'sum':
          value = values.reduce((a, b) => a + b, 0);
          break;
        case 'count':
          value = values.length;
          break;
        case 'min':
          value = Math.min(...values);
          break;
        case 'max':
          value = Math.max(...values);
          break;
        case 'avg':
        default:
          value = values.reduce((a, b) => a + b, 0) / values.length;
      }

      dataPoints.push({
        timestamp: new Date(parseInt(bucket, 10) * intervalSeconds * 1000).toISOString(),
        value: Math.round(value * 100) / 100,
      });

      min = Math.min(min, value);
      max = Math.max(max, value);
      total += value;
      count++;
    }

    return {
      metricId,
      interval,
      dataPoints: dataPoints.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ),
      summary: {
        min: min === Infinity ? 0 : min,
        max: max === -Infinity ? 0 : max,
        avg: count > 0 ? total / count : 0,
        total,
        count,
      },
    };
  }

  // --------------------------------------------------------------------------
  // DASHBOARD METRICS
  // --------------------------------------------------------------------------

  /**
   * Get comprehensive dashboard metrics
   */
  async getDashboardMetrics(tenantId?: string): Promise<DashboardMetrics> {
    const cacheKey = `dashboard:metrics:${tenantId || 'global'}`;
    
    // Try cache first
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch {
        // Continue to calculate
      }
    }

    // Calculate metrics
    const metrics = await this.calculateDashboardMetrics(tenantId);

    // Cache for 30 seconds
    if (this.redis) {
      try {
        await this.redis.setex(cacheKey, 30, JSON.stringify(metrics));
      } catch {
        // Ignore cache errors
      }
    }

    return metrics;
  }

  private async calculateDashboardMetrics(_tenantId?: string): Promise<DashboardMetrics> {
    // In production, these would query the database
    // For now, return calculated/mock metrics
    
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 86400000);

    // Get recent metric values
    const apiLatency = await this.getLatestGauge('api.latency');
    const errorCount = await this.getCountSince('api.errors', oneDayAgo);
    const requestCount = await this.getCountSince('api.requests', oneDayAgo);

    return {
      contracts: {
        total: 247,
        active: 189,
        expiringSoon: 23,
        recentlyCreated: 12,
        byStatus: {
          active: 189,
          draft: 28,
          pending_approval: 15,
          expired: 12,
          terminated: 3,
        },
        totalValue: 45600000,
      },
      approvals: {
        pending: 15,
        approved: 142,
        rejected: 8,
        avgProcessingTime: 18.5, // hours
        bottlenecks: [
          { step: 'Legal Review', avgWait: 24.2 },
          { step: 'CFO Approval', avgWait: 16.8 },
          { step: 'Compliance Check', avgWait: 8.4 },
        ],
      },
      extraction: {
        processed: 1847,
        successRate: 94.5,
        avgConfidence: 91.3,
        fieldAccuracy: {
          vendor_name: 98.2,
          contract_value: 95.7,
          effective_date: 97.1,
          expiration_date: 96.8,
          payment_terms: 89.4,
        },
      },
      users: {
        active: 42,
        totalSessions: 156,
        avgSessionDuration: 28.5, // minutes
        topPages: [
          { path: '/contracts', views: 234 },
          { path: '/dashboard', views: 189 },
          { path: '/approvals', views: 145 },
          { path: '/analytics', views: 98 },
          { path: '/reports', views: 67 },
        ],
      },
      system: {
        apiLatency: apiLatency || 45,
        errorRate: requestCount > 0 ? (errorCount / requestCount) * 100 : 0.5,
        throughput: requestCount || 1250,
        activeConnections: 42,
      },
    };
  }

  // --------------------------------------------------------------------------
  // ANOMALY DETECTION
  // --------------------------------------------------------------------------

  private async checkAnomaly(
    metricId: string,
    value: number,
    tags?: Record<string, string>
  ): Promise<void> {
    // Get historical data for comparison
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 3600000); // Last hour
    
    const history = await this.queryTimeSeries({
      metricId,
      startTime,
      endTime,
      interval: '5m',
      tags,
      aggregation: 'avg',
    });

    if (history.dataPoints.length < 3) {
      return; // Not enough data
    }

    const { avg } = history.summary;
    const stdDev = this.calculateStdDev(history.dataPoints.map(p => p.value));
    const deviation = Math.abs(value - avg) / (stdDev || 1);

    // Alert if value deviates more than 3 standard deviations
    if (deviation > 3 && stdDev > 0) {
      const alert: AnomalyAlert = {
        id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        metricId,
        severity: deviation > 5 ? 'critical' : deviation > 4 ? 'high' : 'medium',
        type: value > avg ? 'spike' : 'drop',
        message: `${metricId} ${value > avg ? 'spiked' : 'dropped'} to ${value} (expected ~${avg.toFixed(2)})`,
        value,
        expectedValue: avg,
        deviation,
        timestamp: new Date(),
        resolved: false,
      };

      this.alertsCache.push(alert);

      // Keep only recent alerts
      if (this.alertsCache.length > 100) {
        this.alertsCache = this.alertsCache.slice(-100);
      }

      // Store in Redis for persistence
      if (this.redis) {
        try {
          await this.redis.lpush('analytics:alerts', JSON.stringify(alert));
          await this.redis.ltrim('analytics:alerts', 0, 99);
        } catch {
          // Ignore
        }
      }
    }
  }

  /**
   * Get recent anomaly alerts
   */
  async getAnomalyAlerts(limit: number = 20): Promise<AnomalyAlert[]> {
    if (this.redis) {
      try {
        const alerts = await this.redis.lrange('analytics:alerts', 0, limit - 1);
        return alerts.map(a => JSON.parse(a));
      } catch {
        // Fall back to memory
      }
    }
    
    return this.alertsCache.slice(-limit).reverse();
  }

  // --------------------------------------------------------------------------
  // EVENT TRACKING
  // --------------------------------------------------------------------------

  /**
   * Track an analytics event
   */
  trackEvent(event: Omit<AnalyticsEvent, 'timestamp'>): void {
    const fullEvent: AnalyticsEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.eventBuffer.push(fullEvent);

    // Flush if buffer is large
    if (this.eventBuffer.length >= 100) {
      this.flushEventBuffer();
    }
  }

  private async flushEventBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    if (this.redis) {
      try {
        const pipeline = this.redis.pipeline();
        
        for (const event of events) {
          const key = `events:${event.eventType}:${this.getDateKey(event.timestamp)}`;
          pipeline.lpush(key, JSON.stringify(event));
          pipeline.expire(key, METRIC_TTL_SECONDS);
        }
        
        await pipeline.exec();
      } catch {
        // Events lost - in production, could write to disk as fallback
      }
    }

    // Update metrics based on events
    for (const event of events) {
      await this.processEventForMetrics(event);
    }
  }

  private async processEventForMetrics(event: AnalyticsEvent): Promise<void> {
    const tags = { tenant: event.tenantId || 'global', entity: event.entityType || 'unknown' };

    switch (event.eventType) {
      case 'contract.created':
        await this.incrementCounter('contracts.created', 1, tags);
        break;
      case 'contract.viewed':
        await this.incrementCounter('contracts.views', 1, tags);
        break;
      case 'approval.submitted':
        await this.incrementCounter('approvals.submitted', 1, tags);
        break;
      case 'approval.completed':
        await this.incrementCounter('approvals.completed', 1, tags);
        if (event.metadata?.processingTimeMs) {
          await this.recordTiming('approvals.processing_time', event.metadata.processingTimeMs as number, tags);
        }
        break;
      case 'extraction.completed':
        await this.incrementCounter('extraction.completed', 1, tags);
        if (event.metadata?.confidence) {
          await this.setGauge('extraction.avg_confidence', event.metadata.confidence as number, tags);
        }
        break;
      case 'api.request':
        await this.incrementCounter('api.requests', 1, tags);
        if (event.metadata?.latencyMs) {
          await this.recordTiming('api.latency', event.metadata.latencyMs as number, tags);
        }
        break;
      case 'api.error':
        await this.incrementCounter('api.errors', 1, tags);
        break;
    }
  }

  // --------------------------------------------------------------------------
  // REAL-TIME STREAMING
  // --------------------------------------------------------------------------

  /**
   * Get a Server-Sent Events stream for metrics
   */
  createMetricStream(metricIds: string[]): ReadableStream {
    const encoder = new TextEncoder();
    
    return new ReadableStream({
      start: async (controller) => {
        const sendUpdate = async () => {
          const updates: Record<string, number> = {};
          
          for (const metricId of metricIds) {
            const value = await this.getLatestGauge(metricId);
            if (value !== null) {
              updates[metricId] = value;
            }
          }

          const data = `data: ${JSON.stringify({ type: 'metrics', data: updates, timestamp: new Date().toISOString() })}\n\n`;
          controller.enqueue(encoder.encode(data));
        };

        // Send initial data
        await sendUpdate();

        // Subscribe to Redis for real-time updates if available
        if (this.redis) {
          const subscriber = this.redis.duplicate();
          
          try {
            await subscriber.subscribe('analytics:updates');
            
            subscriber.on('message', (_channel: string, message: string) => {
              try {
                const update = JSON.parse(message);
                if (metricIds.includes(update.metricId)) {
                  const data = `data: ${JSON.stringify({ type: 'update', data: update })}\n\n`;
                  controller.enqueue(encoder.encode(data));
                }
              } catch {
                // Ignore parse errors
              }
            });
          } catch {
            // Fall back to polling
            const interval = setInterval(sendUpdate, 5000);
            return () => clearInterval(interval);
          }
        }

        // Heartbeat every 30 seconds
        const heartbeat = setInterval(() => {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        }, 30000);

        return () => {
          clearInterval(heartbeat);
        };
      },
    });
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS
  // --------------------------------------------------------------------------

  private getMetricKey(metricId: string, tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) {
      return `metric:${metricId}`;
    }
    const tagStr = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    return `metric:${metricId}:{${tagStr}}`;
  }

  private getTimeBucket(timestamp: Date, interval: keyof typeof AGGREGATION_INTERVALS): string {
    const seconds = AGGREGATION_INTERVALS[interval];
    return Math.floor(timestamp.getTime() / (seconds * 1000)).toString();
  }

  private getDateKey(date: Date): string {
    return date.toISOString().split('T')[0]!;
  }

  private storeInMemory(metricId: string, dataPoint: MetricDataPoint): void {
    const key = this.getMetricKey(metricId, dataPoint.tags);
    
    if (!this.metricsCache.has(key)) {
      this.metricsCache.set(key, []);
    }
    
    const points = this.metricsCache.get(key)!;
    points.push(dataPoint);
    
    // Keep only last 1000 points per metric
    if (points.length > 1000) {
      points.shift();
    }
  }

  private async getLatestGauge(metricId: string): Promise<number | null> {
    if (this.redis) {
      try {
        const key = `gauge:${this.getMetricKey(metricId)}`;
        const value = await this.redis.get(key);
        return value ? parseFloat(value) : null;
      } catch {
        // Fall through
      }
    }
    
    const points = this.metricsCache.get(this.getMetricKey(metricId)) || [];
    return points.length > 0 ? points[points.length - 1]!.value : null;
  }

  private async getCountSince(metricId: string, since: Date): Promise<number> {
    if (this.redis) {
      try {
        const key = this.getMetricKey(metricId);
        const values = await this.redis.zrangebyscore(key, since.getTime(), Date.now());
        return values.reduce((sum, v) => {
          try {
            return sum + JSON.parse(v).value;
          } catch {
            return sum;
          }
        }, 0);
      } catch {
        // Fall through
      }
    }
    
    const points = this.metricsCache.get(this.getMetricKey(metricId)) || [];
    return points
      .filter(p => p.timestamp >= since)
      .reduce((sum, p) => sum + p.value, 0);
  }

  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  /**
   * Get available metric definitions
   */
  getMetricDefinitions(): MetricDefinition[] {
    return DEFAULT_METRICS;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let analyticsService: RealTimeAnalyticsService | null = null;

export function getAnalyticsService(): RealTimeAnalyticsService {
  if (!analyticsService) {
    analyticsService = new RealTimeAnalyticsService();
  }
  return analyticsService;
}

export default RealTimeAnalyticsService;
