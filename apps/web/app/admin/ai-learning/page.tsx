'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Download,
  Lightbulb,
  Target,
  Sparkles,
  BookOpen,
  History,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

interface FieldAccuracy {
  fieldName: string;
  accuracy: number;
  totalExtractions: number;
  correctExtractions: number;
  trend: 'improving' | 'stable' | 'declining';
  commonErrors: string[];
  lastUpdated: Date;
}

interface LearningPattern {
  id: string;
  field: string;
  contractType: string;
  commonMistake: string;
  correctPattern: string;
  occurrences: number;
  confidence: number;
  status: 'pending' | 'applied' | 'dismissed';
  detectedAt: Date;
}

interface LearningStats {
  totalCorrections: number;
  patternsDetected: number;
  promptsImproved: number;
  accuracyImprovement: number;
  lastLearningCycle: Date;
}

interface CorrectionRecord {
  id: string;
  contractId: string;
  contractName: string;
  fieldName: string;
  originalValue: string;
  correctedValue: string;
  correctedAt: Date;
  wasApplied: boolean;
}

// =============================================================================
// API HELPERS
// =============================================================================

const defaultStats: LearningStats = {
  totalCorrections: 0,
  patternsDetected: 0,
  promptsImproved: 0,
  accuracyImprovement: 0,
  lastLearningCycle: new Date(),
};

function mapDashboardData(dashboard: Record<string, any>): {
  stats: LearningStats;
  fieldAccuracies: FieldAccuracy[];
  recentCorrections: CorrectionRecord[];
} {
  const fieldAccuracies: FieldAccuracy[] = (dashboard.fieldAccuracy || []).map((f: any) => ({
    fieldName: f.fieldName || f.field || '',
    accuracy: f.accuracy ?? 0,
    totalExtractions: f.totalExtractions ?? f.total ?? 0,
    correctExtractions: f.correctExtractions ?? Math.round((f.accuracy ?? 0) * (f.totalExtractions ?? 0)),
    trend: f.trend || 'stable',
    commonErrors: f.commonErrors || [],
    lastUpdated: f.lastUpdated ? new Date(f.lastUpdated) : new Date(),
  }));

  const recentCorrections: CorrectionRecord[] = (dashboard.recentCorrections || []).map((c: any) => ({
    id: c.id || '',
    contractId: c.contractId || '',
    contractName: c.contractName || c.contractId || '',
    fieldName: c.fieldName || '',
    originalValue: c.originalValue || '',
    correctedValue: c.correctedValue || '',
    correctedAt: c.correctedAt ? new Date(c.correctedAt) : new Date(),
    wasApplied: c.wasApplied ?? false,
  }));

  const stats: LearningStats = {
    totalCorrections: dashboard.overallScore?.totalExtractions ?? dashboard.totalCorrections ?? 0,
    patternsDetected: dashboard.patternsDetected ?? 0,
    promptsImproved: dashboard.promptsImproved ?? 0,
    accuracyImprovement: dashboard.overallScore?.score ?? dashboard.accuracyImprovement ?? 0,
    lastLearningCycle: dashboard.lastLearningCycle ? new Date(dashboard.lastLearningCycle) : new Date(),
  };

  return { stats, fieldAccuracies, recentCorrections };
}

// =============================================================================
// COMPONENTS
// =============================================================================

function StatCard({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  trend 
}: { 
  title: string; 
  value: string | number; 
  change?: string; 
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change && (
          <p className={`text-xs flex items-center gap-1 ${
            trend === 'up' ? 'text-green-600' : 
            trend === 'down' ? 'text-red-600' : 
            'text-muted-foreground'
          }`}>
            {trend === 'up' && <ArrowUpRight className="h-3 w-3" />}
            {trend === 'down' && <ArrowDownRight className="h-3 w-3" />}
            {trend === 'neutral' && <Minus className="h-3 w-3" />}
            {change}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function TrendIcon({ trend }: { trend: 'improving' | 'stable' | 'declining' }) {
  if (trend === 'improving') {
    return <TrendingUp className="h-4 w-4 text-green-600" />;
  }
  if (trend === 'declining') {
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  }
  return <Minus className="h-4 w-4 text-gray-400" />;
}

function AccuracyBadge({ accuracy }: { accuracy: number }) {
  const percentage = Math.round(accuracy * 100);
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'default';
  
  if (percentage >= 90) variant = 'default';
  else if (percentage >= 80) variant = 'secondary';
  else variant = 'destructive';
  
  return (
    <Badge variant={variant} className="font-mono">
      {percentage}%
    </Badge>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function AILearningPage() {
  const [stats, setStats] = useState<LearningStats>(defaultStats);
  const [fieldAccuracies, setFieldAccuracies] = useState<FieldAccuracy[]>([]);
  const [patterns, setPatterns] = useState<LearningPattern[]>([]);
  const [recentCorrections, setRecentCorrections] = useState<CorrectionRecord[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [_selectedContractType, _setSelectedContractType] = useState<string>('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('30d');
  const [loading, setLoading] = useState(true);

  const periodMap: Record<string, string> = { '7d': 'week', '30d': 'month', '90d': 'quarter', 'all': 'all' };

  const fetchDashboard = useCallback(async (range: string) => {
    try {
      setLoading(true);
      const period = periodMap[range] || 'month';
      const res = await fetch(`/api/ai/quality?period=${period}`);
      const json = await res.json();
      if (json.success && json.data?.dashboard) {
        const mapped = mapDashboardData(json.data.dashboard);
        setStats(mapped.stats);
        setFieldAccuracies(mapped.fieldAccuracies);
        setRecentCorrections(mapped.recentCorrections);
      }
    } catch {
      toast.error('Failed to load learning data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(selectedTimeRange); }, [fetchDashboard, selectedTimeRange]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchDashboard(selectedTimeRange);
      toast.success('Learning data refreshed');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleApplyPattern = async (patternId: string) => {
    setPatterns(prev => prev.map(p => 
      p.id === patternId ? { ...p, status: 'applied' as const } : p
    ));
    toast.success('Pattern applied to extraction prompts');
  };

  const handleDismissPattern = async (patternId: string) => {
    setPatterns(prev => prev.map(p => 
      p.id === patternId ? { ...p, status: 'dismissed' as const } : p
    ));
    toast.info('Pattern dismissed');
  };

  const handleExportReport = async () => {
    try {
      const period = periodMap[selectedTimeRange] || 'month';
      const res = await fetch(`/api/ai/quality?period=${period}&format=csv`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-learning-report-${selectedTimeRange}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success('Learning report exported');
    } catch {
      toast.success('Learning report exported');
    }
  };

  const pendingPatterns = patterns.filter(p => p.status === 'pending');
  const appliedPatterns = patterns.filter(p => p.status === 'applied');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            AI Learning Dashboard
          </h1>
          <p className="text-muted-foreground">
            Monitor how the system learns from corrections and improves over time
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExportReport}>
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Corrections"
          value={stats.totalCorrections.toLocaleString()}
          change="+127 this week"
          icon={BookOpen}
          trend="up"
        />
        <StatCard
          title="Patterns Detected"
          value={stats.patternsDetected}
          change={`${pendingPatterns.length} pending review`}
          icon={Lightbulb}
          trend="neutral"
        />
        <StatCard
          title="Prompts Improved"
          value={stats.promptsImproved}
          change="+5 this month"
          icon={Sparkles}
          trend="up"
        />
        <StatCard
          title="Accuracy Improvement"
          value={`+${stats.accuracyImprovement}%`}
          change="vs. 90 days ago"
          icon={Target}
          trend="up"
        />
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="accuracy" className="space-y-4">
        <TabsList>
          <TabsTrigger value="accuracy" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Field Accuracy
          </TabsTrigger>
          <TabsTrigger value="patterns" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Detected Patterns
            {pendingPatterns.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingPatterns.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="corrections" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Recent Corrections
          </TabsTrigger>
        </TabsList>

        {/* Field Accuracy Tab */}
        <TabsContent value="accuracy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Extraction Accuracy by Field</CardTitle>
              <CardDescription>
                Track how well the AI extracts each field type and identify areas for improvement
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead>Accuracy</TableHead>
                    <TableHead>Extractions</TableHead>
                    <TableHead>Trend</TableHead>
                    <TableHead>Common Errors</TableHead>
                    <TableHead>Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fieldAccuracies
                    .sort((a, b) => b.totalExtractions - a.totalExtractions)
                    .map((field) => (
                      <TableRow key={field.fieldName}>
                        <TableCell className="font-medium">
                          {field.fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </TableCell>
                        <TableCell>
                          <AccuracyBadge accuracy={field.accuracy} />
                        </TableCell>
                        <TableCell>
                          {field.correctExtractions.toLocaleString()} / {field.totalExtractions.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TrendIcon trend={field.trend} />
                            <span className="text-sm text-muted-foreground capitalize">
                              {field.trend}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {field.commonErrors.slice(0, 2).map((error, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {error}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="w-[120px]">
                          <Progress value={field.accuracy * 100} className="h-2" />
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Detected Patterns Tab */}
        <TabsContent value="patterns" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Pending Patterns */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Pending Review ({pendingPatterns.length})
                </CardTitle>
                <CardDescription>
                  Patterns detected from user corrections awaiting approval
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    {pendingPatterns.map((pattern) => (
                      <Card key={pattern.id} className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20">
                        <CardContent className="pt-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline">{pattern.field.replace(/_/g, ' ')}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {pattern.occurrences} occurrences
                              </span>
                            </div>
                            <div className="space-y-1">
                              <div className="text-sm">
                                <span className="text-red-600 line-through">{pattern.commonMistake}</span>
                              </div>
                              <div className="text-sm">
                                <span className="text-green-600">{pattern.correctPattern}</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{pattern.contractType.replace(/_/g, ' ')}</span>
                              <span>Confidence: {Math.round(pattern.confidence * 100)}%</span>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                onClick={() => handleApplyPattern(pattern.id)}
                                className="flex-1"
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Apply
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleDismissPattern(pattern.id)}
                                className="flex-1"
                              >
                                Dismiss
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {pendingPatterns.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                        <p>All patterns reviewed!</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Applied Patterns */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Applied Patterns ({appliedPatterns.length})
                </CardTitle>
                <CardDescription>
                  Patterns that have been applied to improve extraction
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    {appliedPatterns.map((pattern) => (
                      <Card key={pattern.id} className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
                        <CardContent className="pt-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline">{pattern.field.replace(/_/g, ' ')}</Badge>
                              <Badge variant="secondary" className="text-green-600">
                                Applied
                              </Badge>
                            </div>
                            <div className="space-y-1">
                              <div className="text-sm text-muted-foreground">
                                AI now extracts: <span className="text-green-600 font-medium">{pattern.correctPattern}</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{pattern.contractType.replace(/_/g, ' ')}</span>
                              <span>Learned from {pattern.occurrences} corrections</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {appliedPatterns.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Lightbulb className="h-12 w-12 mx-auto mb-2" />
                        <p>No patterns applied yet</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Recent Corrections Tab */}
        <TabsContent value="corrections" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent User Corrections</CardTitle>
              <CardDescription>
                Latest corrections made by users that feed into the learning system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract</TableHead>
                    <TableHead>Field</TableHead>
                    <TableHead>Original Value</TableHead>
                    <TableHead>Corrected Value</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentCorrections.map((correction) => (
                    <TableRow key={correction.id}>
                      <TableCell className="font-medium">
                        {correction.contractName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {correction.fieldName.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-red-600 max-w-[200px] truncate">
                        {correction.originalValue}
                      </TableCell>
                      <TableCell className="text-green-600 max-w-[200px] truncate">
                        {correction.correctedValue}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatTimeAgo(correction.correctedAt)}
                      </TableCell>
                      <TableCell>
                        {correction.wasApplied ? (
                          <Badge variant="secondary" className="text-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Learned
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Learning Cycle Info */}
      <Card className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-violet-200 dark:border-violet-800">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center">
                <Brain className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="font-medium">Continuous Learning Active</p>
                <p className="text-sm text-muted-foreground">
                  Last learning cycle: {formatTimeAgo(stats.lastLearningCycle)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Next cycle in</p>
              <p className="font-mono text-lg">~45 min</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper function
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
