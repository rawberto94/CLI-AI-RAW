/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { FastifyRequest, FastifyReply } from 'fastify';
import { getCacheMetrics } from './cache-enhanced';

interface RequestMetrics {
  timestamp: number;
  method: string;
  url: string;
  statusCode: number;
  responseTime: number;
  userAgent?: string;
  tenantId?: string;
  requestId?: string;
  error?: string;
}

interface SystemMetrics {
  requests: {
    total: number;
    success: number;
    errors: number;
    averageResponseTime: number;
    requestsPerMinute: number;
  };
  uploads: {
    total: number;
    successful: number;
    failed: number;
    averageFileSize: number;
  };
  analysis: {
    totalPipelines: number;
    activePipelines: number;
    completedPipelines: number;
    failedPipelines: number;
    averageProcessingTime: number;
  };
  errors: {
    byStatusCode: Record<number, number>;
    byEndpoint: Record<string, number>;
    recentErrors: Array<{
      timestamp: number;
      endpoint: string;
      error: string;
      requestId?: string;
    }>;
  };
  performance: {
    memoryUsage: NodeJS.MemoryUsage;
    uptime: number;
    cpuUsage?: NodeJS.CpuUsage;
  };
}

class MonitoringService {
  private requests: RequestMetrics[] = [];
  private maxRequestHistory = 10000; // Keep last 10k requests
  private systemMetrics: SystemMetrics = {
    requests: {
      total: 0,
      success: 0,
      errors: 0,
      averageResponseTime: 0,
      requestsPerMinute: 0
    },
    uploads: {
      total: 0,
      successful: 0,
      failed: 0,
      averageFileSize: 0
    },
    analysis: {
      totalPipelines: 0,
      activePipelines: 0,
      completedPipelines: 0,
      failedPipelines: 0,
      averageProcessingTime: 0
    },
    errors: {
      byStatusCode: {},
      byEndpoint: {},
      recentErrors: []
    },
    performance: {
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    }
  };

  private startTime = Date.now();
  private analysisStartTimes = new Map<string, number>();
  private requestStartTimes = new Map<string, number>();

  constructor() {
    // Update performance metrics every 30 seconds
    setInterval(() => {
      this.updatePerformanceMetrics();
    }, 30000);

    // Calculate requests per minute every minute
    setInterval(() => {
      this.calculateRequestsPerMinute();
    }, 60000);

    // Clean old request history every 5 minutes
    setInterval(() => {
      this.cleanOldRequests();
    }, 300000);
  }

  // Request monitoring middleware
  onRequest = async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = (request as any).id || `req-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const startTime = Date.now();
    
    this.requestStartTimes.set(requestId, startTime);
    (request as any).startTime = startTime;
    (request as any).requestId = requestId;
  };

  onResponse = async (request: FastifyRequest, reply: FastifyReply) => {
    const endTime = Date.now();
    const requestId = (request as any).requestId;
    const startTime = this.requestStartTimes.get(requestId) || (request as any).startTime || endTime;
    const responseTime = endTime - startTime;

    const metrics: RequestMetrics = {
      timestamp: endTime,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime,
      userAgent: request.headers['user-agent'],
      tenantId: (request as any).tenantId,
      requestId
    };

    this.addRequestMetrics(metrics);
    this.requestStartTimes.delete(requestId);
  };

  onError = async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    const requestId = (request as any).requestId;
    const statusCode = (error as any).statusCode || 500;

    // Update error metrics
    this.systemMetrics.errors.byStatusCode[statusCode] = 
      (this.systemMetrics.errors.byStatusCode[statusCode] || 0) + 1;

    const endpoint = `${request.method} ${request.url}`;
    this.systemMetrics.errors.byEndpoint[endpoint] = 
      (this.systemMetrics.errors.byEndpoint[endpoint] || 0) + 1;

    // Add to recent errors (keep last 100)
    this.systemMetrics.errors.recentErrors.unshift({
      timestamp: Date.now(),
      endpoint,
      error: error.message,
      requestId
    });

    if (this.systemMetrics.errors.recentErrors.length > 100) {
      this.systemMetrics.errors.recentErrors = this.systemMetrics.errors.recentErrors.slice(0, 100);
    }
  };

  private addRequestMetrics(metrics: RequestMetrics) {
    this.requests.unshift(metrics);
    
    // Keep only recent requests
    if (this.requests.length > this.maxRequestHistory) {
      this.requests = this.requests.slice(0, this.maxRequestHistory);
    }

    // Update aggregate metrics
    this.systemMetrics.requests.total++;
    
    if (metrics.statusCode >= 200 && metrics.statusCode < 400) {
      this.systemMetrics.requests.success++;
    } else {
      this.systemMetrics.requests.errors++;
    }

    // Update average response time
    const totalTime = this.systemMetrics.requests.averageResponseTime * (this.systemMetrics.requests.total - 1) + metrics.responseTime;
    this.systemMetrics.requests.averageResponseTime = totalTime / this.systemMetrics.requests.total;
  }

  private updatePerformanceMetrics() {
    this.systemMetrics.performance.memoryUsage = process.memoryUsage();
    this.systemMetrics.performance.uptime = process.uptime();
    
    try {
      this.systemMetrics.performance.cpuUsage = process.cpuUsage();
    } catch {
      // CPU usage not available in all environments
    }
  }

  private calculateRequestsPerMinute() {
    const oneMinuteAgo = Date.now() - 60000;
    const recentRequests = this.requests.filter(r => r.timestamp > oneMinuteAgo);
    this.systemMetrics.requests.requestsPerMinute = recentRequests.length;
  }

  private cleanOldRequests() {
    const oneHourAgo = Date.now() - 3600000; // 1 hour
    this.requests = this.requests.filter(r => r.timestamp > oneHourAgo);
  }

  // Upload tracking
  trackUpload(success: boolean, fileSize?: number) {
    this.systemMetrics.uploads.total++;
    
    if (success) {
      this.systemMetrics.uploads.successful++;
    } else {
      this.systemMetrics.uploads.failed++;
    }

    if (fileSize) {
      const totalSize = this.systemMetrics.uploads.averageFileSize * (this.systemMetrics.uploads.total - 1) + fileSize;
      this.systemMetrics.uploads.averageFileSize = totalSize / this.systemMetrics.uploads.total;
    }
  }

  // Analysis pipeline tracking
  startAnalysis(pipelineId: string) {
    this.analysisStartTimes.set(pipelineId, Date.now());
    this.systemMetrics.analysis.totalPipelines++;
    this.systemMetrics.analysis.activePipelines++;
  }

  completeAnalysis(pipelineId: string, success: boolean) {
    const startTime = this.analysisStartTimes.get(pipelineId);
    if (startTime) {
      const processingTime = Date.now() - startTime;
      const totalTime = this.systemMetrics.analysis.averageProcessingTime * this.systemMetrics.analysis.completedPipelines + processingTime;
      this.systemMetrics.analysis.averageProcessingTime = totalTime / (this.systemMetrics.analysis.completedPipelines + 1);
      this.analysisStartTimes.delete(pipelineId);
    }

    this.systemMetrics.analysis.activePipelines = Math.max(0, this.systemMetrics.analysis.activePipelines - 1);
    
    if (success) {
      this.systemMetrics.analysis.completedPipelines++;
    } else {
      this.systemMetrics.analysis.failedPipelines++;
    }
  }

  // Get comprehensive metrics
  getMetrics() {
    return {
      ...this.systemMetrics,
      cache: getCacheMetrics(),
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime
    };
  }

  // Get recent requests
  getRecentRequests(limit = 100) {
    return this.requests.slice(0, limit);
  }

  // Get requests by endpoint
  getRequestsByEndpoint(timeRange = 3600000) { // 1 hour default
    const cutoff = Date.now() - timeRange;
    const recentRequests = this.requests.filter(r => r.timestamp > cutoff);
    
    const byEndpoint: Record<string, {
      count: number;
      averageResponseTime: number;
      successRate: number;
      errors: number;
    }> = {};

    recentRequests.forEach(req => {
      const endpoint = `${req.method} ${req.url}`;
      if (!byEndpoint[endpoint]) {
        byEndpoint[endpoint] = {
          count: 0,
          averageResponseTime: 0,
          successRate: 0,
          errors: 0
        };
      }

      const stats = byEndpoint[endpoint];
      stats.count++;
      
      // Update average response time
      const totalTime = stats.averageResponseTime * (stats.count - 1) + req.responseTime;
      stats.averageResponseTime = totalTime / stats.count;

      // Count errors
      if (req.statusCode >= 400) {
        stats.errors++;
      }

      // Calculate success rate
      stats.successRate = ((stats.count - stats.errors) / stats.count) * 100;
    });

    return byEndpoint;
  }

  // Get slow requests
  getSlowRequests(threshold = 1000, limit = 50) {
    return this.requests
      .filter(r => r.responseTime > threshold)
      .slice(0, limit)
      .sort((a, b) => b.responseTime - a.responseTime);
  }

  // Health check
  getHealthStatus() {
    const recentErrors = this.systemMetrics.errors.recentErrors.filter(
      e => e.timestamp > Date.now() - 300000 // Last 5 minutes
    );

    const errorRate = this.systemMetrics.requests.total > 0 
      ? (this.systemMetrics.requests.errors / this.systemMetrics.requests.total) * 100 
      : 0;

    const memoryUsage = this.systemMetrics.performance.memoryUsage;
    const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;

    return {
      status: recentErrors.length < 10 && errorRate < 5 && memoryUsageMB < 512 ? 'healthy' : 'degraded',
      checks: {
        errorRate: { status: errorRate < 5 ? 'pass' : 'fail', value: errorRate },
        recentErrors: { status: recentErrors.length < 10 ? 'pass' : 'fail', value: recentErrors.length },
        memoryUsage: { status: memoryUsageMB < 512 ? 'pass' : 'fail', value: memoryUsageMB },
        uptime: { status: 'pass', value: this.systemMetrics.performance.uptime }
      },
      timestamp: Date.now()
    };
  }
}

// Global monitoring instance
export const monitoring = new MonitoringService();

// Helper functions for middleware registration
export const monitoringHooks = {
  onRequest: monitoring.onRequest,
  onResponse: monitoring.onResponse,
  onError: monitoring.onError
};

export { MonitoringService };
