'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import {
  GitCompare,
  Loader2,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Eye,
  Shield,
  DollarSign,
  Scale,
  Search,
  FileText,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Copy,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

interface ClauseDiff {
  clauseType: string;
  contractA: string;
  contractB: string;
  similarity: number;
  riskDelta: 'higher_in_a' | 'higher_in_b' | 'equal';
  significance: 'critical' | 'major' | 'minor' | 'informational';
  analysis: string;
}

interface ComparisonReport {
  overallSimilarity: number;
  clauseDiffs: ClauseDiff[];
  riskDifferential: {
    contractA: number;
    contractB: number;
    summary: string;
  };
  financialComparison: {
    summary: string;
    keyDifferences: string[];
  };
  consolidationOpportunity: {
    possible: boolean;
    rationale: string;
    estimatedSavings: string | null;
  };
  recommendation: string;
}

interface SmartComparisonPanelProps {
  defaultContractA?: string;
  defaultContractB?: string;
  className?: string;
  onClose?: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

function getSimilarityColor(score: number) {
  if (score >= 80) return 'text-emerald-600 bg-emerald-50';
  if (score >= 50) return 'text-amber-600 bg-amber-50';
  return 'text-red-600 bg-red-50';
}

function getSignificanceColor(sig: string) {
  switch (sig) {
    case 'critical': return 'bg-red-100 text-red-700 border-red-200';
    case 'major': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'minor': return 'bg-blue-100 text-blue-700 border-blue-200';
    default: return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function SmartComparisonPanel({
  defaultContractA = '',
  defaultContractB = '',
  className,
  onClose,
}: SmartComparisonPanelProps) {
  const [contractAId, setContractAId] = useState(defaultContractA);
  const [contractBId, setContractBId] = useState(defaultContractB);
  const [expandedClause, setExpandedClause] = useState<number | null>(null);

  const compareMutation = useMutation<ComparisonReport>({
    mutationFn: async () => {
      const res = await fetch('/api/contracts/smart-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-data-mode': 'real' },
        body: JSON.stringify({ contractAId, contractBId }),
      });
      if (!res.ok) throw new Error('Comparison failed');
      return res.json();
    },
    onError: () => toast.error('Failed to compare contracts'),
  });

  const report = compareMutation.data;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Input Section */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md">
                <GitCompare className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <CardTitle className="text-sm">AI Smart Comparison</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">Semantic clause-level analysis</p>
              </div>
            </div>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 w-full">
              <label className="text-xs text-slate-500 mb-1 block">Contract A (ID)</label>
              <Input
                value={contractAId}
                onChange={e => setContractAId(e.target.value)}
                placeholder="Paste contract ID..."
                className="text-sm"
              />
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 shrink-0 hidden sm:block mt-5" />
            <div className="flex-1 w-full">
              <label className="text-xs text-slate-500 mb-1 block">Contract B (ID)</label>
              <Input
                value={contractBId}
                onChange={e => setContractBId(e.target.value)}
                placeholder="Paste contract ID..."
                className="text-sm"
              />
            </div>
            <Button
              onClick={() => compareMutation.mutate()}
              disabled={!contractAId || !contractBId || compareMutation.isPending}
              className="mt-5 bg-gradient-to-r from-cyan-600 to-blue-600 shrink-0"
            >
              {compareMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Comparing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Compare
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {report && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Overview Card */}
          <Card className="border-slate-200 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />
            <CardContent className="pt-4 space-y-4">
              {/* Similarity + Risk */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-100 p-3 text-center">
                  <p className="text-xs text-slate-500 mb-1">Overall Similarity</p>
                  <div className={cn("text-2xl font-bold", getSimilarityColor(report.overallSimilarity).split(' ')[0])}>
                    {report.overallSimilarity}%
                  </div>
                </div>
                <div className="rounded-lg border border-slate-100 p-3 text-center">
                  <p className="text-xs text-slate-500 mb-1">Risk — Contract A</p>
                  <div className="text-2xl font-bold text-slate-900">{report.riskDifferential.contractA}/100</div>
                </div>
                <div className="rounded-lg border border-slate-100 p-3 text-center">
                  <p className="text-xs text-slate-500 mb-1">Risk — Contract B</p>
                  <div className="text-2xl font-bold text-slate-900">{report.riskDifferential.contractB}/100</div>
                </div>
              </div>

              <p className="text-sm text-slate-700">{report.riskDifferential.summary}</p>
            </CardContent>
          </Card>

          {/* Clause Diffs */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="h-4 w-4 text-slate-500" />
                Clause-by-Clause Analysis
                <Badge variant="secondary" className="text-[10px]">{report.clauseDiffs.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {report.clauseDiffs.map((diff, i) => (
                <div key={i} className="border border-slate-100 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedClause(expandedClause === i ? null : i)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
                  >
                    <Badge className={cn("text-[10px] border shrink-0", getSignificanceColor(diff.significance))}>
                      {diff.significance}
                    </Badge>
                    <span className="text-xs font-medium text-slate-900 flex-1">{diff.clauseType}</span>
                    <div className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-medium",
                      getSimilarityColor(diff.similarity)
                    )}>
                      {diff.similarity}% match
                    </div>
                    {expandedClause === i ? (
                      <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                    )}
                  </button>
                  <AnimatePresence>
                    {expandedClause === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="px-3 pb-3 space-y-2 border-t border-slate-50 pt-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="rounded-lg bg-blue-50/50 p-2.5">
                              <p className="text-[10px] font-medium text-blue-600 mb-1">Contract A</p>
                              <p className="text-xs text-slate-700">{diff.contractA}</p>
                            </div>
                            <div className="rounded-lg bg-purple-50/50 p-2.5">
                              <p className="text-[10px] font-medium text-purple-600 mb-1">Contract B</p>
                              <p className="text-xs text-slate-700">{diff.contractB}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2 pt-1">
                            <Sparkles className="h-3 w-3 text-violet-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-slate-600">{diff.analysis}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Financial + Consolidation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Financial */}
            <Card className="border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                  Financial Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-700 mb-2">{report.financialComparison.summary}</p>
                {report.financialComparison.keyDifferences.map((d, i) => (
                  <div key={i} className="flex items-start gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                    <p className="text-xs text-slate-600">{d}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Consolidation */}
            <Card className={cn("border-slate-200", report.consolidationOpportunity.possible && "border-emerald-200")}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Scale className="h-4 w-4 text-blue-500" />
                  Consolidation
                  {report.consolidationOpportunity.possible && (
                    <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-0">Opportunity</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-700 mb-2">{report.consolidationOpportunity.rationale}</p>
                {report.consolidationOpportunity.estimatedSavings && (
                  <p className="text-xs font-medium text-emerald-700">
                    Est. savings: {report.consolidationOpportunity.estimatedSavings}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recommendation */}
          <Card className="border-violet-200 bg-violet-50/30">
            <CardContent className="py-3">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-violet-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-violet-800 mb-0.5">AI Recommendation</p>
                  <p className="text-xs text-violet-700">{report.recommendation}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
