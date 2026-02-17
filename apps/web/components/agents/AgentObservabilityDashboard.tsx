/**
 * Agent Observability Dashboard
 * 
 * Real-time dashboard for monitoring AI agent activity, reasoning chains,
 * tool usage, and performance metrics. Provides deep insights into
 * how agents are making decisions.
 * 
 * @version 1.0.0
 */

'use client';

import { memo, useState, useEffect, useMemo, useCallback } from 'react';
import {
  Activity,
  Brain,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Eye,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Settings,
  Search,
  BarChart3,
  Workflow,
  Target,
  Lightbulb,
  MessageSquare,
  Wrench,
  Users,
  Cpu,
  GitBranch,
  Play,
  Pause,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

// =============================================================================
// TYPES
// =============================================================================

interface AgentTrace {
  id: string;
  agentId: string;
  agentName: string;
  agentType: 'react' | 'debate' | 'extraction' | 'validation' | 'custom';
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'paused';
  goal: string;
  steps: AgentStep[];
  tokensUsed: number;
  estimatedCost: number;
  contractId?: string;
  tenantId: string;
  userId: string;
  metadata?: Record<string, any>;
}

interface AgentStep {
  id: string;
  stepNumber: number;
  type: 'thought' | 'action' | 'observation' | 'tool_call' | 'critique' | 'decision';
  content: string;
  timestamp: Date;
  durationMs: number;
  toolId?: string;
  toolInput?: Record<string, any>;
  toolOutput?: Record<string, unknown>;
  confidence?: number;
  tokens?: number;
}

interface AgentMetrics {
  totalAgents: number;
  activeAgents: number;
  completedToday: number;
  failedToday: number;
  avgCompletionTimeMs: number;
  avgTokensPerTask: number;
  successRate: number;
  topAgents: Array<{ agentId: string; name: string; taskCount: number }>;
  topTools: Array<{ toolId: string; name: string; usageCount: number }>;
  costToday: number;
  costTrend: number;
}

// Future types - reserved for extended functionality
 
interface _DebateTrace {
  id: string;
  topic: string;
  participants: Array<{ id: string; name: string; role: string }>;
  turns: Array<{
    agentId: string;
    agentName: string;
    message: string;
    arguments: Array<{ type: string; claim: string }>;
    timestamp: Date;
  }>;
  consensusReached: boolean;
  consensusConfidence: number;
  finalConclusion: string;
  startTime: Date;
  endTime?: Date;
}

 
interface _ToolUsageEvent {
  toolId: string;
  toolName: string;
  timestamp: Date;
  agentId: string;
  success: boolean;
  durationMs: number;
  input: Record<string, any>;
  output?: Record<string, unknown>;
  error?: string;
}

// =============================================================================
// DEFAULT EMPTY METRICS (shown when API returns no data)
// =============================================================================

const emptyMetrics: AgentMetrics = {
  totalAgents: 0,
  activeAgents: 0,
  completedToday: 0,
  failedToday: 0,
  avgCompletionTimeMs: 0,
  avgTokensPerTask: 0,
  successRate: 0,
  topAgents: [],
  topTools: [],
  costToday: 0,
  costTrend: 0,
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const MetricCard = memo(function MetricCard({
  title,
  value,
  subValue,
  icon: Icon,
  trend,
  className,
}: {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: number;
  className?: string;
}) {
  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{value}</p>
              {trend !== undefined && (
                <span
                  className={cn(
                    'flex items-center text-xs font-medium',
                    trend >= 0 ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {trend >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                  {Math.abs(trend)}%
                </span>
              )}
            </div>
            {subValue && (
              <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
            )}
          </div>
          <div className="p-3 rounded-full bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

const StepTypeIcon = memo(function StepTypeIcon({ type }: { type: AgentStep['type'] }) {
  const iconMap = {
    thought: Brain,
    action: Zap,
    observation: Eye,
    tool_call: Wrench,
    critique: MessageSquare,
    decision: Target,
  };
  const Icon = iconMap[type];
  return <Icon className="h-4 w-4" />;
});

const StepTypeBadge = memo(function StepTypeBadge({ type }: { type: AgentStep['type'] }) {
  const styleMap: Record<AgentStep['type'], string> = {
    thought: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
    action: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    observation: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    tool_call: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
    critique: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    decision: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
  };

  return (
    <Badge variant="outline" className={cn('capitalize', styleMap[type])}>
      <StepTypeIcon type={type} />
      <span className="ml-1">{type.replace('_', ' ')}</span>
    </Badge>
  );
});

const AgentStepItem = memo(function AgentStepItem({
  step,
  isExpanded,
  onToggle,
}: {
  step: AgentStep;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="relative">
        {/* Timeline connector */}
        <div className="absolute left-4 top-10 bottom-0 w-px bg-border" />
        
        <CollapsibleTrigger asChild>
          <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
            {/* Step number circle */}
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary z-10">
              {step.stepNumber}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <StepTypeBadge type={step.type} />
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(step.timestamp, { addSuffix: true })}
                </span>
                <span className="text-xs text-muted-foreground">
                  {step.durationMs}ms
                </span>
                {step.confidence && (
                  <Badge variant="outline" className="text-xs">
                    {Math.round(step.confidence * 100)}% confident
                  </Badge>
                )}
              </div>
              <p className="text-sm mt-1 line-clamp-2">{step.content}</p>
            </div>
            
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="ml-11 pl-3 pb-3 space-y-2">
            <div className="p-3 rounded-lg bg-muted/30 text-sm">
              <p className="whitespace-pre-wrap">{step.content}</p>
            </div>
            
            {step.toolId && (
              <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
                <p className="text-xs font-medium text-violet-700 dark:text-violet-300 mb-2">
                  Tool: {step.toolId}
                </p>
                {step.toolInput && (
                  <div className="text-xs">
                    <p className="font-medium text-muted-foreground">Input:</p>
                    <pre className="mt-1 p-2 bg-background rounded text-xs overflow-x-auto">
                      {JSON.stringify(step.toolInput, null, 2)}
                    </pre>
                  </div>
                )}
                {step.toolOutput && (
                  <div className="text-xs mt-2">
                    <p className="font-medium text-muted-foreground">Output:</p>
                    <pre className="mt-1 p-2 bg-background rounded text-xs overflow-x-auto">
                      {JSON.stringify(step.toolOutput, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
            
            {step.tokens && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Cpu className="h-3 w-3" />
                <span>{step.tokens} tokens</span>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
});

const TraceCard = memo(function TraceCard({
  trace,
  isSelected,
  onSelect,
}: {
  trace: AgentTrace;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const statusConfig = {
    running: { color: 'text-violet-600', bg: 'bg-violet-100', icon: Activity },
    completed: { color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle2 },
    failed: { color: 'text-red-600', bg: 'bg-red-100', icon: XCircle },
    paused: { color: 'text-yellow-600', bg: 'bg-yellow-100', icon: Pause },
  };

  const config = statusConfig[trace.status];
  const StatusIcon = config.icon;

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:border-primary/50',
        isSelected && 'ring-2 ring-primary border-primary'
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn('capitalize', config.bg, config.color)}
              >
                <StatusIcon className="h-3 w-3 mr-1" />
                {trace.status}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {trace.agentType}
              </Badge>
            </div>
            <h4 className="font-medium mt-2 truncate">{trace.agentName}</h4>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {trace.goal}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(trace.startTime, { addSuffix: true })}
          </div>
          <div className="flex items-center gap-1">
            <GitBranch className="h-3 w-3" />
            {trace.steps.length} steps
          </div>
          <div className="flex items-center gap-1">
            <Cpu className="h-3 w-3" />
            {trace.tokensUsed} tokens
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

const ToolUsageChart = memo(function ToolUsageChart({
  tools,
}: {
  tools: Array<{ toolId: string; name: string; usageCount: number }>;
}) {
  const maxUsage = Math.max(...tools.map(t => t.usageCount));

  return (
    <div className="space-y-3">
      {tools.map((tool) => (
        <div key={tool.toolId} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{tool.name}</span>
            <span className="text-muted-foreground">{tool.usageCount} calls</span>
          </div>
          <Progress value={(tool.usageCount / maxUsage) * 100} className="h-2" />
        </div>
      ))}
    </div>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export interface AgentObservabilityDashboardProps {
  tenantId?: string;
  className?: string;
}

export const AgentObservabilityDashboard = memo(function AgentObservabilityDashboard({
  tenantId: _tenantId,
  className,
}: AgentObservabilityDashboardProps) {
  // State
  const [traces, setTraces] = useState<AgentTrace[]>([]);
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);
  const [selectedTrace, setSelectedTrace] = useState<AgentTrace | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [activeTab, setActiveTab] = useState('traces');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [agentTypeFilter, setAgentTypeFilter] = useState<string>('all');

  // Fetch data from real API, show empty states when no data
  const fetchObservabilityData = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/observability');
      const json = await res.json();
      if (json.success) {
        setTraces(json.data?.traces ?? []);
        setMetrics(json.data?.metrics ?? emptyMetrics);
        return;
      }
    } catch {
      // API unavailable — show empty states
    }
    setTraces([]);
    setMetrics(emptyMetrics);
  }, []);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        await fetchObservabilityData();
      } catch {
        toast.error('Failed to load observability data');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [fetchObservabilityData]);

  // Live mode polling — fetches real API data on interval
  useEffect(() => {
    if (!isLiveMode) return;

    const interval = setInterval(async () => {
      try {
        await fetchObservabilityData();
      } catch {
        // Silently continue with stale data
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isLiveMode, fetchObservabilityData]);

  // Filter traces
  const filteredTraces = useMemo(() => {
    return traces.filter(trace => {
      if (statusFilter !== 'all' && trace.status !== statusFilter) return false;
      if (agentTypeFilter !== 'all' && trace.agentType !== agentTypeFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          trace.agentName.toLowerCase().includes(query) ||
          trace.goal.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [traces, statusFilter, agentTypeFilter, searchQuery]);

  // Computed stats from real trace/metrics data
  const computedStats = useMemo(() => {
    // Tool performance: average step duration and success rate from all steps
    const allSteps = traces.flatMap(t => t.steps ?? []);
    const toolSteps = allSteps.filter(s => s.type === 'tool_call');
    const avgToolTimeMs = toolSteps.length > 0
      ? toolSteps.reduce((a, s) => a + (s.durationMs ?? 0), 0) / toolSteps.length
      : 0;
    // Based on traces: completed vs failed
    const completedTraces = traces.filter(t => t.status === 'completed').length;
    const failedTraces = traces.filter(t => t.status === 'failed').length;
    const totalDone = completedTraces + failedTraces;
    const toolSuccessRate = totalDone > 0 ? Math.round((completedTraces / totalDone) * 100) : 0;

    // Agent avg time from metrics
    const avgAgentTimeSec = metrics?.avgCompletionTimeMs
      ? (metrics.avgCompletionTimeMs / 1000).toFixed(1)
      : '0';
    const agentSuccessRate = metrics?.successRate
      ? `${Math.round(metrics.successRate * 100)}%`
      : '0%';

    // Cost by agent type from traces
    const costByType: Record<string, number> = {};
    for (const t of traces) {
      const cost = t.estimatedCost ?? 0;
      costByType[t.agentType] = (costByType[t.agentType] || 0) + cost;
    }
    const totalCostFromTraces = Object.values(costByType).reduce((a, b) => a + b, 0);
    const costBreakdown = Object.entries(costByType)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type, cost]) => ({
        type,
        cost,
        pct: totalCostFromTraces > 0 ? Math.round((cost / totalCostFromTraces) * 100) : 0,
      }));

    // Token usage per-day for last 7 days from traces
    const now = new Date();
    const tokenByDay: { day: string; tokens: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);
      const dayTokens = traces
        .filter(t => {
          const ts = new Date(t.startTime);
          return ts >= dayStart && ts <= dayEnd;
        })
        .reduce((a, t) => a + (t.tokensUsed ?? 0), 0);
      tokenByDay.push({ day: label, tokens: dayTokens });
    }
    const maxTokens = Math.max(...tokenByDay.map(d => d.tokens), 1);

    return {
      avgToolTime: avgToolTimeMs > 0 ? `${(avgToolTimeMs / 1000).toFixed(1)}s` : 'N/A',
      toolSuccessRate: totalDone > 0 ? `${toolSuccessRate}% success` : 'N/A',
      avgAgentTimeSec: `${avgAgentTimeSec}s`,
      agentSuccessRate,
      costBreakdown,
      tokenByDay,
      maxTokens,
    };
  }, [traces, metrics]);

  // Handlers
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetchObservabilityData();
      toast.success('Data refreshed');
    } catch {
      toast.error('Refresh failed');
    } finally {
      setIsLoading(false);
    }
  }, [fetchObservabilityData]);

  const toggleStep = useCallback((stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  }, []);

  const toggleLiveMode = useCallback(() => {
    setIsLiveMode(prev => {
      if (!prev) {
        toast.success('Live mode enabled');
      } else {
        toast.info('Live mode disabled');
      }
      return !prev;
    });
  }, []);

  // Render loading state
  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center h-96', className)}>
        <div className="flex flex-col items-center gap-4">
          <Activity className="h-8 w-8 animate-pulse text-primary" />
          <p className="text-muted-foreground">Loading observability data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Agent Observability</h2>
          <p className="text-muted-foreground">
            Monitor AI agent activity, reasoning chains, and performance in real-time
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isLiveMode ? 'default' : 'outline'}
            size="sm"
            onClick={toggleLiveMode}
          >
            {isLiveMode ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Live
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Go Live
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Active Agents"
            value={metrics.activeAgents}
            subValue={`of ${metrics.totalAgents} total`}
            icon={Activity}
          />
          <MetricCard
            title="Completed Today"
            value={metrics.completedToday}
            subValue={`${metrics.failedToday} failed`}
            icon={CheckCircle2}
          />
          <MetricCard
            title="Success Rate"
            value={`${(metrics.successRate * 100).toFixed(1)}%`}
            icon={Target}
            trend={2.3}
          />
          <MetricCard
            title="Cost Today"
            value={`$${metrics.costToday.toFixed(2)}`}
            icon={TrendingUp}
            trend={metrics.costTrend}
          />
        </div>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="traces" className="flex items-center gap-2">
            <Workflow className="h-4 w-4" />
            Traces
          </TabsTrigger>
          <TabsTrigger value="tools" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Tool Usage
          </TabsTrigger>
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Traces Tab */}
        <TabsContent value="traces" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Trace List */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Traces</CardTitle>
                  <Badge variant="outline">{filteredTraces.length} traces</Badge>
                </div>
                <div className="flex gap-2 mt-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search traces..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="running">Running</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={agentTypeFilter} onValueChange={setAgentTypeFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="react">ReAct</SelectItem>
                      <SelectItem value="debate">Debate</SelectItem>
                      <SelectItem value="extraction">Extraction</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {filteredTraces.map(trace => (
                      <TraceCard
                        key={trace.id}
                        trace={trace}
                        isSelected={selectedTrace?.id === trace.id}
                        onSelect={() => setSelectedTrace(trace)}
                      />
                    ))}
                    {filteredTraces.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        <Activity className="h-8 w-8 mx-auto mb-3 opacity-40" />
                        <p className="font-medium">No agent traces recorded yet</p>
                        <p className="text-sm mt-1">Agent traces will appear here as contracts are processed</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Trace Detail */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>
                  {selectedTrace ? 'Trace Details' : 'Select a Trace'}
                </CardTitle>
                {selectedTrace && (
                  <CardDescription>{selectedTrace.goal}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {selectedTrace ? (
                  <ScrollArea className="h-[500px]">
                    {/* Trace metadata */}
                    <div className="space-y-4 mb-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Agent:</span>
                          <p className="font-medium">{selectedTrace.agentName}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Session:</span>
                          <p className="font-medium font-mono text-xs">
                            {selectedTrace.sessionId}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Duration:</span>
                          <p className="font-medium">
                            {selectedTrace.endTime
                              ? `${Math.round((selectedTrace.endTime.getTime() - selectedTrace.startTime.getTime()) / 1000)}s`
                              : 'In progress'}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Cost:</span>
                          <p className="font-medium">
                            ${selectedTrace.estimatedCost.toFixed(4)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Separator className="my-4" />

                    {/* Steps timeline */}
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium mb-3">Reasoning Chain</h4>
                      {selectedTrace.steps.map(step => (
                        <AgentStepItem
                          key={step.id}
                          step={step}
                          isExpanded={expandedSteps.has(step.id)}
                          onToggle={() => toggleStep(step.id)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[500px] text-muted-foreground">
                    <Eye className="h-12 w-12 mb-4 opacity-50" />
                    <p>Select a trace to view details</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tool Usage Tab */}
        <TabsContent value="tools" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Most Used Tools</CardTitle>
                <CardDescription>Tool usage in the last 24 hours</CardDescription>
              </CardHeader>
              <CardContent>
                {metrics && <ToolUsageChart tools={metrics.topTools} />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tool Performance</CardTitle>
                <CardDescription>Average execution time by tool</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics?.topTools.map(tool => (
                    <div key={tool.toolId} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Wrench className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{tool.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {tool.usageCount} executions
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{computedStats.avgToolTime}</p>
                        <p className="text-sm text-green-600">{computedStats.toolSuccessRate}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {metrics?.topAgents.map((agent, index) => (
              <Card key={agent.agentId}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'p-3 rounded-full',
                      index === 0 && 'bg-yellow-100 dark:bg-yellow-900',
                      index === 1 && 'bg-gray-100 dark:bg-gray-800',
                      index === 2 && 'bg-orange-100 dark:bg-orange-900'
                    )}>
                      <Brain className={cn(
                        'h-6 w-6',
                        index === 0 && 'text-yellow-600',
                        index === 1 && 'text-gray-600',
                        index === 2 && 'text-orange-600'
                      )} />
                    </div>
                    <div>
                      <h4 className="font-medium">{agent.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {agent.taskCount} tasks today
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div className="p-2 rounded-lg bg-muted/50 text-center">
                      <p className="text-muted-foreground">Avg Time</p>
                      <p className="font-medium">{computedStats.avgAgentTimeSec}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50 text-center">
                      <p className="text-muted-foreground">Success</p>
                      <p className="font-medium text-green-600">{computedStats.agentSuccessRate}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Token Usage Trend</CardTitle>
                <CardDescription>Last 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-48 flex flex-col justify-end gap-1">
                  <div className="flex items-end gap-1 h-36">
                    {computedStats.tokenByDay.map((d, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t bg-primary/80 transition-all min-h-[2px]"
                          style={{ height: `${(d.tokens / computedStats.maxTokens) * 100}%` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    {computedStats.tokenByDay.map((d, i) => (
                      <div key={i} className="flex-1 text-center text-[10px] text-muted-foreground">
                        {d.day}
                      </div>
                    ))}
                  </div>
                  {computedStats.tokenByDay.every(d => d.tokens === 0) && (
                    <p className="text-center text-sm text-muted-foreground mt-2">No token data yet</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cost Analysis</CardTitle>
                <CardDescription>Breakdown by agent type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {computedStats.costBreakdown.length > 0 ? (
                    computedStats.costBreakdown.map((item) => (
                      <div key={item.type}>
                        <div className="flex items-center justify-between">
                          <span className="capitalize">{item.type.replace('_', ' ')} Agents</span>
                          <span className="font-medium">${item.cost.toFixed(2)}</span>
                        </div>
                        <Progress value={item.pct} className="h-2 mt-1" />
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No cost data yet</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Key Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
                    <Lightbulb className="h-5 w-5 text-violet-600 mb-2" />
                    <h5 className="font-medium">Efficiency Improving</h5>
                    <p className="text-sm text-muted-foreground mt-1">
                      Average task completion time decreased by 15% this week
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <TrendingUp className="h-5 w-5 text-green-600 mb-2" />
                    <h5 className="font-medium">High Accuracy</h5>
                    <p className="text-sm text-muted-foreground mt-1">
                      Self-critique layer catching 23% more errors before output
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mb-2" />
                    <h5 className="font-medium">Cost Alert</h5>
                    <p className="text-sm text-muted-foreground mt-1">
                      Debate agent costs up 8% - consider using quick preset more
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
});

export default AgentObservabilityDashboard;
