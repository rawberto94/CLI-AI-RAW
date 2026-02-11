'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Info,
  Zap,
  RefreshCw,
  Calendar,
  DollarSign,
  Users,
  Eye,
  ArrowUpRight,
  BarChart3,
  Target,
  AlertCircle,
  Edit3,
  Building2,
  Loader2,
  Heart,
  Sparkles,
  PieChart,
  ArrowRight,
  Filter,
  Search,
  Download,
  Settings2,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import { useDataMode } from '@/contexts/DataModeContext';
import { Input } from '@/components/ui/input';

// ============================================================================
// Types
// ============================================================================

interface HealthFactor {
  id: string;
  name: string;
  category: 'risk' | 'compliance' | 'financial' | 'operational' | 'relationship';
  weight: number;
  score: number; // 0-100
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  trend: 'improving' | 'stable' | 'declining';
  details: string;
  recommendations?: string[];
  lastUpdated: string;
}

interface ContractHealth {
  contractId: string;
  contractName: string;
  supplierName: string;
  overallScore: number;
  previousScore: number;
  trend: 'improving' | 'stable' | 'declining';
  status: 'healthy' | 'at-risk' | 'critical';
  factors: HealthFactor[];
  lastAssessed: string;
  nextReview: string;
  actionItems: ActionItem[];
}

interface ActionItem {
  id: string;
  type: 'urgent' | 'recommended' | 'optional';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  dueDate?: string;
}

// ============================================================================
// Mock Data
// ============================================================================

const mockHealthData: ContractHealth[] = [
  {
    contractId: 'c1',
    contractName: 'Master Agreement - Acme Corp',
    supplierName: 'Acme Corporation',
    overallScore: 78,
    previousScore: 72,
    trend: 'improving',
    status: 'healthy',
    lastAssessed: '2024-03-15',
    nextReview: '2024-06-15',
    factors: [
      {
        id: 'f1',
        name: 'Risk Exposure',
        category: 'risk',
        weight: 25,
        score: 72,
        status: 'warning',
        trend: 'improving',
        details: '2 medium-risk clauses identified. Liability cap below market standard.',
        recommendations: ['Negotiate higher liability cap at renewal', 'Add cyber incident clause'],
        lastUpdated: '2024-03-15',
      },
      {
        id: 'f2',
        name: 'Compliance Status',
        category: 'compliance',
        weight: 20,
        score: 95,
        status: 'healthy',
        trend: 'stable',
        details: 'All regulatory requirements met. SOC2 Type II certification current.',
        lastUpdated: '2024-03-10',
      },
      {
        id: 'f3',
        name: 'Financial Health',
        category: 'financial',
        weight: 20,
        score: 85,
        status: 'healthy',
        trend: 'stable',
        details: 'Payment terms favorable. 3.2% below market rate. Strong price protections.',
        lastUpdated: '2024-03-12',
      },
      {
        id: 'f4',
        name: 'Operational Performance',
        category: 'operational',
        weight: 20,
        score: 68,
        status: 'warning',
        trend: 'declining',
        details: 'SLA compliance at 97.2% (target: 99%). 3 incidents in last quarter.',
        recommendations: ['Schedule performance review meeting', 'Implement monitoring dashboard'],
        lastUpdated: '2024-03-14',
      },
      {
        id: 'f5',
        name: 'Relationship Quality',
        category: 'relationship',
        weight: 15,
        score: 82,
        status: 'healthy',
        trend: 'improving',
        details: 'Strong executive sponsorship. Regular QBRs conducted. NPS: 72.',
        lastUpdated: '2024-03-01',
      },
    ],
    actionItems: [
      {
        id: 'a1',
        type: 'recommended',
        title: 'Review liability clause',
        description: 'Current liability cap is 15% below industry benchmark',
        impact: 'high',
        effort: 'medium',
        dueDate: '2024-06-01',
      },
      {
        id: 'a2',
        type: 'urgent',
        title: 'Address SLA degradation',
        description: 'Performance has declined 2.1% over last quarter',
        impact: 'high',
        effort: 'low',
        dueDate: '2024-03-30',
      },
    ],
  },
  {
    contractId: 'c2',
    contractName: 'SLA - Cloud Services',
    supplierName: 'Acme Corporation',
    overallScore: 62,
    previousScore: 68,
    trend: 'declining',
    status: 'at-risk',
    lastAssessed: '2024-03-14',
    nextReview: '2024-04-14',
    factors: [
      {
        id: 'f6',
        name: 'Risk Exposure',
        category: 'risk',
        weight: 25,
        score: 45,
        status: 'critical',
        trend: 'declining',
        details: 'High-risk SLA penalty clause. Unlimited liability exposure for data breaches.',
        recommendations: ['Negotiate liability cap immediately', 'Add force majeure protections', 'Review insurance coverage'],
        lastUpdated: '2024-03-14',
      },
      {
        id: 'f7',
        name: 'Compliance Status',
        category: 'compliance',
        weight: 20,
        score: 88,
        status: 'healthy',
        trend: 'stable',
        details: 'GDPR compliant. ISO 27001 certified.',
        lastUpdated: '2024-03-10',
      },
      {
        id: 'f8',
        name: 'Financial Health',
        category: 'financial',
        weight: 20,
        score: 55,
        status: 'warning',
        trend: 'declining',
        details: 'Cost overruns of 12% vs budget. Price escalation clause triggered.',
        recommendations: ['Analyze usage patterns', 'Consider rightsizing'],
        lastUpdated: '2024-03-12',
      },
      {
        id: 'f9',
        name: 'Operational Performance',
        category: 'operational',
        weight: 20,
        score: 72,
        status: 'warning',
        trend: 'stable',
        details: 'Uptime at 99.1% (target: 99.9%). Latency issues in APAC region.',
        lastUpdated: '2024-03-14',
      },
      {
        id: 'f10',
        name: 'Relationship Quality',
        category: 'relationship',
        weight: 15,
        score: 65,
        status: 'warning',
        trend: 'declining',
        details: 'Escalation required twice this quarter. Response times slow.',
        recommendations: ['Escalate to executive sponsor', 'Request dedicated account manager'],
        lastUpdated: '2024-03-01',
      },
    ],
    actionItems: [
      {
        id: 'a3',
        type: 'urgent',
        title: 'Cap liability exposure',
        description: 'Unlimited liability for data breaches poses significant risk',
        impact: 'high',
        effort: 'high',
        dueDate: '2024-03-25',
      },
      {
        id: 'a4',
        type: 'urgent',
        title: 'Address cost overruns',
        description: '12% over budget - review and optimize usage',
        impact: 'high',
        effort: 'medium',
        dueDate: '2024-03-28',
      },
      {
        id: 'a5',
        type: 'recommended',
        title: 'Request account manager change',
        description: 'Current support responsiveness below expectations',
        impact: 'medium',
        effort: 'low',
      },
    ],
  },
  {
    contractId: 'c3',
    contractName: 'Procurement Agreement - GlobalSupply',
    supplierName: 'GlobalSupply Ltd',
    overallScore: 42,
    previousScore: 55,
    trend: 'declining',
    status: 'critical',
    lastAssessed: '2024-03-14',
    nextReview: '2024-03-21',
    factors: [
      {
        id: 'f11',
        name: 'Risk Exposure',
        category: 'risk',
        weight: 25,
        score: 35,
        status: 'critical',
        trend: 'declining',
        details: 'Auto-renewal trap identified. 90-day notice required. IP assignment unclear.',
        recommendations: ['Send termination notice before deadline', 'Engage legal for IP review'],
        lastUpdated: '2024-03-14',
      },
      {
        id: 'f12',
        name: 'Compliance Status',
        category: 'compliance',
        weight: 20,
        score: 52,
        status: 'warning',
        trend: 'declining',
        details: 'Missing updated certificates. Audit rights clause too restrictive.',
        recommendations: ['Request current compliance certificates', 'Negotiate broader audit rights'],
        lastUpdated: '2024-03-10',
      },
      {
        id: 'f13',
        name: 'Financial Health',
        category: 'financial',
        weight: 20,
        score: 38,
        status: 'critical',
        trend: 'declining',
        details: '22% above market rate. No price protection. Annual escalator at 8%.',
        recommendations: ['Benchmark pricing immediately', 'Prepare RFP for alternatives'],
        lastUpdated: '2024-03-12',
      },
      {
        id: 'f14',
        name: 'Operational Performance',
        category: 'operational',
        weight: 20,
        score: 45,
        status: 'critical',
        trend: 'declining',
        details: 'Delivery delays: 35% of orders late. Quality issues: 8 NCRs filed.',
        recommendations: ['Implement supplier scorecard', 'Consider dual-sourcing'],
        lastUpdated: '2024-03-14',
      },
      {
        id: 'f15',
        name: 'Relationship Quality',
        category: 'relationship',
        weight: 15,
        score: 40,
        status: 'critical',
        trend: 'declining',
        details: 'No executive engagement. Disputes pending resolution. Trust eroded.',
        recommendations: ['Schedule executive alignment meeting', 'Consider mediation'],
        lastUpdated: '2024-03-01',
      },
    ],
    actionItems: [
      {
        id: 'a6',
        type: 'urgent',
        title: 'Send termination notice',
        description: 'Auto-renewal deadline in 45 days - decision required immediately',
        impact: 'high',
        effort: 'low',
        dueDate: '2024-03-20',
      },
      {
        id: 'a7',
        type: 'urgent',
        title: 'Begin supplier replacement RFP',
        description: 'Performance issues warrant exploring alternatives',
        impact: 'high',
        effort: 'high',
        dueDate: '2024-03-25',
      },
      {
        id: 'a8',
        type: 'urgent',
        title: 'Request compliance documentation',
        description: 'Certifications expired or missing',
        impact: 'medium',
        effort: 'low',
        dueDate: '2024-03-18',
      },
    ],
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

const getScoreColor = (score: number) => {
  if (score >= 80) return { 
    bg: 'bg-violet-500', 
    text: 'text-violet-600', 
    light: 'bg-violet-50',
    gradient: 'from-violet-500 to-violet-500',
    ring: 'ring-violet-500/20',
    border: 'border-violet-200',
  };
  if (score >= 60) return { 
    bg: 'bg-amber-500', 
    text: 'text-amber-600', 
    light: 'bg-amber-50',
    gradient: 'from-amber-500 to-orange-500',
    ring: 'ring-amber-500/20',
    border: 'border-amber-200',
  };
  return { 
    bg: 'bg-rose-500', 
    text: 'text-rose-600', 
    light: 'bg-rose-50',
    gradient: 'from-rose-500 to-red-500',
    ring: 'ring-rose-500/20',
    border: 'border-rose-200',
  };
};

const getStatusBadge = (status: ContractHealth['status']) => {
  switch (status) {
    case 'healthy':
      return { icon: CheckCircle2, color: 'bg-violet-100 text-violet-700 border-violet-200', label: 'Healthy', dotColor: 'bg-violet-500' };
    case 'at-risk':
      return { icon: AlertTriangle, color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'At Risk', dotColor: 'bg-amber-500' };
    case 'critical':
      return { icon: XCircle, color: 'bg-rose-100 text-rose-700 border-rose-200', label: 'Critical', dotColor: 'bg-rose-500' };
  }
};

const getTrendIcon = (trend: 'improving' | 'stable' | 'declining') => {
  switch (trend) {
    case 'improving':
      return { icon: TrendingUp, color: 'text-violet-500', bg: 'bg-violet-50', label: 'Improving' };
    case 'stable':
      return { icon: Minus, color: 'text-slate-400', bg: 'bg-slate-50', label: 'Stable' };
    case 'declining':
      return { icon: TrendingDown, color: 'text-rose-500', bg: 'bg-rose-50', label: 'Declining' };
  }
};

const getCategoryIcon = (category: HealthFactor['category']) => {
  switch (category) {
    case 'risk': return AlertTriangle;
    case 'compliance': return Shield;
    case 'financial': return DollarSign;
    case 'operational': return Activity;
    case 'relationship': return Users;
  }
};

const getCategoryColor = (category: HealthFactor['category']) => {
  switch (category) {
    case 'risk': return 'text-rose-500 bg-rose-50';
    case 'compliance': return 'text-violet-500 bg-violet-50';
    case 'financial': return 'text-violet-500 bg-violet-50';
    case 'operational': return 'text-violet-500 bg-violet-50';
    case 'relationship': return 'text-amber-500 bg-amber-50';
  }
};

// ============================================================================
// Score Ring Component
// ============================================================================

interface ScoreRingProps {
  score: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
  previousScore?: number;
  showGlow?: boolean;
}

const ScoreRing: React.FC<ScoreRingProps> = ({ score, size = 'md', showLabel = true, previousScore, showGlow = false }) => {
  const sizes = {
    sm: { ring: 52, stroke: 5, text: 'text-sm', label: 'text-[10px]' },
    md: { ring: 88, stroke: 7, text: 'text-2xl', label: 'text-xs' },
    lg: { ring: 130, stroke: 9, text: 'text-4xl', label: 'text-sm' },
    xl: { ring: 160, stroke: 10, text: 'text-5xl', label: 'text-base' },
  };

  const { ring, stroke, text, label: labelSize } = sizes[size];
  const radius = (ring - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const colors = getScoreColor(score);
  const change = previousScore ? score - previousScore : 0;

  return (
    <div className={`relative inline-flex items-center justify-center ${showGlow ? `ring-8 ${colors.ring} rounded-full` : ''}`}>
      <svg width={ring} height={ring} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={ring / 2}
          cy={ring / 2}
          r={radius}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth={stroke}
          className="opacity-50"
        />
        {/* Progress arc with gradient */}
        <defs>
          <linearGradient id={`scoreGradient-${score}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" className={colors.text} stopColor="currentColor" />
            <stop offset="100%" className={colors.text} stopColor="currentColor" stopOpacity="0.7" />
          </linearGradient>
        </defs>
        <motion.circle
          cx={ring / 2}
          cy={ring / 2}
          r={radius}
          fill="none"
          stroke={`url(#scoreGradient-${score})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
          className={colors.text}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span 
            className={`font-bold ${text} ${colors.text}`}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            {score}
          </motion.span>
          {previousScore !== undefined && change !== 0 && (
            <motion.span 
              className={`${labelSize} font-semibold flex items-center gap-0.5 ${change > 0 ? 'text-violet-500' : 'text-rose-500'}`}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              {change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {change > 0 ? '+' : ''}{change}
            </motion.span>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Health Factor Card
// ============================================================================

interface HealthFactorCardProps {
  factor: HealthFactor;
  expanded: boolean;
  onToggle: () => void;
  onRefresh?: () => void;
}

const HealthFactorCard: React.FC<HealthFactorCardProps> = ({ factor, expanded, onToggle, onRefresh }) => {
  const Icon = getCategoryIcon(factor.category);
  const colors = getScoreColor(factor.score);
  const trend = getTrendIcon(factor.trend);
  const TrendIcon = trend.icon;
  const categoryColor = getCategoryColor(factor.category);

  return (
    <motion.div
      layout
      className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
    >
      <button
        onClick={onToggle}
        className="w-full p-5 flex items-center gap-4 hover:bg-slate-50/50 transition-colors"
      >
        <div className={`w-12 h-12 rounded-xl ${categoryColor} flex items-center justify-center shadow-sm`}>
          <Icon className="w-6 h-6" />
        </div>
        
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-slate-900">{factor.name}</span>
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{factor.weight}% weight</span>
          </div>
          <p className="text-sm text-slate-500 line-clamp-1">{factor.details}</p>
        </div>

        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${trend.bg}`}>
            <TrendIcon className={`w-3.5 h-3.5 ${trend.color}`} />
            <span className={`text-xs font-medium ${trend.color}`}>{trend.label}</span>
          </div>
          <ScoreRing score={factor.score} size="sm" showLabel={true} />
          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-slate-100"
          >
            <div className="p-5 space-y-4 bg-gradient-to-b from-slate-50/50 to-white">
              <p className="text-sm text-slate-600 leading-relaxed">{factor.details}</p>
              
              {factor.recommendations && factor.recommendations.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    AI Recommendations
                  </h4>
                  <div className="space-y-2">
                    {factor.recommendations.map((rec, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-200/60 hover:border-violet-200 transition-colors group">
                        <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-violet-500 transition-colors">
                          <ArrowRight className="w-3.5 h-3.5 text-violet-600 group-hover:text-white transition-colors" />
                        </div>
                        <span className="text-sm text-slate-700">{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Last updated: {factor.lastUpdated}
                </span>
                <button 
                  onClick={(e) => { e.stopPropagation(); onRefresh?.(); }} 
                  className="text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1.5 text-sm hover:bg-violet-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh Analysis
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
// Action Item Card
// ============================================================================

interface ActionItemCardProps {
  item: ActionItem;
}

const ActionItemCard: React.FC<ActionItemCardProps> = ({ item }) => {
  const [showActions, setShowActions] = useState(false);
  
  const typeStyles = {
    urgent: { 
      bg: 'bg-gradient-to-br from-rose-50 to-red-50 border-rose-200/80', 
      icon: AlertCircle, 
      iconColor: 'text-rose-500 bg-rose-100', 
      badge: 'bg-rose-100 text-rose-700 border border-rose-200',
      glow: 'shadow-rose-100',
    },
    recommended: { 
      bg: 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/80', 
      icon: AlertTriangle, 
      iconColor: 'text-amber-500 bg-amber-100', 
      badge: 'bg-amber-100 text-amber-700 border border-amber-200',
      glow: 'shadow-amber-100',
    },
    optional: { 
      bg: 'bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200/80', 
      icon: Info, 
      iconColor: 'text-violet-500 bg-violet-100', 
      badge: 'bg-violet-100 text-violet-700 border border-violet-200',
      glow: 'shadow-violet-100',
    },
  };

  const style = typeStyles[item.type];
  const Icon = style.icon;
  
  // Determine which module actions to show based on action title
  const getActionLinks = () => {
    const links = [];
    const title = item.title.toLowerCase();
    
    if (title.includes('renewal') || title.includes('termination')) {
      links.push({ href: '/renewals', label: 'Manage Renewal', icon: Calendar });
    }
    if (title.includes('liability') || title.includes('clause') || title.includes('policy')) {
      links.push({ href: '/governance', label: 'Review Policies', icon: Shield });
    }
    if (title.includes('approval') || title.includes('decision')) {
      links.push({ href: '/approvals', label: 'Request Approval', icon: CheckCircle2 });
    }
    if (title.includes('sla') || title.includes('performance')) {
      links.push({ href: '/drafting', label: 'Edit Contract', icon: Edit3 });
    }
    if (title.includes('supplier') || title.includes('vendor')) {
      links.push({ href: '/portal', label: 'Contact Supplier', icon: Building2 });
    }
    
    // Always add a fallback if no specific links matched
    if (links.length === 0) {
      links.push({ href: '/approvals', label: 'Request Approval', icon: CheckCircle2 });
    }
    
    return links;
  };

  return (
    <motion.div 
      className={`p-5 rounded-xl border ${style.bg} shadow-sm ${style.glow}`}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-xl ${style.iconColor} flex items-center justify-center flex-shrink-0 shadow-sm`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${style.badge} capitalize`}>
              {item.type}
            </span>
            {item.dueDate && (
              <span className="text-xs text-slate-500 flex items-center gap-1.5 bg-white/60 px-2 py-1 rounded-lg">
                <Clock className="w-3.5 h-3.5" />
                Due: {item.dueDate}
              </span>
            )}
          </div>
          <h4 className="font-semibold text-slate-900 text-base">{item.title}</h4>
          <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{item.description}</p>
          <div className="flex items-center gap-4 mt-3">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Target className="w-3.5 h-3.5" />
              Impact: <span className="font-semibold capitalize text-slate-700">{item.impact}</span>
            </span>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              Effort: <span className="font-semibold capitalize text-slate-700">{item.effort}</span>
            </span>
          </div>
          
          {/* Cross-Module Actions */}
          <AnimatePresence>
            {showActions && (
              <motion.div key="actions"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-4 pt-4 border-t border-slate-200/50 overflow-hidden"
              >
                <p className="text-xs font-medium text-slate-500 mb-3 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                  Quick Actions
                </p>
                <div className="flex flex-wrap gap-2">
                  {getActionLinks().map((link, linkIndex) => {
                    const LinkIcon = link.icon;
                    return (
                      <Link
                        key={`${link.label}-${linkIndex}`}
                        href={link.href}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-violet-50 hover:border-violet-300 hover:text-violet-700 transition-all shadow-sm"
                      >
                        <LinkIcon className="w-4 h-4" />
                        {link.label}
                        <ExternalLink className="w-3 h-3 opacity-50" />
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button 
          onClick={() => setShowActions(!showActions)}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all shadow-sm ${
            showActions 
              ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-violet-200' 
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
          }`}
        >
          {showActions ? 'Close' : 'Take Action'}
        </button>
      </div>
    </motion.div>
  );
};

// ============================================================================
// Contract Health Card
// ============================================================================

interface ContractHealthCardProps {
  health: ContractHealth;
  onSelect: () => void;
  isSelected: boolean;
}

const ContractHealthCard: React.FC<ContractHealthCardProps> = ({ health, onSelect, isSelected }) => {
  const statusBadge = getStatusBadge(health.status);
  const StatusIcon = statusBadge.icon;
  const trend = getTrendIcon(health.trend);
  const TrendIcon = trend.icon;
  const colors = getScoreColor(health.overallScore);
  const urgentCount = health.actionItems.filter(a => a.type === 'urgent').length;

  return (
    <motion.div
      whileHover={{ scale: 1.01, y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={onSelect}
      className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'border-violet-500 bg-gradient-to-br from-violet-50 to-purple-50/50 shadow-lg shadow-violet-100/50 ring-4 ring-violet-100'
          : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-lg hover:shadow-slate-100/50'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="relative">
          <ScoreRing score={health.overallScore} size="md" previousScore={health.previousScore} />
          {/* Status indicator dot */}
          <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${statusBadge.dotColor} border-2 border-white flex items-center justify-center`}>
            <StatusIcon className="w-3 h-3 text-white" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 border ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${trend.bg}`}>
              <TrendIcon className={`w-3 h-3 ${trend.color}`} />
              <span className={`text-xs font-medium ${trend.color}`}>{trend.label}</span>
            </div>
          </div>
          <h3 className="font-semibold text-slate-900 truncate text-base">{health.contractName}</h3>
          <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
            <Building2 className="w-3.5 h-3.5" />
            {health.supplierName}
          </p>
        </div>

        <div className="text-right flex flex-col items-end gap-2">
          <div className="text-xs text-slate-400 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {health.nextReview}
          </div>
          {urgentCount > 0 && (
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="px-2.5 py-1 bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold flex items-center gap-1 border border-rose-200"
            >
              <AlertCircle className="w-3 h-3" />
              {urgentCount} Urgent
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const ContractHealthScore: React.FC = () => {
  const { isMockData } = useDataMode();
  const [healthData, setHealthData] = useState<ContractHealth[]>([]);
  const [selectedContract, setSelectedContract] = useState<ContractHealth | null>(null);
  const [expandedFactors, setExpandedFactors] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'overview' | 'factors' | 'actions'>('overview');
  const [loading, setLoading] = useState(true);

  // Fetch health data from API or use mock data based on mode
  useEffect(() => {
    async function fetchHealthData() {
      // If in demo mode, always use mock data
      if (isMockData) {
        setHealthData(mockHealthData);
        setSelectedContract(mockHealthData[0] ?? null);
        setLoading(false);
        return;
      }
      
      try {
        const res = await fetch('/api/intelligence/health');
        const json = await res.json();
        if (json.success && json.data?.contracts?.length > 0) {
          const mapped = json.data.contracts.map((item: any) => ({
            contractId: item.id || item.contractId,
            contractName: item.contractName || item.name || 'Unknown Contract',
            supplierName: item.counterparty || item.vendor || 'Unknown',
            overallScore: item.healthScore || item.overallScore || 75,
            previousScore: item.previousScore || item.healthScore - 5 || 70,
            trend: item.trend || 'stable',
            status: item.healthScore >= 70 ? 'healthy' : item.healthScore >= 50 ? 'at-risk' : 'critical',
            factors: Array.isArray(item.factors) ? item.factors : [],
            lastAssessed: item.lastAssessed || new Date().toISOString(),
            nextReview: item.nextReview || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
            actionItems: Array.isArray(item.actionItems) ? item.actionItems : [],
          }));
          setHealthData(mapped);
          setSelectedContract(mapped[0] ?? null);
        } else {
          setHealthData(mockHealthData);
          setSelectedContract(mockHealthData[0] ?? null);
        }
      } catch {
        setHealthData(mockHealthData);
        setSelectedContract(mockHealthData[0] ?? null);
      } finally {
        setLoading(false);
      }
    }
    fetchHealthData();
  }, [isMockData]);

  const toggleFactor = (factorId: string) => {
    setExpandedFactors(prev => {
      const next = new Set(prev);
      if (next.has(factorId)) next.delete(factorId);
      else next.add(factorId);
      return next;
    });
  };

  // Portfolio Stats
  const portfolioStats = useMemo(() => {
    if (healthData.length === 0) return { total: 0, avgScore: 0, healthy: 0, atRisk: 0, critical: 0, urgentActions: 0 };
    const total = healthData.length;
    const avgScore = Math.round(healthData.reduce((sum, h) => sum + h.overallScore, 0) / total);
    const healthy = healthData.filter(h => h.status === 'healthy').length;
    const atRisk = healthData.filter(h => h.status === 'at-risk').length;
    const critical = healthData.filter(h => h.status === 'critical').length;
    const urgentActions = healthData.reduce((sum, h) => sum + (Array.isArray(h.actionItems) ? h.actionItems : []).filter(a => a.type === 'urgent').length, 0);

    return { total, avgScore, healthy, atRisk, critical, urgentActions };
  }, [healthData]);

  const router = useRouter();

  // Handle refresh all health scores
  const handleRefreshAll = useCallback(async () => {
    setLoading(true);
    toast.info('Refreshing all health scores...');
    try {
      const res = await fetch('/api/intelligence/health/refresh', { method: 'POST' });
      if (res.ok) {
        toast.success('All health scores refreshed');
        // Refetch data after refresh
        window.location.reload();
      } else {
        throw new Error('Failed to refresh');
      }
    } catch {
      toast.error('Failed to refresh health scores');
      setLoading(false);
    }
  }, []);

  // Handle export report
  const handleExportReport = useCallback(() => {
    try {
      const csvContent = [
        ['Contract Name', 'Supplier', 'Overall Score', 'Status', 'Trend', 'Last Assessed', 'Next Review'].join(','),
        ...healthData.map(h => [
          h.contractName,
          h.supplierName,
          h.overallScore,
          h.status,
          h.trend,
          h.lastAssessed,
          h.nextReview,
        ].join(','))
      ].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `contract-health-report-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      toast.success('Health report exported successfully');
    } catch {
      toast.error('Failed to export report');
    }
  }, [healthData]);

  // Handle view contract
  const handleViewContract = useCallback((contractId: string) => {
    router.push(`/contracts/${contractId}`);
  }, [router]);

  // Handle reassess contract
  const handleReassess = useCallback(async (contractId: string, contractName: string) => {
    toast.info(`Reassessing ${contractName}...`);
    try {
      const res = await fetch(`/api/intelligence/health/${contractId}/reassess`, { method: 'POST' });
      if (res.ok) {
        toast.success(`${contractName} reassessment complete`);
      } else {
        throw new Error('Failed to reassess');
      }
    } catch {
      toast.error('Failed to reassess contract');
    }
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/40">
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-200">
              <Heart className="w-8 h-8 text-white animate-pulse" />
            </div>
            <motion.div 
              className="absolute -inset-2 rounded-3xl border-2 border-violet-300 opacity-50"
              animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.2, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
          <p className="text-slate-600 font-medium">Analyzing contract health...</p>
          <p className="text-sm text-slate-400 mt-1">This may take a moment</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-purple-50/20 to-purple-50/30">
      {/* Header */}
      <div className="flex-none px-6 py-5 bg-white/80 backdrop-blur-sm border-b border-slate-200/60">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-200/50">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                Contract Health Dashboard
                <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-xs font-semibold rounded-full">
                  AI-Powered
                </span>
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Monitor and optimize contract performance across your entire portfolio
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Search contracts..." 
                className="pl-10 w-64 bg-white/80"
              />
            </div>
            <button 
              onClick={handleRefreshAll} 
              className="px-4 py-2.5 text-sm font-semibold bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2 shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh All
            </button>
            <button 
              onClick={handleExportReport} 
              className="px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all flex items-center gap-2 shadow-lg shadow-violet-200/50"
            >
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>
        </div>

        {/* Portfolio Stats - Enhanced */}
        <div className="grid grid-cols-6 gap-4">
          <motion.div 
            className="p-4 bg-gradient-to-br from-slate-50 to-slate-100/80 rounded-xl border border-slate-200/60 relative overflow-hidden"
            whileHover={{ scale: 1.02 }}
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-slate-200/30 rounded-full -mr-4 -mt-4" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center">
                <PieChart className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{portfolioStats.avgScore}</div>
                <div className="text-xs text-slate-500 font-medium">Avg Health Score</div>
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            className="p-4 bg-gradient-to-br from-violet-50 to-purple-50/80 rounded-xl border border-violet-200/60 relative overflow-hidden"
            whileHover={{ scale: 1.02 }}
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-violet-200/30 rounded-full -mr-4 -mt-4" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-violet-700">{portfolioStats.total}</div>
                <div className="text-xs text-violet-600 font-medium">Total Contracts</div>
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            className="p-4 bg-gradient-to-br from-violet-50 to-violet-50/80 rounded-xl border border-violet-200/60 relative overflow-hidden"
            whileHover={{ scale: 1.02 }}
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-violet-200/30 rounded-full -mr-4 -mt-4" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-violet-700">{portfolioStats.healthy}</div>
                <div className="text-xs text-violet-600 font-medium">Healthy</div>
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            className="p-4 bg-gradient-to-br from-amber-50 to-orange-50/80 rounded-xl border border-amber-200/60 relative overflow-hidden"
            whileHover={{ scale: 1.02 }}
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-amber-200/30 rounded-full -mr-4 -mt-4" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-700">{portfolioStats.atRisk}</div>
                <div className="text-xs text-amber-600 font-medium">At Risk</div>
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            className="p-4 bg-gradient-to-br from-rose-50 to-red-50/80 rounded-xl border border-rose-200/60 relative overflow-hidden"
            whileHover={{ scale: 1.02 }}
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-rose-200/30 rounded-full -mr-4 -mt-4" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-rose-700">{portfolioStats.critical}</div>
                <div className="text-xs text-rose-600 font-medium">Critical</div>
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            className="p-4 bg-gradient-to-br from-rose-50 to-red-50/80 rounded-xl border-2 border-rose-300 relative overflow-hidden shadow-lg shadow-rose-100/50"
            whileHover={{ scale: 1.02 }}
            animate={{ borderColor: portfolioStats.urgentActions > 0 ? ['rgb(253, 164, 175)', 'rgb(251, 113, 133)', 'rgb(253, 164, 175)'] : 'rgb(253, 164, 175)' }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-rose-200/40 rounded-full -mr-4 -mt-4" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-200 flex items-center justify-center">
                <Zap className="w-5 h-5 text-rose-700" />
              </div>
              <div>
                <div className="text-2xl font-bold text-rose-700">{portfolioStats.urgentActions}</div>
                <div className="text-xs text-rose-600 font-medium">Urgent Actions</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Contract List */}
        <div className="w-[420px] flex-none border-r border-slate-200/60 bg-white/60 backdrop-blur-sm overflow-y-auto">
          <div className="p-4 border-b border-slate-200/60 bg-white/80 sticky top-0 z-10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                Contracts
              </h3>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {healthData.length} total
              </span>
            </div>
            {/* Filter Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button className="px-3 py-1.5 text-xs font-medium bg-violet-100 text-violet-700 rounded-lg border border-violet-200">All</button>
              <button className="px-3 py-1.5 text-xs font-medium bg-white text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50">Healthy</button>
              <button className="px-3 py-1.5 text-xs font-medium bg-white text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50">At Risk</button>
              <button className="px-3 py-1.5 text-xs font-medium bg-white text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50">Critical</button>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {healthData.map(health => (
              <ContractHealthCard
                key={health.contractId}
                health={health}
                isSelected={selectedContract?.contractId === health.contractId}
                onSelect={() => setSelectedContract(health)}
              />
            ))}
            {healthData.length === 0 && (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No contracts found</p>
                <p className="text-sm text-slate-400">Upload contracts to see health analysis</p>
              </div>
            )}
          </div>
        </div>

        {/* Detail Panel */}
        {selectedContract && (
          <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-slate-50/50 to-white">
            {/* Contract Header - Enhanced */}
            <motion.div 
              className="bg-white rounded-2xl border border-slate-200/80 p-6 mb-6 shadow-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center gap-8">
                <div className="relative">
                  <ScoreRing
                    score={selectedContract.overallScore}
                    size="xl"
                    previousScore={selectedContract.previousScore}
                    showGlow={true}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {(() => {
                      const badge = getStatusBadge(selectedContract.status);
                      const BadgeIcon = badge.icon;
                      const trend = getTrendIcon(selectedContract.trend);
                      const TrendIcon = trend.icon;
                      return (
                        <>
                          <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 border ${badge.color}`}>
                            <BadgeIcon className="w-4 h-4" />
                            {badge.label}
                          </span>
                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${trend.bg}`}>
                            <TrendIcon className={`w-4 h-4 ${trend.color}`} />
                            <span className={`text-sm font-medium ${trend.color}`}>{trend.label}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-1">{selectedContract.contractName}</h3>
                  <p className="text-slate-500 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    {selectedContract.supplierName}
                  </p>
                  <div className="flex items-center gap-6 mt-4">
                    <span className="text-sm text-slate-500 flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg">
                      <Calendar className="w-4 h-4" />
                      Last assessed: {selectedContract.lastAssessed}
                    </span>
                    <span className="text-sm text-slate-500 flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg">
                      <Clock className="w-4 h-4" />
                      Next review: {selectedContract.nextReview}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => handleViewContract(selectedContract.contractId)} 
                    className="px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all flex items-center gap-2 shadow-lg shadow-violet-200/50"
                  >
                    <Eye className="w-4 h-4" />
                    View Contract
                  </button>
                  <button 
                    onClick={() => handleReassess(selectedContract.contractId, selectedContract.contractName)} 
                    className="px-5 py-2.5 text-sm font-semibold bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reassess Now
                  </button>
                </div>
              </div>
            </motion.div>

            {/* View Toggle - Enhanced */}
            <div className="flex items-center gap-1 mb-5 p-1 bg-slate-100 rounded-xl w-fit">
              {(['overview', 'factors', 'actions'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all capitalize ${
                    view === v
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {v === 'overview' && <PieChart className="w-4 h-4 inline mr-2" />}
                  {v === 'factors' && <Activity className="w-4 h-4 inline mr-2" />}
                  {v === 'actions' && <Zap className="w-4 h-4 inline mr-2" />}
                  {v}
                </button>
              ))}
            </div>

            {/* View Content */}
            <AnimatePresence mode="wait">
              {view === 'overview' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  {/* Factor Summary Chart */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                      <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-violet-500" />
                        Health Factor Breakdown
                      </h4>
                      <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                        {(Array.isArray(selectedContract.factors) ? selectedContract.factors : []).length} factors analyzed
                      </span>
                    </div>
                    <div className="space-y-4">
                      {(Array.isArray(selectedContract.factors) ? selectedContract.factors : []).map((factor, index) => {
                        const colors = getScoreColor(factor.score);
                        const Icon = getCategoryIcon(factor.category);
                        return (
                          <motion.div 
                            key={factor.id} 
                            className="space-y-2"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                          >
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-semibold text-slate-700 flex items-center gap-2">
                                <Icon className={`w-4 h-4 ${colors.text}`} />
                                {factor.name}
                              </span>
                              <span className={`font-bold ${colors.text}`}>{factor.score}/100</span>
                            </div>
                            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                              <motion.div
                                className={`h-full bg-gradient-to-r ${colors.gradient} rounded-full`}
                                initial={{ width: 0 }}
                                animate={{ width: `${factor.score}%` }}
                                transition={{ duration: 0.8, delay: index * 0.1, ease: [0.4, 0, 0.2, 1] }}
                              />
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Urgent Actions */}
                  {(Array.isArray(selectedContract.actionItems) ? selectedContract.actionItems : []).filter(a => a.type === 'urgent').length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
                      <h4 className="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-rose-500" />
                        Urgent Actions Required
                        <span className="ml-2 px-2 py-0.5 bg-rose-100 text-rose-700 text-xs font-semibold rounded-full">
                          {(Array.isArray(selectedContract.actionItems) ? selectedContract.actionItems : []).filter(a => a.type === 'urgent').length}
                        </span>
                      </h4>
                      <div className="space-y-4">
                        {(Array.isArray(selectedContract.actionItems) ? selectedContract.actionItems : [])
                          .filter(a => a.type === 'urgent')
                          .map(item => (
                            <ActionItemCard key={item.id} item={item} />
                          ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {view === 'factors' && (
                <motion.div
                  key="factors"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  {(Array.isArray(selectedContract.factors) ? selectedContract.factors : []).map((factor, index) => (
                    <motion.div
                      key={factor.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <HealthFactorCard
                        factor={factor}
                        expanded={expandedFactors.has(factor.id)}
                        onToggle={() => toggleFactor(factor.id)}
                        onRefresh={() => toast.info(`Refreshing ${factor.name}...`)}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {view === 'actions' && (
                <motion.div
                  key="actions"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  {(Array.isArray(selectedContract.actionItems) ? selectedContract.actionItems : []).map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <ActionItemCard item={item} />
                    </motion.div>
                  ))}
                  {(Array.isArray(selectedContract.actionItems) ? selectedContract.actionItems : []).length === 0 && (
                    <motion.div 
                      className="text-center py-16 bg-white rounded-2xl border border-slate-200/80 shadow-sm"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-violet-100 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-8 h-8 text-violet-600" />
                      </div>
                      <h4 className="text-xl font-bold text-slate-900 mb-2">All Clear!</h4>
                      <p className="text-slate-500">No action items for this contract. Great job maintaining it!</p>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContractHealthScore;
