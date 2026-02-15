'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import {
  Brain,
  Activity,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Gauge,
  Target,
  Eye,
  Zap,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

interface EvalResult {
  queryRelevance: number;
  answerFaithfulness: number;
  contextUtilization: number;
  hallucinations: string[];
  overallScore: number;
}

interface BatchEvalSummary {
  results: Array<{
    query: string;
    score: EvalResult;
    chunkDiversity: number;
  }>;
  aggregated: {
    avgRelevance: number;
    avgFaithfulness: number;
    avgUtilization: number;
    avgDiversity: number;
    hallucinationRate: number;
    overallGrade: string;
  };
  timestamp: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getGradeColor(grade: string) {
  switch (grade) {
    case 'A': return 'bg-emerald-500 text-white';
    case 'B': return 'bg-blue-500 text-white';
    case 'C': return 'bg-amber-500 text-white';
    case 'D': return 'bg-orange-500 text-white';
    case 'F': return 'bg-red-500 text-white';
    default: return 'bg-slate-500 text-white';
  }
}

function getScoreColor(score: number) {
  if (score >= 0.8) return 'text-emerald-600';
  if (score >= 0.6) return 'text-blue-600';
  if (score >= 0.4) return 'text-amber-600';
  return 'text-red-600';
}

function getProgressColor(score: number) {
  if (score >= 80) return '[&>div]:bg-emerald-500';
  if (score >= 60) return '[&>div]:bg-blue-500';
  if (score >= 40) return '[&>div]:bg-amber-500';
  return '[&>div]:bg-red-500';
}

// ============================================================================
// Main Component
// ============================================================================

export function RAGEvaluationPanel({ className }: { className?: string }) {
  const [lastResult, setLastResult] = useState<BatchEvalSummary | null>(null);

  const evalMutation = useMutation<BatchEvalSummary>({
    mutationFn: async () => {
      const res = await fetch('/api/ai/rag-eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-data-mode': 'real' },
        body: JSON.stringify({ sampleSize: 10 }),
      });
      if (!res.ok) throw new Error('Evaluation failed');
      const json = await res.json();
      return json.data?.evaluation;
    },
    onSuccess: (data) => {
      setLastResult(data);
      toast.success(`RAG evaluation complete — Grade: ${data.aggregated.overallGrade}`);
    },
    onError: () => toast.error('RAG evaluation failed'),
  });

  const agg = lastResult?.aggregated;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-md">
                <Gauge className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base">RAG Quality Evaluation</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automated retrieval-augmented generation quality assessment
                </p>
              </div>
            </div>
            <Button
              onClick={() => evalMutation.mutate()}
              disabled={evalMutation.isPending}
              className="bg-gradient-to-r from-teal-600 to-cyan-600"
            >
              {evalMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Evaluating...
                </>
              ) : lastResult ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Re-Evaluate
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Run Evaluation
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        {!lastResult && !evalMutation.isPending && (
          <CardContent className="pt-0 pb-4">
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-4 text-center">
              <Brain className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">
                Run an evaluation to measure RAG quality across relevance, faithfulness,
                context utilization, and hallucination detection.
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Aggregated Results */}
      {agg && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Overall Grade */}
          <Card className="border-slate-200 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-teal-500 to-cyan-500" />
            <CardContent className="pt-4">
              <div className="flex items-center gap-6 mb-4">
                <div className="text-center">
                  <div className={cn(
                    "text-4xl font-black w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg",
                    getGradeColor(agg.overallGrade)
                  )}>
                    {agg.overallGrade}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Overall Grade</p>
                </div>
                <div className="flex-1 space-y-3">
                  {/* Metric bars */}
                  {[
                    { label: 'Query Relevance', value: agg.avgRelevance, icon: Target, desc: 'How well retrieved chunks match the query' },
                    { label: 'Answer Faithfulness', value: agg.avgFaithfulness, icon: CheckCircle2, desc: 'How grounded the answer is in retrieved context' },
                    { label: 'Context Utilization', value: agg.avgUtilization, icon: Eye, desc: 'How much of the retrieved context is actually used' },
                    { label: 'Chunk Diversity', value: agg.avgDiversity, icon: Activity, desc: 'Variety of information across retrieved chunks' },
                  ].map((metric) => (
                    <div key={metric.label} className="flex items-center gap-3">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1.5 w-36 shrink-0">
                              <metric.icon className={cn("h-3 w-3", getScoreColor(metric.value))} />
                              <span className="text-xs text-slate-600">{metric.label}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p className="text-xs">{metric.desc}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Progress value={metric.value * 100} className={cn("h-2.5 flex-1", getProgressColor(metric.value * 100))} />
                      <span className={cn("text-xs font-medium w-10 text-right", getScoreColor(metric.value))}>
                        {(metric.value * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hallucination rate */}
              <div className={cn(
                "rounded-lg p-3 flex items-center gap-3",
                agg.hallucinationRate > 0.2 ? 'bg-red-50 border border-red-100' :
                agg.hallucinationRate > 0.05 ? 'bg-amber-50 border border-amber-100' :
                'bg-emerald-50 border border-emerald-100'
              )}>
                <AlertTriangle className={cn(
                  "h-4 w-4",
                  agg.hallucinationRate > 0.2 ? 'text-red-500' :
                  agg.hallucinationRate > 0.05 ? 'text-amber-500' :
                  'text-emerald-500'
                )} />
                <div>
                  <p className="text-xs font-medium text-slate-900">
                    Hallucination Rate: {(agg.hallucinationRate * 100).toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {agg.hallucinationRate > 0.2 ? 'High — review retrieval pipeline' :
                     agg.hallucinationRate > 0.05 ? 'Moderate — some answers contain ungrounded claims' :
                     'Low — answers are well-grounded in retrieved context'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Individual Results */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-slate-500" />
                Individual Query Results
                <Badge variant="secondary" className="text-[10px]">{lastResult.results.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left font-medium text-slate-500 py-2 pr-3">Query</th>
                      <th className="text-center font-medium text-slate-500 py-2 px-2 w-16">Relevance</th>
                      <th className="text-center font-medium text-slate-500 py-2 px-2 w-16">Faithful</th>
                      <th className="text-center font-medium text-slate-500 py-2 px-2 w-16">Util.</th>
                      <th className="text-center font-medium text-slate-500 py-2 px-2 w-16">Diversity</th>
                      <th className="text-center font-medium text-slate-500 py-2 pl-2 w-16">Overall</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastResult.results.map((r, i) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="py-2 pr-3 text-slate-700 max-w-[200px] truncate">{r.query}</td>
                        <td className={cn("py-2 px-2 text-center font-medium", getScoreColor(r.score.queryRelevance))}>
                          {(r.score.queryRelevance * 100).toFixed(0)}
                        </td>
                        <td className={cn("py-2 px-2 text-center font-medium", getScoreColor(r.score.answerFaithfulness))}>
                          {(r.score.answerFaithfulness * 100).toFixed(0)}
                        </td>
                        <td className={cn("py-2 px-2 text-center font-medium", getScoreColor(r.score.contextUtilization))}>
                          {(r.score.contextUtilization * 100).toFixed(0)}
                        </td>
                        <td className={cn("py-2 px-2 text-center font-medium", getScoreColor(r.chunkDiversity))}>
                          {(r.chunkDiversity * 100).toFixed(0)}
                        </td>
                        <td className={cn("py-2 pl-2 text-center font-bold", getScoreColor(r.score.overallScore))}>
                          {(r.score.overallScore * 100).toFixed(0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Timestamp */}
          <p className="text-[10px] text-slate-400 text-right">
            Last evaluated: {new Date(lastResult.timestamp).toLocaleString()}
          </p>
        </motion.div>
      )}
    </div>
  );
}
