'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
  useDashboardStats, 
  usePendingApprovals, 
  useContractExpirations, 
  useContractHealthScores,
  useCrossModuleInvalidation 
} from '@/hooks/use-queries';

// New Dashboard Widgets
import { 
  RecentActivityWidget, 
  generateDemoActivities 
} from './RecentActivityWidget';
import { 
  FavoriteContractsWidget, 
  generateDemoFavorites 
} from './FavoriteContractsWidget';
import { 
  UpcomingRenewalsWidget, 
  generateDemoRenewals 
} from './UpcomingRenewalsWidget';
import { 
  AIInsightsSummaryWidget, 
  generateDemoInsights, 
  generateDemoMetrics as generateDemoAIMetrics 
} from './AIInsightsSummaryWidget';
import {
  ContractNotificationsWidget,
  generateDemoNotifications,
} from './ContractNotificationsWidget';
import {
  KeyboardShortcutsPanel,
} from './KeyboardShortcutsPanel';
import {
  SavingsTrackerWidget,
  generateDemoSavingsData,
} from './SavingsTrackerWidget';
import {
  TeamActivityWidget,
  generateDemoTeamData,
} from './TeamActivityWidget';
import {
  IntegrationStatusWidget,
  generateDemoIntegrations,
} from './IntegrationStatusWidget';
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

// ============ API FETCH HOOK (React Query) ============

function useDashboardData() {
  const { isMockData } = useDataMode();
  
  // Use React Query hooks for real-time cache invalidation
  const statsQuery = useDashboardStats();
  const approvalsQuery = usePendingApprovals(5);
  const expirationsQuery = useContractExpirations(5);
  const healthQuery = useContractHealthScores();
  
  // Compute derived state from queries
  const { metrics, chartData, expirations } = useMemo(() => {
    // If in demo mode or queries are loading, use mock data
    if (isMockData) {
      return {
        metrics: mockMetrics,
        chartData: mockChartData,
        expirations: mockExpirations,
      };
    }
    
    const statsJson = statsQuery.data;
    const approvalsJson = approvalsQuery.data;
    const expirationsJson = expirationsQuery.data;
    const healthJson = healthQuery.data;
    
    let computedMetrics = mockMetrics;
    let computedChartData = mockChartData;
    let computedExpirations = mockExpirations;
    
    // Map API data to metrics
    if (statsJson?.success && statsJson.data) {
      const d = statsJson.data;
      
      // Use health score data if available
      const avgHealthScore = d.health?.averageScore || healthJson?.data?.stats?.averageScore || 66;
      const riskScore = 100 - avgHealthScore; // Invert health to get risk
      
      computedMetrics = {
        totalContracts: d.overview?.totalContracts ?? mockMetrics.totalContracts,
        activeContracts: d.overview?.activeContracts ?? mockMetrics.activeContracts,
        totalValue: d.overview?.portfolioValue ?? mockMetrics.totalValue,
        avgRiskScore: riskScore,
        pendingApprovals: approvalsJson?.data?.items?.length ?? mockMetrics.pendingApprovals,
        expiringThisMonth: (d.expirations?.criticalRisk + d.expirations?.highRisk) || (d.renewals?.expiringIn30Days ?? mockMetrics.expiringThisMonth),
        contractsThisWeek: d.overview?.recentlyAdded ?? mockMetrics.contractsThisWeek,
        aiProcessingQueue: d.breakdown?.byStatus?.find((s: any) => s.status === 'PROCESSING')?.count ?? 3,
        trends: {
          contracts: mockMetrics.trends.contracts,
          value: mockMetrics.trends.value,
          risk: d.health?.trends?.improving > 0 ? -5 : d.health?.trends?.declining > 0 ? 5 : 0,
          compliance: d.health?.averageScore ? (d.health.averageScore - 60) : mockMetrics.trends.compliance,
        },
      };

      // Map breakdown to chart with health score distribution
      if (d.breakdown?.byType) {
        computedChartData = {
          ...mockChartData,
          byType: d.breakdown.byType.slice(0, 5).map((t: any) => ({
            type: t.type?.substring(0, 10) || 'Other',
            count: t.count,
          })),
        };
      }

      // Map health score distribution to risk chart
      if (d.health?.byAlertLevel) {
        const alertLevels = d.health.byAlertLevel;
        computedChartData = {
          ...computedChartData,
          riskDistribution: [
            { name: 'Low Risk', value: (alertLevels.healthy || 0) + (alertLevels.medium || 0), color: '#10b981' },
            { name: 'Medium Risk', value: alertLevels.high || 0, color: '#f59e0b' },
            { name: 'High Risk', value: alertLevels.critical || 0, color: '#f43f5e' },
          ],
        };
      }
    }

    // Map expirations data to upcoming expirations
    if (expirationsJson?.success && expirationsJson.data?.expirations?.length > 0) {
      computedExpirations = expirationsJson.data.expirations.slice(0, 3).map((e: any, i: number) => ({
        id: e.contractId || String(i + 1),
        name: e.contractName || 'Contract',
        client: e.owner || 'Unknown',
        expiresAt: e.expiryDate,
        daysRemaining: e.daysUntilExpiry || 0,
        value: e.contractValue || 0,
      }));
    }
    
    return { metrics: computedMetrics, chartData: computedChartData, expirations: computedExpirations };
  }, [isMockData, statsQuery.data, approvalsQuery.data, expirationsQuery.data, healthQuery.data]);
  
  const loading = statsQuery.isLoading || approvalsQuery.isLoading || expirationsQuery.isLoading;
  const recentContracts = mockRecentContracts; // Keep mock for now since recent contracts come from stats

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
      <Card className="border-border/60 hover:border-border hover:shadow-md transition-all">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
              )}
              {trend && (
                <div className="flex items-center gap-1 mt-2">
                  {trend.value > 0 ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                  ) : trend.value < 0 ? (
                    <ArrowDownRight className="h-3.5 w-3.5 text-rose-500" />
                  ) : (
                    <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className={cn(
                    "text-xs font-medium",
                    trend.value > 0 ? "text-emerald-600" : trend.value < 0 ? "text-rose-600" : "text-slate-500"
                  )}>
                    {trend.value > 0 ? '+' : ''}{trend.value}%
                  </span>
                  {trend.label && (
                    <span className="text-xs text-muted-foreground">{trend.label}</span>
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
      className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/40 transition-colors group"
    >
      <div className={cn("w-2 h-2 rounded-full shrink-0", riskConfig)} />
      
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
          {contract.name}
        </p>
        <p className="text-xs text-muted-foreground">{formatDate(contract.date)}</p>
      </div>
      
      <Badge className={cn("text-[10px]", statusConfig.bg, statusConfig.text)}>
        <StatusIcon className="h-3 w-3 mr-1" />
        {contract.status}
      </Badge>
      
      {contract.value > 0 && (
        <span className="text-sm font-medium text-foreground tabular-nums">
          {formatCurrency(contract.value)}
        </span>
      )}
      
      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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
      className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/40 transition-colors group"
    >
      <div className={cn("px-2 py-1 rounded-md text-xs font-medium", urgencyColor)}>
        {item.daysRemaining}d
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{item.name}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Building className="h-3 w-3" />
          {item.client}
        </p>
      </div>
      
      <span className="text-sm font-medium text-foreground tabular-nums">
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
    return <span className="text-muted-foreground">{days} days</span>;
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85 }}
      >
        <Card className="border-border/60">
          <CardContent className="p-8">
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-muted/40 rounded-lg" />
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
        <Card className="border-border/60 bg-muted/40">
          <CardContent className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">All caught up!</h3>
            <p className="text-sm text-muted-foreground">No pending approvals at the moment.</p>
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
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              Pending Approvals
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-primary" asChild>
              <Link href="/approvals">
                View all
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/60">
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
                    className="flex items-center gap-4 p-3 hover:bg-muted/40 transition-colors group"
                  >
                    <div className={cn("p-2 rounded-lg", priorityConfig.bg)}>
                      <TypeIcon className={cn("h-4 w-4", priorityConfig.text)} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {approval.title}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>by {approval.requestedBy}</span>
                        <span>•</span>
                        <span className="capitalize">{approval.type}</span>
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Due</div>
                      <div className="text-sm font-medium">
                        {formatDueDate(approval.dueDate)}
                      </div>
                    </div>
                    
                    {approval.value && approval.value > 0 && (
                      <span className="text-sm font-semibold text-foreground tabular-nums">
                        {formatCurrency(approval.value)}
                      </span>
                    )}
                    
                    <Badge className={cn("text-[10px]", priorityConfig.bg, priorityConfig.text, priorityConfig.border)}>
                      {approval.priority}
                    </Badge>
                    
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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

// ============ PORTFOLIO HEALTH WIDGET ============

function PortfolioHealthWidget() {
  const [healthData, setHealthData] = useState<{
    averageScore: number;
    byAlertLevel: { critical: number; high: number; medium: number; healthy: number };
    trends: { improving: number; declining: number };
    contractsWithScores: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch('/api/contracts/health-scores');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.stats) {
            setHealthData({
              averageScore: data.data.stats.averageScore || 0,
              byAlertLevel: {
                critical: data.data.stats.byAlertLevel?.critical || 0,
                high: data.data.stats.byAlertLevel?.high || 0,
                medium: data.data.stats.byAlertLevel?.medium || 0,
                healthy: data.data.stats.byAlertLevel?.healthy || 0,
              },
              trends: {
                improving: data.data.stats.trends?.improving || 0,
                declining: data.data.stats.trends?.declining || 0,
              },
              contractsWithScores: data.data.stats.total || 0,
            });
          }
        }
      } catch (error) {
        console.log('Health data fetch error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchHealth();
  }, []);

  if (loading || !healthData) {
    return null;
  }

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-green-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 75) return 'from-green-500 to-emerald-500';
    if (score >= 50) return 'from-amber-500 to-orange-500';
    return 'from-red-500 to-rose-500';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.82 }}
    >
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Portfolio Health
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-primary" asChild>
              <Link href="/intelligence/health">
                Details
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            {/* Score Ring */}
            <div className="relative">
              <div className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center bg-gradient-to-br shadow-lg",
                getScoreBg(healthData.averageScore)
              )}>
                <div className="w-14 h-14 rounded-full bg-background flex items-center justify-center">
                  <span className={cn("text-2xl font-bold", getScoreColor(healthData.averageScore))}>
                    {healthData.averageScore}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Stats */}
            <div className="flex-1 grid grid-cols-2 gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <div className="text-xl font-bold text-green-600">{healthData.byAlertLevel.healthy}</div>
                <div className="text-xs text-green-600">Healthy</div>
              </div>
              <div className="p-2 bg-amber-50 rounded-lg">
                <div className="text-xl font-bold text-amber-600">{healthData.byAlertLevel.medium}</div>
                <div className="text-xs text-amber-600">Medium</div>
              </div>
              <div className="p-2 bg-orange-50 rounded-lg">
                <div className="text-xl font-bold text-orange-600">{healthData.byAlertLevel.high}</div>
                <div className="text-xs text-orange-600">High Risk</div>
              </div>
              <div className="p-2 bg-red-50 rounded-lg">
                <div className="text-xl font-bold text-red-600">{healthData.byAlertLevel.critical}</div>
                <div className="text-xs text-red-600">Critical</div>
              </div>
            </div>
          </div>
          
          {/* Trends */}
          <div className="mt-4 pt-4 border-t border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-sm">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-green-600 font-medium">{healthData.trends.improving}</span>
                <span className="text-muted-foreground">improving</span>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <TrendingDown className="h-4 w-4 text-red-500" />
                <span className="text-red-600 font-medium">{healthData.trends.declining}</span>
                <span className="text-muted-foreground">declining</span>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">{healthData.contractsWithScores} contracts scored</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============ MAIN COMPONENT ============

export function ProfessionalDashboard() {
  const router = useRouter();
  const { metrics, chartData, recentContracts, expirations, loading } = useDashboardData();
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d');
  
  // Demo data for new widgets (replace with API calls in production)
  const [favoriteContracts] = useState(() => generateDemoFavorites(5));
  const [recentActivity] = useState(() => generateDemoActivities(10));
  const [upcomingRenewals] = useState(() => generateDemoRenewals(6));
  const [aiInsights] = useState(() => generateDemoInsights(6));
  const [aiMetrics] = useState(() => generateDemoAIMetrics());
  const [notifications] = useState(() => generateDemoNotifications(12));
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  
  // New widget data
  const [savingsData] = useState(() => generateDemoSavingsData());
  const [teamData] = useState(() => generateDemoTeamData());
  const [integrations] = useState(() => generateDemoIntegrations());

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
      <div className="space-y-6" aria-live="polite" aria-busy="true">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-muted/40 animate-pulse rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-muted/40 animate-pulse rounded-xl" />
          <div className="h-80 bg-muted/40 animate-pulse rounded-xl" />
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
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 className="text-xl font-semibold text-foreground">Intelligence</h2>
          <p className="text-sm text-muted-foreground">Contract analytics and AI insights</p>
        </div>
        
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="inline-flex gap-1 p-1 bg-muted rounded-md" role="group" aria-label="Timeframe">
            {(['7d', '30d', '90d'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                type="button"
                aria-pressed={timeframe === tf}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
                  timeframe === tf 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tf === '7d' ? '7 Days' : tf === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="icon" onClick={handleRefresh} aria-label="Refresh dashboard">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
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
          <Card className="border-border/60">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-100">
              <Zap className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
                <p className="text-2xl font-bold text-foreground">{metrics.contractsThisWeek}</p>
                <p className="text-xs text-muted-foreground">This week</p>
            </div>
          </CardContent>
        </Card>
        
        <Link href="/approvals">
            <Card className="border-border/60 hover:border-border hover:shadow-md transition-all cursor-pointer group">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 group-hover:bg-amber-200 transition-colors">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                  <p className="text-2xl font-bold text-foreground">{metrics.pendingApprovals}</p>
                  <p className="text-xs text-muted-foreground">Pending approval</p>
              </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardContent>
          </Card>
        </Link>
        
          <Card className="border-border/60">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-100">
              <Calendar className="h-5 w-5 text-rose-600" />
            </div>
            <div>
                <p className="text-2xl font-bold text-foreground">{metrics.expiringThisMonth}</p>
                <p className="text-xs text-muted-foreground">Expiring soon</p>
            </div>
          </CardContent>
        </Card>
        
          <Card className="border-border/60">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100">
              <Target className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
                <p className="text-2xl font-bold text-foreground">{Math.round(metrics.trends.compliance)}%</p>
                <p className="text-xs text-muted-foreground">Compliance rate</p>
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
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Contract Activity
                </CardTitle>
                <Badge variant="secondary">Last 6 months</Badge>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))',
                      color: 'hsl(var(--popover-foreground))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
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
          <Card className="border-border/60 h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-primary" />
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
                    <span className="text-xs text-muted-foreground">{item.name}</span>
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
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Recent Contracts
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-primary" asChild>
                  <Link href="/contracts">
                    View all
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/60">
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
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Upcoming Expirations
                </CardTitle>
                <Badge variant="secondary">{expirations.length} contracts</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/60">
                {expirations.map((item, i) => (
                  <ExpirationRow key={item.id} item={item} index={i} />
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Portfolio Health & Pending Approvals Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PortfolioHealthWidget />
        <PendingApprovalsWidget />
      </div>

      {/* Notifications & AI Insights Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ContractNotificationsWidget
          notifications={notifications}
          maxHeight={320}
          onMarkRead={(id) => console.log('Mark read:', id)}
          onMarkAllRead={() => console.log('Mark all read')}
          onDelete={(id) => console.log('Delete:', id)}
          onAction={(n) => router.push(n.actionUrl || `/contracts/${n.contractId}`)}
        />
        <div className="lg:col-span-2">
          <AIInsightsSummaryWidget
            insights={aiInsights}
            metrics={aiMetrics}
            maxInsights={4}
            showMetrics={true}
          />
        </div>
      </div>

      {/* Favorites & Renewals Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FavoriteContractsWidget
          contracts={favoriteContracts}
          maxDisplay={5}
          showSearch={false}
          showQuickActions={true}
        />
        <UpcomingRenewalsWidget
          renewals={upcomingRenewals}
          maxItems={4}
          showFilters={true}
        />
      </div>

      {/* Activity Row */}
      <div className="grid grid-cols-1 gap-6">
        <RecentActivityWidget
          activities={recentActivity}
          maxItems={6}
          showFilters={false}
          variant="card"
        />
      </div>

      {/* Savings, Team & Integrations Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SavingsTrackerWidget
          data={savingsData}
          period="quarter"
          onViewDetails={() => router.push('/analytics/savings')}
          onOpportunityClick={(opp) => opp.contractId && router.push(`/contracts/${opp.contractId}`)}
        />
        <TeamActivityWidget
          activities={teamData.activities}
          teamMembers={teamData.members}
          onActivityClick={(activity) => activity.targetId && router.push(`/contracts/${activity.targetId}`)}
          onViewAll={() => router.push('/activity')}
        />
        <IntegrationStatusWidget
          integrations={integrations}
          onRefresh={(id) => console.log('Refresh integration:', id)}
          onSettings={(id) => router.push(`/settings/integrations/${id}`)}
          onViewAll={() => router.push('/settings/integrations')}
        />
      </div>

      {/* Contract Types Bar Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
      >
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Contracts by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData.byType} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis type="category" dataKey="type" stroke="hsl(var(--muted-foreground))" fontSize={12} width={80} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))',
                    color: 'hsl(var(--popover-foreground))',
                    border: '1px solid hsl(var(--border))',
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

      {/* Keyboard Shortcuts Panel */}
      <KeyboardShortcutsPanel
        open={showKeyboardShortcuts}
        onOpenChange={setShowKeyboardShortcuts}
      />
    </div>
  );
}

export default ProfessionalDashboard;
