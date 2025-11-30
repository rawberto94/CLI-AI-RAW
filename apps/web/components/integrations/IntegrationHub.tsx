'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Link2,
  Check,
  X,
  RefreshCw,
  Settings,
  AlertTriangle,
  Clock,
  Activity,
  Zap,
  Database,
  Cloud,
  FileText,
  DollarSign,
  Users,
  Shield,
  ArrowRight,
  ArrowLeftRight,
  Plus,
  Search,
  Filter,
  MoreVertical,
  ExternalLink,
  Play,
  Pause,
  History,
  Code,
  Key,
  Lock,
  Unlock,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  Loader2,
} from 'lucide-react';
import { useDataMode } from '@/contexts/DataModeContext';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { OAuthConnectionManager } from './OAuthConnectionManager';

interface Integration {
  id: string;
  name: string;
  type: 'erp' | 'procurement' | 'finance' | 'document' | 'analytics' | 'signature' | 'storage' | 'crm';
  provider: string;
  status: 'connected' | 'disconnected' | 'error' | 'syncing' | 'pending';
  lastSync: string;
  dataFlows: {
    direction: 'inbound' | 'outbound' | 'bidirectional';
    entities: string[];
    frequency: string;
    recordsProcessed: number;
  };
  health: {
    uptime: number;
    errors24h: number;
    avgLatency: number;
  };
  config: {
    apiVersion: string;
    environment: string;
    syncEnabled: boolean;
  };
}

interface SyncLog {
  id: string;
  timestamp: string;
  integration: string;
  direction: 'inbound' | 'outbound';
  entity: string;
  records: number;
  status: 'success' | 'partial' | 'failed';
  duration: number;
  errors?: string[];
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: 'active' | 'inactive';
  lastTriggered: string;
  successRate: number;
}

const mockIntegrations: Integration[] = [
  {
    id: 'int1',
    name: 'SAP S/4HANA',
    type: 'erp',
    provider: 'SAP',
    status: 'connected',
    lastSync: '5 minutes ago',
    dataFlows: {
      direction: 'bidirectional',
      entities: ['Purchase Orders', 'Vendors', 'Invoices', 'Contracts'],
      frequency: 'Real-time',
      recordsProcessed: 15420,
    },
    health: {
      uptime: 99.8,
      errors24h: 2,
      avgLatency: 245,
    },
    config: {
      apiVersion: 'v2',
      environment: 'Production',
      syncEnabled: true,
    },
  },
  {
    id: 'int2',
    name: 'Coupa Procurement',
    type: 'procurement',
    provider: 'Coupa',
    status: 'connected',
    lastSync: '10 minutes ago',
    dataFlows: {
      direction: 'bidirectional',
      entities: ['Requisitions', 'Suppliers', 'Contracts', 'Catalogs'],
      frequency: 'Every 15 min',
      recordsProcessed: 8930,
    },
    health: {
      uptime: 99.5,
      errors24h: 0,
      avgLatency: 320,
    },
    config: {
      apiVersion: 'v3',
      environment: 'Production',
      syncEnabled: true,
    },
  },
  {
    id: 'int3',
    name: 'DocuSign',
    type: 'signature',
    provider: 'DocuSign',
    status: 'connected',
    lastSync: '2 minutes ago',
    dataFlows: {
      direction: 'bidirectional',
      entities: ['Envelopes', 'Documents', 'Signatures'],
      frequency: 'Real-time (webhook)',
      recordsProcessed: 2340,
    },
    health: {
      uptime: 100,
      errors24h: 0,
      avgLatency: 180,
    },
    config: {
      apiVersion: 'v2.1',
      environment: 'Production',
      syncEnabled: true,
    },
  },
  {
    id: 'int4',
    name: 'Salesforce CRM',
    type: 'crm',
    provider: 'Salesforce',
    status: 'syncing',
    lastSync: 'Syncing now...',
    dataFlows: {
      direction: 'outbound',
      entities: ['Accounts', 'Opportunities', 'Contracts'],
      frequency: 'Every hour',
      recordsProcessed: 5670,
    },
    health: {
      uptime: 99.2,
      errors24h: 5,
      avgLatency: 420,
    },
    config: {
      apiVersion: 'v58.0',
      environment: 'Production',
      syncEnabled: true,
    },
  },
  {
    id: 'int5',
    name: 'SharePoint',
    type: 'storage',
    provider: 'Microsoft',
    status: 'connected',
    lastSync: '30 minutes ago',
    dataFlows: {
      direction: 'bidirectional',
      entities: ['Documents', 'Folders', 'Permissions'],
      frequency: 'On-demand',
      recordsProcessed: 12890,
    },
    health: {
      uptime: 99.9,
      errors24h: 0,
      avgLatency: 150,
    },
    config: {
      apiVersion: 'Graph v1.0',
      environment: 'Production',
      syncEnabled: true,
    },
  },
  {
    id: 'int6',
    name: 'Oracle Financials',
    type: 'finance',
    provider: 'Oracle',
    status: 'error',
    lastSync: '2 hours ago',
    dataFlows: {
      direction: 'inbound',
      entities: ['GL Entries', 'AP Transactions', 'Cost Centers'],
      frequency: 'Daily',
      recordsProcessed: 3450,
    },
    health: {
      uptime: 95.5,
      errors24h: 12,
      avgLatency: 890,
    },
    config: {
      apiVersion: 'v1',
      environment: 'Production',
      syncEnabled: false,
    },
  },
  {
    id: 'int7',
    name: 'Tableau Analytics',
    type: 'analytics',
    provider: 'Tableau',
    status: 'pending',
    lastSync: 'Never',
    dataFlows: {
      direction: 'outbound',
      entities: ['Contract Data', 'Spend Analytics', 'Compliance Metrics'],
      frequency: 'Not configured',
      recordsProcessed: 0,
    },
    health: {
      uptime: 0,
      errors24h: 0,
      avgLatency: 0,
    },
    config: {
      apiVersion: 'v3.15',
      environment: 'Sandbox',
      syncEnabled: false,
    },
  },
];

const mockSyncLogs: SyncLog[] = [
  { id: 'log1', timestamp: '2024-03-14 10:30:00', integration: 'SAP S/4HANA', direction: 'inbound', entity: 'Purchase Orders', records: 45, status: 'success', duration: 1.2 },
  { id: 'log2', timestamp: '2024-03-14 10:25:00', integration: 'Coupa', direction: 'outbound', entity: 'Contracts', records: 12, status: 'success', duration: 2.5 },
  { id: 'log3', timestamp: '2024-03-14 10:20:00', integration: 'DocuSign', direction: 'inbound', entity: 'Envelopes', records: 3, status: 'success', duration: 0.8 },
  { id: 'log4', timestamp: '2024-03-14 10:15:00', integration: 'Salesforce', direction: 'outbound', entity: 'Accounts', records: 156, status: 'partial', duration: 8.5, errors: ['Rate limit exceeded for 12 records'] },
  { id: 'log5', timestamp: '2024-03-14 10:00:00', integration: 'Oracle Financials', direction: 'inbound', entity: 'GL Entries', records: 0, status: 'failed', duration: 0, errors: ['Authentication failed: Invalid token'] },
];

const mockWebhooks: Webhook[] = [
  { id: 'wh1', name: 'Contract Signed', url: 'https://api.company.com/webhooks/contract-signed', events: ['contract.signed'], status: 'active', lastTriggered: '1 hour ago', successRate: 100 },
  { id: 'wh2', name: 'Approval Complete', url: 'https://api.company.com/webhooks/approval', events: ['approval.approved', 'approval.rejected'], status: 'active', lastTriggered: '3 hours ago', successRate: 98.5 },
  { id: 'wh3', name: 'Renewal Reminder', url: 'https://automation.company.com/triggers/renewal', events: ['contract.renewal.due'], status: 'active', lastTriggered: '1 day ago', successRate: 100 },
  { id: 'wh4', name: 'Risk Alert', url: 'https://slack.com/api/webhook/xxx', events: ['risk.critical', 'risk.high'], status: 'inactive', lastTriggered: '1 week ago', successRate: 95 },
];

const getStatusIcon = (status: Integration['status']) => {
  switch (status) {
    case 'connected':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'disconnected':
      return <XCircle className="h-5 w-5 text-gray-400" />;
    case 'error':
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    case 'syncing':
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    case 'pending':
      return <Clock className="h-5 w-5 text-yellow-500" />;
    default:
      return <Info className="h-5 w-5 text-gray-400" />;
  }
};

const getTypeIcon = (type: Integration['type']) => {
  switch (type) {
    case 'erp':
      return <Database className="h-5 w-5" />;
    case 'procurement':
      return <FileText className="h-5 w-5" />;
    case 'finance':
      return <DollarSign className="h-5 w-5" />;
    case 'document':
    case 'storage':
      return <Cloud className="h-5 w-5" />;
    case 'analytics':
      return <Activity className="h-5 w-5" />;
    case 'signature':
      return <Zap className="h-5 w-5" />;
    case 'crm':
      return <Users className="h-5 w-5" />;
    default:
      return <Link2 className="h-5 w-5" />;
  }
};

export function IntegrationHub() {
  const { useRealData } = useDataMode();
  const { toast } = useToast();
  
  const [integrations, setIntegrations] = useState<Integration[]>(mockIntegrations);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>(mockSyncLogs);
  const [webhooks, setWebhooks] = useState<Webhook[]>(mockWebhooks);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'integrations' | 'logs' | 'webhooks' | 'api' | 'oauth'>('integrations');
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch integrations from API
  const fetchIntegrations = useCallback(async () => {
    if (!useRealData) {
      setIntegrations(mockIntegrations);
      setSyncLogs(mockSyncLogs);
      setWebhooks(mockWebhooks);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/integrations');
      if (!response.ok) throw new Error('Failed to fetch integrations');
      const data = await response.json();
      
      if (data.success && data.data?.integrations) {
        // Map API data to component format
        const mapped = data.data.integrations.map((int: any) => ({
          id: int.id,
          name: int.name,
          type: (int.type || 'other').toLowerCase(),
          provider: int.provider || 'Custom',
          status: (int.status || 'disconnected').toLowerCase(),
          lastSync: int.lastSyncAt ? formatTimeAgo(new Date(int.lastSyncAt)) : 'Never',
          dataFlows: {
            direction: 'bidirectional' as const,
            entities: int.capabilities || [],
            frequency: 'Real-time',
            recordsProcessed: int.recordsProcessed || 0,
          },
          health: {
            uptime: int.uptime || 0,
            errors24h: int.errors24h || 0,
            avgLatency: 150,
          },
          config: {
            apiVersion: int.version || 'v1',
            environment: 'production',
            syncEnabled: int.isActive !== false,
          },
        }));
        
        setIntegrations(mapped.length > 0 ? mapped : mockIntegrations);
      } else {
        setIntegrations(mockIntegrations);
      }
    } catch (err) {
      console.error('Failed to fetch integrations:', err);
      setError('Failed to load integrations');
      setIntegrations(mockIntegrations);
    } finally {
      setLoading(false);
    }
  }, [useRealData]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  // Helper function
  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    return `${Math.floor(diffMins / 1440)} days ago`;
  };

  const handleSync = async (integrationId: string) => {
    try {
      const response = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync', integrationId }),
      });

      if (response.ok) {
        toast({
          title: 'Sync Started',
          description: 'Integration sync has been initiated.',
        });
        fetchIntegrations();
      }
    } catch (err) {
      toast({
        title: 'Sync Failed',
        description: 'Failed to start sync.',
        variant: 'destructive',
      });
    }
  };

  const handleConnect = async (integrationId: string) => {
    try {
      const response = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect', integrationId }),
      });

      if (response.ok) {
        toast({
          title: 'Connected',
          description: 'Integration connected successfully.',
        });
        fetchIntegrations();
      }
    } catch (err) {
      toast({
        title: 'Connection Failed',
        description: 'Failed to connect integration.',
        variant: 'destructive',
      });
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    try {
      const response = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect', integrationId }),
      });

      if (response.ok) {
        toast({
          title: 'Disconnected',
          description: 'Integration disconnected successfully.',
        });
        fetchIntegrations();
      }
    } catch (err) {
      toast({
        title: 'Disconnect Failed',
        description: 'Failed to disconnect integration.',
        variant: 'destructive',
      });
    }
  };

  // Handle export logs
  const handleExportLogs = useCallback(() => {
    try {
      const csvContent = [
        ['Timestamp', 'Integration', 'Entity', 'Direction', 'Records', 'Status', 'Duration'].join(','),
        ...syncLogs.map(log => [
          log.timestamp,
          log.integration,
          log.entity,
          log.direction,
          log.records,
          log.status,
          log.duration,
        ].join(','))
      ].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `sync-logs-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      toast({
        title: 'Export Complete',
        description: 'Sync logs exported successfully.',
      });
    } catch (err) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export logs.',
        variant: 'destructive',
      });
    }
  }, [syncLogs, toast]);

  // Handle configure integration
  const handleConfigure = useCallback((integrationId: string, integrationName: string) => {
    toast({
      title: 'Configuration',
      description: `Opening settings for ${integrationName}...`,
    });
    // In a real app, this would open a configuration modal
  }, [toast]);

  // Handle enable sync
  const handleEnableSync = useCallback(async (integrationId: string) => {
    try {
      const response = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enable-sync', integrationId }),
      });

      if (response.ok) {
        toast({
          title: 'Sync Enabled',
          description: 'Automatic sync has been enabled.',
        });
        fetchIntegrations();
      }
    } catch (err) {
      toast({
        title: 'Failed',
        description: 'Failed to enable sync.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchIntegrations]);

  const filteredIntegrations = integrations.filter(int =>
    int.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    int.provider.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const connectedCount = integrations.filter(i => i.status === 'connected').length;
  const errorCount = integrations.filter(i => i.status === 'error').length;
  const totalRecords = integrations.reduce((sum, i) => sum + i.dataFlows.recordsProcessed, 0);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-gray-900">S2P Integration Hub</h1>
              {useRealData && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Live Data
                </Badge>
              )}
            </div>
            <p className="text-gray-500 mt-1">Connect and manage your Source-to-Pay ecosystem integrations</p>
            {error && (
              <p className="text-sm text-amber-600 flex items-center gap-1 mt-1">
                <AlertCircle className="h-4 w-4" />
                {error}
              </p>
            )}
          </div>
          <button
            onClick={fetchIntegrations}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`h-5 w-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <Link2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{connectedCount}/{mockIntegrations.length}</p>
                <p className="text-sm text-gray-500">Connected</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <RefreshCw className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalRecords.toLocaleString()}</p>
                <p className="text-sm text-gray-500">Records Synced (24h)</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
          >
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${errorCount > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                <AlertTriangle className={`h-6 w-6 ${errorCount > 0 ? 'text-red-600' : 'text-green-600'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{errorCount}</p>
                <p className="text-sm text-gray-500">Integration Errors</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Zap className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">99.4%</p>
                <p className="text-sm text-gray-500">Avg Uptime</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex items-center justify-between px-6">
              <nav className="flex space-x-8">
                {[
                  { id: 'integrations', label: 'Integrations', icon: Link2 },
                  { id: 'oauth', label: 'OAuth Connections', icon: Shield },
                  { id: 'logs', label: 'Sync Logs', icon: History },
                  { id: 'webhooks', label: 'Webhooks', icon: Zap },
                  { id: 'api', label: 'API Keys', icon: Key },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`flex items-center gap-2 py-4 border-b-2 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </nav>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <Plus className="h-4 w-4" />
                Add Integration
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* OAuth Connections Tab */}
            {activeTab === 'oauth' && (
              <OAuthConnectionManager 
                onConnectionChange={(providerId, connected) => {
                  toast({
                    title: connected ? 'Connected' : 'Disconnected',
                    description: `${providerId} integration has been ${connected ? 'connected' : 'disconnected'}`,
                  });
                  // Refresh integrations when OAuth status changes
                  fetchIntegrations();
                }}
              />
            )}

            {activeTab === 'integrations' && (
              <div className="space-y-6">
                {/* Search & Filter */}
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search integrations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button onClick={() => toast({ title: 'Filters', description: 'Opening filter options...' })} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <Filter className="h-4 w-4" />
                    Filter
                  </button>
                </div>

                {/* Integrations Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {filteredIntegrations.map((integration) => (
                    <motion.div
                      key={integration.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`bg-white rounded-xl border p-5 cursor-pointer transition-all ${
                        selectedIntegration === integration.id
                          ? 'border-blue-300 ring-2 ring-blue-100'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedIntegration(selectedIntegration === integration.id ? null : integration.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-lg ${
                            integration.status === 'connected' ? 'bg-green-50' :
                            integration.status === 'error' ? 'bg-red-50' :
                            integration.status === 'syncing' ? 'bg-blue-50' :
                            'bg-gray-50'
                          }`}>
                            {getTypeIcon(integration.type)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900">{integration.name}</h3>
                              {getStatusIcon(integration.status)}
                            </div>
                            <p className="text-sm text-gray-500">{integration.provider}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {integration.lastSync}
                              </span>
                              <span className="flex items-center gap-1">
                                <ArrowLeftRight className="h-3 w-3" />
                                {integration.dataFlows.direction}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>

                      <AnimatePresence>
                        {selectedIntegration === integration.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 pt-4 border-t border-gray-100 space-y-4"
                          >
                            {/* Data Flows */}
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-2">Data Flows</h4>
                              <div className="flex flex-wrap gap-2">
                                {integration.dataFlows.entities.map((entity) => (
                                  <span key={entity} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                    {entity}
                                  </span>
                                ))}
                              </div>
                              <p className="text-xs text-gray-400 mt-2">
                                {integration.dataFlows.recordsProcessed.toLocaleString()} records • {integration.dataFlows.frequency}
                              </p>
                            </div>

                            {/* Health Metrics */}
                            <div className="grid grid-cols-3 gap-4">
                              <div className="text-center p-2 bg-gray-50 rounded-lg">
                                <p className="text-lg font-semibold text-gray-900">{integration.health.uptime}%</p>
                                <p className="text-xs text-gray-500">Uptime</p>
                              </div>
                              <div className="text-center p-2 bg-gray-50 rounded-lg">
                                <p className="text-lg font-semibold text-gray-900">{integration.health.errors24h}</p>
                                <p className="text-xs text-gray-500">Errors (24h)</p>
                              </div>
                              <div className="text-center p-2 bg-gray-50 rounded-lg">
                                <p className="text-lg font-semibold text-gray-900">{integration.health.avgLatency}ms</p>
                                <p className="text-xs text-gray-500">Avg Latency</p>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                              {integration.status === 'error' ? (
                                <button onClick={() => handleConnect(integration.id)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm">
                                  <RefreshCw className="h-4 w-4" />
                                  Reconnect
                                </button>
                              ) : integration.config.syncEnabled ? (
                                <button onClick={() => handleSync(integration.id)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-sm">
                                  <RefreshCw className="h-4 w-4" />
                                  Sync Now
                                </button>
                              ) : (
                                <button onClick={() => handleEnableSync(integration.id)} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 text-sm">
                                  <Play className="h-4 w-4" />
                                  Enable Sync
                                </button>
                              )}
                              <button onClick={() => handleConfigure(integration.id, integration.name)} className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
                                <Settings className="h-4 w-4" />
                                Configure
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Recent Sync Activity</h3>
                  <button onClick={handleExportLogs} className="text-sm text-blue-600 hover:text-blue-700">Export Logs</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Integration</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Direction</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Records</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {mockSyncLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-600">{log.timestamp}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{log.integration}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{log.entity}</td>
                          <td className="px-4 py-3">
                            <span className={`flex items-center gap-1 text-xs ${
                              log.direction === 'inbound' ? 'text-blue-600' : 'text-green-600'
                            }`}>
                              {log.direction === 'inbound' ? <ArrowRight className="h-3 w-3" /> : <ArrowRight className="h-3 w-3 rotate-180" />}
                              {log.direction}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{log.records}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                              log.status === 'success' ? 'bg-green-100 text-green-700' :
                              log.status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {log.status === 'success' ? <Check className="h-3 w-3" /> :
                               log.status === 'partial' ? <AlertTriangle className="h-3 w-3" /> :
                               <X className="h-3 w-3" />}
                              {log.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{log.duration}s</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'webhooks' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Outbound Webhooks</h3>
                  <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                    <Plus className="h-4 w-4" />
                    Add Webhook
                  </button>
                </div>
                <div className="space-y-4">
                  {mockWebhooks.map((webhook) => (
                    <div key={webhook.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900">{webhook.name}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${
                              webhook.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                            }`}>
                              {webhook.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 font-mono mt-1">{webhook.url}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                            <span>Events: {webhook.events.join(', ')}</span>
                            <span>Last triggered: {webhook.lastTriggered}</span>
                            <span>Success rate: {webhook.successRate}%</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200">
                            <Settings className="h-4 w-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200">
                            {webhook.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'api' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">API Keys</h3>
                    <p className="text-sm text-gray-500">Manage API keys for external integrations</p>
                  </div>
                  <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                    <Plus className="h-4 w-4" />
                    Generate New Key
                  </button>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Keep your API keys secure</p>
                    <p className="text-sm text-yellow-700">Never share your API keys in public repositories or expose them in client-side code.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    { name: 'Production API Key', created: '2024-01-15', lastUsed: '5 minutes ago', status: 'active' },
                    { name: 'Staging API Key', created: '2024-02-20', lastUsed: '2 days ago', status: 'active' },
                    { name: 'Development Key', created: '2024-03-01', lastUsed: '1 week ago', status: 'revoked' },
                  ].map((key, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${key.status === 'active' ? 'bg-green-100' : 'bg-gray-200'}`}>
                            <Key className={`h-5 w-5 ${key.status === 'active' ? 'text-green-600' : 'text-gray-400'}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-gray-900">{key.name}</h4>
                              <span className={`px-2 py-0.5 rounded-full text-xs ${
                                key.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {key.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                              <span>Created: {key.created}</span>
                              <span>Last used: {key.lastUsed}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {key.status === 'active' && (
                            <>
                              <button className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-100">
                                Reveal
                              </button>
                              <button className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                                Revoke
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* API Documentation Link */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Code className="h-6 w-6 text-blue-600" />
                    <div>
                      <p className="font-medium text-blue-900">API Documentation</p>
                      <p className="text-sm text-blue-700">Learn how to integrate with our API</p>
                    </div>
                  </div>
                  <a href="/docs/api" className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
                    View Docs
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
