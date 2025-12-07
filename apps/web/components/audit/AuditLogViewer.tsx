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
  Loader2
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

// Mock data generator
function generateMockLogs(): AuditLogEntry[] {
  const actions = [
    { action: 'contract.created', category: 'contract' as const },
    { action: 'contract.updated', category: 'contract' as const },
    { action: 'contract.deleted', category: 'contract' as const },
    { action: 'contract.exported', category: 'contract' as const },
    { action: 'user.login', category: 'user' as const },
    { action: 'user.logout', category: 'user' as const },
    { action: 'user.created', category: 'user' as const },
    { action: 'api_key.created', category: 'security' as const },
    { action: 'api_key.revoked', category: 'security' as const },
    { action: 'webhook.created', category: 'integration' as const },
    { action: 'data.imported', category: 'data' as const },
    { action: 'data.synced', category: 'data' as const },
    { action: 'settings.updated', category: 'system' as const },
    { action: 'backup.created', category: 'system' as const },
  ];

  const users = [
    { id: 'usr_1', name: 'John Doe', email: 'john@example.com', type: 'user' as const },
    { id: 'usr_2', name: 'Jane Smith', email: 'jane@example.com', type: 'user' as const },
    { id: 'sys_1', name: 'System', email: 'system@internal', type: 'system' as const },
    { id: 'api_1', name: 'API Client', email: 'api@integration', type: 'api' as const },
  ];

  return Array.from({ length: 50 }, (_, i) => {
    const actionConfig = actions[Math.floor(Math.random() * actions.length)]!;
    const user = users[Math.floor(Math.random() * users.length)]!;
    const success = Math.random() > 0.1;

    return {
      id: `log_${Date.now()}_${i}`,
      timestamp: new Date(Date.now() - i * 600000 - Math.random() * 300000),
      action: actionConfig.action,
      category: actionConfig.category,
      actor: user,
      resource: actionConfig.category === 'contract' ? {
        type: 'contract',
        id: `ctr_${Math.floor(Math.random() * 1000)}`,
        name: `Contract #${Math.floor(Math.random() * 1000)}`,
      } : undefined,
      details: {
        changes: actionConfig.action.includes('update') ? { status: { from: 'draft', to: 'active' } } : undefined,
        source: 'web',
        duration_ms: Math.floor(Math.random() * 500),
      },
      ipAddress: `192.168.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      success,
      errorMessage: success ? undefined : 'Permission denied',
    };
  });
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
  
  // Fall back to mock data if no data from API
  const logs = data?.logs ?? generateMockLogs();
  
  // Local UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [successFilter, setSuccessFilter] = useState<string>('all');
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

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
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={cn('h-4 w-4 mr-2', isFetching && 'animate-spin')} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportLogs}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search actions, users, resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
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
          <div className="p-3 rounded-lg bg-slate-50 text-center">
            <p className="text-2xl font-bold">{logs.length}</p>
            <p className="text-xs text-slate-500">Total Events</p>
          </div>
          <div className="p-3 rounded-lg bg-green-50 text-center">
            <p className="text-2xl font-bold text-green-600">
              {logs.filter(l => l.success).length}
            </p>
            <p className="text-xs text-slate-500">Successful</p>
          </div>
          <div className="p-3 rounded-lg bg-red-50 text-center">
            <p className="text-2xl font-bold text-red-600">
              {logs.filter(l => !l.success).length}
            </p>
            <p className="text-xs text-slate-500">Failed</p>
          </div>
          <div className="p-3 rounded-lg bg-blue-50 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {new Set(logs.map(l => l.actor.id)).size}
            </p>
            <p className="text-xs text-slate-500">Unique Actors</p>
          </div>
        </div>

        {/* Log Entries */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
            <span>Loading audit logs...</span>
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No logs matching your filters
                </div>
              ) : (
                filteredLogs.map(log => {
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
                        <CollapsibleTrigger className="w-full p-3 flex items-center gap-3 text-left">
                          <div className={cn('p-2 rounded-lg', catConfig!.color)}>
                            <CatIcon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{log.action}</span>
                              <Badge 
                                variant="outline" 
                                className={log.success ? 'text-green-600' : 'text-red-600'}
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
                            <ChevronUp className="h-4 w-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          )}
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-3 pb-3 pt-0 border-t bg-slate-50/50">
                            <div className="grid grid-cols-2 gap-4 p-3 text-sm">
                              <div>
                                <p className="text-xs text-slate-500 mb-1">Actor</p>
                                <p className="font-medium">{log.actor.name}</p>
                                <p className="text-xs text-slate-500">{log.actor.email}</p>
                                <Badge variant="outline" className="mt-1 text-xs">
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
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
});
