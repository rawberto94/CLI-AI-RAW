/**
 * Contract Deadline Tracker
 * Track and manage contract deadlines and renewals
 */

'use client';

import { memo, useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Filter,
  RefreshCw,
  Loader2,
  CalendarDays,
  CalendarClock,
  Plus,
  Edit,
  Trash2,
  MoreVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { format, formatDistanceToNow, differenceInDays, addDays, isPast, isToday } from 'date-fns';

export interface Deadline {
  id: string;
  contractId: string;
  contractName: string;
  type: 'expiration' | 'renewal' | 'review' | 'milestone' | 'payment' | 'custom';
  title: string;
  description?: string;
  dueDate: Date;
  reminderDays: number[];
  status: 'pending' | 'acknowledged' | 'completed' | 'overdue';
  assignee?: string;
  priority: 'high' | 'medium' | 'low';
  notificationsEnabled: boolean;
  createdAt: Date;
}

interface DeadlineTrackerProps {
  contractId?: string;
  className?: string;
  compact?: boolean;
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  expiration: { icon: CalendarClock, color: 'text-red-600', bg: 'bg-red-100', label: 'Expiration' },
  renewal: { icon: RefreshCw, color: 'text-violet-600', bg: 'bg-violet-100', label: 'Renewal' },
  review: { icon: CheckCircle2, color: 'text-violet-600', bg: 'bg-violet-100', label: 'Review' },
  milestone: { icon: Calendar, color: 'text-green-600', bg: 'bg-green-100', label: 'Milestone' },
  payment: { icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-100', label: 'Payment' },
  custom: { icon: CalendarDays, color: 'text-slate-600', bg: 'bg-slate-100', label: 'Custom' },
};

const defaultTypeConfig = { icon: Calendar, color: 'text-slate-600', bg: 'bg-slate-100', label: 'Other' };

const priorityConfig: Record<string, { color: string; label: string }> = {
  high: { color: 'text-red-600 bg-red-100', label: 'High' },
  medium: { color: 'text-yellow-600 bg-yellow-100', label: 'Medium' },
  low: { color: 'text-green-600 bg-green-100', label: 'Low' },
};

// Mock data generator
function generateMockDeadlines(): Deadline[] {
  const deadlines: Deadline[] = [
    {
      id: 'dl_1',
      contractId: 'ctr_001',
      contractName: 'MSA - Acme Corporation',
      type: 'expiration',
      title: 'Contract Expiration',
      description: 'Master Service Agreement expires. Review for renewal.',
      dueDate: addDays(new Date(), 15),
      reminderDays: [30, 14, 7, 1],
      status: 'pending',
      assignee: 'John Doe',
      priority: 'high',
      notificationsEnabled: true,
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'dl_2',
      contractId: 'ctr_002',
      contractName: 'NDA - TechStart Inc',
      type: 'renewal',
      title: 'Renewal Decision Required',
      description: 'Decide whether to renew NDA or let it expire.',
      dueDate: addDays(new Date(), 7),
      reminderDays: [14, 7, 3],
      status: 'acknowledged',
      assignee: 'Jane Smith',
      priority: 'high',
      notificationsEnabled: true,
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'dl_3',
      contractId: 'ctr_003',
      contractName: 'SOW - Project Alpha',
      type: 'milestone',
      title: 'Phase 1 Completion',
      description: 'Review Phase 1 deliverables and approve.',
      dueDate: addDays(new Date(), 3),
      reminderDays: [7, 3, 1],
      status: 'pending',
      priority: 'medium',
      notificationsEnabled: true,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'dl_4',
      contractId: 'ctr_004',
      contractName: 'License Agreement - DataFlow',
      type: 'payment',
      title: 'Annual License Payment Due',
      description: 'Process annual license payment of $50,000.',
      dueDate: addDays(new Date(), 21),
      reminderDays: [30, 14, 7],
      status: 'pending',
      assignee: 'Finance Team',
      priority: 'high',
      notificationsEnabled: true,
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'dl_5',
      contractId: 'ctr_005',
      contractName: 'Vendor Agreement - CloudPro',
      type: 'review',
      title: 'Annual Performance Review',
      description: 'Conduct annual vendor performance review.',
      dueDate: addDays(new Date(), 45),
      reminderDays: [30, 14],
      status: 'pending',
      priority: 'low',
      notificationsEnabled: true,
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'dl_6',
      contractId: 'ctr_006',
      contractName: 'Service Agreement - OldCorp',
      type: 'expiration',
      title: 'Contract Expired',
      dueDate: addDays(new Date(), -5),
      reminderDays: [30, 14, 7],
      status: 'overdue',
      priority: 'high',
      notificationsEnabled: false,
      createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
    },
  ];

  return deadlines;
}

export const DeadlineTracker = memo(function DeadlineTracker({
  contractId,
  className,
  compact = false,
}: DeadlineTrackerProps) {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newDeadline, setNewDeadline] = useState({
    type: 'custom',
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium',
    notificationsEnabled: true,
  });

  useEffect(() => {
    loadDeadlines();
    
  }, [contractId]);

  const loadDeadlines = async () => {
    setLoading(true);
    try {
      const url = contractId 
        ? `/api/contracts/${contractId}/deadlines`
        : '/api/deadlines';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setDeadlines(data.deadlines.map((d: Deadline) => ({
          ...d,
          dueDate: new Date(d.dueDate),
          createdAt: new Date(d.createdAt),
        })));
      } else {
        setDeadlines([]);
      }
    } catch {
      setDeadlines([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredDeadlines = deadlines.filter(deadline => {
    if (typeFilter !== 'all' && deadline.type !== typeFilter) return false;
    if (statusFilter !== 'all' && deadline.status !== statusFilter) return false;
    return true;
  });

  // Sort by due date and status
  const sortedDeadlines = [...filteredDeadlines].sort((a, b) => {
    if (a.status === 'overdue' && b.status !== 'overdue') return -1;
    if (b.status === 'overdue' && a.status !== 'overdue') return 1;
    return a.dueDate.getTime() - b.dueDate.getTime();
  });

  const handleAddDeadline = async () => {
    if (!newDeadline.title || !newDeadline.dueDate) {
      toast.error('Please fill in required fields');
      return;
    }

    const deadline: Deadline = {
      id: `dl_${Date.now()}`,
      contractId: contractId || 'ctr_new',
      contractName: 'Current Contract',
      type: newDeadline.type as Deadline['type'],
      title: newDeadline.title,
      description: newDeadline.description,
      dueDate: new Date(newDeadline.dueDate),
      reminderDays: [30, 14, 7, 1],
      status: 'pending',
      priority: newDeadline.priority as Deadline['priority'],
      notificationsEnabled: newDeadline.notificationsEnabled,
      createdAt: new Date(),
    };

    setDeadlines(prev => [deadline, ...prev]);
    setShowAddDialog(false);
    setNewDeadline({
      type: 'custom',
      title: '',
      description: '',
      dueDate: '',
      priority: 'medium',
      notificationsEnabled: true,
    });
    toast.success('Deadline added');
  };

  const handleStatusChange = (deadlineId: string, newStatus: Deadline['status']) => {
    setDeadlines(prev => prev.map(d => 
      d.id === deadlineId ? { ...d, status: newStatus } : d
    ));
    toast.success(`Status updated to ${newStatus}`);
  };

  const handleDelete = (deadlineId: string) => {
    if (!confirm('Delete this deadline?')) return;
    setDeadlines(prev => prev.filter(d => d.id !== deadlineId));
    toast.success('Deadline deleted');
  };

  const getUrgencyLevel = (deadline: Deadline): 'critical' | 'urgent' | 'soon' | 'normal' => {
    if (deadline.status === 'overdue' || isPast(deadline.dueDate)) return 'critical';
    const days = differenceInDays(deadline.dueDate, new Date());
    if (days <= 3) return 'urgent';
    if (days <= 14) return 'soon';
    return 'normal';
  };

  const urgencyColors: Record<string, string> = {
    critical: 'border-l-red-500 bg-red-50',
    urgent: 'border-l-orange-500 bg-orange-50',
    soon: 'border-l-yellow-500 bg-yellow-50',
    normal: 'border-l-green-500',
  };

  // Stats
  const overdueCount = deadlines.filter(d => d.status === 'overdue' || isPast(d.dueDate)).length;
  const urgentCount = deadlines.filter(d => {
    const days = differenceInDays(d.dueDate, new Date());
    return days >= 0 && days <= 7 && d.status !== 'completed';
  }).length;
  const upcomingCount = deadlines.filter(d => {
    const days = differenceInDays(d.dueDate, new Date());
    return days > 7 && days <= 30 && d.status !== 'completed';
  }).length;

  if (compact) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2 rounded-lg bg-violet-100">
              <Calendar className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <h3 className="font-semibold">Upcoming Deadlines</h3>
              <p className="text-sm text-slate-500">{urgentCount} due within 7 days</p>
            </div>
            {overdueCount > 0 && (
              <Badge variant="destructive" className="ml-auto">
                {overdueCount} Overdue
              </Badge>
            )}
          </div>
          <div className="space-y-2">
            {sortedDeadlines.slice(0, 3).map(deadline => {
              const config = typeConfig[deadline.type] ?? defaultTypeConfig;
              const Icon = config.icon;
              const urgency = getUrgencyLevel(deadline);
              
              return (
                <div
                  key={deadline.id}
                  className={cn(
                    'p-3 rounded-lg border-l-4 flex items-center gap-3',
                    urgencyColors[urgency]
                  )}
                >
                  <Icon className={cn('h-4 w-4', config.color)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{deadline.title}</p>
                    <p className="text-xs text-slate-500">{deadline.contractName}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      'text-xs font-medium',
                      urgency === 'critical' ? 'text-red-600' :
                      urgency === 'urgent' ? 'text-orange-600' : 'text-slate-600'
                    )}>
                      {isPast(deadline.dueDate) 
                        ? `${Math.abs(differenceInDays(deadline.dueDate, new Date()))} days overdue`
                        : isToday(deadline.dueDate)
                        ? 'Today'
                        : `${differenceInDays(deadline.dueDate, new Date())} days`
                      }
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          {deadlines.length > 3 && (
            <Button variant="ghost" size="sm" className="w-full mt-3" asChild>
              <a href="/deadlines">View All Deadlines</a>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-violet-600" />
              Deadline Tracker
            </CardTitle>
            <CardDescription>
              Track and manage important contract dates
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadDeadlines} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Deadline
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Deadline</DialogTitle>
                  <DialogDescription>
                    Create a new deadline or reminder
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={newDeadline.type}
                        onValueChange={(value) => setNewDeadline(prev => ({ ...prev, type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(typeConfig).map(([key, config]) => (
                            <SelectItem key={key} value={key}>{config.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select
                        value={newDeadline.priority}
                        onValueChange={(value) => setNewDeadline(prev => ({ ...prev, priority: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dl-title">Title *</Label>
                    <Input
                      id="dl-title"
                      placeholder="e.g., Contract Renewal Due"
                      value={newDeadline.title}
                      onChange={(e) => setNewDeadline(prev => ({ ...prev, title: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dl-date">Due Date *</Label>
                    <Input
                      id="dl-date"
                      type="date"
                      value={newDeadline.dueDate}
                      onChange={(e) => setNewDeadline(prev => ({ ...prev, dueDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dl-desc">Description</Label>
                    <Input
                      id="dl-desc"
                      placeholder="Optional description"
                      value={newDeadline.description}
                      onChange={(e) => setNewDeadline(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="dl-notify"
                      checked={newDeadline.notificationsEnabled}
                      onCheckedChange={(checked) => setNewDeadline(prev => ({ 
                        ...prev, 
                        notificationsEnabled: !!checked 
                      }))}
                    />
                    <Label htmlFor="dl-notify" className="text-sm">
                      Enable email notifications
                    </Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddDeadline}>
                    Add Deadline
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-red-50 text-center">
            <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-red-600" />
            <p className="text-2xl font-bold text-red-600">{overdueCount}</p>
            <p className="text-xs text-slate-500">Overdue</p>
          </div>
          <div className="p-4 rounded-lg bg-orange-50 text-center">
            <Clock className="h-6 w-6 mx-auto mb-2 text-orange-600" />
            <p className="text-2xl font-bold text-orange-600">{urgentCount}</p>
            <p className="text-xs text-slate-500">Due in 7 days</p>
          </div>
          <div className="p-4 rounded-lg bg-yellow-50 text-center">
            <Calendar className="h-6 w-6 mx-auto mb-2 text-yellow-600" />
            <p className="text-2xl font-bold text-yellow-600">{upcomingCount}</p>
            <p className="text-xs text-slate-500">Due in 30 days</p>
          </div>
          <div className="p-4 rounded-lg bg-green-50 text-center">
            <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-green-600" />
            <p className="text-2xl font-bold text-green-600">
              {deadlines.filter(d => d.status === 'completed').length}
            </p>
            <p className="text-xs text-slate-500">Completed</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(typeConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Deadline List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-violet-600 mr-2" />
            <span>Loading deadlines...</span>
          </div>
        ) : sortedDeadlines.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No deadlines found
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {sortedDeadlines.map(deadline => {
                const config = typeConfig[deadline.type] ?? defaultTypeConfig;
                const Icon = config.icon;
                const urgency = getUrgencyLevel(deadline);
                const daysUntil = differenceInDays(deadline.dueDate, new Date());
                const pConfig = priorityConfig[deadline.priority] ?? { color: 'text-slate-600 bg-slate-100', label: 'Normal' };

                return (
                  <div
                    key={deadline.id}
                    className={cn(
                      'p-4 rounded-lg border-l-4 border',
                      urgencyColors[urgency]
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn('p-2 rounded-lg', config.bg)}>
                        <Icon className={cn('h-5 w-5', config.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{deadline.title}</h4>
                          <Badge variant="outline" className={pConfig.color}>
                            {pConfig.label}
                          </Badge>
                          <Badge variant="outline" className="capitalize">
                            {deadline.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{deadline.contractName}</p>
                        {deadline.description && (
                          <p className="text-sm text-slate-500 mb-2">{deadline.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          <span>Due: {format(deadline.dueDate, 'MMM d, yyyy')}</span>
                          {deadline.assignee && (
                            <span>Assigned: {deadline.assignee}</span>
                          )}
                          {deadline.notificationsEnabled && (
                            <span className="flex items-center gap-1">
                              <Bell className="h-3 w-3" />
                              Notifications on
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn(
                          'text-lg font-bold mb-1',
                          urgency === 'critical' ? 'text-red-600' :
                          urgency === 'urgent' ? 'text-orange-600' :
                          urgency === 'soon' ? 'text-yellow-600' : 'text-green-600'
                        )}>
                          {isPast(deadline.dueDate) 
                            ? `${Math.abs(daysUntil)}d overdue`
                            : isToday(deadline.dueDate)
                            ? 'Today'
                            : `${daysUntil}d`
                          }
                        </p>
                        <div className="flex items-center gap-1">
                          {deadline.status !== 'completed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStatusChange(deadline.id, 'completed')}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleStatusChange(deadline.id, 'acknowledged')}>
                                Acknowledge
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(deadline.id, 'completed')}>
                                Mark Complete
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDelete(deadline.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
});
