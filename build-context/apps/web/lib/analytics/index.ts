/**
 * Analytics Module Exports
 * 
 * Central export point for all analytics-related services and components
 */

// Services
export {
  RealTimeAnalyticsService,
  getAnalyticsService,
  type MetricDefinition,
  type MetricDataPoint,
  type TimeSeriesQuery,
  type TimeSeriesResult,
  type DashboardMetrics,
  type AnomalyAlert,
  type AnalyticsEvent,
} from './real-time-analytics.service';

// Types
export type {
  DashboardMetrics as RealTimeDashboardMetrics,
} from './real-time-analytics.service';
