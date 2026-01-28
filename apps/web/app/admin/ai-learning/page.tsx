'use client';

import React, { useState } from 'react';
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
// MOCK DATA (Replace with API calls)
// =============================================================================

const mockFieldAccuracies: FieldAccuracy[] = [
  { fieldName: 'effective_date', accuracy: 0.94, totalExtractions: 1250, correctExtractions: 1175, trend: 'improving', commonErrors: ['Wrong year', 'Format mismatch'], lastUpdated: new Date() },
  { fieldName: 'expiration_date', accuracy: 0.91, totalExtractions: 1180, correctExtractions: 1074, trend: 'stable', commonErrors: ['Auto-renewal confusion'], lastUpdated: new Date() },
  { fieldName: 'total_value', accuracy: 0.87, totalExtractions: 980, correctExtractions: 853, trend: 'improving', commonErrors: ['Currency confusion', 'Missing decimals'], lastUpdated: new Date() },
  { fieldName: 'payment_terms', accuracy: 0.82, totalExtractions: 890, correctExtractions: 730, trend: 'improving', commonErrors: ['Net vs Gross', 'Days ambiguity'], lastUpdated: new Date() },
  { fieldName: 'termination_notice', accuracy: 0.79, totalExtractions: 760, correctExtractions: 600, trend: 'declining', commonErrors: ['Days vs months', 'Missing period'], lastUpdated: new Date() },
  { fieldName: 'liability_cap', accuracy: 0.85, totalExtractions: 540, correctExtractions: 459, trend: 'stable', commonErrors: ['Aggregate vs per-claim'], lastUpdated: new Date() },
  { fieldName: 'auto_renewal', accuracy: 0.92, totalExtractions: 680, correctExtractions: 626, trend: 'improving', commonErrors: ['Implicit vs explicit'], lastUpdated: new Date() },
  { fieldName: 'governing_law', accuracy: 0.96, totalExtractions: 1100, correctExtractions: 1056, trend: 'stable', commonErrors: ['State vs federal'], lastUpdated: new Date() },
];

const mockPatterns: LearningPattern[] = [
  { id: '1', field: 'payment_terms', contractType: 'SERVICE_AGREEMENT', commonMistake: 'Net 30', correctPattern: 'Net 30 days from invoice date', occurrences: 23, confidence: 0.87, status: 'pending', detectedAt: new Date(Date.now() - 86400000) },
  { id: '2', field: 'termination_notice', contractType: 'SERVICE_AGREEMENT', commonMistake: '30 days', correctPattern: '30 calendar days written notice', occurrences: 18, confidence: 0.82, status: 'pending', detectedAt: new Date(Date.now() - 172800000) },
  { id: '3', field: 'effective_date', contractType: 'PROCUREMENT', commonMistake: 'January 1', correctPattern: 'January 1, 2024', occurrences: 15, confidence: 0.91, status: 'applied', detectedAt: new Date(Date.now() - 259200000) },
  { id: '4', field: 'total_value', contractType: 'SERVICE_AGREEMENT', commonMistake: '100000', correctPattern: '$100,000.00 USD', occurrences: 12, confidence: 0.78, status: 'pending', detectedAt: new Date(Date.now() - 345600000) },
  { id: '5', field: 'liability_cap', contractType: 'LICENSING', commonMistake: '2x fees', correctPattern: '2x annual license fees', occurrences: 8, confidence: 0.75, status: 'dismissed', detectedAt: new Date(Date.now() - 432000000) },
];

const mockStats: LearningStats = {
  totalCorrections: 3847,
  patternsDetected: 156,
  promptsImproved: 42,
  accuracyImprovement: 12.5,
  lastLearningCycle: new Date(Date.now() - 3600000),
};

const mockRecentCorrections: CorrectionRecord[] = [
  { id: '1', contractId: 'c1', contractName: 'Accenture MSA 2024', fieldName: 'payment_terms', originalValue: 'Net 30', correctedValue: 'Net 30 days from invoice receipt', correctedAt: new Date(Date.now() - 1800000), wasApplied: true },
  { id: '2', contractId: 'c2', contractName: 'IBM Cloud Services', fieldName: 'total_value', originalValue: '500000', correctedValue: '$500,000.00 USD', correctedAt: new Date(Date.now() - 3600000), wasApplied: true },
  { id: '3', contractId: 'c3', contractName: 'AWS Enterprise', fieldName: 'termination_notice', originalValue: '90 days', correctedValue: '90 days written notice required', correctedAt: new Date(Date.now() - 7200000), wasApplied: false },
  { id: '4', contractId: 'c4', contractName: 'Microsoft EA', fieldName: 'auto_renewal', originalValue: 'Yes', correctedValue: 'Auto-renews annually unless 60 days notice', correctedAt: new Date(Date.now() - 10800000), wasApplied: true },
  { id: '5', contractId: 'c5', contractName: 'Salesforce CRM', fieldName: 'liability_cap', originalValue: '1M', correctedValue: '$1,000,000 aggregate annual cap', correctedAt: new Date(Date.now() - 14400000), wasApplied: false },
];

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
  const [stats, _setStats] = useState<LearningStats>(mockStats);
  const [fieldAccuracies, _setFieldAccuracies] = useState<FieldAccuracy[]>(mockFieldAccuracies);
  const [patterns, setPatterns] = useState<LearningPattern[]>(mockPatterns);
  const [recentCorrections, _setRecentCorrections] = useState<CorrectionRecord[]>(mockRecentCorrections);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [_selectedContractType, _setSelectedContractType] = useState<string>('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('30d');

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // In production, this would call:
      // const response = await fetch('/api/admin/ai-learning/stats');
      // const data = await response.json();
      // setStats(data);
      await new Promise(resolve => setTimeout(resolve, 1000));
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

  const handleExportReport = () => {
    toast.success('Learning report exported');
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
