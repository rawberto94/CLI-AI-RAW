'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Calendar,
  Bell,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  Users,
  FileText,
  TrendingUp,
  Target,
  Timer,
  Zap,
  MoreVertical,
  Plus,
  Edit2,
  Trash2,
  BellRing,
  CalendarClock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface Obligation {
  id: string;
  title: string;
  description: string;
  contractId: string;
  contractTitle: string;
  assignee: {
    id: string;
    name: string;
    avatar?: string;
  };
  dueDate: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in-progress' | 'completed' | 'overdue';
  category: 'payment' | 'delivery' | 'reporting' | 'compliance' | 'renewal' | 'other';
  reminderDays?: number[];
  completedAt?: Date;
  notes?: string;
}

interface ObligationTrackerProps {
  obligations: Obligation[];
  onUpdateStatus?: (id: string, status: Obligation['status']) => void;
  onAddObligation?: () => void;
  onEditObligation?: (obligation: Obligation) => void;
  onDeleteObligation?: (id: string) => void;
  onSetReminder?: (id: string, days: number[]) => void;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getDaysUntilDue(dueDate: Date): number {
  const now = new Date();
  const due = new Date(dueDate);
  const diffTime = due.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getUrgencyLevel(daysUntilDue: number): 'overdue' | 'critical' | 'warning' | 'upcoming' | 'future' {
  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue <= 3) return 'critical';
  if (daysUntilDue <= 7) return 'warning';
  if (daysUntilDue <= 30) return 'upcoming';
  return 'future';
}

function formatDueDate(dueDate: Date): string {
  const days = getDaysUntilDue(dueDate);
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days <= 7) return `Due in ${days} days`;
  return new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ============================================================================
// Category Icons
// ============================================================================

const categoryIcons: Record<Obligation['category'], React.ReactNode> = {
  payment: <TrendingUp className="w-4 h-4" />,
  delivery: <Target className="w-4 h-4" />,
  reporting: <FileText className="w-4 h-4" />,
  compliance: <AlertTriangle className="w-4 h-4" />,
  renewal: <CalendarClock className="w-4 h-4" />,
  other: <Zap className="w-4 h-4" />,
};

const categoryColors: Record<Obligation['category'], string> = {
  payment: 'text-green-600 bg-green-100',
  delivery: 'text-violet-600 bg-violet-100',
  reporting: 'text-violet-600 bg-violet-100',
  compliance: 'text-amber-600 bg-amber-100',
  renewal: 'text-rose-600 bg-rose-100',
  other: 'text-slate-600 bg-slate-100',
};

const priorityStyles: Record<Obligation['priority'], { bg: string; text: string; border: string }> = {
  low: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  medium: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-300' },
  high: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  critical: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
};

const statusStyles: Record<Obligation['status'], { bg: string; text: string; icon: React.ReactNode }> = {
  pending: { bg: 'bg-slate-100', text: 'text-slate-700', icon: <Clock className="w-4 h-4" /> },
  'in-progress': { bg: 'bg-violet-100', text: 'text-violet-700', icon: <Timer className="w-4 h-4" /> },
  completed: { bg: 'bg-green-100', text: 'text-green-700', icon: <CheckCircle2 className="w-4 h-4" /> },
  overdue: { bg: 'bg-red-100', text: 'text-red-700', icon: <AlertCircle className="w-4 h-4" /> },
};

// ============================================================================
// Obligation Card Component
// ============================================================================

interface ObligationCardProps {
  obligation: Obligation;
  onUpdateStatus?: (status: Obligation['status']) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSetReminder?: (days: number[]) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

function ObligationCard({
  obligation,
  onUpdateStatus,
  onEdit,
  onDelete,
  onSetReminder,
  isExpanded,
  onToggleExpand,
}: ObligationCardProps) {
  const daysUntilDue = getDaysUntilDue(obligation.dueDate);
  const urgency = getUrgencyLevel(daysUntilDue);
  const status = obligation.status === 'completed' ? obligation.status : 
    (daysUntilDue < 0 ? 'overdue' : obligation.status);

  const urgencyColors = {
    overdue: 'border-l-red-500 bg-red-50/50',
    critical: 'border-l-orange-500 bg-orange-50/50',
    warning: 'border-l-amber-500 bg-amber-50/50',
    upcoming: 'border-l-violet-500 bg-violet-50/30',
    future: 'border-l-slate-300 bg-white',
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "rounded-xl border-l-4 shadow-sm transition-all duration-200",
        "hover:shadow-md cursor-pointer",
        urgencyColors[urgency],
        isExpanded ? 'ring-2 ring-indigo-200' : ''
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={onToggleExpand}
                className="p-0.5 hover:bg-slate-100 rounded transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                )}
              </button>
              <div className={cn("p-1.5 rounded-lg", categoryColors[obligation.category])}>
                {categoryIcons[obligation.category]}
              </div>
              <h4 className="font-medium text-slate-900 truncate">{obligation.title}</h4>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge 
                variant="outline" 
                className={cn("gap-1", statusStyles[status].bg, statusStyles[status].text)}
              >
                {statusStyles[status].icon}
                <span className="capitalize">{status.replace('-', ' ')}</span>
              </Badge>
              <Badge 
                variant="outline" 
                className={cn(priorityStyles[obligation.priority].bg, priorityStyles[obligation.priority].text)}
              >
                {obligation.priority.charAt(0).toUpperCase() + obligation.priority.slice(1)}
              </Badge>
              <span className="text-slate-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDueDate(obligation.dueDate)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-white text-xs font-medium">
                    {obligation.assignee.name.charAt(0).toUpperCase()}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{obligation.assignee.name}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Obligation actions">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onUpdateStatus?.('in-progress')}>
                  <Timer className="w-4 h-4 mr-2" />
                  Mark In Progress
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdateStatus?.('completed')}>
                  <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                  Mark Complete
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onSetReminder?.([1, 3, 7])}>
                  <BellRing className="w-4 h-4 mr-2" />
                  Set Reminders
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onEdit}>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-red-600">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div key="expanded"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-slate-200/50">
                <p className="text-sm text-slate-600 mb-3">{obligation.description}</p>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <FileText className="w-4 h-4" />
                    <span>{obligation.contractTitle}</span>
                  </div>
                  {obligation.reminderDays && obligation.reminderDays.length > 0 && (
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Bell className="w-4 h-4" />
                      <span>Reminders: {obligation.reminderDays.join(', ')} days before</span>
                    </div>
                  )}
                </div>
                {obligation.notes && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
                    <strong className="text-slate-700">Notes:</strong> {obligation.notes}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Stats Cards
// ============================================================================

interface StatsCardProps {
  title: string;
  value: number;
  total?: number;
  icon: React.ReactNode;
  color: string;
  trend?: { value: number; direction: 'up' | 'down' };
}

function StatsCard({ title, value, total, icon, color, trend }: StatsCardProps) {
  const percentage = total ? Math.round((value / total) * 100) : 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "relative overflow-hidden rounded-xl p-4 shadow-sm",
        "bg-white border border-slate-200/50"
      )}
    >
      <div className={cn("absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-10", color)} />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-500">{title}</span>
          <div className={cn("p-1.5 rounded-lg", color.replace('bg-', 'bg-').replace('-600', '-100'))}>
            {icon}
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900">{value}</span>
          {total && (
            <span className="text-sm text-slate-400">/ {total}</span>
          )}
        </div>
        {total && (
          <Progress 
            value={percentage} 
            className="h-1.5 mt-2" 
          />
        )}
        {trend && (
          <div className={cn(
            "flex items-center gap-1 mt-2 text-xs",
            trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
          )}>
            <TrendingUp className={cn("w-3 h-3", trend.direction === 'down' && 'rotate-180')} />
            <span>{trend.value}% from last week</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ObligationTracker({
  obligations,
  onUpdateStatus,
  onAddObligation,
  onEditObligation,
  onDeleteObligation,
  onSetReminder,
  className,
}: ObligationTrackerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Calculate stats
  const stats = useMemo(() => {
    const total = obligations.length;
    const completed = obligations.filter(o => o.status === 'completed').length;
    const overdue = obligations.filter(o => {
      const days = getDaysUntilDue(o.dueDate);
      return days < 0 && o.status !== 'completed';
    }).length;
    const dueSoon = obligations.filter(o => {
      const days = getDaysUntilDue(o.dueDate);
      return days >= 0 && days <= 7 && o.status !== 'completed';
    }).length;
    const inProgress = obligations.filter(o => o.status === 'in-progress').length;

    return { total, completed, overdue, dueSoon, inProgress };
  }, [obligations]);

  // Filter obligations
  const filteredObligations = useMemo(() => {
    return obligations.filter(obligation => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !obligation.title.toLowerCase().includes(query) &&
          !obligation.description.toLowerCase().includes(query) &&
          !obligation.contractTitle.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all') {
        const actualStatus = getDaysUntilDue(obligation.dueDate) < 0 && obligation.status !== 'completed' 
          ? 'overdue' 
          : obligation.status;
        if (actualStatus !== statusFilter) return false;
      }

      // Category filter
      if (categoryFilter !== 'all' && obligation.category !== categoryFilter) return false;

      // Priority filter
      if (priorityFilter !== 'all' && obligation.priority !== priorityFilter) return false;

      return true;
    }).sort((a, b) => {
      // Sort by urgency (overdue first, then by due date)
      const aDays = getDaysUntilDue(a.dueDate);
      const bDays = getDaysUntilDue(b.dueDate);
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (b.status === 'completed' && a.status !== 'completed') return -1;
      return aDays - bDays;
    });
  }, [obligations, searchQuery, statusFilter, categoryFilter, priorityFilter]);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="bg-gradient-to-br from-amber-600 via-orange-600 to-red-600 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                <Target className="w-6 h-6" />
              </div>
              Obligation Tracker
            </h2>
            <p className="text-amber-100 mt-1">
              Track and manage contract obligations and deadlines
            </p>
          </div>
          <Button
            onClick={onAddObligation}
            className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
            variant="outline"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Obligation
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="text-3xl font-bold">{stats.total}</div>
            <div className="text-amber-100 text-sm">Total</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="text-3xl font-bold text-green-300">{stats.completed}</div>
            <div className="text-amber-100 text-sm">Completed</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="text-3xl font-bold text-red-300">{stats.overdue}</div>
            <div className="text-amber-100 text-sm">Overdue</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="text-3xl font-bold text-yellow-300">{stats.dueSoon}</div>
            <div className="text-amber-100 text-sm">Due Soon</div>
          </div>
        </div>
      </div>

      {/* Detailed Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          title="Completed"
          value={stats.completed}
          total={stats.total}
          icon={<CheckCircle2 className="w-4 h-4 text-green-600" />}
          color="bg-green-600"
          trend={{ value: 12, direction: 'up' }}
        />
        <StatsCard
          title="In Progress"
          value={stats.inProgress}
          total={stats.total}
          icon={<Timer className="w-4 h-4 text-violet-600" />}
          color="bg-violet-600"
        />
        <StatsCard
          title="Due Soon"
          value={stats.dueSoon}
          total={stats.total}
          icon={<Clock className="w-4 h-4 text-amber-600" />}
          color="bg-amber-600"
        />
        <StatsCard
          title="Overdue"
          value={stats.overdue}
          total={stats.total}
          icon={<AlertCircle className="w-4 h-4 text-red-600" />}
          color="bg-red-600"
        />
      </div>

      {/* Filters */}
      <Card className="shadow-sm border-slate-200/50">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search obligations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="payment">Payment</SelectItem>
                <SelectItem value="delivery">Delivery</SelectItem>
                <SelectItem value="reporting">Reporting</SelectItem>
                <SelectItem value="compliance">Compliance</SelectItem>
                <SelectItem value="renewal">Renewal</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Obligations List */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredObligations.length === 0 ? (
            <motion.div key="filtered-obligations-length"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 bg-white rounded-xl border border-slate-200/50"
            >
              <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-600">No obligations found</h3>
              <p className="text-slate-400 mt-1">
                {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all' || priorityFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Add your first obligation to get started'}
              </p>
              {!searchQuery && statusFilter === 'all' && categoryFilter === 'all' && priorityFilter === 'all' && (
                <Button
                  onClick={onAddObligation}
                  className="mt-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Obligation
                </Button>
              )}
            </motion.div>
          ) : (
            filteredObligations.map((obligation) => (
              <ObligationCard
                key={obligation.id}
                obligation={obligation}
                isExpanded={expandedId === obligation.id}
                onToggleExpand={() => setExpandedId(expandedId === obligation.id ? null : obligation.id)}
                onUpdateStatus={(status) => onUpdateStatus?.(obligation.id, status)}
                onEdit={() => onEditObligation?.(obligation)}
                onDelete={() => onDeleteObligation?.(obligation.id)}
                onSetReminder={(days) => onSetReminder?.(obligation.id, days)}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Footer Summary */}
      {filteredObligations.length > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-500 px-2">
          <span>
            Showing {filteredObligations.length} of {obligations.length} obligations
          </span>
          <span>
            {stats.completed} completed • {stats.inProgress} in progress • {stats.overdue} overdue
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Compact Obligation Widget (for dashboards)
// ============================================================================

interface ObligationWidgetProps {
  obligations: Obligation[];
  maxItems?: number;
  onViewAll?: () => void;
  className?: string;
}

export function ObligationWidget({
  obligations,
  maxItems = 5,
  onViewAll,
  className,
}: ObligationWidgetProps) {
  const urgentObligations = useMemo(() => {
    return obligations
      .filter(o => o.status !== 'completed')
      .sort((a, b) => getDaysUntilDue(a.dueDate) - getDaysUntilDue(b.dueDate))
      .slice(0, maxItems);
  }, [obligations, maxItems]);

  const overdue = obligations.filter(o => 
    getDaysUntilDue(o.dueDate) < 0 && o.status !== 'completed'
  ).length;

  return (
    <Card className={cn("shadow-sm border-slate-200/50", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-500" />
            Upcoming Obligations
          </CardTitle>
          {overdue > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {overdue} overdue
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {urgentObligations.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">
            No upcoming obligations
          </p>
        ) : (
          urgentObligations.map((obligation) => {
            const daysUntilDue = getDaysUntilDue(obligation.dueDate);
            const urgency = getUrgencyLevel(daysUntilDue);
            
            return (
              <div
                key={obligation.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg transition-colors",
                  "hover:bg-slate-50",
                  urgency === 'overdue' && 'bg-red-50',
                  urgency === 'critical' && 'bg-orange-50'
                )}
              >
                <div className={cn("p-1.5 rounded-lg", categoryColors[obligation.category])}>
                  {categoryIcons[obligation.category]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-900 truncate">
                    {obligation.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    {obligation.contractTitle}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs shrink-0",
                    urgency === 'overdue' && 'border-red-300 text-red-700 bg-red-50',
                    urgency === 'critical' && 'border-orange-300 text-orange-700 bg-orange-50',
                    urgency === 'warning' && 'border-amber-300 text-amber-700 bg-amber-50',
                    urgency === 'upcoming' && 'border-violet-300 text-violet-700 bg-violet-50',
                    urgency === 'future' && 'border-slate-300 text-slate-700'
                  )}
                >
                  {formatDueDate(obligation.dueDate)}
                </Badge>
              </div>
            );
          })
        )}
        {onViewAll && (
          <Button
            variant="ghost"
            className="w-full text-sm text-slate-600 hover:text-slate-900"
            onClick={onViewAll}
          >
            View All Obligations
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default ObligationTracker;
