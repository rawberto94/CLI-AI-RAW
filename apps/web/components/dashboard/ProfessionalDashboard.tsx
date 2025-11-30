'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';
import {
  FileText,
  DollarSign,
  Shield,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  Calendar,
  Activity,
  Zap,
  Target,
  BarChart3,
  PieChart as PieChartIcon,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw,
  Filter,
  Download,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Brain,
  ChevronRight,
  Building,
  Send,
  UserCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber, formatDate } from '@/lib/design-tokens';
import { useDataMode } from '@/contexts/DataModeContext';
import { toast } from 'sonner';
import { DeadlineAlertBanner, useDeadlineAlerts } from '@/components/workflows/DeadlineAlerts';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// ============ TYPES ============

interface DashboardMetrics {
  totalContracts: number;
  activeContracts: number;
  totalValue: number;
  avgRiskScore: number;
  pendingApprovals: number;
  expiringThisMonth: number;
  contractsThisWeek: number;
  aiProcessingQueue: number;
  trends: {
    contracts: number;
    value: number;
    risk: number;
    compliance: number;
  };
}

interface RecentContract {
  id: string;
  name: string;
  status: 'completed' | 'processing' | 'review' | 'pending';
  value: number;
  date: string;
  riskLevel: 'low' | 'medium' | 'high';
}

interface UpcomingExpiration {
  id: string;
  name: string;
  client: string;
  expiresAt: string;
  daysRemaining: number;
  value: number;
}

// ============ MOCK DATA ============

const mockMetrics: DashboardMetrics = {
  totalContracts: 247,
  activeContracts: 189,
  totalValue: 12500000,
  avgRiskScore: 34,
  pendingApprovals: 12,
  expiringThisMonth: 8,
  contractsThisWeek: 14,
  aiProcessingQueue: 3,
  trends: {
    contracts: 12.5,
    value: 18.3,
    risk: -8.2,
    compliance: 5.1,
  },
};

const mockRecentContracts: RecentContract[] = [
  { id: '1', name: 'Enterprise License Agreement', status: 'completed', value: 450000, date: '2024-01-15', riskLevel: 'low' },
  { id: '2', name: 'Cloud Services MSA', status: 'processing', value: 280000, date: '2024-01-14', riskLevel: 'medium' },
  { id: '3', name: 'Consulting Services Contract', status: 'review', value: 125000, date: '2024-01-13', riskLevel: 'low' },
  { id: '4', name: 'Software Development Agreement', status: 'completed', value: 890000, date: '2024-01-12', riskLevel: 'high' },
  { id: '5', name: 'NDA - Tech Partner', status: 'pending', value: 0, date: '2024-01-11', riskLevel: 'low' },
];

const mockExpirations: UpcomingExpiration[] = [
  { id: '1', name: 'Annual Support Contract', client: 'Acme Corp', expiresAt: '2024-02-15', daysRemaining: 12, value: 85000 },
  { id: '2', name: 'Software License', client: 'TechStart Inc', expiresAt: '2024-02-20', daysRemaining: 17, value: 120000 },
  { id: '3', name: 'Maintenance Agreement', client: 'Global Systems', expiresAt: '2024-02-28', daysRemaining: 25, value: 45000 },
];

const mockChartData = {
  monthly: [
    { month: 'Aug', contracts: 32, value: 1.2, processed: 28 },
    { month: 'Sep', contracts: 45, value: 1.8, processed: 41 },
    { month: 'Oct', contracts: 38, value: 1.5, processed: 35 },
    { month: 'Nov', contracts: 52, value: 2.1, processed: 48 },
    { month: 'Dec', contracts: 48, value: 1.9, processed: 45 },
    { month: 'Jan', contracts: 61, value: 2.4, processed: 57 },
  ],
  riskDistribution: [
    { name: 'Low Risk', value: 156, color: '#10b981' },
    { name: 'Medium Risk', value: 67, color: '#f59e0b' },
    { name: 'High Risk', value: 24, color: '#f43f5e' },
  ],
  byType: [
    { type: 'MSA', count: 45 },
    { type: 'NDA', count: 38 },
    { type: 'License', count: 32 },
    { type: 'Service', count: 28 },
    { type: 'Other', count: 15 },
  ],
};

// ============ API FETCH HOOK ============

function useDashboardData() {
  const { isMockData } = useDataMode();
  const [metrics, setMetrics] = useState<DashboardMetrics>(mockMetrics);
  const [chartData, setChartData] = useState(mockChartData);
  const [recentContracts, setRecentContracts] = useState<RecentContract[]>(mockRecentContracts);
  const [expirations, setExpirations] = useState<UpcomingExpiration[]>(mockExpirations);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If in demo mode, use mock data
    if (isMockData) {
      setMetrics(mockMetrics);
      setChartData(mockChartData);
      setRecentContracts(mockRecentContracts);
      setExpirations(mockExpirations);
      setLoading(false);
      return;
    }
    
    async function fetchData() {
      try {
        const [statsRes, approvalsRes, renewalsRes] = await Promise.all([
          fetch('/api/dashboard/stats'),
          fetch('/api/approvals?limit=5'),
          fetch('/api/renewals?limit=3'),
        ]);

        const [statsJson, approvalsJson, renewalsJson] = await Promise.all([
          statsRes.json(),
          approvalsRes.json(),
          renewalsRes.json(),
        ]);

        // Map API data to metrics
        if (statsJson.success && statsJson.data) {
          const d = statsJson.data;
          setMetrics({
            totalContracts: d.overview?.totalContracts ?? mockMetrics.totalContracts,
            activeContracts: d.overview?.activeContracts ?? mockMetrics.activeContracts,
            totalValue: d.overview?.portfolioValue ?? mockMetrics.totalValue,
            avgRiskScore: d.riskScore ?? mockMetrics.avgRiskScore,
            pendingApprovals: approvalsJson.data?.items?.length ?? mockMetrics.pendingApprovals,
            expiringThisMonth: d.renewals?.expiringIn30Days ?? mockMetrics.expiringThisMonth,
            contractsThisWeek: d.overview?.recentlyAdded ?? mockMetrics.contractsThisWeek,
            aiProcessingQueue: d.breakdown?.byStatus?.find((s: any) => s.status === 'PROCESSING')?.count ?? 3,
            trends: mockMetrics.trends, // Keep mock trends for now
          });

          // Map breakdown to chart
          if (d.breakdown?.byType) {
            setChartData(prev => ({
              ...prev,
              byType: d.breakdown.byType.slice(0, 5).map((t: any) => ({
                type: t.type?.substring(0, 10) || 'Other',
                count: t.count,
              })),
            }));
          }
        }

        // Map renewals to expirations
        if (renewalsJson.success && renewalsJson.data?.contracts) {
          setExpirations(renewalsJson.data.contracts.slice(0, 3).map((c: any, i: number) => ({
            id: c.id || String(i + 1),
            name: c.contractName || c.name || 'Contract',
            client: c.counterparty || c.vendor || 'Unknown',
            expiresAt: c.endDate || c.renewalDate,
            daysRemaining: c.daysUntilRenewal || Math.round((new Date(c.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
            value: c.contractValue || c.value || 0,
          })));
        }

      } catch (error) {
        console.log('Using mock data due to API error:', error);
        // Keep mock data
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [isMockData]);

  return { metrics, chartData, recentContracts, expirations, loading };
}

// ============ HELPER COMPONENTS ============

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: { value: number; label?: string };
  color: 'blue' | 'green' | 'amber' | 'rose' | 'purple' | 'indigo';
  delay?: number;
}

function StatCard({ title, value, subtitle, icon: Icon, trend, color, delay = 0 }: StatCardProps) {
  const colorClasses = {
    blue: { bg: 'bg-blue-50', iconBg: 'from-blue-500 to-cyan-500', text: 'text-blue-600' },
    green: { bg: 'bg-emerald-50', iconBg: 'from-emerald-500 to-green-500', text: 'text-emerald-600' },
    amber: { bg: 'bg-amber-50', iconBg: 'from-amber-500 to-orange-500', text: 'text-amber-600' },
    rose: { bg: 'bg-rose-50', iconBg: 'from-rose-500 to-red-500', text: 'text-rose-600' },
    purple: { bg: 'bg-purple-50', iconBg: 'from-purple-500 to-pink-500', text: 'text-purple-600' },
    indigo: { bg: 'bg-indigo-50', iconBg: 'from-indigo-500 to-violet-500', text: 'text-indigo-600' },
  }[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="border-slate-200/80 hover:border-slate-300/80 hover:shadow-md transition-all">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">{title}</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
              {subtitle && (
                <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
              )}
              {trend && (
                <div className="flex items-center gap-1 mt-2">
                  {trend.value > 0 ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                  ) : trend.value < 0 ? (
                    <ArrowDownRight className="h-3.5 w-3.5 text-rose-500" />
                  ) : (
                    <Minus className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span className={cn(
                    "text-xs font-medium",
                    trend.value > 0 ? "text-emerald-600" : trend.value < 0 ? "text-rose-600" : "text-slate-500"
                  )}>
                    {trend.value > 0 ? '+' : ''}{trend.value}%
                  </span>
                  {trend.label && (
                    <span className="text-xs text-slate-400">{trend.label}</span>
                  )}
                </div>
              )}
            </div>
            <div className={cn(
              "p-3 rounded-xl bg-gradient-to-br shadow-sm",
              colorClasses.iconBg
            )}>
              <Icon className="h-5 w-5 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ContractRow({ contract, index }: { contract: RecentContract; index: number }) {
  const statusConfig = {
    completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle2 },
    processing: { bg: 'bg-indigo-100', text: 'text-indigo-700', icon: Zap },
    review: { bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertCircle },
    pending: { bg: 'bg-slate-100', text: 'text-slate-600', icon: Clock },
  }[contract.status];

  const riskConfig = {
    low: 'bg-emerald-500',
    medium: 'bg-amber-500',
    high: 'bg-rose-500',
  }[contract.riskLevel];

  const StatusIcon = statusConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors group"
    >
      <div className={cn("w-2 h-2 rounded-full shrink-0", riskConfig)} />
      
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
          {contract.name}
        </p>
        <p className="text-xs text-slate-500">{formatDate(contract.date)}</p>
      </div>
      
      <Badge className={cn("text-[10px]", statusConfig.bg, statusConfig.text)}>
        <StatusIcon className="h-3 w-3 mr-1" />
        {contract.status}
      </Badge>
      
      {contract.value > 0 && (
        <span className="text-sm font-medium text-slate-900 tabular-nums">
          {formatCurrency(contract.value)}
        </span>
      )}
      
      <ChevronRight className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.div>
  );
}

function ExpirationRow({ item, index }: { item: UpcomingExpiration; index: number }) {
  const urgencyColor = item.daysRemaining <= 7 
    ? 'text-rose-600 bg-rose-50' 
    : item.daysRemaining <= 14 
    ? 'text-amber-600 bg-amber-50' 
    : 'text-slate-600 bg-slate-50';

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors group"
    >
      <div className={cn("px-2 py-1 rounded-md text-xs font-medium", urgencyColor)}>
        {item.daysRemaining}d
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 truncate">{item.name}</p>
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <Building className="h-3 w-3" />
          {item.client}
        </p>
      </div>
      
      <span className="text-sm font-medium text-slate-900 tabular-nums">
        {formatCurrency(item.value)}
      </span>
      
      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
        Renew
      </Button>
    </motion.div>
  );
}

// ============ PENDING APPROVALS WIDGET ============

interface PendingApproval {
  id: string;
  title: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  requestedBy: string;
  dueDate: string;
  value?: number;
}

function PendingApprovalsWidget() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApprovals = async () => {
      try {
        const response = await fetch('/api/approvals?status=pending');
        if (response.ok) {
          const data = await response.json();
          const items = (data.data?.items || []).slice(0, 5).map((item: any) => ({
            id: item.id,
            title: item.title || item.contractName || 'Approval Request',
            type: item.type || 'contract',
            priority: item.priority || 'medium',
            requestedBy: item.requestedBy?.name || 'System',
            dueDate: item.dueDate,
            value: item.value,
          }));
          setApprovals(items);
        }
      } catch (error) {
        // Use mock data on error
        setApprovals([
          { id: '1', title: 'Master Agreement - CloudTech', type: 'contract', priority: 'high', requestedBy: 'Sarah Johnson', dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), value: 450000 },
          { id: '2', title: 'Renewal - GlobalSupply Ltd', type: 'renewal', priority: 'urgent', requestedBy: 'System', dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), value: 780000 },
          { id: '3', title: 'SLA Amendment - Acme Corp', type: 'amendment', priority: 'medium', requestedBy: 'Tom Wilson', dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), value: 50000 },
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchApprovals();
  }, []);

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'urgent': return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' };
      case 'high': return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' };
      case 'medium': return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' };
      default: return { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'renewal': return Calendar;
      case 'amendment': return FileText;
      default: return Send;
    }
  };

  const formatDueDate = (date: string) => {
    const days = Math.ceil((new Date(date).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    if (days < 0) return <span className="text-red-600 font-medium">Overdue</span>;
    if (days === 0) return <span className="text-red-600 font-medium">Today</span>;
    if (days === 1) return <span className="text-amber-600 font-medium">Tomorrow</span>;
    if (days <= 3) return <span className="text-amber-600">{days} days</span>;
    return <span className="text-slate-600">{days} days</span>;
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85 }}
      >
        <Card className="border-slate-200/80">
          <CardContent className="p-8">
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-slate-100 rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (approvals.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85 }}
      >
        <Card className="border-slate-200/80 bg-gradient-to-br from-emerald-50 to-teal-50">
          <CardContent className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">All caught up!</h3>
            <p className="text-sm text-slate-600">No pending approvals at the moment.</p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.85 }}
    >
      <Card className="border-slate-200/80">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-amber-600" />
              Pending Approvals
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-amber-600" asChild>
              <Link href="/approvals">
                View all
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {approvals.map((approval, index) => {
              const priorityConfig = getPriorityConfig(approval.priority);
              const TypeIcon = getTypeIcon(approval.type);
              
              return (
                <motion.div
                  key={approval.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link 
                    href={`/approvals?id=${approval.id}`}
                    className="flex items-center gap-4 p-3 hover:bg-slate-50 transition-colors group"
                  >
                    <div className={cn("p-2 rounded-lg", priorityConfig.bg)}>
                      <TypeIcon className={cn("h-4 w-4", priorityConfig.text)} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate group-hover:text-amber-600 transition-colors">
                        {approval.title}
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-2">
                        <span>by {approval.requestedBy}</span>
                        <span>•</span>
                        <span className="capitalize">{approval.type}</span>
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-xs text-slate-500">Due</div>
                      <div className="text-sm font-medium">
                        {formatDueDate(approval.dueDate)}
                      </div>
                    </div>
                    
                    {approval.value && approval.value > 0 && (
                      <span className="text-sm font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(approval.value)}
                      </span>
                    )}
                    
                    <Badge className={cn("text-[10px]", priorityConfig.bg, priorityConfig.text, priorityConfig.border)}>
                      {approval.priority}
                    </Badge>
                    
                    <ChevronRight className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============ MAIN COMPONENT ============

export function ProfessionalDashboard() {
  const { metrics, chartData, recentContracts, expirations, loading } = useDashboardData();
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d');

  const handleExport = () => {
    try {
      const exportData = {
        generatedAt: new Date().toISOString(),
        timeframe,
        metrics,
        recentContracts,
        expirations,
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `dashboard-report-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      toast.success('Dashboard exported successfully');
    } catch (error) {
      toast.error('Failed to export dashboard');
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-slate-100 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-slate-100 rounded-xl" />
          <div className="h-80 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Intelligence Dashboard</h1>
          <p className="text-slate-500 mt-1">Contract analytics and AI insights</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
            {(['7d', '30d', '90d'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                  timeframe === tf 
                    ? "bg-white text-slate-900 shadow-sm" 
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                {tf === '7d' ? '7 Days' : tf === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
          
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      {/* Deadline Alerts Banner */}
      {expirations.filter(e => e.daysRemaining <= 14).length > 0 && (
        <DeadlineAlertBanner
          items={expirations
            .filter(e => e.daysRemaining <= 14)
            .map(exp => ({
              id: exp.id,
              title: exp.name,
              dueDate: new Date(exp.expiresAt),
              type: 'contract' as const,
              priority: exp.daysRemaining <= 3 ? 'urgent' as const : exp.daysRemaining <= 7 ? 'high' as const : 'medium' as const,
              link: `/contracts/${exp.id}`,
              assignee: exp.client,
            }))
          }
        />
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Contracts"
          value={metrics.totalContracts}
          subtitle={`${metrics.activeContracts} active`}
          icon={FileText}
          trend={{ value: metrics.trends.contracts, label: 'vs last period' }}
          color="blue"
          delay={0}
        />
        <StatCard
          title="Total Value"
          value={formatCurrency(metrics.totalValue)}
          icon={DollarSign}
          trend={{ value: metrics.trends.value, label: 'growth' }}
          color="green"
          delay={0.1}
        />
        <StatCard
          title="Avg Risk Score"
          value={`${metrics.avgRiskScore}/100`}
          subtitle="Low Risk"
          icon={Shield}
          trend={{ value: metrics.trends.risk }}
          color="amber"
          delay={0.2}
        />
        <StatCard
          title="AI Processing"
          value={metrics.aiProcessingQueue}
          subtitle="in queue"
          icon={Brain}
          color="purple"
          delay={0.3}
        />
      </div>

      {/* Quick Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <Card className="border-slate-200/80">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-100">
              <Zap className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{metrics.contractsThisWeek}</p>
              <p className="text-xs text-slate-500">This week</p>
            </div>
          </CardContent>
        </Card>
        
        <Link href="/approvals">
          <Card className="border-slate-200/80 hover:border-amber-300 hover:shadow-md transition-all cursor-pointer group">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 group-hover:bg-amber-200 transition-colors">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-2xl font-bold text-slate-900">{metrics.pendingApprovals}</p>
                <p className="text-xs text-slate-500">Pending approval</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardContent>
          </Card>
        </Link>
        
        <Card className="border-slate-200/80">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-100">
              <Calendar className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{metrics.expiringThisMonth}</p>
              <p className="text-xs text-slate-500">Expiring soon</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200/80">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100">
              <Target className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{Math.round(metrics.trends.compliance)}%</p>
              <p className="text-xs text-slate-500">Compliance rate</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-2"
        >
          <Card className="border-slate-200/80">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-indigo-600" />
                  Contract Activity
                </CardTitle>
                <Badge variant="secondary" className="bg-slate-100">Last 6 months</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData.monthly}>
                  <defs>
                    <linearGradient id="colorContracts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorProcessed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="contracts"
                    stroke="#6366f1"
                    fillOpacity={1}
                    fill="url(#colorContracts)"
                    name="Contracts"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="processed"
                    stroke="#10b981"
                    fillOpacity={1}
                    fill="url(#colorProcessed)"
                    name="AI Processed"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Risk Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="border-slate-200/80 h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-amber-600" />
                Risk Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={chartData.riskDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.riskDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-4">
                {chartData.riskDistribution.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs text-slate-600">{item.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Activity & Expirations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Contracts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card className="border-slate-200/80">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  Recent Contracts
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-indigo-600" asChild>
                  <Link href="/contracts">
                    View all
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {recentContracts.map((contract, i) => (
                  <ContractRow key={contract.id} contract={contract} index={i} />
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Upcoming Expirations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card className="border-slate-200/80">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-amber-600" />
                  Upcoming Expirations
                </CardTitle>
                <Badge className="bg-amber-100 text-amber-700">
                  {expirations.length} contracts
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {expirations.map((item, i) => (
                  <ExpirationRow key={item.id} item={item} index={i} />
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Pending Approvals Widget */}
      <PendingApprovalsWidget />

      {/* Contract Types Bar Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
      >
        <Card className="border-slate-200/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              Contracts by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData.byType} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" stroke="#64748b" fontSize={12} />
                <YAxis type="category" dataKey="type" stroke="#64748b" fontSize={12} width={80} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px'
                  }}
                />
                <Bar 
                  dataKey="count" 
                  fill="#8b5cf6" 
                  radius={[0, 4, 4, 0]}
                  name="Contracts"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default ProfessionalDashboard;
