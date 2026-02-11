'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitCompare,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronDown,
  FileText,
  Shield,
  Zap,
  MessageSquare,
  BookOpen,
  Lightbulb,
  ArrowRight,
  Eye,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Send,
  Scale,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  RefreshCw,
  Settings,
  History,
  Target,
  Loader2,
} from 'lucide-react';
import { useDataMode } from '@/contexts/DataModeContext';

// ============================================================================
// Types
// ============================================================================

interface RedlineChange {
  id: string;
  type: 'addition' | 'deletion' | 'modification';
  originalText: string;
  proposedText: string;
  clause: string;
  section: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  category: 'liability' | 'termination' | 'payment' | 'confidentiality' | 'ip' | 'compliance' | 'other';
  aiAnalysis: {
    summary: string;
    marketPosition: 'favorable' | 'neutral' | 'unfavorable';
    recommendation: 'accept' | 'negotiate' | 'reject';
    rationale: string;
    fallbackSuggestion?: string;
  };
  playbookMatch?: {
    ruleId: string;
    ruleName: string;
    deviation: number; // percentage deviation from playbook
    fallbackLanguage: string;
  };
  status: 'pending' | 'accepted' | 'rejected' | 'negotiating';
}

interface NegotiationPlaybook {
  id: string;
  name: string;
  description: string;
  rules: PlaybookRule[];
  isActive: boolean;
}

interface PlaybookRule {
  id: string;
  category: string;
  name: string;
  preferredPosition: string;
  acceptableRange: string;
  fallbackLanguage: string;
  isNegotiable: boolean;
}

interface NegotiationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  loading?: boolean;
}

// ============================================================================
// Mock Data
// ============================================================================

const mockRedlines: RedlineChange[] = [
  {
    id: 'r1',
    type: 'modification',
    originalText: 'Liability shall be limited to the total fees paid under this Agreement in the twelve (12) months preceding the claim.',
    proposedText: 'Liability shall be limited to the total fees paid under this Agreement in the six (6) months preceding the claim.',
    clause: 'Limitation of Liability',
    section: 'Section 8.2',
    riskLevel: 'high',
    category: 'liability',
    aiAnalysis: {
      summary: 'Supplier proposes reducing liability cap period from 12 to 6 months, significantly limiting your recovery in case of breach.',
      marketPosition: 'unfavorable',
      recommendation: 'negotiate',
      rationale: 'Industry standard is 12-24 months. 6 months is below market and exposes you to unrecoverable losses for longer-term issues.',
      fallbackSuggestion: 'Counter with 12-month minimum or propose tiered liability based on severity.',
    },
    playbookMatch: {
      ruleId: 'pb1',
      ruleName: 'Liability Cap Period',
      deviation: 50,
      fallbackLanguage: 'Liability shall be limited to the greater of (a) total fees paid in the preceding twelve (12) months or (b) $500,000.',
    },
    status: 'pending',
  },
  {
    id: 'r2',
    type: 'addition',
    originalText: '',
    proposedText: 'Notwithstanding anything to the contrary, Customer shall indemnify Supplier for any third-party claims arising from Customer\'s use of the Services.',
    clause: 'Indemnification',
    section: 'Section 9.1 (New)',
    riskLevel: 'critical',
    category: 'liability',
    aiAnalysis: {
      summary: 'New broad indemnification clause shifts significant risk to your organization for third-party claims.',
      marketPosition: 'unfavorable',
      recommendation: 'reject',
      rationale: 'This one-sided indemnification is unusual for this type of agreement. Standard practice includes mutual indemnification with appropriate carve-outs.',
      fallbackSuggestion: 'Propose mutual indemnification limited to IP infringement and gross negligence.',
    },
    playbookMatch: {
      ruleId: 'pb2',
      ruleName: 'Indemnification Scope',
      deviation: 100,
      fallbackLanguage: 'Each party shall indemnify the other for claims arising from its own gross negligence, willful misconduct, or intellectual property infringement.',
    },
    status: 'pending',
  },
  {
    id: 'r3',
    type: 'modification',
    originalText: 'Either party may terminate this Agreement for convenience upon ninety (90) days\' written notice.',
    proposedText: 'Either party may terminate this Agreement for convenience upon one hundred eighty (180) days\' written notice.',
    clause: 'Termination for Convenience',
    section: 'Section 11.2',
    riskLevel: 'medium',
    category: 'termination',
    aiAnalysis: {
      summary: 'Extended termination notice period from 90 to 180 days reduces flexibility but provides more transition time.',
      marketPosition: 'neutral',
      recommendation: 'negotiate',
      rationale: '180 days is longer than typical but may be acceptable for critical services. Consider your ability to source alternatives.',
      fallbackSuggestion: 'Accept 180 days but negotiate a shorter period (90 days) if supplier is in material breach.',
    },
    playbookMatch: {
      ruleId: 'pb3',
      ruleName: 'Termination Notice Period',
      deviation: 33,
      fallbackLanguage: 'Either party may terminate for convenience upon ninety (90) days\' written notice; provided that termination shall be effective upon thirty (30) days\' notice in the event of material breach.',
    },
    status: 'pending',
  },
  {
    id: 'r4',
    type: 'modification',
    originalText: 'Supplier shall maintain commercially reasonable security measures.',
    proposedText: 'Supplier shall maintain security measures in accordance with ISO 27001 or equivalent standards.',
    clause: 'Security Requirements',
    section: 'Section 6.4',
    riskLevel: 'low',
    category: 'compliance',
    aiAnalysis: {
      summary: 'Upgrade from vague "commercially reasonable" to specific ISO 27001 standard - a positive change.',
      marketPosition: 'favorable',
      recommendation: 'accept',
      rationale: 'This change provides clearer, enforceable security commitments aligned with industry best practices.',
    },
    status: 'pending',
  },
  {
    id: 'r5',
    type: 'deletion',
    originalText: 'Customer shall have the right to audit Supplier\'s facilities and records upon thirty (30) days\' written notice.',
    proposedText: '',
    clause: 'Audit Rights',
    section: 'Section 12.3',
    riskLevel: 'high',
    category: 'compliance',
    aiAnalysis: {
      summary: 'Complete removal of audit rights eliminates key compliance verification capability.',
      marketPosition: 'unfavorable',
      recommendation: 'reject',
      rationale: 'Audit rights are essential for regulatory compliance and risk management. Removal is a significant red flag.',
      fallbackSuggestion: 'Insist on retaining audit rights, or accept third-party audit certification as alternative.',
    },
    playbookMatch: {
      ruleId: 'pb4',
      ruleName: 'Audit Rights',
      deviation: 100,
      fallbackLanguage: 'Customer shall have the right to audit, or engage a third-party auditor to audit, Supplier\'s compliance with this Agreement upon reasonable notice.',
    },
    status: 'pending',
  },
];

const mockPlaybooks: NegotiationPlaybook[] = [
  {
    id: 'p1',
    name: 'Standard Software Procurement',
    description: 'Default playbook for software and SaaS agreements',
    isActive: true,
    rules: [
      { id: 'r1', category: 'liability', name: 'Liability Cap Period', preferredPosition: '24 months', acceptableRange: '12-24 months', fallbackLanguage: '...', isNegotiable: true },
      { id: 'r2', category: 'termination', name: 'Termination Notice', preferredPosition: '60 days', acceptableRange: '30-90 days', fallbackLanguage: '...', isNegotiable: true },
    ],
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

const getRiskColor = (level: RedlineChange['riskLevel']) => {
  switch (level) {
    case 'low': return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' };
    case 'medium': return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' };
    case 'high': return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' };
    case 'critical': return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' };
  }
};

const getRecommendationConfig = (rec: RedlineChange['aiAnalysis']['recommendation']) => {
  switch (rec) {
    case 'accept': return { icon: CheckCircle2, color: 'text-green-600 bg-green-50', label: 'Accept' };
    case 'negotiate': return { icon: MessageSquare, color: 'text-amber-600 bg-amber-50', label: 'Negotiate' };
    case 'reject': return { icon: XCircle, color: 'text-red-600 bg-red-50', label: 'Reject' };
  }
};

const getMarketPositionConfig = (position: RedlineChange['aiAnalysis']['marketPosition']) => {
  switch (position) {
    case 'favorable': return { icon: TrendingUp, color: 'text-green-600', label: 'Favorable' };
    case 'neutral': return { icon: Scale, color: 'text-slate-600', label: 'Neutral' };
    case 'unfavorable': return { icon: TrendingDown, color: 'text-red-600', label: 'Unfavorable' };
  }
};

const getChangeTypeIcon = (type: RedlineChange['type']) => {
  switch (type) {
    case 'addition': return { icon: '+', color: 'bg-green-500' };
    case 'deletion': return { icon: '-', color: 'bg-red-500' };
    case 'modification': return { icon: '~', color: 'bg-amber-500' };
  }
};

// ============================================================================
// Redline Card Component
// ============================================================================

interface RedlineCardProps {
  redline: RedlineChange;
  isExpanded: boolean;
  onToggle: () => void;
  onAction: (action: 'accept' | 'reject' | 'negotiate') => void;
}

const RedlineCard: React.FC<RedlineCardProps> = ({ redline, isExpanded, onToggle, onAction }) => {
  const riskColors = getRiskColor(redline.riskLevel);
  const recConfig = getRecommendationConfig(redline.aiAnalysis.recommendation);
  const RecIcon = recConfig.icon;
  const marketConfig = getMarketPositionConfig(redline.aiAnalysis.marketPosition);
  const MarketIcon = marketConfig.icon;
  const changeType = getChangeTypeIcon(redline.type);

  return (
    <motion.div
      layout
      className={`bg-white rounded-xl border-2 overflow-hidden transition-all ${
        redline.status === 'pending' ? riskColors.border : 'border-slate-200'
      }`}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left"
      >
        <div className={`w-8 h-8 rounded-lg ${changeType.color} text-white flex items-center justify-center font-bold text-lg`}>
          {changeType.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${riskColors.bg} ${riskColors.text} capitalize`}>
              {redline.riskLevel} Risk
            </span>
            <span className="text-xs text-slate-400">{redline.section}</span>
          </div>
          <h4 className="font-medium text-slate-900">{redline.clause}</h4>
          <p className="text-sm text-slate-500 truncate">{redline.aiAnalysis.summary}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${recConfig.color}`}>
            <RecIcon className="w-4 h-4" />
            {recConfig.label}
          </div>
          <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-100"
          >
            <div className="p-4 space-y-4">
              {/* Text Comparison */}
              <div className="grid grid-cols-2 gap-4">
                {redline.originalText && (
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="text-xs font-medium text-red-600 uppercase mb-2 flex items-center gap-1">
                      <XCircle className="w-3 h-3" />
                      {redline.type === 'deletion' ? 'Removed' : 'Original'}
                    </div>
                    <p className="text-sm text-red-800 line-through">{redline.originalText}</p>
                  </div>
                )}
                {redline.proposedText && (
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-xs font-medium text-green-600 uppercase mb-2 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {redline.type === 'addition' ? 'Added' : 'Proposed'}
                    </div>
                    <p className="text-sm text-green-800">{redline.proposedText}</p>
                  </div>
                )}
              </div>

              {/* AI Analysis */}
              <div className="p-4 bg-violet-50 rounded-lg border border-violet-200">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-violet-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Lightbulb className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-medium text-violet-900">AI Analysis</span>
                      <div className={`flex items-center gap-1 text-xs ${marketConfig.color}`}>
                        <MarketIcon className="w-3 h-3" />
                        {marketConfig.label} vs Market
                      </div>
                    </div>
                    <p className="text-sm text-violet-800 mb-3">{redline.aiAnalysis.rationale}</p>
                    
                    {redline.aiAnalysis.fallbackSuggestion && (
                      <div className="p-3 bg-white rounded border border-violet-200">
                        <div className="text-xs font-medium text-violet-600 uppercase mb-1">Suggested Counter</div>
                        <p className="text-sm text-slate-700">{redline.aiAnalysis.fallbackSuggestion}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Playbook Match */}
              {redline.playbookMatch && (
                <div className="p-4 bg-violet-50 rounded-lg border border-violet-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-violet-600" />
                      <span className="text-sm font-medium text-violet-900">Playbook: {redline.playbookMatch.ruleName}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      redline.playbookMatch.deviation > 50 ? 'bg-red-100 text-red-700' : 
                      redline.playbookMatch.deviation > 25 ? 'bg-amber-100 text-amber-700' : 
                      'bg-green-100 text-green-700'
                    }`}>
                      {redline.playbookMatch.deviation}% deviation
                    </span>
                  </div>
                  <div className="text-xs text-violet-600 uppercase mb-1">Standard Language</div>
                  <p className="text-sm text-violet-800 italic">&ldquo;{redline.playbookMatch.fallbackLanguage}&rdquo;</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => onAction('accept')}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Accept
                </button>
                <button
                  onClick={() => onAction('negotiate')}
                  className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  Negotiate
                </button>
                <button
                  onClick={() => onAction('reject')}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
                <button className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const NegotiationCoPilot: React.FC = () => {
  const { isMockData } = useDataMode();
  const [redlines, setRedlines] = useState<RedlineChange[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'critical'>('all');
  const [chatMessages, setChatMessages] = useState<NegotiationMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);

  // Fetch redline changes from API or use mock data based on mode
  useEffect(() => {
    async function fetchRedlines() {
      // If in demo mode, always use mock data
      if (isMockData) {
        setRedlines(mockRedlines);
        setLoading(false);
        return;
      }
      
      try {
        const res = await fetch('/api/intelligence/negotiate');
        const json = await res.json();
        if (json.success && json.data?.redlines?.length > 0) {
          setRedlines(json.data.redlines);
        } else {
          setRedlines(mockRedlines);
        }
      } catch {
        setRedlines(mockRedlines);
      } finally {
        setLoading(false);
      }
    }
    fetchRedlines();
  }, [isMockData]);

  // Filter redlines
  const filteredRedlines = useMemo(() => {
    return redlines.filter(r => {
      if (filter === 'pending') return r.status === 'pending';
      if (filter === 'critical') return r.riskLevel === 'critical' || r.riskLevel === 'high';
      return true;
    });
  }, [redlines, filter]);

  // Stats
  const stats = useMemo(() => ({
    total: redlines.length,
    pending: redlines.filter(r => r.status === 'pending').length,
    critical: redlines.filter(r => r.riskLevel === 'critical').length,
    high: redlines.filter(r => r.riskLevel === 'high').length,
    accepted: redlines.filter(r => r.status === 'accepted').length,
    rejected: redlines.filter(r => r.status === 'rejected').length,
  }), [redlines]);

  // Handle action
  const handleAction = (id: string, action: 'accept' | 'reject' | 'negotiate') => {
    setRedlines(prev => prev.map(r => 
      r.id === id ? { ...r, status: action === 'negotiate' ? 'negotiating' : action === 'accept' ? 'accepted' : 'rejected' } : r
    ));
  };

  // Handle chat with real AI API
  const handleChatSubmit = async () => {
    if (!chatInput.trim() || chatLoading) return;
    
    const userMsg: NegotiationMessage = {
      id: `m-${Date.now()}`,
      role: 'user',
      content: chatInput,
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    // Add loading placeholder
    const loadingId = `m-${Date.now()}-loading`;
    setChatMessages(prev => [...prev, {
      id: loadingId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      loading: true,
    }]);

    try {
      // Get context from current redlines
      const redlineContext = redlines.slice(0, 3).map(r => 
        `${r.clause} (${r.riskLevel} risk): ${r.aiAnalysis.summary}`
      ).join('\n');

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: chatInput,
          context: 'negotiation',
          systemPrompt: `You are an expert contract negotiation assistant. You help analyze contract clauses, suggest counter-proposals, and provide negotiation strategies.

Current redline changes being reviewed:
${redlineContext}

Provide concise, actionable advice. Include specific language suggestions when helpful.`,
          conversationHistory: chatMessages.slice(-8).map(m => ({
            role: m.role,
            content: m.content
          })),
          useMock: false,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      
      // Generate suggestions based on the response
      const suggestions = generateNegotiationSuggestions(chatInput, data.message);

      const aiMsg: NegotiationMessage = {
        id: `m-${Date.now()}-ai`,
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        suggestions,
      };

      // Replace loading message with actual response
      setChatMessages(prev => prev.filter(m => m.id !== loadingId).concat(aiMsg));
    } catch {
      // Replace loading with error message
      setChatMessages(prev => prev.filter(m => m.id !== loadingId).concat({
        id: `m-${Date.now()}-error`,
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.',
        timestamp: new Date(),
      }));
    } finally {
      setChatLoading(false);
    }
  };

  // Generate contextual suggestions based on AI response
  const generateNegotiationSuggestions = (query: string, response: string): string[] => {
    const lower = query.toLowerCase();
    
    if (lower.includes('liability') || lower.includes('cap')) {
      return [
        'Add liability cap of 2x annual fees',
        'Include carve-outs for gross negligence',
        'Specify insurance requirements'
      ];
    }
    if (lower.includes('termination') || lower.includes('notice')) {
      return [
        'Propose mutual termination rights',
        'Add cure period for breaches',
        'Include transition assistance'
      ];
    }
    if (lower.includes('indemnif')) {
      return [
        'Make indemnification mutual',
        'Add IP infringement carve-outs',
        'Limit to direct damages'
      ];
    }
    return [
      'Review market standards',
      'Request precedent analysis',
      'Draft counter-proposal'
    ];
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-600">Loading negotiation data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="flex-none p-6 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-violet-500" />
              Negotiation Co-Pilot
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              AI-powered redline analysis with playbook matching and counter-proposal suggestions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Playbook
            </button>
            <button
              onClick={() => setShowChat(!showChat)}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                showChat ? 'bg-violet-100 text-violet-700' : 'bg-violet-500 text-white hover:bg-violet-600'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              AI Chat
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-6 gap-4">
          <div className="p-3 bg-slate-50 rounded-lg text-center">
            <div className="text-xl font-bold text-slate-900">{stats.total}</div>
            <div className="text-xs text-slate-500">Total Changes</div>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg text-center">
            <div className="text-xl font-bold text-amber-600">{stats.pending}</div>
            <div className="text-xs text-amber-600">Pending Review</div>
          </div>
          <div className="p-3 bg-red-50 rounded-lg text-center">
            <div className="text-xl font-bold text-red-600">{stats.critical}</div>
            <div className="text-xs text-red-600">Critical</div>
          </div>
          <div className="p-3 bg-orange-50 rounded-lg text-center">
            <div className="text-xl font-bold text-orange-600">{stats.high}</div>
            <div className="text-xs text-orange-600">High Risk</div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg text-center">
            <div className="text-xl font-bold text-green-600">{stats.accepted}</div>
            <div className="text-xs text-green-600">Accepted</div>
          </div>
          <div className="p-3 bg-slate-100 rounded-lg text-center">
            <div className="text-xl font-bold text-slate-600">{stats.rejected}</div>
            <div className="text-xs text-slate-600">Rejected</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Redlines List */}
        <div className={`flex-1 overflow-y-auto p-6 transition-all ${showChat ? 'mr-96' : ''}`}>
          {/* Filter Tabs */}
          <div className="flex items-center gap-2 mb-4">
            {(['all', 'pending', 'critical'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                  filter === f
                    ? 'bg-violet-500 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {f} {f === 'all' && `(${stats.total})`}
                {f === 'pending' && `(${stats.pending})`}
                {f === 'critical' && `(${stats.critical + stats.high})`}
              </button>
            ))}
          </div>

          {/* Redline Cards */}
          <div className="space-y-4">
            {filteredRedlines.map(redline => (
              <RedlineCard
                key={redline.id}
                redline={redline}
                isExpanded={expandedId === redline.id}
                onToggle={() => setExpandedId(expandedId === redline.id ? null : redline.id)}
                onAction={(action) => handleAction(redline.id, action)}
              />
            ))}
          </div>
        </div>

        {/* Chat Panel */}
        <AnimatePresence>
          {showChat && (
            <motion.div key="chat"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 384, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="fixed right-0 top-0 h-full w-96 bg-white border-l border-slate-200 flex flex-col z-30"
            >
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-violet-500" />
                  <span className="font-medium text-slate-900">AI Negotiation Assistant</span>
                </div>
                <button onClick={() => setShowChat(false)} className="p-1 hover:bg-slate-100 rounded">
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <MessageSquare className="w-6 h-6 text-violet-500" />
                    </div>
                    <h4 className="font-medium text-slate-900 mb-1">Ask me anything</h4>
                    <p className="text-sm text-slate-500">I can help with counter-proposals, risk analysis, and negotiation strategy</p>
                  </div>
                ) : (
                  chatMessages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        msg.role === 'user' ? 'bg-violet-500 text-white' : 'bg-slate-100 text-slate-900'
                      }`}>
                        {msg.loading ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                            <span className="text-sm text-slate-500">Analyzing...</span>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            {msg.suggestions && (
                              <div className="mt-2 space-y-1">
                                {msg.suggestions.map((s, i) => (
                                  <button 
                                    key={i} 
                                    onClick={() => setChatInput(s)}
                                    className="block text-xs text-violet-600 hover:underline"
                                  >
                                    → {s}
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleChatSubmit()}
                    placeholder="Ask about clauses, suggest counters..."
                    disabled={chatLoading}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
                  />
                  <button
                    onClick={handleChatSubmit}
                    disabled={chatLoading || !chatInput.trim()}
                    className="p-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {chatLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default NegotiationCoPilot;
