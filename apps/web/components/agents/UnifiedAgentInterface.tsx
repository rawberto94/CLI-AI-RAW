/**
 * Unified Agent Interface
 * 
 * Central hub for all AI agents with Human-in-the-Loop (HITL) workflows.
 * Users can:
 * - See all active agent activities
 * - Review and approve agent recommendations
 * - Request agent analysis on-demand
 * - Configure agent preferences
 * 
 * @version 1.0.0
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';
import {
  Bot,
  Brain,
  Shield,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Sparkles,
  MessageSquare,
  Settings,
  History,
  Filter,
  Search,
  ChevronRight,
  Loader2,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  FileText,
  Calendar,
  DollarSign,
  Zap,
  Target,
  BarChart3,
  Users,
  Gavel,
  Lightbulb,
  Heart,
  FileSearch,
  Scale,
  Wrench,
  RotateCcw,
  BookOpen,
  Microscope,
  GitMerge,
  Beaker,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useDataMode } from '@/contexts/DataModeContext';

// ============================================================================
// TYPES
// ============================================================================

type AgentStatus = 'idle' | 'working' | 'waiting_for_approval' | 'completed' | 'error';
type ApprovalType = 'renewal' | 'compliance_gap' | 'risk_alert' | 'savings_opportunity' | 'workflow' | 'custom';
type Priority = 'low' | 'medium' | 'high' | 'critical';

interface AgentActivity {
  id: string;
  agentName: string;
  agentId: string;
  icon: string;
  status: AgentStatus;
  title: string;
  description: string;
  contractId?: string;
  contractName?: string;
  priority: Priority;
  createdAt: string;
  completedAt?: string;
  requiresApproval: boolean;
  approvalContext?: ApprovalContext;
  result?: AgentResult;
}

interface ApprovalContext {
  type: ApprovalType;
  recommendation: string;
  reasoning: string;
  confidence: number;
  impact?: {
    type: 'cost' | 'time' | 'risk' | 'savings';
    value: number;
    currency?: string;
  };
  alternatives?: string[];
  risks?: string[];
  actions: ApprovalAction[];
}

interface ApprovalAction {
  id: string;
  label: string;
  type: 'approve' | 'reject' | 'modify' | 'escalate' | 'defer';
  primary?: boolean;
  dangerous?: boolean;
}

interface AgentResult {
  summary: string;
  details: Record<string, unknown>;
  artifacts?: Array<{
    type: string;
    name: string;
    url?: string;
  }>;
}

interface AgentConfiguration {
  agentId: string;
  enabled: boolean;
  autoApprove: boolean;
  thresholds: {
    confidence: number;
    cost: number;
    risk: Priority;
  };
  notificationPreferences: {
    email: boolean;
    inApp: boolean;
    slack?: boolean;
  };
}

// ============================================================================
// AGENT CONFIGURATION
// ============================================================================

const AGENT_CONFIGS: Record<string, { 
  name: string; 
  codename: string;
  cluster: string;
  icon: any; 
  color: string; 
  description: string;
  avatar: string;
}> = {
  // 🛡️ GUARDIANS
  'proactive-validation-agent': {
    name: 'Proactive Validation Agent',
    codename: 'Sentinel',
    cluster: 'guardians',
    icon: Shield,
    color: 'red',
    description: 'First line of defense — catches errors before they propagate',
    avatar: '🛡️',
  },
  'compliance-monitoring-agent': {
    name: 'Compliance Monitoring Agent',
    codename: 'Vigil',
    cluster: 'guardians',
    icon: Scale,
    color: 'emerald',
    description: 'Regulatory watchdog — ensures contracts meet all requirements',
    avatar: '⚖️',
  },
  'proactive-risk-detector': {
    name: 'Proactive Risk Detector',
    codename: 'Warden',
    cluster: 'guardians',
    icon: AlertTriangle,
    color: 'orange',
    description: 'Early warning system — detects risks before they materialize',
    avatar: '🔥',
  },
  
  // 🔮 ORACLES
  'intelligent-search-agent': {
    name: 'Intelligent Search Agent',
    codename: 'Sage',
    cluster: 'oracles',
    icon: FileSearch,
    color: 'violet',
    description: 'Seer of contracts — finds anything with intent-aware search',
    avatar: '🔮',
  },
  'opportunity-discovery-engine': {
    name: 'Opportunity Discovery Engine',
    codename: 'Prospector',
    cluster: 'oracles',
    icon: TrendingUp,
    color: 'amber',
    description: 'Fortune finder — discovers savings and optimization gold',
    avatar: '💎',
  },
  'contract-summarization-agent': {
    name: 'Contract Summarization Agent',
    codename: 'Cartographer',
    cluster: 'oracles',
    icon: BookOpen,
    color: 'blue',
    description: 'Map maker — charts the landscape of any contract',
    avatar: '🗺️',
  },
  'continuous-learning-agent': {
    name: 'Continuous Learning Agent',
    codename: 'Chronicle',
    cluster: 'oracles',
    icon: Brain,
    color: 'indigo',
    description: 'Keeper of knowledge — learns from every correction',
    avatar: '📚',
  },
  
  // ⚡ OPERATORS
  'autonomous-deadline-manager': {
    name: 'Autonomous Deadline Manager',
    codename: 'Clockwork',
    cluster: 'operators',
    icon: Clock,
    color: 'cyan',
    description: 'Precision timekeeper — never misses a deadline',
    avatar: '⏰',
  },
  'obligation-tracking-agent': {
    name: 'Obligation Tracking Agent',
    codename: 'Steward',
    cluster: 'operators',
    icon: CheckCircle,
    color: 'teal',
    description: 'Dedicated steward — tracks every commitment',
    avatar: '📋',
  },
  'contract-health-monitor': {
    name: 'Contract Health Monitor',
    codename: 'Physician',
    cluster: 'operators',
    icon: Heart,
    color: 'pink',
    description: 'Contract doctor — diagnoses portfolio health',
    avatar: '⚕️',
  },
  'smart-gap-filling-agent': {
    name: 'Smart Gap Filling Agent',
    codename: 'Artificer',
    cluster: 'operators',
    icon: Wrench,
    color: 'slate',
    description: 'Master craftsperson — fills missing data with precision',
    avatar: '🔧',
  },
  'adaptive-retry-agent': {
    name: 'Adaptive Retry Agent',
    codename: 'Resilience',
    cluster: 'operators',
    icon: RotateCcw,
    color: 'green',
    description: 'Indomitable spirit — adapts and overcomes failures',
    avatar: '💪',
  },
  
  // 🎯 STRATEGISTS
  'workflow-suggestion-engine': {
    name: 'Workflow Suggestion Engine',
    codename: 'Architect',
    cluster: 'strategists',
    icon: Bot,
    color: 'purple',
    description: 'Master builder — designs optimal workflows',
    avatar: '🏗️',
  },
  'rfx-procurement-agent': {
    name: 'RFx Procurement Agent',
    codename: 'Merchant',
    cluster: 'strategists',
    icon: Gavel,
    color: 'yellow',
    description: 'Master negotiator — manages RFx lifecycles',
    avatar: '🤝',
  },
  'multi-agent-coordinator': {
    name: 'Multi-Agent Coordinator',
    codename: 'Conductor',
    cluster: 'strategists',
    icon: Users,
    color: 'fuchsia',
    description: 'Orchestra leader — coordinates agent symphonies',
    avatar: '🎼',
  },
  
  // 🧬 EVOLUTION
  'user-feedback-learner': {
    name: 'User Feedback Learner',
    codename: 'Mnemosyne',
    cluster: 'evolution',
    icon: Brain,
    color: 'indigo',
    description: 'Memory incarnate — learns from every interaction',
    avatar: '🧠',
  },
  'ab-testing-engine': {
    name: 'A/B Testing Engine',
    codename: 'A/B',
    cluster: 'evolution',
    icon: Beaker,
    color: 'lime',
    description: 'Scientist — tests and validates agent performance',
    avatar: '🧪',
  },
  'goal-execution-worker': {
    name: 'Goal Execution Worker',
    codename: 'Executor',
    cluster: 'evolution',
    icon: Zap,
    color: 'red',
    description: 'Task master — executes approved goals with precision',
    avatar: '⚡',
  },
  'rfx-detection-agent': {
    name: 'RFx Detection Agent',
    codename: 'Scout',
    cluster: 'oracles',
    icon: Target,
    color: 'amber',
    description: 'Opportunity spotter — finds RFx opportunities before they expire',
    avatar: '🎯',
  },
  'agent-swarm': {
    name: 'Agent Swarm',
    codename: 'Swarm',
    cluster: 'evolution',
    icon: GitMerge,
    color: 'orange',
    description: 'Collective intelligence — many minds, one purpose',
    avatar: '🐝',
  },
};

// Cluster configuration
const CLUSTER_CONFIG: Record<string, { name: string; emoji: string; color: string; description: string }> = {
  guardians: { name: 'Guardians', emoji: '🛡️', color: 'red', description: 'Compliance & Risk Protection' },
  oracles: { name: 'Oracles', emoji: '🔮', color: 'violet', description: 'Intelligence & Discovery' },
  operators: { name: 'Operators', emoji: '⚡', color: 'cyan', description: 'Execution & Monitoring' },
  strategists: { name: 'Strategists', emoji: '🎯', color: 'purple', description: 'Workflow & Planning' },
  evolution: { name: 'Evolution', emoji: '🧬', color: 'green', description: 'Learning & Improvement' },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function UnifiedAgentInterface() {
  const { data: session } = useSession();
  const { isRealData } = useDataMode();
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [selectedActivity, setSelectedActivity] = useState<AgentActivity | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedback, setFeedback] = useState('');

  // Fetch agent status and activities
  const fetchData = useCallback(async () => {
    if (!isRealData) {
      // Demo data
      setActivities(getDemoActivities());
      setLoading(false);
      return;
    }

    try {
      // Fetch both status and activities in parallel
      const [statusRes, activitiesRes, approvalsRes] = await Promise.all([
        fetch('/api/agents/status'),
        fetch('/api/agents/activities?limit=50'),
        fetch('/api/agents/approvals'),
      ]);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        // Update stats from status API
        console.log('Agent status:', statusData);
      }

      if (activitiesRes.ok) {
        const activitiesData = await activitiesRes.json();
        // Transform API response to AgentActivity format
        const transformedActivities: AgentActivity[] = activitiesData.activities.map((a: any) => ({
          id: a.id,
          agentName: a.agentCodename || 'Agent',
          agentId: a.agentId || 'unknown',
          icon: 'Bot',
          status: mapActivityStatus(a.status, a.type),
          title: a.title || 'Agent Activity',
          description: a.description || '',
          contractId: a.contractId,
          contractName: a.contractId ? 'Related Contract' : undefined,
          priority: mapActivityPriority(a.importance, a.type),
          createdAt: a.timestamp,
          requiresApproval: false,
        }));
        setActivities(transformedActivities);
      }

      if (approvalsRes.ok) {
        const approvalsData = await approvalsRes.json();
        // Transform approvals into activities that need approval
        const approvalActivities: AgentActivity[] = approvalsData.approvals.map((a: any) => ({
          id: a.id,
          agentName: a.agentCodename || 'Agent',
          agentId: a.agentId,
          icon: 'Shield',
          status: 'waiting_for_approval',
          title: a.title,
          description: a.description,
          contractId: a.contractId,
          contractName: a.context?.contractTitle,
          priority: a.priority as Priority,
          createdAt: a.requestedAt,
          requiresApproval: true,
          approvalContext: {
            type: mapApprovalType(a.type),
            recommendation: a.recommendation?.reason || 'Review and approve',
            reasoning: a.reasoning || a.description,
            confidence: a.recommendation?.confidence || 0.8,
            impact: a.context?.savings ? {
              type: 'savings',
              value: a.context.savings,
              currency: '$',
            } : undefined,
            alternatives: a.alternatives?.map((alt: any) => alt.reason),
            risks: a.context?.risks,
            actions: [
              { id: 'approve', label: 'Approve', type: 'approve', primary: true },
              { id: 'reject', label: 'Reject', type: 'reject' },
              { id: 'modify', label: 'Request Changes', type: 'modify' },
            ],
          },
        }));
        
        // Merge with existing activities
        setActivities(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          const newApprovals = approvalActivities.filter(a => !existingIds.has(a.id));
          return [...newApprovals, ...prev];
        });
      }
    } catch (error) {
      console.error('Failed to fetch agent data:', error);
      toast.error('Failed to load agent data');
    } finally {
      setLoading(false);
    }
  }, [isRealData]);

  useEffect(() => {
    fetchData();
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Handle approval action
  const handleApproval = async (
    activity: AgentActivity,
    action: ApprovalAction,
    notes?: string
  ) => {
    try {
      const res = await fetch('/api/agents/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionId: activity.id,
          action: action.type,
          notes,
        }),
      });

      if (res.ok) {
        toast.success(`${action.label} successful`);
        setApprovalDialogOpen(false);
        setSelectedActivity(null);
        fetchData();
      } else {
        const error = await res.json();
        throw new Error(error.message || 'Failed to process approval');
      }
    } catch (error) {
      toast.error('Failed to process approval');
      console.error(error);
    }
  };

  // Submit feedback
  const submitFeedback = async () => {
    if (!selectedActivity) return;

    try {
      await fetch(`/api/agents/activities/${selectedActivity.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      });

      toast.success('Feedback submitted');
      setFeedbackDialogOpen(false);
      setFeedback('');
    } catch (error) {
      toast.error('Failed to submit feedback');
    }
  };

  // Filter activities
  const filteredActivities = activities.filter(a => {
    if (filter === 'pending') return a.requiresApproval && a.status === 'waiting_for_approval';
    if (filter === 'completed') return a.status === 'completed';
    return true;
  });

  // Stats
  const stats = {
    pending: activities.filter(a => a.requiresApproval && a.status === 'waiting_for_approval').length,
    completed: activities.filter(a => a.status === 'completed').length,
    working: activities.filter(a => a.status === 'working').length,
    critical: activities.filter(a => a.priority === 'critical').length,
  };

  return (
    <div className="h-full flex flex-col bg-slate-50/50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                Contigo Lab
                <Badge variant="outline" className="text-xs font-normal">19 Agents</Badge>
              </h1>
              <p className="text-sm text-muted-foreground">
                🛡️ Guardians • 🔮 Oracles • ⚡ Operators • 🎯 Strategists • 🧬 Evolution
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Quick Stats */}
            <div className="flex items-center gap-2">
              {stats.pending > 0 && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                  <Clock className="w-3 h-3 mr-1" />
                  {stats.pending} Pending
                </Badge>
              )}
              {stats.critical > 0 && (
                <Badge variant="destructive">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {stats.critical} Critical
                </Badge>
              )}
            </div>

            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="activities" className="h-full flex flex-col">
          <div className="bg-white border-b px-6">
            <TabsList className="w-full justify-start bg-transparent border-0 p-0">
              <TabsTrigger value="activities" className="rounded-none border-b-2 border-transparent data-[state=active]:border-violet-500 data-[state=active]:bg-transparent">
                <Bot className="w-4 h-4 mr-2" />
                Activities
                {stats.pending > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">
                    {stats.pending}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="agents" className="rounded-none border-b-2 border-transparent data-[state=active]:border-violet-500 data-[state=active]:bg-transparent">
                <Sparkles className="w-4 h-4 mr-2" />
                Agent Directory
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-violet-500 data-[state=active]:bg-transparent">
                <History className="w-4 h-4 mr-2" />
                History
              </TabsTrigger>
              <TabsTrigger value="settings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-violet-500 data-[state=active]:bg-transparent">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Activities Tab */}
          <TabsContent value="activities" className="flex-1 overflow-hidden m-0">
            <div className="h-full flex">
              {/* Activity List */}
              <div className="w-96 border-r bg-white flex flex-col">
                {/* Filters */}
                <div className="p-4 border-b space-y-3">
                  <div className="flex gap-2">
                    <Button
                      variant={filter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilter('all')}
                    >
                      All
                    </Button>
                    <Button
                      variant={filter === 'pending' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilter('pending')}
                    >
                      Pending
                    </Button>
                    <Button
                      variant={filter === 'completed' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilter('completed')}
                    >
                      Completed
                    </Button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Search activities..." className="pl-9" />
                  </div>
                </div>

                {/* Activity List */}
                <ScrollArea className="flex-1">
                  {loading ? (
                    <div className="p-4 space-y-4">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="animate-pulse space-y-2">
                          <div className="h-4 bg-slate-200 rounded w-3/4" />
                          <div className="h-3 bg-slate-200 rounded w-1/2" />
                        </div>
                      ))}
                    </div>
                  ) : filteredActivities.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No activities found</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredActivities.map(activity => (
                        <ActivityCard
                          key={activity.id}
                          activity={activity}
                          selected={selectedActivity?.id === activity.id}
                          onClick={() => setSelectedActivity(activity)}
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Activity Detail */}
              <div className="flex-1 bg-slate-50/50 p-6 overflow-auto">
                {selectedActivity ? (
                  <ActivityDetail
                    activity={selectedActivity}
                    onApprove={() => setApprovalDialogOpen(true)}
                    onFeedback={() => setFeedbackDialogOpen(true)}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Bot className="w-16 h-16 mx-auto mb-4 opacity-30" />
                      <p>Select an activity to view details</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Agents Directory */}
          <TabsContent value="agents" className="flex-1 overflow-auto m-0 p-6">
            <AgentDirectory />
          </TabsContent>

          {/* History */}
          <TabsContent value="history" className="flex-1 overflow-auto m-0 p-6">
            <ActivityHistory />
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings" className="flex-1 overflow-auto m-0 p-6">
            <AgentSettings />
          </TabsContent>
        </Tabs>
      </div>

      {/* Approval Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Agent Recommendation</DialogTitle>
            <DialogDescription>
              Review the agent's recommendation before taking action
            </DialogDescription>
          </DialogHeader>

          {selectedActivity?.approvalContext && (
            <ApprovalDialogContent
              context={selectedActivity.approvalContext}
              onAction={(action, notes) => handleApproval(selectedActivity, action, notes)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Feedback Dialog */}
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Provide Feedback</DialogTitle>
            <DialogDescription>
              Help us improve our AI agents
            </DialogDescription>
          </DialogHeader>

          <Textarea
            placeholder="What did you think of this agent's recommendation?"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitFeedback}>
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function ActivityCard({
  activity,
  selected,
  onClick,
}: {
  activity: AgentActivity;
  selected: boolean;
  onClick: () => void;
}) {
  const config = AGENT_CONFIGS[activity.agentId] || {
    name: activity.agentName,
    icon: Bot,
    color: 'slate',
  };
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClick}
      className={cn(
        "p-4 cursor-pointer hover:bg-slate-50 transition-colors",
        selected && "bg-violet-50 hover:bg-violet-50"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
          `bg-${config.color}-100`
        )}>
          <Icon className={cn("w-5 h-5", `text-${config.color}-600`)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium text-sm truncate">{activity.title}</p>
            {activity.requiresApproval && activity.status === 'waiting_for_approval' && (
              <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
                Action Needed
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {activity.description}
          </p>
          <div className="flex items-center gap-2 text-xs">
            <StatusBadge status={activity.status} />
            <PriorityBadge priority={activity.priority} />
            <span className="text-muted-foreground">
              {formatRelativeTime(activity.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ActivityDetail({
  activity,
  onApprove,
  onFeedback,
}: {
  activity: AgentActivity;
  onApprove: () => void;
  onFeedback: () => void;
}) {
  const config = AGENT_CONFIGS[activity.agentId] || {
    name: activity.agentName,
    icon: Bot,
    color: 'slate',
  };
  const Icon = config.icon;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center",
                `bg-${config.color}-100`
              )}>
                <Icon className={cn("w-6 h-6", `text-${config.color}-600`)} />
              </div>
              <div>
                <CardTitle className="text-xl">{activity.title}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                  <span className="font-medium text-foreground">{config.avatar} {config.codename}</span>
                  <span className="text-xs px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">{config.cluster}</span>
                  <span>• {formatRelativeTime(activity.createdAt)}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={activity.status} size="lg" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{activity.description}</p>

          {activity.contractId && (
            <div className="mt-4 p-3 bg-slate-50 rounded-lg">
              <p className="text-sm font-medium mb-1">Related Contract</p>
              <a
                href={`/contracts/${activity.contractId}`}
                className="text-sm text-violet-600 hover:underline flex items-center gap-1"
              >
                <FileText className="w-4 h-4" />
                {activity.contractName || 'View Contract'}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Section */}
      {activity.requiresApproval && activity.status === 'waiting_for_approval' && activity.approvalContext && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Approval Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-medium mb-2">Recommendation</p>
              <p className="text-muted-foreground">{activity.approvalContext.recommendation}</p>
            </div>

            {activity.approvalContext.impact && (
              <div className="flex items-center gap-4 p-3 bg-white rounded-lg">
                <div className="text-center">
                  <p className="text-2xl font-bold text-violet-600">
                    {activity.approvalContext.impact.type === 'savings' ? '+' : '-'}
                    {activity.approvalContext.impact.currency}
                    {activity.approvalContext.impact.value.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground uppercase">
                    Estimated {activity.approvalContext.impact.type}
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button onClick={onApprove} className="flex-1">
                <CheckCircle className="w-4 h-4 mr-2" />
                Review & Decide
              </Button>
              <Button variant="outline" onClick={onFeedback}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Feedback
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result Section */}
      {activity.result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Result</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{activity.result.summary}</p>

            {activity.result.artifacts && activity.result.artifacts.length > 0 && (
              <div className="mt-4">
                <p className="font-medium mb-2">Generated Artifacts</p>
                <div className="flex flex-wrap gap-2">
                  {activity.result.artifacts.map((artifact, i) => (
                    <Button key={i} variant="outline" size="sm" asChild>
                      <a href={artifact.url} target="_blank" rel="noopener noreferrer">
                        <FileText className="w-4 h-4 mr-2" />
                        {artifact.name}
                      </a>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Feedback */}
      {activity.status === 'completed' && (
        <div className="flex items-center justify-center gap-4 py-4">
          <p className="text-sm text-muted-foreground">Was this helpful?</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onFeedback}>
              <ThumbsUp className="w-4 h-4 mr-2" />
              Yes
            </Button>
            <Button variant="outline" size="sm" onClick={onFeedback}>
              <ThumbsDown className="w-4 h-4 mr-2" />
              No
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ApprovalDialogContent({
  context,
  onAction,
}: {
  context: ApprovalContext;
  onAction: (action: ApprovalAction, notes?: string) => void;
}) {
  const [notes, setNotes] = useState('');

  return (
    <div className="space-y-6">
      {/* Reasoning */}
      <div className="p-4 bg-slate-50 rounded-lg">
        <p className="font-medium mb-2">Agent Reasoning</p>
        <p className="text-sm text-muted-foreground">{context.reasoning}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm">Confidence:</span>
          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full"
              style={{ width: `${context.confidence * 100}%` }}
            />
          </div>
          <span className="text-sm font-medium">{Math.round(context.confidence * 100)}%</span>
        </div>
      </div>

      {/* Risks & Alternatives */}
      <div className="grid grid-cols-2 gap-4">
        {context.risks && context.risks.length > 0 && (
          <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
            <p className="font-medium text-red-700 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Potential Risks
            </p>
            <ul className="text-sm space-y-1">
              {context.risks.map((risk, i) => (
                <li key={i} className="text-red-600">• {risk}</li>
              ))}
            </ul>
          </div>
        )}

        {context.alternatives && context.alternatives.length > 0 && (
          <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg">
            <p className="font-medium text-blue-700 mb-2 flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              Alternatives
            </p>
            <ul className="text-sm space-y-1">
              {context.alternatives.map((alt, i) => (
                <li key={i} className="text-blue-600">• {alt}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          placeholder="Add any additional context or conditions..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {context.actions.map(action => (
          <Button
            key={action.id}
            variant={action.dangerous ? 'destructive' : action.primary ? 'default' : 'outline'}
            onClick={() => onAction(action, notes)}
            className="flex-1"
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function StatusBadge({ status, size = 'sm' }: { status: AgentStatus; size?: 'sm' | 'lg' }) {
  const styles = {
    idle: 'bg-slate-100 text-slate-700',
    working: 'bg-blue-100 text-blue-700 animate-pulse',
    waiting_for_approval: 'bg-amber-100 text-amber-700',
    completed: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
  };

  const icons = {
    idle: null,
    working: Loader2,
    waiting_for_approval: Clock,
    completed: CheckCircle,
    error: XCircle,
  };

  const Icon = icons[status];

  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full font-medium",
      size === 'sm' ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
      styles[status]
    )}>
      {Icon && <Icon className={cn(size === 'sm' ? 'w-3 h-3' : 'w-4 h-4', status === 'working' && 'animate-spin')} />}
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const styles = {
    low: 'bg-slate-100 text-slate-700',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
  };

  return (
    <span className={cn("px-2 py-0.5 text-xs rounded-full font-medium", styles[priority])}>
      {priority}
    </span>
  );
}

// ============================================================================
// PLACEHOLDER COMPONENTS
// ============================================================================

function AgentDirectory() {
  // Group agents by cluster
  const agentsByCluster = Object.entries(AGENT_CONFIGS).reduce((acc, [id, config]) => {
    if (!acc[config.cluster]) acc[config.cluster] = [];
    acc[config.cluster].push([id, config]);
    return acc;
  }, {} as Record<string, [string, typeof AGENT_CONFIGS[string]][]>);

  return (
    <div className="space-y-8">
      {Object.entries(agentsByCluster).map(([clusterId, agents]) => {
        const cluster = CLUSTER_CONFIG[clusterId];
        return (
          <div key={clusterId}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">{cluster.emoji}</span>
              <div>
                <h3 className="font-semibold text-lg">{cluster.name}</h3>
                <p className="text-sm text-muted-foreground">{cluster.description}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map(([id, config]) => {
                const Icon = config.icon;
                return (
                  <Card key={id} className="hover:shadow-md transition-shadow group">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                          `bg-${config.color}-100`
                        )}>
                          <Icon className={cn("w-5 h-5", `text-${config.color}-600`)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{config.avatar}</span>
                            <h4 className="font-semibold">{config.codename}</h4>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{config.name}</p>
                          <p className="text-sm text-muted-foreground mt-2">{config.description}</p>
                          <div className="mt-3 flex gap-2">
                            <Button variant="outline" size="sm" className="flex-1 text-xs">
                              Configure
                            </Button>
                            <Button size="sm" className="flex-1 text-xs">
                              Run
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActivityHistory() {
  return (
    <div className="text-center text-muted-foreground py-12">
      <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
      <p>Activity history will appear here</p>
    </div>
  );
}

function AgentSettings() {
  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Agent Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium">Auto-approve low-risk actions</p>
              <p className="text-sm text-muted-foreground">Confidence &gt; 90% and no risks</p>
            </div>
            <input type="checkbox" className="w-5 h-5" defaultChecked />
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium">Email notifications</p>
              <p className="text-sm text-muted-foreground">Get notified when agents need approval</p>
            </div>
            <input type="checkbox" className="w-5 h-5" defaultChecked />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// UTILITIES
// ============================================================================

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

// Helper functions to map API responses
function mapActivityStatus(status: string, type: string): AgentStatus {
  const statusMap: Record<string, AgentStatus> = {
    'active': 'working',
    'working': 'working',
    'completed': 'completed',
    'success': 'completed',
    'failed': 'error',
    'error': 'error',
    'waiting_for_approval': 'waiting_for_approval',
    'awaiting_approval': 'waiting_for_approval',
    'idle': 'idle',
  };
  return statusMap[status] || 'idle';
}

function mapActivityPriority(importance: string, type: string): Priority {
  const priorityMap: Record<string, Priority> = {
    'critical': 'critical',
    'high': 'high',
    'normal': 'medium',
    'medium': 'medium',
    'low': 'low',
  };
  return priorityMap[importance] || 'medium';
}

function mapApprovalType(type: string): ApprovalType {
  const typeMap: Record<string, ApprovalType> = {
    'agent_goal': 'workflow',
    'rfx_award': 'savings_opportunity',
    'compliance_alert': 'compliance_gap',
    'renewal_decision': 'renewal',
    'risk': 'risk_alert',
  };
  return typeMap[type] || 'custom';
}

function getDemoActivities(): AgentActivity[] {
  return [
    {
      id: '1',
      agentId: 'autonomous-deadline-manager',
      agentName: 'Clockwork',
      icon: 'Clock',
      status: 'waiting_for_approval',
      title: 'Contract Renewal Recommended',
      description: 'The MSA with TechCorp expires in 30 days. AI recommends starting renewal negotiations.',
      contractId: 'demo-1',
      contractName: 'TechCorp MSA 2023',
      priority: 'high',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      requiresApproval: true,
      approvalContext: {
        type: 'renewal',
        recommendation: 'Start renewal negotiations now to avoid service disruption',
        reasoning: 'Contract expires in 30 days. Historical data shows similar renewals take 45-60 days. Early engagement increases negotiation leverage.',
        confidence: 0.92,
        impact: { type: 'risk', value: 500000, currency: '$' },
        alternatives: ['Let contract auto-renew', 'Switch vendors', 'Extend by 6 months'],
        risks: ['Service disruption if not renewed on time', 'Potential rate increases with late renewal'],
        actions: [
          { id: '1', label: 'Start Renewal', type: 'approve', primary: true },
          { id: '2', label: 'Snooze 7 days', type: 'defer' },
          { id: '3', label: 'Decline', type: 'reject' },
        ],
      },
    },
    {
      id: '2',
      agentId: 'opportunity-discovery-engine',
      agentName: 'Prospector',
      icon: 'TrendingUp',
      status: 'completed',
      title: 'Cost Savings Opportunity Found',
      description: 'Identified potential 15% savings by consolidating software licenses.',
      priority: 'medium',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      completedAt: new Date(Date.now() - 3600000).toISOString(),
      requiresApproval: false,
      result: {
        summary: 'Analysis complete. 3 contracts with overlapping software licenses identified.',
        details: { potentialSavings: 45000 },
      },
    },
    {
      id: '3',
      agentId: 'compliance-monitoring-agent',
      agentName: 'Vigil',
      icon: 'Shield',
      status: 'waiting_for_approval',
      title: 'GDPR Compliance Gap Detected',
      description: 'New vendor contract missing data processing clause.',
      contractId: 'demo-2',
      contractName: 'Data Processing Agreement',
      priority: 'critical',
      createdAt: new Date(Date.now() - 1800000).toISOString(),
      requiresApproval: true,
      approvalContext: {
        type: 'compliance_gap',
        recommendation: 'Add standard GDPR data processing clause before signing',
        reasoning: 'Contract involves EU data processing but lacks required Article 28 GDPR clauses. Legal risk assessed as high.',
        confidence: 0.95,
        risks: ['Regulatory fines up to 4% of revenue', 'Data processing may be non-compliant'],
        actions: [
          { id: '1', label: 'Add Clause & Continue', type: 'approve', primary: true },
          { id: '2', label: 'Send to Legal', type: 'escalate' },
          { id: '3', label: 'Accept Risk', type: 'reject', dangerous: true },
        ],
      },
    },
  ];
}

import { Label } from '@/components/ui/label';
