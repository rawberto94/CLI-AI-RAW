'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ListChecks,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Calendar,
  Search,
  Filter,
  Download,
  RefreshCw,
  Bell,
  BellRing,
  Eye,
  ChevronRight,
  Loader2,
  TrendingUp,
  FileText,
  Users,
  DollarSign,
  Shield,
  Scale,
  Zap,
  Target,
  ArrowUpRight,
  Timer,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type ObligationType = 
  | 'payment' | 'delivery' | 'reporting' | 'compliance' | 'confidentiality'
  | 'indemnification' | 'insurance' | 'warranty' | 'termination_notice'
  | 'renewal_notice' | 'audit_rights' | 'data_protection' | 'performance';

type ObligationStatus = 'pending' | 'in_progress' | 'completed' | 'overdue' | 'at_risk' | 'waived';
type ObligationPriority = 'critical' | 'high' | 'medium' | 'low';

interface Obligation {
  id: string;
  type: ObligationType;
  title: string;
  description: string;
  contractId: string;
  contractName: string;
  party: 'us' | 'counterparty' | 'mutual';
  status: ObligationStatus;
  priority: ObligationPriority;
  dueDate?: Date;
  completedDate?: Date;
  amount?: number;
  frequency?: 'one_time' | 'recurring' | 'ongoing';
  assignedTo?: string;
  confidence: number;
  sourceClause?: string;
  createdAt: Date;
}

interface ObligationAlert {
  id: string;
  obligationId: string;
  type: 'approaching_deadline' | 'overdue' | 'status_change' | 'new_obligation';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  acknowledged: boolean;
  createdAt: Date;
}

interface ObligationSummary {
  total: number;
  byStatus: Record<ObligationStatus, number>;
  byType: Record<ObligationType, number>;
  byPriority: Record<ObligationPriority, number>;
  upcomingThisWeek: number;
  upcomingThisMonth: number;
  overdue: number;
  complianceRate: number;
}

interface ObligationTrackerDashboardProps {
  tenantId: string;
  contractId?: string;
  className?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const OBLIGATION_TYPE_CONFIG: Record<ObligationType, {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  label: string;
}> = {
  payment: { icon: DollarSign, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Payment' },
  delivery: { icon: Target, color: 'text-violet-600', bgColor: 'bg-violet-100', label: 'Delivery' },
  reporting: { icon: FileText, color: 'text-violet-600', bgColor: 'bg-violet-100', label: 'Reporting' },
  compliance: { icon: Shield, color: 'text-violet-600', bgColor: 'bg-violet-100', label: 'Compliance' },
  confidentiality: { icon: Shield, color: 'text-slate-600', bgColor: 'bg-slate-100', label: 'Confidentiality' },
  indemnification: { icon: Scale, color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'Indemnification' },
  insurance: { icon: Shield, color: 'text-violet-600', bgColor: 'bg-violet-100', label: 'Insurance' },
  warranty: { icon: CheckCircle2, color: 'text-violet-600', bgColor: 'bg-violet-100', label: 'Warranty' },
  termination_notice: { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Termination Notice' },
  renewal_notice: { icon: RefreshCw, color: 'text-orange-600', bgColor: 'bg-orange-100', label: 'Renewal Notice' },
  audit_rights: { icon: Eye, color: 'text-violet-600', bgColor: 'bg-violet-100', label: 'Audit Rights' },
  data_protection: { icon: Shield, color: 'text-pink-600', bgColor: 'bg-pink-100', label: 'Data Protection' },
  performance: { icon: Zap, color: 'text-yellow-600', bgColor: 'bg-yellow-100', label: 'Performance' },
};

const STATUS_CONFIG: Record<ObligationStatus, {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  label: string;
}> = {
  pending: { icon: Clock, color: 'text-slate-600', bgColor: 'bg-slate-100', label: 'Pending' },
  in_progress: { icon: Timer, color: 'text-violet-600', bgColor: 'bg-violet-100', label: 'In Progress' },
  completed: { icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Completed' },
  overdue: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Overdue' },
  at_risk: { icon: AlertTriangle, color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'At Risk' },
  waived: { icon: CheckCircle2, color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Waived' },
};

const PRIORITY_CONFIG: Record<ObligationPriority, {
  color: string;
  bgColor: string;
}> = {
  critical: { color: 'text-red-700', bgColor: 'bg-red-100 border-red-300' },
  high: { color: 'text-orange-700', bgColor: 'bg-orange-100 border-orange-300' },
  medium: { color: 'text-amber-700', bgColor: 'bg-amber-100 border-amber-300' },
  low: { color: 'text-violet-700', bgColor: 'bg-violet-100 border-violet-300' },
};

// ============================================================================
// Demo Data Generators
// ============================================================================

function generateDemoObligations(count: number): Obligation[] {
  const types = Object.keys(OBLIGATION_TYPE_CONFIG) as ObligationType[];
  const statuses: ObligationStatus[] = ['pending', 'in_progress', 'completed', 'overdue', 'at_risk'];
  const priorities: ObligationPriority[] = ['critical', 'high', 'medium', 'low'];
  const parties: Obligation['party'][] = ['us', 'counterparty', 'mutual'];
  
  const titles: Record<ObligationType, string[]> = {
    payment: ['Monthly service payment', 'Quarterly license fee', 'Annual maintenance fee'],
    delivery: ['Deliver Phase 1 milestone', 'Provide monthly deliverables', 'Submit final project'],
    reporting: ['Monthly status report', 'Quarterly financial report', 'Annual compliance report'],
    compliance: ['GDPR compliance certification', 'SOC 2 audit completion', 'Security assessment'],
    confidentiality: ['Maintain NDA terms', 'Secure data handling', 'Employee training completion'],
    indemnification: ['Third-party claims coverage', 'IP infringement indemnity', 'Data breach liability'],
    insurance: ['Maintain liability insurance', 'Provide certificate of insurance', 'Renew coverage'],
    warranty: ['Product warranty obligations', 'Service level guarantee', 'Defect remediation'],
    termination_notice: ['60-day termination notice', '90-day notice requirement', 'End of term notification'],
    renewal_notice: ['Auto-renewal opt-out deadline', 'Contract renewal decision', 'Rate negotiation window'],
    audit_rights: ['Annual audit compliance', 'Provide audit access', 'Documentation availability'],
    data_protection: ['Data encryption requirements', 'Privacy policy compliance', 'Data retention limits'],
    performance: ['SLA compliance', 'Uptime guarantee', 'Response time requirements'],
  };

  const obligations: Obligation[] = [];
  
  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const priority = priorities[Math.floor(Math.random() * priorities.length)];
    const typeTitles = titles[type];
    
    const daysOffset = Math.floor(Math.random() * 90) - 30; // -30 to +60 days
    const dueDate = new Date(Date.now() + daysOffset * 24 * 60 * 60 * 1000);
    
    obligations.push({
      id: `obligation-${i + 1}`,
      type,
      title: typeTitles[Math.floor(Math.random() * typeTitles.length)],
      description: `AI-extracted obligation from contract clause...`,
      contractId: `contract-${Math.floor(Math.random() * 20) + 1}`,
      contractName: `Contract ${Math.floor(Math.random() * 20) + 1}`,
      party: parties[Math.floor(Math.random() * parties.length)],
      status,
      priority,
      dueDate: status !== 'completed' ? dueDate : undefined,
      completedDate: status === 'completed' ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) : undefined,
      amount: type === 'payment' ? Math.floor(Math.random() * 100000) + 10000 : undefined,
      frequency: ['one_time', 'recurring', 'ongoing'][Math.floor(Math.random() * 3)] as Obligation['frequency'],
      confidence: 0.75 + Math.random() * 0.24,
      sourceClause: `Section ${Math.floor(Math.random() * 10) + 1}.${Math.floor(Math.random() * 5) + 1}`,
      createdAt: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000),
    });
  }
  
  return obligations.sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });
}

function generateDemoAlerts(obligations: Obligation[]): ObligationAlert[] {
  const alerts: ObligationAlert[] = [];
  const now = new Date();
  
  obligations.forEach(ob => {
    if (ob.status === 'overdue') {
      alerts.push({
        id: `alert-overdue-${ob.id}`,
        obligationId: ob.id,
        type: 'overdue',
        severity: 'critical',
        message: `"${ob.title}" is overdue`,
        acknowledged: false,
        createdAt: now,
      });
    } else if (ob.dueDate && ob.dueDate.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000) {
      alerts.push({
        id: `alert-approaching-${ob.id}`,
        obligationId: ob.id,
        type: 'approaching_deadline',
        severity: ob.priority === 'critical' ? 'critical' : 'warning',
        message: `"${ob.title}" due in ${Math.ceil((ob.dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))} days`,
        acknowledged: false,
        createdAt: now,
      });
    }
  });
  
  return alerts.slice(0, 10);
}

function generateDemoSummary(obligations: Obligation[]): ObligationSummary {
  const now = new Date();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const oneMonth = 30 * 24 * 60 * 60 * 1000;
  
  const byStatus = obligations.reduce((acc, ob) => {
    acc[ob.status] = (acc[ob.status] || 0) + 1;
    return acc;
  }, {} as Record<ObligationStatus, number>);
  
  const byType = obligations.reduce((acc, ob) => {
    acc[ob.type] = (acc[ob.type] || 0) + 1;
    return acc;
  }, {} as Record<ObligationType, number>);
  
  const byPriority = obligations.reduce((acc, ob) => {
    acc[ob.priority] = (acc[ob.priority] || 0) + 1;
    return acc;
  }, {} as Record<ObligationPriority, number>);
  
  const upcomingThisWeek = obligations.filter(ob => 
    ob.dueDate && ob.dueDate.getTime() > now.getTime() && 
    ob.dueDate.getTime() <= now.getTime() + oneWeek
  ).length;
  
  const upcomingThisMonth = obligations.filter(ob => 
    ob.dueDate && ob.dueDate.getTime() > now.getTime() && 
    ob.dueDate.getTime() <= now.getTime() + oneMonth
  ).length;
  
  const completed = obligations.filter(ob => ob.status === 'completed').length;
  const complianceRate = obligations.length > 0 ? (completed / obligations.length) * 100 : 0;
  
  return {
    total: obligations.length,
    byStatus,
    byType,
    byPriority,
    upcomingThisWeek,
    upcomingThisMonth,
    overdue: byStatus.overdue || 0,
    complianceRate,
  };
}

// ============================================================================
// Sub-Components
// ============================================================================

function StatCard({ 
  title, 
  value, 
  subtitle,
  icon: Icon, 
  color = 'blue',
  trend,
}: { 
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple';
  trend?: { value: number; label: string };
}) {
  const colorClasses = {
    blue: 'from-violet-500 to-purple-500 text-violet-600 bg-violet-50',
    green: 'from-violet-500 to-violet-500 text-green-600 bg-green-50',
    amber: 'from-amber-500 to-orange-500 text-amber-600 bg-amber-50',
    red: 'from-red-500 to-rose-500 text-red-600 bg-red-50',
    purple: 'from-violet-500 to-purple-500 text-violet-600 bg-violet-50',
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
            {trend && (
              <div className={cn('flex items-center gap-1 mt-1 text-xs', trend.value >= 0 ? 'text-green-600' : 'text-red-600')}>
                <TrendingUp className={cn('w-3 h-3', trend.value < 0 && 'rotate-180')} />
                <span>{trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}</span>
              </div>
            )}
          </div>
          <div className={cn('p-2 rounded-lg', colorClasses[color].split(' ').slice(2).join(' '))}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ObligationCard({ 
  obligation, 
  onView 
}: { 
  obligation: Obligation; 
  onView: () => void;
}) {
  const typeConfig = OBLIGATION_TYPE_CONFIG[obligation.type];
  const statusConfig = STATUS_CONFIG[obligation.status];
  const priorityConfig = PRIORITY_CONFIG[obligation.priority];
  const TypeIcon = typeConfig.icon;
  const StatusIcon = statusConfig.icon;

  const getDaysUntilDue = () => {
    if (!obligation.dueDate) return null;
    const days = Math.ceil((obligation.dueDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    return days;
  };

  const daysUntilDue = getDaysUntilDue();

  return (
    <Card className={cn(
      'hover:shadow-md transition-shadow cursor-pointer',
      obligation.status === 'overdue' && 'border-red-300 bg-red-50/30',
      obligation.status === 'at_risk' && 'border-amber-300 bg-amber-50/30',
    )}>
      <CardContent className="p-5" onClick={onView}>
        <div className="flex items-start gap-3">
          {/* Type Icon */}
          <div className={cn('p-2 rounded-lg shrink-0', typeConfig.bgColor)}>
            <TypeIcon className={cn('w-6 h-6', typeConfig.color)} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={cn('text-xs', priorityConfig.bgColor, priorityConfig.color)} variant="outline">
                {obligation.priority}
              </Badge>
              <Badge className={cn('text-xs', statusConfig.bgColor)} variant="outline">
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConfig.label}
              </Badge>
            </div>

            <h4 className="font-medium text-sm mb-1">{obligation.title}</h4>
            
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {obligation.contractName}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {obligation.party === 'us' ? 'Our Obligation' : obligation.party === 'counterparty' ? 'Their Obligation' : 'Mutual'}
              </span>
              {obligation.amount && (
                <span className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  ${obligation.amount.toLocaleString()}
                </span>
              )}
            </div>

            {/* Due Date */}
            {obligation.dueDate && (
              <div className={cn(
                'flex items-center gap-1 mt-2 text-xs font-medium',
                daysUntilDue !== null && daysUntilDue < 0 ? 'text-red-600' :
                daysUntilDue !== null && daysUntilDue <= 7 ? 'text-amber-600' :
                'text-muted-foreground'
              )}>
                <Calendar className="w-3 h-3" />
                {daysUntilDue !== null && daysUntilDue < 0 
                  ? `${Math.abs(daysUntilDue)} days overdue`
                  : daysUntilDue === 0 
                    ? 'Due today'
                    : `Due in ${daysUntilDue} days`
                }
                <span className="text-muted-foreground ml-1">
                  ({obligation.dueDate.toLocaleDateString()})
                </span>
              </div>
            )}

            {/* Confidence */}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground">AI Confidence:</span>
              <Progress value={obligation.confidence * 100} className="h-1.5 w-20" />
              <span className="text-xs font-medium">{(obligation.confidence * 100).toFixed(0)}%</span>
            </div>
          </div>

          {/* Action */}
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

function AlertItem({ alert, onAcknowledge }: { alert: ObligationAlert; onAcknowledge: () => void }) {
  const severityConfig = {
    info: { icon: Bell, color: 'text-violet-600 bg-violet-50 border-violet-200' },
    warning: { icon: AlertTriangle, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    critical: { icon: BellRing, color: 'text-red-600 bg-red-50 border-red-200' },
  };

  const config = severityConfig[alert.severity];
  const Icon = config.icon;

  return (
    <div className={cn(
      'flex items-start gap-3 p-3 rounded-lg border',
      config.color,
      alert.acknowledged && 'opacity-50'
    )}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{alert.message}</p>
        <p className="text-xs opacity-70 mt-0.5">{alert.createdAt.toLocaleString()}</p>
      </div>
      {!alert.acknowledged && (
        <Button variant="ghost" size="sm" onClick={onAcknowledge} className="shrink-0">
          Acknowledge
        </Button>
      )}
    </div>
  );
}

function ComplianceGauge({ rate }: { rate: number }) {
  const getColor = (r: number) => {
    if (r >= 90) return 'text-green-500';
    if (r >= 70) return 'text-amber-500';
    return 'text-red-500';
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="10"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeDasharray={`${rate * 2.51} 251`}
            strokeLinecap="round"
            className={cn('transition-all duration-500', getColor(rate))}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-2xl font-bold', getColor(rate))}>{rate.toFixed(0)}%</span>
          <span className="text-xs text-muted-foreground">Compliance</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ObligationTrackerDashboard({ tenantId, contractId, className }: ObligationTrackerDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [alerts, setAlerts] = useState<ObligationAlert[]>([]);
  const [summary, setSummary] = useState<ObligationSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const demoObligations = generateDemoObligations(30);
      setObligations(demoObligations);
      setAlerts(generateDemoAlerts(demoObligations));
      setSummary(generateDemoSummary(demoObligations));
      setLoading(false);
    };
    loadData();
  }, [tenantId, contractId]);

  const filteredObligations = obligations.filter(ob => {
    if (typeFilter !== 'all' && ob.type !== typeFilter) return false;
    if (statusFilter !== 'all' && ob.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && ob.priority !== priorityFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return ob.title.toLowerCase().includes(query) || 
             ob.contractName.toLowerCase().includes(query) ||
             ob.type.includes(query);
    }
    return true;
  });

  const handleAcknowledgeAlert = (alertId: string) => {
    setAlerts(prev => prev.map(a => 
      a.id === alertId ? { ...a, acknowledged: true } : a
    ));
  };

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center min-h-[400px]', className)}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground mt-2">Loading obligations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListChecks className="w-6 h-6 text-primary" />
            Obligation Tracker
          </h1>
          <p className="text-muted-foreground text-sm">AI-powered obligation extraction and compliance monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Re-scan Contracts
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-5">
          <StatCard
            title="Total Obligations"
            value={summary.total}
            icon={ListChecks}
            color="blue"
          />
          <StatCard
            title="Due This Week"
            value={summary.upcomingThisWeek}
            subtitle="Requires attention"
            icon={Clock}
            color="amber"
          />
          <StatCard
            title="Overdue"
            value={summary.overdue}
            icon={AlertTriangle}
            color="red"
          />
          <StatCard
            title="Completed"
            value={summary.byStatus.completed || 0}
            icon={CheckCircle2}
            color="green"
          />
          <Card className="flex items-center justify-center">
            <ComplianceGauge rate={summary.complianceRate} />
          </Card>
        </div>
      )}

      {/* Alerts Banner */}
      {alerts.filter(a => !a.acknowledged).length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium flex items-center gap-2 text-amber-800">
                <BellRing className="w-4 h-4" />
                Active Alerts ({alerts.filter(a => !a.acknowledged).length})
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setAlerts(prev => prev.map(a => ({ ...a, acknowledged: true })))}>
                Acknowledge All
              </Button>
            </div>
            <div className="space-y-2">
              {alerts.filter(a => !a.acknowledged).slice(0, 3).map(alert => (
                <AlertItem 
                  key={alert.id} 
                  alert={alert} 
                  onAcknowledge={() => handleAcknowledgeAlert(alert.id)} 
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="obligations">All Obligations</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Upcoming Deadlines */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Upcoming Deadlines
                </CardTitle>
                <CardDescription>Obligations due in the next 14 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {obligations
                    .filter(ob => ob.dueDate && ob.status !== 'completed')
                    .slice(0, 5)
                    .map(ob => (
                      <ObligationCard 
                        key={ob.id} 
                        obligation={ob}
                        onView={() => {}}
                      />
                    ))
                  }
                </div>
              </CardContent>
            </Card>

            {/* By Type Breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Obligations by Type</CardTitle>
                <CardDescription>Distribution across obligation categories</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {summary && Object.entries(summary.byType)
                    .filter(([, count]) => count > 0)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 6)
                    .map(([type, count]) => {
                      const config = OBLIGATION_TYPE_CONFIG[type as ObligationType];
                      const Icon = config.icon;
                      const percentage = (count / summary.total) * 100;
                      
                      return (
                        <div key={type} className="flex items-center gap-3">
                          <div className={cn('p-1.5 rounded', config.bgColor)}>
                            <Icon className={cn('w-4 h-4', config.color)} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="font-medium">{config.label}</span>
                              <span className="text-muted-foreground">{count}</span>
                            </div>
                            <Progress value={percentage} className="h-1.5" />
                          </div>
                        </div>
                      );
                    })
                  }
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Overdue Section */}
          {summary && summary.overdue > 0 && (
            <Card className="border-red-300">
              <CardHeader className="pb-2 bg-red-50">
                <CardTitle className="text-base flex items-center gap-2 text-red-700">
                  <XCircle className="w-4 h-4" />
                  Overdue Obligations ({summary.overdue})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid gap-3 md:grid-cols-2">
                  {obligations
                    .filter(ob => ob.status === 'overdue')
                    .slice(0, 4)
                    .map(ob => (
                      <ObligationCard 
                        key={ob.id} 
                        obligation={ob}
                        onView={() => {}}
                      />
                    ))
                  }
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* All Obligations Tab */}
        <TabsContent value="obligations" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search obligations..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[160px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {Object.entries(OBLIGATION_TYPE_CONFIG).map(([type, config]) => (
                      <SelectItem key={type} value={type}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                      <SelectItem key={status} value={status}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Obligations Grid */}
          <div className="grid gap-3 md:grid-cols-2">
            {filteredObligations.length > 0 ? (
              filteredObligations.map(ob => (
                <ObligationCard 
                  key={ob.id} 
                  obligation={ob}
                  onView={() => {}}
                />
              ))
            ) : (
              <Card className="md:col-span-2">
                <CardContent className="py-12 text-center">
                  <ListChecks className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="font-medium">No obligations match your filters</p>
                  <p className="text-sm text-muted-foreground">Try adjusting your search criteria</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar">
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="font-medium">Calendar View</p>
              <p className="text-sm text-muted-foreground">Interactive obligation calendar coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <Card>
            <CardContent className="py-12 text-center">
              <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="font-medium">Obligation Analytics</p>
              <p className="text-sm text-muted-foreground">Trends and compliance analytics coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ObligationTrackerDashboard;
