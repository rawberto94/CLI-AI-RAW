'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  Timer,
  Download,
} from 'lucide-react';
import { PageBreadcrumb } from '@/components/navigation';
import { formatCurrency } from '@/components/ui/design-system';
import { cn } from '@/lib/utils';

interface RenewalItem {
  id: string;
  contractTitle: string;
  supplierName: string | null;
  clientName: string | null;
  expiryDate: string | null;
  daysUntil: number | null;
  totalValue: number | null;
  currency: string | null;
  contractType: string | null;
  status: string;
  paymentTerms: string | null;
  paymentFrequency: string | null;
  urgency: 'expired' | 'critical' | 'urgent' | 'high' | 'medium';
}

interface ObligationItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: string;
  dueDate: string | null;
  contract: {
    id: string;
    contractTitle: string | null;
    supplierName: string | null;
    totalValue: number | null;
    currency: string | null;
  } | null;
}

interface DashboardData {
  renewals: RenewalItem[];
  obligations: ObligationItem[];
  metrics: {
    renewals: {
      totalExpiring90d: number;
      expiring30d: number;
      expired: number;
      totalValueAtRisk: number;
    };
    obligations: {
      totalUpcoming90d: number;
      urgent30d: number;
      overdue: number;
      completed30d: number;
    };
  };
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  const config: Record<string, { color: string; icon: React.ElementType; label: string }> = {
    expired: { color: 'bg-red-100 text-red-700 border-red-200', icon: ShieldAlert, label: 'Expired' },
    critical: { color: 'bg-red-50 text-red-600 border-red-200', icon: AlertCircle, label: 'Critical' },
    urgent: { color: 'bg-amber-50 text-amber-600 border-amber-200', icon: Timer, label: 'Urgent' },
    high: { color: 'bg-orange-50 text-orange-600 border-orange-200', icon: AlertTriangle, label: 'High' },
    medium: { color: 'bg-blue-50 text-blue-600 border-blue-200', icon: Clock, label: 'Medium' },
  };
  const c = config[urgency] || config.medium;
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', c.color)}>
      <Icon className="w-3 h-3 mr-1" />
      {c.label}
      {urgency !== 'expired' && urgency !== 'medium' && ' (' + (urgency === 'critical' ? '<14d' : urgency === 'urgent' ? '<30d' : '<60d') + ')'}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    CRITICAL: 'bg-red-100 text-red-700',
    HIGH: 'bg-amber-100 text-amber-700',
    MEDIUM: 'bg-blue-100 text-blue-700',
    LOW: 'bg-slate-100 text-slate-700',
  };
  return (
    <Badge className={cn('text-[10px] uppercase', colors[priority] || colors.LOW)}>
      {priority}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    PENDING: 'bg-slate-100 text-slate-700',
    OVERDUE: 'bg-red-100 text-red-700',
    AT_RISK: 'bg-amber-100 text-amber-700',
  };
  return (
    <Badge className={cn('text-[10px]', colors[status] || colors.PENDING)}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

export default function RenewalsObligationsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dashboard/renewals-obligations');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || 'Failed to load dashboard data');
      }
    } catch (e) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/30 to-violet-50/20">
        <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Failed to load dashboard</h2>
          <p className="text-slate-500 mb-4">{error}</p>
          <Button onClick={fetchData}><RefreshCw className="h-4 w-4 mr-2" /> Retry</Button>
        </div>
      </div>
    );
  }

  const { renewals, obligations, metrics } = data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/30 to-violet-50/20 dark:from-slate-900 dark:via-green-950/30 dark:to-violet-950/20">
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 px-6 py-3 sticky top-0 z-30">
        <PageBreadcrumb />
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Renewals & Obligations</h1>
            <p className="text-sm text-slate-500 mt-1">
              Track expiring contracts and upcoming obligations — your daily value dashboard
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              if (!data) return;
              const csv = [
                ['Contract Title', 'Supplier', 'Type', 'Expiry Date', 'Days Until', 'Value', 'Currency', 'Urgency'].join(','),
                ...data.renewals.map(r => [
                  `"${r.contractTitle?.replace(/"/g, '""')}"`,
                  r.supplierName || '',
                  r.contractType || '',
                  r.expiryDate ? new Date(r.expiryDate).toLocaleDateString() : '',
                  r.daysUntil ?? '',
                  r.totalValue ?? '',
                  r.currency || '',
                  r.urgency,
                ].join(',')),
              ].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `renewals-obligations-${new Date().toISOString().split('T')[0]}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
            <Card className="border-l-4 border-l-red-500">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Expiring &lt;30 Days</p>
                    <p className="text-3xl font-bold mt-1">{metrics.renewals.expiring30d}</p>
                    {metrics.renewals.expired > 0 && (
                      <p className="text-xs text-red-600 mt-1">{metrics.renewals.expired} already expired</p>
                    )}
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg">
                    <Timer className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Value at Risk (90d)</p>
                    <p className="text-3xl font-bold mt-1">
                      {formatCurrency(metrics.renewals.totalValueAtRisk, 'CHF')}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">{metrics.renewals.totalExpiring90d} contracts</p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg">
                    <DollarSign className="h-6 w-6 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-l-4 border-l-violet-500">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Urgent Obligations</p>
                    <p className="text-3xl font-bold mt-1">{metrics.obligations.urgent30d}</p>
                    <p className="text-xs text-slate-400 mt-1">{metrics.obligations.overdue} overdue</p>
                  </div>
                  <div className="p-3 bg-violet-50 rounded-lg">
                    <CheckCircle2 className="h-6 w-6 text-violet-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Completed (30d)</p>
                    <p className="text-3xl font-bold mt-1">{metrics.obligations.completed30d}</p>
                    <p className="text-xs text-slate-400 mt-1">{metrics.obligations.totalUpcoming90d} upcoming (90d)</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white dark:bg-slate-800 border">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="renewals">
              Expiring Contracts
              {metrics.renewals.expiring30d > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] rounded-full">
                  {metrics.renewals.expiring30d}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="obligations">
              Obligations
              {metrics.obligations.overdue > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] rounded-full">
                  {metrics.obligations.overdue}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top Renewals */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-red-500" />
                      Top Renewals
                    </CardTitle>
                    <Link href="/renewals">
                      <Button variant="ghost" size="sm" className="text-xs">
                        View all <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {renewals.slice(0, 5).map(r => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                      <div className="min-w-0">
                        <Link href={`/contracts/${r.id}`} className="text-sm font-medium hover:text-violet-600 truncate block">
                          {r.contractTitle}
                        </Link>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {r.supplierName || r.clientName || 'Unknown vendor'} • {r.contractType || 'Contract'}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <UrgencyBadge urgency={r.urgency} />
                        {r.totalValue && (
                          <p className="text-xs text-slate-500 mt-1">
                            {formatCurrency(r.totalValue, r.currency || 'CHF')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {renewals.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-6">No expiring contracts found</p>
                  )}
                </CardContent>
              </Card>

              {/* Top Obligations */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-violet-500" />
                      Top Obligations
                    </CardTitle>
                    <Link href="/obligations">
                      <Button variant="ghost" size="sm" className="text-xs">
                        View all <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {obligations.slice(0, 5).map(o => (
                    <div key={o.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{o.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {o.contract?.contractTitle || 'Unknown contract'} • Due {o.dueDate ? new Date(o.dueDate).toLocaleDateString() : 'TBD'}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-4 space-y-1">
                        <PriorityBadge priority={o.priority} />
                        <StatusBadge status={o.status} />
                      </div>
                    </div>
                  ))}
                  {obligations.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-6">No urgent obligations found</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="renewals" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">All Expiring Contracts (Next 90 Days)</CardTitle>
                <CardDescription>{renewals.length} contracts require attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-slate-500">
                        <th className="pb-2 font-medium">Contract</th>
                        <th className="pb-2 font-medium">Vendor</th>
                        <th className="pb-2 font-medium">Type</th>
                        <th className="pb-2 font-medium">Expiry</th>
                        <th className="pb-2 font-medium">Value</th>
                        <th className="pb-2 font-medium">Terms</th>
                        <th className="pb-2 font-medium">Urgency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {renewals.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="py-3">
                            <Link href={`/contracts/${r.id}`} className="font-medium hover:text-violet-600 flex items-center gap-1.5">
                              <FileText className="h-3.5 w-3.5 text-slate-400" />
                              {r.contractTitle}
                            </Link>
                          </td>
                          <td className="py-3 text-slate-600">{r.supplierName || r.clientName || '-'}</td>
                          <td className="py-3 text-slate-600">{r.contractType || '-'}</td>
                          <td className="py-3 text-slate-600">
                            {r.expiryDate ? new Date(r.expiryDate).toLocaleDateString() : '-'}
                            {r.daysUntil !== null && (
                              <span className={cn(
                                'ml-2 text-xs',
                                r.daysUntil <= 0 ? 'text-red-600 font-medium' :
                                r.daysUntil <= 14 ? 'text-red-500' :
                                r.daysUntil <= 30 ? 'text-amber-600' : 'text-slate-400'
                              )}>
                                {r.daysUntil <= 0 ? `${Math.abs(r.daysUntil)}d overdue` : `${r.daysUntil}d left`}
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-slate-600">
                            {r.totalValue ? formatCurrency(r.totalValue, r.currency || 'CHF') : '-'}
                          </td>
                          <td className="py-3 text-slate-600">
                            {r.paymentTerms || '-'} {r.paymentFrequency && <span className="text-xs text-slate-400">({r.paymentFrequency.toLowerCase()})</span>}
                          </td>
                          <td className="py-3">
                            <UrgencyBadge urgency={r.urgency} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {renewals.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-12">No contracts expiring in the next 90 days</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="obligations" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Urgent Obligations</CardTitle>
                <CardDescription>{obligations.length} obligations due within 30 days or overdue</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-slate-500">
                        <th className="pb-2 font-medium">Obligation</th>
                        <th className="pb-2 font-medium">Contract</th>
                        <th className="pb-2 font-medium">Type</th>
                        <th className="pb-2 font-medium">Due Date</th>
                        <th className="pb-2 font-medium">Priority</th>
                        <th className="pb-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {obligations.map(o => (
                        <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="py-3">
                            <p className="font-medium">{o.title}</p>
                            {o.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{o.description}</p>}
                          </td>
                          <td className="py-3 text-slate-600">
                            {o.contract ? (
                              <Link href={`/contracts/${o.contract.id}`} className="hover:text-violet-600">
                                {o.contract.contractTitle || 'Untitled'}
                              </Link>
                            ) : '-'}
                          </td>
                          <td className="py-3 text-slate-600">{o.type.replace(/_/g, ' ')}</td>
                          <td className="py-3 text-slate-600">
                            {o.dueDate ? new Date(o.dueDate).toLocaleDateString() : '-'}
                          </td>
                          <td className="py-3">
                            <PriorityBadge priority={o.priority} />
                          </td>
                          <td className="py-3">
                            <StatusBadge status={o.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {obligations.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-12">No urgent obligations found</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
