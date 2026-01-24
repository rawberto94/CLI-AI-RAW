'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Cpu,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  Target,
  Zap,
  BarChart3,
  RefreshCw,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  Brain,
  Scale,
} from 'lucide-react';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

interface ModelPerformance {
  id: string;
  name: string;
  provider: string;
  version: string;
  status: 'active' | 'testing' | 'deprecated';
  metrics: {
    accuracy: number;
    accuracyTrend: 'up' | 'down' | 'stable';
    latencyMs: number;
    latencyTrend: 'up' | 'down' | 'stable';
    costPer1kTokens: number;
    totalCost30d: number;
    extractionsCount: number;
    errorRate: number;
    avgConfidence: number;
  };
  fieldPerformance: Record<string, { accuracy: number; samples: number }>;
  contractTypePerformance: Record<string, { accuracy: number; samples: number }>;
  lastUsed: Date;
}

// =============================================================================
// MOCK DATA
// =============================================================================

const mockModels: ModelPerformance[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    version: '2024-05-13',
    status: 'active',
    metrics: {
      accuracy: 0.943,
      accuracyTrend: 'up',
      latencyMs: 2100,
      latencyTrend: 'stable',
      costPer1kTokens: 0.015,
      totalCost30d: 847.32,
      extractionsCount: 45230,
      errorRate: 0.012,
      avgConfidence: 0.91,
    },
    fieldPerformance: {
      'effective_date': { accuracy: 0.97, samples: 8450 },
      'expiration_date': { accuracy: 0.95, samples: 7890 },
      'total_value': { accuracy: 0.92, samples: 6720 },
      'payment_terms': { accuracy: 0.89, samples: 5430 },
      'termination_notice': { accuracy: 0.91, samples: 4560 },
      'liability_cap': { accuracy: 0.88, samples: 3210 },
    },
    contractTypePerformance: {
      'SERVICE_AGREEMENT': { accuracy: 0.95, samples: 18500 },
      'PROCUREMENT': { accuracy: 0.94, samples: 12300 },
      'LICENSING': { accuracy: 0.93, samples: 8900 },
      'EMPLOYMENT': { accuracy: 0.91, samples: 5530 },
    },
    lastUsed: new Date(),
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o-mini',
    provider: 'OpenAI',
    version: '2024-07-18',
    status: 'active',
    metrics: {
      accuracy: 0.912,
      accuracyTrend: 'up',
      latencyMs: 890,
      latencyTrend: 'down',
      costPer1kTokens: 0.003,
      totalCost30d: 156.78,
      extractionsCount: 38920,
      errorRate: 0.018,
      avgConfidence: 0.87,
    },
    fieldPerformance: {
      'effective_date': { accuracy: 0.94, samples: 7200 },
      'expiration_date': { accuracy: 0.92, samples: 6890 },
      'total_value': { accuracy: 0.88, samples: 5720 },
      'payment_terms': { accuracy: 0.84, samples: 4830 },
      'termination_notice': { accuracy: 0.86, samples: 3960 },
      'liability_cap': { accuracy: 0.82, samples: 2810 },
    },
    contractTypePerformance: {
      'SERVICE_AGREEMENT': { accuracy: 0.93, samples: 15800 },
      'PROCUREMENT': { accuracy: 0.91, samples: 10500 },
      'LICENSING': { accuracy: 0.90, samples: 7600 },
      'EMPLOYMENT': { accuracy: 0.88, samples: 5020 },
    },
    lastUsed: new Date(),
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    version: '20240620',
    status: 'testing',
    metrics: {
      accuracy: 0.951,
      accuracyTrend: 'stable',
      latencyMs: 1850,
      latencyTrend: 'stable',
      costPer1kTokens: 0.012,
      totalCost30d: 234.56,
      extractionsCount: 12450,
      errorRate: 0.008,
      avgConfidence: 0.93,
    },
    fieldPerformance: {
      'effective_date': { accuracy: 0.98, samples: 2340 },
      'expiration_date': { accuracy: 0.96, samples: 2120 },
      'total_value': { accuracy: 0.94, samples: 1890 },
      'payment_terms': { accuracy: 0.92, samples: 1670 },
      'termination_notice': { accuracy: 0.93, samples: 1430 },
      'liability_cap': { accuracy: 0.91, samples: 1200 },
    },
    contractTypePerformance: {
      'SERVICE_AGREEMENT': { accuracy: 0.96, samples: 5200 },
      'PROCUREMENT': { accuracy: 0.95, samples: 3400 },
      'LICENSING': { accuracy: 0.94, samples: 2450 },
      'EMPLOYMENT': { accuracy: 0.93, samples: 1400 },
    },
    lastUsed: new Date(Date.now() - 3600000),
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'OpenAI',
    version: '0125',
    status: 'deprecated',
    metrics: {
      accuracy: 0.823,
      accuracyTrend: 'down',
      latencyMs: 650,
      latencyTrend: 'stable',
      costPer1kTokens: 0.001,
      totalCost30d: 23.45,
      extractionsCount: 2340,
      errorRate: 0.034,
      avgConfidence: 0.79,
    },
    fieldPerformance: {
      'effective_date': { accuracy: 0.89, samples: 450 },
      'expiration_date': { accuracy: 0.86, samples: 420 },
      'total_value': { accuracy: 0.78, samples: 380 },
      'payment_terms': { accuracy: 0.74, samples: 320 },
      'termination_notice': { accuracy: 0.76, samples: 290 },
      'liability_cap': { accuracy: 0.72, samples: 240 },
    },
    contractTypePerformance: {
      'SERVICE_AGREEMENT': { accuracy: 0.84, samples: 980 },
      'PROCUREMENT': { accuracy: 0.82, samples: 650 },
      'LICENSING': { accuracy: 0.80, samples: 420 },
      'EMPLOYMENT': { accuracy: 0.78, samples: 290 },
    },
    lastUsed: new Date(Date.now() - 7 * 86400000),
  },
];

// =============================================================================
// COMPONENTS
// =============================================================================

function TrendIcon({ trend, size = 'sm' }: { trend: 'up' | 'down' | 'stable'; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  if (trend === 'up') return <ArrowUpRight className={`${sizeClass} text-green-600`} />;
  if (trend === 'down') return <ArrowDownRight className={`${sizeClass} text-red-600`} />;
  return <Minus className={`${sizeClass} text-gray-400`} />;
}

function StatusBadge({ status }: { status: ModelPerformance['status'] }) {
  const config = {
    active: { label: 'Active', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    testing: { label: 'Testing', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
    deprecated: { label: 'Deprecated', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
  };
  
  return (
    <Badge variant="outline" className={config[status].className}>
      {config[status].label}
    </Badge>
  );
}

function AccuracyBar({ accuracy, samples }: { accuracy: number; samples: number }) {
  const percentage = Math.round(accuracy * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-24">
        <Progress value={percentage} className="h-2" />
      </div>
      <span className="text-sm font-medium w-12">{percentage}%</span>
      <span className="text-xs text-muted-foreground">({samples.toLocaleString()})</span>
    </div>
  );
}

function CostEfficiencyScore({ model }: { model: ModelPerformance }) {
  // Calculate cost-efficiency: (accuracy * 100) / (cost per extraction * 1000)
  const avgTokensPerExtraction = 2000;
  const costPerExtraction = (model.metrics.costPer1kTokens / 1000) * avgTokensPerExtraction;
  const score = (model.metrics.accuracy * 100) / (costPerExtraction * 1000);
  
  return (
    <div className="flex items-center gap-1">
      <Scale className="h-3 w-3 text-muted-foreground" />
      <span className="font-mono text-sm">{score.toFixed(1)}</span>
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function ModelPerformancePage() {
  const [models] = useState<ModelPerformance[]>(mockModels);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>('30d');
  const [compareMode, setCompareMode] = useState(false);
  const [comparedModels, setComparedModels] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
    toast.success('Model metrics refreshed');
  };

  const handleExport = () => {
    toast.success('Performance report exported');
  };

  const toggleModelComparison = (modelId: string) => {
    setComparedModels(prev => {
      if (prev.includes(modelId)) {
        return prev.filter(id => id !== modelId);
      }
      if (prev.length >= 3) {
        toast.info('Maximum 3 models can be compared');
        return prev;
      }
      return [...prev, modelId];
    });
  };

  const activeModels = models.filter(m => m.status === 'active');
  const totalExtractions = models.reduce((sum, m) => sum + m.metrics.extractionsCount, 0);
  const totalCost = models.reduce((sum, m) => sum + m.metrics.totalCost30d, 0);
  const avgAccuracy = models.filter(m => m.status === 'active').reduce((sum, m) => sum + m.metrics.accuracy, 0) / activeModels.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Cpu className="h-8 w-8 text-primary" />
            Model Performance
          </h1>
          <p className="text-muted-foreground">
            Compare AI model accuracy, cost, and performance across extraction tasks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Models</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeModels.length}</div>
            <p className="text-xs text-muted-foreground">of {models.length} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Extractions</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalExtractions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Accuracy</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(avgAccuracy * 100)}%</div>
            <p className="text-xs text-green-600 flex items-center gap-1">
              <TrendIcon trend="up" />
              +2.3% vs last period
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Models Comparison Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Model Comparison</CardTitle>
              <CardDescription>
                Side-by-side comparison of all AI models used for extraction
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Accuracy</TableHead>
                <TableHead>Latency</TableHead>
                <TableHead>Cost/1K Tokens</TableHead>
                <TableHead>30d Cost</TableHead>
                <TableHead>Extractions</TableHead>
                <TableHead>Error Rate</TableHead>
                <TableHead>Cost Efficiency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {models.map((model) => (
                <TableRow 
                  key={model.id}
                  className={`cursor-pointer ${selectedModel === model.id ? 'bg-muted' : ''}`}
                  onClick={() => setSelectedModel(selectedModel === model.id ? null : model.id)}
                >
                  <TableCell>
                    <div>
                      <div className="font-medium">{model.name}</div>
                      <div className="text-xs text-muted-foreground">{model.provider} • {model.version}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={model.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{Math.round(model.metrics.accuracy * 100)}%</span>
                      <TrendIcon trend={model.metrics.accuracyTrend} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span>{model.metrics.latencyMs}ms</span>
                      <TrendIcon trend={model.metrics.latencyTrend} />
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">
                    ${model.metrics.costPer1kTokens.toFixed(3)}
                  </TableCell>
                  <TableCell className="font-mono">
                    ${model.metrics.totalCost30d.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {model.metrics.extractionsCount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <span className={model.metrics.errorRate > 0.02 ? 'text-red-600' : ''}>
                      {(model.metrics.errorRate * 100).toFixed(2)}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <CostEfficiencyScore model={model} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detailed View */}
      {selectedModel && (
        <div className="grid gap-4 md:grid-cols-2">
          {(() => {
            const model = models.find(m => m.id === selectedModel)!;
            return (
              <>
                {/* Field Performance */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Field Performance - {model.name}</CardTitle>
                    <CardDescription>Accuracy breakdown by extracted field</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Object.entries(model.fieldPerformance)
                        .sort(([, a], [, b]) => b.accuracy - a.accuracy)
                        .map(([field, perf]) => (
                          <div key={field} className="flex items-center justify-between">
                            <span className="text-sm capitalize">
                              {field.replace(/_/g, ' ')}
                            </span>
                            <AccuracyBar accuracy={perf.accuracy} samples={perf.samples} />
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Contract Type Performance */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Contract Type Performance - {model.name}</CardTitle>
                    <CardDescription>Accuracy breakdown by contract category</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Object.entries(model.contractTypePerformance)
                        .sort(([, a], [, b]) => b.accuracy - a.accuracy)
                        .map(([type, perf]) => (
                          <div key={type} className="flex items-center justify-between">
                            <span className="text-sm">
                              {type.replace(/_/g, ' ')}
                            </span>
                            <AccuracyBar accuracy={perf.accuracy} samples={perf.samples} />
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </div>
      )}

      {/* Recommendation Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
        <CardContent className="py-4">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-medium mb-1">Recommendation</h3>
              <p className="text-sm text-muted-foreground">
                Based on current performance data, <strong>Claude 3.5 Sonnet</strong> shows the highest accuracy (95.1%) 
                with competitive cost. Consider gradually increasing its traffic allocation through an A/B test 
                to validate performance at scale before full rollout.
              </p>
              <Button size="sm" variant="outline" className="mt-3">
                <FlaskConical className="h-3 w-3 mr-2" />
                Create A/B Test
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Import for A/B test button
import { FlaskConical } from 'lucide-react';
