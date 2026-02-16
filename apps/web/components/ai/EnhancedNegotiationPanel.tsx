'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Brain,
  Shield,
  Loader2,
  Sparkles,
  Send,
  Copy,
  ChevronDown,
  ChevronRight,
  FileText,
  Target,
  AlertTriangle,
  CheckCircle2,
  Scale,
  MessageSquare,
  BookOpen,
  Lightbulb,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

interface ClausePosition {
  clause: string;
  currentPosition: string;
  marketStandard: string;
  recommendation: 'must_have' | 'negotiate' | 'concede_if_needed' | 'deal_breaker';
  priority: number;
  fallbackLanguage: string;
  rationale: string;
}

interface NegotiationPlaybookData {
  overallStrategy: string;
  mustHaves: string[];
  dealBreakers: string[];
  concessionOrder: string[];
  openingMessage: string;
  clausePositions: ClausePosition[];
}

interface RedlineSuggestion {
  originalText: string;
  proposedText: string;
  rationale: string;
  riskReduction: string;
  confidence: number;
}

interface EnhancedNegotiationPanelProps {
  contractId: string;
  contractName?: string;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getRecommendationColor(rec: string) {
  switch (rec) {
    case 'must_have': return 'bg-red-100 text-red-700 border-red-200';
    case 'deal_breaker': return 'bg-red-200 text-red-800 border-red-300';
    case 'negotiate': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'concede_if_needed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    default: return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function getRecommendationLabel(rec: string) {
  switch (rec) {
    case 'must_have': return 'Must Have';
    case 'deal_breaker': return 'Deal Breaker';
    case 'negotiate': return 'Negotiate';
    case 'concede_if_needed': return 'Can Concede';
    default: return rec;
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function EnhancedNegotiationPanel({
  contractId,
  contractName,
  className,
}: EnhancedNegotiationPanelProps) {
  const [expandedClause, setExpandedClause] = useState<number | null>(null);
  const [redlineClause, setRedlineClause] = useState('');
  const [showRedline, setShowRedline] = useState(false);

  // Generate playbook
  const playbookMutation = useMutation<NegotiationPlaybookData>({
    mutationFn: async () => {
      const res = await fetch('/api/contracts/negotiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-data-mode': 'real' },
        body: JSON.stringify({ contractId }),
      });
      if (!res.ok) throw new Error('Failed to generate playbook');
      const json = await res.json();
      return json.data?.playbook;
    },
    onError: () => toast.error('Failed to generate negotiation playbook'),
  });

  // Generate redline
  const redlineMutation = useMutation<RedlineSuggestion>({
    mutationFn: async () => {
      const res = await fetch('/api/contracts/negotiate/redline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-data-mode': 'real' },
        body: JSON.stringify({ contractId, clauseText: redlineClause }),
      });
      if (!res.ok) throw new Error('Failed to generate redline');
      const json = await res.json();
      return json.data?.redline;
    },
    onError: () => toast.error('Failed to generate redline suggestion'),
  });

  const playbook = playbookMutation.data;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header + Generate */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
                <Scale className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <CardTitle className="text-sm">Negotiation Copilot</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">AI-powered strategy for {contractName || 'this contract'}</p>
              </div>
            </div>
            <Button
              onClick={() => playbookMutation.mutate()}
              disabled={playbookMutation.isPending}
              size="sm"
              className="bg-gradient-to-r from-amber-500 to-orange-600"
            >
              {playbookMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Generating...
                </>
              ) : playbook ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Regenerate
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Generate Playbook
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Playbook Results  */}
      {playbook && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Strategy Overview */}
          <Card className="border-slate-200 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
            <CardContent className="pt-4 space-y-4">
              <div>
                <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Overall Strategy</h4>
                <p className="text-sm text-slate-700 leading-relaxed">{playbook.overallStrategy}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Must Haves */}
                <div className="rounded-lg border border-red-100 bg-red-50/50 p-3">
                  <h5 className="text-xs font-medium text-red-700 mb-2 flex items-center gap-1.5">
                    <Target className="h-3 w-3" />
                    Must Haves
                  </h5>
                  {playbook.mustHaves.map((item, i) => (
                    <div key={i} className="flex items-start gap-1.5 mb-1">
                      <div className="w-1 h-1 rounded-full bg-red-400 mt-1.5 shrink-0" />
                      <p className="text-xs text-red-800">{item}</p>
                    </div>
                  ))}
                </div>

                {/* Deal Breakers */}
                <div className="rounded-lg border border-orange-100 bg-orange-50/50 p-3">
                  <h5 className="text-xs font-medium text-orange-700 mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3" />
                    Deal Breakers
                  </h5>
                  {playbook.dealBreakers.map((item, i) => (
                    <div key={i} className="flex items-start gap-1.5 mb-1">
                      <div className="w-1 h-1 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                      <p className="text-xs text-orange-800">{item}</p>
                    </div>
                  ))}
                </div>

                {/* Concession Order */}
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                  <h5 className="text-xs font-medium text-emerald-700 mb-2 flex items-center gap-1.5">
                    <Lightbulb className="h-3 w-3" />
                    Concession Order
                  </h5>
                  {playbook.concessionOrder.map((item, i) => (
                    <div key={i} className="flex items-start gap-1.5 mb-1">
                      <span className="text-[10px] text-emerald-500 font-bold mt-0.5 shrink-0">{i + 1}.</span>
                      <p className="text-xs text-emerald-800">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Opening Message */}
              {playbook.openingMessage && (
                <div className="rounded-lg bg-violet-50 border border-violet-100 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <h5 className="text-xs font-medium text-violet-700 flex items-center gap-1.5">
                      <MessageSquare className="h-3 w-3" />
                      Suggested Opening Message
                    </h5>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] text-violet-600"
                      onClick={() => {
                        navigator.clipboard.writeText(playbook.openingMessage);
                        toast.success('Opening message copied');
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <p className="text-xs text-violet-800 leading-relaxed italic">&ldquo;{playbook.openingMessage}&rdquo;</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Clause Positions */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-slate-500" />
                Clause-by-Clause Strategy
                <Badge variant="secondary" className="text-[10px]">{playbook.clausePositions.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {playbook.clausePositions
                .sort((a, b) => b.priority - a.priority)
                .map((clause, i) => (
                  <div key={i} className="border border-slate-100 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedClause(expandedClause === i ? null : i)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
                    >
                      <Badge className={cn("text-[10px] border shrink-0", getRecommendationColor(clause.recommendation))}>
                        {getRecommendationLabel(clause.recommendation)}
                      </Badge>
                      <span className="text-xs font-medium text-slate-900 flex-1 truncate">{clause.clause}</span>
                      <Badge variant="secondary" className="text-[10px]">P{clause.priority}</Badge>
                      {expandedClause === i ? (
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                      )}
                    </button>
                    {expandedClause === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="px-3 pb-3 space-y-2 border-t border-slate-50 pt-2"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="rounded bg-slate-50 p-2">
                            <p className="text-[10px] font-medium text-slate-500 mb-0.5">Current Position</p>
                            <p className="text-xs text-slate-700">{clause.currentPosition}</p>
                          </div>
                          <div className="rounded bg-emerald-50 p-2">
                            <p className="text-[10px] font-medium text-emerald-600 mb-0.5">Market Standard</p>
                            <p className="text-xs text-slate-700">{clause.marketStandard}</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600">{clause.rationale}</p>
                        {clause.fallbackLanguage && (
                          <div className="rounded bg-amber-50 p-2">
                            <p className="text-[10px] font-medium text-amber-600 mb-0.5">Fallback Language</p>
                            <p className="text-xs text-amber-800 italic">&ldquo;{clause.fallbackLanguage}&rdquo;</p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Redline Generator */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <button
            onClick={() => setShowRedline(!showRedline)}
            className="flex items-center gap-2 text-left"
          >
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-red-500" />
              Redline Suggestion
            </CardTitle>
            {showRedline ? (
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            )}
          </button>
        </CardHeader>
        {showRedline && (
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Paste the clause you want to redline</label>
              <Textarea
                value={redlineClause}
                onChange={e => setRedlineClause(e.target.value)}
                placeholder="Paste a contract clause here to get AI-suggested redline edits..."
                rows={3}
                className="text-sm"
              />
            </div>
            <Button
              onClick={() => redlineMutation.mutate()}
              disabled={!redlineClause.trim() || redlineMutation.isPending}
              size="sm"
              className="bg-gradient-to-r from-red-500 to-rose-600"
            >
              {redlineMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5 mr-1.5" />
                  Generate Redline
                </>
              )}
            </Button>

            {/* Redline Result */}
            {redlineMutation.data && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="rounded-lg bg-red-50/50 border border-red-100 p-2.5">
                    <p className="text-[10px] font-medium text-red-600 mb-1">Original</p>
                    <p className="text-xs text-slate-700 line-through">{redlineMutation.data.originalText}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50/50 border border-emerald-100 p-2.5">
                    <p className="text-[10px] font-medium text-emerald-600 mb-1">Suggested</p>
                    <p className="text-xs text-slate-900 font-medium">{redlineMutation.data.proposedText}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Sparkles className="h-3 w-3 text-violet-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-slate-600">{redlineMutation.data.rationale}</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-600 font-medium">{redlineMutation.data.riskReduction}</span>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-500">Confidence: {(redlineMutation.data.confidence * 100).toFixed(0)}%</span>
                </div>
              </motion.div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
