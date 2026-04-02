"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PageBreadcrumb } from "@/components/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  FolderSync,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  FileText,
  FolderOpen,
  Cloud,
  Server,
  HardDrive,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// Provider icons and info
const PROVIDERS = {
  SHAREPOINT: { name: "SharePoint", icon: Cloud, color: "text-violet-600" },
  ONEDRIVE: { name: "OneDrive", icon: Cloud, color: "text-violet-500" },
  GOOGLE_DRIVE: { name: "Google Drive", icon: Cloud, color: "text-green-600" },
  AZURE_BLOB: { name: "Azure Blob", icon: HardDrive, color: "text-violet-600" },
  AWS_S3: { name: "Amazon S3", icon: HardDrive, color: "text-orange-600" },
  SFTP: { name: "SFTP", icon: Server, color: "text-gray-600" },
  FTP: { name: "FTP", icon: Server, color: "text-gray-500" },
  DROPBOX: { name: "Dropbox", icon: Cloud, color: "text-violet-400" },
  BOX: { name: "Box", icon: Cloud, color: "text-violet-700" },
  CUSTOM_API: { name: "Custom API", icon: Server, color: "text-violet-600" },
};

const STATUS_BADGES = {
  CONNECTED: { label: "Connected", variant: "default" as const, icon: CheckCircle2, color: "text-green-600" },
  DISCONNECTED: { label: "Disconnected", variant: "secondary" as const, icon: XCircle, color: "text-gray-500" },
  SYNCING: { label: "Syncing", variant: "default" as const, icon: Loader2, color: "text-violet-600" },
  ERROR: { label: "Error", variant: "destructive" as const, icon: AlertCircle, color: "text-red-600" },
  AUTH_EXPIRED: { label: "Auth Expired", variant: "destructive" as const, icon: Clock, color: "text-yellow-600" },
};

interface ContractSource {
  id: string;
  name: string;
  description?: string;
  provider: keyof typeof PROVIDERS;
  status: keyof typeof STATUS_BADGES;
  syncFolder?: string;
  syncInterval: number;
  syncEnabled: boolean;
  autoProcess: boolean;
  lastSyncAt?: string;
  totalFilesSynced: number;
  accountEmail?: string;
  accountName?: string;
  lastErrorMessage?: string;
  _count?: {
    syncedFiles: number;
  };
}

interface SyncHistory {
  id: string;
  status: string;
  syncMode: string;
  triggeredBy?: string;
  filesFound: number;
  filesProcessed: number;
  filesSkipped: number;
  filesFailed: number;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  errorMessage?: string;
}

export default function ContractSourcesPage() {
  const [sources, setSources] = useState<ContractSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSource, setSelectedSource] = useState<ContractSource | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [_isTestingConnection, setIsTestingConnection] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);

  // Fetch sources
  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch("/api/contract-sources");
      const data = await res.json();
      if (data.success) {
        const sourcesData = data.data?.sources;
        setSources(Array.isArray(sourcesData) ? sourcesData : []);
      }
    } catch {
      toast.error("Failed to fetch contract sources");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  // Test connection
  const handleTestConnection = async (sourceId: string) => {
    setIsTestingConnection(sourceId);
    try {
      const res = await fetch("/api/contract-sources/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId }),
      });
      const data = await res.json();
      if (data.success && data.data.connected) {
        toast.success("Connection successful!");
        fetchSources();
      } else {
        toast.error(data.data?.error || "Connection failed");
      }
    } catch {
      toast.error("Failed to test connection");
    } finally {
      setIsTestingConnection(null);
    }
  };

  // Trigger sync
  const handleSync = async (sourceId: string) => {
    setIsSyncing(sourceId);
    try {
      const res = await fetch("/api/contract-sources/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          `Sync completed: ${data.data.progress.filesProcessed} files processed`
        );
        fetchSources();
      } else {
        toast.error(data.error || "Sync failed");
      }
    } catch {
      toast.error("Failed to start sync");
    } finally {
      setIsSyncing(null);
    }
  };

  // Delete source
  const handleDelete = async (sourceId: string) => {
    if (!confirm("Are you sure you want to delete this source?")) return;
    
    try {
      const res = await fetch(`/api/contract-sources?id=${sourceId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Source deleted");
        fetchSources();
      } else {
        toast.error("Failed to delete source");
      }
    } catch {
      toast.error("Failed to delete source");
    }
  };

  // Toggle sync enabled
  const handleToggleSync = async (source: ContractSource) => {
    try {
      const res = await fetch("/api/contract-sources", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: source.id,
          syncEnabled: !source.syncEnabled,
        }),
      });
      if (res.ok) {
        toast.success(source.syncEnabled ? "Sync disabled" : "Sync enabled");
        fetchSources();
      }
    } catch {
      toast.error("Failed to update source");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-purple-950">
      <div className="max-w-[1600px] mx-auto px-4 py-8 max-w-[1600px]">
        <PageBreadcrumb
          items={[
            { label: "Settings", href: "/settings" },
            { label: "Contract Sources", href: "/settings/contract-sources" },
          ]}
        />

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Contract Sources
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Connect to external systems to automatically sync contracts
            </p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Source
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-violet-100 dark:bg-violet-900 rounded-lg">
                  <FolderSync className="w-6 h-6 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total Sources</p>
                  <p className="text-2xl font-bold">{sources.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Connected</p>
                  <p className="text-2xl font-bold">
                    {sources.filter((s) => s.status === "CONNECTED").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-violet-100 dark:bg-violet-900 rounded-lg">
                  <FileText className="w-6 h-6 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Files Synced</p>
                  <p className="text-2xl font-bold">
                    {sources.reduce((sum, s) => sum + s.totalFilesSynced, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 dark:bg-red-900 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Errors</p>
                  <p className="text-2xl font-bold">
                    {sources.filter((s) => s.status === "ERROR").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sources Table */}
        <Card>
          <CardHeader>
            <CardTitle>Configured Sources</CardTitle>
            <CardDescription>
              Manage your contract source connections and sync settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
              </div>
            ) : sources.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                  No sources configured
                </h3>
                <p className="text-slate-500 mb-4">
                  Connect to SharePoint, S3, or other storage to start syncing contracts
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Source
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead>Files</TableHead>
                    <TableHead>Auto-Sync</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.map((source) => {
                    const provider = PROVIDERS[source.provider];
                    const status = STATUS_BADGES[source.status];
                    const ProviderIcon = provider?.icon || Cloud;
                    const StatusIcon = status?.icon || XCircle;

                    return (
                      <TableRow key={source.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{source.name}</p>
                            {source.syncFolder && (
                              <p className="text-sm text-slate-500">
                                {source.syncFolder}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <ProviderIcon
                              className={`w-4 h-4 ${provider?.color}`}
                            />
                            <span>{provider?.name || source.provider}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={status?.variant}>
                            <StatusIcon
                              className={`w-3 h-3 mr-1 ${
                                source.status === "SYNCING" ? "animate-spin" : ""
                              }`}
                            />
                            {status?.label || source.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {source.lastSyncAt ? (
                            <span className="text-sm">
                              {formatDistanceToNow(new Date(source.lastSyncAt), {
                                addSuffix: true,
                              })}
                            </span>
                          ) : (
                            <span className="text-slate-400">Never</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">
                            {source.totalFilesSynced}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={source.syncEnabled}
                            onCheckedChange={() => handleToggleSync(source)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSync(source.id)}
                              disabled={
                                isSyncing === source.id ||
                                source.status === "SYNCING"
                              }
                            >
                              {isSyncing === source.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RefreshCw className="w-4 h-4" />
                              )}
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleTestConnection(source.id)}
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  Test Connection
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setSelectedSource(source)}
                                >
                                  <Settings2 className="w-4 h-4 mr-2" />
                                  Settings
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => handleDelete(source.id)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create Source Dialog */}
        <CreateSourceDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onCreated={() => {
            fetchSources();
            setIsCreateDialogOpen(false);
          }}
        />

        {/* Source Settings Dialog */}
        {selectedSource && (
          <SourceSettingsDialog
            source={selectedSource}
            open={!!selectedSource}
            onOpenChange={(open) => !open && setSelectedSource(null)}
            onUpdated={() => {
              fetchSources();
              setSelectedSource(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

// Create Source Dialog Component
function CreateSourceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [provider, setProvider] = useState<string>("");
  const [name, setName] = useState("");
  const [syncFolder, setSyncFolder] = useState("/");
  const [isCreating, setIsCreating] = useState(false);

  // Provider-specific credentials
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  const handleCreate = async () => {
    if (!provider || !name) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/contract-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          provider,
          credentials: { type: provider.toLowerCase(), ...credentials },
          syncFolder,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Source created successfully");
        onCreated();
      } else {
        toast.error(data.error || "Failed to create source");
      }
    } catch {
      toast.error("Failed to create source");
    } finally {
      setIsCreating(false);
    }
  };

  const renderCredentialFields = () => {
    switch (provider) {
      case "SHAREPOINT":
      case "ONEDRIVE":
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="tenantId">Azure AD Tenant ID</Label>
              <Input
                id="tenantId"
                value={credentials.tenantId || ""}
                onChange={(e) =>
                  setCredentials({ ...credentials, tenantId: e.target.value })
                }
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientId">Client ID</Label>
              <Input
                id="clientId"
                value={credentials.clientId || ""}
                onChange={(e) =>
                  setCredentials({ ...credentials, clientId: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientSecret">Client Secret</Label>
              <Input
                id="clientSecret"
                type="password"
                value={credentials.clientSecret || ""}
                onChange={(e) =>
                  setCredentials({ ...credentials, clientSecret: e.target.value })
                }
              />
            </div>
            {provider === "SHAREPOINT" && (
              <div className="space-y-2">
                <Label htmlFor="siteUrl">SharePoint Site URL</Label>
                <Input
                  id="siteUrl"
                  value={credentials.siteUrl || ""}
                  onChange={(e) =>
                    setCredentials({ ...credentials, siteUrl: e.target.value })
                  }
                  placeholder="https://company.sharepoint.com/sites/contracts"
                />
              </div>
            )}
          </>
        );
      case "AZURE_BLOB":
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="accountName">Storage Account Name</Label>
              <Input
                id="accountName"
                value={credentials.accountName || ""}
                onChange={(e) =>
                  setCredentials({ ...credentials, accountName: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="containerName">Container Name</Label>
              <Input
                id="containerName"
                value={credentials.containerName || ""}
                onChange={(e) =>
                  setCredentials({ ...credentials, containerName: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountKey">Account Key</Label>
              <Input
                id="accountKey"
                type="password"
                value={credentials.accountKey || ""}
                onChange={(e) =>
                  setCredentials({ ...credentials, accountKey: e.target.value })
                }
              />
            </div>
          </>
        );
      case "AWS_S3":
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="bucket">Bucket Name</Label>
              <Input
                id="bucket"
                value={credentials.bucket || ""}
                onChange={(e) =>
                  setCredentials({ ...credentials, bucket: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Input
                id="region"
                value={credentials.region || ""}
                onChange={(e) =>
                  setCredentials({ ...credentials, region: e.target.value })
                }
                placeholder="eu-central-1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accessKeyId">Access Key ID</Label>
              <Input
                id="accessKeyId"
                value={credentials.accessKeyId || ""}
                onChange={(e) =>
                  setCredentials({ ...credentials, accessKeyId: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secretAccessKey">Secret Access Key</Label>
              <Input
                id="secretAccessKey"
                type="password"
                value={credentials.secretAccessKey || ""}
                onChange={(e) =>
                  setCredentials({ ...credentials, secretAccessKey: e.target.value })
                }
              />
            </div>
          </>
        );
      case "SFTP":
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="host">Host</Label>
              <Input
                id="host"
                value={credentials.host || ""}
                onChange={(e) =>
                  setCredentials({ ...credentials, host: e.target.value })
                }
                placeholder="sftp.company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                value={credentials.port || "22"}
                onChange={(e) =>
                  setCredentials({ ...credentials, port: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={credentials.username || ""}
                onChange={(e) =>
                  setCredentials({ ...credentials, username: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={credentials.password || ""}
                onChange={(e) =>
                  setCredentials({ ...credentials, password: e.target.value })
                }
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Contract Source</DialogTitle>
          <DialogDescription>
            Connect to an external system to automatically sync contracts
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="provider">Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger>
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROVIDERS).map(([key, info]) => {
                  const Icon = info.icon;
                  return (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${info.color}`} />
                        {info.name}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Company Contracts Drive"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="syncFolder">Sync Folder Path</Label>
            <Input
              id="syncFolder"
              value={syncFolder}
              onChange={(e) => setSyncFolder(e.target.value)}
              placeholder="/contracts"
            />
          </div>

          {provider && (
            <div className="border-t pt-4 space-y-4">
              <h4 className="font-medium">Connection Credentials</h4>
              {renderCredentialFields()}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Source
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Source Settings Dialog Component
function SourceSettingsDialog({
  source,
  open,
  onOpenChange,
  onUpdated,
}: {
  source: ContractSource;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const [name, setName] = useState(source.name);
  const [syncFolder, setSyncFolder] = useState(source.syncFolder || "/");
  const [syncInterval, setSyncInterval] = useState(source.syncInterval);
  const [autoProcess, setAutoProcess] = useState(source.autoProcess);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/contract-sources", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: source.id,
          name,
          syncFolder,
          syncInterval,
          autoProcess,
        }),
      });
      if (res.ok) {
        toast.success("Settings saved");
        onUpdated();
      } else {
        toast.error("Failed to save settings");
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Source Settings</DialogTitle>
          <DialogDescription>Configure sync settings for {source.name}</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="general" className="py-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="history">Sync History</TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-folder">Sync Folder</Label>
              <Input
                id="edit-folder"
                value={syncFolder}
                onChange={(e) => setSyncFolder(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-interval">Sync Interval (minutes)</Label>
              <Input
                id="edit-interval"
                type="number"
                min={5}
                max={1440}
                value={syncInterval}
                onChange={(e) => setSyncInterval(parseInt(e.target.value, 10))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-Process</Label>
                <p className="text-sm text-slate-500">
                  Automatically extract data from synced contracts
                </p>
              </div>
              <Switch checked={autoProcess} onCheckedChange={setAutoProcess} />
            </div>
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            <SyncHistoryList sourceId={source.id} />
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Sync History List Component
function SyncHistoryList({ sourceId }: { sourceId: string }) {
  const [history, setHistory] = useState<SyncHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch(`/api/contract-sources/sync?sourceId=${sourceId}`);
        const data = await res.json();
        if (data.success) {
          setHistory(data.data.syncs);
        }
      } catch (error) {
        console.error("Failed to fetch sync history:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchHistory();
  }, [sourceId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        No sync history yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((sync) => (
        <div
          key={sync.id}
          className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800"
        >
          <div>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  sync.status === "COMPLETED"
                    ? "default"
                    : sync.status === "FAILED"
                    ? "destructive"
                    : "secondary"
                }
              >
                {sync.status}
              </Badge>
              <span className="text-sm text-slate-500">
                {formatDistanceToNow(new Date(sync.startedAt), { addSuffix: true })}
              </span>
            </div>
            <p className="text-sm mt-1">
              {sync.filesProcessed} processed, {sync.filesSkipped || 0} skipped,{" "}
              {sync.filesFailed} failed
            </p>
          </div>
          <div className="text-right text-sm text-slate-500">
            {sync.duration && <span>{(sync.duration / 1000).toFixed(1)}s</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
