'use client';

import { useState } from 'react';
import { PageBreadcrumb } from '@/components/navigation';
import { DashboardLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX, FileText, CheckCircle2,
  AlertTriangle, XCircle, Search, RefreshCw, Activity, TrendingUp,
  Clock, ArrowRight, ChevronDown, Eye, BarChart3, Lock,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface Policy {
  id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  severity: string;
  rules: number;
  violations: number;
  enforcement: string;
}

interface GovernanceData {
  policies: Policy[];
  flags: Array<{ id: string; type: string; severity: string; title: string; status: string }>;
  stats: {
    activePolicies: number;
    openFlags: number;
    criticalFlags: number;
    totalViolations: number;
    totalContracts: number;
    complianceScore: number;
  };
}

const STATUS_MAP: Record<string, { color: string; icon: React.ElementType }> = {
  active: { color: 'text-green-600', icon: CheckCircle2 },
  warning: { color: 'text-amber-600', icon: AlertTriangle },
  violation: { color: 'text-red-600', icon: XCircle },
};

export default function ComplianceDashboardClient() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['governance-compliance'],
    queryFn: async () => {
      const res = await fetch('/api/governance');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      return json.data as GovernanceData;
    },
    staleTime: 2 * 60 * 1000,
  });

  const stats = data?.stats;
  const policies = data?.policies || [];
  const complianceScore = stats?.complianceScore ?? 0;

  const filteredPolicies = policies.filter(p =>
    !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const scoreColor = complianceScore >= 80 ? 'text-green-600' : complianceScore >= 60 ? 'text-amber-600' : 'text-red-600';
  const scoreLabel = complianceScore >= 80 ? 'Excellent' : complianceScore >= 60 ? 'Needs Attention' : 'At Risk';
  const scoreBg = complianceScore >= 80 ? 'bg-green-50' : complianceScore >= 60 ? 'bg-amber-50' : 'bg-red-50';

  const compliantPolicies = policies.filter(p => p.status === 'active' && p.violations === 0).length;
  const violatingPolicies = policies.filter(p => p.violations > 0).length;

  if (isLoading) {
    return (
      <DashboardLayout title="Compliance" description="Policy & regulatory compliance">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Compliance"
      description="Monitor policy adherence and regulatory compliance"
      actions={
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Breadcrumbs */}
        <div className="mb-2">
          <PageBreadcrumb />
        </div>
        {/* Compliance Score Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className={cn('border-2 relative overflow-hidden', complianceScore >= 80 ? 'border-green-200' : complianceScore >= 60 ? 'border-amber-200' : 'border-red-200')}>
            <CardContent className="p-8">
              <div className="flex items-center gap-8">
                <div className="relative">
                  <svg className="w-32 h-32 -rotate-90" viewBox="0 0 36 36">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke={complianceScore >= 80 ? '#22c55e' : complianceScore >= 60 ? '#eab308' : '#ef4444'}
                      strokeWidth="3"
                      strokeDasharray={`${complianceScore}, 100`}
                      strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={cn('text-3xl font-bold', scoreColor)}>{complianceScore}%</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{scoreLabel}</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold">Compliance Score</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Based on {stats?.totalContracts ?? 0} contracts analyzed against {stats?.activePolicies ?? 0} active policies
                  </p>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-green-600">{compliantPolicies}</p>
                      <p className="text-xs text-green-600/80">Compliant</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-red-600">{violatingPolicies}</p>
                      <p className="text-xs text-red-600/80">Violations</p>
                    </div>
                    <div className="bg-violet-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-violet-600">{stats?.totalViolations ?? 0}</p>
                      <p className="text-xs text-violet-600/80">Total Issues</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Active Policies', value: stats?.activePolicies ?? 0, icon: ShieldCheck, color: 'text-green-600', bg: 'bg-green-100' },
            { label: 'Open Flags', value: stats?.openFlags ?? 0, icon: ShieldAlert, color: 'text-amber-600', bg: 'bg-amber-100' },
            { label: 'Critical Issues', value: stats?.criticalFlags ?? 0, icon: ShieldX, color: 'text-red-600', bg: 'bg-red-100' },
            { label: 'Contracts Covered', value: stats?.totalContracts ?? 0, icon: FileText, color: 'text-violet-600', bg: 'bg-violet-100' },
          ].map((kpi, i) => (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * (i + 1) }}>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{kpi.label}</p>
                      <p className={cn('text-2xl font-bold', kpi.color)}>{kpi.value}</p>
                    </div>
                    <div className={cn('p-3 rounded-full', kpi.bg)}>
                      <kpi.icon className={cn('h-5 w-5', kpi.color)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Policies Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Policy Compliance ({filteredPolicies.length})</CardTitle>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Search policies..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-8 h-8 w-56 text-xs"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredPolicies.length === 0 ? (
              <div className="py-12 text-center">
                <Shield className="h-12 w-12 mx-auto mb-3 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">No policies found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPolicies.map(policy => {
                  const hasViolations = policy.violations > 0;
                  return (
                    <div
                      key={policy.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border transition-colors hover:bg-muted/50',
                        hasViolations ? 'border-red-200 bg-red-50/50' : 'border-green-200 bg-green-50/50'
                      )}
                    >
                      {hasViolations ? (
                        <ShieldAlert className="h-5 w-5 text-red-500 shrink-0" />
                      ) : (
                        <ShieldCheck className="h-5 w-5 text-green-500 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{policy.name}</span>
                          <Badge variant="outline" className="text-[10px] capitalize">{policy.category}</Badge>
                          <Badge variant="outline" className={cn('text-[10px]', policy.enforcement === 'strict' ? 'border-red-300 text-red-600' : 'border-amber-300 text-amber-600')}>
                            <Lock className="h-2.5 w-2.5 mr-0.5" /> {policy.enforcement}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{policy.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">{policy.rules} rules</p>
                        <p className={cn('text-sm font-medium', hasViolations ? 'text-red-600' : 'text-green-600')}>
                          {hasViolations ? `${policy.violations} violations` : 'Compliant'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
