'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Users,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Timer,
  Target,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface ApprovalStats {
  totalApprovals: number;
  pendingApprovals: number;
  approvedThisWeek: number;
  rejectedThisWeek: number;
  avgApprovalTime: number; // hours
  avgApprovalTimeChange: number; // percentage change
  approvalRate: number; // percentage
  bottleneckStep?: string;
  topApprovers: Array<{
    name: string;
    avatar?: string;
    count: number;
  }>;
  recentActivity: Array<{
    id: string;
    action: 'approved' | 'rejected' | 'submitted';
    contractName: string;
    by: string;
    timestamp: string;
  }>;
}

// Mock data - replace with real data from API
const mockStats: ApprovalStats = {
  totalApprovals: 156,
  pendingApprovals: 12,
  approvedThisWeek: 23,
  rejectedThisWeek: 3,
  avgApprovalTime: 4.5,
  avgApprovalTimeChange: -15,
  approvalRate: 88.5,
  bottleneckStep: 'Legal Review',
  topApprovers: [
    { name: 'Sarah Johnson', count: 45 },
    { name: 'Mike Chen', count: 38 },
    { name: 'Emily Davis', count: 31 },
  ],
  recentActivity: [
    { id: '1', action: 'approved', contractName: 'Master Agreement - Acme', by: 'Sarah Johnson', timestamp: '2h ago' },
    { id: '2', action: 'submitted', contractName: 'NDA - TechFlow', by: 'Mike Chen', timestamp: '3h ago' },
    { id: '3', action: 'rejected', contractName: 'Vendor Agreement - Global', by: 'Emily Davis', timestamp: '5h ago' },
    { id: '4', action: 'approved', contractName: 'Service Contract - CloudOps', by: 'Sarah Johnson', timestamp: '6h ago' },
  ],
};

interface ApprovalAnalyticsProps {
  className?: string;
  variant?: 'full' | 'compact' | 'mini';
}

export function ApprovalAnalytics({ className, variant = 'full' }: ApprovalAnalyticsProps) {
  const [stats] = useState<ApprovalStats>(mockStats);

  if (variant === 'mini') {
    return (
      <Link href="/approvals" className="block">
        <Card className={`${className} hover:shadow-lg transition-shadow cursor-pointer`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Pending Approvals</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.pendingApprovals}</p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  {stats.approvalRate}% rate
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  if (variant === 'compact') {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Approval Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-amber-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="text-xs text-amber-600 font-medium">Pending</span>
              </div>
              <p className="text-2xl font-bold text-amber-700">{stats.pendingApprovals}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-xs text-green-600 font-medium">This Week</span>
              </div>
              <p className="text-2xl font-bold text-green-700">{stats.approvedThisWeek}</p>
            </div>
          </div>

          {/* Avg Time */}
          <div className="p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-600">Avg. Approval Time</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">{stats.avgApprovalTime}h</span>
                <span className={`text-xs flex items-center ${stats.avgApprovalTimeChange < 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {stats.avgApprovalTimeChange < 0 ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                  {Math.abs(stats.avgApprovalTimeChange)}%
                </span>
              </div>
            </div>
          </div>

          {/* CTA */}
          <Link href="/approvals">
            <button className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center gap-2">
              View All Approvals
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Full variant
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-500 rounded-lg">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm text-amber-700 font-medium">Pending</span>
              </div>
              <p className="text-3xl font-bold text-amber-900">{stats.pendingApprovals}</p>
              <p className="text-xs text-amber-600 mt-1">Awaiting review</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-500 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm text-green-700 font-medium">Approved</span>
              </div>
              <p className="text-3xl font-bold text-green-900">{stats.approvedThisWeek}</p>
              <p className="text-xs text-green-600 mt-1">This week</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-red-50 to-red-100/50 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-red-500 rounded-lg">
                  <XCircle className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm text-red-700 font-medium">Rejected</span>
              </div>
              <p className="text-3xl font-bold text-red-900">{stats.rejectedThisWeek}</p>
              <p className="text-xs text-red-600 mt-1">This week</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-500 rounded-lg">
                  <Target className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm text-blue-700 font-medium">Approval Rate</span>
              </div>
              <p className="text-3xl font-bold text-blue-900">{stats.approvalRate}%</p>
              <p className="text-xs text-blue-600 mt-1">Overall success</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Performance & Activity */}
      <div className="grid grid-cols-2 gap-6">
        {/* Performance Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Performance Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Avg Time */}
            <div className="p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">Average Approval Time</span>
                <div className={`flex items-center gap-1 text-sm font-medium ${stats.avgApprovalTimeChange < 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {stats.avgApprovalTimeChange < 0 ? '↓' : '↑'} {Math.abs(stats.avgApprovalTimeChange)}%
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-900">{stats.avgApprovalTime}</span>
                <span className="text-slate-500">hours</span>
              </div>
            </div>

            {/* Bottleneck */}
            {stats.bottleneckStep && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-700">Bottleneck Detected</span>
                </div>
                <p className="text-amber-900">
                  <span className="font-semibold">{stats.bottleneckStep}</span> is causing delays
                </p>
              </div>
            )}

            {/* Top Approvers */}
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Top Approvers
              </h4>
              <div className="space-y-2">
                {stats.topApprovers.map((approver, idx) => (
                  <div key={approver.name} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-medium">
                        {idx + 1}
                      </span>
                      <span className="text-sm text-slate-700">{approver.name}</span>
                    </div>
                    <Badge variant="secondary">{approver.count}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-600" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentActivity.map((activity) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className={`p-1.5 rounded-full ${
                    activity.action === 'approved' ? 'bg-green-100' :
                    activity.action === 'rejected' ? 'bg-red-100' :
                    'bg-blue-100'
                  }`}>
                    {activity.action === 'approved' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : activity.action === 'rejected' ? (
                      <XCircle className="h-4 w-4 text-red-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {activity.contractName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {activity.action === 'approved' ? 'Approved' :
                       activity.action === 'rejected' ? 'Rejected' :
                       'Submitted'} by {activity.by}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {activity.timestamp}
                  </span>
                </motion.div>
              ))}
            </div>

            <Link href="/approvals">
              <button className="w-full mt-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
                View All Activity
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ApprovalAnalytics;
