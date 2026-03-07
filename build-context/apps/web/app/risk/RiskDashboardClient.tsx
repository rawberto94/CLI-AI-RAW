'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Shield, TrendingUp, TrendingDown, FileText,
  ChevronRight, Search, Filter, BarChart3, AlertCircle, CheckCircle2,
  Clock, ExternalLink, Eye, RefreshCw, XCircle, Activity,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface RiskFlag {
  id: string;
  type: string;
  severity: string;
  title: string;
  contract: string | null;
  contractId: string;
  status: string;
  description?: string;
}

interface GovernanceData {
  flags: RiskFlag[];
  stats: {
    activePolicies: number;
    openFlags: number;
    criticalFlags: number;
    totalViolations: number;
    totalContracts: number;
    complianceScore: number;
  };
}

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  critical: { label: 'Critical', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: XCircle },
  high: { label: 'High', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: AlertTriangle },
  medium: { label: 'Medium', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: AlertCircle },
  low: { label: 'Low', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Activity },
};

export default function RiskDashboardClient() {
  const [severityFilter, setSeverityFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['governance-risk'],
    queryFn: async () => {
      const res = await fetch('/api/governance');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      return json.data as GovernanceData;
    },
    staleTime: 2 * 60 * 1000,
  });

  const flags = data?.flags || [];
  const stats = data?.stats;

  const filteredFlags = flags.filter(f => {
    if (severityFilter !== 'all' && f.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && f.status !== statusFilter) return false;
    if (searchTerm && !f.title.toLowerCase().includes(searchTerm.toLowerCase()) && !f.contract?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const criticalCount = flags.filter(f => f.severity === 'critical').length;
  const highCount = flags.filter(f => f.severity === 'high').length;
  const mediumCount = flags.filter(f => f.severity === 'medium').length;
  const riskScore = stats ? Math.max(0, 100 - stats.complianceScore) : 0;

  const riskLevel = riskScore > 50 ? 'High' : riskScore > 25 ? 'Medium' : 'Low';
  const riskColor = riskScore > 50 ? 'text-red-600' : riskScore > 25 ? 'text-amber-600' : 'text-green-600';

  if (isLoading) {
    return (
      <DashboardLayout title="Risk Management" description="Portfolio risk analysis & mitigation">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Risk Management"
      description="Monitor, assess, and mitigate contract portfolio risks"
      actions={
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      }
    >
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
            <Card className="border-l-4 border-l-red-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Overall Risk Score</p>
                    <p className={cn('text-3xl font-bold', riskColor)}>{riskScore}</p>
                    <p className={cn('text-xs font-medium', riskColor)}>{riskLevel} Risk</p>
                  </div>
                  <div className={cn('p-3 rounded-full', riskScore > 50 ? 'bg-red-100' : riskScore > 25 ? 'bg-amber-100' : 'bg-green-100')}>
                    <Shield className={cn('h-6 w-6', riskColor)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card className="border-l-4 border-l-orange-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Critical Issues</p>
                    <p className="text-3xl font-bold text-red-600">{criticalCount}</p>
                    <p className="text-xs text-muted-foreground">Require immediate action</p>
                  </div>
                  <div className="p-3 rounded-full bg-red-100">
                    <XCircle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">High Severity</p>
                    <p className="text-3xl font-bold text-orange-600">{highCount}</p>
                    <p className="text-xs text-muted-foreground">Open risk flags</p>
                  </div>
                  <div className="p-3 rounded-full bg-orange-100">
                    <AlertTriangle className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Contracts Analyzed</p>
                    <p className="text-3xl font-bold">{stats?.totalContracts || 0}</p>
                    <p className="text-xs text-muted-foreground">{stats?.activePolicies || 0} active policies</p>
                  </div>
                  <div className="p-3 rounded-full bg-green-100">
                    <FileText className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Risk Distribution Bar */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Risk Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-1 h-8 rounded-lg overflow-hidden">
              {criticalCount > 0 && (
                <div className="bg-red-500 flex items-center justify-center text-white text-xs font-medium" style={{ flex: criticalCount }}>
                  {criticalCount}
                </div>
              )}
              {highCount > 0 && (
                <div className="bg-orange-500 flex items-center justify-center text-white text-xs font-medium" style={{ flex: highCount }}>
                  {highCount}
                </div>
              )}
              {mediumCount > 0 && (
                <div className="bg-amber-400 flex items-center justify-center text-white text-xs font-medium" style={{ flex: mediumCount }}>
                  {mediumCount}
                </div>
              )}
              {flags.length === 0 && (
                <div className="bg-green-500 flex-1 flex items-center justify-center text-white text-xs font-medium">
                  No risks detected
                </div>
              )}
            </div>
            <div className="flex gap-4 mt-3 text-xs">
              <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-500" /> Critical ({criticalCount})</span>
              <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-orange-500" /> High ({highCount})</span>
              <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-amber-400" /> Medium ({mediumCount})</span>
            </div>
          </CardContent>
        </Card>

        {/* Risk Flags Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Risk Flags ({filteredFlags.length})</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="Search risks..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-8 h-8 w-48 text-xs"
                  />
                </div>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="Severity" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredFlags.length === 0 ? (
              <div className="py-12 text-center">
                <Shield className="h-12 w-12 mx-auto mb-3 text-green-500/30" />
                <p className="text-sm font-medium text-green-600">No risks found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {flags.length === 0 ? 'Your contract portfolio looks healthy!' : 'No risks match the current filters'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredFlags.map(flag => {
                  const config = SEVERITY_CONFIG[flag.severity] || SEVERITY_CONFIG.medium;
                  const Icon = config.icon;
                  return (
                    <div key={flag.id} className={cn('flex items-center gap-3 p-3 rounded-lg border', config.bg)}>
                      <Icon className={cn('h-5 w-5 shrink-0', config.color)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{flag.title}</span>
                          <Badge variant="outline" className="text-[10px] capitalize">{flag.type}</Badge>
                        </div>
                        {flag.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{flag.description}</p>}
                      </div>
                      {flag.contract && (
                        <Link href={`/contracts/${flag.contractId}`} className="text-xs text-violet-600 hover:underline flex items-center gap-1 shrink-0">
                          <FileText className="h-3 w-3" />
                          <span className="max-w-[120px] truncate">{flag.contract}</span>
                        </Link>
                      )}
                      <Badge className={cn('text-[10px] shrink-0', config.color, 'bg-transparent border')}>{config.label}</Badge>
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
