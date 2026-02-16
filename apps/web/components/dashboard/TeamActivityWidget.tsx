'use client';

/**
 * Team Activity Widget
 * 
 * Dashboard widget showing team members' recent activities.
 * Displays activity feed, online status, and collaboration insights.
 */

import React, { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  Users,
  FileText,
  CheckCircle,
  MessageSquare,
  Upload,
  Edit,
  Eye,
  ArrowUpRight,
  Clock,
  Filter,
  Circle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// ============ Types ============

export type ActivityType = 
  | 'view' 
  | 'edit' 
  | 'comment' 
  | 'approve' 
  | 'upload' 
  | 'create' 
  | 'share';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  isOnline: boolean;
  lastActive?: Date;
}

export interface TeamActivity {
  id: string;
  user: TeamMember;
  type: ActivityType;
  target: string;
  targetId?: string;
  targetType: 'contract' | 'document' | 'comment' | 'workflow';
  timestamp: Date;
  details?: string;
}

interface TeamActivityWidgetProps {
  activities: TeamActivity[];
  teamMembers: TeamMember[];
  onActivityClick?: (activity: TeamActivity) => void;
  onViewAll?: () => void;
  onMemberClick?: (member: TeamMember) => void;
  className?: string;
}

// ============ Helpers ============

const getActivityIcon = (type: ActivityType) => {
  switch (type) {
    case 'view': return Eye;
    case 'edit': return Edit;
    case 'comment': return MessageSquare;
    case 'approve': return CheckCircle;
    case 'upload': return Upload;
    case 'create': return FileText;
    case 'share': return Users;
    default: return FileText;
  }
};

const getActivityColor = (type: ActivityType) => {
  switch (type) {
    case 'approve': return 'text-green-500 bg-green-500/10';
    case 'edit': return 'text-violet-500 bg-violet-500/10';
    case 'comment': return 'text-yellow-500 bg-yellow-500/10';
    case 'upload': return 'text-violet-500 bg-violet-500/10';
    case 'create': return 'text-violet-500 bg-violet-500/10';
    case 'share': return 'text-pink-500 bg-pink-500/10';
    default: return 'text-muted-foreground bg-muted';
  }
};

const getActivityVerb = (type: ActivityType) => {
  switch (type) {
    case 'view': return 'viewed';
    case 'edit': return 'edited';
    case 'comment': return 'commented on';
    case 'approve': return 'approved';
    case 'upload': return 'uploaded';
    case 'create': return 'created';
    case 'share': return 'shared';
    default: return 'updated';
  }
};

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// ============ Sub-components ============

const OnlineIndicator = memo(function OnlineIndicator({ isOnline }: { isOnline: boolean }) {
  return (
    <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${
      isOnline ? 'bg-green-500' : 'bg-muted-foreground/30'
    }`} />
  );
});

const TeamMemberAvatar = memo(function TeamMemberAvatar({
  member,
  size = 'default',
  showStatus = true,
  onClick,
}: {
  member: TeamMember;
  size?: 'sm' | 'default';
  showStatus?: boolean;
  onClick?: () => void;
}) {
  const sizeClass = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8';
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button 
          className="relative inline-flex"
          onClick={onClick}
        >
          <Avatar className={sizeClass}>
            <AvatarImage src={member.avatar} alt={member.name} />
            <AvatarFallback className="text-[10px]">
              {getInitials(member.name)}
            </AvatarFallback>
          </Avatar>
          {showStatus && <OnlineIndicator isOnline={member.isOnline} />}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs">
          <p className="font-medium">{member.name}</p>
          <p className="text-muted-foreground">{member.role}</p>
          {!member.isOnline && member.lastActive && (
            <p className="text-muted-foreground">
              Last active {formatDistanceToNow(member.lastActive, { addSuffix: true })}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
});

const ActivityItem = memo(function ActivityItem({
  activity,
  onClick,
}: {
  activity: TeamActivity;
  onClick?: () => void;
}) {
  const Icon = getActivityIcon(activity.type);
  
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
      onClick={onClick}
    >
      <Avatar className="h-8 w-8 mt-0.5">
        <AvatarImage src={activity.user.avatar} alt={activity.user.name} />
        <AvatarFallback className="text-[10px]">
          {getInitials(activity.user.name)}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <p className="text-xs">
          <span className="font-medium">{activity.user.name}</span>
          {' '}
          <span className="text-muted-foreground">{getActivityVerb(activity.type)}</span>
          {' '}
          <span className="font-medium truncate">{activity.target}</span>
        </p>
        {activity.details && (
          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
            {activity.details}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
        </p>
      </div>
      
      <div className={`p-1.5 rounded ${getActivityColor(activity.type)}`}>
        <Icon className="h-3 w-3" />
      </div>
    </motion.button>
  );
});

const OnlineTeamMembers = memo(function OnlineTeamMembers({
  members,
  onMemberClick,
}: {
  members: TeamMember[];
  onMemberClick?: (member: TeamMember) => void;
}) {
  const onlineMembers = members.filter(m => m.isOnline);
  const offlineMembers = members.filter(m => !m.isOnline);
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Circle className="h-2 w-2 fill-green-500 text-green-500" />
          {onlineMembers.length} online
        </h4>
        <span className="text-[10px] text-muted-foreground">
          {members.length} total
        </span>
      </div>
      
      <div className="flex flex-wrap gap-1">
        {onlineMembers.slice(0, 8).map((member) => (
          <TeamMemberAvatar
            key={member.id}
            member={member}
            size="sm"
            onClick={() => onMemberClick?.(member)}
          />
        ))}
        {offlineMembers.slice(0, 4).map((member) => (
          <TeamMemberAvatar
            key={member.id}
            member={member}
            size="sm"
            onClick={() => onMemberClick?.(member)}
          />
        ))}
        {members.length > 12 && (
          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">
            +{members.length - 12}
          </div>
        )}
      </div>
    </div>
  );
});

// ============ Main Component ============

export function TeamActivityWidget({
  activities,
  teamMembers,
  onActivityClick,
  onViewAll,
  onMemberClick,
  className = '',
}: TeamActivityWidgetProps) {
  const [filter, setFilter] = useState<ActivityType | 'all'>('all');
  
  const filteredActivities = filter === 'all' 
    ? activities 
    : activities.filter(a => a.type === filter);

  const activityTypes: { value: ActivityType | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'edit', label: 'Edits' },
    { value: 'comment', label: 'Comments' },
    { value: 'approve', label: 'Approvals' },
  ];

  return (
    <TooltipProvider>
      <Card className={`overflow-hidden ${className}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-violet-500" />
              Team Activity
            </CardTitle>
            
            {onViewAll && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2 text-xs"
                onClick={onViewAll}
              >
                View all
                <ArrowUpRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-2 space-y-4">
          {/* Online Team Members */}
          <OnlineTeamMembers 
            members={teamMembers} 
            onMemberClick={onMemberClick}
          />

          {/* Activity Filter */}
          <div className="flex items-center gap-1 border-b pb-2">
            {activityTypes.map((type) => (
              <Button
                key={type.value}
                variant={filter === type.value ? 'secondary' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => setFilter(type.value)}
              >
                {type.label}
              </Button>
            ))}
          </div>

          {/* Activity Feed */}
          <ScrollArea className="h-[200px] -mx-2">
            <div className="px-2 space-y-1">
              <AnimatePresence mode="popLayout">
                {filteredActivities.length > 0 ? (
                  filteredActivities.slice(0, 10).map((activity) => (
                    <ActivityItem
                      key={activity.id}
                      activity={activity}
                      onClick={() => onActivityClick?.(activity)}
                    />
                  ))
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-8"
                  >
                    <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      No recent activity
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

export default memo(TeamActivityWidget);
