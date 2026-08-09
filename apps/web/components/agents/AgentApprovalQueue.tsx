'use client';

/**
 * Agent Approval Queue Component
 * Human-in-the-loop approval interface for AI agent goals
 *
 * Improvements (8-point UI/UX suite):
 * - Cross-links to goal detail pages
 * - Confirmation dialogs before approve
 * - Toast notifications on actions & SSE events
 * - ARIA accessibility labels throughout
 * - Escalation countdown timer
 * - Search / filter by type
 * - SSE exhaustion warning banner with reconnect
 * - Skeleton loading, relative timestamps, design-system Button
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useAgentSSE, type AgentSSEEventType } from '@/hooks/useAgentSSE';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Edit3,
  Play,
  Pause,
  RotateCcw,
  MessageSquare,
  User,
  Target,
  ListChecks,
  Search,
  ExternalLink,
  WifiOff,
  Timer,
  ArrowRight,
} from 'lucide-react';
import { CitationList } from '@/components/ai/CitationList';
import { formatFieldValue, type Citation } from '@/lib/ai/citations';
import { toastWithUndo } from '@/lib/toast-utils';

// ============================================================================
// Types
// ============================================================================

interface AgentGoalStep {
  id: string;
  order: number;
  name: string;
  type: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  output?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
}

interface AgentGoal {
  id: string;
  title: string;
  description?: string;
  status: 'PENDING' | 'PLANNING' | 'AWAITING_APPROVAL' | 'EXECUTING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  type: string;
  context?: Record<string, unknown>;
  plan?: Record<string, unknown> & {
    requiredApprovals?: string[];
    riskAssessment?: { level?: string; requiresHumanApproval?: boolean };
  };
  progress: number;
  error?: string;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  steps: AgentGoalStep[];
}

const APPROVAL_TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  human_review: { label: 'Human Review', color: 'bg-blue-100 text-blue-800', icon: '👤' },
  management_approval: { label: 'Management', color: 'bg-purple-100 text-purple-800', icon: '👔' },
  finance_approval: { label: 'Finance', color: 'bg-green-100 text-green-800', icon: '💰' },
  legal_approval: { label: 'Legal', color: 'bg-orange-100 text-orange-800', icon: '⚖️' },
};

const ESCALATION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface ApprovalQueueProps {
  onGoalApproved?: (goalId: string) => void;
  onGoalRejected?: (goalId: string) => void;
  className?: string;
}

/** Pending agent field mutation from write-gateway (AiDecision outcome=pending) */
interface AgentFieldWrite {
  id: string; // agent-write-{decisionId}
  decisionId: string;
  agentId: string;
  contractId?: string | null;
  field: string;
  proposedValue: unknown;
  /** Snapshot of the value before the proposal (may be absent on legacy rows) */
  previousValue?: unknown;
  hasPreviousValue?: boolean;
  confidence: number;
  requestedAt: string;
  citations?: Citation[] | unknown;
  evidenceChain?: Citation[] | unknown;
}

// ============================================================================
// Helper Components
// ============================================================================

function StatusBadge({ status }: { status: AgentGoal['status'] }) {
  const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    PENDING: { color: 'bg-gray-100 text-gray-800', icon: <Clock className="h-3 w-3" />, label: 'Pending' },
    PLANNING: { color: 'bg-violet-100 text-violet-800', icon: <Target className="h-3 w-3" />, label: 'Planning' },
    AWAITING_APPROVAL: { color: 'bg-yellow-100 text-yellow-800', icon: <AlertTriangle className="h-3 w-3" />, label: 'Awaiting Approval' },
    EXECUTING: { color: 'bg-violet-100 text-indigo-800', icon: <Play className="h-3 w-3" />, label: 'Executing' },
    PAUSED: { color: 'bg-orange-100 text-orange-800', icon: <Pause className="h-3 w-3" />, label: 'Paused' },
    COMPLETED: { color: 'bg-green-100 text-green-800', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Completed' },
    FAILED: { color: 'bg-red-100 text-red-800', icon: <XCircle className="h-3 w-3" />, label: 'Failed' },
    CANCELLED: { color: 'bg-gray-100 text-gray-600', icon: <XCircle className="h-3 w-3" />, label: 'Cancelled' },
  };
  const config = statusConfig[status] || statusConfig.PENDING;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

function StepList({ steps, expanded }: { steps: AgentGoalStep[]; expanded: boolean }) {
  if (!expanded || steps.length === 0) return null;
  const stepStatusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
    PENDING: { color: 'text-gray-400', icon: <Clock className="h-4 w-4" /> },
    RUNNING: { color: 'text-violet-500', icon: <RotateCcw className="h-4 w-4 animate-spin" /> },
    COMPLETED: { color: 'text-green-500', icon: <CheckCircle2 className="h-4 w-4" /> },
    FAILED: { color: 'text-red-500', icon: <XCircle className="h-4 w-4" /> },
    SKIPPED: { color: 'text-gray-400', icon: <XCircle className="h-4 w-4" /> },
  };
  return (
    <div className="mt-4 border-t pt-4">
      <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
        <ListChecks className="h-4 w-4" />
        Execution Plan ({steps.length} steps)
      </h4>
      <div className="space-y-2">
        {steps.map((step, index) => {
          const config = stepStatusConfig[step.status] || stepStatusConfig.PENDING;
          return (
            <div key={step.id} className="flex items-start gap-3 p-2 rounded bg-gray-50">
              <div className={`mt-0.5 ${config.color}`}>{config.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{index + 1}. {step.name}</p>
                {step.type && <p className="text-xs text-gray-500 mt-0.5">Type: {step.type}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Escalation countdown timer */
function EscalationCountdown({ goal }: { goal: AgentGoal }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const ctx = goal.context as Record<string, unknown> | undefined;
    const escalatedAt = ctx?.escalatedAt;
    if (goal.status !== 'AWAITING_APPROVAL' || !escalatedAt) {
      setRemaining(null);
      return;
    }
    const escalationTime = new Date(escalatedAt as string).getTime();
    const tick = () => {
      const left = Math.max(0, (escalationTime + ESCALATION_TIMEOUT_MS) - Date.now());
      setRemaining(left);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [goal.status, goal.context]);

  if (remaining === null) return null;
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const urgent = remaining < 60000;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
        urgent ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-amber-100 text-amber-700'
      }`}
      aria-live="polite"
      aria-label={`Escalation in ${mins} minutes ${secs} seconds`}
    >
      <Timer className="h-3 w-3" />
      {remaining === 0 ? 'Escalating...' : `${mins}:${secs.toString().padStart(2, '0')}`}
    </span>
  );
}

/** Skeleton loader for goal cards */
function GoalCardSkeleton() {
  return (
    <div className="bg-white border rounded-lg shadow-sm p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-8 w-8 rounded" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
    </div>
  );
}

// ============================================================================
// GoalCard
// ============================================================================

function GoalCard({
  goal,
  onApprove,
  onReject,
  onModify,
  isProcessing,
  onEvidenceViewed,
}: {
  goal: AgentGoal;
  onApprove: (id: string) => void;
  onReject: (id: string, feedback: string) => void;
  onModify: (id: string, feedback: string, modifiedPlan?: Record<string, unknown>) => void;
  isProcessing: boolean;
  onEvidenceViewed?: (goalId: string) => void;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackAction, setFeedbackAction] = useState<'reject' | 'modify'>('reject');
  const [editedSteps, setEditedSteps] = useState<Array<{ action: string; description: string }>>([]);
  const [showStepEditor, setShowStepEditor] = useState(false);

  const openModifyMode = () => {
    setFeedbackAction('modify');
    setShowFeedback(true);
    const planSteps = (goal.plan as Record<string, unknown>)?.steps;
    if (Array.isArray(planSteps)) {
      setEditedSteps(planSteps.map((s: Record<string, unknown>) => ({
        action: String(s.action || ''),
        description: String(s.description || ''),
      })));
      setShowStepEditor(true);
    } else {
      setEditedSteps([]);
      setShowStepEditor(false);
    }
  };

  const updateStep = (index: number, field: 'action' | 'description', value: string) => {
    setEditedSteps(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeStep = (index: number) => {
    setEditedSteps(prev => prev.filter((_, i) => i !== index));
  };

  const addStep = () => {
    setEditedSteps(prev => [...prev, { action: '', description: '' }]);
  };

  const handleSubmitFeedback = () => {
    if (feedbackAction === 'reject') {
      onReject(goal.id, feedback);
    } else {
      let modifiedPlan: Record<string, unknown> | undefined;
      if (showStepEditor && editedSteps.length > 0) {
        const plan = (goal.plan || {}) as Record<string, unknown>;
        modifiedPlan = {
          ...plan,
          steps: editedSteps.map((s, i) => ({
            id: `step-${i + 1}`,
            order: i,
            action: s.action,
            description: s.description,
            status: 'pending',
            dependencies: [],
          })),
        };
      }
      onModify(goal.id, feedback, modifiedPlan);
    }
    setShowFeedback(false);
    setFeedback('');
    setEditedSteps([]);
    setShowStepEditor(false);
  };

  const isAwaitingApproval = goal.status === 'AWAITING_APPROVAL';

  return (
    <div className="bg-white border rounded-lg shadow-sm overflow-hidden" role="article" aria-label={`Goal: ${goal.title}`}>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Clickable title links to goal detail page */}
              <button
                onClick={() => router.push(`/agents/goals/${goal.id}`)}
                className="text-lg font-semibold text-gray-900 truncate hover:text-violet-700 hover:underline focus:outline-none focus:ring-2 focus:ring-violet-400 rounded text-left"
                aria-label={`View details for ${goal.title}`}
              >
                {goal.title}
              </button>
              <ExternalLink className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" aria-hidden="true" />
              <StatusBadge status={goal.status} />
              <EscalationCountdown goal={goal} />
            </div>
            {goal.description && (
              <p className="mt-1 text-sm text-gray-600 line-clamp-2">{goal.description}</p>
            )}
            <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" aria-hidden="true" />
                {goal.type}
              </span>
              <span title={new Date(goal.createdAt).toLocaleString()}>
                {formatDistanceToNow(new Date(goal.createdAt), { addSuffix: true })}
              </span>
              {goal.progress > 0 && <span>Progress: {goal.progress}%</span>}
            </div>
            {/* Required approval types */}
            {goal.plan?.requiredApprovals && goal.plan.requiredApprovals.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {goal.plan.requiredApprovals.map((approval: string) => {
                  const config = APPROVAL_TYPE_CONFIG[approval] || { label: approval.replace(/_/g, ' '), color: 'bg-gray-100 text-gray-700', icon: '🔒' };
                  return (
                    <span key={approval} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                      {config.icon} {config.label}
                    </span>
                  );
                })}
                {goal.plan.riskAssessment?.level && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    goal.plan.riskAssessment.level === 'critical' ? 'bg-red-100 text-red-800' :
                    goal.plan.riskAssessment.level === 'high' ? 'bg-orange-100 text-orange-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    Risk: {goal.plan.riskAssessment.level}
                  </span>
                )}
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse goal details' : 'Expand goal details'}
            className="ml-4"
          >
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </Button>
        </div>

        {/* Progress bar */}
        {goal.progress > 0 && (
          <div className="mt-3 w-full bg-gray-200 rounded-full h-1.5" role="progressbar" aria-valuenow={goal.progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="bg-violet-600 h-1.5 rounded-full transition-all" style={{ width: `${goal.progress}%` }} />
          </div>
        )}

        {/* Approve / Reject / Modify actions with confirmation dialog for approve */}
        {isAwaitingApproval && (
          <div className="mt-4 flex items-center gap-2 flex-wrap" role="group" aria-label="Approval actions">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={isProcessing} className="bg-green-600 hover:bg-green-700 text-white" aria-label="Approve this goal">
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Approve Goal</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to approve &ldquo;{goal.title}&rdquo;? The agent will begin autonomous execution immediately.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onApprove(goal.id)} className="bg-green-600 hover:bg-green-700">
                    Yes, Approve
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button size="sm" variant="destructive" onClick={() => { setFeedbackAction('reject'); setShowFeedback(true); }} disabled={isProcessing} aria-label="Reject this goal">
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
            <Button size="sm" variant="outline" onClick={openModifyMode} disabled={isProcessing} aria-label="Request changes to this goal">
              <Edit3 className="h-4 w-4 mr-1" />
              Request Changes
            </Button>
          </div>
        )}

        {/* Feedback input + optional structured step editor */}
        {showFeedback && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MessageSquare className="h-4 w-4 inline mr-1" />
              {feedbackAction === 'reject' ? 'Rejection Reason' : 'Requested Changes'}
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={feedbackAction === 'reject'
                ? 'Explain why this goal is being rejected...'
                : 'Describe what changes are needed...'}
              className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-violet-500"
              rows={3}
              aria-label={feedbackAction === 'reject' ? 'Rejection reason' : 'Requested changes'}
            />

            {feedbackAction === 'modify' && showStepEditor && editedSteps.length > 0 && (
              <div className="mt-3 border-t pt-3">
                <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <ListChecks className="h-4 w-4" />
                  Edit Execution Steps
                </h5>
                <div className="space-y-2">
                  {editedSteps.map((step, idx) => (
                    <div key={idx} className="flex gap-2 items-start bg-white p-2 rounded border">
                      <span className="text-xs text-gray-400 mt-2 w-6 text-center flex-shrink-0">{idx + 1}</span>
                      <div className="flex-1 space-y-1">
                        <input
                          type="text"
                          value={step.action}
                          onChange={(e) => updateStep(idx, 'action', e.target.value)}
                          placeholder="Action name"
                          className="w-full px-2 py-1 border rounded text-xs font-mono focus:ring-1 focus:ring-violet-400"
                          aria-label={`Step ${idx + 1} action`}
                        />
                        <input
                          type="text"
                          value={step.description}
                          onChange={(e) => updateStep(idx, 'description', e.target.value)}
                          placeholder="Step description"
                          className="w-full px-2 py-1 border rounded text-xs focus:ring-1 focus:ring-violet-400"
                          aria-label={`Step ${idx + 1} description`}
                        />
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeStep(idx)} className="text-red-400 hover:text-red-600 flex-shrink-0" aria-label={`Remove step ${idx + 1}`}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" size="sm" onClick={addStep} className="mt-2 text-xs text-violet-600 hover:text-violet-800">
                  + Add Step
                </Button>
              </div>
            )}

            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setShowFeedback(false); setShowStepEditor(false); }}>Cancel</Button>
              <Button size="sm" onClick={handleSubmitFeedback} disabled={!feedback.trim()} className="bg-violet-600 hover:bg-violet-700 text-white">
                Submit
              </Button>
            </div>
          </div>
        )}

        {/* Existing feedback/error */}
        {goal.error && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded-lg" role="alert">
            <p className="text-sm text-yellow-800"><strong>Notes:</strong> {goal.error}</p>
          </div>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4">
          {goal.context && Object.keys(goal.context).length > 0 && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Input Context</h4>
              <pre className="text-xs text-gray-600 overflow-x-auto">{JSON.stringify(goal.context, null, 2)}</pre>
            </div>
          )}
          {goal.plan && Object.keys(goal.plan).length > 0 && (
            <div className="mt-2 p-3 bg-violet-50 rounded-lg">
              <h4 className="text-sm font-medium text-violet-800 mb-2">Execution Plan</h4>
              <pre className="text-xs text-violet-700 overflow-x-auto">{JSON.stringify(goal.plan, null, 2)}</pre>
            </div>
          )}
          {/* Goal plan / context evidence (agentic UX 1.1) */}
          <div className="mt-3">
            <CitationList
              citations={
                (goal.plan as Record<string, unknown> | undefined)?.citations ??
                (goal.context as Record<string, unknown> | undefined)?.citations ??
                (goal.plan as Record<string, unknown> | undefined)?.evidence ??
                (goal.context as Record<string, unknown> | undefined)?.evidence
              }
              contractId={
                ((goal.context as Record<string, unknown> | undefined)?.contractId as string) ||
                undefined
              }
              emptyLabel="No evidence recorded"
              onEvidenceViewed={() => onEvidenceViewed?.(goal.id)}
            />
          </div>
          <StepList steps={goal.steps} expanded={true} />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// FieldWriteCard — agent write-gateway proposals
// ============================================================================

function FieldValueDiff({
  previousValue,
  proposedValue,
  hasPreviousValue,
}: {
  previousValue: unknown;
  proposedValue: unknown;
  hasPreviousValue?: boolean;
}) {
  if (!hasPreviousValue) {
    return (
      <div className="mt-3 p-3 bg-slate-50 rounded-md border">
        <p className="text-xs font-medium text-slate-500 mb-1">Proposed value</p>
        <pre className="text-sm text-slate-800 whitespace-pre-wrap break-all">
          {formatFieldValue(proposedValue)}
        </pre>
      </div>
    );
  }

  const oldText = formatFieldValue(previousValue);
  const newText = formatFieldValue(proposedValue);

  return (
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="field-value-diff">
      <div className="p-3 bg-red-50/60 rounded-md border border-red-100">
        <p className="text-xs font-medium text-red-700/80 mb-1">Current (before)</p>
        <pre className="text-sm text-slate-800 whitespace-pre-wrap break-all line-through decoration-red-300/60">
          {oldText}
        </pre>
      </div>
      <div className="p-3 bg-emerald-50/70 rounded-md border border-emerald-100 relative">
        <div className="absolute -left-3 top-1/2 -translate-y-1/2 hidden sm:flex h-6 w-6 items-center justify-center rounded-full bg-white border text-slate-400 shadow-sm">
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
        <p className="text-xs font-medium text-emerald-800 mb-1">Proposed (after)</p>
        <pre className="text-sm text-slate-900 whitespace-pre-wrap break-all font-medium">
          {newText}
        </pre>
      </div>
    </div>
  );
}

function FieldWriteCard({
  item,
  onApprove,
  onReject,
  isProcessing,
  onEvidenceViewed,
}: {
  item: AgentFieldWrite;
  onApprove: (id: string) => void;
  onReject: (id: string, notes: string) => void;
  isProcessing: boolean;
  onEvidenceViewed?: (decisionId: string) => void;
}) {
  const router = useRouter();
  const [showReject, setShowReject] = useState(false);
  const [notes, setNotes] = useState('');

  return (
    <div
      className="bg-white border border-amber-200 rounded-lg shadow-sm p-4"
      role="article"
      aria-label={`Field change proposal: ${item.field}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-900">
              Field change
            </span>
            <span className="text-lg font-semibold text-gray-900 font-mono">{item.field}</span>
            <span className="text-xs text-gray-500">
              {(item.confidence * 100).toFixed(0)}% confidence
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Agent <span className="font-medium">{item.agentId}</span> proposes a new value
            {item.contractId ? (
              <>
                {' '}on{' '}
                <button
                  type="button"
                  className="text-violet-700 hover:underline"
                  onClick={() => router.push(`/contracts/${item.contractId}`)}
                >
                  contract {item.contractId.slice(0, 8)}…
                </button>
              </>
            ) : null}
          </p>
          <FieldValueDiff
            previousValue={item.previousValue}
            proposedValue={item.proposedValue}
            hasPreviousValue={item.hasPreviousValue}
          />
          <div className="mt-3">
            <CitationList
              citations={
                Array.isArray(item.citations) && (item.citations as unknown[]).length > 0
                  ? item.citations
                  : item.evidenceChain
              }
              contractId={item.contractId}
              emptyLabel="No evidence recorded"
              onEvidenceViewed={() => onEvidenceViewed?.(item.decisionId)}
            />
          </div>
          <p className="mt-2 text-xs text-gray-500" title={new Date(item.requestedAt).toLocaleString()}>
            {formatDistanceToNow(new Date(item.requestedAt), { addSuffix: true })}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 flex-wrap" role="group" aria-label="Field write actions">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700 text-white"
              aria-label={`Approve field change for ${item.field}`}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Apply change
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apply field change?</AlertDialogTitle>
              <AlertDialogDescription>
                This will write the proposed value to <strong>{item.field}</strong> on the contract.
                Critical fields (TCV, parties, dates) are never applied this way.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onApprove(item.id)}
                className="bg-green-600 hover:bg-green-700"
              >
                Yes, apply
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button
          size="sm"
          variant="destructive"
          disabled={isProcessing}
          onClick={() => setShowReject(true)}
          aria-label={`Reject field change for ${item.field}`}
        >
          <XCircle className="h-4 w-4 mr-1" />
          Reject
        </Button>
      </div>

      {showReject && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-1">Rejection reason</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm"
            rows={2}
            placeholder="Optional notes…"
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowReject(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                onReject(item.id, notes);
                setShowReject(false);
                setNotes('');
              }}
            >
              Confirm reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AgentApprovalQueue({
  onGoalApproved,
  onGoalRejected,
  className = '',
}: ApprovalQueueProps) {
  const [goals, setGoals] = useState<AgentGoal[]>([]);
  const [fieldWrites, setFieldWrites] = useState<AgentFieldWrite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'awaiting'>('awaiting');
  const [processing, setProcessing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  /** decisionIds whose evidence/citations panel was opened */
  const evidenceViewedRef = useRef<Set<string>>(new Set());

  const markEvidenceViewed = useCallback((decisionId: string) => {
    evidenceViewedRef.current.add(decisionId);
  }, []);

  const fetchGoals = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') {
        params.set('status', filter);
      }
      const [goalsRes, writesRes] = await Promise.all([
        fetch(`/api/agents/goals?${params}`),
        fetch('/api/agents/approvals?type=agent_write&limit=50'),
      ]);
      if (!goalsRes.ok) throw new Error('Failed to fetch goals');
      const goalsData = await goalsRes.json();
      setGoals(goalsData.goals ?? goalsData.data?.goals ?? []);

      if (writesRes.ok) {
        const writesData = await writesRes.json();
        // withAuthApiHandler may wrap as { data: { approvals } } or { approvals }
        const approvals =
          writesData.approvals ??
          writesData.data?.approvals ??
          [];
        const mapped: AgentFieldWrite[] = (approvals as Array<Record<string, unknown>>)
          .filter((a) => a.type === 'agent_write')
          .map((a) => {
            const ctx = (a.context ?? {}) as Record<string, unknown>;
            const hasPreviousValue = Boolean(ctx.hasPreviousValue);
            return {
              id: String(a.id),
              decisionId: String(ctx.decisionId ?? String(a.id).replace(/^agent-write-/, '')),
              agentId: String(a.agentId ?? 'agent'),
              contractId: (a.contractId as string | null | undefined) ?? null,
              field: String(ctx.field ?? 'field'),
              proposedValue: ctx.proposedValue,
              previousValue: ctx.previousValue,
              hasPreviousValue,
              confidence: typeof ctx.confidence === 'number' ? ctx.confidence : 0,
              requestedAt: String(a.requestedAt ?? new Date().toISOString()),
              citations: ctx.citations,
              evidenceChain: ctx.evidenceChain,
            };
          });
        setFieldWrites(mapped);
      } else {
        setFieldWrites([]);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // SSE with toast notifications and exhaustion warning
  const { isConnected: sseConnected, isReconnectExhausted, reconnect: sseReconnect } = useAgentSSE({
    onEvent: (eventType: AgentSSEEventType, data: Record<string, unknown>) => {
      fetchGoals();
      if (eventType === 'approval_required') {
        toast.info('New goal requires approval', { description: (data.title as string) || undefined });
      } else if (eventType === 'goal_approved') {
        toast.success('Goal approved', { description: (data.title as string) || undefined });
      } else if (eventType === 'goal_completed') {
        toast.success('Goal completed', { description: (data.title as string) || undefined });
      } else if (eventType === 'goal_failed') {
        toast.error('Goal failed', { description: (data.title as string) || undefined });
      } else if (eventType === 'approval_escalated') {
        toast.warning('Approval escalated', { description: (data.title as string) || undefined });
      }
    },
    onReconnectExhausted: () => {
      toast.error('Lost real-time connection. Data may be stale.');
    },
  });

  useEffect(() => {
    fetchGoals();
    const interval = setInterval(fetchGoals, sseConnected ? 60000 : 30000);
    return () => clearInterval(interval);
  }, [fetchGoals, sseConnected]);

  // Unique goal types for filter dropdown
  const goalTypes = useMemo(() => {
    const types = new Set(goals.map(g => g.type));
    return Array.from(types).sort();
  }, [goals]);

  // Filtered + searched goals
  const filteredGoals = useMemo(() => {
    let result = goals;
    if (typeFilter !== 'all') {
      result = result.filter(g => g.type === typeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(g =>
        g.title.toLowerCase().includes(q) ||
        (g.description || '').toLowerCase().includes(q) ||
        g.type.toLowerCase().includes(q)
      );
    }
    return result;
  }, [goals, typeFilter, searchQuery]);

  const handleApprove = async (goalId: string) => {
    setProcessing(goalId);
    try {
      const response = await fetch('/api/agents/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalId,
          action: 'approve',
          evidenceViewed: evidenceViewedRef.current.has(goalId),
        }),
      });
      if (!response.ok) throw new Error('Failed to approve goal');
      toast.success('Goal approved — execution will begin shortly');
      onGoalApproved?.(goalId);
      await fetchGoals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve');
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (goalId: string, feedback: string) => {
    setProcessing(goalId);
    try {
      const response = await fetch('/api/agents/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalId,
          action: 'reject',
          feedback,
          evidenceViewed: evidenceViewedRef.current.has(goalId),
        }),
      });
      if (!response.ok) throw new Error('Failed to reject goal');
      toast.success('Goal rejected');
      onGoalRejected?.(goalId);
      await fetchGoals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject');
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setProcessing(null);
    }
  };

  const handleFieldWriteApprove = async (actionId: string) => {
    setProcessing(actionId);
    const decisionId = actionId.replace(/^agent-write-/, '');
    const evidenceViewed = evidenceViewedRef.current.has(decisionId);
    try {
      const response = await fetch('/api/agents/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionId,
          action: 'approve',
          evidenceViewed,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.message || body?.message || 'Failed to apply field change');
      }
      toastWithUndo({
        message: 'Field change applied',
        description: 'You can undo this agent write',
        duration: 8000,
        onUndo: async () => {
          const res = await fetch(`/api/agents/decisions/${decisionId}/revert`, {
            method: 'POST',
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.error?.message || body?.message || 'Failed to undo');
          }
          await fetchGoals();
        },
      });
      await fetchGoals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply field change');
    } finally {
      setProcessing(null);
    }
  };

  const handleFieldWriteReject = async (actionId: string, notes: string) => {
    setProcessing(actionId);
    const decisionId = actionId.replace(/^agent-write-/, '');
    const evidenceViewed = evidenceViewedRef.current.has(decisionId);
    try {
      const response = await fetch('/api/agents/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionId,
          action: 'reject',
          notes,
          evidenceViewed,
        }),
      });
      if (!response.ok) throw new Error('Failed to reject field change');
      toast.success('Field change rejected');
      await fetchGoals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject field change');
    } finally {
      setProcessing(null);
    }
  };

  const handleModify = async (goalId: string, feedback: string, modifiedPlan?: Record<string, unknown>) => {
    setProcessing(goalId);
    try {
      const response = await fetch('/api/agents/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId, action: 'modify', feedback, ...(modifiedPlan && { modifiedPlan }) }),
      });
      if (!response.ok) throw new Error('Failed to request modifications');
      toast.success('Modification request sent');
      await fetchGoals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to modify');
      setError(err instanceof Error ? err.message : 'Failed to modify');
    } finally {
      setProcessing(null);
    }
  };

  const awaitingCount =
    goals.filter(g => g.status === 'AWAITING_APPROVAL').length + fieldWrites.length;

  const filteredFieldWrites = useMemo(() => {
    if (!searchQuery.trim()) return fieldWrites;
    const q = searchQuery.toLowerCase();
    return fieldWrites.filter(
      (w) =>
        w.field.toLowerCase().includes(q) ||
        w.agentId.toLowerCase().includes(q) ||
        (w.contractId || '').toLowerCase().includes(q),
    );
  }, [fieldWrites, searchQuery]);

  return (
    <div className={`space-y-4 ${className}`} role="main" aria-label="Agent Approval Queue">
      {/* SSE Exhaustion Banner */}
      {isReconnectExhausted && (
        <div
          className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5"
          role="alert"
        >
          <div className="flex items-center gap-2 text-sm text-rose-700">
            <WifiOff className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span>Real-time connection lost. Updates may be delayed.</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={sseReconnect}
            className="h-8 rounded-lg border-rose-200 text-rose-700 hover:bg-rose-100"
            aria-label="Reconnect to real-time updates"
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Reconnect
          </Button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200/90 bg-slate-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">Queue</p>
            {awaitingCount > 0 ? (
              <span
                className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
                aria-live="polite"
              >
                {awaitingCount} awaiting
                {fieldWrites.length > 0 ? ` · ${fieldWrites.length} field` : ''}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                Clear
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Review goals and field-change proposals before agents write
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search…"
              className="h-8 w-44 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100"
              aria-label="Search goals"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-sm"
            aria-label="Filter by goal type"
          >
            <option value="all">All types</option>
            {goalTypes.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'awaiting')}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-sm"
            aria-label="Filter by status"
          >
            <option value="awaiting">Awaiting</option>
            <option value="all">All goals</option>
          </select>

          <span
            className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${sseConnected ? 'bg-emerald-500' : 'bg-slate-300'}`}
            title={sseConnected ? 'Live updates connected' : 'Live updates disconnected'}
            aria-label={sseConnected ? 'Live updates connected' : 'Live updates disconnected'}
            role="status"
          />

          <Button
            variant="outline"
            size="sm"
            onClick={fetchGoals}
            disabled={loading}
            className="h-8 rounded-lg border-slate-200"
            aria-label="Refresh goals"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700"
          role="alert"
        >
          {error}
        </div>
      )}

      {loading && goals.length === 0 && (
        <div className="space-y-3" aria-busy="true" aria-label="Loading goals">
          <GoalCardSkeleton />
          <GoalCardSkeleton />
          <GoalCardSkeleton />
        </div>
      )}

      {!loading && filteredGoals.length === 0 && filteredFieldWrites.length === 0 && (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-14 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </div>
          <h3 className="text-sm font-medium text-slate-800">
            {searchQuery || typeFilter !== 'all' ? 'No matching items' : 'All caught up'}
          </h3>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
            {searchQuery || typeFilter !== 'all'
              ? 'Try adjusting your search or filters.'
              : 'No goals or field changes are awaiting approval right now.'}
          </p>
        </div>
      )}

      {/* Field change proposals (write gateway) */}
      {filteredFieldWrites.length > 0 && (
        <div className="space-y-3" aria-label="Pending field changes">
          <h3 className="text-sm font-semibold text-amber-900 uppercase tracking-wide">
            Field change proposals
          </h3>
          {filteredFieldWrites.map((item) => (
            <FieldWriteCard
              key={item.id}
              item={item}
              onApprove={handleFieldWriteApprove}
              onReject={handleFieldWriteReject}
              isProcessing={processing === item.id}
              onEvidenceViewed={markEvidenceViewed}
            />
          ))}
        </div>
      )}

      {/* Goals list */}
      <div className="space-y-4" aria-live="polite">
        {filteredGoals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            onApprove={handleApprove}
            onReject={handleReject}
            onModify={handleModify}
            isProcessing={processing === goal.id}
            onEvidenceViewed={markEvidenceViewed}
          />
        ))}
      </div>
    </div>
  );
}

export default AgentApprovalQueue;
