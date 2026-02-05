'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Download, Search, Filter, Calendar } from 'lucide-react';

interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: {
    before: any;
    after: any;
  };
}

interface AuditLogViewerProps {
  tenantId?: string;
  entityType?: string;
  entityId?: string;
}

export function AuditLogViewer({ tenantId, entityType: initialEntityType, entityId }: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    userId: '',
    action: '',
    entityType: initialEntityType || '',
    search: '',
  });
  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0,
    total: 0,
    hasMore: false,
  });

  useEffect(() => {
    fetchAuditLogs();
    
  }, [pagination.offset]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const paramsObj: Record<string, string> = {
        tenantId: tenantId ?? '',
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
      };
      if (filters.startDate) paramsObj.startDate = filters.startDate;
      if (filters.endDate) paramsObj.endDate = filters.endDate;
      if (filters.userId) paramsObj.userId = filters.userId;
      if (filters.action) paramsObj.action = filters.action;
      if (filters.entityType) paramsObj.entityType = filters.entityType;
      const params = new URLSearchParams(paramsObj);

      const response = await fetch(`/api/rate-cards/audit-logs?${params}`);
      const data = await response.json();

      setLogs(data.logs);
      setPagination((prev) => ({
        ...prev,
        total: data.total,
        hasMore: data.hasMore,
      }));
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    setPagination((prev) => ({ ...prev, offset: 0 }));
    fetchAuditLogs();
  };

  const resetFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      userId: '',
      action: '',
      entityType: '',
      search: '',
    });
    setPagination((prev) => ({ ...prev, offset: 0 }));
    fetchAuditLogs();
  };

  const exportToCSV = async () => {
    try {
      const paramsObj: Record<string, string> = {
        tenantId: tenantId ?? '',
        format: 'csv',
      };
      if (filters.startDate) paramsObj.startDate = filters.startDate;
      if (filters.endDate) paramsObj.endDate = filters.endDate;
      const params = new URLSearchParams(paramsObj);

      const response = await fetch(`/api/rate-cards/compliance-report?${params}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString()}.csv`;
      a.click();
    } catch {
      // Error handled silently
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes('create')) return 'bg-green-100 text-green-800';
    if (action.includes('update')) return 'bg-violet-100 text-violet-800';
    if (action.includes('delete')) return 'bg-red-100 text-red-800';
    if (action.includes('export')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Audit Log</CardTitle>
            <CardDescription>View and filter system activity logs</CardDescription>
          </div>
          <Button onClick={exportToCSV} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <Input
              type="date"
              placeholder="Start Date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
            <Input
              type="date"
              placeholder="End Date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
            <Input
              placeholder="User ID"
              value={filters.userId}
              onChange={(e) => handleFilterChange('userId', e.target.value)}
            />
            <Input
              placeholder="Action"
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={applyFilters} size="sm" className="flex-1">
                <Filter className="h-4 w-4 mr-2" />
                Apply
              </Button>
              <Button onClick={resetFilters} variant="outline" size="sm">
                Reset
              </Button>
            </div>
          </div>

          {/* Logs Table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">Timestamp</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">User</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Action</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Entity</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Entity ID</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Changes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        Loading audit logs...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        No audit logs found
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/50">
                        <td className="px-4 py-3 text-sm">{formatDate(log.timestamp)}</td>
                        <td className="px-4 py-3 text-sm">{log.userName}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getActionBadgeColor(
                              log.action
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{log.entityType}</td>
                        <td className="px-4 py-3 text-sm font-mono text-xs">
                          {log.entityId.substring(0, 8)}...
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {log.changes ? (
                            <Button variant="ghost" size="sm">
                              View Diff
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {pagination.offset + 1} to {Math.min(pagination.offset + pagination.limit, pagination.total)} of{' '}
              {pagination.total} logs
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setPagination((prev) => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                disabled={pagination.offset === 0}
                variant="outline"
                size="sm"
              >
                Previous
              </Button>
              <Button
                onClick={() => setPagination((prev) => ({ ...prev, offset: prev.offset + prev.limit }))}
                disabled={!pagination.hasMore}
                variant="outline"
                size="sm"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
