/**
 * Learning Records Page
 * 
 * Shows adaptive learning records — AI extractions vs user corrections.
 * Helps users understand how the AI improves over time.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Brain,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface LearningRecord {
  id: string;
  field: string;
  artifactType: string;
  contractType: string | null;
  aiExtracted: string | null;
  userCorrected: string | null;
  confidence: number | null;
  correctionType: string | null;
  modelUsed: string | null;
  createdAt: string;
}

interface LearningData {
  records: LearningRecord[];
  total: number;
  correctionBreakdown: Record<string, number>;
  avgConfidence: number;
}

export default function LearningRecordsPage() {
  const [data, setData] = useState<LearningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [correctionFilter, setCorrectionFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(page * pageSize),
      });
      if (correctionFilter !== 'all') {
        params.set('correctionType', correctionFilter);
      }
      const res = await fetch(`/api/agents/learning?${params}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch {
      toast.error('Failed to load learning records');
    } finally {
      setLoading(false);
    }
  }, [page, correctionFilter]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const correctionColors: Record<string, string> = {
    typo: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    format: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    value: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    missing: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    unknown: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-violet-600" />
            Adaptive Learning Records
          </h1>
          <p className="text-muted-foreground mt-1">
            Track how AI extractions improve with user corrections
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchData(); }}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900">
                <BookOpen className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data?.total ?? 0}</p>
                <p className="text-sm text-muted-foreground">Total Records</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {data?.avgConfidence ? `${Math.round(data.avgConfidence * 100)}%` : 'N/A'}
                </p>
                <p className="text-sm text-muted-foreground">Avg Confidence</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {Object.entries(data?.correctionBreakdown ?? {}).slice(0, 2).map(([type, count]) => (
          <Card key={type}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={cn('p-2 rounded-lg', type === 'value' ? 'bg-red-100 dark:bg-red-900' : 'bg-yellow-100 dark:bg-yellow-900')}>
                  <AlertTriangle className={cn('h-5 w-5', type === 'value' ? 'text-red-600' : 'text-yellow-600')} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-sm text-muted-foreground capitalize">{type} corrections</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={correctionFilter} onValueChange={(v) => { setCorrectionFilter(v); setPage(0); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="typo">Typo</SelectItem>
            <SelectItem value="format">Format</SelectItem>
            <SelectItem value="value">Value</SelectItem>
            <SelectItem value="missing">Missing</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          Showing {data?.records.length ?? 0} of {data?.total ?? 0}
        </span>
      </div>

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Correction History</CardTitle>
          <CardDescription>AI extractions compared with user corrections</CardDescription>
        </CardHeader>
        <CardContent>
          {data?.records.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No learning records yet</p>
              <p className="text-sm mt-1">Records are created when users correct AI extractions</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data?.records.map(record => (
                <div
                  key={record.id}
                  className="flex items-start gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{record.field}</span>
                      <Badge variant="outline" className="text-xs">
                        {record.artifactType}
                      </Badge>
                      {record.correctionType && (
                        <Badge className={cn('text-xs', correctionColors[record.correctionType] ?? correctionColors.unknown)}>
                          {record.correctionType}
                        </Badge>
                      )}
                      {record.confidence !== null && (
                        <Badge variant="outline" className="text-xs">
                          {Math.round(record.confidence * 100)}% conf
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-red-600 line-through truncate max-w-xs">
                        {record.aiExtracted || '(empty)'}
                      </span>
                      <ArrowRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                      <span className="text-green-600 truncate max-w-xs">
                        {record.userCorrected || '(empty)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {record.modelUsed && <span>Model: {record.modelUsed}</span>}
                      {record.contractType && <span>Type: {record.contractType}</span>}
                      <span>{new Date(record.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-1" />
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
