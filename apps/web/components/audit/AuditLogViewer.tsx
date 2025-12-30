/**
 * Audit Log Viewer Component
 * View and filter system audit logs for compliance and debugging
 * 
 * Uses React Query for data fetching with caching and background refresh.
 */

'use client';

import { memo, useState, useMemo } from 'react';
import { 
  ClipboardList, 
  Search,
  Filter,
  Download,
  RefreshCw,
  User,
  FileText,
  Settings,
  Shield,
  Database,
  Trash2,
  Eye,
  Edit,
  Upload,
  ChevronDown,
  ChevronUp,
  Loader2,
  List,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { useAuditLogs, type AuditLogEntry } from '@/hooks/use-monitoring-queries';
import { DataFreshnessIndicator } from '@/components/shared/DataFreshnessIndicator';
import { AuditLogTimeline } from './AuditLogTimeline';

interface AuditLogViewerProps {
  className?: string;
}

const categoryConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  user: { icon: User, color: 'text-blue-600 bg-blue-100', label: 'User' },
  contract: { icon: FileText, color: 'text-green-600 bg-green-100', label: 'Contract' },
  system: { icon: Settings, color: 'text-slate-600 bg-slate-100', label: 'System' },
  security: { icon: Shield, color: 'text-red-600 bg-red-100', label: 'Security' },
  data: { icon: Database, color: 'text-purple-600 bg-purple-100', label: 'Data' },
  integration: { icon: Database, color: 'text-orange-600 bg-orange-100', label: 'Integration' },
};

const actionIcons: Record<string, React.ElementType> = {
  create: Upload,
  read: Eye,
  update: Edit,
  delete: Trash2,
  login: User,
  logout: User,
  export: Download,
  import: Upload,
};

// Empty state when no audit logs available
function getEmptyLogs(): AuditLogEntry[] {
  return [];
}

export const AuditLogViewer = memo(function AuditLogViewer({
  className,
}: AuditLogViewerProps) {
  // React Query hook for audit logs
  const { 
    data, 
    isLoading: loading, 
    isFetching,
    refetch,
    dataUpdatedAt,
  } = useAuditLogs({
    pageSize: 100,
  });
  
  // Fall back to empty state if no data from API
  const logs = data?.logs ?? getEmptyLogs();
  
  // Local UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [successFilter, setSuccessFilter] = useState<string>('all');
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');

  const filteredLogs = useMemo(() => logs.filter((log: AuditLogEntry) => {
    if (categoryFilter !== 'all' && log.category !== categoryFilter) return false;
    if (successFilter !== 'all' && (successFilter === 'success' ? !log.success : log.success)) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        log.action.toLowerCase().includes(query) ||
        log.actor.name.toLowerCase().includes(query) ||
        log.actor.email.toLowerCase().includes(query) ||
        log.resource?.name?.toLowerCase().includes(query)
      );
    }
    return true;
  }), [logs, categoryFilter, successFilter, searchQuery]);

  const toggleExpand = (logId: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'Action', 'Category', 'Actor', 'Resource', 'Success', 'IP Address'].join(','),
      ...filteredLogs.map(log => [
        log.timestamp.toISOString(),
        log.action,
        log.category,
        log.actor.email,
        log.resource?.name || '',
        log.success ? 'Yes' : 'No',
        log.ipAddress || '',
      ].map(v => `"${v}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Audit logs exported');
  };

  const getActionParts = (action: string) => {
    const [resource, operation] = action.split('.');
    return { resource, operation };
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-blue-600" />
              Audit Log
            </CardTitle>
            <CardDescription>
              View system activity and changes for compliance
            </CardDescription>
            <DataFreshnessIndicator
              dataUpdatedAt={dataUpdatedAt}
              isFetching={isFetching}
            />
          </div>
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex items-center border border-slate-200 rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'h-8 w-8 flex items-center justify-center transition-colors',
                  viewMode === 'list' 
                    ? 'bg-slate-900 text-white' 
                    : 'bg-white text-slate-500 hover:bg-slate-50'
                )}
                title="List View"
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={cn(
                  'h-8 w-8 flex items-center justify-center transition-colors border-l border-slate-200',
                  viewMode === 'timeline' 
                    ? 'bg-slate-900 text-white' 
                    : 'bg-white text-slate-500 hover:bg-slate-50'
                )}
                title="Timeline View"
              >
                <History className="h-3.5 w-3.5" />
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={cn('h-3.5 w-3.5 mr-2', isFetching && 'animate-spin')} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportLogs}>
              <Download className="h-3.5 w-3.5 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <div className="space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search actions, users, resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-3.5 w-3.5 mr-2" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(categoryConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={successFilter} onValueChange={setSuccessFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="px-3 py-2.5 rounded-lg bg-slate-50 text-center">
            <p className="text-2xl font-bold">{logs.length}</p>
            <p className="text-xs text-slate-500">Total Events</p>
          </div>
          <div className="px-3 py-2.5 rounded-lg bg-green-50 text-center">
            <p className="text-2xl font-bold text-green-600">
              {logs.filter(l => l.success).length}
            </p>
            <p className="text-xs text-slate-500">Successful</p>
          </div>
          <div className="px-3 py-2.5 rounded-lg bg-red-50 text-center">
            <p className="text-2xl font-bold text-red-600">
              {logs.filter(l => !l.success).length}
            </p>
            <p className="text-xs text-slate-500">Failed</p>
          </div>
          <div className="px-3 py-2.5 rounded-lg bg-blue-50 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {new Set(logs.map(l => l.actor.id)).size}
            </p>
            <p className="text-xs text-slate-500">Unique Actors</p>
          </div>
        </div>

        {/* Log Entries */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600 mr-2" />
            <span>Loading audit logs...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No logs matching your filters</p>
          </div>
        ) : viewMode === 'timeline' ? (
          <AuditLogTimeline logs={filteredLogs} />
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {filteredLogs.map(log => {
                  const { resource, operation } = getActionParts(log.action);
                  const catConfig = categoryConfig[log.category] ?? categoryConfig.system;
                  const CatIcon = catConfig!.icon;
                  const isExpanded = expandedLogs.has(log.id);

                  return (
                    <Collapsible key={log.id} open={isExpanded} onOpenChange={() => toggleExpand(log.id)}>
                      <div className={cn(
                        'border rounded-lg transition-colors',
                        isExpanded ? 'border-blue-200' : 'hover:bg-slate-50'
                      )}>
                        <CollapsibleTrigger className="w-full px-3 py-3.5 flex items-center gap-3 text-left">
                          <div className={cn('p-2 rounded-lg', catConfig!.color)}>
                            <CatIcon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{log.action}</span>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  'px-3 py-1',
                                  log.success ? 'text-green-600' : 'text-red-600'
                                )}
                              >
                                {log.success ? 'Success' : 'Failed'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                              <span>{log.actor.name}</span>
                              {log.resource && (
                                <>
                                  <span>→</span>
                                  <span>{log.resource.name || log.resource.id}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-right text-xs text-slate-400 shrink-0">
                            <p>{formatDistanceToNow(log.timestamp, { addSuffix: true })}</p>
                            <p>{format(log.timestamp, 'HH:mm:ss')}</p>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                          )}
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-3 pb-3 pt-0 border-t bg-slate-50/50">
                            <div className="grid grid-cols-2 gap-4 p-3 text-sm">
                              <div>
                                <p className="text-xs text-slate-500 mb-1">Actor</p>
                                <p className="font-medium">{log.actor.name}</p>
                                <p className="text-xs text-slate-500">{log.actor.email}</p>
                                <Badge variant="outline" className="px-3 py-1 mt-1 text-xs">
                                  {log.actor.type}
                                </Badge>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 mb-1">Request Details</p>
                                <p className="text-xs font-mono">{log.ipAddress}</p>
                                <p className="text-xs text-slate-500 truncate mt-1">
                                  {log.userAgent}
                                </p>
                              </div>
                              {log.resource && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">Resource</p>
                                  <p className="font-medium">{log.resource.type}</p>
                                  <p className="text-xs font-mono">{log.resource.id}</p>
                                  {log.resource.name && (
                                    <p className="text-sm">{log.resource.name}</p>
                                  )}
                                </div>
                              )}
                              {log.errorMessage && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">Error</p>
                                  <p className="text-red-600">{log.errorMessage}</p>
                                </div>
                              )}
                              {Object.keys(log.details).length > 0 && (
                                <div className="col-span-2">
                                  <p className="text-xs text-slate-500 mb-1">Details</p>
                                  <pre className="text-xs bg-slate-100 p-2 rounded overflow-x-auto">
                                    {JSON.stringify(log.details, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })
              }
            </div>
          </ScrollArea>
        )}
        </div>
      </CardContent>
    </Card>
  );
});
