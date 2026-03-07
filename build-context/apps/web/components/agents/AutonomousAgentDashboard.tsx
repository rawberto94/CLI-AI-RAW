/**
 * Autonomous Agent Dashboard
 * 
 * Monitor and manage autonomous agent goals, triggers, and notifications
 * Shows real-time status of proactive AI agents working in the background
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Target,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Pause,
  Plus,
  Bell,
  Settings,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Eye,
  Calendar,
  TrendingUp as _TrendingUp,
  Shield,
  DollarSign,
  FileText,
  Loader2,
  MoreVertical,
  History,
  Brain
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription as _CardDescription, CardHeader as _CardHeader, CardTitle as _CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger as _DialogTrigger,
} from '@/components/ui/dialog';
import { Input as _Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ============================================================================
// TYPES
// ============================================================================

interface OrchestratorStatus {
  isRunning: boolean;
  processingGoal: string | null;
  queueLength: number;
  activeGoals: AgentGoal[];
  completedToday: number;
  failedToday: number;
}

interface AgentGoal {
  id: string;
  tenantId: string;
  type: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low' | 'background';
  status: 'pending' | 'planning' | 'executing' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled';
  trigger: {
    type: string;
    source: string;
  };
  plan?: {
    steps: PlanStep[];
    estimatedDuration: number;
    riskAssessment: {
      level: 'low' | 'medium' | 'high' | 'critical';
      requiresHumanApproval: boolean;
    };
  };
  result?: {
    success: boolean;
    summary: string;
    outcomes: Array<{
      type: string;
      description: string;
      impact?: 'positive' | 'neutral' | 'negative';
    }>;
    recommendations?: string[];
  };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface PlanStep {
  id: string;
  order: number;
  action: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
}

interface AgentTrigger {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  goalTemplate: {
    type: string;
    description: string;
    priority: string;
  };
  lastTriggered?: string;
  triggerCount: number;
}

interface AgentNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  goalId?: string;
  priority: 'low' | 'medium' | 'high';
  read: boolean;
  actionRequired: boolean;
  createdAt: string;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const StatusBadge: React.FC<{ status: AgentGoal['status'] }> = ({ status }) => {
  const config: Record<AgentGoal['status'], { color: string; label: string }> = {
    pending: { color: 'bg-gray-100 text-gray-800', label: 'Pending' },
    planning: { color: 'bg-violet-100 text-violet-800', label: 'Planning' },
    executing: { color: 'bg-yellow-100 text-yellow-800', label: 'Executing' },
    awaiting_approval: { color: 'bg-violet-100 text-violet-800', label: 'Awaiting Approval' },
    completed: { color: 'bg-green-100 text-green-800', label: 'Completed' },
    failed: { color: 'bg-red-100 text-red-800', label: 'Failed' },
    cancelled: { color: 'bg-gray-100 text-gray-600', label: 'Cancelled' },
  };
  
  const { color, label } = config[status];
  
  return (
    <Badge className={cn('font-medium', color)}>
      {status === 'executing' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
      {label}
    </Badge>
  );
};

const PriorityBadge: React.FC<{ priority: AgentGoal['priority'] }> = ({ priority }) => {
  const config: Record<AgentGoal['priority'], { color: string; icon: React.ReactNode }> = {
    critical: { color: 'bg-red-500 text-white', icon: <Zap className="h-3 w-3" /> },
    high: { color: 'bg-orange-500 text-white', icon: <AlertTriangle className="h-3 w-3" /> },
    medium: { color: 'bg-violet-500 text-white', icon: <Target className="h-3 w-3" /> },
    low: { color: 'bg-gray-500 text-white', icon: <Clock className="h-3 w-3" /> },
    background: { color: 'bg-gray-300 text-gray-700 dark:text-slate-300', icon: <RefreshCw className="h-3 w-3" /> },
  };
  
  const { color, icon } = config[priority];
  
  return (
    <Badge className={cn('flex items-center gap-1', color)}>
      {icon}
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </Badge>
  );
};

const GoalTypeIcon: React.FC<{ type: string }> = ({ type }) => {
  const icons: Record<string, React.ReactNode> = {
    contract_expiry_review: <Calendar className="h-5 w-5 text-orange-500" />,
    anomaly_investigation: <AlertTriangle className="h-5 w-5 text-red-500" />,
    savings_opportunity_scan: <DollarSign className="h-5 w-5 text-green-500" />,
    compliance_audit: <Shield className="h-5 w-5 text-violet-500" />,
  };
  
  return icons[type] || <FileText className="h-5 w-5 text-gray-500 dark:text-slate-400" />;
};

const StepProgress: React.FC<{ steps: PlanStep[] }> = ({ steps }) => {
  const completed = steps.filter(s => s.status === 'completed').length;
  const inProgress = steps.find(s => s.status === 'in_progress');
  const progress = (completed / steps.length) * 100;
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500 dark:text-slate-400">
          {inProgress ? `Step ${inProgress.order}: ${inProgress.description}` : `${completed}/${steps.length} steps`}
        </span>
        <span className="font-medium">{Math.round(progress)}%</span>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
};

// ============================================================================
// GOAL CARD COMPONENT
// ============================================================================

const GoalCard: React.FC<{ 
  goal: AgentGoal; 
  onCancel: (id: string) => void;
  onViewDetails: (goal: AgentGoal) => void;
}> = ({ goal, onCancel, onViewDetails }) => {
  const [expanded, setExpanded] = useState(false);
  
  const isActive = ['planning', 'executing', 'awaiting_approval'].includes(goal.status);
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "bg-white dark:bg-gray-800 rounded-lg border shadow-sm",
        isActive && "ring-2 ring-violet-300 dark:ring-violet-700"
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <GoalTypeIcon type={goal.type} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-gray-900 dark:text-slate-100 dark:text-gray-100 truncate">
                {goal.description}
              </h4>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={goal.status} />
              <PriorityBadge priority={goal.priority} />
              <span className="text-xs text-gray-500 dark:text-slate-400">
                {goal.trigger.source}
              </span>
            </div>
            
            {goal.plan && isActive && (
              <div className="mt-3">
                <StepProgress steps={goal.plan.steps} />
              </div>
            )}
            
            {goal.result && (
              <div className={cn(
                "mt-3 p-2 rounded-md text-sm",
                goal.result.success 
                  ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                  : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
              )}>
                {goal.result.summary}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onViewDetails(goal)}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                {isActive && (
                  <DropdownMenuItem 
                    onClick={() => onCancel(goal.id)}
                    className="text-red-600"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        <AnimatePresence>
          {expanded && goal.plan && (
            <motion.div key="expanded"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 pt-4 border-t"
            >
              <h5 className="text-sm font-medium mb-2">Execution Plan</h5>
              <div className="space-y-2">
                {goal.plan.steps.map((step, _index) => (
                  <div 
                    key={step.id}
                    className={cn(
                      "flex items-center gap-2 text-sm p-2 rounded",
                      step.status === 'completed' && "bg-green-50 dark:bg-green-900/20",
                      step.status === 'in_progress' && "bg-violet-50 dark:bg-violet-900/20",
                      step.status === 'failed' && "bg-red-50 dark:bg-red-900/20"
                    )}
                  >
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-xs font-medium">
                      {step.order}
                    </span>
                    <span className="flex-1">{step.description}</span>
                    {step.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    {step.status === 'in_progress' && <Loader2 className="h-4 w-4 text-violet-500 animate-spin" />}
                    {step.status === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
                  </div>
                ))}
              </div>
              
              {goal.plan.riskAssessment && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4" />
                    <span>Risk Level:</span>
                    <Badge className={cn(
                      goal.plan.riskAssessment.level === 'low' && "bg-green-100 text-green-800",
                      goal.plan.riskAssessment.level === 'medium' && "bg-yellow-100 text-yellow-800",
                      goal.plan.riskAssessment.level === 'high' && "bg-orange-100 text-orange-800",
                      goal.plan.riskAssessment.level === 'critical' && "bg-red-100 text-red-800"
                    )}>
                      {goal.plan.riskAssessment.level}
                    </Badge>
                    {goal.plan.riskAssessment.requiresHumanApproval && (
                      <Badge variant="outline">Requires Approval</Badge>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t text-xs text-gray-500 dark:text-slate-400 flex items-center justify-between">
        <span>Created: {new Date(goal.createdAt).toLocaleString()}</span>
        {goal.completedAt && (
          <span>Completed: {new Date(goal.completedAt).toLocaleString()}</span>
        )}
      </div>
    </motion.div>
  );
};

// ============================================================================
// TRIGGER CARD COMPONENT
// ============================================================================

const TriggerCard: React.FC<{ 
  trigger: AgentTrigger;
  onToggle: (id: string, enabled: boolean) => void;
}> = ({ trigger, onToggle }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-3 h-3 rounded-full",
            trigger.enabled ? "bg-green-500" : "bg-gray-300"
          )} />
          <div>
            <h4 className="font-medium">{trigger.name}</h4>
            <p className="text-sm text-gray-500 dark:text-slate-400">{trigger.goalTemplate.description}</p>
          </div>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => onToggle(trigger.id, !trigger.enabled)}
        >
          {trigger.enabled ? 'Disable' : 'Enable'}
        </Button>
      </div>
      
      <div className="mt-3 flex items-center gap-4 text-sm text-gray-500 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <Zap className="h-4 w-4" />
          {trigger.type}
        </span>
        <span className="flex items-center gap-1">
          <History className="h-4 w-4" />
          {trigger.triggerCount} executions
        </span>
        {trigger.lastTriggered && (
          <span>Last: {new Date(trigger.lastTriggered).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// CREATE GOAL DIALOG
// ============================================================================

const CreateGoalDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { type: string; description: string; priority: string }) => void;
}> = ({ open, onOpenChange, onSubmit }) => {
  const [type, setType] = useState('custom');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  
  const handleSubmit = () => {
    onSubmit({ type, description, priority });
    setDescription('');
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Autonomous Goal</DialogTitle>
          <DialogDescription>
            Define a new goal for the AI agent to accomplish autonomously
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label>Goal Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contract_expiry_review">Contract Expiry Review</SelectItem>
                <SelectItem value="savings_opportunity_scan">Savings Opportunity Scan</SelectItem>
                <SelectItem value="compliance_audit">Compliance Audit</SelectItem>
                <SelectItem value="anomaly_investigation">Anomaly Investigation</SelectItem>
                <SelectItem value="custom">Custom Goal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what the agent should accomplish..."
              rows={3}
            />
          </div>
          
          <div>
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Critical - Immediate attention</SelectItem>
                <SelectItem value="high">High - Prioritize over other tasks</SelectItem>
                <SelectItem value="medium">Medium - Normal priority</SelectItem>
                <SelectItem value="low">Low - When convenient</SelectItem>
                <SelectItem value="background">Background - Run in spare cycles</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!description}>
              Create Goal
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

export const AutonomousAgentDashboard: React.FC = () => {
  const [status, setStatus] = useState<OrchestratorStatus | null>(null);
  const [goals, setGoals] = useState<AgentGoal[]>([]);
  const [triggers, setTriggers] = useState<AgentTrigger[]>([]);
  const [notifications, setNotifications] = useState<AgentNotification[]>([]);
  const [selectedTab, setSelectedTab] = useState('active');
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [_selectedGoal, setSelectedGoal] = useState<AgentGoal | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [statusRes, goalsRes, triggersRes, notificationsRes] = await Promise.all([
        fetch('/api/agents/orchestrator?resource=status'),
        fetch('/api/agents/orchestrator?resource=goals'),
        fetch('/api/agents/orchestrator?resource=triggers'),
        fetch('/api/agents/orchestrator?resource=notifications'),
      ]);
      
      const [statusData, goalsData, triggersData, notificationsData] = await Promise.all([
        statusRes.json(),
        goalsRes.json(),
        triggersRes.json(),
        notificationsRes.json(),
      ]);
      
      if (statusData.success) setStatus(statusData.data);
      if (goalsData.success) setGoals(goalsData.data);
      if (triggersData.success) setTriggers(triggersData.data);
      if (notificationsData.success) setNotifications(notificationsData.data);
    } catch (error) {
      console.error('Failed to fetch orchestrator data:', error);
      toast.error('Failed to load agent dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchData();
    
    // Poll for updates
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);
  
  // Handlers
  const handleToggleOrchestrator = async () => {
    const action = status?.isRunning ? 'stop_processing' : 'start_processing';
    await fetch('/api/agents/orchestrator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    fetchData();
  };
  
  const handleCreateGoal = async (data: { type: string; description: string; priority: string }) => {
    await fetch('/api/agents/orchestrator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'create_goal',
        ...data
      })
    });
    fetchData();
  };
  
  const handleCancelGoal = async (goalId: string) => {
    await fetch('/api/agents/orchestrator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'cancel_goal',
        goalId,
        reason: 'User requested cancellation'
      })
    });
    fetchData();
  };
  
  const handleToggleTrigger = async (triggerId: string, enabled: boolean) => {
    await fetch('/api/agents/orchestrator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'toggle_trigger',
        triggerId,
        triggerEnabled: enabled
      })
    });
    fetchData();
  };
  
  // Filter goals by tab
  const activeGoals = goals.filter(g => ['pending', 'planning', 'executing', 'awaiting_approval'].includes(g.status));
  const completedGoals = goals.filter(g => g.status === 'completed');
  const failedGoals = goals.filter(g => g.status === 'failed' || g.status === 'cancelled');
  
  const unreadNotifications = notifications.filter(n => !n.read);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center",
            status?.isRunning 
              ? "bg-green-100 dark:bg-green-900/30" 
              : "bg-gray-100 dark:bg-gray-800"
          )}>
            <Bot className={cn(
              "h-6 w-6",
              status?.isRunning ? "text-green-600" : "text-gray-400"
            )} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Autonomous Agent</h1>
            <p className="text-gray-500 dark:text-slate-400">
              {status?.isRunning 
                ? `Running • ${status.queueLength} tasks queued`
                : 'Stopped'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Goal
          </Button>
          
          <Button
            variant={status?.isRunning ? 'destructive' : 'default'}
            onClick={handleToggleOrchestrator}
          >
            {status?.isRunning ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Stop
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start
              </>
            )}
          </Button>
          
          <div className="relative">
            <Button variant="ghost" size="icon" className="relative" onClick={() => setShowNotifications(!showNotifications)}>
              <Bell className="h-5 w-5" />
              {unreadNotifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadNotifications.length}
                </span>
              )}
            </Button>
            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto">
                <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span className="text-sm font-semibold">Notifications</span>
                  <button onClick={() => setShowNotifications(false)} className="text-xs text-slate-400 hover:text-slate-600">&times;</button>
                </div>
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-400">No notifications</div>
                ) : (
                  notifications.slice(0, 10).map((n) => (
                    <div key={n.id} className={`p-3 border-b border-slate-100 dark:border-slate-700 text-sm ${n.read ? 'opacity-60' : ''}`}>
                      <div className="font-medium text-slate-800 dark:text-white">{n.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{n.message}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                <Target className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-slate-400">Active Goals</p>
                <p className="text-2xl font-bold">{activeGoals.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-slate-400">Completed Today</p>
                <p className="text-2xl font-bold">{status?.completedToday || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-slate-400">Queue Length</p>
                <p className="text-2xl font-bold">{status?.queueLength || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                <Zap className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-slate-400">Active Triggers</p>
                <p className="text-2xl font-bold">
                  {triggers.filter(t => t.enabled).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Loader2 className="h-4 w-4" />
            Active ({activeGoals.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Completed ({completedGoals.length})
          </TabsTrigger>
          <TabsTrigger value="failed" className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Failed ({failedGoals.length})
          </TabsTrigger>
          <TabsTrigger value="triggers" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Triggers
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="mt-4">
          <div className="space-y-3">
            <AnimatePresence>
              {activeGoals.length === 0 ? (
                <div key="active-goals-length" className="text-center py-12 text-gray-500 dark:text-slate-400">
                  <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No active goals</p>
                  <p className="text-sm">Create a new goal or enable triggers to get started</p>
                </div>
              ) : (
                activeGoals.map(goal => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onCancel={handleCancelGoal}
                    onViewDetails={setSelectedGoal}
                  />
                ))
              )}
            </AnimatePresence>
          </div>
        </TabsContent>
        
        <TabsContent value="completed" className="mt-4">
          <div className="space-y-3">
            {completedGoals.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-slate-400">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No completed goals yet</p>
              </div>
            ) : (
              completedGoals.map(goal => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onCancel={handleCancelGoal}
                  onViewDetails={setSelectedGoal}
                />
              ))
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="failed" className="mt-4">
          <div className="space-y-3">
            {failedGoals.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-slate-400">
                <XCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No failed goals</p>
              </div>
            ) : (
              failedGoals.map(goal => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onCancel={handleCancelGoal}
                  onViewDetails={setSelectedGoal}
                />
              ))
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="triggers" className="mt-4">
          <div className="space-y-3">
            {triggers.map(trigger => (
              <TriggerCard
                key={trigger.id}
                trigger={trigger}
                onToggle={handleToggleTrigger}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Create Goal Dialog */}
      <CreateGoalDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateGoal}
      />
    </div>
  );
};

export default AutonomousAgentDashboard;
