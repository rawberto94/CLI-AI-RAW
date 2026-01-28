'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ClipboardCheck,
  Shield,
  Brain,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Download,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Eye,
  Filter,
  BarChart3,
  Activity,
  FileText,
  Sparkles,
  ChevronRight,
  Info,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface AIDecision {
  id: string;
  feature: string;
  contractId?: string;
  contractName?: string;
  input: string;
  output: string;
  model: string;
  confidence: number;
  outcome: 'accepted' | 'modified' | 'rejected' | 'pending';
  processingTimeMs: number;
  tokenUsage: { input: number; output: number; total: number };
  citations: Array<{ text: string; location: string; confidence: number }>;
  createdAt: Date;
  userId?: string;
  feedback?: {
    rating: 'positive' | 'negative';
    correction?: string;
    comment?: string;
  };
}

interface UsageStats {
  totalDecisions: number;
  acceptedRate: number;
  avgConfidence: number;
  avgProcessingTime: number;
  totalTokens: number;
  estimatedCost: number;
  byFeature: Record<string, number>;
  byModel: Record<string, number>;
  trend: Array<{ date: string; count: number; avgConfidence: number }>;
}

interface ComplianceReport {
  overallScore: number;
  totalDecisions: number;
  auditedDecisions: number;
  flaggedDecisions: number;
  avgConfidence: number;
  humanReviewRate: number;
  feedbackRate: number;
  issues: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    count: number;
    description: string;
  }>;
  recommendations: string[];
}

interface RiskFlag {
  id: string;
  decisionId: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  status: 'open' | 'acknowledged' | 'resolved';
  createdAt: Date;
}

interface AIDecisionAuditDashboardProps {
  tenantId: string;
  className?: string;
}

// ============================================================================
// Demo Data Generators
// ============================================================================

const AI_FEATURES = [
  'extraction',
  'summarization',
  'classification',
  'comparison',
  'risk_analysis',
  'obligation_detection',
  'anomaly_detection',
];

const AI_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo', 'claude-3-5-haiku-20241022'];

function generateDemoDecisions(count: number): AIDecision[] {
  const outcomes: AIDecision['outcome'][] = ['accepted', 'modified', 'rejected', 'pending'];
  const decisions: AIDecision[] = [];

  for (let i = 0; i < count; i++) {
    const feature = AI_FEATURES[Math.floor(Math.random() * AI_FEATURES.length)];
    const model = AI_MODELS[Math.floor(Math.random() * AI_MODELS.length)];
    const confidence = 0.7 + Math.random() * 0.28;
    const hasContract = Math.random() > 0.3;

    decisions.push({
      id: `decision-${i + 1}`,
      feature,
      contractId: hasContract ? `contract-${Math.floor(Math.random() * 50) + 1}` : undefined,
      contractName: hasContract ? `Contract ${Math.floor(Math.random() * 50) + 1}` : undefined,
      input: `Input for ${feature} analysis...`,
      output: `AI generated ${feature} result...`,
      model,
      confidence,
      outcome: outcomes[Math.floor(Math.random() * outcomes.length)],
      processingTimeMs: 500 + Math.random() * 3000,
      tokenUsage: {
        input: Math.floor(500 + Math.random() * 2000),
        output: Math.floor(200 + Math.random() * 1000),
        total: 0,
      },
      citations: confidence > 0.85 ? [
        { text: 'Source text excerpt...', location: 'Page 3, Paragraph 2', confidence: 0.9 + Math.random() * 0.1 },
      ] : [],
      createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      userId: `user-${Math.floor(Math.random() * 10) + 1}`,
      feedback: Math.random() > 0.6 ? {
        rating: Math.random() > 0.3 ? 'positive' : 'negative',
        comment: 'User feedback comment',
      } : undefined,
    });
  }

  return decisions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function generateDemoUsageStats(): UsageStats {
  return {
    totalDecisions: 1247,
    acceptedRate: 0.873,
    avgConfidence: 0.912,
    avgProcessingTime: 1850,
    totalTokens: 2450000,
    estimatedCost: 124.50,
    byFeature: {
      extraction: 423,
      summarization: 312,
      classification: 198,
      comparison: 145,
      risk_analysis: 102,
      obligation_detection: 45,
      anomaly_detection: 22,
    },
    byModel: {
      'gpt-4o': 756,
      'gpt-4o-mini': 389,
      'gpt-3.5-turbo': 102,
    },
    trend: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toLocaleDateString(),
      count: Math.floor(100 + Math.random() * 100),
      avgConfidence: 0.85 + Math.random() * 0.1,
    })),
  };
}

function generateDemoComplianceReport(): ComplianceReport {
  return {
    overallScore: 94,
    totalDecisions: 1247,
    auditedDecisions: 1180,
    flaggedDecisions: 23,
    avgConfidence: 0.912,
    humanReviewRate: 0.156,
    feedbackRate: 0.342,
    issues: [
      { type: 'low_confidence', severity: 'medium', count: 12, description: 'Decisions with confidence below threshold' },
      { type: 'missing_citations', severity: 'low', count: 8, description: 'Decisions without source citations' },
      { type: 'high_token_usage', severity: 'low', count: 3, description: 'Unusually high token consumption' },
    ],
    recommendations: [
      'Consider adding human review for low-confidence extractions',
      'Enable citation tracking for all extraction features',
      'Implement confidence thresholds for auto-approval',
    ],
  };
}

function generateDemoRiskFlags(): RiskFlag[] {
  const types = ['low_confidence', 'hallucination_risk', 'inconsistent_output', 'data_leakage_risk'];
  const severities: RiskFlag['severity'][] = ['low', 'medium', 'high', 'critical'];
  const statuses: RiskFlag['status'][] = ['open', 'acknowledged', 'resolved'];

  return Array.from({ length: 8 }, (_, i) => ({
    id: `flag-${i + 1}`,
    decisionId: `decision-${Math.floor(Math.random() * 100) + 1}`,
    type: types[Math.floor(Math.random() * types.length)],
    severity: severities[Math.floor(Math.random() * severities.length)],
    reason: 'AI decision flagged for review due to potential issues',
    status: statuses[Math.floor(Math.random() * statuses.length)],
    createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
  }));
}

// ============================================================================
// Sub-Components
// ============================================================================

function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  color = 'blue' 
}: { 
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: { value: number; label: string };
  color?: 'blue' | 'green' | 'amber' | 'purple' | 'rose';
}) {
  const colorClasses = {
    blue: 'from-violet-500 to-purple-500 text-violet-600 bg-violet-50',
    green: 'from-violet-500 to-violet-500 text-green-600 bg-green-50',
    amber: 'from-amber-500 to-orange-500 text-amber-600 bg-amber-50',
    purple: 'from-purple-500 to-violet-500 text-purple-600 bg-purple-50',
    rose: 'from-rose-500 to-pink-500 text-rose-600 bg-rose-50',
  };

  return (
    <Card className="relative overflow-hidden">
      <div className={cn('absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-10 bg-gradient-to-br', colorClasses[color].split(' ').slice(0, 2).join(' '))} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
            {trend && (
              <div className={cn('flex items-center gap-1 mt-1 text-xs', trend.value >= 0 ? 'text-green-600' : 'text-red-600')}>
                <TrendingUp className={cn('w-3 h-3', trend.value < 0 && 'rotate-180')} />
                <span>{trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}</span>
              </div>
            )}
          </div>
          <div className={cn('p-2 rounded-lg', colorClasses[color].split(' ').slice(2).join(' '))}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DecisionRow({ decision, onView }: { decision: AIDecision; onView: () => void }) {
  const outcomeConfig = {
    accepted: { icon: CheckCircle2, color: 'text-green-600 bg-green-50', label: 'Accepted' },
    modified: { icon: FileText, color: 'text-amber-600 bg-amber-50', label: 'Modified' },
    rejected: { icon: XCircle, color: 'text-red-600 bg-red-50', label: 'Rejected' },
    pending: { icon: Clock, color: 'text-violet-600 bg-violet-50', label: 'Pending' },
  };

  const config = outcomeConfig[decision.outcome];
  const OutcomeIcon = config.icon;

  return (
    <div className="flex items-center gap-4 p-3 hover:bg-muted/50 rounded-lg transition-colors">
      <div className={cn('p-2 rounded-lg', config.color)}>
        <OutcomeIcon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm capitalize">{decision.feature.replace('_', ' ')}</span>
          <Badge variant="outline" className="text-xs">{decision.model}</Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          {decision.contractName && <span>{decision.contractName}</span>}
          <span>•</span>
          <span>{decision.createdAt.toLocaleString()}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="flex items-center gap-1">
          <span className={cn('text-sm font-medium', decision.confidence >= 0.9 ? 'text-green-600' : decision.confidence >= 0.8 ? 'text-amber-600' : 'text-red-600')}>
            {(decision.confidence * 100).toFixed(0)}%
          </span>
          {decision.feedback && (
            decision.feedback.rating === 'positive' 
              ? <ThumbsUp className="w-3 h-3 text-green-500" />
              : <ThumbsDown className="w-3 h-3 text-red-500" />
          )}
        </div>
        <span className="text-xs text-muted-foreground">{decision.processingTimeMs.toFixed(0)}ms</span>
      </div>
      <Button variant="ghost" size="sm" onClick={onView}>
        <Eye className="w-4 h-4" />
      </Button>
    </div>
  );
}

function ComplianceScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  
  const getColor = (s: number) => {
    if (s >= 90) return '#22c55e';
    if (s >= 70) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor(score)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold">{score}</span>
        <span className="text-xs text-muted-foreground">Score</span>
      </div>
    </div>
  );
}

function RiskFlagCard({ flag }: { flag: RiskFlag }) {
  const severityConfig = {
    low: { color: 'text-violet-600 bg-violet-50 border-violet-200', icon: Info },
    medium: { color: 'text-amber-600 bg-amber-50 border-amber-200', icon: AlertTriangle },
    high: { color: 'text-orange-600 bg-orange-50 border-orange-200', icon: AlertTriangle },
    critical: { color: 'text-red-600 bg-red-50 border-red-200', icon: XCircle },
  };

  const statusConfig = {
    open: 'bg-red-100 text-red-700',
    acknowledged: 'bg-amber-100 text-amber-700',
    resolved: 'bg-green-100 text-green-700',
  };

  const config = severityConfig[flag.severity];
  const StatusIcon = config.icon;

  return (
    <div className={cn('p-3 rounded-lg border', config.color)}>
      <div className="flex items-start gap-3">
        <StatusIcon className="w-4 h-4 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm capitalize">{flag.type.replace('_', ' ')}</span>
            <Badge className={cn('text-xs', statusConfig[flag.status])}>{flag.status}</Badge>
          </div>
          <p className="text-xs mt-1 opacity-80">{flag.reason}</p>
          <p className="text-xs mt-1 opacity-60">{flag.createdAt.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AIDecisionAuditDashboard({ tenantId, className }: AIDecisionAuditDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [decisions, setDecisions] = useState<AIDecision[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [complianceReport, setComplianceReport] = useState<ComplianceReport | null>(null);
  const [riskFlags, setRiskFlags] = useState<RiskFlag[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [featureFilter, setFeatureFilter] = useState<string>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all');
  // Used for future detail view modal
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedDecision, setSelectedDecision] = useState<AIDecision | null>(null);

  useEffect(() => {
    // Simulate API loading
    const loadData = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      setDecisions(generateDemoDecisions(50));
      setUsageStats(generateDemoUsageStats());
      setComplianceReport(generateDemoComplianceReport());
      setRiskFlags(generateDemoRiskFlags());
      setLoading(false);
    };
    loadData();
  }, [tenantId]);

  const filteredDecisions = decisions.filter(d => {
    if (featureFilter !== 'all' && d.feature !== featureFilter) return false;
    if (outcomeFilter !== 'all' && d.outcome !== outcomeFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return d.feature.includes(query) || d.contractName?.toLowerCase().includes(query) || d.model.includes(query);
    }
    return true;
  });

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center min-h-[400px]', className)}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground mt-2">Loading AI audit data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            AI Decision Audit
          </h1>
          <p className="text-muted-foreground text-sm">Track, audit, and ensure compliance of all AI decisions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      {usageStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-5">
          <StatCard
            title="Total Decisions"
            value={usageStats.totalDecisions.toLocaleString()}
            subtitle="Last 30 days"
            icon={Brain}
            trend={{ value: 12, label: 'vs last month' }}
            color="blue"
          />
          <StatCard
            title="Acceptance Rate"
            value={`${(usageStats.acceptedRate * 100).toFixed(1)}%`}
            subtitle="User accepted"
            icon={CheckCircle2}
            trend={{ value: 3.2, label: 'improvement' }}
            color="green"
          />
          <StatCard
            title="Avg Confidence"
            value={`${(usageStats.avgConfidence * 100).toFixed(1)}%`}
            subtitle="Across all features"
            icon={Activity}
            color="purple"
          />
          <StatCard
            title="Processing Time"
            value={`${(usageStats.avgProcessingTime / 1000).toFixed(1)}s`}
            subtitle="Average latency"
            icon={Clock}
            color="amber"
          />
          <StatCard
            title="Est. Cost"
            value={`$${usageStats.estimatedCost.toFixed(2)}`}
            subtitle="Token usage cost"
            icon={BarChart3}
            color="rose"
          />
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="decisions" className="gap-2">
            <ClipboardCheck className="w-4 h-4" />
            <span className="hidden sm:inline">Decisions</span>
          </TabsTrigger>
          <TabsTrigger value="compliance" className="gap-2">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Compliance</span>
          </TabsTrigger>
          <TabsTrigger value="risks" className="gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="hidden sm:inline">Risk Flags</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Feature Usage */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">AI Feature Usage</CardTitle>
                <CardDescription>Decision distribution by feature type</CardDescription>
              </CardHeader>
              <CardContent>
                {usageStats && (
                  <div className="space-y-3">
                    {Object.entries(usageStats.byFeature)
                      .sort(([, a], [, b]) => b - a)
                      .map(([feature, count]) => {
                        const percentage = (count / usageStats.totalDecisions) * 100;
                        return (
                          <div key={feature} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="capitalize">{feature.replace('_', ' ')}</span>
                              <span className="text-muted-foreground">{count} ({percentage.toFixed(1)}%)</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Model Usage */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Model Distribution</CardTitle>
                <CardDescription>Usage by AI model</CardDescription>
              </CardHeader>
              <CardContent>
                {usageStats && (
                  <div className="space-y-4">
                    {Object.entries(usageStats.byModel)
                      .sort(([, a], [, b]) => b - a)
                      .map(([model, count]) => {
                        const percentage = (count / usageStats.totalDecisions) * 100;
                        return (
                          <div key={model} className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-purple-500">
                              <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm">{model}</p>
                              <p className="text-xs text-muted-foreground">{count} requests</p>
                            </div>
                            <span className="text-sm font-medium">{percentage.toFixed(0)}%</span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Decisions Preview */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recent AI Decisions</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('decisions')}>
                  View All <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {decisions.slice(0, 5).map(decision => (
                  <DecisionRow
                    key={decision.id}
                    decision={decision}
                    onView={() => setSelectedDecision(decision)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Decisions Tab */}
        <TabsContent value="decisions" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search decisions..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={featureFilter} onValueChange={setFeatureFilter}>
                  <SelectTrigger className="w-[160px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Feature" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Features</SelectItem>
                    {AI_FEATURES.map(f => (
                      <SelectItem key={f} value={f} className="capitalize">{f.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Outcomes</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="modified">Modified</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Decisions List */}
          <Card>
            <CardContent className="p-2">
              <div className="space-y-1 max-h-[600px] overflow-y-auto">
                {filteredDecisions.length > 0 ? (
                  filteredDecisions.map(decision => (
                    <DecisionRow
                      key={decision.id}
                      decision={decision}
                      onView={() => setSelectedDecision(decision)}
                    />
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No decisions match your filters</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="space-y-4">
          {complianceReport && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Compliance Score */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Compliance Score</CardTitle>
                  <CardDescription>Overall AI governance health</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center py-4">
                  <ComplianceScoreRing score={complianceReport.overallScore} />
                  <div className="grid grid-cols-2 gap-4 mt-6 w-full text-center">
                    <div>
                      <p className="text-lg font-bold">{complianceReport.auditedDecisions}</p>
                      <p className="text-xs text-muted-foreground">Audited</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-amber-600">{complianceReport.flaggedDecisions}</p>
                      <p className="text-xs text-muted-foreground">Flagged</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{(complianceReport.humanReviewRate * 100).toFixed(0)}%</p>
                      <p className="text-xs text-muted-foreground">Human Review</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{(complianceReport.feedbackRate * 100).toFixed(0)}%</p>
                      <p className="text-xs text-muted-foreground">Feedback Rate</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Issues */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Active Issues</CardTitle>
                  <CardDescription>Items requiring attention</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {complianceReport.issues.map((issue, i) => (
                      <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            'text-xs',
                            issue.severity === 'critical' && 'border-red-500 text-red-600',
                            issue.severity === 'high' && 'border-orange-500 text-orange-600',
                            issue.severity === 'medium' && 'border-amber-500 text-amber-600',
                            issue.severity === 'low' && 'border-violet-500 text-violet-600',
                          )}
                        >
                          {issue.severity}
                        </Badge>
                        <div className="flex-1">
                          <p className="text-sm font-medium capitalize">{issue.type.replace('_', ' ')}</p>
                          <p className="text-xs text-muted-foreground">{issue.description}</p>
                        </div>
                        <span className="text-sm font-bold">{issue.count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recommendations */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Recommendations</CardTitle>
                  <CardDescription>Suggested improvements</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {complianceReport.recommendations.map((rec, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-green-50">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                        <p className="text-sm text-green-800">{rec}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Risk Flags Tab */}
        <TabsContent value="risks" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {riskFlags.map(flag => (
              <RiskFlagCard key={flag.id} flag={flag} />
            ))}
          </div>
          {riskFlags.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="font-medium">No Active Risk Flags</p>
                <p className="text-sm text-muted-foreground">All AI decisions are within acceptable parameters</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Decision Detail Modal would go here */}
    </div>
  );
}

export default AIDecisionAuditDashboard;
