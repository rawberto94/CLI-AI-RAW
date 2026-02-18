'use client';

import React, { memo, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Shield,
  DollarSign,
  Calendar,
  Users,
  FileText,
  ChevronRight,
  ChevronLeft,
  X,
  Brain,
  Lightbulb,
  Target,
  Clock,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Insight {
  id: string;
  type: 'risk' | 'opportunity' | 'info' | 'action' | 'compliance';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  category: string;
  actionable?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

interface SmartInsightsPanelProps {
  insights: Insight[];
  riskLevel?: 'low' | 'medium' | 'high';
  riskScore?: number;
  complianceStatus?: boolean;
  contractValue?: number;
  daysToExpiry?: number | null;
  onInsightClick?: (insight: Insight) => void;
  onAIAnalyze?: () => void;
  className?: string;
}

export const SmartInsightsPanel = memo(function SmartInsightsPanel({
  insights,
  riskLevel = 'medium',
  riskScore = 50,
  complianceStatus = true,
  contractValue,
  daysToExpiry,
  onInsightClick,
  onAIAnalyze,
  className = '',
}: SmartInsightsPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // Prioritize and sort insights
  const sortedInsights = useMemo(() => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    let filtered = [...insights];
    
    if (activeFilter) {
      filtered = filtered.filter(i => i.type === activeFilter);
    }
    
    return filtered.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }, [insights, activeFilter]);

  const insightCounts = useMemo(() => {
    return {
      risk: insights.filter(i => i.type === 'risk').length,
      opportunity: insights.filter(i => i.type === 'opportunity').length,
      action: insights.filter(i => i.type === 'action').length,
      info: insights.filter(i => i.type === 'info').length,
      compliance: insights.filter(i => i.type === 'compliance').length,
    };
  }, [insights]);

  const highPriorityCount = insights.filter(i => i.priority === 'high').length;

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'risk': return AlertTriangle;
      case 'opportunity': return TrendingUp;
      case 'action': return Target;
      case 'compliance': return Shield;
      default: return Info;
    }
  };

  const getInsightColors = (type: string, priority: string) => {
    if (priority === 'high') {
      return {
        bg: 'bg-red-50 dark:bg-red-950/30',
        border: 'border-red-200 dark:border-red-800',
        icon: 'text-red-500',
        badge: 'bg-red-100 text-red-700',
      };
    }
    
    switch (type) {
      case 'risk':
        return {
          bg: 'bg-amber-50 dark:bg-amber-950/30',
          border: 'border-amber-200 dark:border-amber-800',
          icon: 'text-amber-500',
          badge: 'bg-amber-100 text-amber-700',
        };
      case 'opportunity':
        return {
          bg: 'bg-violet-50 dark:bg-violet-950/30',
          border: 'border-violet-200 dark:border-violet-800',
          icon: 'text-violet-500',
          badge: 'bg-violet-100 text-violet-700',
        };
      case 'compliance':
        return {
          bg: 'bg-violet-50 dark:bg-violet-950/30',
          border: 'border-violet-200 dark:border-violet-800',
          icon: 'text-violet-500',
          badge: 'bg-violet-100 text-violet-700',
        };
      case 'action':
        return {
          bg: 'bg-violet-50 dark:bg-violet-950/30',
          border: 'border-violet-200 dark:border-violet-800',
          icon: 'text-violet-500',
          badge: 'bg-violet-100 text-violet-700',
        };
      default:
        return {
          bg: 'bg-slate-50 dark:bg-slate-800',
          border: 'border-slate-200 dark:border-slate-700',
          icon: 'text-slate-500',
          badge: 'bg-slate-100 text-slate-700',
        };
    }
  };

  return (
    <div className={cn("fixed right-4 top-24 z-30", className)}>
      <AnimatePresence mode="wait">
        {isCollapsed ? (
          // Collapsed State - Just the toggle button with indicator
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            onClick={() => setIsCollapsed(false)}
            className="relative flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg hover:shadow-xl transition-shadow"
          >
            <Sparkles className="h-4 w-4 text-violet-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">AI Insights</span>
            
            {/* High Priority Indicator */}
            {highPriorityCount > 0 && (
              <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full">
                {highPriorityCount}
              </span>
            )}
            
            <ChevronLeft className="h-4 w-4 text-slate-400" />
          </motion.button>
        ) : (
          // Expanded Panel
          <motion.div
            key="expanded"
            initial={{ opacity: 0, x: 20, width: 0 }}
            animate={{ opacity: 1, x: 0, width: 320 }}
            exit={{ opacity: 0, x: 20, width: 0 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-500" />
                <span className="font-semibold text-slate-800 dark:text-slate-200">AI Insights</span>
                <Badge className="bg-violet-100 text-violet-700 text-xs">
                  {insights.length}
                </Badge>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsCollapsed(true)}
                className="h-7 w-7 p-0 rounded-lg"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2 p-3 border-b border-slate-100 dark:border-slate-800">
              {/* Risk Score */}
              <div className={cn(
                "flex flex-col items-center p-2 rounded-lg",
                riskLevel === 'low' ? 'bg-violet-50 dark:bg-violet-950/30' :
                riskLevel === 'medium' ? 'bg-amber-50 dark:bg-amber-950/30' :
                'bg-red-50 dark:bg-red-950/30'
              )}>
                <Shield className={cn(
                  "h-4 w-4 mb-1",
                  riskLevel === 'low' ? 'text-violet-500' :
                  riskLevel === 'medium' ? 'text-amber-500' :
                  'text-red-500'
                )} />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {riskScore}%
                </span>
                <span className="text-[10px] text-slate-500">Risk</span>
              </div>

              {/* Compliance */}
              <div className={cn(
                "flex flex-col items-center p-2 rounded-lg",
                complianceStatus ? 'bg-violet-50 dark:bg-violet-950/30' : 'bg-amber-50 dark:bg-amber-950/30'
              )}>
                {complianceStatus ? (
                  <CheckCircle2 className="h-4 w-4 mb-1 text-violet-500" />
                ) : (
                  <XCircle className="h-4 w-4 mb-1 text-amber-500" />
                )}
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {complianceStatus ? 'OK' : 'Review'}
                </span>
                <span className="text-[10px] text-slate-500">Compliance</span>
              </div>

              {/* Days to Expiry */}
              <div className={cn(
                "flex flex-col items-center p-2 rounded-lg",
                daysToExpiry == null ? 'bg-slate-50 dark:bg-slate-800' :
                daysToExpiry <= 30 ? 'bg-red-50 dark:bg-red-950/30' :
                daysToExpiry <= 90 ? 'bg-amber-50 dark:bg-amber-950/30' :
                'bg-violet-50 dark:bg-violet-950/30'
              )}>
                <Clock className={cn(
                  "h-4 w-4 mb-1",
                  daysToExpiry == null ? 'text-slate-400' :
                  daysToExpiry <= 30 ? 'text-red-500' :
                  daysToExpiry <= 90 ? 'text-amber-500' :
                  'text-violet-500'
                )} />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {daysToExpiry === null ? '∞' : daysToExpiry}
                </span>
                <span className="text-[10px] text-slate-500">Days left</span>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1 p-2 border-b border-slate-100 dark:border-slate-800 overflow-x-auto">
              <button
                onClick={() => setActiveFilter(null)}
                className={cn(
                  "px-2 py-1 text-xs font-medium rounded-md transition-colors",
                  activeFilter === null
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                All
              </button>
              {insightCounts.risk > 0 && (
                <button
                  onClick={() => setActiveFilter('risk')}
                  className={cn(
                    "px-2 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1",
                    activeFilter === 'risk'
                      ? "bg-amber-500 text-white"
                      : "text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                  )}
                >
                  <AlertTriangle className="h-3 w-3" />
                  {insightCounts.risk}
                </button>
              )}
              {insightCounts.opportunity > 0 && (
                <button
                  onClick={() => setActiveFilter('opportunity')}
                  className={cn(
                    "px-2 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1",
                    activeFilter === 'opportunity'
                      ? "bg-violet-500 text-white"
                      : "text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                  )}
                >
                  <TrendingUp className="h-3 w-3" />
                  {insightCounts.opportunity}
                </button>
              )}
              {insightCounts.action > 0 && (
                <button
                  onClick={() => setActiveFilter('action')}
                  className={cn(
                    "px-2 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1",
                    activeFilter === 'action'
                      ? "bg-violet-500 text-white"
                      : "text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                  )}
                >
                  <Target className="h-3 w-3" />
                  {insightCounts.action}
                </button>
              )}
            </div>

            {/* Insights List */}
            <div className="max-h-[400px] overflow-y-auto p-2 space-y-2">
              {sortedInsights.length === 0 ? (
                <div className="py-8 text-center">
                  <Lightbulb className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No insights available</p>
                  <Button
                    size="sm"
                    onClick={onAIAnalyze}
                    className="mt-3 gap-2 bg-violet-500 hover:bg-violet-600"
                  >
                    <Brain className="h-4 w-4" />
                    Run AI Analysis
                  </Button>
                </div>
              ) : (
                <AnimatePresence>
                  {sortedInsights.map((insight, index) => {
                    const Icon = getInsightIcon(insight.type);
                    const colors = getInsightColors(insight.type, insight.priority);

                    return (
                      <motion.div
                        key={insight.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => onInsightClick?.(insight)}
                        className={cn(
                          "p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md",
                          colors.bg,
                          colors.border
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", colors.icon)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                                {insight.title}
                              </span>
                              {insight.priority === 'high' && (
                                <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded">
                                  HIGH
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                              {insight.description}
                            </p>
                            {insight.actionable && insight.actionLabel && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  insight.onAction?.();
                                }}
                                className="h-6 px-2 mt-2 text-xs"
                              >
                                {insight.actionLabel}
                              </Button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                size="sm"
                onClick={onAIAnalyze}
                className="w-full gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
              >
                <Sparkles className="h-4 w-4" />
                Deeper Analysis
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default SmartInsightsPanel;
