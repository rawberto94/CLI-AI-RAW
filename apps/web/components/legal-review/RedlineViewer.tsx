'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, CheckCircle2, XCircle, MessageSquare, AlertTriangle, Shield,
  ChevronDown, ChevronRight, Clock, Check, X, Edit3, RefreshCw,
  Download, Share2, Search, Zap, Brain,
  Loader2, BookOpen, Target, Scale, AlertCircle, ThumbsUp, ThumbsDown,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface RedlineChange {
  id: string;
  type: 'addition' | 'deletion' | 'modification' | 'suggestion';
  section: string;
  clauseNumber?: string;
  originalText: string;
  suggestedText: string;
  explanation: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  source: {
    type: 'playbook' | 'ai' | 'clause_library' | 'best_practice';
    name?: string;
    confidence: number;
  };
  status: 'pending' | 'accepted' | 'rejected' | 'negotiating';
  negotiationNote?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  acceptedBy?: string;
  rejectedBy?: string;
  playbookReference?: {
    clauseName: string;
    preferredText: string;
    fallbackPosition?: string;
    walkawayTrigger?: string;
  };
}

interface ClauseAssessment {
  id: string;
  clauseNumber: string;
  clauseType: string;
  originalText: string;
  assessment: 'acceptable' | 'needs_modification' | 'unacceptable' | 'missing';
  riskScore: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  issues: string[];
  recommendations: string[];
  suggestedText?: string;
  playbookCompliance: boolean;
  negotiationGuidance?: string;
}

interface LegalReviewResult {
  id: string;
  contractId: string;
  playbookId?: string;
  playbookName?: string;
  overallRiskScore: number;
  overallRiskLevel: 'critical' | 'high' | 'medium' | 'low';
  recommendation: 'approve' | 'approve_with_changes' | 'negotiate' | 'reject';
  summary: string;
  clauseAssessments: ClauseAssessment[];
  redlines: RedlineChange[];
  createdAt: string;
  reviewedBy?: string;
}

interface RedlineViewerProps {
  contractId: string;
  review?: LegalReviewResult;
  onAcceptChange?: (changeId: string) => Promise<void>;
  onRejectChange?: (changeId: string, reason?: string) => Promise<void>;
  onNegotiate?: (changeId: string, note: string) => Promise<void>;
  onAcceptAll?: () => Promise<void>;
  onRefreshReview?: () => Promise<void>;
  isLoading?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RedlineViewer({
  
  contractId,
  review,
  onAcceptChange,
  onRejectChange,
  onNegotiate,
  onAcceptAll,
  onRefreshReview,
  isLoading = false,
}: RedlineViewerProps) {
  // State
  const [selectedChange, setSelectedChange] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  const [riskFilter, setRiskFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'split' | 'unified' | 'changes-only'>('split');
  const [showAssessments, setShowAssessments] = useState(true);
  const [negotiationNote, setNegotiationNote] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['all']));

  // Computed values
  const filteredChanges = useMemo(() => {
    if (!review?.redlines) return [];

    return review.redlines.filter((change) => {
      // Status filter
      if (activeFilter !== 'all' && change.status !== activeFilter) return false;

      // Risk filter
      if (riskFilter !== 'all' && change.riskLevel !== riskFilter) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          change.originalText.toLowerCase().includes(query) ||
          change.suggestedText.toLowerCase().includes(query) ||
          change.explanation.toLowerCase().includes(query) ||
          change.section.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [review?.redlines, activeFilter, riskFilter, searchQuery]);

  const statistics = useMemo(() => {
    if (!review?.redlines) return { total: 0, pending: 0, accepted: 0, rejected: 0, critical: 0, high: 0 };

    return {
      total: review.redlines.length,
      pending: review.redlines.filter((c) => c.status === 'pending').length,
      accepted: review.redlines.filter((c) => c.status === 'accepted').length,
      rejected: review.redlines.filter((c) => c.status === 'rejected').length,
      critical: review.redlines.filter((c) => c.riskLevel === 'critical').length,
      high: review.redlines.filter((c) => c.riskLevel === 'high').length,
    };
  }, [review?.redlines]);

  const groupedChanges = useMemo(() => {
    const groups: Record<string, RedlineChange[]> = {};
    filteredChanges.forEach((change) => {
      if (!groups[change.section]) {
        groups[change.section] = [];
      }
      groups[change.section].push(change);
    });
    return groups;
  }, [filteredChanges]);

  // Handlers
  const handleAccept = useCallback(async (changeId: string) => {
    if (!onAcceptChange) return;
    setProcessingId(changeId);
    try {
      await onAcceptChange(changeId);
    } finally {
      setProcessingId(null);
    }
  }, [onAcceptChange]);

  const handleReject = useCallback(async (changeId: string, reason?: string) => {
    if (!onRejectChange) return;
    setProcessingId(changeId);
    try {
      await onRejectChange(changeId, reason);
    } finally {
      setProcessingId(null);
    }
  }, [onRejectChange]);

  const handleNegotiate = useCallback(async (changeId: string) => {
    if (!onNegotiate || !negotiationNote.trim()) return;
    setProcessingId(changeId);
    try {
      await onNegotiate(changeId, negotiationNote);
      setNegotiationNote('');
      setSelectedChange(null);
    } finally {
      setProcessingId(null);
    }
  }, [onNegotiate, negotiationNote]);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  // Helpers
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
      case 'high': return 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800';
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
      case 'low': return 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
      default: return 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-600';
    }
  };

  const getStatusBadge = (status: RedlineChange['status']) => {
    switch (status) {
      case 'accepted':
        return <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-full text-xs"><Check className="h-3 w-3" /> Accepted</span>;
      case 'rejected':
        return <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-full text-xs"><X className="h-3 w-3" /> Rejected</span>;
      case 'negotiating':
        return <span className="flex items-center gap-1 px-2 py-0.5 bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 rounded-full text-xs"><MessageSquare className="h-3 w-3" /> Negotiating</span>;
      default:
        return <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-full text-xs"><Clock className="h-3 w-3" /> Pending</span>;
    }
  };

  const getTypeIcon = (type: RedlineChange['type']) => {
    switch (type) {
      case 'addition': return <span className="text-green-500 font-bold">+</span>;
      case 'deletion': return <span className="text-red-500 font-bold">−</span>;
      case 'modification': return <Edit3 className="h-4 w-4 text-violet-500" />;
      case 'suggestion': return <Zap className="h-4 w-4 text-violet-500" />;
    }
  };

  const getRecommendationBadge = (recommendation: LegalReviewResult['recommendation']) => {
    switch (recommendation) {
      case 'approve':
        return <span className="flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-lg font-medium"><CheckCircle2 className="h-4 w-4" /> Approve</span>;
      case 'approve_with_changes':
        return <span className="flex items-center gap-1 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded-lg font-medium"><AlertTriangle className="h-4 w-4" /> Approve with Changes</span>;
      case 'negotiate':
        return <span className="flex items-center gap-1 px-3 py-1 bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 rounded-lg font-medium"><Scale className="h-4 w-4" /> Negotiate</span>;
      case 'reject':
        return <span className="flex items-center gap-1 px-3 py-1 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg font-medium"><XCircle className="h-4 w-4" /> Reject</span>;
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[600px] bg-white dark:bg-slate-800 rounded-xl">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-violet-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-slate-300 font-medium">Performing legal review...</p>
          <p className="text-gray-400 dark:text-slate-500 text-sm mt-1">Analyzing contract against playbook standards</p>
        </div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="flex items-center justify-center min-h-[600px] bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
        <div className="text-center">
          <Brain className="h-12 w-12 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-slate-300 font-medium">No review available</p>
          <p className="text-gray-400 dark:text-slate-500 text-sm mt-1">Start a legal review to see redline suggestions</p>
          {onRefreshReview && (
            <button
              onClick={onRefreshReview}
              className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
            >
              Start Review
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-slate-900 min-h-screen">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-20">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-violet-100 dark:bg-violet-900/50 rounded-lg">
                <Shield className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h1 className="font-semibold text-gray-900 dark:text-slate-100">Legal Review & Redlining</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  {review.playbookName && (
                    <span className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />
                      {review.playbookName}
                    </span>
                  )}
                  <span className="text-xs text-gray-400 dark:text-slate-500">•</span>
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    {new Date(review.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {getRecommendationBadge(review.recommendation)}
              
              <div className="h-6 w-px bg-gray-200" />

              {/* Risk Score */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${getRiskColor(review.overallRiskLevel)}`}>
                <Target className="h-4 w-4" />
                <span className="font-semibold">{review.overallRiskScore}</span>
                <span className="text-xs opacity-75">Risk Score</span>
              </div>

              <div className="h-6 w-px bg-gray-200 dark:bg-slate-600" />

              {onRefreshReview && (
                <button
                  onClick={onRefreshReview}
                  className="p-2 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title="Refresh review"
                >
                  <RefreshCw className="h-5 w-5" />
                </button>
              )}
              <button className="p-2 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                <Download className="h-5 w-5" />
              </button>
              <button className="p-2 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                <Share2 className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="mt-4 p-4 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 rounded-lg border border-violet-100 dark:border-violet-900/50">
            <p className="text-gray-700 dark:text-slate-300">{review.summary}</p>
          </div>

          {/* Statistics Bar */}
          <div className="mt-4 flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-slate-100">{statistics.total}</span>
              <span className="text-sm text-gray-500 dark:text-slate-400">Total Changes</span>
            </div>
            <div className="h-8 w-px bg-gray-200 dark:bg-slate-600" />
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full bg-yellow-500" />
                <span className="text-sm text-gray-600 dark:text-slate-400">{statistics.pending} Pending</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="text-sm text-gray-600 dark:text-slate-400">{statistics.accepted} Accepted</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <span className="text-sm text-gray-600 dark:text-slate-400">{statistics.rejected} Rejected</span>
              </div>
            </div>
            <div className="h-8 w-px bg-gray-200 dark:bg-slate-600" />
            <div className="flex items-center gap-4">
              {statistics.critical > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-red-100 rounded-lg">
                  <AlertCircle className="h-3 w-3 text-red-600" />
                  <span className="text-sm font-medium text-red-700">{statistics.critical} Critical</span>
                </div>
              )}
              {statistics.high > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-orange-100 rounded-lg">
                  <AlertTriangle className="h-3 w-3 text-orange-600" />
                  <span className="text-sm font-medium text-orange-700">{statistics.high} High Risk</span>
                </div>
              )}
            </div>
            <div className="flex-1" />
            {statistics.pending > 0 && onAcceptAll && (
              <button
                onClick={onAcceptAll}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <CheckCircle2 className="h-4 w-4" />
                Accept All ({statistics.pending})
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search changes..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-slate-400">Status:</span>
            {(['all', 'pending', 'accepted', 'rejected'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setActiveFilter(status)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  activeFilter === status
                    ? 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300'
                    : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-gray-200 dark:bg-slate-600" />

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-slate-400">Risk:</span>
            {(['all', 'critical', 'high', 'medium', 'low'] as const).map((risk) => (
              <button
                key={risk}
                onClick={() => setRiskFilter(risk)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  riskFilter === risk
                    ? `${getRiskColor(risk === 'all' ? 'medium' : risk)}`
                    : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                }`}
              >
                {risk.charAt(0).toUpperCase() + risk.slice(1)}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-gray-200 dark:bg-slate-600" />

          <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
            {(['split', 'unified', 'changes-only'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  viewMode === mode
                    ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm'
                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                }`}
              >
                {mode.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <div className="max-w-[1600px] mx-auto space-y-4">
          {Object.entries(groupedChanges).map(([section, changes]) => (
            <div key={section} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expandedSections.has(section) || expandedSections.has('all') ? (
                    <ChevronDown className="h-5 w-5 text-gray-400 dark:text-slate-500" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-400 dark:text-slate-500" />
                  )}
                  <h3 className="font-medium text-gray-900 dark:text-slate-100">{section}</h3>
                  <span className="text-sm text-gray-500 dark:text-slate-400">({changes.length} changes)</span>
                </div>
                <div className="flex items-center gap-2">
                  {changes.filter(c => c.riskLevel === 'critical').length > 0 && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                      {changes.filter(c => c.riskLevel === 'critical').length} Critical
                    </span>
                  )}
                  {changes.filter(c => c.status === 'pending').length > 0 && (
                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                      {changes.filter(c => c.status === 'pending').length} Pending
                    </span>
                  )}
                </div>
              </button>

              {/* Section Content */}
              <AnimatePresence>
                {(expandedSections.has(section) || expandedSections.has('all')) && (
                  <motion.div key="RedlineViewer-ap-1"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-gray-100 dark:border-slate-700"
                  >
                    <div className="divide-y divide-gray-100 dark:divide-slate-700">
                      {changes.map((change) => (
                        <div
                          key={change.id}
                          className={`p-5 transition-colors ${
                            selectedChange === change.id ? 'bg-violet-50 dark:bg-violet-950/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'
                          }`}
                        >
                          {/* Change Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              {getTypeIcon(change.type)}
                              <div>
                                <div className="flex items-center gap-2">
                                  {change.clauseNumber && (
                                    <span className="text-sm font-mono text-gray-500 dark:text-slate-400">§{change.clauseNumber}</span>
                                  )}
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getRiskColor(change.riskLevel)}`}>
                                    {change.riskLevel}
                                  </span>
                                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded text-xs">
                                    {change.category}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">{change.explanation}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getStatusBadge(change.status)}
                              <span className="text-xs text-gray-400 dark:text-slate-500">
                                {Math.round(change.source.confidence * 100)}% confidence
                              </span>
                            </div>
                          </div>

                          {/* Diff View */}
                          {viewMode === 'split' ? (
                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs font-medium text-red-700">Original</span>
                                </div>
                                <p className="text-sm text-red-900 font-mono whitespace-pre-wrap line-through">
                                  {change.originalText}
                                </p>
                              </div>
                              <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs font-medium text-green-700">Suggested</span>
                                  {change.source.name && (
                                    <span className="text-xs text-green-600 bg-green-100 px-1.5 py-0.5 rounded">
                                      {change.source.type}: {change.source.name}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-green-900 font-mono whitespace-pre-wrap">
                                  {change.suggestedText}
                                </p>
                              </div>
                            </div>
                          ) : viewMode === 'unified' ? (
                            <div className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg border border-gray-200 dark:border-slate-600">
                              <p className="text-sm font-mono whitespace-pre-wrap">
                                <span className="bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 line-through">{change.originalText}</span>
                                {' '}
                                <span className="bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200">{change.suggestedText}</span>
                              </p>
                            </div>
                          ) : (
                            <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                              <p className="text-sm text-green-900 font-mono whitespace-pre-wrap">
                                {change.suggestedText}
                              </p>
                            </div>
                          )}

                          {/* Playbook Reference */}
                          {change.playbookReference && (
                            <div className="mt-3 p-3 bg-violet-50 rounded-lg border border-violet-100">
                              <div className="flex items-center gap-2 mb-2">
                                <BookOpen className="h-4 w-4 text-violet-600" />
                                <span className="text-sm font-medium text-violet-700">
                                  Playbook: {change.playbookReference.clauseName}
                                </span>
                              </div>
                              {change.playbookReference.fallbackPosition && (
                                <p className="text-xs text-violet-600 mt-1">
                                  <strong>Fallback:</strong> {change.playbookReference.fallbackPosition}
                                </p>
                              )}
                              {change.playbookReference.walkawayTrigger && (
                                <p className="text-xs text-red-600 mt-1">
                                  <strong>Walkaway Trigger:</strong> {change.playbookReference.walkawayTrigger}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Actions */}
                          {change.status === 'pending' && (
                            <div className="mt-4 flex items-center gap-3">
                              <button
                                onClick={() => handleAccept(change.id)}
                                disabled={processingId === change.id}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                              >
                                {processingId === change.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <ThumbsUp className="h-4 w-4" />
                                )}
                                Accept
                              </button>
                              <button
                                onClick={() => handleReject(change.id)}
                                disabled={processingId === change.id}
                                className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                              >
                                <ThumbsDown className="h-4 w-4" />
                                Reject
                              </button>
                              <button
                                onClick={() => setSelectedChange(selectedChange === change.id ? null : change.id)}
                                className="flex items-center gap-2 px-4 py-2 border border-violet-200 text-violet-600 rounded-lg hover:bg-violet-50 transition-colors"
                              >
                                <MessageSquare className="h-4 w-4" />
                                Negotiate
                              </button>
                            </div>
                          )}

                          {/* Negotiation Panel */}
                          <AnimatePresence>
                            {selectedChange === change.id && change.status === 'pending' && (
                              <motion.div key="selected-change"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="mt-4 overflow-hidden"
                              >
                                <div className="p-4 bg-violet-50 rounded-lg border border-violet-100">
                                  <label className="block text-sm font-medium text-violet-700 mb-2">
                                    Negotiation Note
                                  </label>
                                  <textarea
                                    value={negotiationNote}
                                    onChange={(e) => setNegotiationNote(e.target.value)}
                                    placeholder="Add your counter-proposal or negotiation notes..."
                                    className="w-full px-3 py-2 border border-violet-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                                    rows={3}
                                  />
                                  <div className="flex items-center gap-2 mt-3">
                                    <button
                                      onClick={() => handleNegotiate(change.id)}
                                      disabled={processingId === change.id || !negotiationNote.trim()}
                                      className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
                                    >
                                      {processingId === change.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Scale className="h-4 w-4" />
                                      )}
                                      Submit for Negotiation
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedChange(null);
                                        setNegotiationNote('');
                                      }}
                                      className="px-4 py-2 text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Negotiation Note Display */}
                          {change.status === 'negotiating' && change.negotiationNote && (
                            <div className="mt-3 p-3 bg-violet-50 rounded-lg border border-violet-100">
                              <div className="flex items-center gap-2 mb-1">
                                <MessageSquare className="h-4 w-4 text-violet-600" />
                                <span className="text-sm font-medium text-violet-700">Negotiation Note</span>
                              </div>
                              <p className="text-sm text-violet-800">{change.negotiationNote}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}

          {filteredChanges.length === 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-12 text-center">
              <Shield className="h-12 w-12 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-slate-300 font-medium">No changes match your filters</p>
              <p className="text-gray-400 dark:text-slate-500 text-sm mt-1">Try adjusting your search or filter criteria</p>
            </div>
          )}
        </div>

        {/* Clause Assessments Panel */}
        {showAssessments && review.clauseAssessments.length > 0 && (
          <div className="max-w-[1600px] mx-auto mt-8">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
                <h3 className="font-medium text-gray-900 dark:text-slate-100 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  Clause Assessments ({review.clauseAssessments.length})
                </h3>
                <button
                  onClick={() => setShowAssessments(false)}
                  className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-slate-700 max-h-96 overflow-y-auto">
                {review.clauseAssessments.map((assessment) => (
                  <div key={assessment.id} className="p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-gray-500 dark:text-slate-400">§{assessment.clauseNumber}</span>
                          <span className="font-medium text-gray-900 dark:text-slate-100">{assessment.clauseType}</span>
                          <span className={`px-2 py-0.5 rounded text-xs border ${getRiskColor(assessment.riskLevel)}`}>
                            Score: {assessment.riskScore}
                          </span>
                        </div>
                        {assessment.issues.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {assessment.issues.map((issue, i) => (
                              <li key={i} className="text-sm text-gray-600 dark:text-slate-400 flex items-start gap-2">
                                <AlertTriangle className="h-3.5 w-3.5 text-orange-500 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                                {issue}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        assessment.assessment === 'acceptable' ? 'bg-green-100 text-green-700' :
                        assessment.assessment === 'needs_modification' ? 'bg-yellow-100 text-yellow-700' :
                        assessment.assessment === 'unacceptable' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {assessment.assessment.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RedlineViewer;
