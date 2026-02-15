'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Brain,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Loader2,
  RefreshCw,
  FileText,
  Scale,
  Target,
  Zap,
  Clock,
  Eye,
  Copy,
  ExternalLink,
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

interface RiskFactor {
  clause: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  mitigation: string;
}

interface Obligation {
  party: string;
  obligation: string;
  deadline: string | null;
  priority: 'low' | 'medium' | 'high';
}

interface UnusualClause {
  clause: string;
  whyUnusual: string;
  marketComparison: string;
  recommendation: string;
}

interface LeveragePoint {
  point: string;
  explanation: string;
  suggestedAction: string;
}

interface KeyDate {
  date: string;
  event: string;
  importance: 'low' | 'medium' | 'high';
}

interface ActionItem {
  action: string;
  urgency: 'immediate' | 'soon' | 'when_convenient';
  assignee: string;
}

interface IntelligenceBrief {
  executiveSummary: string;
  riskScore: number;
  riskFactors: RiskFactor[];
  obligations: Obligation[];
  unusualClauses: UnusualClause[];
  leveragePoints: LeveragePoint[];
  keyDates: KeyDate[];
  actionItems: ActionItem[];
}

interface ContractIntelligenceBriefProps {
  contractId: string;
  contractName?: string;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getRiskColor(score: number) {
  if (score >= 80) return { bg: 'bg-red-500', text: 'text-red-700', light: 'bg-red-50', border: 'border-red-200', label: 'Critical' };
  if (score >= 60) return { bg: 'bg-orange-500', text: 'text-orange-700', light: 'bg-orange-50', border: 'border-orange-200', label: 'High' };
  if (score >= 40) return { bg: 'bg-amber-500', text: 'text-amber-700', light: 'bg-amber-50', border: 'border-amber-200', label: 'Medium' };
  if (score >= 20) return { bg: 'bg-blue-500', text: 'text-blue-700', light: 'bg-blue-50', border: 'border-blue-200', label: 'Low' };
  return { bg: 'bg-emerald-500', text: 'text-emerald-700', light: 'bg-emerald-50', border: 'border-emerald-200', label: 'Minimal' };
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'critical': return 'bg-red-100 text-red-700 border-red-200';
    case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'low': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

function getUrgencyColor(urgency: string) {
  switch (urgency) {
    case 'immediate': return 'bg-red-100 text-red-700';
    case 'soon': return 'bg-amber-100 text-amber-700';
    case 'when_convenient': return 'bg-blue-100 text-blue-700';
    default: return 'bg-slate-100 text-slate-700';
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

function RiskGauge({ score }: { score: number }) {
  const risk = getRiskColor(score);
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100" />
          <circle
            cx="40" cy="40" r="34" fill="none" strokeWidth="8"
            className={risk.text}
            stroke="currentColor"
            strokeDasharray={`${(score / 100) * 213.6} 213.6`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("text-lg font-bold", risk.text)}>{score}</span>
        </div>
      </div>
      <div>
        <Badge className={cn("font-medium border", risk.light, risk.text, risk.border)}>{risk.label} Risk</Badge>
        <p className="text-xs text-slate-500 mt-1">{score}/100 risk score</p>
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  icon: Icon,
  count,
  defaultOpen = false,
  children,
  accentColor = 'violet',
}: {
  title: string;
  icon: React.ElementType;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
  accentColor?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
      >
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", `bg-${accentColor}-100`)}>
          <Icon className={cn("h-4 w-4", `text-${accentColor}-600`)} />
        </div>
        <span className="font-medium text-sm text-slate-900 flex-1">{title}</span>
        {count !== undefined && (
          <Badge variant="secondary" className="text-xs">{count}</Badge>
        )}
        {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-4 space-y-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ContractIntelligenceBrief({
  contractId,
  contractName,
  className,
}: ContractIntelligenceBriefProps) {
  const queryClient = useQueryClient();

  // Fetch existing brief
  const { data: brief, isLoading, error, refetch } = useQuery<IntelligenceBrief | null>({
    queryKey: ['intelligence-brief', contractId],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/intelligence-brief?contractId=${contractId}`, {
        headers: { 'x-data-mode': 'real' },
      });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error('Failed to fetch intelligence brief');
      }
      const json = await res.json();
      return json.brief || null;
    },
    staleTime: 60_000,
  });

  // Generate brief mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/contracts/intelligence-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-data-mode': 'real' },
        body: JSON.stringify({ contractId }),
      });
      if (!res.ok) throw new Error('Failed to generate intelligence brief');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intelligence-brief', contractId] });
      toast.success('Intelligence Brief generated');
    },
    onError: () => {
      toast.error('Failed to generate Intelligence Brief');
    },
  });

  const handleCopyExecutiveSummary = useCallback(() => {
    if (brief?.executiveSummary) {
      navigator.clipboard.writeText(brief.executiveSummary);
      toast.success('Executive summary copied');
    }
  }, [brief]);

  // Loading state
  if (isLoading) {
    return (
      <Card className={cn("border-slate-200", className)}>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="h-5 w-5 text-violet-500 animate-spin" />
            <span className="text-sm text-slate-500">Loading intelligence brief...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state — offer to generate
  if (!brief) {
    return (
      <Card className={cn("border-slate-200 border-dashed", className)}>
        <CardContent className="py-10">
          <div className="text-center max-w-md mx-auto">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20 mb-4"
            >
              <Brain className="h-7 w-7 text-white" />
            </motion.div>
            <h3 className="text-base font-semibold text-slate-900 mb-2">
              Contract Intelligence Brief
            </h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Generate an AI-powered intelligence brief with executive summary, risk analysis,
              unusual clause detection, negotiation leverage points, and action items.
            </p>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-md"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Brief...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Intelligence Brief
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Full brief display
  const risk = getRiskColor(brief.riskScore);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("space-y-4", className)}
    >
      {/* Header Card */}
      <Card className="border-slate-200 overflow-hidden">
        <div className={cn("h-1", risk.bg)} />
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base">Intelligence Brief</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  AI-generated analysis for {contractName || 'this contract'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyExecutiveSummary}
                      className="h-8 w-8 p-0"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy executive summary</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="h-8 gap-1.5 text-xs"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Regenerate
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Risk Score + Executive Summary */}
          <div className="flex flex-col sm:flex-row gap-4">
            <RiskGauge score={brief.riskScore} />
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Executive Summary</h4>
              <p className="text-sm text-slate-700 leading-relaxed">{brief.executiveSummary}</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Risks', value: brief.riskFactors.length, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
              { label: 'Obligations', value: brief.obligations.length, icon: Target, color: 'text-amber-600 bg-amber-50' },
              { label: 'Unusual Clauses', value: brief.unusualClauses.length, icon: Eye, color: 'text-orange-600 bg-orange-50' },
              { label: 'Action Items', value: brief.actionItems.length, icon: Zap, color: 'text-violet-600 bg-violet-50' },
            ].map(({ label, value, icon: ItemIcon, color }) => (
              <div key={label} className="flex items-center gap-2.5 rounded-lg border border-slate-100 px-3 py-2">
                <div className={cn("w-7 h-7 rounded-md flex items-center justify-center", color)}>
                  <ItemIcon className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900 leading-none">{value}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Risk Factors */}
      <CollapsibleSection
        title="Risk Factors"
        icon={AlertTriangle}
        count={brief.riskFactors.length}
        defaultOpen={brief.riskFactors.some(r => r.severity === 'critical' || r.severity === 'high')}
        accentColor="red"
      >
        {brief.riskFactors.map((risk, i) => (
          <div key={i} className="rounded-lg border border-slate-100 p-3 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-slate-900">{risk.clause}</p>
              <Badge className={cn("text-[10px] shrink-0 border", getSeverityColor(risk.severity))}>
                {risk.severity}
              </Badge>
            </div>
            <p className="text-xs text-slate-600">{risk.description}</p>
            <div className="flex items-start gap-1.5 pt-1">
              <Shield className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
              <p className="text-xs text-emerald-700">{risk.mitigation}</p>
            </div>
          </div>
        ))}
      </CollapsibleSection>

      {/* Unusual Clauses */}
      {brief.unusualClauses.length > 0 && (
        <CollapsibleSection
          title="Unusual Clauses"
          icon={Eye}
          count={brief.unusualClauses.length}
          defaultOpen={true}
          accentColor="orange"
        >
          {brief.unusualClauses.map((clause, i) => (
            <div key={i} className="rounded-lg border border-slate-100 p-3 space-y-1.5">
              <p className="text-sm font-medium text-slate-900">{clause.clause}</p>
              <p className="text-xs text-slate-600">{clause.whyUnusual}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <div className="flex items-start gap-1.5">
                  <Scale className="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-700">{clause.marketComparison}</p>
                </div>
                <div className="flex items-start gap-1.5">
                  <Zap className="h-3 w-3 text-violet-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-violet-700">{clause.recommendation}</p>
                </div>
              </div>
            </div>
          ))}
        </CollapsibleSection>
      )}

      {/* Leverage Points */}
      {brief.leveragePoints.length > 0 && (
        <CollapsibleSection
          title="Negotiation Leverage"
          icon={TrendingUp}
          count={brief.leveragePoints.length}
          accentColor="emerald"
        >
          {brief.leveragePoints.map((lp, i) => (
            <div key={i} className="rounded-lg border border-slate-100 p-3 space-y-1">
              <p className="text-sm font-medium text-slate-900">{lp.point}</p>
              <p className="text-xs text-slate-600">{lp.explanation}</p>
              <p className="text-xs text-emerald-700 font-medium pt-0.5">→ {lp.suggestedAction}</p>
            </div>
          ))}
        </CollapsibleSection>
      )}

      {/* Obligations */}
      <CollapsibleSection
        title="Obligations"
        icon={Target}
        count={brief.obligations.length}
        accentColor="amber"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left font-medium text-slate-500 py-2 pr-3">Party</th>
                <th className="text-left font-medium text-slate-500 py-2 pr-3">Obligation</th>
                <th className="text-left font-medium text-slate-500 py-2 pr-3">Deadline</th>
                <th className="text-left font-medium text-slate-500 py-2">Priority</th>
              </tr>
            </thead>
            <tbody>
              {brief.obligations.map((ob, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="py-2 pr-3 font-medium text-slate-700 whitespace-nowrap">{ob.party}</td>
                  <td className="py-2 pr-3 text-slate-600">{ob.obligation}</td>
                  <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">{ob.deadline || '—'}</td>
                  <td className="py-2">
                    <Badge className={cn("text-[10px] border", getSeverityColor(ob.priority))}>{ob.priority}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>

      {/* Key Dates */}
      {brief.keyDates.length > 0 && (
        <CollapsibleSection
          title="Key Dates"
          icon={Calendar}
          count={brief.keyDates.length}
          accentColor="blue"
        >
          <div className="space-y-1.5">
            {brief.keyDates.map((kd, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
                <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center shrink-0">
                  <Clock className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-900">{kd.event}</p>
                  <p className="text-[10px] text-slate-500">{kd.date}</p>
                </div>
                <Badge className={cn("text-[10px] border", getSeverityColor(kd.importance))}>{kd.importance}</Badge>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Action Items */}
      <CollapsibleSection
        title="Action Items"
        icon={Zap}
        count={brief.actionItems.length}
        defaultOpen={true}
        accentColor="violet"
      >
        <div className="space-y-1.5">
          {brief.actionItems.map((item, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border border-slate-100 px-3 py-2.5">
              <div className="w-5 h-5 rounded-full border-2 border-slate-300 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-900">{item.action}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={cn("text-[10px] border-0", getUrgencyColor(item.urgency))}>
                    {item.urgency === 'when_convenient' ? 'When convenient' : item.urgency}
                  </Badge>
                  {item.assignee && (
                    <span className="text-[10px] text-slate-400">→ {item.assignee}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </motion.div>
  );
}
