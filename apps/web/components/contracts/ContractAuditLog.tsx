'use client';

import React, { useState, useEffect } from 'react';
import { 
  History, 
  Filter, 
  Download, 
  Eye, 
  Edit, 
  Share2, 
  Upload, 
  CheckCircle, 
  XCircle,
  MessageSquare,
  FileText,
  Shield,
  Users,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface AuditLogEntry {
  id: string;
  contractId: string;
  tenantId: string;
  userId: string;
  userName?: string;
  action: string;
  category: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string | Date;
  status: 'success' | 'failure';
  errorMessage?: string;
}

interface AuditLogSummary {
  totalActions: number;
  byCategory: Record<string, number>;
  byAction: Record<string, number>;
  uniqueUsers: number;
}

interface ContractAuditLogProps {
  contractId: string;
  className?: string;
  maxHeight?: string;
}

// ============================================================================
// Action Icon Mapping
// ============================================================================

const actionIcons: Record<string, React.ReactNode> = {
  view: <Eye className="h-4 w-4" />,
  download: <Download className="h-4 w-4" />,
  upload: <Upload className="h-4 w-4" />,
  update: <Edit className="h-4 w-4" />,
  delete: <XCircle className="h-4 w-4" />,
  share: <Share2 className="h-4 w-4" />,
  unshare: <Share2 className="h-4 w-4" />,
  approve: <CheckCircle className="h-4 w-4" />,
  reject: <XCircle className="h-4 w-4" />,
  sign: <FileText className="h-4 w-4" />,
  export: <Download className="h-4 w-4" />,
  analyze: <Shield className="h-4 w-4" />,
  extract_metadata: <FileText className="h-4 w-4" />,
  categorize: <FileText className="h-4 w-4" />,
  add_reminder: <Clock className="h-4 w-4" />,
  comment: <MessageSquare className="h-4 w-4" />,
  version_create: <History className="h-4 w-4" />,
  permission_change: <Shield className="h-4 w-4" />,
};

const categoryColors: Record<string, string> = {
  access: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  modification: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  workflow: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  collaboration: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  analysis: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  security: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

// ============================================================================
// Main Component
// ============================================================================

export function ContractAuditLog({ 
  contractId, 
  className,
  maxHeight = '600px' 
}: ContractAuditLogProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [summary, setSummary] = useState<AuditLogSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  
  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('7d');

  // Fetch logs
  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId, categoryFilter, actionFilter, timeRange]);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (actionFilter !== 'all') params.set('action', actionFilter);
      
      // Calculate date range
      const now = new Date();
      const rangeMap: Record<string, number> = {
        '1d': 1,
        '7d': 7,
        '30d': 30,
        '90d': 90,
        'all': 0,
      };
      const days = rangeMap[timeRange] || 7;
      if (days > 0) {
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        params.set('startDate', startDate.toISOString());
      }

      const response = await fetch(`/api/contracts/${contractId}/audit?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setLogs(data.data.logs);
        setSummary(data.data.summary);
      } else {
        setError(data.error || 'Failed to fetch audit logs');
      }
    } catch (err) {
      setError('Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  const formatTimestamp = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const formatAction = (action: string) => {
    return action
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'User', 'Action', 'Category', 'Status', 'Details'].join(','),
      ...logs.map(log => [
        new Date(log.timestamp).toISOString(),
        log.userName || log.userId,
        log.action,
        log.category,
        log.status,
        JSON.stringify(log.details),
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contract-${contractId}-audit-log.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Audit Log
            </CardTitle>
            <CardDescription>
              Complete history of all actions performed on this contract
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={fetchLogs}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={exportLogs}
              disabled={logs.length === 0}
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-4 gap-4 mt-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-2xl font-bold">{summary.totalActions}</div>
              <div className="text-sm text-muted-foreground">Total Actions</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-2xl font-bold">{summary.uniqueUsers}</div>
              <div className="text-sm text-muted-foreground">Unique Users</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-2xl font-bold">
                {summary.byCategory['modification'] || 0}
              </div>
              <div className="text-sm text-muted-foreground">Modifications</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-2xl font-bold">
                {summary.byCategory['access'] || 0}
              </div>
              <div className="text-sm text-muted-foreground">Access Events</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filters:</span>
          </div>
          
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="access">Access</SelectItem>
              <SelectItem value="modification">Modification</SelectItem>
              <SelectItem value="workflow">Workflow</SelectItem>
              <SelectItem value="collaboration">Collaboration</SelectItem>
              <SelectItem value="analysis">Analysis</SelectItem>
              <SelectItem value="security">Security</SelectItem>
            </SelectContent>
          </Select>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="view">View</SelectItem>
              <SelectItem value="download">Download</SelectItem>
              <SelectItem value="upload">Upload</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="share">Share</SelectItem>
              <SelectItem value="approve">Approve</SelectItem>
              <SelectItem value="reject">Reject</SelectItem>
            </SelectContent>
          </Select>

          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mb-2" />
            <p className="text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchLogs} className="mt-4">
              Retry
            </Button>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <History className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No audit log entries found</p>
            <p className="text-sm text-muted-foreground">
              Actions will appear here as they occur
            </p>
          </div>
        ) : (
          <div 
            className="space-y-2 overflow-y-auto"
            style={{ maxHeight }}
          >
            {logs.map((log) => (
              <div
                key={log.id}
                className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
              >
                <div 
                  className="flex items-start justify-between cursor-pointer"
                  onClick={() => toggleExpanded(log.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "p-2 rounded-lg",
                      log.status === 'success' 
                        ? "bg-muted" 
                        : "bg-red-100 dark:bg-red-900/30"
                    )}>
                      {actionIcons[log.action] || <FileText className="h-4 w-4" />}
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {log.userName || log.userId}
                        </span>
                        <span className="text-muted-foreground">
                          {formatAction(log.action)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1">
                        <Badge 
                          variant="secondary"
                          className={cn("text-xs", categoryColors[log.category])}
                        >
                          {log.category}
                        </Badge>
                        
                        {log.status === 'failure' && (
                          <Badge variant="destructive" className="text-xs">
                            Failed
                          </Badge>
                        )}
                        
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {expandedLogs.has(log.id) ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedLogs.has(log.id) && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Timestamp:</span>
                        <span className="ml-2">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">User ID:</span>
                        <span className="ml-2 font-mono text-xs">{log.userId}</span>
                      </div>
                      {log.ipAddress && (
                        <div>
                          <span className="text-muted-foreground">IP Address:</span>
                          <span className="ml-2 font-mono text-xs">{log.ipAddress}</span>
                        </div>
                      )}
                      {log.errorMessage && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Error:</span>
                          <span className="ml-2 text-destructive">{log.errorMessage}</span>
                        </div>
                      )}
                    </div>
                    
                    {Object.keys(log.details).length > 0 && (
                      <div className="mt-3">
                        <span className="text-muted-foreground text-sm">Details:</span>
                        <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ContractAuditLog;
