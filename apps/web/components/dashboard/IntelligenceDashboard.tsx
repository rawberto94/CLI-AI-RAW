'use client';

import React, { useEffect, useState } from 'react';
import { Brain, FileText, Activity, DollarSign, Shield, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react';

interface DashboardStats {
  totalContracts: number;
  activeProcessing: number;
  insightsGenerated: number;
  totalValue: number;
  avgHealthScore: number;
  healthyContracts: number;
  atRiskContracts: number;
  opportunities: number;
  potentialSavings: number;
  learningRecords: number;
}

function StatCard({ icon: Icon, label, value, subtext, color }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtext?: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-sm font-medium text-slate-500">{label}</h3>
      </div>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
    </div>
  );
}

export function IntelligenceDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/agents/dashboard-stats');
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          setStats({
            totalContracts: d.totalContracts ?? 0,
            activeProcessing: d.activeRecommendations ?? d.activeProcessing ?? 0,
            insightsGenerated: d.totalEvents ?? 0,
            totalValue: d.totalOpportunityValue ?? d.totalValue ?? 0,
            avgHealthScore: d.avgHealthScore ?? 0,
            healthyContracts: d.healthyContracts ?? 0,
            atRiskContracts: d.atRiskContracts ?? 0,
            opportunities: d.opportunitiesCount ?? d.opportunities ?? 0,
            potentialSavings: d.totalOpportunityValue ?? d.potentialSavings ?? 0,
            learningRecords: d.learningRecords ?? 0,
          });
        }
      } catch {
        // API unavailable — leave stats null
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Brain className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p>Intelligence data unavailable</p>
      </div>
    );
  }

  const fmtValue = (v: number) =>
    v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` :
    v >= 1_000 ? `$${(v / 1_000).toFixed(0)}K` : `$${v}`;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={FileText} label="Total Contracts" value={stats.totalContracts} color="bg-violet-500" />
        <StatCard icon={Activity} label="Active Processing" value={stats.activeProcessing} color="bg-blue-500" />
        <StatCard icon={Brain} label="Insights Generated" value={stats.insightsGenerated} subtext="Last 30 days" color="bg-emerald-500" />
        <StatCard icon={DollarSign} label="Total Value" value={fmtValue(stats.totalValue)} color="bg-amber-500" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Shield}
          label="Avg Health Score"
          value={`${stats.avgHealthScore}/100`}
          subtext={`${stats.healthyContracts} healthy, ${stats.atRiskContracts} at risk`}
          color="bg-teal-500"
        />
        <StatCard
          icon={TrendingUp}
          label="Opportunities"
          value={stats.opportunities}
          subtext={stats.potentialSavings > 0 ? `${fmtValue(stats.potentialSavings)} potential savings` : undefined}
          color="bg-indigo-500"
        />
        <StatCard
          icon={AlertTriangle}
          label="At Risk"
          value={stats.atRiskContracts}
          color="bg-rose-500"
        />
        <StatCard
          icon={Brain}
          label="Learning Records"
          value={stats.learningRecords}
          subtext="Corrections tracked"
          color="bg-purple-500"
        />
      </div>
    </div>
  );
}

export default IntelligenceDashboard;
