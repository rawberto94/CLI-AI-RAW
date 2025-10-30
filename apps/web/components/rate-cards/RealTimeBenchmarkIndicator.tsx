'use client';

/**
 * Real-Time Benchmark Indicator Component
 * 
 * Displays real-time status of benchmark calculations including:
 * - Last update timestamp
 * - Calculating indicators
 * - Real-time update badges
 * - Notification toasts for significant changes
 */

import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw, CheckCircle, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export interface BenchmarkStatus {
  status: 'IDLE' | 'CALCULATING' | 'COMPLETED' | 'FAILED';
  lastUpdated?: Date;
  durationMs?: number;
  affectedCount?: number;
  error?: string;
}

export interface RealTimeBenchmarkIndicatorProps {
  rateCardEntryId: string;
  status?: BenchmarkStatus;
  showTimestamp?: boolean;
  showBadge?: boolean;
  compact?: boolean;
}

export function RealTimeBenchmarkIndicator({
  rateCardEntryId,
  status,
  showTimestamp = true,
  showBadge = true,
  compact = false,
}: RealTimeBenchmarkIndicatorProps) {
  const [currentStatus, setCurrentStatus] = useState<BenchmarkStatus>(
    status || { status: 'IDLE' }
  );

  useEffect(() => {
    if (status) {
      setCurrentStatus(status);
    }
  }, [status]);

  const getStatusIcon = () => {
    switch (currentStatus.status) {
      case 'CALCULATING':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'FAILED':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (currentStatus.status) {
      case 'CALCULATING':
        return 'Calculating...';
      case 'COMPLETED':
        return 'Up to date';
      case 'FAILED':
        return 'Update failed';
      default:
        return 'Ready';
    }
  };

  const getStatusColor = () => {
    switch (currentStatus.status) {
      case 'CALCULATING':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'COMPLETED':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'FAILED':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {getStatusIcon()}
        {showTimestamp && currentStatus.lastUpdated && (
          <span className="text-xs text-gray-500">
            {formatDistanceToNow(currentStatus.lastUpdated, { addSuffix: true })}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {showBadge && (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${getStatusColor()}`}>
          {getStatusIcon()}
          <span className="text-sm font-medium">{getStatusText()}</span>
        </div>
      )}

      {showTimestamp && currentStatus.lastUpdated && (
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <Clock className="h-3.5 w-3.5" />
          <span>
            Updated {formatDistanceToNow(currentStatus.lastUpdated, { addSuffix: true })}
          </span>
        </div>
      )}

      {currentStatus.status === 'COMPLETED' && currentStatus.durationMs && (
        <span className="text-xs text-gray-500">
          ({currentStatus.durationMs}ms)
        </span>
      )}

      {currentStatus.status === 'COMPLETED' && currentStatus.affectedCount !== undefined && (
        <span className="text-xs text-gray-500">
          {currentStatus.affectedCount} affected
        </span>
      )}

      {currentStatus.status === 'FAILED' && currentStatus.error && (
        <span className="text-xs text-red-600" title={currentStatus.error}>
          Error
        </span>
      )}
    </div>
  );
}

export interface MarketShiftNotification {
  id: string;
  type: 'MARKET_SHIFT' | 'BEST_RATE_CHANGE' | 'BENCHMARK_UPDATED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  changePercentage?: number;
  direction?: 'up' | 'down';
  timestamp: Date;
}

export interface NotificationToastProps {
  notification: MarketShiftNotification;
  onDismiss: () => void;
  autoHideDuration?: number;
}

export function NotificationToast({
  notification,
  onDismiss,
  autoHideDuration = 5000,
}: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (autoHideDuration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onDismiss, 300); // Wait for fade out animation
      }, autoHideDuration);

      return () => clearTimeout(timer);
    }
  }, [autoHideDuration, onDismiss]);

  const getSeverityColor = () => {
    switch (notification.severity) {
      case 'CRITICAL':
        return 'bg-red-50 border-red-200 text-red-900';
      case 'HIGH':
        return 'bg-orange-50 border-orange-200 text-orange-900';
      case 'MEDIUM':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-900';
    }
  };

  const getTrendIcon = () => {
    if (!notification.direction) return null;
    
    return notification.direction === 'up' ? (
      <TrendingUp className="h-5 w-5 text-red-500" />
    ) : (
      <TrendingDown className="h-5 w-5 text-green-500" />
    );
  };

  if (!isVisible) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 max-w-md p-4 rounded-lg border-2 shadow-lg transition-all duration-300 ${getSeverityColor()} ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {getTrendIcon() || <AlertCircle className="h-5 w-5" />}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm mb-1">{notification.title}</h4>
          <p className="text-sm opacity-90">{notification.message}</p>
          
          {notification.changePercentage !== undefined && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-white bg-opacity-50">
                {notification.changePercentage > 0 ? '+' : ''}
                {notification.changePercentage.toFixed(1)}%
              </span>
              <span className="text-xs opacity-75">
                {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(onDismiss, 300);
          }}
          className="flex-shrink-0 text-current opacity-50 hover:opacity-100 transition-opacity"
          aria-label="Dismiss notification"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export interface RealTimeUpdateBadgeProps {
  isRealTime?: boolean;
  lastUpdated?: Date;
  size?: 'sm' | 'md' | 'lg';
}

export function RealTimeUpdateBadge({
  isRealTime = true,
  lastUpdated,
  size = 'md',
}: RealTimeUpdateBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  if (!isRealTime) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <div className={`inline-flex items-center gap-1.5 ${sizeClasses[size]} bg-green-50 text-green-700 border border-green-200 rounded-full font-medium`}>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
        <span>Real-time</span>
      </div>
      
      {lastUpdated && (
        <span className="text-xs text-gray-500">
          {formatDistanceToNow(lastUpdated, { addSuffix: true })}
        </span>
      )}
    </div>
  );
}

export interface CalculatingOverlayProps {
  isCalculating: boolean;
  message?: string;
}

export function CalculatingOverlay({
  isCalculating,
  message = 'Recalculating benchmarks...',
}: CalculatingOverlayProps) {
  if (!isCalculating) return null;

  return (
    <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10 rounded-lg">
      <div className="flex flex-col items-center gap-3">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm font-medium text-gray-700">{message}</p>
        <p className="text-xs text-gray-500">This usually takes less than 5 seconds</p>
      </div>
    </div>
  );
}

export default RealTimeBenchmarkIndicator;
