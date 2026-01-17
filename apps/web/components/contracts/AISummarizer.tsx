'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Brain,
  FileText,
  Clock,
  CheckCircle2,
  Copy,
  Download,
  Share2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  DollarSign,
  Calendar,
  Users,
  Shield,
  Scale,
  Zap,
  Target,
  TrendingUp,
  Loader2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface ContractSummary {
  overview: string;
  keyPoints: string[];
  parties: {
    name: string;
    role: string;
    obligations: string[];
  }[];
  financials: {
    totalValue?: number;
    currency?: string;
    paymentTerms?: string;
    penalties?: string;
  };
  dates: {
    effectiveDate?: string;
    expirationDate?: string;
    renewalTerms?: string;
    noticePeriod?: string;
  };
  risks: {
    level: 'low' | 'medium' | 'high';
    factors: {
      title: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
    }[];
  };
  obligations: {
    party: string;
    items: string[];
  }[];
  recommendations: {
    type: 'action' | 'warning' | 'opportunity';
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
  }[];
}

interface AISummarizerProps {
  contractId: string;
  contractTitle: string;
  onClose?: () => void;
  isOpen?: boolean;
}

// ============================================================================
// Quick Summarize Button (Floating Action Button)
// ============================================================================

interface QuickSummarizeButtonProps {
  onClick: () => void;
  isLoading?: boolean;
}

export function QuickSummarizeButton({ onClick, isLoading }: QuickSummarizeButtonProps) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-6 right-6 z-50"
    >
      <Button
        onClick={onClick}
        disabled={isLoading}
        className={cn(
          "h-14 w-14 rounded-full shadow-2xl",
          "bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600",
          "hover:from-purple-700 hover:via-indigo-700 hover:to-blue-700",
          "text-white border-0"
        )}
      >
        {isLoading ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : (
          <Sparkles className="w-6 h-6" />
        )}
      </Button>
      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        className="absolute right-16 top-1/2 -translate-y-1/2 whitespace-nowrap"
      >
        <Badge className="bg-slate-900 text-white shadow-lg px-3 py-1.5">
          <Brain className="w-3 h-3 mr-1.5" />
          AI Summary
        </Badge>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// Summary Section Components
// ============================================================================

function SummarySection({ 
  title, 
  icon, 
  children, 
  color = 'blue',
  defaultOpen = true 
}: { 
  title: string; 
  icon: React.ReactNode; 
  children: React.ReactNode;
  color?: string;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const colorClasses: Record<string, string> = {
    blue: 'from-blue-500 to-indigo-600',
    green: 'from-green-500 to-emerald-600',
    amber: 'from-amber-500 to-orange-600',
    red: 'from-red-500 to-rose-600',
    purple: 'from-purple-500 to-pink-600',
  };

  return (
    <motion.div
      layout
      className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg bg-gradient-to-br text-white", colorClasses[color] || colorClasses.blue)}>
            {icon}
          </div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-5 h-5 text-slate-400" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-4 border-t border-slate-100 pt-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// Main AI Summarizer Component
// ============================================================================

export function AISummarizer({ contractId, contractTitle, isOpen, onClose }: AISummarizerProps) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<ContractSummary | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [copied, setCopied] = useState(false);

  // Generate summary
  const generateSummary = useCallback(async () => {
    setLoading(true);
    setProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 15, 90));
      }, 400);

      // Call API
      const response = await fetch(`/api/contracts/${contractId}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          includeRisks: true,
          includeFinancials: true,
          includeRecommendations: true,
        }),
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        throw new Error(`Failed to generate summary: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.summary) {
        setSummary(data.summary);
        toast.success('Summary generated successfully');
      } else {
        throw new Error(data.error || 'Failed to parse summary');
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate summary');
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  // Copy summary to clipboard
  const copyToClipboard = () => {
    if (!summary) return;
    
    const text = `
# Contract Summary: ${contractTitle}

## Overview
${summary.overview}

## Key Points
${summary.keyPoints.map(p => `- ${p}`).join('\n')}

## Financials
- Total Value: ${summary.financials.totalValue ? `$${summary.financials.totalValue.toLocaleString()}` : 'N/A'}
- Payment Terms: ${summary.financials.paymentTerms || 'N/A'}

## Risk Assessment
Level: ${summary.risks.level.toUpperCase()}
${summary.risks.factors.map(f => `- ${f.title} (${f.severity}): ${f.description}`).join('\n')}
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Summary copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  // Auto-generate on open
  React.useEffect(() => {
    if (isOpen && !summary && !loading) {
      generateSummary();
    }
  }, [isOpen, summary, loading, generateSummary]);

  const formatCurrency = (value: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose?.()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-gradient-to-br from-slate-50 to-white p-0">
        {/* Header */}
        <DialogHeader className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 px-6 py-5 text-white flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-white">AI Contract Summary</DialogTitle>
                <DialogDescription className="text-purple-100 mt-0.5">
                  {contractTitle}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {summary && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyToClipboard}
                    className="text-white hover:bg-white/20"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={generateSummary}
                    disabled={loading}
                    className="text-white hover:bg-white/20"
                  >
                    <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4"
            >
              <div className="flex items-center justify-between text-sm text-white/80 mb-2">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  Analyzing contract with AI...
                </span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2 bg-white/20" />
            </motion.div>
          )}
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                <Brain className="w-8 h-8 text-purple-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mt-6 mb-2">Analyzing Contract</h3>
              <p className="text-slate-500 text-center max-w-md">
                Our AI is reading through the contract to extract key information, identify risks, and generate recommendations.
              </p>
            </div>
          ) : summary ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="bg-slate-100 p-1 rounded-xl">
                <TabsTrigger value="overview" className="rounded-lg">Overview</TabsTrigger>
                <TabsTrigger value="parties" className="rounded-lg">Parties</TabsTrigger>
                <TabsTrigger value="risks" className="rounded-lg">Risks</TabsTrigger>
                <TabsTrigger value="recommendations" className="rounded-lg">Actions</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                {/* Executive Summary */}
                <SummarySection title="Executive Summary" icon={<FileText className="w-4 h-4" />} color="blue">
                  <p className="text-slate-600 leading-relaxed">{summary.overview}</p>
                </SummarySection>

                {/* Key Points */}
                <SummarySection title="Key Points" icon={<Zap className="w-4 h-4" />} color="purple">
                  <ul className="space-y-2">
                    {summary.keyPoints.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-slate-600">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </SummarySection>

                {/* Financials & Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <SummarySection title="Financial Terms" icon={<DollarSign className="w-4 h-4" />} color="green">
                    <div className="space-y-3">
                      {summary.financials.totalValue && (
                        <div>
                          <p className="text-xs text-slate-500 uppercase font-medium">Total Value</p>
                          <p className="text-lg font-bold text-emerald-600">
                            {formatCurrency(summary.financials.totalValue, summary.financials.currency)}
                          </p>
                        </div>
                      )}
                      {summary.financials.paymentTerms && (
                        <div>
                          <p className="text-xs text-slate-500 uppercase font-medium">Payment Terms</p>
                          <p className="text-slate-700">{summary.financials.paymentTerms}</p>
                        </div>
                      )}
                    </div>
                  </SummarySection>

                  <SummarySection title="Key Dates" icon={<Calendar className="w-4 h-4" />} color="amber">
                    <div className="space-y-3">
                      {summary.dates.effectiveDate && (
                        <div>
                          <p className="text-xs text-slate-500 uppercase font-medium">Effective Date</p>
                          <p className="text-slate-700">{new Date(summary.dates.effectiveDate).toLocaleDateString()}</p>
                        </div>
                      )}
                      {summary.dates.expirationDate && (
                        <div>
                          <p className="text-xs text-slate-500 uppercase font-medium">Expiration Date</p>
                          <p className="text-slate-700">{new Date(summary.dates.expirationDate).toLocaleDateString()}</p>
                        </div>
                      )}
                      {summary.dates.renewalTerms && (
                        <div>
                          <p className="text-xs text-slate-500 uppercase font-medium">Renewal</p>
                          <p className="text-slate-700">{summary.dates.renewalTerms}</p>
                        </div>
                      )}
                    </div>
                  </SummarySection>
                </div>
              </TabsContent>

              <TabsContent value="parties" className="space-y-4">
                {summary.parties.map((party, idx) => (
                  <SummarySection
                    key={idx}
                    title={`${party.name} (${party.role})`}
                    icon={<Users className="w-4 h-4" />}
                    color={idx === 0 ? 'blue' : 'purple'}
                  >
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-medium mb-2">Obligations</p>
                      <ul className="space-y-1.5">
                        {party.obligations.map((obligation, oIdx) => (
                          <li key={oIdx} className="flex items-start gap-2 text-slate-600 text-sm">
                            <Scale className="w-3 h-3 text-slate-400 mt-0.5 flex-shrink-0" />
                            {obligation}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </SummarySection>
                ))}
              </TabsContent>

              <TabsContent value="risks" className="space-y-4">
                {/* Risk Overview */}
                <div className={cn(
                  "p-4 rounded-xl border-2",
                  summary.risks.level === 'high' ? 'bg-red-50 border-red-200' :
                  summary.risks.level === 'medium' ? 'bg-amber-50 border-amber-200' :
                  'bg-green-50 border-green-200'
                )}>
                  <div className="flex items-center gap-3">
                    <Shield className={cn(
                      "w-8 h-8",
                      summary.risks.level === 'high' ? 'text-red-500' :
                      summary.risks.level === 'medium' ? 'text-amber-500' :
                      'text-green-500'
                    )} />
                    <div>
                      <p className="font-semibold text-slate-900">Overall Risk Level</p>
                      <p className="text-sm capitalize font-bold" style={{
                        color: summary.risks.level === 'high' ? '#ef4444' :
                               summary.risks.level === 'medium' ? '#f59e0b' : '#22c55e'
                      }}>
                        {summary.risks.level} Risk
                      </p>
                    </div>
                  </div>
                </div>

                {/* Risk Factors */}
                <SummarySection title="Risk Factors" icon={<AlertTriangle className="w-4 h-4" />} color="red">
                  <div className="space-y-3">
                    {summary.risks.factors.map((factor, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium text-slate-900">{factor.title}</h4>
                          <Badge className={cn(
                            "text-[10px]",
                            factor.severity === 'high' ? 'bg-red-100 text-red-700' :
                            factor.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                            'bg-green-100 text-green-700'
                          )}>
                            {factor.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600">{factor.description}</p>
                      </div>
                    ))}
                  </div>
                </SummarySection>
              </TabsContent>

              <TabsContent value="recommendations" className="space-y-4">
                {summary.recommendations.map((rec, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={cn(
                      "p-4 rounded-xl border-l-4",
                      rec.type === 'warning' ? 'bg-amber-50 border-amber-500' :
                      rec.type === 'action' ? 'bg-blue-50 border-blue-500' :
                      'bg-green-50 border-green-500'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        rec.type === 'warning' ? 'bg-amber-100' :
                        rec.type === 'action' ? 'bg-blue-100' :
                        'bg-green-100'
                      )}>
                        {rec.type === 'warning' ? <AlertTriangle className="w-4 h-4 text-amber-600" /> :
                         rec.type === 'action' ? <Target className="w-4 h-4 text-blue-600" /> :
                         <TrendingUp className="w-4 h-4 text-green-600" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-semibold text-slate-900">{rec.title}</h4>
                          <Badge variant="outline" className="capitalize text-[10px]">
                            {rec.priority} priority
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600">{rec.description}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </TabsContent>
            </Tabs>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AISummarizer;
