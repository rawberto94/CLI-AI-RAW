"use client";

/**
 * AI Usage Quota Widget
 * 
 * Displays the user's AI usage quota and remaining limits.
 * Shows real-time consumption across requests, tokens, and cost.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  DollarSign,
  MessageSquare,
  TrendingUp as _TrendingUp,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { motion, AnimatePresence as _AnimatePresence } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Types
interface UsageData {
  requests: { used: number; limit: number; percentUsed: number };
  tokens: { used: number; limit: number; percentUsed: number };
  cost: { used: number; limit: number; percentUsed: number };
  resetAt: string;
  tier: string;
}

interface QuotaWidgetProps {
  compact?: boolean;
  showRefresh?: boolean;
  className?: string;
}

// Tier labels and colors
const TIER_CONFIG: Record<string, { label: string; color: string }> = {
  free: { label: 'Free', color: 'bg-slate-500' },
  starter: { label: 'Starter', color: 'bg-violet-500' },
  professional: { label: 'Professional', color: 'bg-violet-500' },
  enterprise: { label: 'Enterprise', color: 'bg-amber-500' },
};

export function AIUsageQuotaWidget({
  compact = false,
  showRefresh = true,
  className = '',
}: QuotaWidgetProps) {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [_error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/ai/analytics?view=today');
      const data = await response.json();

      if (data.success) {
        // Map API response to usage data (using mock limits for demo)
        const tier = 'professional'; // Would come from user session
        const limits = {
          free: { requests: 10, tokens: 10000, cost: 0.10 },
          starter: { requests: 30, tokens: 50000, cost: 1.00 },
          professional: { requests: 100, tokens: 200000, cost: 5.00 },
          enterprise: { requests: 500, tokens: 1000000, cost: 50.00 },
        }[tier] || { requests: 10, tokens: 10000, cost: 0.10 };

        setUsage({
          requests: {
            used: data.data.requests || 0,
            limit: limits.requests,
            percentUsed: ((data.data.requests || 0) / limits.requests) * 100,
          },
          tokens: {
            used: data.data.tokens || 0,
            limit: limits.tokens,
            percentUsed: ((data.data.tokens || 0) / limits.tokens) * 100,
          },
          cost: {
            used: data.data.cost || 0,
            limit: limits.cost,
            percentUsed: ((data.data.cost || 0) / limits.cost) * 100,
          },
          resetAt: new Date(Date.now() + 60000).toISOString(), // Next minute
          tier,
        });
      } else {
        throw new Error(data.error || 'Failed to fetch usage');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage');
      // Show empty/zero state on error instead of mock data
      setUsage({
        requests: { used: 0, limit: 100, percentUsed: 0 },
        tokens: { used: 0, limit: 200000, percentUsed: 0 },
        cost: { used: 0, limit: 5.00, percentUsed: 0 },
        resetAt: new Date(Date.now() + 3600000).toISOString(),
        tier: 'professional',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
    // Refresh every minute
    const interval = setInterval(fetchUsage, 60000);
    return () => clearInterval(interval);
  }, [fetchUsage]);

  if (isLoading && !usage) {
    return (
      <div className={`animate-pulse bg-slate-100 rounded-lg p-4 ${className}`}>
        <div className="h-4 bg-slate-200 rounded w-1/2 mb-2" />
        <div className="h-3 bg-slate-200 rounded w-3/4" />
      </div>
    );
  }

  if (!usage) return null;

  const tierConfig = TIER_CONFIG[usage.tier] || TIER_CONFIG.free;
  const timeUntilReset = new Date(usage.resetAt).getTime() - Date.now();
  const minutesUntilReset = Math.max(0, Math.floor(timeUntilReset / 60000));

  // Compact view
  if (compact && !isExpanded) {
    return (
      <div
        className={`flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors ${className}`}
        onClick={() => setIsExpanded(true)}
      >
        <div className="flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-violet-500" />
          <span className="text-sm font-medium">
            {usage.requests.used}/{usage.requests.limit}
          </span>
        </div>
        <div className="w-px h-4 bg-slate-200" />
        <div className="flex items-center gap-1.5">
          <DollarSign className="w-4 h-4 text-green-500" />
          <span className="text-sm font-medium">
            ${usage.cost.used.toFixed(2)}
          </span>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </div>
    );
  }

  return (
    <div className={`bg-white border border-slate-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${tierConfig.color}`}>
            {tierConfig.label}
          </span>
          <h3 className="font-semibold text-slate-800">AI Usage</h3>
        </div>
        <div className="flex items-center gap-2">
          {showRefresh && (
            <button
              onClick={fetchUsage}
              disabled={isLoading}
              className="p-1.5 hover:bg-slate-100 rounded transition-colors"
            >
              <RefreshCw className={`w-4 h-4 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
          {compact && (
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1.5 hover:bg-slate-100 rounded transition-colors"
            >
              <ChevronUp className="w-4 h-4 text-slate-500" />
            </button>
          )}
        </div>
      </div>

      {/* Usage Metrics */}
      <div className="p-4 space-y-4">
        {/* Requests */}
        <UsageBar
          icon={MessageSquare}
          label="Requests"
          used={usage.requests.used}
          limit={usage.requests.limit}
          percentUsed={usage.requests.percentUsed}
          format="number"
        />

        {/* Tokens */}
        <UsageBar
          icon={Zap}
          label="Tokens"
          used={usage.tokens.used}
          limit={usage.tokens.limit}
          percentUsed={usage.tokens.percentUsed}
          format="number"
        />

        {/* Cost */}
        <UsageBar
          icon={DollarSign}
          label="Cost"
          used={usage.cost.used}
          limit={usage.cost.limit}
          percentUsed={usage.cost.percentUsed}
          format="currency"
        />
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 rounded-b-lg">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            Resets in {minutesUntilReset} min
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="flex items-center gap-1 text-violet-600 hover:text-violet-700">
                  <Info className="w-3.5 h-3.5" />
                  <span>View details</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View full usage analytics</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}

// Usage Bar Component
function UsageBar({
  icon: Icon,
  label,
  used,
  limit,
  percentUsed,
  format,
}: {
  icon: React.ElementType;
  label: string;
  used: number;
  limit: number;
  percentUsed: number;
  format: 'number' | 'currency';
}) {
  const isWarning = percentUsed >= 80;
  const isCritical = percentUsed >= 95;

  const formatValue = (value: number) => {
    if (format === 'currency') {
      return `$${value.toFixed(2)}`;
    }
    return value.toLocaleString();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${isCritical ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-slate-500'}`} />
          <span className="text-sm font-medium text-slate-700">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {(isWarning || isCritical) && (
            <AlertTriangle className={`w-3.5 h-3.5 ${isCritical ? 'text-red-500' : 'text-amber-500'}`} />
          )}
          <span className="text-sm text-slate-600">
            {formatValue(used)} / {formatValue(limit)}
          </span>
        </div>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${
            isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-violet-500'
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percentUsed, 100)}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

// Inline usage indicator for chat
export function InlineUsageIndicator() {
  const [usage, setUsage] = useState<{ requests: number; limit: number } | null>(null);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const response = await fetch('/api/ai/analytics?view=today');
        const data = await response.json();
        if (data.success) {
          setUsage({
            requests: data.data.requests || 0,
            limit: 100, // From tier config
          });
        }
      } catch {
        // Silent fail for inline indicator
      }
    };
    fetchUsage();
  }, []);

  if (!usage) return null;

  const percentUsed = (usage.requests / usage.limit) * 100;
  const isLow = percentUsed >= 80;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1 text-xs ${isLow ? 'text-amber-600' : 'text-slate-500'}`}>
            <Zap className="w-3 h-3" />
            <span>{usage.limit - usage.requests} left</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{usage.requests} of {usage.limit} requests used today</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default AIUsageQuotaWidget;
