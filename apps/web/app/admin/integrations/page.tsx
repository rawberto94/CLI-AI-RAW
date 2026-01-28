'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Database,
  Plus,
  Check,
  X,
  AlertCircle,
  Loader2,
  RefreshCw,
  Settings,
  Link2,
  Unlink,
  FileText,
  Cloud,
  Server,
  Shield,
  Eye,
  EyeOff,
  HelpCircle,
  Trash2,
  TestTube,
  ChevronRight,
  Download,
  Upload,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// Types for database connections
interface DatabaseConnection {
  id: string;
  name: string;
  type: 'postgresql' | 'mysql' | 'sqlserver' | 'mongodb' | 'oracle' | 's3' | 'sharepoint' | 'azure_blob';
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  host?: string;
  database?: string;
  lastSync?: string;
  contractCount?: number;
  syncMode: 'import' | 'reference'; // import = copy files, reference = just extract data
  createdAt: string;
  contractTableName?: string;
  autoSync: boolean;
  syncFrequency?: 'hourly' | 'daily' | 'weekly' | 'manual';
}

// Connection type configurations
const CONNECTION_TYPES = [
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    icon: Database,
    color: 'bg-violet-500',
    description: 'Connect to PostgreSQL databases',
    fields: ['host', 'port', 'database', 'username', 'password', 'ssl'],
  },
  {
    id: 'mysql',
    name: 'MySQL',
    icon: Database,
    color: 'bg-orange-500',
    description: 'Connect to MySQL databases',
    fields: ['host', 'port', 'database', 'username', 'password'],
  },
  {
    id: 'sqlserver',
    name: 'SQL Server',
    icon: Database,
    color: 'bg-red-500',
    description: 'Connect to Microsoft SQL Server',
    fields: ['host', 'port', 'database', 'username', 'password'],
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    icon: Database,
    color: 'bg-green-500',
    description: 'Connect to MongoDB databases',
    fields: ['connectionString', 'database', 'collection'],
  },
  {
    id: 's3',
    name: 'Amazon S3',
    icon: Cloud,
    color: 'bg-yellow-500',
    description: 'Connect to AWS S3 buckets',
    fields: ['accessKeyId', 'secretAccessKey', 'region', 'bucket'],
  },
  {
    id: 'azure_blob',
    name: 'Azure Blob Storage',
    icon: Cloud,
    color: 'bg-purple-500',
    description: 'Connect to Azure Blob Storage',
    fields: ['connectionString', 'container'],
  },
  {
    id: 'sharepoint',
    name: 'SharePoint',
    icon: Cloud,
    color: 'bg-purple-500',
    description: 'Connect to SharePoint document libraries',
    fields: ['siteUrl', 'clientId', 'clientSecret', 'library'],
  },
];

export default function DataConnectionsPage() {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [showNewConnection, setShowNewConnection] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState<Record<string, string>>({
    name: '',
    host: '',
    port: '',
    database: '',
    username: '',
    password: '',
    connectionString: '',
    accessKeyId: '',
    secretAccessKey: '',
    region: '',
    bucket: '',
    container: '',
    siteUrl: '',
    clientId: '',
    clientSecret: '',
    library: '',
    collection: '',
    contractTableName: 'contracts',
    ssl: 'true',
  });
  
  const [syncMode, setSyncMode] = useState<'import' | 'reference'>('reference');
  const [autoSync, setAutoSync] = useState(true);
  const [syncFrequency, setSyncFrequency] = useState<'hourly' | 'daily' | 'weekly' | 'manual'>('daily');

  // Load existing connections
  useEffect(() => {
    async function loadConnections() {
      try {
        const response = await fetch('/api/admin/data-connections');
        if (response.ok) {
          const data = await response.json();
          setConnections(data.connections || []);
        }
      } catch {
        // Error handled silently
      } finally {
        setIsLoading(false);
      }
    }
    loadConnections();
  }, []);

  // Reset form
  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      host: '',
      port: '',
      database: '',
      username: '',
      password: '',
      connectionString: '',
      accessKeyId: '',
      secretAccessKey: '',
      region: '',
      bucket: '',
      container: '',
      siteUrl: '',
      clientId: '',
      clientSecret: '',
      library: '',
      collection: '',
      contractTableName: 'contracts',
      ssl: 'true',
    });
    setSelectedType(null);
    setShowNewConnection(false);
    setTestResult(null);
    setSyncMode('reference');
    setAutoSync(true);
    setSyncFrequency('daily');
  }, []);

  // Test connection
  const testConnection = useCallback(async () => {
    if (!selectedType) return;
    
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const response = await fetch('/api/admin/data-connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          ...formData,
        }),
      });
      
      const data = await response.json();
      setTestResult({
        success: data.success,
        message: data.message || (data.success ? 'Connection successful!' : 'Connection failed'),
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: 'Failed to test connection',
      });
    } finally {
      setIsTesting(false);
    }
  }, [selectedType, formData]);

  // Save connection
  const saveConnection = useCallback(async () => {
    if (!selectedType || !formData.name) return;
    
    setIsSaving(true);
    
    try {
      const response = await fetch('/api/admin/data-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          name: formData.name,
          config: formData,
          syncMode,
          autoSync,
          syncFrequency,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setConnections(prev => [...prev, data.connection]);
        resetForm();
      }
    } catch {
      // Error handled silently
    } finally {
      setIsSaving(false);
    }
  }, [selectedType, formData, syncMode, autoSync, syncFrequency, resetForm]);

  // Sync connection
  const syncConnection = useCallback(async (connectionId: string) => {
    try {
      setConnections(prev => prev.map(c => 
        c.id === connectionId ? { ...c, status: 'syncing' } : c
      ));
      
      const response = await fetch(`/api/admin/data-connections/${connectionId}/sync`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const data = await response.json();
        setConnections(prev => prev.map(c => 
          c.id === connectionId ? { ...c, status: 'connected', lastSync: new Date().toISOString(), contractCount: data.contractCount } : c
        ));
      }
    } catch (err) {
      setConnections(prev => prev.map(c => 
        c.id === connectionId ? { ...c, status: 'error' } : c
      ));
    }
  }, []);

  // Delete connection
  const deleteConnection = useCallback(async (connectionId: string) => {
    if (!confirm('Are you sure you want to delete this connection?')) return;
    
    try {
      await fetch(`/api/admin/data-connections/${connectionId}`, {
        method: 'DELETE',
      });
      setConnections(prev => prev.filter(c => c.id !== connectionId));
    } catch {
      // Error handled silently
    }
  }, []);

  const selectedTypeConfig = CONNECTION_TYPES.find(t => t.id === selectedType);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg">
                <Database className="h-6 w-6 text-white" />
              </div>
              Data Connections
            </h1>
            <p className="text-gray-500 mt-1">
              Connect external databases and document stores to sync contracts
            </p>
          </div>
          
          <Button
            onClick={() => setShowNewConnection(true)}
            className="bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Connection
          </Button>
        </div>
        
        {/* Info Banner */}
        <Card className="border-0 shadow-sm bg-gradient-to-r from-violet-50 to-purple-50 border-l-4 border-l-violet-500">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <HelpCircle className="h-5 w-5 text-violet-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-violet-900">How Data Connections Work</h3>
                <p className="text-sm text-violet-700 mt-1">
                  Connect your existing databases or document stores. ConTigo can either <strong>import</strong> contracts 
                  (copy files to ConTigo) or <strong>reference</strong> them (extract data while keeping original files in your system).
                  Reference mode is ideal when you need to maintain files in their original location.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* New Connection Form */}
        {showNewConnection && (
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                New Data Connection
              </CardTitle>
              <CardDescription>
                Connect to your external data source
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1: Select Type */}
              {!selectedType && (
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-3 block">
                    Select Connection Type
                  </Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {CONNECTION_TYPES.map((type) => {
                      const Icon = type.icon;
                      return (
                        <button
                          key={type.id}
                          onClick={() => setSelectedType(type.id)}
                          className="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-gray-200 hover:border-violet-400 hover:bg-violet-50 transition-all"
                        >
                          <div className={cn("p-3 rounded-xl", type.color)}>
                            <Icon className="h-6 w-6 text-white" />
                          </div>
                          <div className="text-center">
                            <p className="font-medium text-gray-900">{type.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{type.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Step 2: Configure Connection */}
              {selectedType && selectedTypeConfig && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-lg", selectedTypeConfig.color)}>
                        <selectedTypeConfig.icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{selectedTypeConfig.name}</h3>
                        <p className="text-sm text-gray-500">{selectedTypeConfig.description}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedType(null)}>
                      <ChevronRight className="h-4 w-4 rotate-180 mr-1" />
                      Back
                    </Button>
                  </div>
                  
                  {/* Connection Name */}
                  <div className="space-y-2">
                    <Label htmlFor="name">Connection Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Production Contracts DB"
                    />
                  </div>
                  
                  {/* Dynamic Fields based on type */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedTypeConfig.fields.includes('host') && (
                      <div className="space-y-2">
                        <Label htmlFor="host">Host *</Label>
                        <Input
                          id="host"
                          value={formData.host}
                          onChange={(e) => setFormData(prev => ({ ...prev, host: e.target.value }))}
                          placeholder="e.g., db.example.com"
                        />
                      </div>
                    )}
                    {selectedTypeConfig.fields.includes('port') && (
                      <div className="space-y-2">
                        <Label htmlFor="port">Port</Label>
                        <Input
                          id="port"
                          value={formData.port}
                          onChange={(e) => setFormData(prev => ({ ...prev, port: e.target.value }))}
                          placeholder={selectedType === 'postgresql' ? '5432' : selectedType === 'mysql' ? '3306' : '1433'}
                        />
                      </div>
                    )}
                    {selectedTypeConfig.fields.includes('database') && (
                      <div className="space-y-2">
                        <Label htmlFor="database">Database Name *</Label>
                        <Input
                          id="database"
                          value={formData.database}
                          onChange={(e) => setFormData(prev => ({ ...prev, database: e.target.value }))}
                          placeholder="e.g., contracts_db"
                        />
                      </div>
                    )}
                    {selectedTypeConfig.fields.includes('username') && (
                      <div className="space-y-2">
                        <Label htmlFor="username">Username *</Label>
                        <Input
                          id="username"
                          value={formData.username}
                          onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                          placeholder="Database username"
                        />
                      </div>
                    )}
                    {selectedTypeConfig.fields.includes('password') && (
                      <div className="space-y-2">
                        <Label htmlFor="password">Password *</Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            value={formData.password}
                            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                            placeholder="Database password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    )}
                    {selectedTypeConfig.fields.includes('connectionString') && (
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="connectionString">Connection String *</Label>
                        <Input
                          id="connectionString"
                          type={showPassword ? 'text' : 'password'}
                          value={formData.connectionString}
                          onChange={(e) => setFormData(prev => ({ ...prev, connectionString: e.target.value }))}
                          placeholder="Full connection string"
                        />
                      </div>
                    )}
                    {selectedTypeConfig.fields.includes('accessKeyId') && (
                      <div className="space-y-2">
                        <Label htmlFor="accessKeyId">Access Key ID *</Label>
                        <Input
                          id="accessKeyId"
                          value={formData.accessKeyId}
                          onChange={(e) => setFormData(prev => ({ ...prev, accessKeyId: e.target.value }))}
                          placeholder="AWS Access Key"
                        />
                      </div>
                    )}
                    {selectedTypeConfig.fields.includes('secretAccessKey') && (
                      <div className="space-y-2">
                        <Label htmlFor="secretAccessKey">Secret Access Key *</Label>
                        <Input
                          id="secretAccessKey"
                          type={showPassword ? 'text' : 'password'}
                          value={formData.secretAccessKey}
                          onChange={(e) => setFormData(prev => ({ ...prev, secretAccessKey: e.target.value }))}
                          placeholder="AWS Secret Key"
                        />
                      </div>
                    )}
                    {selectedTypeConfig.fields.includes('region') && (
                      <div className="space-y-2">
                        <Label htmlFor="region">Region *</Label>
                        <Input
                          id="region"
                          value={formData.region}
                          onChange={(e) => setFormData(prev => ({ ...prev, region: e.target.value }))}
                          placeholder="e.g., us-east-1"
                        />
                      </div>
                    )}
                    {selectedTypeConfig.fields.includes('bucket') && (
                      <div className="space-y-2">
                        <Label htmlFor="bucket">Bucket Name *</Label>
                        <Input
                          id="bucket"
                          value={formData.bucket}
                          onChange={(e) => setFormData(prev => ({ ...prev, bucket: e.target.value }))}
                          placeholder="S3 bucket name"
                        />
                      </div>
                    )}
                    {selectedTypeConfig.fields.includes('container') && (
                      <div className="space-y-2">
                        <Label htmlFor="container">Container Name *</Label>
                        <Input
                          id="container"
                          value={formData.container}
                          onChange={(e) => setFormData(prev => ({ ...prev, container: e.target.value }))}
                          placeholder="Azure container name"
                        />
                      </div>
                    )}
                    {selectedTypeConfig.fields.includes('siteUrl') && (
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="siteUrl">SharePoint Site URL *</Label>
                        <Input
                          id="siteUrl"
                          value={formData.siteUrl}
                          onChange={(e) => setFormData(prev => ({ ...prev, siteUrl: e.target.value }))}
                          placeholder="https://yourcompany.sharepoint.com/sites/contracts"
                        />
                      </div>
                    )}
                    {selectedTypeConfig.fields.includes('library') && (
                      <div className="space-y-2">
                        <Label htmlFor="library">Document Library *</Label>
                        <Input
                          id="library"
                          value={formData.library}
                          onChange={(e) => setFormData(prev => ({ ...prev, library: e.target.value }))}
                          placeholder="e.g., Documents"
                        />
                      </div>
                    )}
                    {selectedTypeConfig.fields.includes('collection') && (
                      <div className="space-y-2">
                        <Label htmlFor="collection">Collection Name *</Label>
                        <Input
                          id="collection"
                          value={formData.collection}
                          onChange={(e) => setFormData(prev => ({ ...prev, collection: e.target.value }))}
                          placeholder="MongoDB collection"
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Contract Table/Path */}
                  <div className="space-y-2">
                    <Label htmlFor="contractTableName">
                      {['s3', 'azure_blob', 'sharepoint'].includes(selectedType) 
                        ? 'Contract Files Path (optional)' 
                        : 'Contracts Table Name (optional)'}
                    </Label>
                    <Input
                      id="contractTableName"
                      value={formData.contractTableName}
                      onChange={(e) => setFormData(prev => ({ ...prev, contractTableName: e.target.value }))}
                      placeholder={['s3', 'azure_blob', 'sharepoint'].includes(selectedType) 
                        ? '/contracts/' 
                        : 'contracts'}
                    />
                    <p className="text-xs text-gray-500">
                      Specify where contracts are stored in your system
                    </p>
                  </div>
                  
                  {/* Sync Mode */}
                  <div className="space-y-3">
                    <Label>Sync Mode</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        onClick={() => setSyncMode('reference')}
                        className={cn(
                          "p-4 rounded-xl border-2 text-left transition-all",
                          syncMode === 'reference'
                            ? "border-violet-500 bg-violet-50"
                            : "border-gray-200 hover:border-gray-300"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-lg",
                            syncMode === 'reference' ? "bg-violet-500" : "bg-gray-200"
                          )}>
                            <Link2 className={cn("h-5 w-5", syncMode === 'reference' ? "text-white" : "text-gray-600")} />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">Reference Only</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Extract data, files stay in your system
                            </p>
                          </div>
                        </div>
                        {syncMode === 'reference' && (
                          <div className="mt-3 flex items-center gap-1.5 text-xs text-violet-600">
                            <Check className="h-3.5 w-3.5" />
                            Recommended
                          </div>
                        )}
                      </button>
                      
                      <button
                        onClick={() => setSyncMode('import')}
                        className={cn(
                          "p-4 rounded-xl border-2 text-left transition-all",
                          syncMode === 'import'
                            ? "border-violet-500 bg-violet-50"
                            : "border-gray-200 hover:border-gray-300"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-lg",
                            syncMode === 'import' ? "bg-violet-500" : "bg-gray-200"
                          )}>
                            <Download className={cn("h-5 w-5", syncMode === 'import' ? "text-white" : "text-gray-600")} />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">Full Import</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Copy files to ConTigo storage
                            </p>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                  
                  {/* Auto Sync */}
                  <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50">
                    <div>
                      <p className="font-medium text-gray-900">Automatic Sync</p>
                      <p className="text-sm text-gray-500">Automatically sync new contracts</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <select
                        value={syncFrequency}
                        onChange={(e) => setSyncFrequency(e.target.value as typeof syncFrequency)}
                        className="text-sm border rounded-lg px-3 py-1.5"
                        disabled={!autoSync}
                      >
                        <option value="hourly">Every Hour</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="manual">Manual Only</option>
                      </select>
                      <button
                        onClick={() => setAutoSync(!autoSync)}
                        className={cn(
                          "w-12 h-6 rounded-full transition-colors relative",
                          autoSync ? "bg-violet-600" : "bg-gray-300"
                        )}
                      >
                        <div className={cn(
                          "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
                          autoSync ? "translate-x-6" : "translate-x-0.5"
                        )} />
                      </button>
                    </div>
                  </div>
                  
                  {/* Test Result */}
                  {testResult && (
                    <div className={cn(
                      "flex items-center gap-3 p-4 rounded-lg",
                      testResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                    )}>
                      {testResult.success ? <Check className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                      {testResult.message}
                    </div>
                  )}
                  
                  {/* Actions */}
                  <div className="flex justify-between pt-4 border-t">
                    <Button variant="outline" onClick={resetForm}>
                      Cancel
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={testConnection}
                        disabled={isTesting}
                      >
                        {isTesting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Testing...
                          </>
                        ) : (
                          <>
                            <TestTube className="h-4 w-4 mr-2" />
                            Test Connection
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={saveConnection}
                        disabled={isSaving || !formData.name}
                        className="bg-gradient-to-r from-violet-600 to-purple-600"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Save Connection
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
        {/* Loading State */}
        {isLoading && (
          <Card className="border-0 shadow-md">
            <CardContent className="py-12 text-center">
              <Loader2 className="h-8 w-8 mx-auto text-violet-500 animate-spin" />
              <p className="text-gray-500 mt-3">Loading connections...</p>
            </CardContent>
          </Card>
        )}
        
        {/* Empty State */}
        {!isLoading && connections.length === 0 && !showNewConnection && (
          <Card className="border-2 border-dashed border-gray-200">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <Database className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Data Connections
              </h3>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                Connect your external databases or document stores to sync contracts. 
                ConTigo can reference files without moving them from your system.
              </p>
              <Button
                onClick={() => setShowNewConnection(true)}
                className="bg-gradient-to-r from-violet-600 to-purple-600"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Connection
              </Button>
            </CardContent>
          </Card>
        )}
        
        {/* Connections List */}
        {!isLoading && connections.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Active Connections ({connections.length})
            </h2>
            
            {connections.map((connection) => {
              const typeConfig = CONNECTION_TYPES.find(t => t.id === connection.type);
              const Icon = typeConfig?.icon || Database;
              
              return (
                <Card key={connection.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn("p-3 rounded-xl", typeConfig?.color || "bg-gray-500")}>
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{connection.name}</h3>
                            <Badge 
                              className={cn(
                                "text-xs",
                                connection.status === 'connected' && "bg-green-100 text-green-700",
                                connection.status === 'syncing' && "bg-violet-100 text-violet-700",
                                connection.status === 'error' && "bg-red-100 text-red-700",
                                connection.status === 'disconnected' && "bg-gray-100 text-gray-700",
                              )}
                            >
                              {connection.status === 'syncing' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                              {connection.status}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {connection.syncMode === 'reference' ? (
                                <><Link2 className="h-3 w-3 mr-1" /> Reference</>
                              ) : (
                                <><Download className="h-3 w-3 mr-1" /> Import</>
                              )}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500 mt-0.5">
                            {typeConfig?.name} • {connection.host || connection.database || 'Configured'}
                            {connection.contractCount !== undefined && (
                              <span className="ml-2">• {connection.contractCount} contracts</span>
                            )}
                          </p>
                          {connection.lastSync && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              Last sync: {new Date(connection.lastSync).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => syncConnection(connection.id)}
                          disabled={connection.status === 'syncing'}
                        >
                          <RefreshCw className={cn("h-4 w-4", connection.status === 'syncing' && "animate-spin")} />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => deleteConnection(connection.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        
        {/* Security Notice */}
        <Card className="border-0 shadow-sm bg-slate-50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-slate-500 mt-0.5" />
              <div>
                <h3 className="font-medium text-slate-700">Security & Encryption</h3>
                <p className="text-sm text-slate-500 mt-1">
                  All connection credentials are encrypted at rest using AES-256. Data transfers use TLS 1.3.
                  Reference mode keeps your original files in place - ConTigo only extracts metadata and text for analysis.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
