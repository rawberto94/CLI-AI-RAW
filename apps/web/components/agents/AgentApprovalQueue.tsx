'use client';

/**
 * Agent Approval Queue Component
 * Human-in-the-loop approval interface for AI agent goals
 */

import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';

// Types
interface AgentGoalStep {
  id: string;
  stepOrder: number;
  action: string;
  description?: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  result?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
}

interface AgentGoal {
  id: string;
  title: string;
  description?: string;
  status: 'PENDING' | 'PLANNING' | 'AWAITING_APPROVAL' | 'EXECUTING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  agentType: string;
  input?: Record<string, unknown>;
  plan?: Record<string, unknown>;
  progress: number;
  feedback?: string;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  steps: AgentGoalStep[];
}

interface ApprovalQueueProps {
  onGoalApproved?: (goalId: string) => void;
  onGoalRejected?: (goalId: string) => void;
  className?: string;
}

// Status badge component
function StatusBadge({ status }: { status: AgentGoal['status'] }) {
  const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    PENDING: { color: 'bg-gray-100 text-gray-800', icon: <Clock className="h-3 w-3" />, label: 'Pending' },
    PLANNING: { color: 'bg-blue-100 text-blue-800', icon: <Target className="h-3 w-3" />, label: 'Planning' },
    AWAITING_APPROVAL: { color: 'bg-yellow-100 text-yellow-800', icon: <AlertTriangle className="h-3 w-3" />, label: 'Awaiting Approval' },
    EXECUTING: { color: 'bg-indigo-100 text-indigo-800', icon: <Play className="h-3 w-3" />, label: 'Executing' },
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

// Step list component
function StepList({ steps, expanded }: { steps: AgentGoalStep[]; expanded: boolean }) {
  if (!expanded || steps.length === 0) return null;

  const stepStatusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
    PENDING: { color: 'text-gray-400', icon: <Clock className="h-4 w-4" /> },
    RUNNING: { color: 'text-blue-500', icon: <RotateCcw className="h-4 w-4 animate-spin" /> },
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
            <div
              key={step.id}
              className="flex items-start gap-3 p-2 rounded bg-gray-50"
            >
              <div className={`mt-0.5 ${config.color}`}>
                {config.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {index + 1}. {step.action}
                </p>
                {step.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Individual goal card
function GoalCard({
  goal,
  onApprove,
  onReject,
  onModify,
  isProcessing,
}: {
  goal: AgentGoal;
  onApprove: (id: string) => void;
  onReject: (id: string, feedback: string) => void;
  onModify: (id: string, feedback: string) => void;
  isProcessing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackAction, setFeedbackAction] = useState<'reject' | 'modify'>('reject');

  const handleSubmitFeedback = () => {
    if (feedbackAction === 'reject') {
      onReject(goal.id, feedback);
    } else {
      onModify(goal.id, feedback);
    }
    setShowFeedback(false);
    setFeedback('');
  };

  const isAwaitingApproval = goal.status === 'AWAITING_APPROVAL';

  return (
    <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {goal.title}
              </h3>
              <StatusBadge status={goal.status} />
            </div>
            {goal.description && (
              <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                {goal.description}
              </p>
            )}
            <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {goal.agentType}
              </span>
              <span>
                Created {new Date(goal.createdAt).toLocaleString()}
              </span>
              {goal.progress > 0 && (
                <span>Progress: {goal.progress}%</span>
              )}
            </div>
          </div>
          
          <button
            onClick={() => setExpanded(!expanded)}
            className="ml-4 p-1 text-gray-400 hover:text-gray-600"
          >
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>

        {/* Progress bar */}
        {goal.progress > 0 && (
          <div className="mt-3 w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-indigo-600 h-1.5 rounded-full transition-all"
              style={{ width: `${goal.progress}%` }}
            />
          </div>
        )}

        {/* Actions for awaiting approval */}
        {isAwaitingApproval && (
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => onApprove(goal.id)}
              disabled={isProcessing}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve
            </button>
            <button
              onClick={() => { setFeedbackAction('reject'); setShowFeedback(true); }}
              disabled={isProcessing}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <XCircle className="h-4 w-4" />
              Reject
            </button>
            <button
              onClick={() => { setFeedbackAction('modify'); setShowFeedback(true); }}
              disabled={isProcessing}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Edit3 className="h-4 w-4" />
              Request Changes
            </button>
          </div>
        )}

        {/* Feedback input */}
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
              className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-indigo-500"
              rows={3}
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                onClick={() => setShowFeedback(false)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitFeedback}
                disabled={!feedback.trim()}
                className="px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit
              </button>
            </div>
          </div>
        )}

        {/* Existing feedback */}
        {goal.feedback && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Feedback:</strong> {goal.feedback}
            </p>
          </div>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4">
          {/* Input data */}
          {goal.input && Object.keys(goal.input).length > 0 && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Input Data</h4>
              <pre className="text-xs text-gray-600 overflow-x-auto">
                {JSON.stringify(goal.input, null, 2)}
              </pre>
            </div>
          )}

          {/* Plan */}
          {goal.plan && Object.keys(goal.plan).length > 0 && (
            <div className="mt-2 p-3 bg-blue-50 rounded-lg">
              <h4 className="text-sm font-medium text-blue-800 mb-2">Execution Plan</h4>
              <pre className="text-xs text-blue-700 overflow-x-auto">
                {JSON.stringify(goal.plan, null, 2)}
              </pre>
            </div>
          )}

          {/* Steps */}
          <StepList steps={goal.steps} expanded={true} />
        </div>
      )}
    </div>
  );
}

// Main component
export function AgentApprovalQueue({
  onGoalApproved,
  onGoalRejected,
  className = '',
}: ApprovalQueueProps) {
  const [goals, setGoals] = useState<AgentGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'awaiting'>('awaiting');
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchGoals = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter !== 'all') {
        params.set('status', filter);
      }
      
      const response = await fetch(`/api/agents/goals?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch goals');
      }

      const data = await response.json();
      setGoals(data.goals);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchGoals();
    
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchGoals, 30000);
    return () => clearInterval(interval);
  }, [fetchGoals]);

  const handleApprove = async (goalId: string) => {
    setProcessing(goalId);
    try {
      const response = await fetch('/api/agents/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId, action: 'approve' }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve goal');
      }

      onGoalApproved?.(goalId);
      await fetchGoals();
    } catch (err) {
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
        body: JSON.stringify({ goalId, action: 'reject', feedback }),
      });

      if (!response.ok) {
        throw new Error('Failed to reject goal');
      }

      onGoalRejected?.(goalId);
      await fetchGoals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setProcessing(null);
    }
  };

  const handleModify = async (goalId: string, feedback: string) => {
    setProcessing(goalId);
    try {
      const response = await fetch('/api/agents/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId, action: 'modify', feedback }),
      });

      if (!response.ok) {
        throw new Error('Failed to request modifications');
      }

      await fetchGoals();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to modify');
    } finally {
      setProcessing(null);
    }
  };

  const awaitingCount = goals.filter(g => g.status === 'AWAITING_APPROVAL').length;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Agent Approval Queue
          </h2>
          {awaitingCount > 0 && (
            <p className="text-sm text-yellow-600 mt-1">
              {awaitingCount} goal{awaitingCount !== 1 ? 's' : ''} awaiting your approval
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'awaiting')}
            className="px-3 py-1.5 border rounded-md text-sm"
          >
            <option value="awaiting">Awaiting Approval</option>
            <option value="all">All Goals</option>
          </select>
          <button
            onClick={fetchGoals}
            disabled={loading}
            className="p-1.5 text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            <RotateCcw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && goals.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Loading goals...
        </div>
      )}

      {/* Empty state */}
      {!loading && goals.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">All caught up!</h3>
          <p className="text-gray-500 mt-1">
            No goals are awaiting approval right now.
          </p>
        </div>
      )}

      {/* Goals list */}
      <div className="space-y-4">
        {goals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            onApprove={handleApprove}
            onReject={handleReject}
            onModify={handleModify}
            isProcessing={processing === goal.id}
          />
        ))}
      </div>
    </div>
  );
}

export default AgentApprovalQueue;
