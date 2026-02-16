'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronRight,
  Timer,
  Users,
  Zap,
  RefreshCw,
  Info,
  BarChart3,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface SLADefinition {
  id: string;
  name: string;
  description: string;
  targetHours: number;
  warningThresholdPercent: number; // Warn when this % of time has passed
  category: 'approval' | 'review' | 'processing' | 'response';
}

interface SLAMetric {
  definitionId: string;
  definition: SLADefinition;
  total: number;
  met: number;
  breached: number;
  atRisk: number; // Currently in warning zone
  avgCompletionTime: number; // in hours
  trend: number; // % change from previous period
  recentBreaches: {
    contractId: string;
    contractName: string;
    stepName: string;
    breachTime: string;
    excessHours: number;
  }[];
}

interface StepSLAStatus {
  stepId: string;
  stepName: string;
  slaDefinitionId: string;
  status: 'on-track' | 'at-risk' | 'breached';
  startTime: string;
  targetTime: string;
  currentElapsed: number; // hours
  targetHours: number;
  percentComplete: number;
  assignee?: string;
}

// ============================================================================
// Mock Data
// ============================================================================

const SLA_DEFINITIONS: SLADefinition[] = [
  {
    id: 'initial-review',
    name: 'Initial Review',
    description: 'Time to complete first review after submission',
    targetHours: 24,
    warningThresholdPercent: 75,
    category: 'review',
  },
  {
    id: 'manager-approval',
    name: 'Manager Approval',
    description: 'Time for manager to approve or reject',
    targetHours: 48,
    warningThresholdPercent: 80,
    category: 'approval',
  },
  {
    id: 'legal-review',
    name: 'Legal Review',
    description: 'Time for legal team review',
    targetHours: 72,
    warningThresholdPercent: 70,
    category: 'review',
  },
  {
    id: 'executive-signoff',
    name: 'Executive Sign-off',
    description: 'Time for executive final approval',
    targetHours: 96,
    warningThresholdPercent: 75,
    category: 'approval',
  },
  {
    id: 'counterparty-response',
    name: 'Counterparty Response',
    description: 'Expected response time from counterparty',
    targetHours: 120,
    warningThresholdPercent: 80,
    category: 'response',
  },
];



// ============================================================================
// Components
// ============================================================================

/**
 * Circular progress indicator for SLA compliance
 */
const SLACircularProgress: React.FC<{
  percentage: number;
  size?: number;
  strokeWidth?: number;
}> = ({ percentage, size = 80, strokeWidth = 8 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;

  const getColor = () => {
    if (percentage >= 90) return '#22c55e'; // green
    if (percentage >= 75) return '#eab308'; // yellow
    return '#ef4444'; // red
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ strokeDasharray: circumference }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold" style={{ color: getColor() }}>
          {Math.round(percentage)}%
        </span>
      </div>
    </div>
  );
};

/**
 * Individual SLA metric card
 */
const SLAMetricCard: React.FC<{
  metric: SLAMetric;
  onViewDetails?: (metric: SLAMetric) => void;
}> = ({ metric, onViewDetails: _onViewDetails }) => {
  const [expanded, setExpanded] = useState(false);
  const complianceRate = metric.total > 0 ? (metric.met / metric.total) * 100 : 0;

  const statusColor = complianceRate >= 90
    ? 'bg-green-50 border-green-200'
    : complianceRate >= 75
      ? 'bg-amber-50 border-amber-200'
      : 'bg-red-50 border-red-200';

  return (
    <motion.div
      layout
      className={`rounded-xl border p-4 ${statusColor} transition-colors`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900">{metric.definition.name}</h3>
          <p className="text-sm text-slate-500 mt-0.5">{metric.definition.description}</p>

          {/* Stats Row */}
          <div className="flex items-center gap-4 mt-3">
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">{metric.met}</div>
              <div className="text-xs text-slate-500">Met</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-amber-600">{metric.atRisk}</div>
              <div className="text-xs text-slate-500">At Risk</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-red-600">{metric.breached}</div>
              <div className="text-xs text-slate-500">Breached</div>
            </div>
          </div>

          {/* Average Time */}
          <div className="flex items-center gap-2 mt-3 text-sm text-slate-600">
            <Timer className="w-4 h-4" />
            Avg: {metric.avgCompletionTime}h / {metric.definition.targetHours}h target
            <span className={`flex items-center gap-0.5 ml-2 ${metric.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {metric.trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(metric.trend)}%
            </span>
          </div>
        </div>

        <SLACircularProgress percentage={complianceRate} />
      </div>

      {/* Recent Breaches */}
      {metric.recentBreaches.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 mt-3 text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            <AlertTriangle className="w-4 h-4 text-red-500" />
            {metric.recentBreaches.length} recent breach{metric.recentBreaches.length > 1 ? 'es' : ''}
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div key="expanded"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-2">
                  {metric.recentBreaches.map((breach, idx) => (
                    <div key={idx} className="bg-white/50 rounded-lg p-2 text-sm">
                      <div className="font-medium text-slate-900">{breach.contractName}</div>
                      <div className="text-slate-500">
                        {breach.stepName} • +{breach.excessHours}h over • {breach.breachTime}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
};

/**
 * Active workflow step SLA status
 */
const ActiveStepSLAStatus: React.FC<{ step: StepSLAStatus }> = ({ step }) => {
  const getStatusStyles = () => {
    switch (step.status) {
      case 'on-track':
        return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: CheckCircle2 };
      case 'at-risk':
        return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: AlertTriangle };
      case 'breached':
        return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: XCircle };
    }
  };

  const styles = getStatusStyles();
  const Icon = styles.icon;

  return (
    <div className={`rounded-lg border p-3 ${styles.bg} ${styles.border}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${styles.text}`} />
          <span className="font-medium text-slate-900">{step.stepName}</span>
        </div>
        <span className={`text-sm font-medium ${styles.text} capitalize`}>{step.status.replace('-', ' ')}</span>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-white rounded-full overflow-hidden mb-2">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(step.percentComplete, 100)}%` }}
          transition={{ duration: 0.8 }}
          className={`h-full rounded-full ${
            step.status === 'on-track' ? 'bg-green-500' :
            step.status === 'at-risk' ? 'bg-amber-500' : 'bg-red-500'
          }`}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>{step.currentElapsed}h elapsed of {step.targetHours}h</span>
        {step.assignee && (
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {step.assignee}
          </span>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const SLAComplianceVisualization: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Real data state
  const [slaMetrics, setSlaMetrics] = useState<SLAMetric[]>([]);
  const [activeSteps, setActiveSteps] = useState<StepSLAStatus[]>([]);
  const [apiMetrics, setApiMetrics] = useState<any>(null);

  const fetchSLAData = useCallback(async () => {
    try {
      const [overviewRes, stepsRes] = await Promise.all([
        fetch(`/api/workflows/sla?type=overview&timeRange=${timeRange}`),
        fetch(`/api/workflows/sla?type=active-steps`),
      ]);
      const overview = await overviewRes.json();
      const steps = await stepsRes.json();

      if (overview.success) {
        setApiMetrics(overview.data.metrics);
        // Map step breakdown to SLAMetric shape
        const mapped: SLAMetric[] = (overview.data.stepBreakdown || []).map((s: any) => ({
          definitionId: s.step_name,
          definition: {
            id: s.step_name,
            name: s.step_name,
            description: `${s.step_type || 'Step'} performance`,
            targetHours: 48,
            warningThresholdPercent: 75,
            category: (s.step_type || 'processing').toLowerCase() as any,
          },
          total: s.total,
          met: s.completed,
          breached: s.breached,
          atRisk: s.active,
          avgCompletionTime: s.avg_duration_seconds ? Math.round(s.avg_duration_seconds / 3600) : 0,
          trend: 0,
          recentBreaches: (overview.data.activeBreaches || [])
            .filter((b: any) => b.step_name === s.step_name)
            .slice(0, 3)
            .map((b: any) => ({
              contractId: b.contract_id || '',
              contractName: b.workflow_name || b.contract_id || 'Unknown',
              stepName: b.step_name,
              breachTime: b.overdue_seconds ? `${Math.round(b.overdue_seconds / 3600)}h ago` : 'recently',
              excessHours: b.overdue_seconds ? Math.round(b.overdue_seconds / 3600) : 0,
            })),
        }));
        setSlaMetrics(mapped);
      } else {
        setSlaMetrics([]);
      }

      if (steps.success && steps.data.activeSteps?.length > 0) {
        const mappedSteps: StepSLAStatus[] = steps.data.activeSteps.map((s: any) => ({
          stepId: s.id,
          stepName: s.step_name,
          slaDefinitionId: s.step_type,
          status: s.sla_status === 'BREACHED' ? 'breached' : s.sla_status === 'AT_RISK' ? 'at-risk' : 'on-track',
          startTime: s.started_at,
          targetTime: s.sla_deadline || new Date(Date.now() + 86400000).toISOString(),
          currentElapsed: s.seconds_remaining ? Math.max(0, Math.round(-s.seconds_remaining / 3600)) || 0 : 0,
          targetHours: s.sla_deadline ? Math.round((new Date(s.sla_deadline).getTime() - new Date(s.started_at).getTime()) / 3600000) : 48,
          percentComplete: s.seconds_remaining != null
            ? Math.round(Math.max(0, (1 - s.seconds_remaining / Math.max(1, new Date(s.sla_deadline || Date.now()).getTime() - new Date(s.started_at).getTime()) * 1000) * 100))
            : 50,
          assignee: s.assignee_id || 'Unassigned',
        }));
        setActiveSteps(mappedSteps);
      } else {
        setActiveSteps([]);
      }
    } catch {
      setSlaMetrics([]);
      setActiveSteps([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [timeRange]);

  useEffect(() => { fetchSLAData(); }, [fetchSLAData]);

  // Aggregate stats
  const overallStats = useMemo(() => {
    const totalMet = slaMetrics.reduce((sum, m) => sum + m.met, 0);
    const totalBreached = slaMetrics.reduce((sum, m) => sum + m.breached, 0);
    const totalAtRisk = slaMetrics.reduce((sum, m) => sum + m.atRisk, 0);
    const total = slaMetrics.reduce((sum, m) => sum + m.total, 0);
    const overallCompliance = total > 0 ? (totalMet / total) * 100 : 0;

    return { totalMet, totalBreached, totalAtRisk, total, overallCompliance };
  }, [slaMetrics]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchSLAData();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Target className="w-7 h-7 text-violet-600" />
            SLA Compliance
          </h2>
          <p className="text-slate-500 mt-1">Monitor service level agreement performance</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time Range */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {(['7d', '30d', '90d'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  timeRange === range
                    ? 'bg-white text-violet-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4"
        >
          <SLACircularProgress percentage={overallStats.overallCompliance} size={64} strokeWidth={6} />
          <div>
            <div className="text-2xl font-bold text-slate-900">{Math.round(overallStats.overallCompliance)}%</div>
            <div className="text-sm text-slate-500">Overall Compliance</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-green-50 rounded-xl border border-green-200 p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-700">SLAs Met</span>
          </div>
          <div className="text-2xl font-bold text-green-700">{overallStats.totalMet}</div>
          <div className="text-sm text-green-600">{Math.round((overallStats.totalMet / overallStats.total) * 100)}% of total</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-amber-50 rounded-xl border border-amber-200 p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span className="text-sm font-medium text-amber-700">At Risk</span>
          </div>
          <div className="text-2xl font-bold text-amber-700">{overallStats.totalAtRisk}</div>
          <div className="text-sm text-amber-600">Approaching deadline</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-red-50 rounded-xl border border-red-200 p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium text-red-700">Breached</span>
          </div>
          <div className="text-2xl font-bold text-red-700">{overallStats.totalBreached}</div>
          <div className="text-sm text-red-600">Exceeded target</div>
        </motion.div>
      </div>

      {/* Active Steps Monitoring */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          Active Workflow Steps
          <span className="ml-2 px-2 py-0.5 bg-slate-100 rounded-full text-xs text-slate-600">
            {activeSteps.length} in progress
          </span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {activeSteps.map(step => (
            <ActiveStepSLAStatus key={step.stepId} step={step} />
          ))}
        </div>
      </div>

      {/* SLA Metrics by Type */}
      <div>
        <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-violet-500" />
          SLA Performance by Type
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {slaMetrics.map(metric => (
            <SLAMetricCard key={metric.definitionId} metric={metric} />
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl border border-indigo-200 p-5">
        <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Info className="w-5 h-5 text-violet-600" />
          AI Recommendations to Improve SLA Compliance
        </h3>
        <div className="space-y-3">
          <div className="bg-white/80 rounded-lg p-3 flex items-start gap-3">
            <div className="p-1.5 bg-red-100 rounded-lg shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <div className="font-medium text-slate-900">Legal Review Bottleneck</div>
              <p className="text-sm text-slate-600">Legal Review has the lowest compliance at 80%. Consider adding parallel reviewers or tiered review based on contract complexity.</p>
            </div>
          </div>
          <div className="bg-white/80 rounded-lg p-3 flex items-start gap-3">
            <div className="p-1.5 bg-amber-100 rounded-lg shrink-0">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <div className="font-medium text-slate-900">Proactive Escalation</div>
              <p className="text-sm text-slate-600">3 items are currently at risk. Set up automated escalation when items reach 70% of SLA time.</p>
            </div>
          </div>
          <div className="bg-white/80 rounded-lg p-3 flex items-start gap-3">
            <div className="p-1.5 bg-green-100 rounded-lg shrink-0">
              <TrendingUp className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <div className="font-medium text-slate-900">Initial Review Excellence</div>
              <p className="text-sm text-slate-600">Initial Review has 95% compliance. Document and share best practices with other teams.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SLAComplianceVisualization;
