'use client';

/**
 * OCR Quality Dashboard
 * 
 * Displays OCR accuracy metrics, trends, and insights over time.
 * Tracks model performance, correction patterns, and improvement opportunities.
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Clock,
  Target,
  Zap,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Users,
  BarChart3,
  Activity,
  Layers,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface OCRMetrics {
  totalDocuments: number;
  avgConfidence: number;
  avgConfidenceChange: number;
  documentsNeedingReview: number;
  reviewsCompleted: number;
  avgCorrectionTime: number;
  modelAccuracy: Record<string, number>;
  fieldAccuracy: Record<string, number>;
}

interface DailyMetric {
  date: string;
  documents: number;
  avgConfidence: number;
  corrections: number;
  reviewTime: number;
}

interface FieldPerformance {
  field: string;
  accuracy: number;
  totalExtractions: number;
  corrections: number;
  trend: 'up' | 'down' | 'stable';
}

interface DocumentTypeStats {
  type: string;
  count: number;
  avgConfidence: number;
  needsReview: number;
}

interface OCRQualityDashboardProps {
  tenantId?: string;
  className?: string;
}

// ============================================================================
// STAT CARD COMPONENT
// ============================================================================

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  changeLabel,
  icon,
  trend,
  className,
}) => {
  return (
    <Card className={className}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {change !== undefined && (
              <div className={cn(
                'flex items-center gap-1 text-sm mt-1',
                trend === 'up' && 'text-green-600',
                trend === 'down' && 'text-red-600',
                trend === 'neutral' && 'text-muted-foreground'
              )}>
                {trend === 'up' && <ArrowUpRight className="h-4 w-4" />}
                {trend === 'down' && <ArrowDownRight className="h-4 w-4" />}
                <span>{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>
                {changeLabel && <span className="text-muted-foreground">{changeLabel}</span>}
              </div>
            )}
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================================================
// CONFIDENCE TREND CHART
// ============================================================================

const ConfidenceTrendChart: React.FC<{ data: DailyMetric[] }> = ({ data }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5" />
          OCR Confidence Trend
        </CardTitle>
        <CardDescription>Average extraction confidence over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            />
            <YAxis 
              domain={[0.5, 1]} 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `${Math.round(value * 100)}%`}
            />
            <RechartsTooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-popover border rounded-lg shadow-lg p-3">
                    <p className="font-medium">{new Date(label).toLocaleDateString()}</p>
                    <p className="text-sm text-muted-foreground">
                      Confidence: {((payload[0]?.value as number) * 100).toFixed(1)}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Documents: {payload[0]?.payload?.documents}
                    </p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="avgConfidence"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#confidenceGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

// ============================================================================
// CORRECTIONS CHART
// ============================================================================

const CorrectionsChart: React.FC<{ data: DailyMetric[] }> = ({ data }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Daily Corrections
        </CardTitle>
        <CardDescription>Number of corrections made per day</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <RechartsTooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-popover border rounded-lg shadow-lg p-3">
                    <p className="font-medium">{new Date(label).toLocaleDateString()}</p>
                    <p className="text-sm text-muted-foreground">
                      Corrections: {payload[0]?.value}
                    </p>
                  </div>
                );
              }}
            />
            <Bar 
              dataKey="corrections" 
              fill="#f97316" 
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

// ============================================================================
// FIELD ACCURACY TABLE
// ============================================================================

const FieldAccuracyTable: React.FC<{ fields: FieldPerformance[] }> = ({ fields }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5" />
          Field Extraction Accuracy
        </CardTitle>
        <CardDescription>Performance by extracted field type</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {fields.map((field) => (
            <div key={field.field} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium capitalize">{field.field.replace('_', ' ')}</span>
                  {field.trend === 'up' && (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  )}
                  {field.trend === 'down' && (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    {field.totalExtractions} extractions
                  </span>
                  <span className={cn(
                    'font-medium',
                    field.accuracy >= 0.9 && 'text-green-600',
                    field.accuracy >= 0.7 && field.accuracy < 0.9 && 'text-yellow-600',
                    field.accuracy < 0.7 && 'text-red-600'
                  )}>
                    {Math.round(field.accuracy * 100)}%
                  </span>
                </div>
              </div>
              <Progress 
                value={field.accuracy * 100} 
                className={cn(
                  'h-2',
                  field.accuracy >= 0.9 && '[&>div]:bg-green-500',
                  field.accuracy >= 0.7 && field.accuracy < 0.9 && '[&>div]:bg-yellow-500',
                  field.accuracy < 0.7 && '[&>div]:bg-red-500'
                )}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================================================
// DOCUMENT TYPE DISTRIBUTION
// ============================================================================

const DocumentTypeDistribution: React.FC<{ data: DocumentTypeStats[] }> = ({ data }) => {
  const COLORS = ['#3b82f6', '#f97316', '#10b981', '#8b5cf6', '#ec4899', '#eab308'];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Documents by Type
        </CardTitle>
        <CardDescription>Distribution and performance by document type</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-8">
          <ResponsiveContainer width={200} height={200}>
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="type"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={50}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0]?.payload as DocumentTypeStats;
                  return (
                    <div className="bg-popover border rounded-lg shadow-lg p-3">
                      <p className="font-medium">{item.type}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.count} documents
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {Math.round(item.avgConfidence * 100)}% avg confidence
                      </p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="flex-1 space-y-2">
            {data.map((item, index) => (
              <div key={item.type} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm">{item.type}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">{item.count}</span>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      item.avgConfidence >= 0.8 && 'border-green-500 text-green-600',
                      item.avgConfidence >= 0.6 && item.avgConfidence < 0.8 && 'border-yellow-500 text-yellow-600',
                      item.avgConfidence < 0.6 && 'border-red-500 text-red-600'
                    )}
                  >
                    {Math.round(item.avgConfidence * 100)}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================================================
// IMPROVEMENT SUGGESTIONS
// ============================================================================

const ImprovementSuggestions: React.FC<{ fields: FieldPerformance[] }> = ({ fields }) => {
  const lowPerformers = fields.filter(f => f.accuracy < 0.8).sort((a, b) => a.accuracy - b.accuracy);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Improvement Opportunities
        </CardTitle>
        <CardDescription>Areas that need attention based on performance data</CardDescription>
      </CardHeader>
      <CardContent>
        {lowPerformers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p>All fields are performing well!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {lowPerformers.slice(0, 5).map((field) => (
              <div key={field.field} className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={cn(
                      'h-4 w-4',
                      field.accuracy < 0.6 && 'text-red-500',
                      field.accuracy >= 0.6 && 'text-yellow-500'
                    )} />
                    <span className="font-medium capitalize">
                      {field.field.replace('_', ' ')}
                    </span>
                  </div>
                  <Badge variant="outline" className={cn(
                    field.accuracy < 0.6 && 'border-red-500 text-red-600',
                    field.accuracy >= 0.6 && 'border-yellow-500 text-yellow-600'
                  )}>
                    {Math.round(field.accuracy * 100)}% accuracy
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {field.corrections} corrections needed out of {field.totalExtractions} extractions.
                  {field.accuracy < 0.6 
                    ? ' Consider adding custom training data or adjusting extraction rules.'
                    : ' Minor improvements to extraction patterns could help.'}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const OCRQualityDashboard: React.FC<OCRQualityDashboardProps> = ({
  tenantId,
  className,
}) => {
  const [timeRange, setTimeRange] = useState('30d');
  const [loading, setLoading] = useState(false);

  // Fetch OCR quality data from API
  const [dailyData, setDailyData] = useState<DailyMetric[]>([]);
  const [metrics, setMetrics] = useState<OCRMetrics>({
    totalDocuments: 0, avgConfidence: 0, avgConfidenceChange: 0,
    documentsNeedingReview: 0, reviewsCompleted: 0, avgCorrectionTime: 0,
    modelAccuracy: {}, fieldAccuracy: {},
  });
  const [fieldPerformance, setFieldPerformance] = useState<FieldPerformance[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeStats[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/ocr/quality/metrics?timeRange=${timeRange}${tenantId ? `&tenantId=${tenantId}` : ''}`);
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        const d = data.data || data;

        if (d.metrics) {
          setMetrics({
            totalDocuments: d.metrics.totalDocuments ?? 0,
            avgConfidence: d.metrics.avgConfidence ?? 0,
            avgConfidenceChange: d.metrics.avgConfidenceChange ?? 0,
            documentsNeedingReview: d.metrics.documentsNeedingReview ?? d.metrics.pendingReview ?? 0,
            reviewsCompleted: d.metrics.reviewsCompleted ?? 0,
            avgCorrectionTime: d.metrics.avgCorrectionTime ?? 0,
            modelAccuracy: d.metrics.modelAccuracy || {},
            fieldAccuracy: d.metrics.fieldAccuracy || {},
          });
        }

        if (d.dailyMetrics || d.daily) {
          setDailyData((d.dailyMetrics || d.daily).map((m: any) => ({
            date: m.date,
            documents: m.documents || m.count || 0,
            avgConfidence: m.avgConfidence || 0,
            corrections: m.corrections || 0,
            reviewTime: m.reviewTime || m.avgReviewTime || 0,
          })));
        }

        if (d.fieldPerformance || d.fields) {
          setFieldPerformance((d.fieldPerformance || d.fields).map((f: any) => ({
            field: f.field || f.name,
            accuracy: f.accuracy || 0,
            totalExtractions: f.totalExtractions || f.total || 0,
            corrections: f.corrections || 0,
            trend: f.trend || 'stable',
          })));
        }

        if (d.documentTypes || d.documents) {
          setDocumentTypes((d.documentTypes || d.documents).map((dt: any) => ({
            type: dt.type || dt.name,
            count: dt.count || 0,
            avgConfidence: dt.avgConfidence || 0,
            needsReview: dt.needsReview || dt.pendingReview || 0,
          })));
        }
      } catch {
        // API unavailable — show empty state
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [timeRange, tenantId]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Eye className="h-6 w-6" />
            OCR Quality Dashboard
          </h2>
          <p className="text-muted-foreground">
            Monitor OCR extraction performance and accuracy metrics
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
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setLoading(true)}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Documents"
          value={metrics.totalDocuments.toLocaleString()}
          icon={<FileText className="h-5 w-5" />}
        />
        <StatCard
          title="Avg. Confidence"
          value={`${Math.round(metrics.avgConfidence * 100)}%`}
          change={metrics.avgConfidenceChange}
          changeLabel="vs last period"
          icon={<Target className="h-5 w-5" />}
          trend={metrics.avgConfidenceChange > 0 ? 'up' : 'down'}
        />
        <StatCard
          title="Pending Review"
          value={metrics.documentsNeedingReview}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <StatCard
          title="Avg. Review Time"
          value={`${metrics.avgCorrectionTime.toFixed(1)}h`}
          icon={<Clock className="h-5 w-5" />}
        />
      </div>

      {/* Charts */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="fields">Field Performance</TabsTrigger>
          <TabsTrigger value="documents">Document Types</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ConfidenceTrendChart data={dailyData} />
            <CorrectionsChart data={dailyData} />
          </div>
        </TabsContent>

        <TabsContent value="fields" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FieldAccuracyTable fields={fieldPerformance} />
            <ImprovementSuggestions fields={fieldPerformance} />
          </div>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <DocumentTypeDistribution data={documentTypes} />
        </TabsContent>
      </Tabs>

      {/* Model Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5" />
            OCR Model Performance
          </CardTitle>
          <CardDescription>Comparison of different OCR engines</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(metrics.modelAccuracy).map(([model, accuracy]) => (
              <div key={model} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium capitalize">{model.replace('_', ' ')}</span>
                  <span className={cn(
                    'text-lg font-bold',
                    accuracy >= 0.85 && 'text-green-600',
                    accuracy >= 0.75 && accuracy < 0.85 && 'text-yellow-600',
                    accuracy < 0.75 && 'text-orange-600'
                  )}>
                    {Math.round(accuracy * 100)}%
                  </span>
                </div>
                <Progress 
                  value={accuracy * 100} 
                  className={cn(
                    'h-2',
                    accuracy >= 0.85 && '[&>div]:bg-green-500',
                    accuracy >= 0.75 && accuracy < 0.85 && '[&>div]:bg-yellow-500',
                    accuracy < 0.75 && '[&>div]:bg-orange-500'
                  )}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OCRQualityDashboard;
