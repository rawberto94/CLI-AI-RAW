'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Table,
  ArrowRight,
  RefreshCw,
  Download,
  Eye,
  Settings2,
  Zap,
  Shield,
  AlertTriangle,
  HelpCircle,
  Server,
  Link2,
  Play,
  Pause,
  Clock,
  FileText,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

type DatabaseType = 'postgresql' | 'mysql' | 'mssql' | 'oracle' | 'mongodb' | 'snowflake' | 'bigquery';
type Step = 'connect' | 'select-table' | 'map-columns' | 'preview' | 'import' | 'complete';

interface DatabaseConfig {
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  schema?: string;
}

interface ColumnMapping {
  fileNameColumn?: string;
  contractTypeColumn?: string;
  clientNameColumn?: string;
  supplierNameColumn?: string;
  valueColumn?: string;
  startDateColumn?: string;
  endDateColumn?: string;
  statusColumn?: string;
  rawTextColumn?: string;
}

interface TablePreview {
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
}

interface ImportResult {
  success: boolean;
  totalRecords: number;
  imported: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
  contractIds: string[];
}

const DATABASE_CONFIGS: Record<DatabaseType, { name: string; icon: string; defaultPort: number; color: string }> = {
  postgresql: { name: 'PostgreSQL', icon: '🐘', defaultPort: 5432, color: 'from-blue-500 to-indigo-600' },
  mysql: { name: 'MySQL', icon: '🐬', defaultPort: 3306, color: 'from-orange-500 to-amber-600' },
  mssql: { name: 'SQL Server', icon: '🔷', defaultPort: 1433, color: 'from-red-500 to-rose-600' },
  oracle: { name: 'Oracle', icon: '🔴', defaultPort: 1521, color: 'from-red-600 to-orange-600' },
  mongodb: { name: 'MongoDB', icon: '🍃', defaultPort: 27017, color: 'from-green-500 to-emerald-600' },
  snowflake: { name: 'Snowflake', icon: '❄️', defaultPort: 443, color: 'from-cyan-500 to-blue-600' },
  bigquery: { name: 'BigQuery', icon: '📊', defaultPort: 443, color: 'from-blue-600 to-indigo-700' },
};

const MAPPING_FIELDS = [
  { key: 'fileNameColumn', label: 'Contract Name/Title', required: true, description: 'The column containing the contract name or title' },
  { key: 'contractTypeColumn', label: 'Contract Type', required: false, description: 'MSA, NDA, SOW, etc.' },
  { key: 'clientNameColumn', label: 'Client/Customer Name', required: false, description: 'The client or customer party' },
  { key: 'supplierNameColumn', label: 'Supplier/Vendor Name', required: false, description: 'The supplier or vendor party' },
  { key: 'valueColumn', label: 'Contract Value', required: false, description: 'Total contract value or amount' },
  { key: 'startDateColumn', label: 'Start Date', required: false, description: 'Contract effective date' },
  { key: 'endDateColumn', label: 'End Date', required: false, description: 'Contract expiration date' },
  { key: 'statusColumn', label: 'Status', required: false, description: 'Active, Expired, Draft, etc.' },
  { key: 'rawTextColumn', label: 'Contract Text/Content', required: false, description: 'Full contract text for AI processing' },
];

export default function ExternalDatabaseImportPage() {
  // State
  const [step, setStep] = useState<Step>('connect');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'connected' | 'error'>('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Database config
  const [config, setConfig] = useState<DatabaseConfig>({
    type: 'postgresql',
    host: '',
    port: 5432,
    database: '',
    username: '',
    password: '',
    ssl: false,
  });
  
  // Tables
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tableSearch, setTableSearch] = useState('');
  
  // Column mapping
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [preview, setPreview] = useState<TablePreview | null>(null);
  
  // Import options
  const [importOptions, setImportOptions] = useState({
    triggerProcessing: true,
    batchSize: 100,
    limit: 0, // 0 = no limit
  });
  
  // Import results
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);

  // API call helper
  const apiCall = useCallback(async (action: string, extraData?: Record<string, unknown>) => {
    const response = await fetch('/api/import/external-database', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': 'demo',
      },
      body: JSON.stringify({
        action,
        config,
        ...extraData,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || error.error || 'Request failed');
    }
    
    return response.json();
  }, [config]);

  // Test connection
  const testConnection = async () => {
    setConnectionStatus('testing');
    setConnectionError(null);
    
    try {
      const result = await apiCall('test');
      
      if (result.success) {
        setConnectionStatus('connected');
        toast.success(`Connected! Found ${result.tableCount} tables.`);
        
        // Fetch tables
        const tablesResult = await apiCall('list-tables');
        setTables(tablesResult.tables || []);
        setStep('select-table');
      } else {
        setConnectionStatus('error');
        setConnectionError(result.message);
        toast.error(result.message);
      }
    } catch (error) {
      setConnectionStatus('error');
      const message = error instanceof Error ? error.message : 'Connection failed';
      setConnectionError(message);
      toast.error(message);
    }
  };

  // Load table preview
  const loadPreview = async () => {
    if (!selectedTable) return;
    
    setIsLoading(true);
    try {
      const result = await apiCall('preview', { tableName: selectedTable });
      setPreview(result);
      setStep('map-columns');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to preview table');
    } finally {
      setIsLoading(false);
    }
  };

  // Run import
  const runImport = async () => {
    setIsLoading(true);
    setImportProgress(0);
    
    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90));
      }, 500);
      
      const result = await apiCall('import', {
        tableName: selectedTable,
        mapping,
        options: {
          ...importOptions,
          limit: importOptions.limit > 0 ? importOptions.limit : undefined,
        },
      });
      
      clearInterval(progressInterval);
      setImportProgress(100);
      setImportResult(result);
      setStep('complete');
      
      if (result.success) {
        toast.success(`Imported ${result.imported} contracts successfully!`);
      } else {
        toast.warning(`Imported ${result.imported} contracts with ${result.failed} failures.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter tables by search
  const filteredTables = tables.filter(t => 
    t.toLowerCase().includes(tableSearch.toLowerCase())
  );

  // Render step indicator
  const steps: { key: Step; label: string }[] = [
    { key: 'connect', label: 'Connect' },
    { key: 'select-table', label: 'Select Table' },
    { key: 'map-columns', label: 'Map Columns' },
    { key: 'preview', label: 'Preview' },
    { key: 'import', label: 'Import' },
    { key: 'complete', label: 'Complete' },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-600 shadow-2xl">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.6))]" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        
        <div className="relative max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/contracts">
                <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/20">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div className="h-8 w-px bg-white/20" />
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                <Database className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">External Database Import</h1>
                <p className="text-blue-100 mt-1">Connect to client databases and import contracts</p>
              </div>
            </div>
            
            <div className="hidden md:flex items-center gap-3">
              <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm px-4 py-2">
                <Shield className="w-4 h-4 mr-2" />
                Secure Connection
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-8">
          {steps.map((s, index) => (
            <React.Fragment key={s.key}>
              <div className="flex items-center gap-2">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${index < currentStepIndex ? 'bg-green-500 text-white' : 
                    index === currentStepIndex ? 'bg-blue-600 text-white' : 
                    'bg-slate-200 text-slate-500'}
                `}>
                  {index < currentStepIndex ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    index + 1
                  )}
                </div>
                <span className={`text-sm font-medium hidden sm:block ${
                  index <= currentStepIndex ? 'text-slate-900' : 'text-slate-400'
                }`}>
                  {s.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${
                  index < currentStepIndex ? 'bg-green-500' : 'bg-slate-200'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {/* Step 1: Connect */}
          {step === 'connect' && (
            <motion.div
              key="connect"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="max-w-2xl mx-auto">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="w-5 h-5" />
                    Database Connection
                  </CardTitle>
                  <CardDescription>
                    Enter the connection details for the client database
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Database Type */}
                  <div className="space-y-2">
                    <Label>Database Type</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {(Object.entries(DATABASE_CONFIGS) as [DatabaseType, typeof DATABASE_CONFIGS[DatabaseType]][]).map(([type, info]) => (
                        <button
                          key={type}
                          onClick={() => setConfig(prev => ({ 
                            ...prev, 
                            type, 
                            port: info.defaultPort 
                          }))}
                          className={`
                            p-4 rounded-xl border-2 transition-all text-center
                            ${config.type === type 
                              ? 'border-blue-500 bg-blue-50' 
                              : 'border-slate-200 hover:border-slate-300'}
                          `}
                        >
                          <div className="text-2xl mb-1">{info.icon}</div>
                          <div className="text-sm font-medium">{info.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Connection Fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="host">Host</Label>
                      <Input
                        id="host"
                        placeholder="db.example.com"
                        value={config.host}
                        onChange={e => setConfig(prev => ({ ...prev, host: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="port">Port</Label>
                      <Input
                        id="port"
                        type="number"
                        value={config.port}
                        onChange={e => setConfig(prev => ({ ...prev, port: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="database">Database Name</Label>
                    <Input
                      id="database"
                      placeholder="contracts_db"
                      value={config.database}
                      onChange={e => setConfig(prev => ({ ...prev, database: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        placeholder="reader"
                        value={config.username}
                        onChange={e => setConfig(prev => ({ ...prev, username: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={config.password}
                        onChange={e => setConfig(prev => ({ ...prev, password: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="ssl"
                      checked={config.ssl}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, ssl: !!checked }))}
                    />
                    <Label htmlFor="ssl" className="text-sm">Use SSL/TLS encryption</Label>
                  </div>

                  {/* Connection Status */}
                  {connectionError && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                      <div>
                        <div className="font-medium text-red-900">Connection Failed</div>
                        <div className="text-sm text-red-700">{connectionError}</div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      onClick={testConnection}
                      disabled={!config.host || !config.database || !config.username || connectionStatus === 'testing'}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600"
                    >
                      {connectionStatus === 'testing' ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <Link2 className="w-4 h-4 mr-2" />
                          Test Connection
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 2: Select Table */}
          {step === 'select-table' && (
            <motion.div
              key="select-table"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="max-w-2xl mx-auto">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Table className="w-5 h-5" />
                    Select Table
                  </CardTitle>
                  <CardDescription>
                    Choose the table containing your contracts ({tables.length} tables found)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search tables..."
                      value={tableSearch}
                      onChange={e => setTableSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Table List */}
                  <div className="max-h-80 overflow-y-auto border rounded-lg divide-y">
                    {filteredTables.length === 0 ? (
                      <div className="p-8 text-center text-slate-500">
                        No tables found matching &ldquo;{tableSearch}&rdquo;
                      </div>
                    ) : (
                      filteredTables.map(table => (
                        <button
                          key={table}
                          onClick={() => setSelectedTable(table)}
                          className={`
                            w-full p-4 text-left flex items-center justify-between hover:bg-slate-50
                            ${selectedTable === table ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}
                          `}
                        >
                          <div className="flex items-center gap-3">
                            <Table className="w-4 h-4 text-slate-400" />
                            <span className="font-medium">{table}</span>
                          </div>
                          {selectedTable === table && (
                            <CheckCircle2 className="w-5 h-5 text-blue-500" />
                          )}
                        </button>
                      ))
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={() => setStep('connect')}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      onClick={loadPreview}
                      disabled={!selectedTable || isLoading}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <ArrowRight className="w-4 h-4 mr-2" />
                      )}
                      Continue
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 3: Map Columns */}
          {step === 'map-columns' && preview && (
            <motion.div
              key="map-columns"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="max-w-4xl mx-auto">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings2 className="w-5 h-5" />
                    Map Columns
                  </CardTitle>
                  <CardDescription>
                    Map your table columns to contract fields ({preview.totalRows.toLocaleString()} rows available)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Mapping Grid */}
                  <div className="grid gap-4">
                    {MAPPING_FIELDS.map(field => (
                      <div key={field.key} className="grid grid-cols-2 gap-4 items-start">
                        <div>
                          <Label className="flex items-center gap-2">
                            {field.label}
                            {field.required && <span className="text-red-500">*</span>}
                          </Label>
                          <p className="text-xs text-slate-500 mt-1">{field.description}</p>
                        </div>
                        <Select
                          value={(mapping as Record<string, string>)[field.key] || ''}
                          onValueChange={value => setMapping(prev => ({ 
                            ...prev, 
                            [field.key]: value || undefined 
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select column..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">-- Not mapped --</SelectItem>
                            {preview.columns.map(col => (
                              <SelectItem key={col} value={col}>{col}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>

                  {/* Sample Data Preview */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2 border-b flex items-center justify-between">
                      <span className="text-sm font-medium">Sample Data Preview</span>
                      <Badge variant="secondary">{preview.rows.length} rows shown</Badge>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            {preview.columns.slice(0, 6).map(col => (
                              <th key={col} className="px-4 py-2 text-left font-medium text-slate-600 whitespace-nowrap">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {preview.rows.slice(0, 5).map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              {preview.columns.slice(0, 6).map(col => (
                                <td key={col} className="px-4 py-2 whitespace-nowrap truncate max-w-[200px]">
                                  {String(row[col] ?? '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={() => setStep('select-table')}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      onClick={() => setStep('preview')}
                      disabled={!mapping.fileNameColumn}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600"
                    >
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Preview Import
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 4: Preview & Options */}
          {step === 'preview' && preview && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="max-w-2xl mx-auto">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    Import Preview
                  </CardTitle>
                  <CardDescription>
                    Review your settings before importing
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Summary */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <div className="text-sm text-slate-500">Records to Import</div>
                      <div className="text-2xl font-bold text-slate-900">
                        {importOptions.limit > 0 
                          ? Math.min(importOptions.limit, preview.totalRows).toLocaleString()
                          : preview.totalRows.toLocaleString()
                        }
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <div className="text-sm text-slate-500">Fields Mapped</div>
                      <div className="text-2xl font-bold text-slate-900">
                        {Object.values(mapping).filter(Boolean).length} / {MAPPING_FIELDS.length}
                      </div>
                    </div>
                  </div>

                  {/* Import Options */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Import Options</h4>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="triggerProcessing"
                        checked={importOptions.triggerProcessing}
                        onCheckedChange={checked => setImportOptions(prev => ({ 
                          ...prev, 
                          triggerProcessing: !!checked 
                        }))}
                      />
                      <div>
                        <Label htmlFor="triggerProcessing">Enable AI Processing</Label>
                        <p className="text-xs text-slate-500">
                          Generate artifacts, extract metadata, and categorize contracts
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="batchSize">Batch Size</Label>
                        <Input
                          id="batchSize"
                          type="number"
                          value={importOptions.batchSize}
                          onChange={e => setImportOptions(prev => ({ 
                            ...prev, 
                            batchSize: parseInt(e.target.value) || 100 
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="limit">Limit (0 = all)</Label>
                        <Input
                          id="limit"
                          type="number"
                          value={importOptions.limit}
                          onChange={e => setImportOptions(prev => ({ 
                            ...prev, 
                            limit: parseInt(e.target.value) || 0 
                          }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Warning for large imports */}
                  {preview.totalRows > 1000 && importOptions.limit === 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                      <div>
                        <div className="font-medium text-amber-900">Large Import</div>
                        <div className="text-sm text-amber-700">
                          You&apos;re about to import {preview.totalRows.toLocaleString()} records. 
                          Consider setting a limit for testing first.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={() => setStep('map-columns')}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      onClick={runImport}
                      disabled={isLoading}
                      className="bg-gradient-to-r from-green-600 to-emerald-600"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      Start Import
                    </Button>
                  </div>

                  {/* Progress */}
                  {isLoading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Importing...</span>
                        <span>{importProgress}%</span>
                      </div>
                      <Progress value={importProgress} />
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 5: Complete */}
          {step === 'complete' && importResult && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="max-w-2xl mx-auto">
                <CardHeader className="text-center">
                  {importResult.failed === 0 ? (
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                  ) : (
                    <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                      <AlertTriangle className="w-8 h-8 text-amber-600" />
                    </div>
                  )}
                  <CardTitle>
                    {importResult.failed === 0 ? 'Import Complete!' : 'Import Completed with Errors'}
                  </CardTitle>
                  <CardDescription>
                    {importResult.imported} contracts imported successfully
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg text-center">
                      <div className="text-2xl font-bold text-green-600">{importResult.imported}</div>
                      <div className="text-sm text-green-700">Imported</div>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg text-center">
                      <div className="text-2xl font-bold text-red-600">{importResult.failed}</div>
                      <div className="text-sm text-red-700">Failed</div>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg text-center">
                      <div className="text-2xl font-bold text-blue-600">{importResult.totalRecords}</div>
                      <div className="text-sm text-blue-700">Total</div>
                    </div>
                  </div>

                  {/* Errors */}
                  {importResult.errors.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-red-50 px-4 py-2 border-b">
                        <span className="text-sm font-medium text-red-900">
                          Errors ({importResult.errors.length})
                        </span>
                      </div>
                      <div className="max-h-40 overflow-y-auto divide-y">
                        {importResult.errors.slice(0, 10).map((err, i) => (
                          <div key={i} className="px-4 py-2 text-sm">
                            <span className="font-medium">Row {err.row}:</span> {err.error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-center gap-3 pt-4">
                    <Link href="/contracts">
                      <Button className="bg-gradient-to-r from-blue-600 to-indigo-600">
                        <FileText className="w-4 h-4 mr-2" />
                        View Contracts
                      </Button>
                    </Link>
                    <Button variant="outline" onClick={() => {
                      setStep('connect');
                      setImportResult(null);
                      setSelectedTable('');
                      setMapping({});
                      setPreview(null);
                    }}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Import More
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
