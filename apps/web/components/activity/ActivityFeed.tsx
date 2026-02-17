/**
 * Activity Feed
 * Real-time activity tracking across the system
 */

'use client';

import { memo, useState, useEffect, useRef } from 'react';
import {
  Activity,
  FileText,
  Upload,
  Download,
  Edit,
  Trash2,
  Eye,
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Filter,
  RefreshCw,
  Pause,
  Play,
  Settings,
  Zap as _Zap,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { formatDistanceToNow } from 'date-fns';

type ActivityType = 
  | 'contract_created'
  | 'contract_updated'
  | 'contract_deleted'
  | 'contract_viewed'
  | 'contract_downloaded'
  | 'contract_approved'
  | 'contract_rejected'
  | 'comment_added'
  | 'processing_started'
  | 'processing_completed'
  | 'processing_failed'
  | 'user_login'
  | 'settings_changed'
  | 'import_completed'
  | 'export_completed';

interface ActivityEvent {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  user: {
    name: string;
    email: string;
    avatar?: string;
  };
  metadata?: Record<string, any>;
  timestamp: Date;
  contractId?: string;
  contractName?: string;
}

const activityConfig: Record<ActivityType, { 
  icon: React.ElementType; 
  color: string; 
  bg: string;
  label: string;
}> = {
  contract_created: { icon: FileText, color: 'text-green-600', bg: 'bg-green-100', label: 'Created' },
  contract_updated: { icon: Edit, color: 'text-violet-600', bg: 'bg-violet-100', label: 'Updated' },
  contract_deleted: { icon: Trash2, color: 'text-red-600', bg: 'bg-red-100', label: 'Deleted' },
  contract_viewed: { icon: Eye, color: 'text-slate-600', bg: 'bg-slate-100', label: 'Viewed' },
  contract_downloaded: { icon: Download, color: 'text-violet-600', bg: 'bg-violet-100', label: 'Downloaded' },
  contract_approved: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', label: 'Approved' },
  contract_rejected: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Rejected' },
  comment_added: { icon: MessageSquare, color: 'text-violet-600', bg: 'bg-violet-100', label: 'Comment' },
  processing_started: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Processing' },
  processing_completed: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', label: 'Completed' },
  processing_failed: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100', label: 'Failed' },
  user_login: { icon: User, color: 'text-slate-600', bg: 'bg-slate-100', label: 'Login' },
  settings_changed: { icon: Settings, color: 'text-slate-600', bg: 'bg-slate-100', label: 'Settings' },
  import_completed: { icon: Upload, color: 'text-green-600', bg: 'bg-green-100', label: 'Import' },
  export_completed: { icon: Download, color: 'text-violet-600', bg: 'bg-violet-100', label: 'Export' },
};

// Fetch real activities from the API
async function fetchActivities(
  contractId?: string,
  limit: number = 50
): Promise<ActivityEvent[]> {
  try {
    const params = new URLSearchParams();
    if (contractId) params.set('contractId', contractId);
    params.set('limit', String(limit));

    const res = await fetch(`/api/activity?${params.toString()}`);
    if (!res.ok) return [];
    const json = await res.json();
    const items: any[] = json?.data ?? json?.activities ?? [];

    return items.map((item: any) => ({
      id: item.id,
      type: (item.type ?? 'contract_viewed') as ActivityType,
      title: item.title ?? item.action ?? 'Activity',
      description: item.description,
      user: {
        name: item.userName ?? item.user?.name ?? 'System',
        email: item.userEmail ?? item.user?.email ?? '',
        avatar: item.userAvatar ?? item.user?.avatar,
      },
      metadata: item.metadata,
      timestamp: new Date(item.timestamp),
      contractId: item.contractId,
      contractName: item.contractName,
    }));
  } catch {
    return [];
  }
}

interface ActivityFeedProps {
  contractId?: string;
  maxItems?: number;
  showFilters?: boolean;
  compact?: boolean;
  className?: string;
}

export const ActivityFeed = memo(function ActivityFeed({
  contractId,
  maxItems = 50,
  showFilters = true,
  compact = false,
  className,
}: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [isLive, setIsLive] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize activities from the real API
  useEffect(() => {
    let cancelled = false;
    fetchActivities(contractId, maxItems).then((data) => {
      if (!cancelled) setActivities(data);
    });
    return () => { cancelled = true; };
  }, [contractId, maxItems]);

  // Poll for real-time updates when live mode is on
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      fetchActivities(contractId, maxItems).then((data) => {
        if (data.length > 0) setActivities(data);
      });
    }, 15000); // Poll every 15 seconds

    return () => clearInterval(interval);
  }, [isLive, contractId, maxItems]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const data = await fetchActivities(contractId, maxItems);
    setActivities(data);
    setIsRefreshing(false);
  };

  const filteredActivities = activities.filter(activity => {
    if (filter === 'all') return true;
    if (filter === 'contracts') {
      return ['contract_created', 'contract_updated', 'contract_deleted', 'contract_viewed', 'contract_downloaded'].includes(activity.type);
    }
    if (filter === 'approvals') {
      return ['contract_approved', 'contract_rejected'].includes(activity.type);
    }
    if (filter === 'processing') {
      return ['processing_started', 'processing_completed', 'processing_failed'].includes(activity.type);
    }
    if (filter === 'system') {
      return ['user_login', 'settings_changed', 'import_completed', 'export_completed'].includes(activity.type);
    }
    return true;
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={cn('space-y-4', className)} ref={containerRef}>
      {/* Header */}
      {showFilters && (
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5 text-violet-600" />
            Activity Feed
            {isLive && (
              <Badge variant="outline" className="text-green-600 border-green-300">
                <span className="h-2 w-2 rounded-full bg-green-500 mr-1.5 animate-pulse" />
                Live
              </Badge>
            )}
          </h3>
          
          <div className="flex items-center gap-3">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activity</SelectItem>
                <SelectItem value="contracts">Contracts</SelectItem>
                <SelectItem value="approvals">Approvals</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Switch
                id="live"
                checked={isLive}
                onCheckedChange={setIsLive}
                className="data-[state=checked]:bg-green-500"
              />
              <Label htmlFor="live" className="text-xs cursor-pointer">
                {isLive ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              </Label>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            </Button>
          </div>
        </div>
      )}

      {/* Activity List */}
      <div className={cn(
        'space-y-1',
        !compact && 'divide-y'
      )}>
        {filteredActivities.map((activity, index) => {
          const config = activityConfig[activity.type];
          const Icon = config.icon;
          const isNew = index === 0 && Date.now() - activity.timestamp.getTime() < 60000;

          return (
            <div
              key={activity.id}
              className={cn(
                'flex items-start gap-3 transition-all',
                compact ? 'py-2' : 'py-3',
                isNew && 'bg-violet-50 -mx-2 px-2 rounded-lg'
              )}
            >
              {!compact && (
                <Avatar className="h-8 w-8">
                  <AvatarImage src={activity.user.avatar} />
                  <AvatarFallback className="text-xs bg-slate-100">
                    {getInitials(activity.user.name)}
                  </AvatarFallback>
                </Avatar>
              )}

              <div className={cn(
                'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0',
                config.bg
              )}>
                <Icon className={cn('h-4 w-4', config.color)} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={cn(
                      'text-sm',
                      isNew && 'font-medium'
                    )}>
                      <span className="font-medium">{activity.user.name}</span>
                      {' '}
                      <span className="text-slate-600">{activity.title.toLowerCase()}</span>
                    </p>
                    {activity.contractName && (
                      <p className="text-sm text-violet-600 hover:underline cursor-pointer truncate">
                        {activity.contractName}
                      </p>
                    )}
                    {activity.description && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                        {activity.description}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredActivities.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          <Activity className="h-10 w-10 mx-auto mb-2 opacity-20" />
          <p>No activity to show</p>
        </div>
      )}

      {filteredActivities.length > 0 && (
        <div className="text-center">
          <Button variant="ghost" size="sm" className="text-slate-500">
            View all activity
          </Button>
        </div>
      )}
    </div>
  );
});

export default ActivityFeed;
