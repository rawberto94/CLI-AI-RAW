'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Play,
  Pause,
  AlertCircle,
  FileText,
  Clock,
  Database,
  TrendingUp,
  Loader2,
  Settings,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface BulkExtractionStats {
  statistics: {
    totalContracts: number;
    contractsWithMetadata: number;
    contractsWithoutMetadata: number;
    coveragePercentage: number;
    processing: number;
  };
  queue: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  } | null;
  recentExtractions: Array<{
    id: string;
    title: string;
    updatedAt: string;
    fieldCount: number;
  }>;
}

interface BulkExtractionDashboardProps {
  tenantId?: string;
  className?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function BulkExtractionDashboard({
  tenantId = 'demo',
  className,
}: BulkExtractionDashboardProps) {
  const [stats, setStats] = useState<BulkExtractionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    queued: number;
    skipped: number;
    message: string;
  } | null>(null);

  // Extraction options
  const [options, setOptions] = useState({
    priority: 'normal' as 'high' | 'normal' | 'low',
    autoApply: true,
    autoApplyThreshold: 0.85,
    skipExisting: true,
    filter: 'missing' as 'all' | 'missing' | 'completed',
  });

  // Fetch stats
  const fetchStats = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/contracts/bulk-extract-metadata', {
        headers: {
          'x-tenant-id': tenantId,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch statistics');
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load statistics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Poll for updates every 10 seconds when queue has active jobs
    const interval = setInterval(() => {
      if (stats?.queue?.active || stats?.queue?.waiting) {
        fetchStats();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [tenantId]);

  // Trigger bulk extraction
  const handleBulkExtract = async () => {
    try {
      setIsExtracting(true);
      setError(null);
      setLastResult(null);

      const filter: Record<string, any> = {};
      if (options.filter === 'missing') {
        filter.missingMetadata = true;
      } else if (options.filter === 'completed') {
        filter.status = 'COMPLETED';
      }

      const response = await fetch('/api/contracts/bulk-extract-metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          filter,
          autoApply: options.autoApply,
          autoApplyThreshold: options.autoApplyThreshold,
          priority: options.priority,
          skipExisting: options.skipExisting,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Bulk extraction failed');
      }

      setLastResult({
        queued: data.queued,
        skipped: data.skipped,
        message: data.message,
      });

      // Refresh stats
      setTimeout(fetchStats, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start extraction');
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Bulk Metadata Extraction
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Extract metadata from contracts using AI
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchStats}
          disabled={isLoading}
        >
          <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Error display */}
      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-rose-700">
              <XCircle className="h-4 w-4" />
              {error}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Contracts</p>
                  <p className="text-2xl font-bold">{stats.statistics.totalContracts}</p>
                </div>
                <FileText className="h-8 w-8 text-slate-300" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">With Metadata</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {stats.statistics.contractsWithMetadata}
                  </p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-emerald-200" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Missing Metadata</p>
                  <p className="text-2xl font-bold text-amber-600">
                    {stats.statistics.contractsWithoutMetadata}
                  </p>
                </div>
                <AlertCircle className="h-8 w-8 text-amber-200" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Coverage</p>
                  <p className="text-2xl font-bold">{stats.statistics.coveragePercentage}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-200" />
              </div>
              <Progress 
                value={stats.statistics.coveragePercentage} 
                className="h-1.5 mt-3" 
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Queue Status */}
      {stats?.queue && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Queue Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-lg font-semibold text-blue-600">{stats.queue.waiting}</p>
                <p className="text-xs text-muted-foreground">Waiting</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-amber-600">{stats.queue.active}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-emerald-600">{stats.queue.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-rose-600">{stats.queue.failed}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extraction Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Extraction Options
          </CardTitle>
          <CardDescription>
            Configure settings for bulk metadata extraction
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Filter */}
            <div className="space-y-2">
              <Label>Contract Filter</Label>
              <Select
                value={options.filter}
                onValueChange={(v) => setOptions(o => ({ ...o, filter: v as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="missing">Missing Metadata Only</SelectItem>
                  <SelectItem value="completed">All Completed</SelectItem>
                  <SelectItem value="all">All Contracts</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={options.priority}
                onValueChange={(v) => setOptions(o => ({ ...o, priority: v as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low (Background)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Confidence Threshold */}
            <div className="space-y-2">
              <Label>Auto-Apply Threshold: {Math.round(options.autoApplyThreshold * 100)}%</Label>
              <Slider
                value={[options.autoApplyThreshold * 100]}
                onValueChange={([v]) => setOptions(o => ({ ...o, autoApplyThreshold: (v ?? 85) / 100 }))}
                min={50}
                max={100}
                step={5}
              />
            </div>
          </div>

          <div className="flex items-center gap-6 pt-2">
            <div className="flex items-center space-x-2">
              <Switch
                id="auto-apply"
                checked={options.autoApply}
                onCheckedChange={(v) => setOptions(o => ({ ...o, autoApply: v }))}
              />
              <Label htmlFor="auto-apply">Auto-apply high confidence values</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="skip-existing"
                checked={options.skipExisting}
                onCheckedChange={(v) => setOptions(o => ({ ...o, skipExisting: v }))}
              />
              <Label htmlFor="skip-existing">Skip contracts with existing metadata</Label>
            </div>
          </div>

          {/* Start Button */}
          <div className="flex items-center gap-4 pt-4 border-t">
            <Button
              onClick={handleBulkExtract}
              disabled={isExtracting || !stats?.statistics.contractsWithoutMetadata}
              className="flex-1 md:flex-none"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting Extraction...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Start Bulk Extraction
                </>
              )}
            </Button>

            {stats && (
              <p className="text-sm text-muted-foreground">
                {options.skipExisting
                  ? `${stats.statistics.contractsWithoutMetadata} contracts will be processed`
                  : `${stats.statistics.totalContracts} contracts will be processed`}
              </p>
            )}
          </div>

          {/* Result */}
          <AnimatePresence>
            {lastResult && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm flex items-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                {lastResult.message}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Recent Extractions */}
      {stats?.recentExtractions && stats.recentExtractions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent Extractions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.recentExtractions.map((extraction) => (
                <div
                  key={extraction.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    <span className="text-sm truncate">{extraction.title || 'Untitled'}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge variant="secondary" className="text-xs">
                      {extraction.fieldCount} fields
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(extraction.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
