'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Upload,
  RefreshCw,
  FileText,
  Activity,
  HardDrive,
  Clock,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Timer,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: '#22c55e',
  PROCESSING: '#8b5cf6',
  UPLOADED: '#3b82f6',
  QUEUED: '#f59e0b',
  FAILED: '#ef4444',
  ACTIVE: '#06b6d4',
  PENDING: '#f97316',
  ARCHIVED: '#6b7280',
  DRAFT: '#a3a3a3',
  EXPIRED: '#78716c',
  CANCELLED: '#dc2626',
  DELETED: '#991b1b',
};

const PIE_COLORS = ['#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#f97316', '#ec4899'];

// ── Types ────────────────────────────────────────────────────────────────────

interface MetricsData {
  statusBreakdown: { status: string; count: number }[];
  dailyUploads: { date: string; count: number }[];
  sourceBreakdown: { source: string; count: number }[];
  mimeBreakdown: { type: string; count: number }[];
  sizeStats: { avgBytes: number; totalBytes: number; maxBytes: number; totalFiles: number };
  processingPerf: { avgMs: number; minMs: number; maxMs: number; sampleSize: number };
  recentUploads: {
    id: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    status: string;
    uploadedAt: string;
    processedAt: string | null;
    importSource: string | null;
  }[];
}

// ── Component ────────────────────────────────────────────────────────────────

export default function UploadMetricsPage() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await fetch('/api/admin/metrics/uploads');
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json = await res.json();
      setData(json.data ?? json);
      setLastRefresh(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load upload metrics';
      setLoadError(msg);
      toast.error('Failed to load upload metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(fetchMetrics, 60_000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const totalByStatus = (status: string) =>
    data?.statusBreakdown.find(s => s.status === status)?.count ?? 0;

  const totalUploads = data?.sizeStats.totalFiles ?? 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            Upload Metrics
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time upload pipeline health &amp; performance
            {lastRefresh && (
              <span className="ml-2 text-xs">
                Last refreshed: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchMetrics}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {loadError && (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-rose-200 bg-rose-50/50 p-4">
          <div className="flex items-start gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Couldn’t load upload metrics</p>
              <p className="text-sm text-rose-700 mt-1">{loadError}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchMetrics} className="flex-shrink-0">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          icon={FileText}
          label="Total Uploads"
          value={totalUploads}
          gradient="from-slate-500 to-slate-600"
        />
        <KPICard
          icon={CheckCircle2}
          label="Completed"
          value={totalByStatus('COMPLETED')}
          gradient="from-green-500 to-emerald-600"
          subtext={totalUploads > 0 ? `${((totalByStatus('COMPLETED') / totalUploads) * 100).toFixed(0)}%` : undefined}
        />
        <KPICard
          icon={Activity}
          label="Processing"
          value={totalByStatus('PROCESSING') + totalByStatus('QUEUED')}
          gradient="from-violet-500 to-purple-600"
          pulse
        />
        <KPICard
          icon={AlertTriangle}
          label="Failed"
          value={totalByStatus('FAILED')}
          gradient="from-red-500 to-rose-600"
          subtext={totalUploads > 0 ? `${((totalByStatus('FAILED') / totalUploads) * 100).toFixed(1)}% error rate` : undefined}
        />
      </div>

      {/* Performance Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm shadow-lg">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl">
              <Timer className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Avg Processing Time</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {data ? formatDuration(data.processingPerf.avgMs) : '—'}
              </p>
              {data && data.processingPerf.sampleSize > 0 && (
                <p className="text-xs text-slate-400">
                  min {formatDuration(data.processingPerf.minMs)} · max {formatDuration(data.processingPerf.maxMs)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm shadow-lg">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl">
              <HardDrive className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Storage Used</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {data ? formatBytes(data.sizeStats.totalBytes) : '—'}
              </p>
              {data && (
                <p className="text-xs text-slate-400">
                  avg {formatBytes(data.sizeStats.avgBytes)} · max {formatBytes(data.sizeStats.maxBytes)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm shadow-lg">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Today&apos;s Uploads</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {data?.dailyUploads.length
                  ? data.dailyUploads[data.dailyUploads.length - 1]?.count ?? 0
                  : 0}
              </p>
              <p className="text-xs text-slate-400">
                {data?.dailyUploads.length ?? 0} active days (last 30d)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Upload Trend */}
        <Card className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4 text-violet-500" />
              Daily Uploads (30d)
            </CardTitle>
            <CardDescription>Upload volume trend</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.dailyUploads.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={data.dailyUploads}>
                  <defs>
                    <linearGradient id="uploadGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={v => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    labelFormatter={v => new Date(v as string).toLocaleDateString()}
                    formatter={(value: number) => [value, 'Uploads']}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="url(#uploadGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No upload data in the last 30 days" />
            )}
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-violet-500" />
              Status Distribution
            </CardTitle>
            <CardDescription>Contracts by processing status</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.statusBreakdown.length ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={250}>
                  <PieChart>
                    <Pie
                      data={data.statusBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      dataKey="count"
                      nameKey="status"
                      paddingAngle={2}
                    >
                      {data.statusBreakdown.map((entry, i) => (
                        <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number, name: string) => [value, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {data.statusBreakdown.map(entry => (
                    <div key={entry.status} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: STATUS_COLORS[entry.status] || '#8b5cf6' }}
                        />
                        <span className="text-slate-700 dark:text-slate-300">{entry.status}</span>
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{entry.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyChart message="No status data available" />
            )}
          </CardContent>
        </Card>

        {/* Source Breakdown */}
        <Card className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4 text-blue-500" />
              Import Sources
            </CardTitle>
            <CardDescription>Where uploads originate</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.sourceBreakdown.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.sourceBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="source" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(value: number) => [value, 'Uploads']} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No source data available" />
            )}
          </CardContent>
        </Card>

        {/* MIME Type Breakdown */}
        <Card className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-500" />
              File Types
            </CardTitle>
            <CardDescription>Document format distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.mimeBreakdown.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.mimeBreakdown.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="type"
                    tick={{ fontSize: 11 }}
                    width={120}
                    tickFormatter={v => v.replace('application/', '').replace('image/', '')}
                  />
                  <Tooltip formatter={(value: number) => [value, 'Files']} />
                  <Bar dataKey="count" fill="#22c55e" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No file type data available" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Uploads Table */}
      <Card className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-violet-500" />
            Recent Uploads
          </CardTitle>
          <CardDescription>Last 20 uploaded documents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 px-3 font-medium text-slate-500 dark:text-slate-400">File</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-500 dark:text-slate-400">Status</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-500 dark:text-slate-400">Size</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-500 dark:text-slate-400">Source</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-500 dark:text-slate-400">Uploaded</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-500 dark:text-slate-400">Processing Time</th>
                </tr>
              </thead>
              <tbody>
                {data?.recentUploads.length ? (
                  data.recentUploads.map(u => {
                    const procTime =
                      u.processedAt && u.uploadedAt
                        ? new Date(u.processedAt).getTime() - new Date(u.uploadedAt).getTime()
                        : null;
                    return (
                      <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-2 px-3 max-w-[200px] truncate font-medium text-slate-900 dark:text-slate-100">
                          {u.fileName || '—'}
                        </td>
                        <td className="py-2 px-3">
                          <Badge
                            variant="outline"
                            className="text-xs"
                            style={{
                              borderColor: STATUS_COLORS[u.status] || '#8b5cf6',
                              color: STATUS_COLORS[u.status] || '#8b5cf6',
                            }}
                          >
                            {u.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{formatBytes(u.fileSize)}</td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{u.importSource || '—'}</td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                          {u.uploadedAt ? new Date(u.uploadedAt).toLocaleString() : '—'}
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                          {procTime !== null && procTime > 0 ? formatDuration(procTime) : '—'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No recent uploads found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function KPICard({
  icon: Icon,
  label,
  value,
  gradient,
  subtext,
  pulse,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  gradient: string;
  subtext?: string;
  pulse?: boolean;
}) {
  return (
    <Card className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={cn('p-3 rounded-xl shadow-md bg-gradient-to-br', gradient)}>
          <Icon className={cn('h-5 w-5 text-white', pulse && value > 0 && 'motion-safe:animate-pulse')} />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value.toLocaleString()}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</p>
          {subtext && <p className="text-xs text-slate-400 mt-0.5">{subtext}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-[250px] text-slate-400 dark:text-slate-500 text-sm">
      {message}
    </div>
  );
}
