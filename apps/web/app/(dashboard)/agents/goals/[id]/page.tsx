/**
 * Agent Goal Detail Page
 * 
 * Shows full details of a single agent goal including plan, steps, result, and timeline.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Target,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Brain,
  Zap,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface GoalStep {
  id: string;
  name: string;
  type: string;
  order: number;
  status: string;
  progress: number;
  input: unknown;
  output: unknown;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  duration: number | null;
}

interface GoalDetail {
  id: string;
  tenantId: string;
  userId: string | null;
  type: string;
  title: string;
  description: string | null;
  priority: number;
  status: string;
  progress: number;
  plan: unknown;
  currentStep: number;
  totalSteps: number;
  context: unknown;
  result: unknown;
  error: string | null;
  requiresApproval: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  scheduledFor: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  steps: GoalStep[];
}

const statusConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  PENDING: { color: 'bg-gray-100 text-gray-800', icon: Clock, label: 'Pending' },
  PLANNING: { color: 'bg-violet-100 text-violet-800', icon: Brain, label: 'Planning' },
  AWAITING_APPROVAL: { color: 'bg-amber-100 text-amber-800', icon: Shield, label: 'Awaiting Approval' },
  EXECUTING: { color: 'bg-blue-100 text-blue-800', icon: Zap, label: 'Executing' },
  COMPLETED: { color: 'bg-green-100 text-green-800', icon: CheckCircle2, label: 'Completed' },
  FAILED: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Failed' },
  CANCELLED: { color: 'bg-gray-100 text-gray-800', icon: XCircle, label: 'Cancelled' },
};

const stepStatusColors: Record<string, string> = {
  PENDING: 'bg-gray-200',
  IN_PROGRESS: 'bg-blue-500',
  COMPLETED: 'bg-green-500',
  FAILED: 'bg-red-500',
  SKIPPED: 'bg-gray-300',
};

export default function GoalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const goalId = params.id as string;
  const [goal, setGoal] = useState<GoalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchGoal = async () => {
      try {
        const res = await fetch(`/api/agents/goals/${goalId}`);
        const json = await res.json();
        if (json.success) {
          setGoal(json.data);
        } else {
          toast.error(json.error || 'Goal not found');
        }
      } catch {
        toast.error('Failed to load goal');
      } finally {
        setLoading(false);
      }
    };
    if (goalId) fetchGoal();
  }, [goalId]);

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-yellow-500" />
        <p className="text-lg font-medium">Goal not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Go Back
        </Button>
      </div>
    );
  }

  const statusCfg = statusConfig[goal.status] ?? statusConfig.PENDING;
  const StatusIcon = statusCfg.icon;
  const result = goal.result as Record<string, unknown> | null;
  const tokenUsage = (result as any)?._tokenUsage;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{goal.title}</h1>
            <Badge className={cn(statusCfg.color)}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusCfg.label}
            </Badge>
          </div>
          {goal.description && (
            <p className="text-muted-foreground mt-1">{goal.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span>Type: <strong className="capitalize">{goal.type.replace('_', ' ')}</strong></span>
            <span>Priority: <strong>{goal.priority}</strong></span>
            <span>Created: <strong>{new Date(goal.createdAt).toLocaleString()}</strong></span>
          </div>
        </div>
      </div>

      {/* Progress */}
      {goal.status === 'EXECUTING' && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-muted-foreground">
                Step {goal.currentStep} / {goal.totalSteps} ({goal.progress}%)
              </span>
            </div>
            <Progress value={goal.progress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Timeline / Timing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium">{new Date(goal.createdAt).toLocaleString()}</p>
            </div>
            {goal.startedAt && (
              <div>
                <p className="text-muted-foreground">Started</p>
                <p className="font-medium">{new Date(goal.startedAt).toLocaleString()}</p>
              </div>
            )}
            {goal.completedAt && (
              <div>
                <p className="text-muted-foreground">Completed</p>
                <p className="font-medium">{new Date(goal.completedAt).toLocaleString()}</p>
              </div>
            )}
            {goal.approvedBy && (
              <div>
                <p className="text-muted-foreground">Approved By</p>
                <p className="font-medium">{goal.approvedBy}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Token Usage */}
      {tokenUsage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Token Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Prompt Tokens</p>
                <p className="font-medium">{tokenUsage.promptTokens?.toLocaleString() ?? 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Completion Tokens</p>
                <p className="font-medium">{tokenUsage.completionTokens?.toLocaleString() ?? 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Estimated Cost</p>
                <p className="font-medium">${tokenUsage.estimatedCost?.toFixed(4) ?? 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Execution Steps ({goal.steps.length})</CardTitle>
          <CardDescription>Detailed breakdown of each execution step</CardDescription>
        </CardHeader>
        <CardContent>
          {goal.steps.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No steps recorded yet</p>
          ) : (
            <div className="space-y-2">
              {goal.steps.map((step) => (
                <Collapsible
                  key={step.id}
                  open={expandedSteps.has(step.id)}
                  onOpenChange={() => toggleStep(step.id)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors border">
                      <div className={cn('w-3 h-3 rounded-full flex-shrink-0', stepStatusColors[step.status] ?? 'bg-gray-200')} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            #{step.order + 1} {step.name}
                          </span>
                          <Badge variant="outline" className="text-xs capitalize">{step.type}</Badge>
                          <Badge variant="outline" className="text-xs capitalize">{step.status.toLowerCase().replace('_', ' ')}</Badge>
                        </div>
                      </div>
                      {step.duration && (
                        <span className="text-xs text-muted-foreground">{step.duration}ms</span>
                      )}
                      {expandedSteps.has(step.id) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-9 mt-1 p-3 rounded-lg bg-muted/30 text-sm space-y-2">
                      {step.input && (
                        <div>
                          <p className="text-muted-foreground text-xs">Input:</p>
                          <pre className="text-xs overflow-auto max-h-32 bg-muted p-2 rounded">
                            {JSON.stringify(step.input, null, 2)}
                          </pre>
                        </div>
                      )}
                      {step.output && (
                        <div>
                          <p className="text-muted-foreground text-xs">Output:</p>
                          <pre className="text-xs overflow-auto max-h-32 bg-muted p-2 rounded">
                            {JSON.stringify(step.output, null, 2)}
                          </pre>
                        </div>
                      )}
                      {step.error && (
                        <div>
                          <p className="text-red-600 text-xs">Error:</p>
                          <pre className="text-xs text-red-600 overflow-auto">{step.error}</pre>
                        </div>
                      )}
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        {step.startedAt && <span>Started: {new Date(step.startedAt).toLocaleTimeString()}</span>}
                        {step.completedAt && <span>Completed: {new Date(step.completedAt).toLocaleTimeString()}</span>}
                        <span>Progress: {step.progress}%</span>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Result</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm overflow-auto max-h-64 bg-muted p-3 rounded-lg">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {goal.error && (
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="text-base text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm text-red-600 overflow-auto">{goal.error}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
