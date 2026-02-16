'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Bot,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileSearch,
  Brain,
  Zap,
  Shield,
  TrendingUp,
  RefreshCw,
  ChevronRight,
  Filter,
  Eye,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

// ============================================================================
// Types
// ============================================================================

export type AIActivityType =
  | 'extraction'
  | 'risk_detection'
  | 'gap_filling'
  | 'workflow_suggestion'
  | 'classification'
  | 'validation'
  | 'health_check'
  | 'opportunity_discovery'
  | 'search'
  | 'learning'
  | 'auto_correction';

export interface AIActivity {
  id: string;
  type: AIActivityType;
  agentName: string;
  action: string;
  contractId?: string;
  contractName?: string;
  status: 'running' | 'completed' | 'failed' | 'needs_review';
  confidence?: number;
  details?: string;
  result?: Record<string, unknown>;
  timestamp: Date;
  duration?: number; // in ms
}

interface AIActivityFeedProps {
  activities?: AIActivity[];
  maxItems?: number;
  showFilters?: boolean;
  compact?: boolean;
  onActivityClick?: (activity: AIActivity) => void;
}

// ============================================================================
// Activity Icons & Colors
// ============================================================================

const activityConfig: Record<AIActivityType, { 
  icon: React.ElementType; 
  color: string; 
  bgColor: string;
  label: string;
}> = {
  extraction: {
    icon: FileSearch,
    color: 'text-violet-600',
    bgColor: 'bg-violet-100',
    label: 'Extraction',
  },
  risk_detection: {
    icon: Shield,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Risk Detection',
  },
  gap_filling: {
    icon: Brain,
    color: 'text-violet-600',
    bgColor: 'bg-violet-100',
    label: 'Gap Filling',
  },
  workflow_suggestion: {
    icon: Zap,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    label: 'Workflow',
  },
  classification: {
    icon: TrendingUp,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Classification',
  },
  validation: {
    icon: CheckCircle2,
    color: 'text-violet-600',
    bgColor: 'bg-violet-100',
    label: 'Validation',
  },
  health_check: {
    icon: Activity,
    color: 'text-violet-600',
    bgColor: 'bg-violet-100',
    label: 'Health Check',
  },
  opportunity_discovery: {
    icon: Sparkles,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    label: 'Opportunity',
  },
  search: {
    icon: FileSearch,
    color: 'text-violet-600',
    bgColor: 'bg-violet-100',
    label: 'Search',
  },
  learning: {
    icon: Brain,
    color: 'text-pink-600',
    bgColor: 'bg-pink-100',
    label: 'Learning',
  },
  auto_correction: {
    icon: RefreshCw,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    label: 'Auto-Correction',
  },
};

const statusConfig = {
  running: { color: 'bg-violet-500', text: 'Running', pulse: true },
  completed: { color: 'bg-green-500', text: 'Completed', pulse: false },
  failed: { color: 'bg-red-500', text: 'Failed', pulse: false },
  needs_review: { color: 'bg-amber-500', text: 'Needs Review', pulse: true },
};

// ============================================================================
// Component
// ============================================================================

export function AIActivityFeed({
  activities: propActivities,
  maxItems = 10,
  showFilters = true,
  compact = false,
  onActivityClick,
}: AIActivityFeedProps) {
  const [activities, setActivities] = useState<AIActivity[]>([]);
  const [filter, setFilter] = useState<AIActivityType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'needs_review'>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Load activities
  useEffect(() => {
    if (propActivities) {
      setActivities(propActivities);
      setIsLoading(false);
    } else {
      // Fetch from AI history API
      const fetchActivities = async () => {
        try {
          const response = await fetch('/api/ai/history?limit=20');
          if (!response.ok) throw new Error('Failed to fetch');
          const data = await response.json();
          if (data.history?.length > 0) {
            const mapped: AIActivity[] = data.history.map((h: any) => ({
              id: h.id,
              type: (h.queryType === 'chat' ? 'extraction' : h.queryType === 'analyze' ? 'risk_detection' : h.queryType === 'compare' ? 'classification' : 'extraction') as AIActivityType,
              agentName: h.model || 'AI Agent',
              action: h.query?.slice(0, 80) || 'AI operation',
              status: h.success ? 'completed' as const : 'failed' as const,
              confidence: h.success ? 0.9 : undefined,
              details: h.tokensUsed ? `${h.tokensUsed} tokens used` : undefined,
              timestamp: new Date(h.timestamp),
              duration: h.responseTime,
            }));
            setActivities(mapped);
          } else {
            setActivities([]);
          }
        } catch {
          setActivities([]);
        } finally {
          setIsLoading(false);
        }
      };
      fetchActivities();
    }
  }, [propActivities]);

  // Poll for new activities periodically
  useEffect(() => {
    if (propActivities) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/ai/history?limit=5');
        if (!response.ok) return;
        const data = await response.json();
        if (data.history?.length > 0) {
          setActivities(prev => {
            const existingIds = new Set(prev.map(a => a.id));
            const newItems: AIActivity[] = data.history
              .filter((h: any) => !existingIds.has(h.id))
              .map((h: any) => ({
                id: h.id,
                type: (h.queryType === 'chat' ? 'extraction' : h.queryType === 'analyze' ? 'risk_detection' : 'extraction') as AIActivityType,
                agentName: h.model || 'AI Agent',
                action: h.query?.slice(0, 80) || 'AI operation',
                status: h.success ? 'completed' as const : 'failed' as const,
                confidence: h.success ? 0.9 : undefined,
                details: h.tokensUsed ? `${h.tokensUsed} tokens used` : undefined,
                timestamp: new Date(h.timestamp),
                duration: h.responseTime,
              }));
            return [...newItems, ...prev].slice(0, maxItems + 5);
          });
        }
      } catch {
        // Silently fail polling
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [propActivities, maxItems]);

  // Filter activities
  const filteredActivities = activities
    .filter(a => filter === 'all' || a.type === filter)
    .filter(a => statusFilter === 'all' || a.status === statusFilter)
    .slice(0, maxItems);

  const needsReviewCount = activities.filter(a => a.status === 'needs_review').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading AI activity...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${compact ? '' : 'bg-white rounded-xl border border-gray-200 shadow-sm'}`}>
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">AI Activity</h3>
              <p className="text-xs text-gray-500">Real-time agent actions</p>
            </div>
          </div>

          {showFilters && (
            <div className="flex items-center gap-2">
              {needsReviewCount > 0 && (
                <Button
                  variant={statusFilter === 'needs_review' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(statusFilter === 'needs_review' ? 'all' : 'needs_review')}
                  className="text-xs"
                >
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {needsReviewCount} Need Review
                </Button>
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="w-3 h-3 mr-1" />
                    {filter === 'all' ? 'All Types' : activityConfig[filter].label}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setFilter('all')}>
                    All Types
                  </DropdownMenuItem>
                  {Object.entries(activityConfig).map(([key, config]) => (
                    <DropdownMenuItem key={key} onClick={() => setFilter(key as AIActivityType)}>
                      <config.icon className={`w-4 h-4 mr-2 ${config.color}`} />
                      {config.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      )}

      {/* Activity List */}
      <ScrollArea className={compact ? 'h-64' : 'h-96'}>
        <div className="divide-y divide-gray-50">
          <AnimatePresence mode="popLayout">
            {filteredActivities.map((activity, index) => {
              const config = activityConfig[activity.type];
              const status = statusConfig[activity.status];
              const Icon = config.icon;

              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.02 }}
                  className={`px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                    activity.status === 'needs_review' ? 'bg-amber-50/50' : ''
                  }`}
                  onClick={() => onActivityClick?.(activity)}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-lg ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-gray-900">{activity.agentName}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {config.label}
                        </Badge>
                        {/* Status indicator */}
                        <span className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${status.color} ${status.pulse ? 'animate-pulse' : ''}`} />
                          <span className="text-[10px] text-gray-500">{status.text}</span>
                        </span>
                      </div>

                      <p className="text-sm text-gray-700 mt-0.5">{activity.action}</p>

                      {activity.details && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{activity.details}</p>
                      )}

                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        {activity.contractName && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Link
                                  href={`/contracts/${activity.contractId}`}
                                  className="flex items-center gap-1 hover:text-violet-600"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <Eye className="w-3 h-3" />
                                  {activity.contractName}
                                </Link>
                              </TooltipTrigger>
                              <TooltipContent>View contract</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        
                        {activity.confidence && (
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {Math.round(activity.confidence * 100)}% confidence
                          </span>
                        )}

                        {activity.duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {activity.duration < 1000
                              ? `${activity.duration}ms`
                              : `${(activity.duration / 1000).toFixed(1)}s`}
                          </span>
                        )}

                        <span>{formatDistanceToNow(activity.timestamp, { addSuffix: true })}</span>
                      </div>
                    </div>

                    {/* Action */}
                    {activity.status === 'needs_review' && (
                      <Button variant="ghost" size="sm" className="flex-shrink-0">
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filteredActivities.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Bot className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">No AI activity to show</p>
              <p className="text-xs">Activities will appear here as AI agents work</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      {!compact && (
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{activities.length} total activities</span>
            <Link href="/ai" className="flex items-center gap-1 hover:text-violet-600 transition-colors">
              View AI Dashboard
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default AIActivityFeed;
