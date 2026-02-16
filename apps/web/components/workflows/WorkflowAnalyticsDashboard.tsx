'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Activity,
  Zap,
  Timer,
  Target,
  ArrowRight,
  RefreshCw,
  Download,
  Layers,
  AlertCircle,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface WorkflowMetrics {
  templateId: string;
  templateName: string;
  totalExecutions: number;
  completed: number;
  pending: number;
  failed: number;
  avgCompletionTime: number; // in hours
  avgApprovalTime: number; // in hours
  slaCompliance: number; // percentage
  bottleneckStep?: string;
  bottleneckAvgTime?: number;
}

interface StepMetrics {
  stepId: string;
  stepName: string;
  avgTime: number; // in hours
  minTime: number;
  maxTime: number;
  completionRate: number;
  slaBreaches: number;
  pendingCount: number;
  topApprover?: string;
}

interface TimeRange {
  label: string;
  value: '7d' | '30d' | '90d' | '1y';
}

// ============================================================================
// Mock Data Generator
// ============================================================================

const generateMockWorkflowMetrics = (): WorkflowMetrics[] => [
  {
    templateId: 'standard',
    templateName: 'Standard Review',
    totalExecutions: 156,
    completed: 142,
    pending: 12,
    failed: 2,
    avgCompletionTime: 72,
    avgApprovalTime: 24,
    slaCompliance: 91,
    bottleneckStep: 'Legal Review',
    bottleneckAvgTime: 36,
  },
  {
    templateId: 'express',
    templateName: 'Express Approval',
    totalExecutions: 89,
    completed: 85,
    pending: 4,
    failed: 0,
    avgCompletionTime: 8,
    avgApprovalTime: 4,
    slaCompliance: 98,
  },
  {
    templateId: 'legal',
    templateName: 'Legal Review',
    totalExecutions: 67,
    completed: 54,
    pending: 11,
    failed: 2,
    avgCompletionTime: 120,
    avgApprovalTime: 48,
    slaCompliance: 76,
    bottleneckStep: 'External Counsel',
    bottleneckAvgTime: 72,
  },
  {
    templateId: 'executive',
    templateName: 'Executive Approval',
    totalExecutions: 34,
    completed: 28,
    pending: 5,
    failed: 1,
    avgCompletionTime: 96,
    avgApprovalTime: 36,
    slaCompliance: 82,
    bottleneckStep: 'C-Suite Review',
    bottleneckAvgTime: 48,
  },
  {
    templateId: 'nda_fast_track',
    templateName: 'NDA Fast Track',
    totalExecutions: 203,
    completed: 198,
    pending: 5,
    failed: 0,
    avgCompletionTime: 4,
    avgApprovalTime: 2,
    slaCompliance: 99,
  },
  {
    templateId: 'vendor_onboarding',
    templateName: 'Vendor Onboarding',
    totalExecutions: 45,
    completed: 38,
    pending: 6,
    failed: 1,
    avgCompletionTime: 168,
    avgApprovalTime: 72,
    slaCompliance: 68,
    bottleneckStep: 'Vendor Qualification',
    bottleneckAvgTime: 96,
  },
];

const generateMockStepMetrics = (): StepMetrics[] => [
  {
    stepId: '1',
    stepName: 'Initial Submission',
    avgTime: 1,
    minTime: 0.5,
    maxTime: 4,
    completionRate: 100,
    slaBreaches: 0,
    pendingCount: 0,
  },
  {
    stepId: '2',
    stepName: 'Manager Review',
    avgTime: 8,
    minTime: 2,
    maxTime: 24,
    completionRate: 98,
    slaBreaches: 3,
    pendingCount: 5,
    topApprover: 'Sarah Manager',
  },
  {
    stepId: '3',
    stepName: 'Legal Review',
    avgTime: 36,
    minTime: 12,
    maxTime: 96,
    completionRate: 94,
    slaBreaches: 12,
    pendingCount: 8,
    topApprover: 'James Legal',
  },
  {
    stepId: '4',
    stepName: 'Finance Approval',
    avgTime: 16,
    minTime: 4,
    maxTime: 48,
    completionRate: 96,
    slaBreaches: 5,
    pendingCount: 4,
    topApprover: 'Lisa Finance',
  },
  {
    stepId: '5',
    stepName: 'Final Sign-off',
    avgTime: 4,
    minTime: 1,
    maxTime: 12,
    completionRate: 99,
    slaBreaches: 1,
    pendingCount: 2,
    topApprover: 'CEO Office',
  },
];

// ============================================================================
// Components
// ============================================================================

const TIME_RANGES: TimeRange[] = [
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
  { label: '90 Days', value: '90d' },
  { label: '1 Year', value: '1y' },
];

/**
 * Mini progress bar for visualizing completion rates
 */
const ProgressBar: React.FC<{ value: number; color: string; label?: string }> = ({ value, color, label }) => (
  <div className="w-full">
    {label && <div className="text-xs text-slate-500 mb-1">{label}</div>}
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, value)}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className={`h-full rounded-full ${color}`}
      />
    </div>
  </div>
);

/**
 * Stat card for key metrics
 */
const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: { value: number; isPositive: boolean };
  color: string;
}> = ({ title, value, subtitle, icon: Icon, trend, color }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg hover:border-slate-300 transition-all"
  >
    <div className="flex items-center justify-between mb-3">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {trend.isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {Math.abs(trend.value)}%
        </div>
      )}
    </div>
    <div className="text-2xl font-bold text-slate-900">{value}</div>
    <div className="text-sm text-slate-500 mt-1">{title}</div>
    {subtitle && <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div>}
  </motion.div>
);

/**
 * Workflow card showing detailed metrics for each workflow template
 */
const WorkflowCard: React.FC<{ metrics: WorkflowMetrics }> = ({ metrics }) => {
  const _completionRate = metrics.totalExecutions > 0 
    ? Math.round((metrics.completed / metrics.totalExecutions) * 100) 
    : 0;

  const slaColor = metrics.slaCompliance >= 90 
    ? 'bg-green-500' 
    : metrics.slaCompliance >= 75 
      ? 'bg-amber-500' 
      : 'bg-red-500';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.01 }}
      className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-all"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-900">{metrics.templateName}</h3>
          <p className="text-sm text-slate-500">{metrics.totalExecutions} total executions</p>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-xs font-medium text-white ${slaColor}`}>
          {metrics.slaCompliance}% SLA
        </div>
      </div>

      {/* Status Distribution */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden flex">
          <div 
            className="bg-green-500 h-full" 
            style={{ width: `${(metrics.completed / metrics.totalExecutions) * 100}%` }}
          />
          <div 
            className="bg-amber-500 h-full" 
            style={{ width: `${(metrics.pending / metrics.totalExecutions) * 100}%` }}
          />
          <div 
            className="bg-red-500 h-full" 
            style={{ width: `${(metrics.failed / metrics.totalExecutions) * 100}%` }}
          />
        </div>
      </div>

      {/* Status Legend */}
      <div className="flex items-center justify-between text-xs mb-4">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-slate-600">{metrics.completed} completed</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-slate-600">{metrics.pending} pending</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-slate-600">{metrics.failed} failed</span>
        </span>
      </div>

      {/* Timing Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
            <Clock className="w-3.5 h-3.5" />
            Avg. Completion
          </div>
          <div className="font-semibold text-slate-900">
            {metrics.avgCompletionTime < 24 
              ? `${metrics.avgCompletionTime}h` 
              : `${Math.round(metrics.avgCompletionTime / 24)}d`}
          </div>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
            <Timer className="w-3.5 h-3.5" />
            Avg. Approval
          </div>
          <div className="font-semibold text-slate-900">
            {metrics.avgApprovalTime < 24 
              ? `${metrics.avgApprovalTime}h` 
              : `${Math.round(metrics.avgApprovalTime / 24)}d`}
          </div>
        </div>
      </div>

      {/* Bottleneck Warning */}
      {metrics.bottleneckStep && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-medium text-amber-900">Bottleneck Detected</div>
            <div className="text-xs text-amber-700">
              {metrics.bottleneckStep} averaging {metrics.bottleneckAvgTime}h
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

/**
 * Step metrics table showing detailed analysis of each workflow step
 */
const StepMetricsTable: React.FC<{ steps: StepMetrics[] }> = ({ steps }) => (
  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
    <div className="px-5 py-4 border-b border-slate-200">
      <h3 className="font-semibold text-slate-900 flex items-center gap-2">
        <Layers className="w-5 h-5 text-violet-500" />
        Step-by-Step Analysis
      </h3>
      <p className="text-sm text-slate-500 mt-1">Detailed metrics for each workflow step</p>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Step</th>
            <th className="px-5 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Avg Time</th>
            <th className="px-5 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Min/Max</th>
            <th className="px-5 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Completion</th>
            <th className="px-5 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">SLA Breaches</th>
            <th className="px-5 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Pending</th>
            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Top Approver</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {steps.map((step, index) => {
            const isBottleneck = step.avgTime > 24;
            return (
              <motion.tr
                key={step.stepId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`hover:bg-slate-50 ${isBottleneck ? 'bg-amber-50/50' : ''}`}
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      isBottleneck ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">{step.stepName}</div>
                      {isBottleneck && (
                        <div className="flex items-center gap-1 text-xs text-amber-600 mt-0.5">
                          <AlertCircle className="w-3 h-3" />
                          Potential bottleneck
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-center">
                  <span className={`font-semibold ${isBottleneck ? 'text-amber-600' : 'text-slate-900'}`}>
                    {step.avgTime < 24 ? `${step.avgTime}h` : `${Math.round(step.avgTime / 24)}d`}
                  </span>
                </td>
                <td className="px-5 py-4 text-center text-sm text-slate-500">
                  {step.minTime}h - {step.maxTime}h
                </td>
                <td className="px-5 py-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-16">
                      <ProgressBar 
                        value={step.completionRate} 
                        color={step.completionRate >= 95 ? 'bg-green-500' : step.completionRate >= 85 ? 'bg-amber-500' : 'bg-red-500'} 
                      />
                    </div>
                    <span className="text-sm font-medium text-slate-700">{step.completionRate}%</span>
                  </div>
                </td>
                <td className="px-5 py-4 text-center">
                  {step.slaBreaches > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                      <AlertTriangle className="w-3 h-3" />
                      {step.slaBreaches}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      <CheckCircle2 className="w-3 h-3" />
                      0
                    </span>
                  )}
                </td>
                <td className="px-5 py-4 text-center">
                  {step.pendingCount > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      <Clock className="w-3 h-3" />
                      {step.pendingCount}
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  {step.topApprover ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-xs font-medium">
                        {step.topApprover.charAt(0)}
                      </div>
                      <span className="text-sm text-slate-700">{step.topApprover}</span>
                    </div>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export const WorkflowAnalyticsDashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [_selectedWorkflow, _setSelectedWorkflow] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mock data - in production, fetch from API
  const workflowMetrics = useMemo(() => generateMockWorkflowMetrics(), []);
  const stepMetrics = useMemo(() => generateMockStepMetrics(), []);

  // Aggregate statistics
  const stats = useMemo(() => {
    const totalExecutions = workflowMetrics.reduce((sum, w) => sum + w.totalExecutions, 0);
    const totalCompleted = workflowMetrics.reduce((sum, w) => sum + w.completed, 0);
    const totalPending = workflowMetrics.reduce((sum, w) => sum + w.pending, 0);
    const avgSlaCompliance = Math.round(workflowMetrics.reduce((sum, w) => sum + w.slaCompliance, 0) / workflowMetrics.length);
    const avgCompletionTime = Math.round(workflowMetrics.reduce((sum, w) => sum + w.avgCompletionTime, 0) / workflowMetrics.length);
    const bottlenecks = workflowMetrics.filter(w => w.bottleneckStep).length;

    return { totalExecutions, totalCompleted, totalPending, avgSlaCompliance, avgCompletionTime, bottlenecks };
  }, [workflowMetrics]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-violet-600" />
            Workflow Analytics
          </h2>
          <p className="text-slate-500 mt-1">Monitor workflow performance and identify bottlenecks</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {TIME_RANGES.map(range => (
              <button
                key={range.value}
                onClick={() => setTimeRange(range.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  timeRange === range.value
                    ? 'bg-white text-violet-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          
          {/* Actions */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
            <Download className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Total Workflows"
          value={stats.totalExecutions}
          icon={Activity}
          color="bg-violet-500"
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Completed"
          value={stats.totalCompleted}
          icon={CheckCircle2}
          color="bg-green-500"
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard
          title="Pending"
          value={stats.totalPending}
          icon={Clock}
          color="bg-amber-500"
          trend={{ value: 3, isPositive: false }}
        />
        <StatCard
          title="SLA Compliance"
          value={`${stats.avgSlaCompliance}%`}
          icon={Target}
          color="bg-violet-500"
          trend={{ value: 2, isPositive: true }}
        />
        <StatCard
          title="Avg. Completion"
          value={stats.avgCompletionTime < 24 ? `${stats.avgCompletionTime}h` : `${Math.round(stats.avgCompletionTime / 24)}d`}
          icon={Timer}
          color="bg-violet-500"
          trend={{ value: 5, isPositive: true }}
        />
        <StatCard
          title="Bottlenecks"
          value={stats.bottlenecks}
          subtitle={`of ${workflowMetrics.length} workflows`}
          icon={AlertTriangle}
          color={stats.bottlenecks > 2 ? 'bg-red-500' : 'bg-amber-500'}
        />
      </div>

      {/* Workflow Cards */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Workflow Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflowMetrics.map(metrics => (
            <WorkflowCard key={metrics.templateId} metrics={metrics} />
          ))}
        </div>
      </div>

      {/* Step Analysis */}
      <StepMetricsTable steps={stepMetrics} />

      {/* Recommendations */}
      <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl border border-indigo-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-violet-600" />
          AI Recommendations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/80 rounded-lg p-4 border border-indigo-100">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h4 className="font-medium text-slate-900">Legal Review Bottleneck</h4>
                <p className="text-sm text-slate-600 mt-1">
                  Legal Review step is averaging 36h - consider adding parallel reviewers or implementing tiered review based on contract value.
                </p>
                <button className="mt-2 text-sm text-violet-600 font-medium hover:text-violet-700 flex items-center gap-1">
                  View suggestions <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="bg-white/80 rounded-lg p-4 border border-indigo-100">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium text-slate-900">Express Approval Success</h4>
                <p className="text-sm text-slate-600 mt-1">
                  NDA Fast Track and Express workflows show 98%+ SLA compliance. Consider routing more low-value contracts through these paths.
                </p>
                <button className="mt-2 text-sm text-violet-600 font-medium hover:text-violet-700 flex items-center gap-1">
                  Optimize routing <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowAnalyticsDashboard;
