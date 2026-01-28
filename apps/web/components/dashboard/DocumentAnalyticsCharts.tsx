/**
 * Document Analytics Charts
 * Trend charts for document classification and signature status over time
 */

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AreaChart, 
  Area, 
  Bar,
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  ComposedChart
} from "recharts";
import { motion } from "framer-motion";
import { 
  TrendingUp, 
  FileText, 
  PenLine,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

type Period = 'week' | 'month' | 'quarter' | 'year';

interface TrendData {
  label: string;
  total: number;
  contracts: number;
  nonContracts: number;
  signed: number;
  unsigned: number;
  partialSigned: number;
  cumulative: {
    contracts: number;
    nonContracts: number;
    signed: number;
    unsigned: number;
    total: number;
  };
}

interface AnalyticsData {
  period: string;
  trends: TrendData[];
  summary: {
    totalDocuments: number;
    totalContracts: number;
    totalNonContracts: number;
    signedCount: number;
    unsignedCount: number;
    contractPercentage: number;
    signedPercentage: number;
    growthRate: number;
    contractGrowthRate: number;
  };
  topDocumentTypes: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
}

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'week', label: '7 Days' },
  { value: 'month', label: '30 Days' },
  { value: 'quarter', label: '3 Months' },
  { value: 'year', label: '12 Months' },
];

const documentTypeLabels: Record<string, string> = {
  contract: 'Contracts',
  purchase_order: 'Purchase Orders',
  invoice: 'Invoices',
  quote: 'Quotes',
  proposal: 'Proposals',
  work_order: 'Work Orders',
  letter_of_intent: 'Letters of Intent',
  memorandum: 'Memoranda',
  amendment: 'Amendments',
  addendum: 'Addenda',
  unknown: 'Unknown',
};

const CHART_COLORS = {
  contracts: '#10b981',
  nonContracts: '#f59e0b',
  signed: '#3b82f6',
  unsigned: '#ef4444',
  partialSigned: '#f97316',
  total: '#8b5cf6',
};

function GrowthIndicator({ value }: { value: number }) {
  if (value > 0) {
    return (
      <span className="flex items-center text-violet-600 text-sm font-medium">
        <ArrowUpRight className="h-4 w-4" />
        {value.toFixed(1)}%
      </span>
    );
  } else if (value < 0) {
    return (
      <span className="flex items-center text-red-600 text-sm font-medium">
        <ArrowDownRight className="h-4 w-4" />
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="flex items-center text-muted-foreground text-sm font-medium">
      <Minus className="h-4 w-4" />
      0%
    </span>
  );
}

function StatCard({ 
  title, 
  value, 
  subtitle, 
  growth, 
  icon: Icon,
  color 
}: { 
  title: string; 
  value: number | string; 
  subtitle?: string;
  growth?: number;
  icon: any;
  color: string;
}) {
  return (
    <div className={`p-4 rounded-xl bg-gradient-to-br ${color} border border-white/20`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-2xl font-bold">{value}</div>
          {subtitle && (
            <div className="text-xs text-muted-foreground">{subtitle}</div>
          )}
        </div>
        {growth !== undefined && <GrowthIndicator value={growth} />}
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload) return null;

  return (
    <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium mb-2">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export function DocumentAnalyticsCharts() {
  const [period, setPeriod] = useState<Period>('year');

  const { data, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ['document-analytics', period],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/document-analytics?period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch analytics');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-96">
          <div className="animate-pulse text-muted-foreground">Loading analytics...</div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Failed to load analytics</div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.trends.map(t => ({
    name: t.label,
    contracts: t.contracts,
    nonContracts: t.nonContracts,
    signed: t.signed,
    unsigned: t.unsigned + t.partialSigned,
    total: t.total,
    cumulativeContracts: t.cumulative.contracts,
    cumulativeNonContracts: t.cumulative.nonContracts,
    cumulativeTotal: t.cumulative.total,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Documents"
          value={data.summary.totalDocuments}
          growth={data.summary.growthRate}
          icon={FileText}
          color="from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50"
        />
        <StatCard
          title="Contracts"
          value={data.summary.totalContracts}
          subtitle={`${data.summary.contractPercentage.toFixed(0)}% of total`}
          growth={data.summary.contractGrowthRate}
          icon={FileText}
          color="from-violet-50 to-purple-50 dark:from-violet-900/30 dark:to-purple-900/30"
        />
        <StatCard
          title="Non-Contracts"
          value={data.summary.totalNonContracts}
          subtitle="Needs review"
          icon={BarChart3}
          color="from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30"
        />
        <StatCard
          title="Signed"
          value={data.summary.signedCount}
          subtitle={`${data.summary.signedPercentage.toFixed(0)}% signed`}
          icon={PenLine}
          color="from-violet-50 to-purple-50 dark:from-violet-900/30 dark:to-purple-900/30"
        />
      </div>

      {/* Main Charts */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Document Trends
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Period Selector */}
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                {PERIOD_OPTIONS.map(opt => (
                  <Button
                    key={opt.value}
                    variant={period === opt.value ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setPeriod(opt.value)}
                    className="text-xs h-7 px-2"
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="classification" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="classification">Document Types</TabsTrigger>
              <TabsTrigger value="signature">Signature Status</TabsTrigger>
              <TabsTrigger value="cumulative">Cumulative Growth</TabsTrigger>
            </TabsList>

            <TabsContent value="classification" className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar 
                    dataKey="contracts" 
                    name="Contracts" 
                    fill={CHART_COLORS.contracts}
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="nonContracts" 
                    name="Non-Contracts" 
                    fill={CHART_COLORS.nonContracts}
                    radius={[4, 4, 0, 0]}
                  />
                  <Line 
                    type="monotone"
                    dataKey="total" 
                    name="Total" 
                    stroke={CHART_COLORS.total}
                    strokeWidth={2}
                    dot={{ fill: CHART_COLORS.total, r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="signature" className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area 
                    type="monotone"
                    dataKey="signed" 
                    name="Signed" 
                    stackId="1"
                    stroke={CHART_COLORS.signed}
                    fill={CHART_COLORS.signed}
                    fillOpacity={0.6}
                  />
                  <Area 
                    type="monotone"
                    dataKey="unsigned" 
                    name="Unsigned/Partial" 
                    stackId="1"
                    stroke={CHART_COLORS.unsigned}
                    fill={CHART_COLORS.unsigned}
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="cumulative" className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line 
                    type="monotone"
                    dataKey="cumulativeContracts" 
                    name="Cumulative Contracts" 
                    stroke={CHART_COLORS.contracts}
                    strokeWidth={2}
                    dot={{ fill: CHART_COLORS.contracts, r: 3 }}
                  />
                  <Line 
                    type="monotone"
                    dataKey="cumulativeNonContracts" 
                    name="Cumulative Non-Contracts" 
                    stroke={CHART_COLORS.nonContracts}
                    strokeWidth={2}
                    dot={{ fill: CHART_COLORS.nonContracts, r: 3 }}
                  />
                  <Line 
                    type="monotone"
                    dataKey="cumulativeTotal" 
                    name="Cumulative Total" 
                    stroke={CHART_COLORS.total}
                    strokeWidth={3}
                    strokeDasharray="5 5"
                    dot={{ fill: CHART_COLORS.total, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Top Document Types */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Document Type Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.topDocumentTypes.map((item, index) => {
              const isContract = !['purchase_order', 'invoice', 'quote', 'proposal', 'work_order', 'letter_of_intent', 'memorandum'].includes(item.type);
              return (
                <div key={item.type} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {documentTypeLabels[item.type] || item.type}
                      </span>
                      {!isContract && (
                        <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                          Non-contract
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{item.count}</span>
                      <span className="text-xs text-muted-foreground">
                        ({item.percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.percentage}%` }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className={`h-full rounded-full ${isContract ? 'bg-violet-500' : 'bg-amber-500'}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default DocumentAnalyticsCharts;
