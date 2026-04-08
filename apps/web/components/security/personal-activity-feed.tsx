'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  LogIn,
  LogOut,
  FileText,
  Upload,
  Download,
  Pencil,
  Trash2,
  Shield,
  Key,
  Search,
  Bot,
  Settings,
  RefreshCcw,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityEntry {
  id: string;
  action: string;
  timestamp: string;
  ipAddress: string | null;
  success: boolean;
  resourceType: string | null;
  resourceId: string | null;
  description: string;
}

interface ActivityResponse {
  activities: ActivityEntry[];
  hasMore: boolean;
  nextCursor: string | null;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  LOGIN_SUCCESS: <LogIn className="h-4 w-4 text-green-600" />,
  LOGIN_FAILED: <LogIn className="h-4 w-4 text-red-500" />,
  LOGOUT: <LogOut className="h-4 w-4 text-slate-500" />,
  PASSWORD_CHANGE: <Key className="h-4 w-4 text-amber-600" />,
  MFA_ENABLED: <Shield className="h-4 w-4 text-green-600" />,
  MFA_DISABLED: <Shield className="h-4 w-4 text-red-500" />,
  MFA_VERIFIED: <Shield className="h-4 w-4 text-green-600" />,
  PROFILE_UPDATE: <Settings className="h-4 w-4 text-violet-600" />,
  CONTRACT_VIEW: <FileText className="h-4 w-4 text-blue-500" />,
  CONTRACT_CREATE: <FileText className="h-4 w-4 text-green-600" />,
  CONTRACT_UPDATE: <Pencil className="h-4 w-4 text-amber-600" />,
  CONTRACT_DELETE: <Trash2 className="h-4 w-4 text-red-500" />,
  CONTRACT_UPLOAD: <Upload className="h-4 w-4 text-violet-600" />,
  CONTRACT_DOWNLOAD: <Download className="h-4 w-4 text-blue-500" />,
  CONTRACT_EXPORT: <Download className="h-4 w-4 text-blue-500" />,
  DRAFT_CREATE: <FileText className="h-4 w-4 text-green-600" />,
  DRAFT_UPDATE: <Pencil className="h-4 w-4 text-amber-600" />,
  DRAFT_DELETE: <Trash2 className="h-4 w-4 text-red-500" />,
  AI_CHAT: <Bot className="h-4 w-4 text-violet-600" />,
  AI_ANALYSIS: <Bot className="h-4 w-4 text-violet-600" />,
  SEARCH: <Search className="h-4 w-4 text-slate-500" />,
  SESSION_REVOKED: <Shield className="h-4 w-4 text-amber-600" />,
  SETTINGS_UPDATE: <Settings className="h-4 w-4 text-violet-600" />,
};

function getActionIcon(action: string) {
  return ACTION_ICONS[action] || <Activity className="h-4 w-4 text-slate-400" />;
}

export function PersonalActivityFeed() {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const fetchActivities = useCallback(async (cursor?: string | null) => {
    try {
      if (cursor) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const params = new URLSearchParams({ limit: '15' });
      if (cursor) params.set('cursor', cursor);

      const res = await fetch(`/api/user/activity?${params}`);
      if (!res.ok) throw new Error('Failed to load activity');

      const data: { data: ActivityResponse } = await res.json();
      const result = data.data;

      if (cursor) {
        setActivities(prev => [...prev, ...result.activities]);
      } else {
        setActivities(result.activities);
      }
      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
    } catch {
      setError('Unable to load recent activity');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  return (
    <Card className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-white/50 dark:border-slate-700/50 shadow-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 text-white shadow-lg shadow-blue-500/30">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your recent actions across the platform</CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchActivities()}
            className="text-muted-foreground"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            <span className="ml-2 text-sm text-muted-foreground">Loading activity...</span>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => fetchActivities()}
            >
              Try again
            </Button>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No activity recorded yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your actions will appear here as you use the platform.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {activities.map((entry, index) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 py-2.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                {/* Icon */}
                <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  {getActionIcon(entry.action)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {entry.description}
                    </p>
                    {!entry.success && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        Failed
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                    </span>
                    {entry.ipAddress && (
                      <span className="text-xs text-muted-foreground">
                        · {entry.ipAddress}
                      </span>
                    )}
                  </div>
                </div>

                {/* Success indicator */}
                <div className="flex-shrink-0 mt-1">
                  {entry.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
              </div>
            ))}

            {hasMore && (
              <div className="pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchActivities(nextCursor)}
                  disabled={loadingMore}
                  className="w-full text-muted-foreground"
                >
                  {loadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ChevronDown className="h-4 w-4 mr-2" />
                  )}
                  Load more
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
