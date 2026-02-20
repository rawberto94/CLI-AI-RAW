'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion} from 'framer-motion';
import {
  Bot,
  Brain,
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Lightbulb,
  Shield,
  BarChart3,
  RefreshCw,
  ChevronRight,
  Zap,
  BookOpen,
  Target,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Breadcrumbs } from '@/components/breadcrumbs';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardData {
  timeRange: string;
  overview: {
    totalGoals: number;
    statusBreakdown: Record<string, number>;
    successRate: number;
    failureRate: number;
    avgCompletionTimeMs: number;
    totalLearningRecords: number;
    totalRecommendations: number;
    totalOpportunities: number;
    totalOpportunityValue: number;
  };
  goals: Array<{
    id: string;
    type: string;
    title: string;
    status: string;
    progress: number;
    priority: number;
    currentStep: number;
    totalSteps: number;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
    error: string | null;
  }>;
  learning: {
    records: Array<{
      id: string;
      artifactType: string;
      contractType: string | null;
      field: string;
      correctionType: string | null;
      confidence: number | null;
      modelUsed: string | null;
      createdAt: string;
    }>;
    correctionsByField: Record<string, number>;
    correctionsByType: Record<string, number>;
    totalCorrections: number;
  };
  qualityThresholds: Array<{
    id: string;
    artifactType: string;
    thresholds: Record<string, number>;
    previousThresholds: Record<string, number> | null;
    adjustmentReason: string | null;
    adjustmentMagnitude: number | null;
    updatedAt: string;
  }>;
  recommendations: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    priority: string;
    status: string;
    impact: string;
    confidence: number;
    createdAt: string;
  }>;
  opportunities: Array<{
    id: string;
    opportunityType: string;
    title: string;
    description: string;
    potentialValue: number;
    confidence: number;
    effort: string;
    status: string;
    createdAt: string;
  }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function statusColor(status: string): string {
  const s = status.toUpperCase();
  if (s === 'COMPLETED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (s === 'RUNNING' || s === 'IN_PROGRESS') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (s === 'FAILED') return 'bg-red-100 text-red-700 border-red-200';
  if (s === 'PENDING') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

function priorityColor(priority: string | number): string {
  const p = typeof priority === 'string' ? priority.toUpperCase() : priority <= 3 ? 'HIGH' : priority <= 6 ? 'MEDIUM' : 'LOW';
  if (p === 'HIGH' || p === 'CRITICAL') return 'bg-red-100 text-red-700';
  if (p === 'MEDIUM') return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-600';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AgentTransparencyDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('7d');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/ai/agents/dashboard?range=${timeRange}`);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();

    // Auto-refresh only when tab is visible
    let interval: ReturnType<typeof setInterval> | null = null;

    function startPolling() {
      if (!interval) interval = setInterval(fetchData, 60_000);
    }
    function stopPolling() {
      if (interval) { clearInterval(interval); interval = null; }
    }
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        fetchData(); // Refresh on tab focus
        startPolling();
      } else {
        stopPolling();
      }
    }

    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-violet-50/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-slate-200 rounded w-64" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-28 bg-slate-200 rounded-xl" />
              ))}
            </div>
            <div className="h-96 bg-slate-200 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50/20 to-orange-50/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-red-900">Failed to Load Dashboard</h2>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            <button
              onClick={fetchData}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const overview = data?.overview;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-violet-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <Breadcrumbs
          items={[
            { label: 'AI Intelligence', href: '/ai/chat' },
            { label: 'Agent Transparency' },
          ]}
          showHomeIcon
        />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                  Agent Transparency Dashboard
                </h1>
                <p className="text-sm text-slate-500">
                  See what your AI agents are doing, learning, and recommending
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Time range selector */}
              <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden text-sm">
                {['7d', '30d', '90d'].map(range => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-3 py-1.5 transition-colors ${
                      timeRange === range
                        ? 'bg-indigo-50 text-indigo-700 font-medium'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
              <button
                onClick={fetchData}
                className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500"
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <OverviewCard
              icon={<Target className="h-5 w-5" />}
              label="Agent Goals"
              value={overview?.totalGoals ?? 0}
              sub={`${overview?.successRate ?? 0}% success rate`}
              color="indigo"
            />
            <OverviewCard
              icon={<Brain className="h-5 w-5" />}
              label="Learning Records"
              value={overview?.totalLearningRecords ?? 0}
              sub={`${Object.keys(data?.learning?.correctionsByField ?? {}).length} fields improved`}
              color="violet"
            />
            <OverviewCard
              icon={<Lightbulb className="h-5 w-5" />}
              label="Recommendations"
              value={overview?.totalRecommendations ?? 0}
              sub={`${overview?.totalOpportunities ?? 0} opportunities`}
              color="amber"
            />
            <OverviewCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Opportunity Value"
              value={formatCurrency(overview?.totalOpportunityValue ?? 0)}
              sub={`Avg completion: ${formatMs(overview?.avgCompletionTimeMs ?? 0)}`}
              color="emerald"
            />
          </div>

          {/* Tabs */}
          <Tabs defaultValue="goals" className="space-y-4">
            <TabsList className="bg-white border border-slate-200">
              <TabsTrigger value="goals" className="gap-1.5">
                <Activity className="h-3.5 w-3.5" /> Goals
              </TabsTrigger>
              <TabsTrigger value="learning" className="gap-1.5">
                <BookOpen className="h-3.5 w-3.5" /> Learning
              </TabsTrigger>
              <TabsTrigger value="quality" className="gap-1.5">
                <Shield className="h-3.5 w-3.5" /> Quality
              </TabsTrigger>
              <TabsTrigger value="recommendations" className="gap-1.5">
                <Zap className="h-3.5 w-3.5" /> Insights
              </TabsTrigger>
            </TabsList>

            {/* Goals Tab */}
            <TabsContent value="goals">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-indigo-600" />
                    Agent Goal Activity
                  </CardTitle>
                  <CardDescription>
                    Background agent tasks — analysis, optimization, monitoring
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Status breakdown bar */}
                  {overview && overview.totalGoals > 0 && (
                    <div className="mb-4">
                      <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-slate-100">
                        {Object.entries(overview.statusBreakdown).map(([status, count]) => {
                          const pct = (count / overview.totalGoals) * 100;
                          const colors: Record<string, string> = {
                            COMPLETED: 'bg-emerald-500',
                            RUNNING: 'bg-blue-500',
                            IN_PROGRESS: 'bg-blue-500',
                            PENDING: 'bg-amber-400',
                            FAILED: 'bg-red-500',
                          };
                          return (
                            <div
                              key={status}
                              className={`${colors[status] || 'bg-slate-400'} transition-all`}
                              style={{ width: `${pct}%` }}
                              title={`${status}: ${count}`}
                            />
                          );
                        })}
                      </div>
                      <div className="flex gap-4 mt-2 text-xs text-slate-500">
                        {Object.entries(overview.statusBreakdown).map(([status, count]) => (
                          <span key={status} className="flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${
                              status === 'COMPLETED' ? 'bg-emerald-500' :
                              status === 'FAILED' ? 'bg-red-500' :
                              status === 'RUNNING' || status === 'IN_PROGRESS' ? 'bg-blue-500' :
                              'bg-amber-400'
                            }`} />
                            {status}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Goals list */}
                  <div className="space-y-2">
                    {data?.goals.map(goal => (
                      <div
                        key={goal.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-slate-200 bg-white transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium ${statusColor(goal.status)}`}>
                            {goal.status === 'COMPLETED' ? <CheckCircle2 className="h-4 w-4" /> :
                             goal.status === 'FAILED' ? <XCircle className="h-4 w-4" /> :
                             goal.status === 'RUNNING' || goal.status === 'IN_PROGRESS' ? <Activity className="h-4 w-4 animate-pulse" /> :
                             <Clock className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{goal.title}</p>
                            <p className="text-xs text-slate-500">
                              {goal.type} · {timeAgo(goal.createdAt)}
                              {goal.totalSteps > 0 && ` · Step ${goal.currentStep}/${goal.totalSteps}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {goal.progress > 0 && goal.progress < 100 && (
                            <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full transition-all"
                                style={{ width: `${goal.progress}%` }}
                              />
                            </div>
                          )}
                          <Badge variant="outline" className={`text-[10px] ${statusColor(goal.status)}`}>
                            {goal.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {(!data?.goals || data.goals.length === 0) && (
                      <div className="text-center py-8 text-sm text-slate-400">
                        No agent goals in this time range
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Learning Tab */}
            <TabsContent value="learning">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Corrections by Field */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-violet-600" />
                      Corrections by Field
                    </CardTitle>
                    <CardDescription>
                      Fields where the AI has learned from user corrections
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(data?.learning?.correctionsByField ?? {})
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 10)
                        .map(([field, count]) => {
                          const max = Math.max(...Object.values(data?.learning?.correctionsByField ?? {}));
                          return (
                            <div key={field} className="flex items-center gap-3">
                              <span className="text-xs text-slate-600 w-32 truncate font-medium">{field}</span>
                              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-violet-400 to-indigo-500 rounded-full"
                                  style={{ width: `${(count / max) * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-500 w-8 text-right">{count}</span>
                            </div>
                          );
                        })}
                      {Object.keys(data?.learning?.correctionsByField ?? {}).length === 0 && (
                        <p className="text-sm text-slate-400 text-center py-4">No corrections recorded yet</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Corrections by Type */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Brain className="h-4 w-4 text-violet-600" />
                      Correction Types
                    </CardTitle>
                    <CardDescription>
                      Breakdown of what kinds of corrections agents learned
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(data?.learning?.correctionsByType ?? {})
                        .sort(([, a], [, b]) => b - a)
                        .map(([type, count]) => (
                          <div key={type} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs capitalize">
                                {type}
                              </Badge>
                            </div>
                            <span className="text-sm font-medium text-slate-700">{count}</span>
                          </div>
                        ))}
                      {Object.keys(data?.learning?.correctionsByType ?? {}).length === 0 && (
                        <p className="text-sm text-slate-400 text-center py-4">No correction types yet</p>
                      )}
                    </div>

                    {/* Recent records */}
                    <div className="mt-6 border-t pt-4">
                      <h4 className="text-xs font-medium text-slate-500 mb-2">Recent Learning Records</h4>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {data?.learning?.records.slice(0, 10).map(rec => (
                          <div key={rec.id} className="flex items-center justify-between text-xs py-1">
                            <span className="text-slate-700 font-medium truncate">{rec.field}</span>
                            <span className="text-slate-400">{timeAgo(rec.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Quality Tab */}
            <TabsContent value="quality">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-600" />
                    Adaptive Quality Thresholds
                  </CardTitle>
                  <CardDescription>
                    Quality thresholds that agents automatically adjust based on feedback
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {data?.qualityThresholds.map(qt => {
                      const thresholds = qt.thresholds as Record<string, number>;
                      const prev = qt.previousThresholds as Record<string, number> | null;
                      return (
                        <div key={qt.id} className="p-4 rounded-lg border border-slate-100 bg-slate-50/50">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs font-medium">
                                {qt.artifactType}
                              </Badge>
                              {qt.adjustmentMagnitude != null && qt.adjustmentMagnitude > 0 && (
                                <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                                  Adjusted by {(qt.adjustmentMagnitude * 100).toFixed(0)}%
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-slate-400">Updated {timeAgo(qt.updatedAt)}</span>
                          </div>

                          <div className="grid grid-cols-5 gap-3">
                            {Object.entries(thresholds).map(([key, value]) => {
                              const prevVal = prev?.[key];
                              const delta = prevVal != null ? value - prevVal : null;
                              return (
                                <div key={key} className="text-center">
                                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{key}</div>
                                  <div className="text-lg font-bold text-slate-800">
                                    {typeof value === 'number' ? (value * 100).toFixed(0) : value}%
                                  </div>
                                  {delta != null && delta !== 0 && (
                                    <div className={`text-[10px] font-medium ${delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                      {delta > 0 ? '+' : ''}{(delta * 100).toFixed(1)}%
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {qt.adjustmentReason && (
                            <p className="mt-2 text-xs text-slate-500 italic">
                              {qt.adjustmentReason}
                            </p>
                          )}
                        </div>
                      );
                    })}
                    {(!data?.qualityThresholds || data.qualityThresholds.length === 0) && (
                      <p className="text-sm text-slate-400 text-center py-8">
                        No quality thresholds configured yet
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Recommendations/Insights Tab */}
            <TabsContent value="recommendations">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Recommendations */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-600" />
                      Agent Recommendations
                    </CardTitle>
                    <CardDescription>
                      AI-generated recommendations for contract management
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {data?.recommendations.map(rec => (
                        <div key={rec.id} className="p-3 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                          <div className="flex items-start justify-between mb-1">
                            <p className="text-sm font-medium text-slate-900 pr-2">{rec.title}</p>
                            <Badge className={`text-[10px] shrink-0 ${priorityColor(rec.priority)}`}>
                              {rec.priority}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-2">{rec.description}</p>
                          <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                            <span>{rec.type}</span>
                            <span>·</span>
                            <span>Confidence: {Math.round(Number(rec.confidence) * 100)}%</span>
                            <span>·</span>
                            <span>{timeAgo(rec.createdAt)}</span>
                          </div>
                        </div>
                      ))}
                      {(!data?.recommendations || data.recommendations.length === 0) && (
                        <p className="text-sm text-slate-400 text-center py-4">No recommendations yet</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Opportunities */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                      Discovered Opportunities
                    </CardTitle>
                    <CardDescription>
                      Cost savings and optimization opportunities found by agents
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {data?.opportunities.map(opp => (
                        <div key={opp.id} className="p-3 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                          <div className="flex items-start justify-between mb-1">
                            <p className="text-sm font-medium text-slate-900 pr-2">{opp.title}</p>
                            <span className="text-sm font-bold text-emerald-600 shrink-0">
                              {formatCurrency(Number(opp.potentialValue))}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-2">{opp.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {opp.opportunityType.replace('_', ' ')}
                            </Badge>
                            <Badge variant="outline" className={`text-[10px] ${
                              opp.effort === 'low' ? 'text-emerald-600' :
                              opp.effort === 'high' ? 'text-red-600' :
                              'text-amber-600'
                            }`}>
                              {opp.effort} effort
                            </Badge>
                            <span className="text-[10px] text-slate-400">{timeAgo(opp.createdAt)}</span>
                          </div>
                        </div>
                      ))}
                      {(!data?.opportunities || data.opportunities.length === 0) && (
                        <p className="text-sm text-slate-400 text-center py-4">No opportunities discovered yet</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function OverviewCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub: string;
  color: 'indigo' | 'violet' | 'amber' | 'emerald';
}) {
  const gradients = {
    indigo: 'from-indigo-500 to-blue-600',
    violet: 'from-violet-500 to-purple-600',
    amber: 'from-amber-500 to-orange-600',
    emerald: 'from-emerald-500 to-teal-600',
  };
  const shadows = {
    indigo: 'shadow-indigo-500/20',
    violet: 'shadow-violet-500/20',
    amber: 'shadow-amber-500/20',
    emerald: 'shadow-emerald-500/20',
  };

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
          </div>
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradients[color]} flex items-center justify-center shadow-lg ${shadows[color]} text-white`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
