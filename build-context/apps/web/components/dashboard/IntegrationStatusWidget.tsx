'use client';

/**
 * Integration Status Widget
 * 
 * Dashboard widget showing connected integrations status.
 * Displays sync status, errors, and quick actions.
 */

import React, { useState, memo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  Plug,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Settings,
  ArrowUpRight,
  Clock,
  Zap,
  Cloud,
  Database,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// ============ Types ============

export type IntegrationStatus = 'connected' | 'syncing' | 'error' | 'disconnected' | 'warning';

export interface Integration {
  id: string;
  name: string;
  type: 'storage' | 'crm' | 'erp' | 'communication' | 'identity' | 'other';
  status: IntegrationStatus;
  icon?: string;
  lastSync?: Date;
  nextSync?: Date;
  syncedItems?: number;
  errorMessage?: string;
  warningMessage?: string;
}

interface IntegrationStatusWidgetProps {
  integrations: Integration[];
  onRefresh?: (integrationId: string) => void;
  onSettings?: (integrationId: string) => void;
  onViewAll?: () => void;
  className?: string;
}

// ============ Helpers ============

const getStatusIcon = (status: IntegrationStatus) => {
  switch (status) {
    case 'connected': return CheckCircle;
    case 'syncing': return RefreshCw;
    case 'error': return XCircle;
    case 'warning': return AlertTriangle;
    case 'disconnected': return Plug;
  }
};

const getStatusColor = (status: IntegrationStatus) => {
  switch (status) {
    case 'connected': return 'text-green-500';
    case 'syncing': return 'text-violet-500';
    case 'error': return 'text-red-500';
    case 'warning': return 'text-yellow-500';
    case 'disconnected': return 'text-muted-foreground';
  }
};

const getStatusBg = (status: IntegrationStatus) => {
  switch (status) {
    case 'connected': return 'bg-green-500/10';
    case 'syncing': return 'bg-violet-500/10';
    case 'error': return 'bg-red-500/10';
    case 'warning': return 'bg-yellow-500/10';
    case 'disconnected': return 'bg-muted';
  }
};

const getTypeIcon = (type: Integration['type']) => {
  switch (type) {
    case 'storage': return Cloud;
    case 'crm': return Database;
    case 'erp': return Database;
    case 'communication': return Zap;
    case 'identity': return Plug;
    default: return Plug;
  }
};

// ============ Sub-components ============

const StatusSummary = memo(function StatusSummary({
  integrations,
}: {
  integrations: Integration[];
}) {
  const connected = integrations.filter(i => i.status === 'connected').length;
  const syncing = integrations.filter(i => i.status === 'syncing').length;
  const issues = integrations.filter(i => i.status === 'error' || i.status === 'warning').length;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
        <span className="text-xs font-medium">{connected + syncing}</span>
        <span className="text-xs text-muted-foreground">active</span>
      </div>
      {issues > 0 && (
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
          <span className="text-xs font-medium">{issues}</span>
          <span className="text-xs text-muted-foreground">issues</span>
        </div>
      )}
    </div>
  );
});

const IntegrationItem = memo(function IntegrationItem({
  integration,
  onRefresh,
  onSettings,
}: {
  integration: Integration;
  onRefresh?: () => void;
  onSettings?: () => void;
}) {
  const StatusIcon = getStatusIcon(integration.status);
  const TypeIcon = getTypeIcon(integration.type);
  const statusColor = getStatusColor(integration.status);
  const statusBg = getStatusBg(integration.status);

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
      {/* Icon */}
      <div className={`p-2 rounded-lg ${statusBg}`}>
        <TypeIcon className={`h-4 w-4 ${statusColor}`} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{integration.name}</p>
          <StatusIcon className={`h-3.5 w-3.5 ${statusColor} ${
            integration.status === 'syncing' ? 'animate-spin' : ''
          }`} />
        </div>
        
        {integration.status === 'error' && integration.errorMessage ? (
          <p className="text-[10px] text-red-500 truncate">
            {integration.errorMessage}
          </p>
        ) : integration.status === 'warning' && integration.warningMessage ? (
          <p className="text-[10px] text-yellow-500 truncate">
            {integration.warningMessage}
          </p>
        ) : integration.lastSync ? (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            Synced {formatDistanceToNow(integration.lastSync, { addSuffix: true })}
            {integration.syncedItems !== undefined && (
              <span className="ml-1">• {integration.syncedItems} items</span>
            )}
          </p>
        ) : (
          <p className="text-[10px] text-muted-foreground">Not configured</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {onRefresh && integration.status !== 'disconnected' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onRefresh();
                }}
                disabled={integration.status === 'syncing'}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${
                  integration.status === 'syncing' ? 'animate-spin' : ''
                }`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sync now</TooltipContent>
          </Tooltip>
        )}
        
        {onSettings && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onSettings();
                }}
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
});

// ============ Main Component ============

export function IntegrationStatusWidget({
  integrations,
  onRefresh,
  onSettings,
  onViewAll,
  className = '',
}: IntegrationStatusWidgetProps) {
  // Sort: errors first, then syncing, then connected, then disconnected
  const sortedIntegrations = [...integrations].sort((a, b) => {
    const order: Record<IntegrationStatus, number> = {
      error: 0,
      warning: 1,
      syncing: 2,
      connected: 3,
      disconnected: 4,
    };
    return order[a.status] - order[b.status];
  });

  return (
    <TooltipProvider>
      <Card className={`overflow-hidden ${className}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Plug className="h-4 w-4 text-violet-500" />
              Integrations
            </CardTitle>
            
            {onViewAll && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2 text-xs"
                onClick={onViewAll}
              >
                Manage
                <ArrowUpRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
          
          <StatusSummary integrations={integrations} />
        </CardHeader>

        <CardContent className="pt-2">
          <div className="space-y-1">
            {sortedIntegrations.length > 0 ? (
              sortedIntegrations.slice(0, 5).map((integration) => (
                <motion.div
                  key={integration.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <IntegrationItem
                    integration={integration}
                    onRefresh={onRefresh ? () => onRefresh(integration.id) : undefined}
                    onSettings={onSettings ? () => onSettings(integration.id) : undefined}
                  />
                </motion.div>
              ))
            ) : (
              <div className="text-center py-8">
                <Plug className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  No integrations configured
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2 h-7 text-xs"
                  onClick={onViewAll}
                >
                  Add integration
                </Button>
              </div>
            )}
          </div>

          {sortedIntegrations.length > 5 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs mt-2"
              onClick={onViewAll}
            >
              View all {sortedIntegrations.length} integrations
            </Button>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

// ============ Demo Data Generator ============

export function generateDemoIntegrations(): Integration[] {
  return [
    {
      id: '1',
      name: 'Google Drive',
      type: 'storage',
      status: 'connected',
      lastSync: new Date(Date.now() - 300000),
      syncedItems: 1245,
    },
    {
      id: '2',
      name: 'Salesforce',
      type: 'crm',
      status: 'syncing',
      lastSync: new Date(Date.now() - 3600000),
      syncedItems: 89,
    },
    {
      id: '3',
      name: 'Microsoft 365',
      type: 'storage',
      status: 'connected',
      lastSync: new Date(Date.now() - 600000),
      syncedItems: 567,
    },
    {
      id: '4',
      name: 'DocuSign',
      type: 'other',
      status: 'warning',
      lastSync: new Date(Date.now() - 7200000),
      warningMessage: 'API rate limit approaching',
      syncedItems: 234,
    },
    {
      id: '5',
      name: 'SAP',
      type: 'erp',
      status: 'error',
      lastSync: new Date(Date.now() - 86400000),
      errorMessage: 'Authentication failed',
    },
    {
      id: '6',
      name: 'Slack',
      type: 'communication',
      status: 'connected',
      lastSync: new Date(Date.now() - 1800000),
    },
  ];
}

export default memo(IntegrationStatusWidget);
