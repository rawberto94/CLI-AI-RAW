'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCircle2, Clock, XCircle, AlertTriangle, X, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useWebSocket, type ApprovalNotification } from '@/contexts/websocket-context';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// Framer Motion typing workaround
const MotionDiv = motion.div as React.ComponentType<
  React.HTMLAttributes<HTMLDivElement> & {
    initial?: object;
    animate?: object;
    exit?: object;
    whileHover?: object;
    className?: string;
    key?: string;
  }
>;

interface NotificationItemProps {
  notification: ApprovalNotification;
  onDismiss: (id: string) => void;
}

function NotificationItem({ notification, onDismiss }: NotificationItemProps) {
  const getIcon = () => {
    switch (notification.type) {
      case 'new_approval':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'approval_completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'approval_rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'step_completed':
        return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
      case 'deadline_reminder':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  const getPriorityColor = () => {
    switch (notification.priority) {
      case 'urgent':
        return 'border-l-red-500';
      case 'high':
        return 'border-l-orange-500';
      case 'medium':
        return 'border-l-amber-500';
      default:
        return 'border-l-gray-300';
    }
  };

  const timeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <MotionDiv
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={cn(
        "p-3 bg-white border-l-4 rounded-r-lg hover:bg-gray-50 transition-colors",
        getPriorityColor()
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {notification.title}
          </p>
          <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
            {notification.message}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-400">
              {timeAgo(notification.timestamp)}
            </span>
            <Link 
              href={`/approvals?id=${notification.approvalId}`}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Eye className="w-3 h-3" />
              View
            </Link>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(notification.id);
          }}
          className="p-1 text-gray-400 hover:text-gray-600 rounded"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </MotionDiv>
  );
}

export function ApprovalNotificationBell() {
  const { approvalNotifications, clearApprovalNotification, subscribeToApprovals, connected } = useWebSocket();
  const [isOpen, setIsOpen] = useState(false);
  const [localNotifications, setLocalNotifications] = useState<ApprovalNotification[]>([]);

  // Subscribe to approvals when connected
  useEffect(() => {
    if (connected) {
      subscribeToApprovals();
    }
  }, [connected, subscribeToApprovals]);

  // Merge websocket notifications with local state
  useEffect(() => {
    setLocalNotifications(prev => {
      const ids = new Set(prev.map(n => n.id));
      const newNotifs = approvalNotifications.filter(n => !ids.has(n.id));
      return [...newNotifs, ...prev].slice(0, 50);
    });
  }, [approvalNotifications]);

  // Simulate some notifications for demo purposes when not connected
  useEffect(() => {
    if (!connected && localNotifications.length === 0) {
      const demoNotifications: ApprovalNotification[] = [
        {
          id: 'demo-1',
          type: 'new_approval',
          title: 'New Approval Request',
          message: 'Master Agreement with CloudTech Solutions requires your approval',
          approvalId: 'a1',
          priority: 'high',
          timestamp: new Date(Date.now() - 5 * 60 * 1000),
        },
        {
          id: 'demo-2',
          type: 'deadline_reminder',
          title: 'Deadline Approaching',
          message: 'GlobalSupply contract renewal decision due in 2 days',
          approvalId: 'a2',
          priority: 'urgent',
          timestamp: new Date(Date.now() - 30 * 60 * 1000),
        },
        {
          id: 'demo-3',
          type: 'step_completed',
          title: 'Step Completed',
          message: 'Legal review completed for Acme Corporation SLA amendment',
          approvalId: 'a3',
          priority: 'medium',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
      ];
      setLocalNotifications(demoNotifications);
    }
  }, [connected, localNotifications.length]);

  const handleDismiss = (id: string) => {
    clearApprovalNotification(id);
    setLocalNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleClearAll = () => {
    setLocalNotifications([]);
  };

  const unreadCount = localNotifications.length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="relative p-2"
          aria-label={`${unreadCount} approval notifications`}
        >
          <Bell className="h-5 w-5 text-gray-600" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <MotionDiv
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </MotionDiv>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0 overflow-hidden" 
        align="end"
        sideOffset={8}
      >
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Approval Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Clear all
              </button>
            )}
          </div>
          {connected && (
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-gray-500">Live updates</span>
            </div>
          )}
        </div>
        
        <div className="max-h-[400px] overflow-y-auto">
          {localNotifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No notifications</p>
              <p className="text-xs text-gray-400 mt-1">
                You'll be notified of approval updates here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              <AnimatePresence>
                {localNotifications.map(notification => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onDismiss={handleDismiss}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="bg-gray-50 px-4 py-2 border-t">
          <Link 
            href="/approvals"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            onClick={() => setIsOpen(false)}
          >
            View all approvals →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default ApprovalNotificationBell;
