'use client';

import React, { useState, useEffect, use } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  FileText,
  Loader2,
  MessageSquare,
  Scale,
  Shield,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  XCircle,
  BookOpen,
  FileCheck,
  Eye,
  Split,
} from 'lucide-react';
import Link from 'next/link';

// Types
interface ClauseAssessment {
  id: string;
  clauseText: string;
  category: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  issues: string[];
  suggestions: string[];
  playbookMatch?: {
    preferredText?: string;
    minimumAcceptable?: string;
    walkawayTrigger?: string;
  };
}

interface Redline {
  id: string;
  type: 'addition' | 'deletion' | 'modification';
  originalText: string;
  suggestedText: string;
  reason: string;
  riskLevel: string;
  category: string;
  status: 'pending' | 'accepted' | 'rejected' | 'negotiating';
  negotiationNotes?: string;
}

interface LegalReview {
  id: string;
  overallRiskScore: number;
  overallRiskLevel: string;
  recommendation: string;
  clauseAssessments: ClauseAssessment[];
  redlines: Redline[];
  playbook?: {
    id: string;
    name: string;
  };
}

interface Contract {
  id: string;
  contractTitle: string;
  rawText?: string;
  status: string;
}

// Risk level colors
const riskColors = {
  low: 'bg-green-100 text-green-700 border-green-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  critical: 'bg-red-100 text-red-700 border-red-200',
};

const riskBgColors = {
  low: 'bg-green-50',
  medium: 'bg-yellow-50',
  high: 'bg-orange-50',
  critical: 'bg-red-50',
};

export default function LegalReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [contract, setContract] = useState<Contract | null>(null);
  const [review, setReview] = useState<LegalReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [viewMode, setViewMode] = useState<'split' | 'redlines' | 'original'>('split');
  
  // Playbook selection
  const [playbooks, setPlaybooks] = useState<Array<{ id: string; name: string; isDefault: boolean }>>([]);
  const [selectedPlaybook, setSelectedPlaybook] = useState<string>('');
  
  // Negotiation dialog
  const [negotiateDialog, setNegotiateDialog] = useState<{ open: boolean; redline: Redline | null }>({
    open: false,
    redline: null,
  });
  const [negotiationText, setNegotiationText] = useState('');
  
  // Expanded clauses
  const [expandedClauses, setExpandedClauses] = useState<Set<string>>(new Set());

  // Fetch contract
  useEffect(() => {
    async function fetchContract() {
      try {
        const response = await fetch(`/api/contracts/${id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.contract) {
            setContract({
              id: data.contract.id,
              contractTitle: data.contract.contractTitle || data.contract.filename || 'Contract',
              rawText: data.contract.rawText || data.contract.extractedData?.rawText,
              status: data.contract.status,
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch contract:', error);
        toast.error('Failed to load contract');
      }
    }
    fetchContract();
  }, [id]);

  // Fetch playbooks
  useEffect(() => {
    async function fetchPlaybooks() {
      try {
        const response = await fetch('/api/playbooks');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setPlaybooks(data.playbooks || []);
            // Auto-select default playbook
            const defaultPlaybook = data.playbooks?.find((p: { isDefault: boolean }) => p.isDefault);
            if (defaultPlaybook) {
              setSelectedPlaybook(defaultPlaybook.id);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch playbooks:', error);
      }
    }
    fetchPlaybooks();
  }, []);

  // Fetch existing review
  useEffect(() => {
    async function fetchReview() {
      try {
        const response = await fetch(`/api/legal-review?contractId=${id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.reviews?.length > 0) {
            const latestReview = data.reviews[0];
            setReview({
              id: latestReview.id,
              overallRiskScore: latestReview.overallRiskScore || 0,
              overallRiskLevel: latestReview.overallRiskLevel || 'medium',
              recommendation: latestReview.recommendation || '',
              clauseAssessments: latestReview.clauseAssessments || [],
              redlines: latestReview.redlines || [],
              playbook: latestReview.playbook,
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch review:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchReview();
  }, [id]);

  // Run AI analysis
  const runAnalysis = async () => {
    if (!contract?.rawText) {
      toast.error('No contract text available for analysis');
      return;
    }

    setAnalyzing(true);
    try {
      const response = await fetch('/api/legal-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: id,
          playbookId: selectedPlaybook || undefined,
          contractText: contract.rawText,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.review) {
          setReview({
            id: data.review.id,
            overallRiskScore: data.review.overallRiskScore || 0,
            overallRiskLevel: data.review.overallRiskLevel || 'medium',
            recommendation: data.review.recommendation || '',
            clauseAssessments: data.review.clauseAssessments || [],
            redlines: data.review.redlines || [],
            playbook: data.review.playbook,
          });
          toast.success('Legal review completed');
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      toast.error('Failed to run analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  // Handle redline actions
  const handleRedlineAction = async (redlineId: string, action: 'accept' | 'reject') => {
    if (!review) return;

    const updatedRedlines = review.redlines.map(r =>
      r.id === redlineId ? { ...r, status: action === 'accept' ? 'accepted' : 'rejected' } : r
    );

    setReview({ ...review, redlines: updatedRedlines as Redline[] });
    toast.success(`Change ${action}ed`);
  };

  // Handle negotiation
  const handleNegotiate = (redline: Redline) => {
    setNegotiateDialog({ open: true, redline });
    setNegotiationText(redline.suggestedText);
  };

  const submitNegotiation = () => {
    if (!review || !negotiateDialog.redline) return;

    const updatedRedlines = review.redlines.map(r =>
      r.id === negotiateDialog.redline?.id
        ? { ...r, status: 'negotiating', suggestedText: negotiationText, negotiationNotes: 'Counter-proposal submitted' }
        : r
    );

    setReview({ ...review, redlines: updatedRedlines as Redline[] });
    setNegotiateDialog({ open: false, redline: null });
    toast.success('Counter-proposal submitted');
  };

  // Accept/reject all
  const handleAcceptAll = () => {
    if (!review) return;
    const updatedRedlines = review.redlines.map(r => ({ ...r, status: 'accepted' }));
    setReview({ ...review, redlines: updatedRedlines as Redline[] });
    toast.success('All changes accepted');
  };

  const handleRejectAll = () => {
    if (!review) return;
    const updatedRedlines = review.redlines.map(r => ({ ...r, status: 'rejected' }));
    setReview({ ...review, redlines: updatedRedlines as Redline[] });
    toast.success('All changes rejected');
  };

  // Toggle clause expansion
  const toggleClause = (clauseId: string) => {
    setExpandedClauses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clauseId)) {
        newSet.delete(clauseId);
      } else {
        newSet.add(clauseId);
      }
      return newSet;
    });
  };

  // Get risk score color
  const getRiskScoreColor = (score: number) => {
    if (score >= 80) return 'text-red-600';
    if (score >= 60) return 'text-orange-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20 dark:from-slate-900 dark:via-purple-950/30 dark:to-purple-950/20 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <div className="w-16 h-16 border-4 border-indigo-200 dark:border-indigo-800 border-t-purple-600 dark:border-t-indigo-400 rounded-full animate-spin" />
            <Scale className="w-6 h-6 text-purple-600 dark:text-indigo-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-slate-600 dark:text-slate-300 font-medium">Loading legal review...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20 dark:from-slate-900 dark:via-purple-950/30 dark:to-purple-950/20 flex flex-col">
      {/* Header */}
      <div className="flex-none bg-gradient-to-r from-purple-600 via-purple-600 to-violet-600 shadow-xl">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <Link href={`/contracts/${id}`}>
                <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/20 gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              </Link>
              <div className="h-6 w-px bg-white/30" />
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                  <Scale className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">Legal Review & Redlining</h1>
                  <p className="text-sm text-white/80">{contract?.contractTitle}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Playbook selector */}
              <Select value={selectedPlaybook} onValueChange={setSelectedPlaybook}>
                <SelectTrigger className="w-[200px] bg-white/20 border-white/30 text-white">
                  <BookOpen className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Select playbook" />
                </SelectTrigger>
                <SelectContent>
                  {playbooks.map(pb => (
                    <SelectItem key={pb.id} value={pb.id}>
                      {pb.name} {pb.isDefault && '(Default)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={runAnalysis}
                disabled={analyzing || !contract?.rawText}
                className="bg-white text-purple-600 hover:bg-white/90 gap-2"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {review ? 'Re-analyze' : 'Run Analysis'}
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-[1800px] w-full mx-auto px-6 py-6">
        {!review ? (
          // No review yet
          <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
            <CardContent className="py-16 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-500 mb-6 shadow-xl shadow-purple-500/30 dark:shadow-purple-500/20">
                <Scale className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">AI-Powered Legal Review</h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-lg mx-auto mb-8">
                Get instant insights into contract risks, clause assessments, and AI-suggested redlines based on your organization&apos;s playbook.
              </p>
              
              <Button
                onClick={runAnalysis}
                disabled={analyzing || !contract?.rawText}
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-purple-600 hover:from-purple-700 hover:to-purple-700 gap-2 shadow-lg shadow-purple-500/30"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing Contract...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Start AI Analysis
                  </>
                )}
              </Button>
              
              {!contract?.rawText && (
                <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl max-w-md mx-auto">
                  <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    No contract text available. The contract text needs to be extracted first.
                  </p>
                </div>
              )}
              
              {/* What you'll get */}
              <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
                <div className="p-5 bg-slate-50 dark:bg-slate-700/50 rounded-xl text-left">
                  <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg w-fit mb-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Risk Assessment</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Identify high-risk clauses and potential issues before they become problems.</p>
                </div>
                <div className="p-5 bg-slate-50 dark:bg-slate-700/50 rounded-xl text-left">
                  <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg w-fit mb-3">
                    <Edit3 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Smart Redlines</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">AI suggests specific language changes to improve contract terms.</p>
                </div>
                <div className="p-5 bg-slate-50 dark:bg-slate-700/50 rounded-xl text-left">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg w-fit mb-3">
                    <BookOpen className="w-5 h-5 text-purple-600 dark:text-indigo-400" />
                  </div>
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Playbook Comparison</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Compare against your organization&apos;s standard positions and fallback language.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="flex items-center justify-between">
              <TabsList className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50">
                <TabsTrigger value="overview" className="gap-2 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-100">
                  <Shield className="w-4 h-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="clauses" className="gap-2 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-100">
                  <FileText className="w-4 h-4" />
                  Clause Analysis
                </TabsTrigger>
                <TabsTrigger value="redlines" className="gap-2 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-100">
                  <Edit3 className="w-4 h-4" />
                  Redlines ({review.redlines.length})
                </TabsTrigger>
              </TabsList>

              {activeTab === 'redlines' && (
                <div className="flex items-center gap-2">
                  <Select value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="split">
                        <div className="flex items-center gap-2">
                          <Split className="w-4 h-4" />
                          Split View
                        </div>
                      </SelectItem>
                      <SelectItem value="redlines">
                        <div className="flex items-center gap-2">
                          <Edit3 className="w-4 h-4" />
                          Redlines Only
                        </div>
                      </SelectItem>
                      <SelectItem value="original">
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4" />
                          Original
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button variant="outline" size="sm" onClick={handleAcceptAll} className="gap-1">
                    <ThumbsUp className="w-4 h-4" />
                    Accept All
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRejectAll} className="gap-1">
                    <ThumbsDown className="w-4 h-4" />
                    Reject All
                  </Button>
                </div>
              )}
            </div>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Risk Score Card */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 h-full">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                        <Shield className="w-5 h-5 text-purple-500 dark:text-indigo-400" />
                        Overall Risk Assessment
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center mb-6">
                        <div className="relative inline-flex items-center justify-center">
                          <svg className="w-32 h-32 transform -rotate-90">
                            <circle
                              cx="64"
                              cy="64"
                              r="56"
                              stroke="currentColor"
                              strokeWidth="8"
                              fill="none"
                              className="text-slate-200 dark:text-slate-700"
                            />
                            <circle
                              cx="64"
                              cy="64"
                              r="56"
                              stroke="currentColor"
                              strokeWidth="8"
                              fill="none"
                              strokeDasharray={352}
                              strokeDashoffset={352 - (352 * review.overallRiskScore) / 100}
                              className={getRiskScoreColor(review.overallRiskScore)}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute">
                            <span className={`text-3xl font-bold ${getRiskScoreColor(review.overallRiskScore)}`}>
                              {review.overallRiskScore}
                            </span>
                            <span className="text-slate-400">/100</span>
                          </div>
                        </div>
                        <Badge className={`mt-4 ${riskColors[review.overallRiskLevel as keyof typeof riskColors] || riskColors.medium}`}>
                          {review.overallRiskLevel.toUpperCase()} RISK
                        </Badge>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
                        <h4 className="font-medium text-slate-900 dark:text-slate-100 mb-2">AI Recommendation</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{review.recommendation}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Risk Breakdown */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 h-full">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                        <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                        Clause Risk Breakdown
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {['critical', 'high', 'medium', 'low'].map(level => {
                          const count = review.clauseAssessments.filter(c => c.riskLevel === level).length;
                          const total = review.clauseAssessments.length || 1;
                          const percentage = (count / total) * 100;
                          
                          return (
                            <div key={level}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium capitalize text-slate-900 dark:text-slate-100">{level}</span>
                                <span className="text-sm text-slate-600 dark:text-slate-400">{count}</span>
                              </div>
                              <Progress 
                                value={percentage} 
                                className={`h-2 ${
                                  level === 'critical' ? '[&>div]:bg-red-500' :
                                  level === 'high' ? '[&>div]:bg-orange-500' :
                                  level === 'medium' ? '[&>div]:bg-yellow-500' :
                                  '[&>div]:bg-green-500'
                                }`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Redline Summary */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50 h-full">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                        <Edit3 className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                        Redline Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="text-center p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{review.redlines.length}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Total Changes</p>
                        </div>
                        <div className="text-center p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl">
                          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                            {review.redlines.filter(r => r.status === 'pending').length}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Pending Review</p>
                        </div>
                        <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-xl">
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {review.redlines.filter(r => r.status === 'accepted').length}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Accepted</p>
                        </div>
                        <div className="text-center p-4 bg-red-50 dark:bg-red-950/30 rounded-xl">
                          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                            {review.redlines.filter(r => r.status === 'rejected').length}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Rejected</p>
                        </div>
                      </div>
                      
                      <Button 
                        className="w-full gap-2"
                        variant="outline"
                        onClick={() => setActiveTab('redlines')}
                      >
                        <Edit3 className="w-4 h-4" />
                        Review Redlines
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Playbook Info */}
              {review.playbook && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                          <BookOpen className="w-5 h-5 text-purple-600 dark:text-indigo-400" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">Analyzed using: {review.playbook.name}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Contract compared against organizational playbook guidelines
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </TabsContent>

            {/* Clauses Tab */}
            <TabsContent value="clauses" className="space-y-4">
              <AnimatePresence mode="popLayout">
                {review.clauseAssessments.map((clause, index) => (
                  <motion.div
                    key={clause.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className={`bg-white/80 backdrop-blur-sm border-slate-200/50 overflow-hidden ${
                      expandedClauses.has(clause.id) ? '' : 'cursor-pointer hover:shadow-md'
                    }`}>
                      <CardHeader 
                        className={`pb-3 ${riskBgColors[clause.riskLevel]}`}
                        onClick={() => toggleClause(clause.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge className={riskColors[clause.riskLevel]}>
                              {clause.riskLevel.toUpperCase()}
                            </Badge>
                            <CardTitle className="text-base text-slate-900 dark:text-slate-100">{clause.category}</CardTitle>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-600 dark:text-slate-400">Risk Score: {clause.riskScore}/100</span>
                            {expandedClauses.has(clause.id) ? (
                              <ChevronUp className="w-5 h-5 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                        </div>
                      </CardHeader>

                      <AnimatePresence>
                        {expandedClauses.has(clause.id) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                          >
                            <CardContent className="pt-4 space-y-4">
                              {/* Clause Text */}
                              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Clause Text</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                                  {clause.clauseText}
                                </p>
                              </div>

                              {/* Issues */}
                              {clause.issues.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                                    Issues Identified
                                  </h4>
                                  <ul className="space-y-1">
                                    {clause.issues.map((issue, i) => (
                                      <li key={i} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2">
                                        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                                        {issue}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Suggestions */}
                              {clause.suggestions.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                                    Suggestions
                                  </h4>
                                  <ul className="space-y-1">
                                    {clause.suggestions.map((suggestion, i) => (
                                      <li key={i} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                                        {suggestion}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Playbook Match */}
                              {clause.playbookMatch && (
                                <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-4">
                                  <h4 className="text-sm font-medium text-purple-700 dark:text-indigo-300 mb-3 flex items-center gap-2">
                                    <BookOpen className="w-4 h-4" />
                                    Playbook Reference
                                  </h4>
                                  <div className="space-y-3">
                                    {clause.playbookMatch.preferredText && (
                                      <div>
                                        <p className="text-xs font-medium text-purple-600 dark:text-indigo-400 mb-1">Preferred Language</p>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 bg-white/50 dark:bg-slate-700/50 rounded p-2">
                                          {clause.playbookMatch.preferredText}
                                        </p>
                                      </div>
                                    )}
                                    {clause.playbookMatch.minimumAcceptable && (
                                      <div>
                                        <p className="text-xs font-medium text-purple-600 dark:text-indigo-400 mb-1">Minimum Acceptable</p>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 bg-white/50 dark:bg-slate-700/50 rounded p-2">
                                          {clause.playbookMatch.minimumAcceptable}
                                        </p>
                                      </div>
                                    )}
                                    {clause.playbookMatch.walkawayTrigger && (
                                      <div>
                                        <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Walkaway Trigger</p>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 bg-red-50 dark:bg-red-950/30 rounded p-2">
                                          {clause.playbookMatch.walkawayTrigger}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>

              {review.clauseAssessments.length === 0 && (
                <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
                  <CardContent className="py-12 text-center">
                    <FileCheck className="w-12 h-12 mx-auto mb-4 text-green-300 dark:text-green-700" />
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">No Clause Issues Found</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      The contract appears to meet all playbook requirements.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Redlines Tab */}
            <TabsContent value="redlines" className="space-y-4">
              <ScrollArea className="h-[calc(100vh-300px)]">
                <div className="space-y-4 pr-4">
                  <AnimatePresence mode="popLayout">
                    {review.redlines.map((redline, index) => (
                      <motion.div
                        key={redline.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className={`bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-l-4 ${
                          redline.status === 'accepted' ? 'border-l-green-500' :
                          redline.status === 'rejected' ? 'border-l-red-500' :
                          redline.status === 'negotiating' ? 'border-l-amber-500' :
                          'border-l-purple-500'
                        }`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4 mb-4">
                              <div className="flex items-center gap-2">
                                <Badge className={riskColors[redline.riskLevel as keyof typeof riskColors] || riskColors.medium}>
                                  {redline.riskLevel}
                                </Badge>
                                <Badge variant="outline">{redline.category}</Badge>
                                <Badge variant="outline" className="capitalize">
                                  {redline.type}
                                </Badge>
                              </div>
                              <Badge className={
                                redline.status === 'accepted' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' :
                                redline.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' :
                                redline.status === 'negotiating' ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' :
                                'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                              }>
                                {redline.status}
                              </Badge>
                            </div>

                            <div className="space-y-3">
                              {/* Original */}
                              {(viewMode === 'split' || viewMode === 'original') && redline.originalText && (
                                <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3">
                                  <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Original</p>
                                  <p className="text-sm text-slate-700 dark:text-slate-300 line-through">
                                    {redline.originalText}
                                  </p>
                                </div>
                              )}

                              {/* Suggested */}
                              {(viewMode === 'split' || viewMode === 'redlines') && (
                                <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3">
                                  <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">Suggested</p>
                                  <p className="text-sm text-slate-700 dark:text-slate-300">
                                    {redline.suggestedText}
                                  </p>
                                </div>
                              )}

                              {/* Reason */}
                              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Reason</p>
                                <p className="text-sm text-slate-700 dark:text-slate-300">{redline.reason}</p>
                              </div>

                              {/* Negotiation Notes */}
                              {redline.negotiationNotes && (
                                <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
                                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">Negotiation Notes</p>
                                  <p className="text-sm text-slate-700 dark:text-slate-300">{redline.negotiationNotes}</p>
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            {redline.status === 'pending' && (
                              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/30"
                                  onClick={() => handleRedlineAction(redline.id, 'accept')}
                                >
                                  <ThumbsUp className="w-4 h-4" />
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30"
                                  onClick={() => handleRedlineAction(redline.id, 'reject')}
                                >
                                  <ThumbsDown className="w-4 h-4" />
                                  Reject
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1"
                                  onClick={() => handleNegotiate(redline)}
                                >
                                  <MessageSquare className="w-4 h-4" />
                                  Negotiate
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {review.redlines.length === 0 && (
                    <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
                      <CardContent className="py-12 text-center">
                        <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-300 dark:text-green-700" />
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">No Redlines Suggested</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          The contract meets playbook requirements with no changes needed.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Negotiation Dialog */}
      <Dialog open={negotiateDialog.open} onOpenChange={(open) => setNegotiateDialog({ open, redline: open ? negotiateDialog.redline : null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-purple-500" />
              Propose Counter-Language
            </DialogTitle>
            <DialogDescription>
              Suggest alternative language for this clause. This will be marked as under negotiation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {negotiateDialog.redline && (
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-xs font-medium text-red-600 mb-1">Original Suggestion</p>
                <p className="text-sm text-slate-700">{negotiateDialog.redline.suggestedText}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Your Counter-Proposal
              </label>
              <Textarea
                value={negotiationText}
                onChange={(e) => setNegotiationText(e.target.value)}
                rows={4}
                placeholder="Enter your proposed language..."
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNegotiateDialog({ open: false, redline: null })}>
              Cancel
            </Button>
            <Button onClick={submitNegotiation} className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Submit Counter-Proposal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
