import { dbAdaptor } from "../dal/database.adaptor";
import { cacheAdaptor } from "../dal/cache.adaptor";
import { eventBus, Events } from "../events/event-bus";
import pino from "pino";
import type { ServiceResponse } from "./contract.service";

const logger = pino({ name: "analytics-service" });

export interface RealTimeMetrics {
  timestamp: Date;
  tenantId: string;
  contracts: {
    total: number;
    totalValue: number;
    byStatus: Record<string, number>;
    bySupplier: Record<string, number>;
    byCategory: Record<string, number>;
    byCurrency: Record<string, number>;
  };
  processing: {
    activeJobs: number;
    completedToday: number;
    failedToday: number;
    averageProcessingTime: number;
    successRate: number;
  };
  intelligence: {
    patternsDetected: number;
    insightsGenerated: number;
    highPriorityInsights: number;
    lastAnalysisTime: Date;
  };
  trends: {
    contractVelocity: number; // contracts per day
    valueVelocity: number; // value per day
    processingEfficiency: number; // percentage
    errorRate: number; // percentage
  };
}

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

export interface AnalyticsQuery {
  tenantId: string;
  metric: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  granularity: "hour" | "day" | "week" | "month";
  filters?: Record<string, any>;
  aggregation?: "sum" | "avg" | "count" | "min" | "max";
}

export interface AnalyticsDashboard {
  overview: {
    kpis: Array<{
      name: string;
      value: number;
      change: number;
      trend: "up" | "down" | "stable";
      format: "number" | "currency" | "percentage";
    }>;
    alerts: Array<{
      type: "warning" | "error" | "info";
      message: string;
      priority: "high" | "medium" | "low";
      timestamp: Date;
    }>;
  };
  charts: Array<{
    id: string;
    title: string;
    type: "line" | "bar" | "pie" | "area";
    data: TimeSeriesData[];
    config: Record<string, any>;
  }>;
  tables: Array<{
    id: string;
    title: string;
    headers: string[];
    rows: any[][];
    pagination?: {
      page: number;
      limit: number;
      total: number;
    };
  }>;
}

export class AnalyticsService {
  private static instance: AnalyticsService;
  private metricsCache = new Map<string, RealTimeMetrics>();
  private timeSeriesCache = new Map<string, TimeSeriesData[]>();

  private constructor() {
    this.setupEventHandlers();
    this.startMetricsCollection();
  }

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  private setupEventHandlers(): void {
    eventBus.subscribe(Events.CONTRACT_CREATED, this.handleContractEvent.bind(this));
    eventBus.subscribe(Events.CONTRACT_UPDATED, this.handleContractEvent.bind(this));
    eventBus.subscribe(Events.PROCESSING_COMPLETED, this.handleProcessingEvent.bind(this));
    eventBus.subscribe(Events.PROCESSING_FAILED, this.handleProcessingEvent.bind(this));
    eventBus.subscribe(Events.PATTERN_DETECTED, this.handleIntelligenceEvent.bind(this));
    eventBus.subscribe(Events.INSIGHT_GENERATED, this.handleIntelligenceEvent.bind(this));
  }

  private startMetricsCollection(): void {
    // Update metrics every 30 seconds
    setInterval(() => {
      this.collectRealTimeMetrics().catch(error => 
        logger.error({ error }, "Failed to collect real-time metrics")
      );
    }, 30000);
  }

  /**
   * Get real-time metrics for a tenant
   */
  async getRealTimeMetrics(tenantId: string): Promise<ServiceResponse<RealTimeMetrics>> {
    try {
      const cacheKey = `realtime-metrics:${tenantId}`;
      
      // Try cache first
      let metrics = await cacheAdaptor.get<RealTimeMetrics>(cacheKey);
      
      if (!metrics) {
        // Calculate fresh metrics
        metrics = await this.calculateRealTimeMetrics(tenantId);
        
        // Cache for 1 minute
        await cacheAdaptor.set(cacheKey, metrics, 60);
      }

      return {
        success: true,
        data: metrics,
      };
    } catch (error) {
      logger.error({ error, tenantId }, "Failed to get real-time metrics");
      return {
        success: false,
        error: {
          code: "METRICS_FAILED",
          message: "Failed to get real-time metrics",
          details: error,
        },
      };
    }
  }

  /**
   * Query time series data with flexible parameters
   */
  async queryTimeSeries(query: AnalyticsQuery): Promise<ServiceResponse<TimeSeriesData[]>> {
    try {
      const cacheKey = `timeseries:${JSON.stringify(query)}`;
      
      // Try cache first
      let data = await cacheAdaptor.get<TimeSeriesData[]>(cacheKey);
      
      if (!data) {
        data = await this.calculateTimeSeries(query);
        
        // Cache for 5 minutes
        await cacheAdaptor.set(cacheKey, data, 300);
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      logger.error({ error, query }, "Failed to query time series");
      return {
        success: false,
        error: {
          code: "TIMESERIES_QUERY_FAILED",
          message: "Failed to query time series data",
          details: error,
        },
      };
    }
  }

  /**
   * Get comprehensive analytics dashboard
   */
  async getDashboard(tenantId: string, timeRange?: { start: Date; end: Date }): Promise<ServiceResponse<AnalyticsDashboard>> {
    try {
      const defaultTimeRange = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        end: new Date(),
      };
      
      const range = timeRange || defaultTimeRange;

      const [metricsResult, kpis, charts, tables] = await Promise.all([
        this.getRealTimeMetrics(tenantId),
        this.calculateKPIs(tenantId, range),
        this.generateCharts(tenantId, range),
        this.generateTables(tenantId, range),
      ]);

      if (!metricsResult.success) {
        throw new Error("Failed to get metrics for dashboard");
      }

      const dashboard: AnalyticsDashboard = {
        overview: {
          kpis,
          alerts: await this.generateAlerts(tenantId, metricsResult.data),
        },
        charts,
        tables,
      };

      return {
        success: true,
        data: dashboard,
      };
    } catch (error) {
      logger.error({ error, tenantId }, "Failed to generate dashboard");
      return {
        success: false,
        error: {
          code: "DASHBOARD_FAILED",
          message: "Failed to generate analytics dashboard",
          details: error,
        },
      };
    }
  }

  /**
   * Track custom events for analytics
   */
  async trackEvent(tenantId: string, event: string, properties: Record<string, any>): Promise<ServiceResponse<void>> {
    try {
      const eventData = {
        tenantId,
        event,
        properties,
        timestamp: new Date(),
      };

      // Store in time series cache
      const cacheKey = `events:${tenantId}:${event}`;
      const existing = this.timeSeriesCache.get(cacheKey) || [];
      existing.push({
        timestamp: eventData.timestamp,
        value: 1,
        metadata: properties,
      });

      // Keep only last 1000 events
      if (existing.length > 1000) {
        existing.shift();
      }

      this.timeSeriesCache.set(cacheKey, existing);

      // Emit analytics event
      await eventBus.publish("analytics.event.tracked", eventData);

      return { success: true };
    } catch (error) {
      logger.error({ error, tenantId, event }, "Failed to track event");
      return {
        success: false,
        error: {
          code: "EVENT_TRACKING_FAILED",
          message: "Failed to track analytics event",
          details: error,
        },
      };
    }
  }

  // =========================================================================
  // EVENT HANDLERS
  // =========================================================================

  private async handleContractEvent(payload: any): Promise<void> {
    const { tenantId, contractId, contract } = payload.data;
    
    await this.trackEvent(tenantId, "contract.activity", {
      contractId,
      action: payload.eventType,
      value: contract?.totalValue || 0,
      supplier: contract?.supplierName,
      category: contract?.category,
    });

    // Invalidate metrics cache
    await cacheAdaptor.delete(`realtime-metrics:${tenantId}`);
  }

  private async handleProcessingEvent(payload: any): Promise<void> {
    const { tenantId, contractId } = payload.data;
    
    await this.trackEvent(tenantId, "processing.activity", {
      contractId,
      action: payload.eventType,
      duration: payload.data.duration,
      success: payload.eventType.includes("completed"),
    });
  }

  private async handleIntelligenceEvent(payload: any): Promise<void> {
    const { tenantId } = payload.data;
    
    await this.trackEvent(tenantId, "intelligence.activity", {
      action: payload.eventType,
      type: payload.data.pattern?.type || payload.data.insight?.type,
      confidence: payload.data.pattern?.confidence || payload.data.insight?.confidence,
    });
  }

  // =========================================================================
  // METRICS CALCULATION
  // =========================================================================

  private async calculateRealTimeMetrics(tenantId: string): Promise<RealTimeMetrics> {
    const [contracts, processingJobs] = await Promise.all([
      dbAdaptor.prisma.contract.findMany({
        where: { tenantId, status: { not: "DELETED" } },
      }),
      dbAdaptor.prisma.processingJob.findMany({
        where: { 
          contract: { tenantId },
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        },
      }),
    ]);

    // Contract metrics
    const totalValue = contracts.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0);
    const byStatus = contracts.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const bySupplier = contracts.reduce((acc, c) => {
      if (c.supplierName) {
        acc[c.supplierName] = (acc[c.supplierName] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const byCategory = contracts.reduce((acc, c) => {
      if (c.category) {
        acc[c.category] = (acc[c.category] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const byCurrency = contracts.reduce((acc, c) => {
      const currency = c.currency || "USD";
      acc[currency] = (acc[currency] || 0) + (Number(c.totalValue) || 0);
      return acc;
    }, {} as Record<string, number>);

    // Processing metrics
    const completedJobs = processingJobs.filter(j => j.status === "COMPLETED");
    const failedJobs = processingJobs.filter(j => j.status === "FAILED");
    const activeJobs = processingJobs.filter(j => j.status === "RUNNING").length;

    const processingTimes = completedJobs
      .filter(j => j.startedAt && j.completedAt)
      .map(j => new Date(j.completedAt!).getTime() - new Date(j.startedAt!).getTime());

    const averageProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0;

    const successRate = processingJobs.length > 0
      ? completedJobs.length / processingJobs.length
      : 0;

    // Intelligence metrics (from cache)
    const patterns = await cacheAdaptor.get(`intelligence-patterns:${tenantId}`) || [];
    const insights = await cacheAdaptor.get(`intelligence-insights:${tenantId}`) || [];
    const highPriorityInsights = Array.isArray(insights) 
      ? insights.filter((i: any) => i.priority <= 2).length 
      : 0;

    // Trend calculations
    const last24Hours = contracts.filter(c => 
      new Date(c.createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );
    const contractVelocity = last24Hours.length;
    const valueVelocity = last24Hours.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0);

    return {
      timestamp: new Date(),
      tenantId,
      contracts: {
        total: contracts.length,
        totalValue,
        byStatus,
        bySupplier,
        byCategory,
        byCurrency,
      },
      processing: {
        activeJobs,
        completedToday: completedJobs.length,
        failedToday: failedJobs.length,
        averageProcessingTime: Math.round(averageProcessingTime / 1000), // Convert to seconds
        successRate: Math.round(successRate * 100) / 100,
      },
      intelligence: {
        patternsDetected: Array.isArray(patterns) ? patterns.length : 0,
        insightsGenerated: Array.isArray(insights) ? insights.length : 0,
        highPriorityInsights,
        lastAnalysisTime: new Date(), // Would track actual last analysis time
      },
      trends: {
        contractVelocity,
        valueVelocity,
        processingEfficiency: Math.round(successRate * 100),
        errorRate: Math.round((1 - successRate) * 100),
      },
    };
  }

  private async calculateTimeSeries(query: AnalyticsQuery): Promise<TimeSeriesData[]> {
    const { tenantId, metric, timeRange, granularity, aggregation = "count" } = query;

    // Generate time buckets based on granularity
    const buckets = this.generateTimeBuckets(timeRange.start, timeRange.end, granularity);
    
    // Get contracts in time range
    const contracts = await dbAdaptor.prisma.contract.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: timeRange.start,
          lte: timeRange.end,
        },
        status: { not: "DELETED" },
      },
    });

    // Aggregate data by time buckets
    const data: TimeSeriesData[] = buckets.map(bucket => {
      const bucketContracts = contracts.filter(c => {
        const contractTime = new Date(c.createdAt);
        return contractTime >= bucket.start && contractTime < bucket.end;
      });

      let value = 0;
      switch (metric) {
        case "contract_count":
          value = bucketContracts.length;
          break;
        case "contract_value":
          value = bucketContracts.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0);
          break;
        case "average_value":
          value = bucketContracts.length > 0
            ? bucketContracts.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0) / bucketContracts.length
            : 0;
          break;
        default:
          value = bucketContracts.length;
      }

      return {
        timestamp: bucket.start,
        value,
        metadata: {
          contractCount: bucketContracts.length,
          bucketEnd: bucket.end,
        },
      };
    });

    return data;
  }

  private generateTimeBuckets(start: Date, end: Date, granularity: string) {
    const buckets = [];
    let current = new Date(start);
    
    while (current < end) {
      const bucketStart = new Date(current);
      let bucketEnd: Date;

      switch (granularity) {
        case "hour":
          bucketEnd = new Date(current.getTime() + 60 * 60 * 1000);
          break;
        case "day":
          bucketEnd = new Date(current.getTime() + 24 * 60 * 60 * 1000);
          break;
        case "week":
          bucketEnd = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case "month":
          bucketEnd = new Date(current.getFullYear(), current.getMonth() + 1, 1);
          break;
        default:
          bucketEnd = new Date(current.getTime() + 24 * 60 * 60 * 1000);
      }

      buckets.push({ start: bucketStart, end: bucketEnd });
      current = bucketEnd;
    }

    return buckets;
  }

  // =========================================================================
  // DASHBOARD COMPONENTS
  // =========================================================================

  private async calculateKPIs(tenantId: string, timeRange: { start: Date; end: Date }) {
    const metricsResult = await this.getRealTimeMetrics(tenantId);
    if (!metricsResult.success) {
      return [];
    }

    const metrics = metricsResult.data;

    return [
      {
        name: "Total Contracts",
        value: metrics.contracts.total,
        change: metrics.trends.contractVelocity,
        trend: metrics.trends.contractVelocity > 0 ? "up" : "stable",
        format: "number",
      },
      {
        name: "Portfolio Value",
        value: metrics.contracts.totalValue,
        change: metrics.trends.valueVelocity,
        trend: metrics.trends.valueVelocity > 0 ? "up" : "stable",
        format: "currency",
      },
      {
        name: "Processing Success Rate",
        value: metrics.processing.successRate * 100,
        change: 0, // Would calculate from historical data
        trend: "stable",
        format: "percentage",
      },
      {
        name: "High Priority Insights",
        value: metrics.intelligence.highPriorityInsights,
        change: 0, // Would calculate from historical data
        trend: "stable",
        format: "number",
      },
    ];
  }

  private async generateCharts(tenantId: string, timeRange: { start: Date; end: Date }) {
    const [contractTrend, valueTrend, processingTrend] = await Promise.all([
      this.queryTimeSeries({
        tenantId,
        metric: "contract_count",
        timeRange,
        granularity: "day",
      }),
      this.queryTimeSeries({
        tenantId,
        metric: "contract_value",
        timeRange,
        granularity: "day",
      }),
      this.queryTimeSeries({
        tenantId,
        metric: "processing_success",
        timeRange,
        granularity: "day",
      }),
    ]);

    return [
      {
        id: "contract-trend",
        title: "Contract Volume Trend",
        type: "line" as const,
        data: contractTrend.success ? contractTrend.data : [],
        config: {
          xAxis: "timestamp",
          yAxis: "value",
          color: "#3b82f6",
        },
      },
      {
        id: "value-trend",
        title: "Portfolio Value Trend",
        type: "area" as const,
        data: valueTrend.success ? valueTrend.data : [],
        config: {
          xAxis: "timestamp",
          yAxis: "value",
          color: "#10b981",
          format: "currency",
        },
      },
      {
        id: "processing-trend",
        title: "Processing Success Rate",
        type: "line" as const,
        data: processingTrend.success ? processingTrend.data : [],
        config: {
          xAxis: "timestamp",
          yAxis: "value",
          color: "#f59e0b",
          format: "percentage",
        },
      },
    ];
  }

  private async generateTables(tenantId: string, timeRange: { start: Date; end: Date }) {
    const metricsResult = await this.getRealTimeMetrics(tenantId);
    if (!metricsResult.success) {
      return [];
    }

    const metrics = metricsResult.data;

    // Top suppliers by contract count
    const topSuppliers = Object.entries(metrics.contracts.bySupplier)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([supplier, count]) => [supplier, count]);

    return [
      {
        id: "top-suppliers",
        title: "Top Suppliers by Contract Count",
        headers: ["Supplier", "Contract Count"],
        rows: topSuppliers,
        pagination: {
          page: 1,
          limit: 10,
          total: Object.keys(metrics.contracts.bySupplier).length,
        },
      },
    ];
  }

  private async generateAlerts(tenantId: string, metrics: RealTimeMetrics) {
    const alerts = [];

    // High error rate alert
    if (metrics.trends.errorRate > 10) {
      alerts.push({
        type: "warning" as const,
        message: `Processing error rate is ${metrics.trends.errorRate}% (above 10% threshold)`,
        priority: "high" as const,
        timestamp: new Date(),
      });
    }

    // Low processing efficiency alert
    if (metrics.trends.processingEfficiency < 80) {
      alerts.push({
        type: "warning" as const,
        message: `Processing efficiency is ${metrics.trends.processingEfficiency}% (below 80% threshold)`,
        priority: "medium" as const,
        timestamp: new Date(),
      });
    }

    // High priority insights alert
    if (metrics.intelligence.highPriorityInsights > 5) {
      alerts.push({
        type: "info" as const,
        message: `${metrics.intelligence.highPriorityInsights} high priority insights require attention`,
        priority: "medium" as const,
        timestamp: new Date(),
      });
    }

    return alerts;
  }

  private async collectRealTimeMetrics(): Promise<void> {
    try {
      // Get all active tenants
      const tenants = await dbAdaptor.prisma.tenant.findMany({
        where: { status: "ACTIVE" },
        select: { id: true },
      });

      // Update metrics for each tenant
      for (const tenant of tenants) {
        const metrics = await this.calculateRealTimeMetrics(tenant.id);
        this.metricsCache.set(tenant.id, metrics);
        
        // Cache in Redis with short TTL
        await cacheAdaptor.set(`realtime-metrics:${tenant.id}`, metrics, 60);
      }

      logger.debug({ tenantCount: tenants.length }, "Real-time metrics collected");
    } catch (error) {
      logger.error({ error }, "Failed to collect real-time metrics");
    }
  }
}

export const analyticsService = AnalyticsService.getInstance();