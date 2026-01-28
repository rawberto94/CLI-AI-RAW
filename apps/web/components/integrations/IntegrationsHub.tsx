/**
 * Integrations Hub
 * Connect with external services and applications
 */

'use client';

import { memo, useState } from 'react';
import {
  Plug,
  Search,
  Settings,
  Check,
  X,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Clock,
  Loader2,
  Key,
  Trash2,
  FileText,
  Cloud,
  Database,
  MessageSquare,
  Calendar,
  Building,
  Mail,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

type IntegrationCategory = 'storage' | 'crm' | 'communication' | 'productivity' | 'security' | 'database';
type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'pending';

interface Integration {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  icon: string; // URL or component name
  status: IntegrationStatus;
  features: string[];
  lastSync?: Date;
  syncEnabled?: boolean;
  config?: Record<string, any>;
  popular?: boolean;
  enterprise?: boolean;
}

// Integration definitions
const availableIntegrations: Integration[] = [
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Import contracts from Google Drive and sync automatically',
    category: 'storage',
    icon: 'google-drive',
    status: 'connected',
    features: ['Auto-sync', 'Folder mapping', 'Version tracking'],
    lastSync: new Date(Date.now() - 2 * 60 * 60 * 1000),
    syncEnabled: true,
    popular: true,
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    description: 'Connect your Dropbox for seamless contract storage',
    category: 'storage',
    icon: 'dropbox',
    status: 'disconnected',
    features: ['Auto-sync', 'Team folders', 'Sharing'],
    popular: true,
  },
  {
    id: 'onedrive',
    name: 'Microsoft OneDrive',
    description: 'Integrate with OneDrive for Business',
    category: 'storage',
    icon: 'onedrive',
    status: 'disconnected',
    features: ['Auto-sync', 'SharePoint integration', 'Office 365'],
    enterprise: true,
  },
  {
    id: 'aws-s3',
    name: 'Amazon S3',
    description: 'Store and retrieve contracts from S3 buckets',
    category: 'storage',
    icon: 'aws',
    status: 'connected',
    features: ['Bucket management', 'Encryption', 'Lifecycle policies'],
    lastSync: new Date(Date.now() - 30 * 60 * 1000),
    syncEnabled: true,
    enterprise: true,
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'Sync contracts with Salesforce opportunities and accounts',
    category: 'crm',
    icon: 'salesforce',
    status: 'error',
    features: ['Opportunity linking', 'Account sync', 'Custom fields'],
    lastSync: new Date(Date.now() - 24 * 60 * 60 * 1000),
    popular: true,
    enterprise: true,
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Connect contracts to HubSpot deals and companies',
    category: 'crm',
    icon: 'hubspot',
    status: 'disconnected',
    features: ['Deal association', 'Company records', 'Workflow triggers'],
    popular: true,
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Receive notifications and updates in Slack channels',
    category: 'communication',
    icon: 'slack',
    status: 'connected',
    features: ['Notifications', 'Channel alerts', 'Approval requests'],
    lastSync: new Date(Date.now() - 5 * 60 * 1000),
    syncEnabled: true,
    popular: true,
  },
  {
    id: 'microsoft-teams',
    name: 'Microsoft Teams',
    description: 'Integrate with Teams for notifications and collaboration',
    category: 'communication',
    icon: 'teams',
    status: 'disconnected',
    features: ['Notifications', 'Tab integration', 'Bot commands'],
    enterprise: true,
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Automatically capture contract emails and attachments',
    category: 'communication',
    icon: 'gmail',
    status: 'disconnected',
    features: ['Email capture', 'Attachment extraction', 'Thread linking'],
    popular: true,
  },
  {
    id: 'docusign',
    name: 'DocuSign',
    description: 'Electronic signatures and contract execution',
    category: 'productivity',
    icon: 'docusign',
    status: 'connected',
    features: ['E-signatures', 'Envelope tracking', 'Template sync'],
    lastSync: new Date(Date.now() - 1 * 60 * 60 * 1000),
    syncEnabled: true,
    popular: true,
    enterprise: true,
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Sync contract deadlines and renewals to calendar',
    category: 'productivity',
    icon: 'google-calendar',
    status: 'pending',
    features: ['Deadline reminders', 'Renewal alerts', 'Meeting scheduling'],
  },
  {
    id: 'jira',
    name: 'Jira',
    description: 'Link contracts to Jira projects and issues',
    category: 'productivity',
    icon: 'jira',
    status: 'disconnected',
    features: ['Issue linking', 'Project association', 'Workflow triggers'],
    enterprise: true,
  },
  {
    id: 'okta',
    name: 'Okta',
    description: 'Single sign-on and identity management',
    category: 'security',
    icon: 'okta',
    status: 'disconnected',
    features: ['SSO', 'MFA', 'User provisioning'],
    enterprise: true,
  },
  {
    id: 'azure-ad',
    name: 'Azure AD',
    description: 'Microsoft Azure Active Directory integration',
    category: 'security',
    icon: 'azure',
    status: 'disconnected',
    features: ['SSO', 'Group sync', 'Conditional access'],
    enterprise: true,
  },
  {
    id: 'snowflake',
    name: 'Snowflake',
    description: 'Sync contract data to Snowflake data warehouse',
    category: 'database',
    icon: 'snowflake',
    status: 'disconnected',
    features: ['Data sync', 'Analytics', 'Custom queries'],
    enterprise: true,
  },
];

const categoryConfig: Record<IntegrationCategory, { label: string; icon: React.ElementType }> = {
  storage: { label: 'Cloud Storage', icon: Cloud },
  crm: { label: 'CRM', icon: Building },
  communication: { label: 'Communication', icon: MessageSquare },
  productivity: { label: 'Productivity', icon: Calendar },
  security: { label: 'Security', icon: Shield },
  database: { label: 'Database', icon: Database },
};

const statusConfig: Record<IntegrationStatus, { label: string; color: string; icon: React.ElementType }> = {
  connected: { label: 'Connected', color: 'bg-green-100 text-green-700', icon: Check },
  disconnected: { label: 'Not Connected', color: 'bg-slate-100 text-slate-500', icon: X },
  error: { label: 'Error', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
};

interface IntegrationsHubProps {
  className?: string;
}

export const IntegrationsHub = memo(function IntegrationsHub({
  className,
}: IntegrationsHubProps) {
  const [integrations, setIntegrations] = useState<Integration[]>(availableIntegrations);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<IntegrationCategory | 'all'>('all');
  const [showConnectedOnly, setShowConnectedOnly] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [configuring, setConfiguring] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  // Connection form state
  const [connectionForm, setConnectionForm] = useState<Record<string, string>>({});

  const filteredIntegrations = integrations.filter(integration => {
    if (search) {
      const searchLower = search.toLowerCase();
      if (
        !integration.name.toLowerCase().includes(searchLower) &&
        !integration.description.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }

    if (categoryFilter !== 'all' && integration.category !== categoryFilter) {
      return false;
    }

    if (showConnectedOnly && integration.status !== 'connected') {
      return false;
    }

    return true;
  });

  const connectedCount = integrations.filter(i => i.status === 'connected').length;

  const handleConnect = async () => {
    if (!selectedIntegration) return;

    setConfiguring(true);
    
    // Simulate OAuth or API connection
    await new Promise(resolve => setTimeout(resolve, 2000));

    setIntegrations(prev =>
      prev.map(i =>
        i.id === selectedIntegration.id
          ? { ...i, status: 'connected' as IntegrationStatus, lastSync: new Date() }
          : i
      )
    );

    setConfiguring(false);
    setSelectedIntegration(null);
    setConnectionForm({});
    toast.success(`Connected to ${selectedIntegration.name}`);
  };

  const handleDisconnect = async (integration: Integration) => {
    setIntegrations(prev =>
      prev.map(i =>
        i.id === integration.id
          ? { ...i, status: 'disconnected' as IntegrationStatus, syncEnabled: false, lastSync: undefined }
          : i
      )
    );
    toast.success(`Disconnected from ${integration.name}`);
  };

  const handleSync = async (integration: Integration) => {
    setSyncing(integration.id);
    
    await new Promise(resolve => setTimeout(resolve, 2000));

    setIntegrations(prev =>
      prev.map(i =>
        i.id === integration.id
          ? { ...i, lastSync: new Date(), status: 'connected' as IntegrationStatus }
          : i
      )
    );

    setSyncing(null);
    toast.success(`Synced with ${integration.name}`);
  };

  const toggleSync = (integrationId: string) => {
    setIntegrations(prev =>
      prev.map(i =>
        i.id === integrationId
          ? { ...i, syncEnabled: !i.syncEnabled }
          : i
      )
    );
  };

  const getIconComponent = (iconName: string) => {
    // In a real app, these would be actual logos/icons
    const iconMap: Record<string, React.ReactNode> = {
      'google-drive': <Cloud className="h-6 w-6 text-green-600" />,
      'dropbox': <Cloud className="h-6 w-6 text-violet-600" />,
      'onedrive': <Cloud className="h-6 w-6 text-violet-500" />,
      'aws': <Cloud className="h-6 w-6 text-orange-500" />,
      'salesforce': <Building className="h-6 w-6 text-violet-600" />,
      'hubspot': <Building className="h-6 w-6 text-orange-600" />,
      'slack': <MessageSquare className="h-6 w-6 text-purple-600" />,
      'teams': <MessageSquare className="h-6 w-6 text-purple-600" />,
      'gmail': <Mail className="h-6 w-6 text-red-500" />,
      'docusign': <FileText className="h-6 w-6 text-yellow-600" />,
      'google-calendar': <Calendar className="h-6 w-6 text-violet-600" />,
      'jira': <FileText className="h-6 w-6 text-violet-500" />,
      'okta': <Shield className="h-6 w-6 text-violet-600" />,
      'azure': <Shield className="h-6 w-6 text-violet-500" />,
      'snowflake': <Database className="h-6 w-6 text-purple-500" />,
    };
    return iconMap[iconName] || <Plug className="h-6 w-6 text-slate-400" />;
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Plug className="h-6 w-6 text-violet-600" />
            Integrations
          </h2>
          <p className="text-slate-600 mt-1">
            Connect with your favorite tools and services
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {connectedCount} connected
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search integrations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Tabs value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as IntegrationCategory | 'all')}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            {Object.entries(categoryConfig).map(([key, { label }]) => (
              <TabsTrigger key={key} value={key}>{label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Switch
            id="connected-only"
            checked={showConnectedOnly}
            onCheckedChange={setShowConnectedOnly}
          />
          <Label htmlFor="connected-only" className="text-sm">
            Connected only
          </Label>
        </div>
      </div>

      {/* Integrations Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredIntegrations.map(integration => {
          const statusConf = statusConfig[integration.status];
          const StatusIcon = statusConf.icon;

          return (
            <Card
              key={integration.id}
              className={cn(
                'hover:shadow-md transition-shadow',
                integration.status === 'connected' && 'border-green-200'
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center">
                      {getIconComponent(integration.icon)}
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {integration.name}
                        {integration.popular && (
                          <Badge variant="secondary" className="text-[10px] py-0">
                            Popular
                          </Badge>
                        )}
                        {integration.enterprise && (
                          <Badge className="bg-purple-100 text-purple-700 text-[10px] py-0">
                            Enterprise
                          </Badge>
                        )}
                      </CardTitle>
                      <Badge className={cn('mt-1', statusConf.color)}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConf.label}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                <p className="text-sm text-slate-600 line-clamp-2">
                  {integration.description}
                </p>
                <div className="flex flex-wrap gap-1 mt-3">
                  {integration.features.slice(0, 3).map(feature => (
                    <Badge key={feature} variant="outline" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between">
                {integration.status === 'connected' ? (
                  <>
                    <div className="text-xs text-slate-500">
                      {integration.lastSync && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Synced {formatDistanceToNow(integration.lastSync, { addSuffix: true })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSync(integration)}
                        disabled={syncing === integration.id}
                      >
                        {syncing === integration.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedIntegration(integration)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                ) : integration.status === 'error' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-red-600 border-red-200"
                    onClick={() => handleSync(integration)}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry Connection
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setSelectedIntegration(integration)}
                  >
                    <Plug className="h-4 w-4 mr-2" />
                    Connect
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {filteredIntegrations.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Plug className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>No integrations found</p>
          <p className="text-sm mt-1">Try adjusting your filters</p>
        </div>
      )}

      {/* Integration Config Dialog */}
      <Dialog open={!!selectedIntegration} onOpenChange={() => setSelectedIntegration(null)}>
        <DialogContent className="max-w-lg">
          {selectedIntegration && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center">
                    {getIconComponent(selectedIntegration.icon)}
                  </div>
                  <div>
                    <DialogTitle>{selectedIntegration.name}</DialogTitle>
                    <DialogDescription>
                      {selectedIntegration.status === 'connected'
                        ? 'Manage integration settings'
                        : 'Connect to ' + selectedIntegration.name
                      }
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {selectedIntegration.status === 'connected' ? (
                // Settings for connected integration
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium">Auto Sync</p>
                      <p className="text-sm text-slate-500">
                        Automatically sync data every hour
                      </p>
                    </div>
                    <Switch
                      checked={selectedIntegration.syncEnabled}
                      onCheckedChange={() => toggleSync(selectedIntegration.id)}
                    />
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="font-medium mb-2">Connection Info</p>
                    <div className="text-sm text-slate-600 space-y-1">
                      <p>Status: <Badge className={statusConfig[selectedIntegration.status].color}>
                        {statusConfig[selectedIntegration.status].label}
                      </Badge></p>
                      {selectedIntegration.lastSync && (
                        <p>Last Sync: {formatDistanceToNow(selectedIntegration.lastSync, { addSuffix: true })}</p>
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-red-50 rounded-lg">
                    <p className="font-medium text-red-700 mb-2">Danger Zone</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200"
                      onClick={() => {
                        handleDisconnect(selectedIntegration);
                        setSelectedIntegration(null);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Disconnect Integration
                    </Button>
                  </div>
                </div>
              ) : (
                // Connect form
                <div className="space-y-4">
                  <div className="p-4 bg-violet-50 rounded-lg text-sm text-violet-700">
                    <p className="font-medium mb-1">Connection Required</p>
                    <p>You&apos;ll be redirected to {selectedIntegration.name} to authorize the connection.</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Features</p>
                    <ul className="space-y-1">
                      {selectedIntegration.features.map(feature => (
                        <li key={feature} className="flex items-center gap-2 text-sm text-slate-600">
                          <Check className="h-4 w-4 text-green-500" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {selectedIntegration.enterprise && (
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <p className="font-medium text-purple-700 flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Enterprise Feature
                      </p>
                      <p className="text-sm text-purple-600 mt-1">
                        This integration may require an enterprise plan.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedIntegration(null)}>
                  {selectedIntegration.status === 'connected' ? 'Close' : 'Cancel'}
                </Button>
                {selectedIntegration.status !== 'connected' && (
                  <Button onClick={handleConnect} disabled={configuring}>
                    {configuring ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    Connect with {selectedIntegration.name}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
});

export default IntegrationsHub;
