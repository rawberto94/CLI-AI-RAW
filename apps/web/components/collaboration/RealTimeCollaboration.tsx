'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Users,
  Eye,
  Edit3,
  MessageSquare,
  CheckCircle2,
  FileSignature,
  Activity,
  Clock,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface User {
  id: string;
  name: string;
  avatar?: string;
  initials: string;
}

interface PresenceData {
  userId: string;
  user: User;
  status: 'viewing' | 'editing' | 'idle';
  location: string; // e.g., "Contract: ABC-001"
  lastSeen: Date;
}

interface ActivityEvent {
  id: string;
  type: 'edit' | 'comment' | 'approve' | 'sign' | 'view';
  user: User;
  message: string;
  timestamp: Date;
  contractId?: string;
  contractTitle?: string;
}

interface RealTimeCollaborationProps {
  contractId?: string;
  tenantId: string;
}

export function RealTimeCollaboration({ contractId, tenantId }: RealTimeCollaborationProps) {
  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState<PresenceData[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    // Initialize WebSocket connection
    const connectWebSocket = () => {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
      
      // Use real WebSocket if URL is configured, otherwise use mock
      if (wsUrl) {
        try {
          const socket = new WebSocket(`${wsUrl}/realtime`);
          socket.onopen = () => setConnected(true);
          socket.onclose = () => setConnected(false);
          socket.onerror = () => setConnected(false);
          setWs(socket as any);
          return () => socket.close();
        } catch {
          // WebSocket connection failed, using mock
        }
      }
      
      // Mock WebSocket for development/demo
      const mockSocket = {
        send: () => {},
        close: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
      } as any;

      setWs(mockSocket);
      setConnected(true);

      // Simulate presence updates
      const presenceInterval = setInterval(() => {
        setPresence(generateMockPresence());
      }, 10000);

      // Simulate activity feed
      const activityInterval = setInterval(() => {
        setActivities((prev) => {
          const newActivity = generateMockActivity();
          return [newActivity, ...prev].slice(0, 20); // Keep last 20
        });
      }, 15000);

      // Initial data
      setPresence(generateMockPresence());
      setActivities(generateMockActivities(10));

      return () => {
        clearInterval(presenceInterval);
        clearInterval(activityInterval);
        mockSocket.close();
      };
    };

    const cleanup = connectWebSocket();
    return cleanup;
  }, [contractId, tenantId]);

  const getStatusIcon = (status: PresenceData['status']) => {
    switch (status) {
      case 'viewing':
        return <Eye className="h-3 w-3" />;
      case 'editing':
        return <Edit3 className="h-3 w-3" />;
      case 'idle':
        return <Clock className="h-3 w-3" />;
    }
  };

  const getStatusColor = (status: PresenceData['status']) => {
    switch (status) {
      case 'viewing':
        return 'bg-violet-500';
      case 'editing':
        return 'bg-green-500';
      case 'idle':
        return 'bg-gray-400';
    }
  };

  const getActivityIcon = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'edit':
        return <Edit3 className="h-4 w-4 text-violet-600" />;
      case 'comment':
        return <MessageSquare className="h-4 w-4 text-purple-600" />;
      case 'approve':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'sign':
        return <FileSignature className="h-4 w-4 text-purple-600" />;
      case 'view':
        return <Eye className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Active Users */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-violet-600" />
              Active Users
            </div>
            <div className="flex items-center gap-2">
              {connected ? (
                <>
                  <Wifi className="h-4 w-4 text-green-600" />
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    Connected
                  </Badge>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-red-600" />
                  <Badge variant="outline" className="text-red-600 border-red-600">
                    Disconnected
                  </Badge>
                </>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {presence.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No active users</p>
          ) : (
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {presence.map((user) => (
                  <div key={user.userId} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg">
                    <div className="relative">
                      <Avatar>
                        <AvatarImage src={user.user.avatar} />
                        <AvatarFallback>{user.user.initials}</AvatarFallback>
                      </Avatar>
                      <div
                        className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white flex items-center justify-center ${getStatusColor(user.status)}`}
                      >
                        {getStatusIcon(user.status)}
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{user.user.name}</p>
                      <p className="text-xs text-gray-500">{user.location}</p>
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatDistanceToNow(user.lastSeen, { addSuffix: true })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Live Activity Feed */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-600" />
            Live Activity Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            <div className="space-y-3">
              {activities.map((activity, index) => (
                <React.Fragment key={activity.id}>
                  {index > 0 && <Separator className="my-2" />}
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm">
                            <span className="font-medium">{activity.user.name}</span>{' '}
                            {activity.message}
                          </p>
                          {activity.contractTitle && (
                            <p className="text-xs text-gray-500 mt-1">
                              Contract: {activity.contractTitle}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// Mock data generators
function generateMockPresence(): PresenceData[] {
  const users: User[] = [
    { id: '1', name: 'Sarah Johnson', initials: 'SJ', avatar: undefined },
    { id: '2', name: 'Michael Chen', initials: 'MC', avatar: undefined },
    { id: '3', name: 'Emily Davis', initials: 'ED', avatar: undefined },
    { id: '4', name: 'James Wilson', initials: 'JW', avatar: undefined },
  ];

  const statuses: PresenceData['status'][] = ['viewing', 'editing', 'idle'];
  const locations = [
    'Contract: ABC-001',
    'Contract: XYZ-456',
    'Dashboard',
    'Template Library',
    'Workflow: Vendor Approval',
  ];

  return users
    .slice(0, Math.floor(Math.random() * users.length) + 1)
    .map((user) => ({
      userId: user.id,
      user,
      status: statuses[Math.floor(Math.random() * statuses.length)] ?? 'idle',
      location: locations[Math.floor(Math.random() * locations.length)] ?? 'Dashboard',
      lastSeen: new Date(Date.now() - Math.random() * 300000), // Within last 5 mins
    }));
}

function generateMockActivity(): ActivityEvent {
  const users: User[] = [
    { id: '1', name: 'Sarah Johnson', initials: 'SJ' },
    { id: '2', name: 'Michael Chen', initials: 'MC' },
    { id: '3', name: 'Emily Davis', initials: 'ED' },
    { id: '4', name: 'James Wilson', initials: 'JW' },
  ];

  const activities = [
    { type: 'edit' as const, message: 'edited the contract terms' },
    { type: 'comment' as const, message: 'added a comment on payment terms' },
    { type: 'approve' as const, message: 'approved the workflow step' },
    { type: 'sign' as const, message: 'signed the contract' },
    { type: 'view' as const, message: 'viewed the contract' },
  ];

  const contracts = ['Acme Corp MSA', 'TechVendor SLA', 'Global Services SOW'];

  const activity = activities[Math.floor(Math.random() * activities.length)]!;
  const user = users[Math.floor(Math.random() * users.length)]!;

  return {
    id: `activity-${Date.now()}-${Math.random()}`,
    type: activity.type,
    user,
    message: activity.message,
    timestamp: new Date(),
    contractTitle: contracts[Math.floor(Math.random() * contracts.length)],
  };
}

function generateMockActivities(count: number): ActivityEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    ...generateMockActivity(),
    timestamp: new Date(Date.now() - i * 60000 * Math.random() * 10), // Spread over last ~hour
  }));
}
