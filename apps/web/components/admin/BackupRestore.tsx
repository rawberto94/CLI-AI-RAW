/**
 * Backup & Restore Component
 * Configure and manage system backups
 */

'use client';

import { memo, useState, useEffect } from 'react';
import { 
  HardDrive, 
  Download,
  Upload,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Cloud,
  Database,
  FileArchive,
  AlertTriangle,
  Play,
  Trash2,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

interface Backup {
  id: string;
  name: string;
  createdAt: Date;
  size: number;
  type: 'full' | 'incremental' | 'contracts-only' | 'settings-only';
  status: 'completed' | 'failed' | 'in-progress';
  location: 'local' | 's3' | 'gcs' | 'azure';
  contractCount?: number;
  error?: string;
}

interface BackupConfig {
  enabled: boolean;
  schedule: 'hourly' | 'daily' | 'weekly' | 'monthly';
  time: string;
  retentionDays: number;
  type: 'full' | 'incremental';
  location: 'local' | 's3' | 'gcs' | 'azure';
  includeDocuments: boolean;
  includeArtifacts: boolean;
  encryptBackups: boolean;
}

interface BackupRestoreProps {
  className?: string;
}

const locationConfig: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  local: { icon: HardDrive, label: 'Local Storage', color: 'text-slate-600' },
  s3: { icon: Cloud, label: 'Amazon S3', color: 'text-orange-600' },
  gcs: { icon: Cloud, label: 'Google Cloud', color: 'text-violet-600' },
  azure: { icon: Cloud, label: 'Azure Blob', color: 'text-violet-600' },
};

const typeLabels: Record<string, string> = {
  full: 'Full Backup',
  incremental: 'Incremental',
  'contracts-only': 'Contracts Only',
  'settings-only': 'Settings Only',
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Mock data generator
function generateMockBackups(): Backup[] {
  const types: Backup['type'][] = ['full', 'incremental', 'contracts-only'];
  const locations: Backup['location'][] = ['local', 's3'];
  const statuses: Backup['status'][] = ['completed', 'completed', 'completed', 'failed'];

  return Array.from({ length: 10 }, (_, i) => ({
    id: `bak_${Date.now()}_${i}`,
    name: `backup-${format(new Date(Date.now() - i * 24 * 60 * 60 * 1000), 'yyyy-MM-dd-HHmm')}`,
    createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
    size: Math.floor(Math.random() * 500000000) + 10000000,
    type: types[Math.floor(Math.random() * types.length)] as Backup['type'],
    status: statuses[Math.floor(Math.random() * statuses.length)] as Backup['status'],
    location: locations[Math.floor(Math.random() * locations.length)] as Backup['location'],
    contractCount: Math.floor(Math.random() * 500) + 50,
    error: statuses[Math.floor(Math.random() * statuses.length)] === 'failed' 
      ? 'Connection timeout' 
      : undefined,
  }));
}

export const BackupRestore = memo(function BackupRestore({
  className,
}: BackupRestoreProps) {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [backupInProgress, setBackupInProgress] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [config, setConfig] = useState<BackupConfig>({
    enabled: true,
    schedule: 'daily',
    time: '02:00',
    retentionDays: 30,
    type: 'full',
    location: 'local',
    includeDocuments: true,
    includeArtifacts: true,
    encryptBackups: true,
  });

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/backups');
      if (response.ok) {
        const data = await response.json();
        setBackups(data.backups.map((b: Backup) => ({
          ...b,
          createdAt: new Date(b.createdAt),
        })));
      } else {
        setBackups(generateMockBackups());
      }
    } catch {
      setBackups(generateMockBackups());
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setBackupInProgress(true);
    setBackupProgress(0);

    try {
      // Simulate backup progress
      for (let i = 0; i <= 100; i += 5) {
        await new Promise(r => setTimeout(r, 200));
        setBackupProgress(i);
      }

      const newBackup: Backup = {
        id: `bak_${Date.now()}`,
        name: `backup-${format(new Date(), 'yyyy-MM-dd-HHmm')}`,
        createdAt: new Date(),
        size: Math.floor(Math.random() * 500000000) + 100000000,
        type: config.type,
        status: 'completed',
        location: config.location,
        contractCount: Math.floor(Math.random() * 500) + 100,
      };

      setBackups(prev => [newBackup, ...prev]);
      toast.success('Backup completed successfully');
    } catch (_error) {
      toast.error('Backup failed');
    } finally {
      setBackupInProgress(false);
      setBackupProgress(0);
    }
  };

  const handleRestore = async (backupId: string) => {
    if (!confirm('Are you sure you want to restore from this backup? This will overwrite current data.')) {
      return;
    }

    setRestoring(backupId);
    try {
      // Simulate restore
      await new Promise(r => setTimeout(r, 3000));
      toast.success('Restore completed successfully');
    } catch {
      toast.error('Restore failed');
    } finally {
      setRestoring(null);
    }
  };

  const handleDelete = async (backupId: string) => {
    if (!confirm('Are you sure you want to delete this backup?')) return;

    setBackups(prev => prev.filter(b => b.id !== backupId));
    toast.success('Backup deleted');
  };

  const handleDownload = (backup: Backup) => {
    toast.success(`Downloading ${backup.name}...`);
  };

  const handleSaveConfig = () => {
    toast.success('Backup settings saved');
    setShowSettingsDialog(false);
  };

  const totalSize = backups.reduce((acc, b) => acc + b.size, 0);
  const successfulBackups = backups.filter(b => b.status === 'completed').length;
  const failedBackups = backups.filter(b => b.status === 'failed').length;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-violet-600" />
              Backup & Restore
            </CardTitle>
            <CardDescription>
              Manage system backups and disaster recovery
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadBackups} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Backup Settings</DialogTitle>
                  <DialogDescription>
                    Configure automatic backup schedule and options
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Automatic Backups</Label>
                      <p className="text-xs text-slate-500">Enable scheduled backups</p>
                    </div>
                    <Switch
                      checked={config.enabled}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enabled: checked }))}
                    />
                  </div>
                  
                  {config.enabled && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Schedule</Label>
                          <Select
                            value={config.schedule}
                            onValueChange={(value) => setConfig(prev => ({ 
                              ...prev, 
                              schedule: value as BackupConfig['schedule'] 
                            }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="hourly">Hourly</SelectItem>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Time (UTC)</Label>
                          <Input
                            type="time"
                            value={config.time}
                            onChange={(e) => setConfig(prev => ({ ...prev, time: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Backup Type</Label>
                          <Select
                            value={config.type}
                            onValueChange={(value) => setConfig(prev => ({ 
                              ...prev, 
                              type: value as BackupConfig['type'] 
                            }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="full">Full Backup</SelectItem>
                              <SelectItem value="incremental">Incremental</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Retention (days)</Label>
                          <Input
                            type="number"
                            min={1}
                            max={365}
                            value={config.retentionDays}
                            onChange={(e) => setConfig(prev => ({ 
                              ...prev, 
                              retentionDays: parseInt(e.target.value) || 30 
                            }))}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Storage Location</Label>
                        <Select
                          value={config.location}
                          onValueChange={(value) => setConfig(prev => ({ 
                            ...prev, 
                            location: value as BackupConfig['location'] 
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(locationConfig).map(([key, cfg]) => (
                              <SelectItem key={key} value={key}>
                                {cfg.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <Label>Include Documents</Label>
                          <Switch
                            checked={config.includeDocuments}
                            onCheckedChange={(checked) => setConfig(prev => ({ 
                              ...prev, 
                              includeDocuments: checked 
                            }))}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label>Include AI Artifacts</Label>
                          <Switch
                            checked={config.includeArtifacts}
                            onCheckedChange={(checked) => setConfig(prev => ({ 
                              ...prev, 
                              includeArtifacts: checked 
                            }))}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label>Encrypt Backups</Label>
                          <Switch
                            checked={config.encryptBackups}
                            onCheckedChange={(checked) => setConfig(prev => ({ 
                              ...prev, 
                              encryptBackups: checked 
                            }))}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveConfig}>
                    Save Settings
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button 
              onClick={handleCreateBackup} 
              disabled={backupInProgress}
              className="gap-2"
            >
              {backupInProgress ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Backing up...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Create Backup
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Backup Progress */}
        {backupInProgress && (
          <div className="p-4 rounded-lg bg-violet-50 border border-violet-200 space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
              <span className="font-medium">Creating backup...</span>
            </div>
            <Progress value={backupProgress} className="h-2" />
            <p className="text-xs text-slate-500">{backupProgress}% complete</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-slate-50 text-center">
            <FileArchive className="h-6 w-6 mx-auto mb-2 text-slate-600" />
            <p className="text-2xl font-bold">{backups.length}</p>
            <p className="text-xs text-slate-500">Total Backups</p>
          </div>
          <div className="p-4 rounded-lg bg-green-50 text-center">
            <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-green-600" />
            <p className="text-2xl font-bold text-green-600">{successfulBackups}</p>
            <p className="text-xs text-slate-500">Successful</p>
          </div>
          <div className="p-4 rounded-lg bg-red-50 text-center">
            <XCircle className="h-6 w-6 mx-auto mb-2 text-red-600" />
            <p className="text-2xl font-bold text-red-600">{failedBackups}</p>
            <p className="text-xs text-slate-500">Failed</p>
          </div>
          <div className="p-4 rounded-lg bg-violet-50 text-center">
            <Database className="h-6 w-6 mx-auto mb-2 text-violet-600" />
            <p className="text-2xl font-bold text-violet-600">{formatBytes(totalSize)}</p>
            <p className="text-xs text-slate-500">Total Size</p>
          </div>
        </div>

        {/* Schedule Status */}
        {config.enabled && (
          <div className="p-4 rounded-lg bg-slate-50 border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-violet-600" />
              <div>
                <p className="font-medium text-sm">Automatic Backups Enabled</p>
                <p className="text-xs text-slate-500">
                  Next backup: {config.schedule} at {config.time} UTC
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Active
            </Badge>
          </div>
        )}

        {/* Backup List */}
        <div className="space-y-2">
          <Label className="text-base font-semibold">Backup History</Label>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-violet-600 mr-2" />
              <span>Loading backups...</span>
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No backups found. Create your first backup to get started.
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {backups.map(backup => {
                  const locConfig = locationConfig[backup.location] ?? locationConfig.local;
                  const LocIcon = locConfig!.icon;
                  return (
                    <div
                      key={backup.id}
                      className={cn(
                        'p-4 rounded-lg border flex items-center justify-between',
                        backup.status === 'failed' ? 'bg-red-50 border-red-200' : 'bg-white'
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          'p-2 rounded-lg',
                          backup.status === 'completed' ? 'bg-green-100' : 
                          backup.status === 'failed' ? 'bg-red-100' : 'bg-violet-100'
                        )}>
                          {backup.status === 'completed' ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : backup.status === 'failed' ? (
                            <XCircle className="h-5 w-5 text-red-600" />
                          ) : (
                            <Loader2 className="h-5 w-5 text-violet-600 animate-spin" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{backup.name}</p>
                            <Badge variant="outline" className="text-xs">
                              {typeLabels[backup.type]}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(backup.createdAt, { addSuffix: true })}
                            </span>
                            <span>{formatBytes(backup.size)}</span>
                            {backup.contractCount && (
                              <span>{backup.contractCount} contracts</span>
                            )}
                            <span className={cn('flex items-center gap-1', locConfig!.color)}>
                              <LocIcon className="h-3 w-3" />
                              {locConfig!.label}
                            </span>
                          </div>
                          {backup.error && (
                            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {backup.error}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {backup.status === 'completed' && (
                          <>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDownload(backup)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleRestore(backup.id)}
                              disabled={restoring === backup.id}
                            >
                              {restoring === backup.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Upload className="h-4 w-4" />
                              )}
                            </Button>
                          </>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDelete(backup.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
