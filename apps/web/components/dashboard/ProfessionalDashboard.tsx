'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
  Building
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber, formatDate } from '@/lib/design-tokens';
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

const chartData = {
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

// ============ MAIN COMPONENT ============

export function ProfessionalDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>(mockMetrics);
  const [recentContracts] = useState<RecentContract[]>(mockRecentContracts);
  const [expirations] = useState<UpcomingExpiration[]>(mockExpirations);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

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
          
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

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
        
        <Card className="border-slate-200/80">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{metrics.pendingApprovals}</p>
              <p className="text-xs text-slate-500">Pending approval</p>
            </div>
          </CardContent>
        </Card>
        
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
                <Button variant="ghost" size="sm" className="text-indigo-600">
                  View all
                  <ChevronRight className="h-4 w-4 ml-1" />
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
