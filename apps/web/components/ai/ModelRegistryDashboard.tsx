'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sparkles,
  Cpu,
  Activity,
  Settings,
  Search,
  Filter,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  GitBranch,
  Play,
  Pause,
  Plus,
  Eye,
  Loader2,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type ModelProvider = 'openai' | 'anthropic' | 'google' | 'azure' | 'custom';
type ModelStatus = 'active' | 'deprecated' | 'testing' | 'disabled';
type ModelCapability = 'extraction' | 'summarization' | 'classification' | 'comparison' | 'generation' | 'chat' | 'embedding' | 'analysis';

interface ModelVersion {
  version: string;
  releaseDate: Date;
  changelog: string;
  isDefault: boolean;
  performance: ModelPerformance;
}

interface ModelPerformance {
  totalRequests: number;
  successRate: number;
  avgLatencyMs: number;
  avgTokensPerRequest: number;
  costPer1kTokens: number;
  qualityScore: number;
  userSatisfaction: number;
}

interface RegisteredModel {
  id: string;
  name: string;
  provider: ModelProvider;
  modelId: string;
  capabilities: ModelCapability[];
  maxTokens: number;
  contextWindow: number;
  currentVersion: string;
  versions: ModelVersion[];
  status: ModelStatus;
  isDefault: boolean;
  registeredAt: Date;
  lastUpdatedAt: Date;
}

interface ABTest {
  id: string;
  name: string;
  modelA: string;
  modelB: string;
  trafficSplit: number;
  status: 'running' | 'paused' | 'completed';
  startedAt: Date;
  results?: {
    modelA: { requests: number; successRate: number; avgLatency: number; satisfaction: number };
    modelB: { requests: number; successRate: number; avgLatency: number; satisfaction: number };
    winner?: string;
  };
}

interface ModelRegistryDashboardProps {
  tenantId: string;
  className?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const PROVIDER_CONFIG: Record<ModelProvider, { color: string; bgColor: string; label: string }> = {
  openai: { color: 'text-green-600', bgColor: 'bg-green-100', label: 'OpenAI' },
  anthropic: { color: 'text-orange-600', bgColor: 'bg-orange-100', label: 'Anthropic' },
  google: { color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Google' },
  azure: { color: 'text-sky-600', bgColor: 'bg-sky-100', label: 'Azure' },
  custom: { color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Custom' },
};

const STATUS_CONFIG: Record<ModelStatus, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
  active: { icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Active' },
  deprecated: { icon: AlertTriangle, color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'Deprecated' },
  testing: { icon: Activity, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Testing' },
  disabled: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Disabled' },
};

const CAPABILITY_COLORS: Record<ModelCapability, string> = {
  extraction: 'bg-blue-100 text-blue-700',
  summarization: 'bg-purple-100 text-purple-700',
  classification: 'bg-green-100 text-green-700',
  comparison: 'bg-amber-100 text-amber-700',
  generation: 'bg-pink-100 text-pink-700',
  chat: 'bg-cyan-100 text-cyan-700',
  embedding: 'bg-indigo-100 text-indigo-700',
  analysis: 'bg-orange-100 text-orange-700',
};

// ============================================================================
// Demo Data Generators
// ============================================================================

function generateDemoModels(): RegisteredModel[] {
  const models: RegisteredModel[] = [
    {
      id: 'model-1',
      name: 'GPT-4o',
      provider: 'openai',
      modelId: 'gpt-4o',
      capabilities: ['extraction', 'summarization', 'classification', 'comparison', 'generation', 'chat', 'analysis'],
      maxTokens: 16384,
      contextWindow: 128000,
      currentVersion: '2024-05-13',
      versions: [
        {
          version: '2024-05-13',
          releaseDate: new Date('2024-05-13'),
          changelog: 'Latest production release with improved reasoning',
          isDefault: true,
          performance: {
            totalRequests: 125000,
            successRate: 0.987,
            avgLatencyMs: 2100,
            avgTokensPerRequest: 850,
            costPer1kTokens: 0.015,
            qualityScore: 0.94,
            userSatisfaction: 0.92,
          },
        },
      ],
      status: 'active',
      isDefault: true,
      registeredAt: new Date('2024-01-15'),
      lastUpdatedAt: new Date(),
    },
    {
      id: 'model-2',
      name: 'GPT-4o-mini',
      provider: 'openai',
      modelId: 'gpt-4o-mini',
      capabilities: ['extraction', 'summarization', 'classification', 'chat'],
      maxTokens: 16384,
      contextWindow: 128000,
      currentVersion: '2024-07-18',
      versions: [
        {
          version: '2024-07-18',
          releaseDate: new Date('2024-07-18'),
          changelog: 'Fast and cost-effective model for simpler tasks',
          isDefault: true,
          performance: {
            totalRequests: 89000,
            successRate: 0.992,
            avgLatencyMs: 800,
            avgTokensPerRequest: 420,
            costPer1kTokens: 0.00015,
            qualityScore: 0.88,
            userSatisfaction: 0.90,
          },
        },
      ],
      status: 'active',
      isDefault: false,
      registeredAt: new Date('2024-07-20'),
      lastUpdatedAt: new Date(),
    },
    {
      id: 'model-3',
      name: 'GPT-3.5-turbo',
      provider: 'openai',
      modelId: 'gpt-3.5-turbo',
      capabilities: ['summarization', 'classification', 'chat'],
      maxTokens: 4096,
      contextWindow: 16385,
      currentVersion: '0125',
      versions: [
        {
          version: '0125',
          releaseDate: new Date('2024-01-25'),
          changelog: 'Latest GPT-3.5 with improved accuracy',
          isDefault: true,
          performance: {
            totalRequests: 45000,
            successRate: 0.985,
            avgLatencyMs: 500,
            avgTokensPerRequest: 320,
            costPer1kTokens: 0.0005,
            qualityScore: 0.82,
            userSatisfaction: 0.85,
          },
        },
      ],
      status: 'deprecated',
      isDefault: false,
      registeredAt: new Date('2023-06-15'),
      lastUpdatedAt: new Date('2024-06-01'),
    },
    {
      id: 'model-4',
      name: 'text-embedding-3-small',
      provider: 'openai',
      modelId: 'text-embedding-3-small',
      capabilities: ['embedding'],
      maxTokens: 8191,
      contextWindow: 8191,
      currentVersion: '1.0',
      versions: [
        {
          version: '1.0',
          releaseDate: new Date('2024-01-25'),
          changelog: 'Efficient embedding model',
          isDefault: true,
          performance: {
            totalRequests: 250000,
            successRate: 0.999,
            avgLatencyMs: 150,
            avgTokensPerRequest: 200,
            costPer1kTokens: 0.00002,
            qualityScore: 0.91,
            userSatisfaction: 0.95,
          },
        },
      ],
      status: 'active',
      isDefault: true,
      registeredAt: new Date('2024-01-30'),
      lastUpdatedAt: new Date(),
    },
    {
      id: 'model-5',
      name: 'Claude Haiku 4.5',
      provider: 'anthropic',
      modelId: 'claude-3-5-haiku-20241022',
      capabilities: ['extraction', 'summarization', 'classification', 'chat'],
      maxTokens: 8192,
      contextWindow: 200000,
      currentVersion: '20241022',
      versions: [
        {
          version: '20241022',
          releaseDate: new Date('2024-10-22'),
          changelog: 'Lightning-fast model with excellent comprehension and real-time capabilities',
          isDefault: true,
          performance: {
            totalRequests: 35000,
            successRate: 0.995,
            avgLatencyMs: 300,
            avgTokensPerRequest: 380,
            costPer1kTokens: 0.0008,
            qualityScore: 0.90,
            userSatisfaction: 0.93,
          },
        },
      ],
      status: 'active',
      isDefault: false,
      registeredAt: new Date('2024-10-25'),
      lastUpdatedAt: new Date(),
    },
  ];

  return models;
}

function generateDemoABTests(): ABTest[] {
  return [
    {
      id: 'ab-1',
      name: 'GPT-4o vs GPT-4o-mini for Extraction',
      modelA: 'GPT-4o',
      modelB: 'GPT-4o-mini',
      trafficSplit: 0.5,
      status: 'running',
      startedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      results: {
        modelA: { requests: 1250, successRate: 0.987, avgLatency: 2100, satisfaction: 0.92 },
        modelB: { requests: 1180, successRate: 0.992, avgLatency: 800, satisfaction: 0.90 },
      },
    },
    {
      id: 'ab-2',
      name: 'Summarization Quality Test',
      modelA: 'GPT-4o',
      modelB: 'GPT-3.5-turbo',
      trafficSplit: 0.3,
      status: 'completed',
      startedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      results: {
        modelA: { requests: 3500, successRate: 0.989, avgLatency: 2200, satisfaction: 0.94 },
        modelB: { requests: 1500, successRate: 0.985, avgLatency: 520, satisfaction: 0.82 },
        winner: 'GPT-4o',
      },
    },
  ];
}

// ============================================================================
// Sub-Components
// ============================================================================

function StatCard({ 
  title, 
  value, 
  subtitle,
  icon: Icon, 
  color = 'blue',
  trend,
}: { 
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple';
  trend?: { value: number; positive: boolean };
}) {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    amber: 'text-amber-600 bg-amber-50',
    red: 'text-red-600 bg-red-50',
    purple: 'text-purple-600 bg-purple-50',
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
            {trend && (
              <div className={cn('flex items-center gap-1 mt-1 text-xs', trend.positive ? 'text-green-600' : 'text-red-600')}>
                {trend.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{trend.value}% vs last month</span>
              </div>
            )}
          </div>
          <div className={cn('p-2 rounded-lg', colorClasses[color])}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ModelCard({ 
  model, 
  onView,
  onToggle,
}: { 
  model: RegisteredModel;
  onView: () => void;
  onToggle: () => void;
}) {
  const providerConfig = PROVIDER_CONFIG[model.provider];
  const statusConfig = STATUS_CONFIG[model.status];
  const StatusIcon = statusConfig.icon;
  const latestPerf = model.versions[0]?.performance;

  return (
    <Card className={cn(
      'hover:shadow-md transition-shadow',
      model.isDefault && 'ring-2 ring-primary/50',
    )}>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {/* Icon & Status */}
          <div className={cn('p-3 rounded-xl', providerConfig.bgColor)}>
            <Sparkles className={cn('w-6 h-6', providerConfig.color)} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold">{model.name}</h3>
              {model.isDefault && (
                <Badge className="bg-primary/10 text-primary text-xs">
                  <Star className="w-3 h-3 mr-1" />
                  Default
                </Badge>
              )}
              <Badge className={cn('text-xs', statusConfig.bgColor)}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConfig.label}
              </Badge>
            </div>

            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span className={providerConfig.color}>{providerConfig.label}</span>
              <span>•</span>
              <span>{model.modelId}</span>
              <span>•</span>
              <span>v{model.currentVersion}</span>
            </div>

            {/* Capabilities */}
            <div className="flex flex-wrap gap-1 mt-2">
              {model.capabilities.slice(0, 4).map(cap => (
                <Badge key={cap} variant="outline" className={cn('text-xs', CAPABILITY_COLORS[cap])}>
                  {cap}
                </Badge>
              ))}
              {model.capabilities.length > 4 && (
                <Badge variant="outline" className="text-xs">+{model.capabilities.length - 4}</Badge>
              )}
            </div>

            {/* Performance Stats */}
            {latestPerf && (
              <div className="grid grid-cols-4 gap-3 mt-3 pt-3 border-t">
                <div className="text-center">
                  <p className="text-sm font-bold">{(latestPerf.successRate * 100).toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">Success</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold">{latestPerf.avgLatencyMs}ms</p>
                  <p className="text-xs text-muted-foreground">Latency</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold">${latestPerf.costPer1kTokens}</p>
                  <p className="text-xs text-muted-foreground">/1k tokens</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold">{(latestPerf.qualityScore * 100).toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground">Quality</p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1">
            <Button variant="ghost" size="sm" onClick={onView}>
              <Eye className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onToggle}
              className={model.status === 'active' ? 'text-amber-600' : 'text-green-600'}
            >
              {model.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ABTestCard({ test }: { test: ABTest }) {
  const statusConfig = {
    running: { icon: Play, color: 'text-green-600 bg-green-100' },
    paused: { icon: Pause, color: 'text-amber-600 bg-amber-100' },
    completed: { icon: CheckCircle2, color: 'text-blue-600 bg-blue-100' },
  };

  const config = statusConfig[test.status];
  const StatusIcon = config.icon;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="font-medium text-sm">{test.name}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Started {test.startedAt.toLocaleDateString()}
            </p>
          </div>
          <Badge className={cn('text-xs', config.color)}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {test.status}
          </Badge>
        </div>

        {/* Models Comparison */}
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div className={cn(
            'p-3 rounded-lg border',
            test.results?.winner === test.modelA && 'border-green-500 bg-green-50'
          )}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm">{test.modelA}</span>
              <span className="text-xs text-muted-foreground">{(test.trafficSplit * 100).toFixed(0)}%</span>
            </div>
            {test.results && (
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Requests</span>
                  <span>{test.results.modelA.requests}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Success</span>
                  <span>{(test.results.modelA.successRate * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Satisfaction</span>
                  <span>{(test.results.modelA.satisfaction * 100).toFixed(0)}%</span>
                </div>
              </div>
            )}
          </div>

          <div className={cn(
            'p-3 rounded-lg border',
            test.results?.winner === test.modelB && 'border-green-500 bg-green-50'
          )}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm">{test.modelB}</span>
              <span className="text-xs text-muted-foreground">{((1 - test.trafficSplit) * 100).toFixed(0)}%</span>
            </div>
            {test.results && (
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Requests</span>
                  <span>{test.results.modelB.requests}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Success</span>
                  <span>{(test.results.modelB.successRate * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Satisfaction</span>
                  <span>{(test.results.modelB.satisfaction * 100).toFixed(0)}%</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {test.results?.winner && (
          <div className="flex items-center gap-2 p-2 rounded bg-green-50 text-green-700 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span className="font-medium">{test.results.winner}</span>
            <span className="text-green-600">is the winner!</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PerformanceChart({ models }: { models: RegisteredModel[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Model Performance Comparison</CardTitle>
        <CardDescription>Key metrics across registered models</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {models.filter(m => m.status === 'active').map(model => {
            const perf = model.versions[0]?.performance;
            if (!perf) return null;

            return (
              <div key={model.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{model.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {(perf.qualityScore * 100).toFixed(0)}% quality
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Success Rate</span>
                      <span>{(perf.successRate * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={perf.successRate * 100} className="h-1.5" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">User Satisfaction</span>
                      <span>{(perf.userSatisfaction * 100).toFixed(0)}%</span>
                    </div>
                    <Progress value={perf.userSatisfaction * 100} className="h-1.5" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Quality Score</span>
                      <span>{(perf.qualityScore * 100).toFixed(0)}%</span>
                    </div>
                    <Progress value={perf.qualityScore * 100} className="h-1.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ModelRegistryDashboard({ tenantId, className }: ModelRegistryDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [models, setModels] = useState<RegisteredModel[]>([]);
  const [abTests, setABTests] = useState<ABTest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      setModels(generateDemoModels());
      setABTests(generateDemoABTests());
      setLoading(false);
    };
    loadData();
  }, [tenantId]);

  const filteredModels = models.filter(m => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    if (providerFilter !== 'all' && m.provider !== providerFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return m.name.toLowerCase().includes(query) || m.modelId.toLowerCase().includes(query);
    }
    return true;
  });

  const totalRequests = models.reduce((sum, m) => sum + (m.versions[0]?.performance.totalRequests || 0), 0);
  const avgSuccessRate = models.length > 0 
    ? models.reduce((sum, m) => sum + (m.versions[0]?.performance.successRate || 0), 0) / models.length 
    : 0;
  const activeModels = models.filter(m => m.status === 'active').length;

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center min-h-[400px]', className)}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground mt-2">Loading model registry...</p>
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
            <Cpu className="w-6 h-6 text-primary" />
            AI Model Registry
          </h1>
          <p className="text-muted-foreground text-sm">Manage, monitor, and optimize AI models</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Register Model
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <StatCard
          title="Registered Models"
          value={models.length}
          subtitle={`${activeModels} active`}
          icon={Sparkles}
          color="purple"
        />
        <StatCard
          title="Total Requests"
          value={`${(totalRequests / 1000).toFixed(0)}K`}
          subtitle="Last 30 days"
          icon={Activity}
          color="blue"
          trend={{ value: 18, positive: true }}
        />
        <StatCard
          title="Avg Success Rate"
          value={`${(avgSuccessRate * 100).toFixed(1)}%`}
          icon={CheckCircle2}
          color="green"
        />
        <StatCard
          title="Active A/B Tests"
          value={abTests.filter(t => t.status === 'running').length}
          icon={GitBranch}
          color="amber"
        />
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="models" className="gap-2">
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Models</span>
          </TabsTrigger>
          <TabsTrigger value="experiments" className="gap-2">
            <GitBranch className="w-4 h-4" />
            <span className="hidden sm:inline">A/B Tests</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PerformanceChart models={models} />

            {/* Active A/B Tests */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <GitBranch className="w-4 h-4" />
                  Active Experiments
                </CardTitle>
                <CardDescription>Running A/B tests comparing models</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {abTests.filter(t => t.status === 'running').map(test => (
                    <ABTestCard key={test.id} test={test} />
                  ))}
                  {abTests.filter(t => t.status === 'running').length === 0 && (
                    <p className="text-center text-muted-foreground py-4">No active experiments</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Default Models */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Default Models by Capability</CardTitle>
              <CardDescription>Recommended models for each use case</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(['extraction', 'summarization', 'classification', 'chat'] as ModelCapability[]).map(cap => {
                  const defaultModel = models.find(m => 
                    m.isDefault && m.capabilities.includes(cap) && m.status === 'active'
                  );
                  return (
                    <div key={cap} className="p-3 rounded-lg border">
                      <Badge variant="outline" className={cn('text-xs mb-2', CAPABILITY_COLORS[cap])}>
                        {cap}
                      </Badge>
                      {defaultModel ? (
                        <>
                          <p className="font-medium text-sm">{defaultModel.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(defaultModel.versions[0]?.performance.qualityScore * 100).toFixed(0)}% quality
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">No default set</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Models Tab */}
        <TabsContent value="models" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search models..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                      <SelectItem key={status} value={status}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={providerFilter} onValueChange={setProviderFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Providers</SelectItem>
                    {Object.entries(PROVIDER_CONFIG).map(([provider, config]) => (
                      <SelectItem key={provider} value={provider}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Models Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {filteredModels.map(model => (
              <ModelCard
                key={model.id}
                model={model}
                onView={() => {}}
                onToggle={() => {}}
              />
            ))}
            {filteredModels.length === 0 && (
              <Card className="md:col-span-2">
                <CardContent className="py-12 text-center">
                  <Sparkles className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="font-medium">No models found</p>
                  <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Experiments Tab */}
        <TabsContent value="experiments" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">A/B Test Experiments</h3>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              New Experiment
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {abTests.map(test => (
              <ABTestCard key={test.id} test={test} />
            ))}
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Model Registry Settings</CardTitle>
              <CardDescription>Configure default behaviors and quotas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Default Fallback Model</label>
                  <Select defaultValue="gpt-4o-mini">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {models.filter(m => m.status === 'active').map(m => (
                        <SelectItem key={m.id} value={m.modelId}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Used when primary model is unavailable</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Auto-Deprecation Threshold</label>
                  <Select defaultValue="0.90">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.95">95% success rate</SelectItem>
                      <SelectItem value="0.90">90% success rate</SelectItem>
                      <SelectItem value="0.85">85% success rate</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Automatically deprecate underperforming models</p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button>Save Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ModelRegistryDashboard;
