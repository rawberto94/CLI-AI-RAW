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
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useContractOrchestrator } from '@/hooks/useContractOrchestrator';

interface OrchestratorProgressProps {
  contractId: string;
  tenantId: string;
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
  contractId,
  tenantId,
  className,
}: OrchestratorProgressProps) {
  const {
    progress,
    suggestions,
    isConnected,
    error,
    generateArtifact,
    triggerOrchestrator,
  } = useContractOrchestrator({
    contractId,
    tenantId,
    enabled: true,
  });

  const [generatingArtifact, setGeneratingArtifact] = React.useState<string | null>(null);
  const [triggering, setTriggering] = React.useState(false);
  const [expanded, setExpanded] = React.useState(true);

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
      await generateArtifact(type);
    } finally {
      setTimeout(() => setGeneratingArtifact(null), 2000);
    }
  };

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await triggerOrchestrator();
    } finally {
      setTimeout(() => setTriggering(false), 2000);
    }
  };

  const isProcessing = progress.status === 'running';
  const artifactCompletionPercent = progress.artifacts.total > 0
    ? Math.round((progress.artifacts.completed / progress.artifacts.total) * 100)
    : 0;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Main Status Card */}
      <Card className="border-2 border-violet-100 dark:border-violet-900/50 shadow-lg overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-purple-600 p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold text-lg">AI Processing Status</h3>
                <p className="text-violet-100 text-sm mt-0.5">Real-time orchestrator activity</p>
              </div>
            </div>
            
            {/* Connection Badge */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            >
              <Badge
                variant="secondary"
                className={cn(
                  'text-xs flex items-center gap-1.5 px-3 py-1 shadow-lg',
                  isConnected 
                    ? 'bg-green-500 hover:bg-green-600 text-white border-green-400' 
                    : 'bg-gray-400 text-white border-gray-300'
                )}
              >
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    isConnected ? 'bg-white animate-pulse' : 'bg-gray-200'
                  )}
                />
                {isConnected ? 'Live Updates' : 'Polling Mode'}
              </Badge>
            </motion.div>
          </div>
        </div>

        <CardContent className="p-4 space-y-4">
          {/* Status Summary */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'h-12 w-12 rounded-full flex items-center justify-center shadow-lg',
                  isProcessing
                    ? 'bg-gradient-to-br from-violet-500 to-purple-600 animate-pulse'
                    : progress.status === 'completed'
                    ? 'bg-gradient-to-br from-violet-500 to-purple-600'
                    : 'bg-gradient-to-br from-gray-400 to-gray-500'
                )}
              >
                {isProcessing ? (
                  <Activity className="h-6 w-6 text-white" />
                ) : progress.status === 'completed' ? (
                  <CheckCircle2 className="h-6 w-6 text-white" />
                ) : (
                  <Clock className="h-6 w-6 text-white" />
                )}
              </div>
              <div>
                <h4 className="font-bold text-lg">{getStatusLabel(progress.status)}</h4>
                {isProcessing && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Iteration {progress.iteration} of {progress.maxIterations}
                  </p>
                )}
                {!isProcessing && progress.agent?.done && (
                  <p className="text-sm text-green-600 dark:text-green-400">All steps complete</p>
                )}
              </div>
            </div>
            {isProcessing && (
              <Badge variant="outline" className="font-mono text-base px-3 py-1.5">
                {progress.iteration}/{progress.maxIterations}
              </Badge>
            )}
          </div>

          {/* Overall Progress Bar */}
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">Overall Progress</span>
                <span className="font-bold text-violet-600 dark:text-violet-400">
                  {Math.round(overallProgress)}%
                </span>
              </div>
              <div className="relative h-3 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${overallProgress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 rounded-full relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Expandable Steps Section */}
          {progress.steps && Object.keys(progress.steps).length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-violet-600" />
                  Processing Steps ({Object.keys(progress.steps).length})
                </h4>
                {expanded ? (
                  <ChevronUp className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                )}
              </button>

              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-2 overflow-hidden"
                  >
                    {Object.entries(progress.steps).map(([stepName, step]) => (
                      <motion.div
                        key={stepName}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border-2 transition-all',
                          step.status === 'running'
                            ? 'bg-violet-50 dark:bg-violet-950/30 border-violet-300 dark:border-violet-800 shadow-md'
                            : step.status === 'completed'
                            ? 'bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-800'
                            : step.status === 'failed'
                            ? 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800'
                            : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800'
                        )}
                      >
                        <div className="flex-shrink-0">
                          <StepIcon status={step.status} stepName={stepName} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-semibold capitalize truncate">
                              {stepName.replace(/([A-Z])/g, ' $1').trim()}
                            </p>
                            {step.progress !== undefined && step.status === 'running' && (
                              <span className="text-xs font-mono text-violet-600 dark:text-violet-400">
                                {step.progress}%
                              </span>
                            )}
                          </div>
                          {step.progress !== undefined && step.status === 'running' && (
                            <Progress
                              value={step.progress}
                              className="h-1.5 bg-gray-200 dark:bg-gray-800"
                            />
                          )}
                          {step.error && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                              {step.error}
                            </p>
                          )}
                        </div>
                        {step.status === 'running' && (
                          <Loader2 className="h-4 w-4 text-violet-600 animate-spin flex-shrink-0" />
                        )}
                        {step.status === 'completed' && (
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                        )}
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Artifacts Progress Card */}
          {progress.artifacts && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-violet-50 via-pink-50 to-purple-50 dark:from-violet-950/30 dark:via-pink-950/30 dark:to-purple-950/30 border-2 border-violet-200 dark:border-violet-800 shadow-md">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-violet-600 rounded-lg">
                    <FileText className="h-4 w-4 text-white" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    Artifacts Generated
                  </h4>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-pink-600">
                    {progress.artifacts.completed}
                    <span className="text-xl text-gray-500 dark:text-gray-400">
                      /{progress.artifacts.total}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">
                    {artifactCompletionPercent}% complete
                  </p>
                </div>
              </div>
              
              <div className="relative h-3 bg-violet-200 dark:bg-violet-900 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${artifactCompletionPercent}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-violet-500 to-pink-600 rounded-full"
                />
              </div>
              
              {/* Status Indicators */}
              {progress.artifacts.required && progress.artifacts.required.length > 0 && (
                <div className="mt-3 flex items-center gap-4 text-xs font-medium">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-red-700 dark:text-red-400">
                      {progress.artifacts.missing?.length || 0} Required
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                    <span className="text-green-700 dark:text-green-400">
                      {progress.artifacts.completed} Complete
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                    <span className="text-violet-700 dark:text-violet-400">
                      {progress.artifacts.total - progress.artifacts.completed} Remaining
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Current Activity */}
          {progress.agent?.lastDecision?.enqueued && progress.agent.lastDecision.enqueued.length > 0 && (
            <div className="p-4 rounded-xl bg-violet-50 dark:bg-violet-950/30 border-2 border-violet-200 dark:border-violet-800">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-violet-900 dark:text-violet-100">
                <Activity className="h-4 w-4 animate-pulse" />
                Currently Processing
              </h4>
              <div className="space-y-2">
                {progress.agent.lastDecision.enqueued.slice(0, 3).map((job, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex items-center gap-2 text-xs p-2.5 rounded-lg bg-white dark:bg-gray-900 border border-violet-200 dark:border-violet-800"
                  >
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-600 flex-shrink-0" />
                    <span className="font-medium capitalize flex-1">
                      {job.name.replace(/_/g, ' ').toLowerCase()}
                    </span>
                    {job.jobId && (
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {job.jobId.slice(-6)}
                      </Badge>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Re-run Button */}
          {progress.agent?.done && progress.status !== 'running' && (
            <Button
              onClick={handleTrigger}
              disabled={triggering}
              variant="outline"
              size="sm"
              className="w-full border-2 border-violet-200 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30"
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

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Smart Suggestions Card */}
      {suggestions.length > 0 && (
        <Card className="border-2 border-violet-100 dark:border-violet-900/50 shadow-lg">
          <CardHeader className="pb-3 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-violet-600 rounded-lg">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Smart Suggestions</CardTitle>
                <CardDescription className="text-xs">
                  Recommended artifacts for this contract type
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <AnimatePresence>
              {suggestions.map((suggestion, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-start justify-between p-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md transition-all bg-white dark:bg-gray-900"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold capitalize">
                        {suggestion.type.replace(/_/g, ' ')}
                      </h4>
                      <Badge
                        variant={suggestion.relevance === 'required' ? 'destructive' : 'secondary'}
                        className={cn(
                          'text-xs font-bold',
                          suggestion.relevance === 'required' && 'animate-pulse'
                        )}
                      >
                        {suggestion.relevance}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {suggestion.reason}
                    </p>
                  </div>
                  {suggestion.canGenerate && (
                    <Button
                      size="sm"
                      onClick={() => handleGenerateArtifact(suggestion.type)}
                      disabled={generatingArtifact === suggestion.type}
                      className="flex-shrink-0 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
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
                </motion.div>
              ))}
            </AnimatePresence>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
