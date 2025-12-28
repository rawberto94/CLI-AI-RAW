/**
 * Audit Log Timeline Component
 * 
 * Visual timeline representation of audit log entries grouped by date
 * with expandable details and filtering options.
 */

'use client';

import { memo, useMemo } from 'react';
import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';
import {
  User,
  FileText,
  Settings,
  Shield,
  Database,
  Zap,
  Eye,
  Edit,
  Trash2,
  Upload,
  Download,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { AuditLogEntry } from '@/hooks/use-monitoring-queries';

interface AuditLogTimelineProps {
  logs: AuditLogEntry[];
  className?: string;
}

const categoryConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  user: { icon: User, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  contract: { icon: FileText, color: 'text-green-600', bgColor: 'bg-green-100' },
  system: { icon: Settings, color: 'text-slate-600', bgColor: 'bg-slate-100' },
  security: { icon: Shield, color: 'text-red-600', bgColor: 'bg-red-100' },
  data: { icon: Database, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  integration: { icon: Zap, color: 'text-orange-600', bgColor: 'bg-orange-100' },
};

const actionIcons: Record<string, React.ElementType> = {
  create: Upload,
  read: Eye,
  view: Eye,
  update: Edit,
  edit: Edit,
  delete: Trash2,
  export: Download,
  import: Upload,
  download: Download,
  upload: Upload,
};

function formatDateHeader(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}

function getActionIcon(action: string): React.ElementType {
  const lowerAction = action.toLowerCase();
  for (const [key, icon] of Object.entries(actionIcons)) {
    if (lowerAction.includes(key)) {
      return icon;
    }
  }
  return Settings;
}

function formatActionName(action: string): string {
  // Convert action strings like "contract.created" to "Contract Created"
  return action
    .split('.')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export const AuditLogTimeline = memo(function AuditLogTimeline({
  logs,
  className,
}: AuditLogTimelineProps) {
  // Group logs by date
  const groupedLogs = useMemo(() => {
    const groups = new Map<string, AuditLogEntry[]>();
    
    logs.forEach(log => {
      const dateKey = format(log.timestamp, 'yyyy-MM-dd');
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(log);
    });
    
    // Convert to array and sort by date (newest first)
    return Array.from(groups.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, logs]) => ({
        date: parseISO(dateKey),
        logs,
      }));
  }, [logs]);

  if (logs.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-12">
          <div className="text-center text-slate-500">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No audit logs yet</p>
            <p className="text-xs mt-1">Activity will appear here as actions are performed</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {groupedLogs.map(({ date, logs }) => (
        <div key={date.toISOString()}>
          {/* Date Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="text-sm font-semibold text-slate-900">
              {formatDateHeader(date)}
            </div>
            <div className="flex-1 h-px bg-slate-200" />
            <Badge variant="secondary" className="text-xs">
              {logs.length} {logs.length === 1 ? 'event' : 'events'}
            </Badge>
          </div>

          {/* Timeline */}
          <div className="space-y-0 relative">
            {/* Vertical line */}
            <div className="absolute left-[18px] top-0 bottom-0 w-0.5 bg-slate-200" />

            {logs.map((log, index) => {
              const CategoryIcon = categoryConfig[log.category]?.icon || Settings;
              const ActionIcon = getActionIcon(log.action);
              const isLast = index === logs.length - 1;

              return (
                <div key={log.id} className="relative pl-12 pb-6 last:pb-0">
                  {/* Timeline dot */}
                  <div className={cn(
                    'absolute left-0 w-9 h-9 rounded-full flex items-center justify-center ring-4 ring-white z-10',
                    log.success ? 'bg-emerald-50 ring-emerald-100' : 'bg-red-50 ring-red-100'
                  )}>
                    <CategoryIcon className={cn(
                      'h-4 w-4',
                      log.success 
                        ? categoryConfig[log.category]?.color || 'text-slate-600'
                        : 'text-red-600'
                    )} />
                  </div>

                  {/* Content card */}
                  <Card className={cn(
                    'transition-all hover:shadow-md',
                    !log.success && 'border-red-200 bg-red-50/30'
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Action and status */}
                          <div className="flex items-center gap-2 mb-1">
                            <ActionIcon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                            <h4 className="text-sm font-medium text-slate-900 truncate">
                              {formatActionName(log.action)}
                            </h4>
                            {log.success ? (
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
                            )}
                          </div>

                          {/* Actor info */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-slate-600">by</span>
                            <Badge variant="outline" className="text-xs font-normal">
                              <User className="h-3 w-3 mr-1" />
                              {log.actor.name}
                            </Badge>
                            <span className="text-xs text-slate-400">
                              {formatDistanceToNow(log.timestamp, { addSuffix: true })}
                            </span>
                          </div>

                          {/* Resource info */}
                          {log.resource && (
                            <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
                              <span className="text-slate-400">on</span>
                              <Badge variant="secondary" className="text-xs font-normal">
                                {log.resource.type}
                              </Badge>
                              {log.resource.name && (
                                <span className="truncate max-w-xs">
                                  {log.resource.name}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Error message */}
                          {!log.success && log.errorMessage && (
                            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 mt-2">
                              {log.errorMessage}
                            </div>
                          )}

                          {/* Additional details */}
                          {log.details && Object.keys(log.details).length > 0 && (
                            <details className="mt-2 text-xs">
                              <summary className="cursor-pointer text-slate-500 hover:text-slate-700">
                                View details
                              </summary>
                              <pre className="mt-2 bg-slate-50 border border-slate-200 rounded p-2 overflow-x-auto text-[10px]">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>

                        {/* Time */}
                        <div className="text-xs text-slate-500 flex-shrink-0">
                          {format(log.timestamp, 'h:mm a')}
                        </div>
                      </div>

                      {/* IP Address footer */}
                      {log.ipAddress && (
                        <div className="mt-3 pt-3 border-t border-slate-100 text-[10px] text-slate-400 flex items-center gap-2">
                          <Shield className="h-3 w-3" />
                          <span>IP: {log.ipAddress}</span>
                          {log.userAgent && (
                            <span className="truncate max-w-xs" title={log.userAgent}>
                              • {log.userAgent}
                            </span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
});
