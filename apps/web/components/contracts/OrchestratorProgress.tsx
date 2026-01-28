'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  XCircle,
  Sparkles,
  Play,
  RefreshCw,
  Activity,
  Zap,
  Target,
  TrendingUp,
  Database,
  FileSearch,
  Brain,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { OrchestratorProgress, ArtifactSuggestion } from '@/hooks/useContractOrchestrator';

interface OrchestratorProgressProps {
  progress: OrchestratorProgress | null;
  suggestions: ArtifactSuggestion[];
  isConnected: boolean;
  onGenerateArtifact: (type: string) => Promise<void>;
  onTriggerOrchestrator: () => Promise<void>;
  className?: string;
}

const StepIcon = ({ status, stepName }: { status: string; stepName?: string }) => {
  const iconMap: Record<string, React.ComponentType<any>> = {
    metadataExtraction: FileSearch,
    categorization: Target,
    ragIndexing: Database,
    artifactGeneration: FileText,
    analysis: Brain,
  };
  
  const Icon = stepName && iconMap[stepName] ? iconMap[stepName] : Clock;
  
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'running':
      return <Icon className="h-4 w-4 text-violet-600 animate-pulse" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-600" />;
    case 'skipped':
      return <AlertCircle className="h-4 w-4 text-gray-400" />;
    default:
      return <Icon className="h-4 w-4 text-gray-400" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-green-500';
    case 'running':
      return 'bg-violet-500';
    case 'failed':
      return 'bg-red-500';
    default:
      return 'bg-gray-300';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'idle':
      return 'Ready';
    case 'planning':
      return 'Planning';
    case 'running':
      return 'Processing';
    case 'completed':
      return 'Complete';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
};

export function OrchestratorProgress({
  progress,
  suggestions,
  isConnected,
  onGenerateArtifact,
  onTriggerOrchestrator,
  className,
}: OrchestratorProgressProps) {
  const [generatingArtifact, setGeneratingArtifact] = React.useState<string | null>(null);
  const [triggering, setTriggering] = React.useState(false);

  if (!progress) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-8 w-8 mx-auto mb-4 text-gray-400 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading orchestrator status...</p>
        </CardContent>
      </Card>
    );
  }

  const overallProgress = progress.steps
    ? Object.values(progress.steps).reduce((sum, step) => sum + (step.progress || 0), 0) /
      Math.max(Object.keys(progress.steps).length, 1)
    : 0;

  const handleGenerateArtifact = async (type: string) => {
    setGeneratingArtifact(type);
    try {
      await onGenerateArtifact(type);
    } finally {
      setGeneratingArtifact(null);
    }
  };

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await onTriggerOrchestrator();
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <CardTitle>AI Orchestrator</CardTitle>
              <Badge variant={isConnected ? 'default' : 'secondary'}>
                {isConnected ? 'Live' : 'Polling'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {getStatusLabel(progress.status)}
              </Badge>
              {progress.agent && !progress.agent.done && (
                <Badge variant="secondary">
                  Iteration {progress.iteration}/{progress.maxIterations}
                </Badge>
              )}
            </div>
          </div>
          <CardDescription>
            Automated contract processing and artifact generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Overall Progress</span>
              <span className="text-muted-foreground">{Math.round(overallProgress)}%</span>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </div>

          {/* Step Status */}
          {progress.steps && Object.keys(progress.steps).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Processing Steps</h4>
              <div className="space-y-2">
                {Object.entries(progress.steps).map(([stepName, step]) => (
                  <div
                    key={stepName}
                    className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                  >
                    <StepIcon status={step.status} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate capitalize">
                          {stepName.replace(/[._]/g, ' ')}
                        </p>
                        <span className="text-xs text-muted-foreground ml-2">
                          {step.progress}%
                        </span>
                      </div>
                      {step.error && (
                        <p className="text-xs text-red-600 mt-1">{step.error}</p>
                      )}
                    </div>
                    <div
                      className={cn(
                        'h-1.5 rounded-full transition-all',
                        getStatusColor(step.status)
                      )}
                      style={{ width: `${step.progress}%`, minWidth: '4px' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Artifacts Status */}
          {progress.artifacts && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 dark:bg-purple-900/10">
              <div>
                <p className="text-sm font-medium">Artifacts Generated</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {progress.artifacts.completed} of {progress.artifacts.total} complete
                </p>
              </div>
              <div className="text-2xl font-bold text-purple-600">
                {progress.artifacts.completed}/{progress.artifacts.total}
              </div>
            </div>
          )}

          {/* Current Activity */}
          {progress.agent?.lastDecision && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-2">Current Activity</h4>
              <div className="space-y-2">
                {progress.agent.lastDecision.enqueued.map((job, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-xs p-2 rounded bg-violet-50 dark:bg-violet-900/10"
                  >
                    <Loader2 className="h-3 w-3 animate-spin text-violet-600" />
                    <span className="font-medium capitalize">
                      {job.name.replace(/_/g, ' ').toLowerCase()}
                    </span>
                    {job.jobId && (
                      <Badge variant="outline" className="text-xs">
                        {job.jobId.slice(-8)}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trigger Button */}
          {progress.agent?.done && progress.status !== 'running' && (
            <Button
              onClick={handleTrigger}
              disabled={triggering}
              variant="outline"
              size="sm"
              className="w-full"
            >
              {triggering ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Triggering...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Re-run Orchestrator
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Artifact Suggestions */}
      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Smart Suggestions</CardTitle>
            <CardDescription>
              Recommended artifacts for this contract type
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestions.map((suggestion, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-medium capitalize">
                      {suggestion.type.replace(/_/g, ' ')}
                    </h4>
                    <Badge
                      variant={suggestion.relevance === 'required' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {suggestion.relevance}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
                </div>
                {suggestion.canGenerate && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGenerateArtifact(suggestion.type)}
                    disabled={generatingArtifact === suggestion.type}
                  >
                    {generatingArtifact === suggestion.type ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <Play className="h-3 w-3 mr-1" />
                        Generate
                      </>
                    )}
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
