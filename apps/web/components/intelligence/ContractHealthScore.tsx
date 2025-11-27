'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
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
} from 'lucide-react';
import { useDataMode } from '@/contexts/DataModeContext';

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
  if (score >= 80) return { bg: 'bg-green-500', text: 'text-green-600', light: 'bg-green-50' };
  if (score >= 60) return { bg: 'bg-amber-500', text: 'text-amber-600', light: 'bg-amber-50' };
  return { bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-50' };
};

const getStatusBadge = (status: ContractHealth['status']) => {
  switch (status) {
    case 'healthy':
      return { icon: CheckCircle2, color: 'bg-green-100 text-green-700', label: 'Healthy' };
    case 'at-risk':
      return { icon: AlertTriangle, color: 'bg-amber-100 text-amber-700', label: 'At Risk' };
    case 'critical':
      return { icon: XCircle, color: 'bg-red-100 text-red-700', label: 'Critical' };
  }
};

const getTrendIcon = (trend: 'improving' | 'stable' | 'declining') => {
  switch (trend) {
    case 'improving':
      return { icon: TrendingUp, color: 'text-green-500' };
    case 'stable':
      return { icon: Minus, color: 'text-slate-400' };
    case 'declining':
      return { icon: TrendingDown, color: 'text-red-500' };
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

// ============================================================================
// Score Ring Component
// ============================================================================

interface ScoreRingProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  previousScore?: number;
}

const ScoreRing: React.FC<ScoreRingProps> = ({ score, size = 'md', showLabel = true, previousScore }) => {
  const sizes = {
    sm: { ring: 48, stroke: 4, text: 'text-sm' },
    md: { ring: 80, stroke: 6, text: 'text-xl' },
    lg: { ring: 120, stroke: 8, text: 'text-3xl' },
  };

  const { ring, stroke, text } = sizes[size];
  const radius = (ring - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const colors = getScoreColor(score);
  const change = previousScore ? score - previousScore : 0;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={ring} height={ring} className="-rotate-90">
        <circle
          cx={ring / 2}
          cy={ring / 2}
          r={radius}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={ring / 2}
          cy={ring / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className={colors.text}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold ${text} ${colors.text}`}>{score}</span>
          {previousScore !== undefined && change !== 0 && (
            <span className={`text-xs font-medium ${change > 0 ? 'text-green-500' : 'text-red-500'}`}>
              {change > 0 ? '+' : ''}{change}
            </span>
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
}

const HealthFactorCard: React.FC<HealthFactorCardProps> = ({ factor, expanded, onToggle }) => {
  const Icon = getCategoryIcon(factor.category);
  const colors = getScoreColor(factor.score);
  const trend = getTrendIcon(factor.trend);
  const TrendIcon = trend.icon;

  return (
    <motion.div
      layout
      className="bg-white rounded-lg border border-slate-200 overflow-hidden"
    >
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors"
      >
        <div className={`w-10 h-10 rounded-lg ${colors.light} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${colors.text}`} />
        </div>
        
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900">{factor.name}</span>
            <span className="text-xs text-slate-400">({factor.weight}% weight)</span>
          </div>
          <p className="text-sm text-slate-500 truncate">{factor.details}</p>
        </div>

        <div className="flex items-center gap-3">
          <TrendIcon className={`w-4 h-4 ${trend.color}`} />
          <ScoreRing score={factor.score} size="sm" showLabel={true} />
          <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-100"
          >
            <div className="p-4 space-y-4 bg-slate-50">
              <p className="text-sm text-slate-600">{factor.details}</p>
              
              {factor.recommendations && factor.recommendations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-slate-500 uppercase flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    Recommendations
                  </h4>
                  <ul className="space-y-1">
                    {factor.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <ArrowUpRight className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-700">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Last updated: {factor.lastUpdated}</span>
                <button className="text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  Refresh
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
    urgent: { bg: 'bg-red-50 border-red-200', icon: AlertCircle, iconColor: 'text-red-500', badge: 'bg-red-100 text-red-700' },
    recommended: { bg: 'bg-amber-50 border-amber-200', icon: AlertTriangle, iconColor: 'text-amber-500', badge: 'bg-amber-100 text-amber-700' },
    optional: { bg: 'bg-blue-50 border-blue-200', icon: Info, iconColor: 'text-blue-500', badge: 'bg-blue-100 text-blue-700' },
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
    <div className={`p-4 rounded-lg border ${style.bg}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${style.iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${style.badge} capitalize`}>
              {item.type}
            </span>
            {item.dueDate && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Due: {item.dueDate}
              </span>
            )}
          </div>
          <h4 className="font-medium text-slate-900">{item.title}</h4>
          <p className="text-sm text-slate-600 mt-1">{item.description}</p>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-xs text-slate-500">
              Impact: <span className="font-medium capitalize">{item.impact}</span>
            </span>
            <span className="text-xs text-slate-500">
              Effort: <span className="font-medium capitalize">{item.effort}</span>
            </span>
          </div>
          
          {/* Cross-Module Actions */}
          <AnimatePresence>
            {showActions && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-3 pt-3 border-t border-slate-200/50 overflow-hidden"
              >
                <p className="text-xs text-slate-500 mb-2">Quick Actions:</p>
                <div className="flex flex-wrap gap-2">
                  {getActionLinks().map((link, linkIndex) => {
                    const LinkIcon = link.icon;
                    return (
                      <Link
                        key={`${link.label}-${linkIndex}`}
                        href={link.href}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50 hover:border-blue-200 hover:text-blue-700 transition-colors"
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                        {link.label}
                        <ChevronRight className="w-3 h-3" />
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
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            showActions 
              ? 'bg-blue-500 text-white hover:bg-blue-600' 
              : 'bg-white border border-slate-200 hover:bg-slate-50'
          }`}
        >
          {showActions ? 'Close' : 'Take Action'}
        </button>
      </div>
    </div>
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

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      onClick={onSelect}
      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50/50 shadow-lg'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
      }`}
    >
      <div className="flex items-center gap-4">
        <ScoreRing score={health.overallScore} size="md" previousScore={health.previousScore} />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${statusBadge.color}`}>
              <StatusIcon className="w-3 h-3" />
              {statusBadge.label}
            </span>
            <TrendIcon className={`w-4 h-4 ${trend.color}`} />
          </div>
          <h3 className="font-semibold text-slate-900 truncate">{health.contractName}</h3>
          <p className="text-sm text-slate-500">{health.supplierName}</p>
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-400 mb-1">Next Review</div>
          <div className="text-sm font-medium text-slate-600">{health.nextReview}</div>
          {health.actionItems.filter(a => a.type === 'urgent').length > 0 && (
            <div className="mt-2 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
              {health.actionItems.filter(a => a.type === 'urgent').length} Urgent
            </div>
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
            factors: item.factors || [],
            lastAssessed: item.lastAssessed || new Date().toISOString(),
            nextReview: item.nextReview || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
            actionItems: item.actionItems || [],
          }));
          setHealthData(mapped);
          setSelectedContract(mapped[0] ?? null);
        } else {
          setHealthData(mockHealthData);
          setSelectedContract(mockHealthData[0] ?? null);
        }
      } catch (error) {
        console.log('Using mock health data');
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
    const urgentActions = healthData.reduce((sum, h) => sum + h.actionItems.filter(a => a.type === 'urgent').length, 0);

    return { total, avgScore, healthy, atRisk, critical, urgentActions };
  }, [healthData]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-600">Loading contract health data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="flex-none p-6 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              Contract Health Dashboard
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Monitor and improve contract performance across your portfolio
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Refresh All
            </button>
            <button className="px-3 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Export Report
            </button>
          </div>
        </div>

        {/* Portfolio Stats */}
        <div className="grid grid-cols-6 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl">
            <div className="text-2xl font-bold text-slate-900">{portfolioStats.avgScore}</div>
            <div className="text-sm text-slate-500">Avg Health Score</div>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <div className="text-2xl font-bold text-slate-900">{portfolioStats.total}</div>
            <div className="text-sm text-slate-500">Total Contracts</div>
          </div>
          <div className="p-4 bg-green-50 rounded-xl">
            <div className="text-2xl font-bold text-green-600">{portfolioStats.healthy}</div>
            <div className="text-sm text-green-600">Healthy</div>
          </div>
          <div className="p-4 bg-amber-50 rounded-xl">
            <div className="text-2xl font-bold text-amber-600">{portfolioStats.atRisk}</div>
            <div className="text-sm text-amber-600">At Risk</div>
          </div>
          <div className="p-4 bg-red-50 rounded-xl">
            <div className="text-2xl font-bold text-red-600">{portfolioStats.critical}</div>
            <div className="text-sm text-red-600">Critical</div>
          </div>
          <div className="p-4 bg-red-50 rounded-xl border-2 border-red-200">
            <div className="text-2xl font-bold text-red-600">{portfolioStats.urgentActions}</div>
            <div className="text-sm text-red-600">Urgent Actions</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Contract List */}
        <div className="w-96 flex-none border-r border-slate-200 bg-white overflow-y-auto p-4 space-y-3">
          <h3 className="text-sm font-medium text-slate-500 uppercase mb-3">Contracts</h3>
          {healthData.map(health => (
            <ContractHealthCard
              key={health.contractId}
              health={health}
              isSelected={selectedContract?.contractId === health.contractId}
              onSelect={() => setSelectedContract(health)}
            />
          ))}
        </div>

        {/* Detail Panel */}
        {selectedContract && (
          <div className="flex-1 overflow-y-auto p-6">
            {/* Contract Header */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
              <div className="flex items-center gap-6">
                <ScoreRing
                  score={selectedContract.overallScore}
                  size="lg"
                  previousScore={selectedContract.previousScore}
                />
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-slate-900">{selectedContract.contractName}</h3>
                  <p className="text-slate-500">{selectedContract.supplierName}</p>
                  <div className="flex items-center gap-4 mt-3">
                    {(() => {
                      const badge = getStatusBadge(selectedContract.status);
                      const BadgeIcon = badge.icon;
                      return (
                        <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1.5 ${badge.color}`}>
                          <BadgeIcon className="w-4 h-4" />
                          {badge.label}
                        </span>
                      );
                    })()}
                    <span className="text-sm text-slate-500 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Last assessed: {selectedContract.lastAssessed}
                    </span>
                    <span className="text-sm text-slate-500 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Next review: {selectedContract.nextReview}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    View Contract
                  </button>
                  <button className="px-4 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Reassess
                  </button>
                </div>
              </div>
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-2 mb-4">
              {(['overview', 'factors', 'actions'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                    view === v
                      ? 'bg-blue-500 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
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
                  <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h4 className="text-lg font-semibold text-slate-900 mb-4">Health Factor Breakdown</h4>
                    <div className="space-y-4">
                      {selectedContract.factors.map(factor => {
                        const colors = getScoreColor(factor.score);
                        return (
                          <div key={factor.id} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-slate-700">{factor.name}</span>
                              <span className={colors.text}>{factor.score}/100</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <motion.div
                                className={`h-full ${colors.bg} rounded-full`}
                                initial={{ width: 0 }}
                                animate={{ width: `${factor.score}%` }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Urgent Actions */}
                  {selectedContract.actionItems.filter(a => a.type === 'urgent').length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                      <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                        Urgent Actions Required
                      </h4>
                      <div className="space-y-3">
                        {selectedContract.actionItems
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
                  className="space-y-3"
                >
                  {selectedContract.factors.map(factor => (
                    <HealthFactorCard
                      key={factor.id}
                      factor={factor}
                      expanded={expandedFactors.has(factor.id)}
                      onToggle={() => toggleFactor(factor.id)}
                    />
                  ))}
                </motion.div>
              )}

              {view === 'actions' && (
                <motion.div
                  key="actions"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  {selectedContract.actionItems.map(item => (
                    <ActionItemCard key={item.id} item={item} />
                  ))}
                  {selectedContract.actionItems.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                      <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                      <h4 className="text-lg font-semibold text-slate-900">All Clear!</h4>
                      <p className="text-slate-500">No action items for this contract</p>
                    </div>
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
