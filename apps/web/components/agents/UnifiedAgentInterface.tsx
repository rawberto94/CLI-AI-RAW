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
import { AgentAutonomySettingsPanel } from '@/components/agents/AgentAutonomySettingsPanel';
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
  Search,
  Loader2,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  FileText,
  Zap,
  Target,
  Users,
  Gavel,
  Lightbulb,
  Heart,
  FileSearch,
  Scale,
  Wrench,
  RotateCcw,
  BookOpen,
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
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useDataMode } from '@/contexts/DataModeContext';
import { unwrapApiResponseData } from '@/lib/api-fetch';

// ============================================================================
// VISUAL TOKENS — full static class names (Tailwind cannot see dynamic `bg-${x}-100`)
// ============================================================================

type Tone =
  | 'rose'
  | 'emerald'
  | 'orange'
  | 'violet'
  | 'amber'
  | 'blue'
  | 'indigo'
  | 'cyan'
  | 'teal'
  | 'pink'
  | 'slate'
  | 'green'
  | 'purple'
  | 'yellow'
  | 'fuchsia'
  | 'lime';

const TONE: Record<
  Tone,
  { wrap: string; icon: string; bar: string; soft: string; chip: string }
> = {
  rose: {
    wrap: 'bg-rose-50 border-rose-100',
    icon: 'text-rose-600',
    bar: 'from-rose-500 to-red-500',
    soft: 'bg-rose-50/60',
    chip: 'bg-rose-50 text-rose-700 border-rose-100',
  },
  emerald: {
    wrap: 'bg-emerald-50 border-emerald-100',
    icon: 'text-emerald-600',
    bar: 'from-emerald-500 to-teal-500',
    soft: 'bg-emerald-50/60',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  },
  orange: {
    wrap: 'bg-orange-50 border-orange-100',
    icon: 'text-orange-600',
    bar: 'from-orange-500 to-amber-500',
    soft: 'bg-orange-50/60',
    chip: 'bg-orange-50 text-orange-700 border-orange-100',
  },
  violet: {
    wrap: 'bg-violet-50 border-violet-100',
    icon: 'text-violet-600',
    bar: 'from-violet-500 to-purple-500',
    soft: 'bg-violet-50/60',
    chip: 'bg-violet-50 text-violet-700 border-violet-100',
  },
  amber: {
    wrap: 'bg-amber-50 border-amber-100',
    icon: 'text-amber-600',
    bar: 'from-amber-500 to-yellow-500',
    soft: 'bg-amber-50/60',
    chip: 'bg-amber-50 text-amber-800 border-amber-100',
  },
  blue: {
    wrap: 'bg-blue-50 border-blue-100',
    icon: 'text-blue-600',
    bar: 'from-blue-500 to-indigo-500',
    soft: 'bg-blue-50/60',
    chip: 'bg-blue-50 text-blue-700 border-blue-100',
  },
  indigo: {
    wrap: 'bg-indigo-50 border-indigo-100',
    icon: 'text-indigo-600',
    bar: 'from-indigo-500 to-violet-500',
    soft: 'bg-indigo-50/60',
    chip: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  },
  cyan: {
    wrap: 'bg-cyan-50 border-cyan-100',
    icon: 'text-cyan-600',
    bar: 'from-cyan-500 to-sky-500',
    soft: 'bg-cyan-50/60',
    chip: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  },
  teal: {
    wrap: 'bg-teal-50 border-teal-100',
    icon: 'text-teal-600',
    bar: 'from-teal-500 to-emerald-500',
    soft: 'bg-teal-50/60',
    chip: 'bg-teal-50 text-teal-700 border-teal-100',
  },
  pink: {
    wrap: 'bg-pink-50 border-pink-100',
    icon: 'text-pink-600',
    bar: 'from-pink-500 to-rose-500',
    soft: 'bg-pink-50/60',
    chip: 'bg-pink-50 text-pink-700 border-pink-100',
  },
  slate: {
    wrap: 'bg-slate-100 border-slate-200',
    icon: 'text-slate-600',
    bar: 'from-slate-500 to-slate-600',
    soft: 'bg-slate-50',
    chip: 'bg-slate-50 text-slate-700 border-slate-200',
  },
  green: {
    wrap: 'bg-green-50 border-green-100',
    icon: 'text-green-600',
    bar: 'from-green-500 to-emerald-500',
    soft: 'bg-green-50/60',
    chip: 'bg-green-50 text-green-700 border-green-100',
  },
  purple: {
    wrap: 'bg-purple-50 border-purple-100',
    icon: 'text-purple-600',
    bar: 'from-purple-500 to-violet-500',
    soft: 'bg-purple-50/60',
    chip: 'bg-purple-50 text-purple-700 border-purple-100',
  },
  yellow: {
    wrap: 'bg-yellow-50 border-yellow-100',
    icon: 'text-yellow-700',
    bar: 'from-yellow-500 to-amber-500',
    soft: 'bg-yellow-50/60',
    chip: 'bg-yellow-50 text-yellow-800 border-yellow-100',
  },
  fuchsia: {
    wrap: 'bg-fuchsia-50 border-fuchsia-100',
    icon: 'text-fuchsia-600',
    bar: 'from-fuchsia-500 to-pink-500',
    soft: 'bg-fuchsia-50/60',
    chip: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100',
  },
  lime: {
    wrap: 'bg-lime-50 border-lime-100',
    icon: 'text-lime-700',
    bar: 'from-lime-500 to-green-500',
    soft: 'bg-lime-50/60',
    chip: 'bg-lime-50 text-lime-800 border-lime-100',
  },
};

/** Map legacy color keys used in AGENT_CONFIGS → Tone */
const COLOR_TO_TONE: Record<string, Tone> = {
  red: 'rose',
  emerald: 'emerald',
  orange: 'orange',
  violet: 'violet',
  amber: 'amber',
  blue: 'blue',
  indigo: 'indigo',
  cyan: 'cyan',
  teal: 'teal',
  pink: 'pink',
  slate: 'slate',
  green: 'green',
  purple: 'purple',
  yellow: 'yellow',
  fuchsia: 'fuchsia',
  lime: 'lime',
};

function toneOf(color?: string): (typeof TONE)[Tone] {
  const key = COLOR_TO_TONE[color || 'slate'] || 'slate';
  return TONE[key];
}

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
const CLUSTER_CONFIG: Record<
  string,
  { name: string; emoji: string; color: string; description: string; tone: Tone }
> = {
  guardians: {
    name: 'Guardians',
    emoji: '🛡️',
    color: 'red',
    tone: 'rose',
    description: 'Compliance & risk protection',
  },
  oracles: {
    name: 'Oracles',
    emoji: '🔮',
    color: 'violet',
    tone: 'violet',
    description: 'Intelligence & discovery',
  },
  operators: {
    name: 'Operators',
    emoji: '⚡',
    color: 'cyan',
    tone: 'cyan',
    description: 'Execution & monitoring',
  },
  strategists: {
    name: 'Strategists',
    emoji: '🎯',
    color: 'purple',
    tone: 'purple',
    description: 'Workflow & planning',
  },
  evolution: {
    name: 'Evolution',
    emoji: '🧬',
    color: 'green',
    tone: 'emerald',
    description: 'Learning & improvement',
  },
};

const SUB_TAB =
  'rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm transition-all';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function UnifiedAgentInterface() {
  const { isRealData } = useDataMode();
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [activityQuery, setActivityQuery] = useState('');
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
      // Fetch status, activities, and approvals in parallel
      const [statusRes, activitiesRes, approvalsRes] = await Promise.all([
        fetch('/api/agents/status'),
        fetch('/api/agents/activities?limit=50'),
        fetch('/api/agents/approvals'),
      ]);

      // APIs wrap payloads as { success, data }; always unwrap before reading fields.
      if (statusRes.ok) {
        const statusData = unwrapApiResponseData<Record<string, unknown>>(await statusRes.json());
        void statusData;
      }

      let transformedActivities: AgentActivity[] = [];
      if (activitiesRes.ok) {
        const activitiesPayload = unwrapApiResponseData<{ activities?: any[] }>(
          await activitiesRes.json(),
        );
        const list = Array.isArray(activitiesPayload?.activities)
          ? activitiesPayload.activities
          : Array.isArray((activitiesPayload as any)?.data?.activities)
            ? (activitiesPayload as any).data.activities
            : [];

        transformedActivities = list.map((a: any) => ({
          id: a.id,
          agentName: a.agentCodename || a.agentName || 'Agent',
          agentId: a.agentId || 'unknown',
          icon: 'Bot',
          status: mapActivityStatus(a.status || a.outcome || '', a.type || a.eventType || ''),
          title: a.title || a.eventType || 'Agent Activity',
          description: a.description || a.reasoning || '',
          contractId: a.contractId,
          contractName: a.contractId ? 'Related Contract' : undefined,
          priority: mapActivityPriority(a.importance || a.priority || 'normal', a.type || ''),
          createdAt: a.timestamp || a.createdAt || a.requestedAt || new Date().toISOString(),
          requiresApproval: false,
        }));
      } else if (activitiesRes.status >= 500) {
        toast.error('Agent activities temporarily unavailable');
      }

      let approvalActivities: AgentActivity[] = [];
      if (approvalsRes.ok) {
        const approvalsPayload = unwrapApiResponseData<{ approvals?: any[] }>(
          await approvalsRes.json(),
        );
        const list = Array.isArray(approvalsPayload?.approvals)
          ? approvalsPayload.approvals
          : Array.isArray((approvalsPayload as any)?.data?.approvals)
            ? (approvalsPayload as any).data.approvals
            : [];

        approvalActivities = list.map((a: any) => ({
          id: a.id,
          agentName: a.agentCodename || a.agentName || 'Agent',
          agentId: a.agentId || 'unknown',
          icon: 'Shield',
          status: 'waiting_for_approval' as const,
          title: a.title || 'Approval required',
          description: a.description || '',
          contractId: a.contractId,
          contractName: a.context?.contractTitle,
          priority: (a.priority as Priority) || 'medium',
          createdAt: a.requestedAt || a.createdAt || new Date().toISOString(),
          requiresApproval: true,
          approvalContext: {
            type: mapApprovalType(a.type || 'custom'),
            recommendation: a.recommendation?.reason || 'Review and approve',
            reasoning: a.reasoning || a.description || '',
            confidence: a.recommendation?.confidence ?? 0.8,
            impact: a.context?.savings
              ? {
                  type: 'savings' as const,
                  value: a.context.savings,
                  currency: '$',
                }
              : undefined,
            alternatives: Array.isArray(a.alternatives)
              ? a.alternatives.map((alt: any) =>
                  typeof alt === 'string' ? alt : alt?.reason || alt?.label || String(alt),
                )
              : undefined,
            risks: a.context?.risks,
            actions: [
              { id: 'approve', label: 'Approve', type: 'approve' as const, primary: true },
              { id: 'reject', label: 'Reject', type: 'reject' as const },
              { id: 'modify', label: 'Request Changes', type: 'modify' as const },
            ],
          },
        }));
      } else if (approvalsRes.status >= 500) {
        toast.error('Approvals temporarily unavailable');
      }

      // Approvals first so HITL items surface above general activity
      const existingIds = new Set(approvalActivities.map((a) => a.id));
      const merged = [
        ...approvalActivities,
        ...transformedActivities.filter((a) => !existingIds.has(a.id)),
      ];
      setActivities(merged);
    } catch (error) {
      console.error('Failed to fetch agent data:', error);
      toast.error('Failed to load agent data');
      setActivities([]);
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
  const filteredActivities = activities.filter((a) => {
    if (filter === 'pending' && !(a.requiresApproval && a.status === 'waiting_for_approval')) {
      return false;
    }
    if (filter === 'completed' && a.status !== 'completed') return false;
    const q = activityQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      a.title.toLowerCase().includes(q) ||
      (a.description || '').toLowerCase().includes(q) ||
      (a.agentName || '').toLowerCase().includes(q) ||
      (a.agentId || '').toLowerCase().includes(q)
    );
  });

  // Stats
  const stats = {
    pending: activities.filter(a => a.requiresApproval && a.status === 'waiting_for_approval').length,
    completed: activities.filter(a => a.status === 'completed').length,
    working: activities.filter(a => a.status === 'working').length,
    critical: activities.filter(a => a.priority === 'critical').length,
  };

  const agentCount = Object.keys(AGENT_CONFIGS).length;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 shadow-sm">
            <Brain className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Agent command center</h2>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {agentCount} agents
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Directory, live activity, and autonomy controls
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {stats.pending > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
              <Clock className="h-3 w-3" />
              {stats.pending} pending
            </span>
          )}
          {stats.critical > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
              <AlertTriangle className="h-3 w-3" />
              {stats.critical} critical
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="h-8 rounded-lg border-slate-200 text-xs font-medium"
          >
            <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="agents" className="flex flex-col">
        <div className="border-b border-slate-100 px-4 py-2.5">
          <TabsList className="h-auto w-full justify-start gap-1 rounded-lg bg-slate-100/80 p-1">
            <TabsTrigger value="agents" className={SUB_TAB}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Directory
            </TabsTrigger>
            <TabsTrigger value="activities" className={SUB_TAB}>
              <Bot className="mr-1.5 h-3.5 w-3.5" />
              Activities
              {stats.pending > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                  {stats.pending}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className={SUB_TAB}>
              <History className="mr-1.5 h-3.5 w-3.5" />
              History
            </TabsTrigger>
            <TabsTrigger value="settings" className={SUB_TAB}>
              <Settings className="mr-1.5 h-3.5 w-3.5" />
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Directory first — the main visual surface */}
        <TabsContent value="agents" className="m-0 p-5">
          <AgentDirectory />
        </TabsContent>

        <TabsContent value="activities" className="m-0">
          <div className="flex min-h-[520px] flex-col lg:flex-row">
            <div className="flex w-full flex-col border-b border-slate-100 lg:w-[360px] lg:border-b-0 lg:border-r">
              <div className="space-y-3 border-b border-slate-100 p-4">
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'pending', label: 'Pending' },
                      { id: 'completed', label: 'Done' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilter(f.id)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                        filter === f.id
                          ? 'border-violet-200 bg-violet-50 text-violet-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={activityQuery}
                    onChange={(e) => setActivityQuery(e.target.value)}
                    placeholder="Search activities…"
                    className="h-9 rounded-lg border-slate-200 pl-9 text-sm"
                  />
                </div>
              </div>

              <ScrollArea className="max-h-[480px] flex-1">
                {loading ? (
                  <div className="space-y-3 p-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="animate-pulse space-y-2 rounded-xl border border-slate-100 p-3">
                        <div className="h-3.5 w-3/4 rounded bg-slate-100" />
                        <div className="h-3 w-1/2 rounded bg-slate-100" />
                      </div>
                    ))}
                  </div>
                ) : filteredActivities.length === 0 ? (
                  <div className="flex flex-col items-center px-6 py-16 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                      <Bot className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-800">No activity yet</p>
                    <p className="mt-1 max-w-[220px] text-xs leading-relaxed text-slate-500">
                      When agents run goals or raise approvals, they show up here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 p-2">
                    {filteredActivities.map((activity) => (
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

            <div className="flex-1 bg-slate-50/40 p-5">
              {selectedActivity ? (
                <ActivityDetail
                  activity={selectedActivity}
                  onApprove={() => setApprovalDialogOpen(true)}
                  onFeedback={() => setFeedbackDialogOpen(true)}
                />
              ) : (
                <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <Bot className="h-7 w-7 text-slate-300" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">Select an activity</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Review details, confidence, and approve recommendations
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="m-0 p-5">
          <ActivityHistory />
        </TabsContent>

        <TabsContent value="settings" className="m-0 p-5">
          <AgentSettings />
        </TabsContent>
      </Tabs>

      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent className="max-w-2xl rounded-xl">
          <DialogHeader>
            <DialogTitle>Review recommendation</DialogTitle>
            <DialogDescription>
              Confirm the agent&apos;s proposal before it is applied
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

      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Provide feedback</DialogTitle>
            <DialogDescription>Help improve agent recommendations</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="What worked or didn’t about this recommendation?"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
            className="rounded-lg border-slate-200"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackDialogOpen(false)} className="rounded-lg">
              Cancel
            </Button>
            <Button onClick={submitFeedback} className="rounded-lg bg-violet-600 hover:bg-violet-700">
              Submit
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
  const tone = toneOf(config.color);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-xl border p-3 text-left transition-all',
        selected
          ? 'border-violet-200 bg-violet-50/70 shadow-sm'
          : 'border-transparent bg-transparent hover:border-slate-200 hover:bg-slate-50',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border',
            tone.wrap,
          )}
        >
          <Icon className={cn('h-4 w-4', tone.icon)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <p className="truncate text-sm font-medium text-slate-900">{activity.title}</p>
            {activity.requiresApproval && activity.status === 'waiting_for_approval' && (
              <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                Action
              </span>
            )}
          </div>
          {activity.description && (
            <p className="mb-2 line-clamp-2 text-xs leading-relaxed text-slate-500">
              {activity.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={activity.status} />
            <PriorityBadge priority={activity.priority} />
            <span className="text-[11px] text-slate-400">
              {formatRelativeTime(activity.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </button>
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
    avatar: '🤖',
    codename: activity.agentName,
    cluster: 'operators',
  };
  const Icon = config.icon;
  const tone = toneOf(config.color);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="overflow-hidden rounded-xl border-slate-200/90 shadow-sm">
        <div className={cn('h-1 bg-gradient-to-r', tone.bar)} />
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-xl border',
                  tone.wrap,
                )}
              >
                <Icon className={cn('h-5 w-5', tone.icon)} />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  {activity.title}
                </CardTitle>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">
                    {config.avatar} {config.codename}
                  </span>
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 capitalize text-slate-500">
                    {config.cluster}
                  </span>
                  <span>{formatRelativeTime(activity.createdAt)}</span>
                </p>
              </div>
            </div>
            <StatusBadge status={activity.status} size="lg" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-slate-600">{activity.description}</p>

          {activity.contractId && (
            <a
              href={`/contracts/${activity.contractId}`}
              className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-violet-700 transition-colors hover:border-violet-200 hover:bg-violet-50"
            >
              <FileText className="h-4 w-4" />
              <span className="font-medium">{activity.contractName || 'View contract'}</span>
              <ExternalLink className="ml-auto h-3.5 w-3.5 opacity-60" />
            </a>
          )}
        </CardContent>
      </Card>

      {activity.requiresApproval &&
        activity.status === 'waiting_for_approval' &&
        activity.approvalContext && (
          <Card className="overflow-hidden rounded-xl border-amber-200/80 bg-amber-50/40 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Approval required
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800/70">
                  Recommendation
                </p>
                <p className="text-sm leading-relaxed text-slate-700">
                  {activity.approvalContext.recommendation}
                </p>
              </div>

              {activity.approvalContext.impact && (
                <div className="rounded-xl border border-white bg-white/80 px-4 py-3 shadow-sm">
                  <p className="text-2xl font-semibold tabular-nums text-violet-700">
                    {activity.approvalContext.impact.type === 'savings' ? '+' : ''}
                    {activity.approvalContext.impact.currency}
                    {activity.approvalContext.impact.value.toLocaleString()}
                  </p>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Estimated {activity.approvalContext.impact.type}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={onApprove}
                  className="rounded-lg bg-violet-600 hover:bg-violet-700"
                >
                  <CheckCircle className="mr-1.5 h-4 w-4" />
                  Review & decide
                </Button>
                <Button variant="outline" onClick={onFeedback} className="rounded-lg border-slate-200">
                  <MessageSquare className="mr-1.5 h-4 w-4" />
                  Feedback
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

      {activity.result && (
        <Card className="rounded-xl border-slate-200/90 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-900">Result</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-slate-600">{activity.result.summary}</p>
            {activity.result.artifacts && activity.result.artifacts.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {activity.result.artifacts.map((artifact, i) => (
                  <Button key={i} variant="outline" size="sm" asChild className="rounded-lg">
                    <a href={artifact.url} target="_blank" rel="noopener noreferrer">
                      <FileText className="mr-1.5 h-3.5 w-3.5" />
                      {artifact.name}
                    </a>
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activity.status === 'completed' && (
        <div className="flex items-center justify-center gap-3 py-2">
          <p className="text-xs text-slate-500">Was this helpful?</p>
          <Button variant="outline" size="sm" onClick={onFeedback} className="h-8 rounded-lg">
            <ThumbsUp className="mr-1.5 h-3.5 w-3.5" />
            Yes
          </Button>
          <Button variant="outline" size="sm" onClick={onFeedback} className="h-8 rounded-lg">
            <ThumbsDown className="mr-1.5 h-3.5 w-3.5" />
            No
          </Button>
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
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Agent reasoning
        </p>
        <p className="text-sm leading-relaxed text-slate-700">{context.reasoning}</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Confidence</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-violet-500"
              style={{ width: `${Math.min(100, Math.max(0, context.confidence * 100))}%` }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums text-slate-700">
            {Math.round(context.confidence * 100)}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {context.risks && context.risks.length > 0 && (
          <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-rose-800">
              <AlertTriangle className="h-3.5 w-3.5" />
              Potential risks
            </p>
            <ul className="space-y-1.5 text-xs leading-relaxed text-rose-700">
              {context.risks.map((risk, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose-400" />
                  {risk}
                </li>
              ))}
            </ul>
          </div>
        )}

        {context.alternatives && context.alternatives.length > 0 && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-blue-800">
              <Lightbulb className="h-3.5 w-3.5" />
              Alternatives
            </p>
            <ul className="space-y-1.5 text-xs leading-relaxed text-blue-700">
              {context.alternatives.map((alt, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-blue-400" />
                  {alt}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="notes" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Notes (optional)
        </Label>
        <Textarea
          id="notes"
          placeholder="Add context or conditions…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1.5 rounded-lg border-slate-200"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {context.actions.map((action) => (
          <Button
            key={action.id}
            variant={action.dangerous ? 'destructive' : action.primary ? 'default' : 'outline'}
            onClick={() => onAction(action, notes)}
            className={cn(
              'flex-1 rounded-lg',
              action.primary && !action.dangerous && 'bg-violet-600 hover:bg-violet-700',
            )}
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
  const styles: Record<AgentStatus, string> = {
    idle: 'bg-slate-50 text-slate-600 border-slate-200',
    working: 'bg-blue-50 text-blue-700 border-blue-100',
    waiting_for_approval: 'bg-amber-50 text-amber-800 border-amber-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    error: 'bg-rose-50 text-rose-700 border-rose-100',
  };

  const icons: Record<AgentStatus, typeof Loader2 | null> = {
    idle: null,
    working: Loader2,
    waiting_for_approval: Clock,
    completed: CheckCircle,
    error: XCircle,
  };

  const safe = styles[status] ? status : 'idle';
  const Icon = icons[safe];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium capitalize',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        styles[safe],
      )}
    >
      {Icon && (
        <Icon
          className={cn(
            size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5',
            safe === 'working' && 'animate-spin',
          )}
        />
      )}
      {safe.replace(/_/g, ' ')}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const styles: Record<Priority, string> = {
    low: 'bg-slate-50 text-slate-600 border-slate-200',
    medium: 'bg-blue-50 text-blue-700 border-blue-100',
    high: 'bg-orange-50 text-orange-700 border-orange-100',
    critical: 'bg-rose-50 text-rose-700 border-rose-100',
  };
  const safePriority: Priority = styles[priority] ? priority : 'medium';

  return (
    <span
      className={cn(
        'rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize',
        styles[safePriority],
      )}
    >
      {safePriority}
    </span>
  );
}

// ============================================================================
// PLACEHOLDER COMPONENTS
// ============================================================================

const AUTONOMY_MODE_BADGE: Record<string, string> = {
  suggest: 'bg-slate-100 text-slate-700 border-slate-200',
  review: 'bg-amber-100 text-amber-900 border-amber-200',
  auto: 'bg-emerald-100 text-emerald-900 border-emerald-200',
};

function AgentDirectory() {
  const [modes, setModes] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [clusterFilter, setClusterFilter] = useState<string>('all');
  const [modeFilter, setModeFilter] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/agents/autonomy');
        if (!res.ok) return;
        const json = await res.json();
        const payload = unwrapApiResponseData<{ configs?: Array<{ agentId: string; actionType: string; mode: string }> }>(json);
        const configs = payload?.configs ?? (json as any)?.configs ?? [];
        const map: Record<string, string> = {};
        for (const c of configs as Array<{ agentId: string; actionType: string; mode: string }>) {
          if (!map[c.agentId] || c.actionType === 'agent_write' || c.actionType === 'agent_goal') {
            map[c.agentId] = c.mode;
          }
        }
        if (!cancelled) setModes(map);
      } catch {
        /* best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const q = query.trim().toLowerCase();

  const filteredEntries = Object.entries(AGENT_CONFIGS).filter(([id, config]) => {
    if (clusterFilter !== 'all' && config.cluster !== clusterFilter) return false;
    const mode = modes[id] || 'review';
    if (modeFilter !== 'all' && mode !== modeFilter) return false;
    if (!q) return true;
    return (
      config.codename.toLowerCase().includes(q) ||
      config.name.toLowerCase().includes(q) ||
      config.description.toLowerCase().includes(q) ||
      id.toLowerCase().includes(q)
    );
  });

  const agentsByCluster = filteredEntries.reduce((acc, [id, config]) => {
    if (!acc[config.cluster]) acc[config.cluster] = [];
    acc[config.cluster].push([id, config]);
    return acc;
  }, {} as Record<string, [string, typeof AGENT_CONFIGS[string]][]>);

  const clusterOrder = Object.keys(CLUSTER_CONFIG);
  const orderedClusters = [
    ...clusterOrder.filter((id) => agentsByCluster[id]?.length),
    ...Object.keys(agentsByCluster).filter((id) => !clusterOrder.includes(id)),
  ];

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200/90 bg-slate-50/60 p-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents by name, role, or id…"
            className="h-9 rounded-lg border-slate-200 bg-white pl-9 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setClusterFilter('all')}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
              clusterFilter === 'all'
                ? 'border-violet-200 bg-violet-50 text-violet-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            )}
          >
            All clusters
          </button>
          {Object.entries(CLUSTER_CONFIG).map(([id, c]) => (
            <button
              key={id}
              type="button"
              onClick={() => setClusterFilter(id)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                clusterFilter === id
                  ? 'border-violet-200 bg-violet-50 text-violet-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {c.emoji} {c.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(['all', 'suggest', 'review', 'auto'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModeFilter(m)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors',
                modeFilter === m
                  ? 'border-slate-300 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {m === 'all' ? 'Any mode' : m}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          Showing{' '}
          <span className="font-semibold text-slate-700">{filteredEntries.length}</span> of{' '}
          {Object.keys(AGENT_CONFIGS).length} agents
        </span>
        {(query || clusterFilter !== 'all' || modeFilter !== 'all') && (
          <button
            type="button"
            className="font-medium text-violet-600 hover:text-violet-700"
            onClick={() => {
              setQuery('');
              setClusterFilter('all');
              setModeFilter('all');
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {orderedClusters.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-14 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-800">No agents match</p>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            Try a different search or clear the cluster / mode filters.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {orderedClusters.map((clusterId) => {
            const agents = agentsByCluster[clusterId];
            const cluster = CLUSTER_CONFIG[clusterId] || {
              name: clusterId,
              emoji: '🤖',
              color: 'slate',
              tone: 'slate' as Tone,
              description: 'Agent cluster',
            };
            const clusterTone = TONE[cluster.tone] || TONE.slate;
            return (
              <section key={clusterId}>
                <div className="mb-3 flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg border text-base',
                      clusterTone.wrap,
                    )}
                  >
                    {cluster.emoji}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{cluster.name}</h3>
                    <p className="text-xs text-slate-500">{cluster.description}</p>
                  </div>
                  <span className="ml-auto rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                    {agents.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {agents.map(([id, config]) => {
                    const Icon = config.icon;
                    const mode = modes[id] || 'review';
                    const tone = toneOf(config.color);
                    return (
                      <Card
                        key={id}
                        className="group overflow-hidden rounded-xl border-slate-200/90 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                      >
                        <div className={cn('h-1 bg-gradient-to-r', tone.bar)} />
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border',
                                tone.wrap,
                              )}
                            >
                              <Icon className={cn('h-5 w-5', tone.icon)} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-semibold text-slate-900">
                                  {config.codename}
                                </h4>
                                <span className="font-mono text-[10px] text-violet-500">
                                  @{config.codename.toLowerCase()}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'ml-auto h-5 border text-[10px] font-semibold capitalize',
                                    AUTONOMY_MODE_BADGE[mode] || AUTONOMY_MODE_BADGE.review,
                                  )}
                                  title="Autonomy mode"
                                >
                                  {mode}
                                </Badge>
                              </div>
                              <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400">
                                {config.name}
                              </p>
                              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                                {config.description}
                              </p>
                              <div className="mt-3 flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 flex-1 rounded-lg border-slate-200 text-xs font-medium"
                                  onClick={() => {
                                    toast.info(`Set autonomy for ${config.codename} in Settings`);
                                  }}
                                >
                                  Configure
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-8 flex-1 rounded-lg bg-violet-600 text-xs font-medium hover:bg-violet-700"
                                  onClick={() => {
                                    toast.message(`${config.codename} ready`, {
                                      description: 'Open Chat and @mention this agent to invoke it.',
                                    });
                                  }}
                                >
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
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActivityHistory() {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
        <History className="h-5 w-5 text-slate-400" />
      </div>
      <p className="text-sm font-medium text-slate-800">No history yet</p>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
        Completed agent runs and decisions will be archived here for audit and learning.
      </p>
    </div>
  );
}

function AgentSettings() {
  // Phase 2.1: real per-agent autonomy controls (default mode=review)
  return <AgentAutonomySettingsPanel />;
}

// ============================================================================
// UTILITIES
// ============================================================================

function formatRelativeTime(dateString: string): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '—';
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
