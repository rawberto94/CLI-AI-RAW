'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Zap,
  CheckCircle2,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Activity,
  ArrowRight,
  Clock,
  Shield,
  FileText,
  Eye,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useDataMode } from '@/contexts/DataModeContext';

// ============================================================================
// Shared Loading Skeleton
// ============================================================================

function WidgetSkeleton({ color = 'purple' }: { color?: string }) {
  return (
    <div className={`bg-gradient-to-br from-${color}-50 via-${color}-50/50 to-slate-50 rounded-xl border border-${color}-100 p-5 animate-pulse`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`p-2 bg-${color}-200 rounded-lg w-9 h-9`} />
          <div>
            <div className="h-4 w-32 bg-slate-200 rounded mb-1" />
            <div className="h-3 w-24 bg-slate-100 rounded" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="p-3 bg-white/60 rounded-lg">
            <div className="h-6 w-8 bg-slate-200 rounded mx-auto mb-1" />
            <div className="h-3 w-12 bg-slate-100 rounded mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Intelligence Summary Widget
// ============================================================================

interface HealthSummary {
  healthy: number;
  atRisk: number;
  critical: number;
  avgScore: number;
}

interface IntelligenceWidgetProps {
  healthSummary?: HealthSummary;
}

export function IntelligenceWidget({ 
  healthSummary: initialData
}: IntelligenceWidgetProps) {
  const { isMockData } = useDataMode();
  const [healthSummary, setHealthSummary] = useState<HealthSummary>(
    initialData ?? { healthy: 0, atRisk: 0, critical: 0, avgScore: 0 }
  );
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) return;
    
    async function fetchData() {
      try {
        const res = await fetch('/api/intelligence/health');
        const json = await res.json();
        if (json.success && json.data?.stats) {
          setHealthSummary({
            healthy: json.data.stats.healthy ?? 0,
            atRisk: json.data.stats.atRisk ?? 0,
            critical: json.data.stats.critical ?? 0,
            avgScore: json.data.stats.averageScore ?? 0,
          });
        } else {
          // No data - show zeros
          setHealthSummary({ healthy: 0, atRisk: 0, critical: 0, avgScore: 0 });
        }
      } catch (err) {
        setError('Failed to load');
        setHealthSummary({ healthy: 0, atRisk: 0, critical: 0, avgScore: 0 });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [initialData]);

  if (loading) {
    return <WidgetSkeleton color="purple" />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-purple-50 via-purple-50 to-purple-50 rounded-xl border border-purple-100 p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-purple-500 rounded-lg">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Contract Intelligence</h3>
            <p className="text-xs text-slate-500">AI-powered insights</p>
          </div>
        </div>
        <Link
          href="/intelligence"
          className="px-3 py-1.5 text-xs font-medium bg-white/80 text-purple-700 rounded-lg hover:bg-white transition-colors flex items-center gap-1"
        >
          View All <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="text-center p-3 bg-white/60 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">{healthSummary.avgScore}</div>
          <div className="text-xs text-slate-500">Avg Score</div>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{healthSummary.healthy}</div>
          <div className="text-xs text-green-600">Healthy</div>
        </div>
        <div className="text-center p-3 bg-amber-50 rounded-lg">
          <div className="text-2xl font-bold text-amber-600">{healthSummary.atRisk}</div>
          <div className="text-xs text-amber-600">At Risk</div>
        </div>
        <div className="text-center p-3 bg-red-50 rounded-lg">
          <div className="text-2xl font-bold text-red-600">{healthSummary.critical}</div>
          <div className="text-xs text-red-600">Critical</div>
        </div>
      </div>

      <div className="flex gap-2">
        <Link 
          href="/intelligence/health"
          className="flex-1 px-3 py-2 text-sm font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
        >
          <Activity className="h-4 w-4" />
          Health Scores
        </Link>
        <Link 
          href="/intelligence/search"
          className="flex-1 px-3 py-2 text-sm font-medium bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
        >
          <Eye className="h-4 w-4" />
          AI Search
        </Link>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Approvals Widget
// ============================================================================

interface ApprovalItem {
  id: string;
  title: string;
  type: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  dueDate: string;
}

interface ApprovalsWidgetProps {
  pendingCount?: number;
  urgentCount?: number;
  items?: ApprovalItem[];
}

export function ApprovalsWidget({
  pendingCount: initialPending,
  urgentCount: initialUrgent,
  items: initialItems,
}: ApprovalsWidgetProps) {
  const { isMockData } = useDataMode();
  const [data, setData] = useState({
    pendingCount: initialPending ?? 0,
    urgentCount: initialUrgent ?? 0,
    items: initialItems ?? [],
  });
  const [loading, setLoading] = useState(!initialPending);

  useEffect(() => {
    if (initialPending !== undefined) return;
    
    async function fetchData() {
      try {
        const res = await fetch('/api/approvals');
        const json = await res.json();
        if (json.success && json.data) {
          const approvals = json.data.items || json.data.approvals || [];
          const stats = json.data.stats || {};
          setData({
            pendingCount: stats.pending ?? approvals.filter((a: any) => a.status === 'pending').length,
            urgentCount: stats.critical ?? approvals.filter((a: any) => a.priority === 'critical' || a.priority === 'urgent').length,
            items: approvals.slice(0, 3).map((a: any) => ({
              id: a.id,
              title: a.title || a.contractName,
              type: a.type,
              priority: a.priority,
              dueDate: a.dueDate?.split('T')[0] || 'N/A',
            })),
          });
        } else {
          setData({ pendingCount: 0, urgentCount: 0, items: [] });
        }
      } catch {
        setData({ pendingCount: 0, urgentCount: 0, items: [] });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [initialPending]);

  if (loading) {
    return <WidgetSkeleton color="amber" />;
  }

  const { pendingCount, urgentCount, items } = data;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 rounded-xl border border-amber-100 p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg">
            <CheckCircle2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Pending Approvals</h3>
            <p className="text-xs text-slate-500">{pendingCount} items awaiting action</p>
          </div>
        </div>
        {urgentCount > 0 && (
          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {urgentCount} Urgent
          </span>
        )}
      </div>

      <div className="space-y-2 mb-4">
        {items.slice(0, 2).map((item) => (
          <Link
            key={item.id}
            href={`/approvals?id=${item.id}`}
            className="block p-3 bg-white/70 rounded-lg hover:bg-white transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {item.priority === 'urgent' && (
                  <span className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                )}
                <span className="text-sm font-medium text-slate-900 group-hover:text-amber-700">{item.title}</span>
              </div>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {item.dueDate}
              </span>
            </div>
          </Link>
        ))}
      </div>

      <Link
        href="/approvals"
        className="block w-full px-3 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-center"
      >
        Review All Approvals
      </Link>
    </motion.div>
  );
}

// ============================================================================
// Renewals Widget
// ============================================================================

interface RenewalItem {
  id: string;
  contractName: string;
  daysUntil: number;
  value: number;
  autoRenewal: boolean;
}

interface RenewalsWidgetProps {
  upcomingCount?: number;
  urgentCount?: number;
  items?: RenewalItem[];
}

export function RenewalsWidget({
  upcomingCount: initialUpcoming,
  urgentCount: initialUrgent,
  items: initialItems,
}: RenewalsWidgetProps) {
  const { isMockData } = useDataMode();
  const [data, setData] = useState({
    upcomingCount: initialUpcoming ?? 0,
    urgentCount: initialUrgent ?? 0,
    items: initialItems ?? [],
  });
  const [loading, setLoading] = useState(!initialUpcoming);

  useEffect(() => {
    if (initialUpcoming !== undefined) return;
    
    async function fetchData() {
      try {
        const res = await fetch('/api/renewals');
        const json = await res.json();
        if (json.success && json.data) {
          const renewals = json.data.renewals || [];
          const stats = json.data.stats || {};
          setData({
            upcomingCount: stats.total ?? renewals.length,
            urgentCount: stats.urgent ?? renewals.filter((r: any) => r.daysUntilExpiry <= 30).length,
            items: renewals.slice(0, 3).map((r: any) => ({
              id: r.id || r.contractId,
              contractName: r.contractName || r.name,
              daysUntil: r.daysUntilExpiry,
              value: r.currentValue,
              autoRenewal: r.autoRenewal,
            })),
          });
        } else {
          // No data - show empty state
          setData({ upcomingCount: 0, urgentCount: 0, items: [] });
        }
      } catch {
        setData({ upcomingCount: 0, urgentCount: 0, items: [] });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [initialUpcoming]);

  if (loading) {
    return <WidgetSkeleton color="green" />;
  }

  const { upcomingCount, urgentCount, items } = data;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-gradient-to-br from-violet-50 via-violet-50 to-violet-50 rounded-xl border border-green-100 p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-violet-500 to-violet-500 rounded-lg">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Upcoming Renewals</h3>
            <p className="text-xs text-slate-500">{upcomingCount} contracts to review</p>
          </div>
        </div>
        {urgentCount > 0 && (
          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
            {urgentCount} Due Soon
          </span>
        )}
      </div>

      <div className="space-y-2 mb-4">
        {items.slice(0, 2).map((item) => (
          <Link
            key={item.id}
            href={`/renewals?id=${item.id}`}
            className="block p-3 bg-white/70 rounded-lg hover:bg-white transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 group-hover:text-green-700">{item.contractName}</span>
                  {item.autoRenewal && (
                    <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">Auto</span>
                  )}
                </div>
                <span className="text-xs text-slate-500">${(item.value / 1000).toFixed(0)}K value</span>
              </div>
              <span className={`text-sm font-medium ${item.daysUntil <= 30 ? 'text-red-600' : 'text-slate-600'}`}>
                {item.daysUntil}d
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div className="flex gap-2">
        <Link
          href="/renewals"
          className="flex-1 px-3 py-2 text-sm font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-center"
        >
          View Calendar
        </Link>
        <Link
          href="/forecast"
          className="flex-1 px-3 py-2 text-sm font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
        >
          <TrendingUp className="h-4 w-4" />
          Forecast
        </Link>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Governance Widget
// ============================================================================

interface GovernanceWidgetProps {
  policyViolations?: number;
  pendingReviews?: number;
  complianceScore?: number;
}

export function GovernanceWidget({
  policyViolations: initialViolations,
  pendingReviews: initialReviews,
  complianceScore: initialScore,
}: GovernanceWidgetProps) {
  const { isMockData } = useDataMode();
  const [data, setData] = useState({
    policyViolations: initialViolations ?? 0,
    pendingReviews: initialReviews ?? 0,
    complianceScore: initialScore ?? 0,
  });
  const [loading, setLoading] = useState(initialViolations === undefined);

  useEffect(() => {
    if (initialViolations !== undefined) return;
    
    async function fetchData() {
      try {
        const res = await fetch('/api/governance');
        const json = await res.json();
        if (json.success) {
          setData({
            policyViolations: json.data?.violations?.length ?? 0,
            pendingReviews: json.data?.pendingReviews ?? 0,
            complianceScore: json.data?.complianceScore ?? 0,
          });
        } else {
          setData({ policyViolations: 0, pendingReviews: 0, complianceScore: 0 });
        }
      } catch {
        setData({ policyViolations: 0, pendingReviews: 0, complianceScore: 0 });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [initialViolations]);

  if (loading) {
    return <WidgetSkeleton color="slate" />;
  }

  const { policyViolations, pendingReviews, complianceScore } = data;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-50 rounded-xl border border-slate-200 p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-slate-600 to-gray-700 rounded-lg">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">AI Governance</h3>
            <p className="text-xs text-slate-500">Policy compliance & guardrails</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-green-600">{complianceScore}%</div>
          <div className="text-xs text-slate-500">Compliance</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 bg-red-50 rounded-lg">
          <div className="text-xl font-bold text-red-600">{policyViolations}</div>
          <div className="text-xs text-red-600">Violations</div>
        </div>
        <div className="p-3 bg-amber-50 rounded-lg">
          <div className="text-xl font-bold text-amber-600">{pendingReviews}</div>
          <div className="text-xs text-amber-600">Pending Reviews</div>
        </div>
      </div>

      <Link
        href="/governance"
        className="block w-full px-3 py-2 text-sm font-medium bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors text-center"
      >
        Review Policies
      </Link>
    </motion.div>
  );
}

// ============================================================================
// Quick Stats Row
// ============================================================================

interface QuickStat {
  label: string;
  value: string | number;
  change?: { value: number; direction: 'up' | 'down' };
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

interface QuickStatsRowProps {
  stats?: QuickStat[];
}

const defaultStats: QuickStat[] = [
  { label: 'Active Contracts', value: 24, change: { value: 3, direction: 'up' }, href: '/contracts', icon: FileText, color: 'text-violet-600' },
  { label: 'Intelligence Alerts', value: 6, href: '/intelligence', icon: Zap, color: 'text-purple-600' },
  { label: 'Pending Approvals', value: 4, change: { value: 2, direction: 'up' }, href: '/approvals', icon: CheckCircle2, color: 'text-amber-600' },
  { label: 'Upcoming Renewals', value: 5, href: '/renewals', icon: Calendar, color: 'text-green-600' },
  { label: 'Policy Alerts', value: 3, href: '/governance', icon: Shield, color: 'text-red-600' },
];

export function QuickStatsRow({
  stats: initialStats,
}: QuickStatsRowProps) {
  const { isMockData } = useDataMode();
  const [stats, setStats] = useState<QuickStat[]>(initialStats ?? defaultStats);
  const [loading, setLoading] = useState(!initialStats);

  useEffect(() => {
    if (initialStats) return;
    
    // If in demo mode, use mock data
    if (isMockData) {
      setStats(defaultStats);
      setLoading(false);
      return;
    }
    
    async function fetchData() {
      try {
        const res = await fetch('/api/dashboard/widgets');
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          setStats([
            { label: 'Active Contracts', value: d.contracts?.active ?? 24, change: d.contracts?.change ? { value: d.contracts.change, direction: 'up' } : undefined, href: '/contracts', icon: FileText, color: 'text-violet-600' },
            { label: 'Intelligence Alerts', value: d.intelligence?.alertCount ?? 6, href: '/intelligence', icon: Zap, color: 'text-purple-600' },
            { label: 'Pending Approvals', value: d.approvals?.pending ?? 4, change: d.approvals?.change ? { value: d.approvals.change, direction: 'up' } : undefined, href: '/approvals', icon: CheckCircle2, color: 'text-amber-600' },
            { label: 'Upcoming Renewals', value: d.renewals?.upcoming ?? 5, href: '/renewals', icon: Calendar, color: 'text-green-600' },
            { label: 'Policy Alerts', value: d.governance?.violations ?? 3, href: '/governance', icon: Shield, color: 'text-red-600' },
          ]);
        }
      } catch (err) {
        // Keep defaults
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [initialStats, isMockData]);

  if (loading) {
    return (
      <div className="grid grid-cols-5 gap-4">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
            <div className="h-5 w-5 bg-slate-200 rounded mb-2" />
            <div className="h-8 w-12 bg-slate-200 rounded mb-1" />
            <div className="h-3 w-20 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-5 gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Link
            key={index}
            href={stat.href}
            className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-lg hover:border-slate-300 transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <Icon className={`h-5 w-5 ${stat.color}`} />
              {stat.change && (
                <span className={`text-xs font-medium flex items-center ${
                  stat.change.direction === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stat.change.direction === 'up' ? '+' : '-'}{stat.change.value}
                </span>
              )}
            </div>
            <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
            <div className="text-xs text-slate-500 group-hover:text-slate-700 flex items-center gap-1">
              {stat.label}
              <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

const CrossModuleWidgets = {
  IntelligenceWidget,
  ApprovalsWidget,
  RenewalsWidget,
  GovernanceWidget,
  QuickStatsRow,
};
export default CrossModuleWidgets;
