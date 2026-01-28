'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  FlaskConical,
  Play,
  Pause,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  Plus,
  Settings2,
  Trophy,
  AlertTriangle,
  Clock,
  Users,
  Percent,
  Target,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

interface Experiment {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  type: 'extraction' | 'prompt' | 'model' | 'threshold';
  startDate?: Date;
  endDate?: Date;
  variants: Variant[];
  metrics: ExperimentMetrics;
  winner?: string;
  trafficAllocation: number;
}

interface Variant {
  id: string;
  name: string;
  description: string;
  isControl: boolean;
  trafficPercent: number;
  config: Record<string, unknown>;
}

interface ExperimentMetrics {
  totalSamples: number;
  byVariant: Record<string, VariantMetrics>;
}

interface VariantMetrics {
  samples: number;
  accuracy: number;
  latencyMs: number;
  costPerExtraction: number;
  userSatisfaction: number;
  confidenceInterval: [number, number];
  significanceLevel: number;
}

// =============================================================================
// MOCK DATA
// =============================================================================

const mockExperiments: Experiment[] = [
  {
    id: 'exp1',
    name: 'GPT-4o vs GPT-4o-mini for Date Extraction',
    description: 'Compare extraction accuracy and cost between GPT-4o and GPT-4o-mini for date fields',
    status: 'running',
    type: 'model',
    startDate: new Date(Date.now() - 7 * 86400000),
    variants: [
      { id: 'v1', name: 'GPT-4o (Control)', description: 'Current production model', isControl: true, trafficPercent: 50, config: { model: 'gpt-4o' } },
      { id: 'v2', name: 'GPT-4o-mini', description: 'Faster, cheaper alternative', isControl: false, trafficPercent: 50, config: { model: 'gpt-4o-mini' } },
    ],
    metrics: {
      totalSamples: 1247,
      byVariant: {
        v1: { samples: 623, accuracy: 0.94, latencyMs: 2100, costPerExtraction: 0.015, userSatisfaction: 4.2, confidenceInterval: [0.92, 0.96], significanceLevel: 0.95 },
        v2: { samples: 624, accuracy: 0.91, latencyMs: 890, costPerExtraction: 0.003, userSatisfaction: 4.0, confidenceInterval: [0.88, 0.94], significanceLevel: 0.92 },
      },
    },
    trafficAllocation: 100,
  },
  {
    id: 'exp2',
    name: 'Enhanced Prompt for Financial Terms',
    description: 'Test new prompt template with additional context for financial field extraction',
    status: 'running',
    type: 'prompt',
    startDate: new Date(Date.now() - 14 * 86400000),
    variants: [
      { id: 'v1', name: 'Current Prompt', description: 'Existing extraction prompt', isControl: true, trafficPercent: 50, config: { promptVersion: '1.0' } },
      { id: 'v2', name: 'Enhanced Prompt', description: 'New prompt with currency hints', isControl: false, trafficPercent: 50, config: { promptVersion: '2.0' } },
    ],
    metrics: {
      totalSamples: 2156,
      byVariant: {
        v1: { samples: 1078, accuracy: 0.82, latencyMs: 1800, costPerExtraction: 0.012, userSatisfaction: 3.8, confidenceInterval: [0.79, 0.85], significanceLevel: 0.94 },
        v2: { samples: 1078, accuracy: 0.89, latencyMs: 1950, costPerExtraction: 0.014, userSatisfaction: 4.3, confidenceInterval: [0.86, 0.92], significanceLevel: 0.97 },
      },
    },
    trafficAllocation: 100,
    winner: 'v2',
  },
  {
    id: 'exp3',
    name: 'Confidence Threshold Optimization',
    description: 'Find optimal confidence threshold for auto-acceptance',
    status: 'completed',
    type: 'threshold',
    startDate: new Date(Date.now() - 30 * 86400000),
    endDate: new Date(Date.now() - 7 * 86400000),
    variants: [
      { id: 'v1', name: '80% Threshold', description: 'Current threshold', isControl: true, trafficPercent: 33, config: { threshold: 0.80 } },
      { id: 'v2', name: '85% Threshold', description: 'Higher threshold', isControl: false, trafficPercent: 33, config: { threshold: 0.85 } },
      { id: 'v3', name: '90% Threshold', description: 'Strictest threshold', isControl: false, trafficPercent: 34, config: { threshold: 0.90 } },
    ],
    metrics: {
      totalSamples: 5432,
      byVariant: {
        v1: { samples: 1811, accuracy: 0.76, latencyMs: 1200, costPerExtraction: 0.01, userSatisfaction: 3.5, confidenceInterval: [0.73, 0.79], significanceLevel: 0.99 },
        v2: { samples: 1810, accuracy: 0.84, latencyMs: 1200, costPerExtraction: 0.01, userSatisfaction: 4.1, confidenceInterval: [0.81, 0.87], significanceLevel: 0.99 },
        v3: { samples: 1811, accuracy: 0.91, latencyMs: 1200, costPerExtraction: 0.01, userSatisfaction: 4.4, confidenceInterval: [0.88, 0.94], significanceLevel: 0.99 },
      },
    },
    trafficAllocation: 0,
    winner: 'v3',
  },
  {
    id: 'exp4',
    name: 'RAG Context Window Size',
    description: 'Test different context window sizes for RAG retrieval',
    status: 'draft',
    type: 'extraction',
    variants: [
      { id: 'v1', name: '4K Context', description: 'Current window size', isControl: true, trafficPercent: 50, config: { contextSize: 4000 } },
      { id: 'v2', name: '8K Context', description: 'Larger context window', isControl: false, trafficPercent: 50, config: { contextSize: 8000 } },
    ],
    metrics: {
      totalSamples: 0,
      byVariant: {},
    },
    trafficAllocation: 0,
  },
];

// =============================================================================
// COMPONENTS
// =============================================================================

function StatusBadge({ status }: { status: Experiment['status'] }) {
  const config = {
    draft: { label: 'Draft', variant: 'outline' as const, icon: Settings2 },
    running: { label: 'Running', variant: 'default' as const, icon: Play },
    paused: { label: 'Paused', variant: 'secondary' as const, icon: Pause },
    completed: { label: 'Completed', variant: 'outline' as const, icon: CheckCircle2 },
  };
  
  const { label, variant, icon: Icon } = config[status];
  
  return (
    <Badge variant={variant} className={status === 'running' ? 'bg-green-600' : ''}>
      <Icon className="h-3 w-3 mr-1" />
      {label}
    </Badge>
  );
}

function MetricCard({ 
  label, 
  value, 
  subValue,
  icon: Icon,
  highlight 
}: { 
  label: string; 
  value: string; 
  subValue?: string;
  icon: React.ElementType;
  highlight?: boolean;
}) {
  return (
    <div className={`p-3 rounded-lg ${highlight ? 'bg-green-50 dark:bg-green-950/30 border border-green-200' : 'bg-muted/50'}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="text-lg font-semibold">{value}</div>
      {subValue && <div className="text-xs text-muted-foreground">{subValue}</div>}
    </div>
  );
}

function VariantCard({ 
  variant, 
  metrics,
  isWinner 
}: { 
  variant: Variant; 
  metrics?: VariantMetrics;
  isWinner?: boolean;
}) {
  return (
    <Card className={isWinner ? 'border-green-500 bg-green-50/50 dark:bg-green-950/20' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            {variant.name}
            {variant.isControl && <Badge variant="outline">Control</Badge>}
            {isWinner && (
              <Badge className="bg-green-600">
                <Trophy className="h-3 w-3 mr-1" />
                Winner
              </Badge>
            )}
          </CardTitle>
          <span className="text-sm text-muted-foreground">{variant.trafficPercent}% traffic</span>
        </div>
        <CardDescription>{variant.description}</CardDescription>
      </CardHeader>
      {metrics && (
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <MetricCard 
              label="Accuracy" 
              value={`${Math.round(metrics.accuracy * 100)}%`}
              subValue={`CI: ${Math.round(metrics.confidenceInterval[0] * 100)}-${Math.round(metrics.confidenceInterval[1] * 100)}%`}
              icon={Target}
              highlight={isWinner}
            />
            <MetricCard 
              label="Latency" 
              value={`${metrics.latencyMs}ms`}
              icon={Clock}
            />
            <MetricCard 
              label="Cost" 
              value={`$${metrics.costPerExtraction.toFixed(3)}`}
              subValue="per extraction"
              icon={Sparkles}
            />
            <MetricCard 
              label="Satisfaction" 
              value={`${metrics.userSatisfaction.toFixed(1)}/5`}
              subValue={`${metrics.samples} samples`}
              icon={Users}
            />
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span>Statistical Significance</span>
              <span className={metrics.significanceLevel >= 0.95 ? 'text-green-600 font-medium' : ''}>
                {Math.round(metrics.significanceLevel * 100)}%
              </span>
            </div>
            <Progress 
              value={metrics.significanceLevel * 100} 
              className={`h-2 ${metrics.significanceLevel >= 0.95 ? '[&>div]:bg-green-600' : ''}`}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function ABTestingPage() {
  const [experiments, setExperiments] = useState<Experiment[]>(mockExperiments);
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const handleToggleExperiment = (expId: string) => {
    setExperiments(prev => prev.map(exp => {
      if (exp.id === expId) {
        const newStatus = exp.status === 'running' ? 'paused' : 'running';
        toast.success(`Experiment ${newStatus === 'running' ? 'started' : 'paused'}`);
        return { ...exp, status: newStatus };
      }
      return exp;
    }));
  };

  const handleDeclareWinner = (expId: string, variantId: string) => {
    setExperiments(prev => prev.map(exp => {
      if (exp.id === expId) {
        toast.success('Winner declared and applied to production!');
        return { ...exp, status: 'completed', winner: variantId };
      }
      return exp;
    }));
  };

  const filteredExperiments = experiments.filter(exp => {
    if (filter === 'all') return true;
    return exp.status === filter;
  });

  const runningCount = experiments.filter(e => e.status === 'running').length;
  const completedCount = experiments.filter(e => e.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FlaskConical className="h-8 w-8 text-primary" />
            A/B Testing
          </h1>
          <p className="text-muted-foreground">
            Run experiments to optimize AI extraction performance
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Experiment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Experiment</DialogTitle>
              <DialogDescription>
                Set up a new A/B test to compare extraction strategies
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Experiment Name</Label>
                <Input placeholder="e.g., GPT-4 vs Claude for Clauses" />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="model">Model Comparison</SelectItem>
                    <SelectItem value="prompt">Prompt Optimization</SelectItem>
                    <SelectItem value="threshold">Threshold Testing</SelectItem>
                    <SelectItem value="extraction">Extraction Strategy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Traffic Allocation</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" defaultValue={100} className="w-20" />
                  <span className="text-sm text-muted-foreground">% of extractions</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                setShowCreateDialog(false);
                toast.success('Experiment created as draft');
              }}>
                Create Draft
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <Play className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{runningCount}</div>
            <p className="text-xs text-muted-foreground">Active experiments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-violet-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCount}</div>
            <p className="text-xs text-muted-foreground">With declared winners</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Samples</CardTitle>
            <BarChart3 className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {experiments.reduce((sum, e) => sum + e.metrics.totalSamples, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Across all experiments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Improvement</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">+8.3%</div>
            <p className="text-xs text-muted-foreground">From winning variants</p>
          </CardContent>
        </Card>
      </div>

      {/* Experiments List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Experiments</CardTitle>
              <CardDescription>Manage your A/B tests and view results</CardDescription>
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredExperiments.map((experiment) => (
              <Card key={experiment.id} className="overflow-hidden">
                <div 
                  className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedExperiment(
                    selectedExperiment?.id === experiment.id ? null : experiment
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{experiment.name}</h3>
                        <StatusBadge status={experiment.status} />
                        <Badge variant="outline">{experiment.type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{experiment.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {experiment.metrics.totalSamples.toLocaleString()} samples
                        </span>
                        <span className="flex items-center gap-1">
                          <Percent className="h-3 w-3" />
                          {experiment.trafficAllocation}% traffic
                        </span>
                        {experiment.startDate && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Started {formatDate(experiment.startDate)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {experiment.status !== 'completed' && experiment.status !== 'draft' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleExperiment(experiment.id);
                          }}
                        >
                          {experiment.status === 'running' ? (
                            <>
                              <Pause className="h-3 w-3 mr-1" />
                              Pause
                            </>
                          ) : (
                            <>
                              <Play className="h-3 w-3 mr-1" />
                              Resume
                            </>
                          )}
                        </Button>
                      )}
                      {experiment.status === 'draft' && (
                        <Button 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleExperiment(experiment.id);
                          }}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Start
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Expanded View */}
                {selectedExperiment?.id === experiment.id && (
                  <div className="border-t bg-muted/30 p-4 space-y-4">
                    <h4 className="font-medium">Variants & Results</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      {experiment.variants.map((variant) => (
                        <VariantCard
                          key={variant.id}
                          variant={variant}
                          metrics={experiment.metrics.byVariant[variant.id]}
                          isWinner={experiment.winner === variant.id}
                        />
                      ))}
                    </div>
                    
                    {experiment.status === 'running' && experiment.metrics.totalSamples >= 100 && (
                      <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          <span className="text-sm">
                            Sufficient data collected. Ready to declare winner?
                          </span>
                        </div>
                        <div className="flex gap-2">
                          {experiment.variants.map((variant) => (
                            <Button
                              key={variant.id}
                              size="sm"
                              variant={variant.isControl ? 'outline' : 'default'}
                              onClick={() => handleDeclareWinner(experiment.id, variant.id)}
                            >
                              <Trophy className="h-3 w-3 mr-1" />
                              {variant.name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper function
function formatDate(date: Date): string {
  const days = Math.floor((new Date().getTime() - date.getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
}
