/**
 * Performance Monitoring Service
 * Tracks page load times, API response times, render performance, and Core Web Vitals
 * Requirements: 4.1, 4.2, 2.2
 */

import { monitoringService } from '@/../../packages/data-orchestration/src/services/monitoring.service';

export interface WebVitalsMetric {
  name: 'CLS' | 'FID' | 'FCP' | 'LCP' | 'TTFB' | 'INP';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
}

export interface PageLoadMetrics {
  url: string;
  loadTime: number;
  domContentLoaded: number;
  firstPaint: number;
  firstContentfulPaint: number;
  largestContentfulPaint?: number;
  timeToInteractive?: number;
  totalBlockingTime?: number;
  cumulativeLayoutShift?: number;
  timestamp: Date;
}

export interface ApiPerformanceMetrics {
  endpoint: string;
  method: string;
  duration: number;
  status: number;
  timestamp: Date;
  cached?: boolean;
}

export interface RenderPerformanceMetrics {
  componentName: string;
  renderTime: number;
  updateCount: number;
  timestamp: Date;
}

class PerformanceMonitor {
  private pageLoadMetrics: PageLoadMetrics[] = [];
  private apiMetrics: ApiPerformanceMetrics[] = [];
  private renderMetrics: Map<string, RenderPerformanceMetrics[]> = new Map();
  private maxMetricsSize = 100;

  /**
   * Initialize performance monitoring
   * Sets up observers for Core Web Vitals and navigation timing
   */
  initialize(): void {
    if (typeof window === 'undefined') {
      return;
    }

    // Track page load metrics
    this.trackPageLoad();

    // Track Core Web Vitals
    this.trackWebVitals();

    // Track long tasks
    this.trackLongTasks();

    // Track resource timing
    this.trackResourceTiming();
  }

  /**
   * Track page load performance
   */
  private trackPageLoad(): void {
    if (typeof window === 'undefined' || !window.performance) {
      return;
    }

    // Wait for page to fully load
    if (document.readyState === 'complete') {
      this.capturePageLoadMetrics();
    } else {
      window.addEventListener('load', () => {
        // Small delay to ensure all metrics are available
        setTimeout(() => this.capturePageLoadMetrics(), 0);
      });
    }
  }

  /**
   * Capture page load metrics from Navigation Timing API
   */
  private capturePageLoadMetrics(): void {
    if (typeof window === 'undefined' || !window.performance) {
      return;
    }

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (!navigation) {
      return;
    }

    const metrics: PageLoadMetrics = {
      url: window.location.pathname,
      loadTime: navigation.loadEventEnd - navigation.fetchStart,
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
      firstPaint: 0,
      firstContentfulPaint: 0,
      timestamp: new Date(),
    };

    // Get paint timing
    const paintEntries = performance.getEntriesByType('paint');
    paintEntries.forEach((entry) => {
      if (entry.name === 'first-paint') {
        metrics.firstPaint = entry.startTime;
      } else if (entry.name === 'first-contentful-paint') {
        metrics.firstContentfulPaint = entry.startTime;
      }
    });

    this.pageLoadMetrics.push(metrics);
    this.trimMetrics(this.pageLoadMetrics);

    // Record to monitoring service
    monitoringService.recordTiming('page.load', metrics.loadTime, {
      url: metrics.url,
    });
    monitoringService.recordTiming('page.domContentLoaded', metrics.domContentLoaded, {
      url: metrics.url,
    });
    monitoringService.recordTiming('page.firstContentfulPaint', metrics.firstContentfulPaint, {
      url: metrics.url,
    });
  }

  /**
   * Track Core Web Vitals using web-vitals library pattern
   */
  private trackWebVitals(): void {
    if (typeof window === 'undefined') {
      return;
    }

    // Track Largest Contentful Paint (LCP)
    this.observeLCP();

    // Track First Input Delay (FID) / Interaction to Next Paint (INP)
    this.observeFID();

    // Track Cumulative Layout Shift (CLS)
    this.observeCLS();
  }

  /**
   * Observe Largest Contentful Paint
   */
  private observeLCP(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;

        if (lastEntry) {
          const lcp = lastEntry.renderTime || lastEntry.loadTime;
          
          monitoringService.recordMetric('webvitals.lcp', lcp, {
            url: window.location.pathname,
            rating: this.getLCPRating(lcp),
          });
        }
      });

      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      // LCP observation failed
    }
  }

  /**
   * Observe First Input Delay
   */
  private observeFID(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        
        entries.forEach((entry: any) => {
          const fid = entry.processingStart - entry.startTime;
          
          monitoringService.recordMetric('webvitals.fid', fid, {
            url: window.location.pathname,
            rating: this.getFIDRating(fid),
          });
        });
      });

      observer.observe({ type: 'first-input', buffered: true });
    } catch {
      // FID observation failed
    }
  }

  /**
   * Observe Cumulative Layout Shift
   */
  private observeCLS(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }

    let clsValue = 0;
    const clsEntries: any[] = [];

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        
        entries.forEach((entry: any) => {
          // Only count layout shifts without recent user input
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            clsEntries.push(entry);
          }
        });

        monitoringService.recordMetric('webvitals.cls', clsValue, {
          url: window.location.pathname,
          rating: this.getCLSRating(clsValue),
        });

      });

      observer.observe({ type: 'layout-shift', buffered: true });

      // Report final CLS on page hide
      const reportCLS = () => {
        monitoringService.recordMetric('webvitals.cls.final', clsValue, {
          url: window.location.pathname,
          rating: this.getCLSRating(clsValue),
        });
      };

      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          reportCLS();
        }
      });
    } catch {
      // CLS observation failed
    }
  }

  /**
   * Track long tasks that block the main thread
   */
  private trackLongTasks(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        
        entries.forEach((entry) => {
          monitoringService.recordTiming('performance.longTask', entry.duration, {
            url: window.location.pathname,
          });
        });
      });

      observer.observe({ type: 'longtask', buffered: true });
    } catch {
      // Long task API not supported in all browsers
    }
  }

  /**
   * Track resource loading performance
   */
  private trackResourceTiming(): void {
    if (typeof window === 'undefined' || !window.performance) {
      return;
    }

    window.addEventListener('load', () => {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      
      // Track slow resources
      resources.forEach((resource) => {
        if (resource.duration > 1000) {
          monitoringService.recordTiming('resource.slow', resource.duration, {
            url: resource.name,
            type: resource.initiatorType,
          });
        }
      });

      // Calculate total resource size
      const totalSize = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
      monitoringService.recordMetric('resource.totalSize', totalSize, {
        url: window.location.pathname,
      });
    });
  }

  /**
   * Track API call performance
   */
  trackApiCall(
    endpoint: string,
    method: string,
    duration: number,
    status: number,
    cached: boolean = false
  ): void {
    const metric: ApiPerformanceMetrics = {
      endpoint,
      method,
      duration,
      status,
      cached,
      timestamp: new Date(),
    };

    this.apiMetrics.push(metric);
    this.trimMetrics(this.apiMetrics);

    // Record to monitoring service
    monitoringService.recordApiResponseTime(endpoint, duration);
    monitoringService.recordTiming('api.call', duration, {
      endpoint,
      method,
      status: status.toString(),
      cached: cached.toString(),
    });

    // Track slow API calls
    if (duration > 2000) {
      monitoringService.incrementCounter('api.slow', { endpoint });
    }
  }

  /**
   * Track component render performance
   */
  trackRender(componentName: string, renderTime: number): void {
    if (!this.renderMetrics.has(componentName)) {
      this.renderMetrics.set(componentName, []);
    }

    const metrics = this.renderMetrics.get(componentName)!;
    const updateCount = metrics.length + 1;

    const metric: RenderPerformanceMetrics = {
      componentName,
      renderTime,
      updateCount,
      timestamp: new Date(),
    };

    metrics.push(metric);
    this.trimMetrics(metrics);

    // Record to monitoring service
    monitoringService.recordTiming('component.render', renderTime, {
      component: componentName,
    });

    // Track slow renders
    if (renderTime > 16) {
      monitoringService.incrementCounter('component.slowRender', { component: componentName });
    }
  }

  /**
   * Get page load metrics
   */
  getPageLoadMetrics(): PageLoadMetrics[] {
    return [...this.pageLoadMetrics];
  }

  /**
   * Get API performance metrics
   */
  getApiMetrics(): ApiPerformanceMetrics[] {
    return [...this.apiMetrics];
  }

  /**
   * Get render performance metrics
   */
  getRenderMetrics(componentName?: string): RenderPerformanceMetrics[] {
    if (componentName) {
      return this.renderMetrics.get(componentName) || [];
    }

    const allMetrics: RenderPerformanceMetrics[] = [];
    this.renderMetrics.forEach((metrics) => {
      allMetrics.push(...metrics);
    });
    return allMetrics;
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    pageLoad: {
      avgLoadTime: number;
      avgFCP: number;
      count: number;
    };
    api: {
      avgResponseTime: number;
      slowCallsCount: number;
      totalCalls: number;
    };
    render: {
      avgRenderTime: number;
      slowRendersCount: number;
      totalRenders: number;
    };
  } {
    // Page load summary
    const pageLoadAvg = this.pageLoadMetrics.length > 0
      ? this.pageLoadMetrics.reduce((sum, m) => sum + m.loadTime, 0) / this.pageLoadMetrics.length
      : 0;
    const fcpAvg = this.pageLoadMetrics.length > 0
      ? this.pageLoadMetrics.reduce((sum, m) => sum + m.firstContentfulPaint, 0) / this.pageLoadMetrics.length
      : 0;

    // API summary
    const apiAvg = this.apiMetrics.length > 0
      ? this.apiMetrics.reduce((sum, m) => sum + m.duration, 0) / this.apiMetrics.length
      : 0;
    const slowApiCalls = this.apiMetrics.filter(m => m.duration > 2000).length;

    // Render summary
    const allRenderMetrics = this.getRenderMetrics();
    const renderAvg = allRenderMetrics.length > 0
      ? allRenderMetrics.reduce((sum, m) => sum + m.renderTime, 0) / allRenderMetrics.length
      : 0;
    const slowRenders = allRenderMetrics.filter(m => m.renderTime > 16).length;

    return {
      pageLoad: {
        avgLoadTime: pageLoadAvg,
        avgFCP: fcpAvg,
        count: this.pageLoadMetrics.length,
      },
      api: {
        avgResponseTime: apiAvg,
        slowCallsCount: slowApiCalls,
        totalCalls: this.apiMetrics.length,
      },
      render: {
        avgRenderTime: renderAvg,
        slowRendersCount: slowRenders,
        totalRenders: allRenderMetrics.length,
      },
    };
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.pageLoadMetrics = [];
    this.apiMetrics = [];
    this.renderMetrics.clear();
  }

  // Rating helpers based on Core Web Vitals thresholds

  private getLCPRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 2500) return 'good';
    if (value <= 4000) return 'needs-improvement';
    return 'poor';
  }

  private getFIDRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 100) return 'good';
    if (value <= 300) return 'needs-improvement';
    return 'poor';
  }

  private getCLSRating(value: number): 'good' | 'needs-improvement' | 'poor' {
    if (value <= 0.1) return 'good';
    if (value <= 0.25) return 'needs-improvement';
    return 'poor';
  }

  private trimMetrics<T>(metrics: T[]): void {
    if (metrics.length > this.maxMetricsSize) {
      metrics.splice(0, metrics.length - this.maxMetricsSize);
    }
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Auto-initialize in browser
if (typeof window !== 'undefined') {
  performanceMonitor.initialize();
}
