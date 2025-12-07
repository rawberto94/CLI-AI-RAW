/**
 * API Keys Management Component
 * Secure management of API keys and access tokens
 */

'use client';

import { memo, useState, useEffect } from 'react';
import { 
  Key, 
  Plus, 
  Copy, 
  Trash2, 
  Eye, 
  EyeOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface ApiKey {
  id: string;
  name: string;
  keyPreview: string;
  permissions: string[];
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
  isActive: boolean;
}

interface ApiKeysManagerProps {
  tenantId?: string;
  className?: string;
}

const permissionOptions = [
  { value: 'read:contracts', label: 'Read Contracts' },
  { value: 'write:contracts', label: 'Write Contracts' },
  { value: 'delete:contracts', label: 'Delete Contracts' },
  { value: 'read:artifacts', label: 'Read Artifacts' },
  { value: 'write:artifacts', label: 'Write Artifacts' },
  { value: 'read:rate-cards', label: 'Read Rate Cards' },
  { value: 'write:rate-cards', label: 'Write Rate Cards' },
  { value: 'admin', label: 'Admin Access' },
];

export const ApiKeysManager = memo(function ApiKeysManager({
  tenantId = 'default',
  className,
}: ApiKeysManagerProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);
  const [newKeyData, setNewKeyData] = useState<{
    name: string;
    permissions: string[];
    expiresIn: string;
  }>({
    name: '',
    permissions: ['read:contracts'],
    expiresIn: '90',
  });
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  useEffect(() => {
    fetchApiKeys();
  }, [tenantId]);

  const fetchApiKeys = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings/api-keys');
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.keys || []);
      } else {
        // Mock data for demo
        setApiKeys([
          {
            id: 'key_1',
            name: 'Production API',
            keyPreview: 'sk_live_****abcd',
            permissions: ['read:contracts', 'write:contracts', 'read:artifacts'],
            createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            lastUsedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            isActive: true,
          },
          {
            id: 'key_2',
            name: 'Integration Webhook',
            keyPreview: 'sk_live_****efgh',
            permissions: ['read:contracts'],
            createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
            lastUsedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            isActive: true,
          },
        ]);
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const createApiKey = async () => {
    if (!newKeyData.name) {
      toast.error('Please enter a name for the API key');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newKeyData),
      });

      if (response.ok) {
        const data = await response.json();
        setNewKeySecret(data.secret);
        setApiKeys(prev => [data.key, ...prev]);
        toast.success('API key created successfully');
      } else {
        // Mock creation
        const mockKey = `sk_live_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
        setNewKeySecret(mockKey);
        setApiKeys(prev => [{
          id: `key_${Date.now()}`,
          name: newKeyData.name,
          keyPreview: `sk_live_****${mockKey.slice(-4)}`,
          permissions: newKeyData.permissions,
          createdAt: new Date().toISOString(),
          isActive: true,
        }, ...prev]);
        toast.success('API key created');
      }
    } catch (error) {
      toast.error('Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const deleteApiKey = async (keyId: string) => {
    try {
      await fetch(`/api/settings/api-keys/${keyId}`, { method: 'DELETE' });
      setApiKeys(prev => prev.filter(k => k.id !== keyId));
      toast.success('API key deleted');
    } catch (error) {
      toast.error('Failed to delete API key');
    }
    setDeleteKeyId(null);
  };

  const toggleKeyStatus = async (keyId: string, isActive: boolean) => {
    try {
      await fetch(`/api/settings/api-keys/${keyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      setApiKeys(prev => prev.map(k => 
        k.id === keyId ? { ...k, isActive } : k
      ));
      toast.success(`API key ${isActive ? 'activated' : 'deactivated'}`);
    } catch (error) {
      toast.error('Failed to update API key');
    }
  };

  const copyToClipboard = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(keyId);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return formatDate(dateString);
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-amber-600" />
                API Keys
              </CardTitle>
              <CardDescription className="mt-1">
                Manage API keys for external integrations and automation
              </CardDescription>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={(open) => {
              setShowCreateDialog(open);
              if (!open) {
                setNewKeySecret(null);
                setNewKeyData({ name: '', permissions: ['read:contracts'], expiresIn: '90' });
              }
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create API Key
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                {!newKeySecret ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>Create New API Key</DialogTitle>
                      <DialogDescription>
                        Create a new API key for external integrations
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Key Name</Label>
                        <Input
                          placeholder="e.g., Production API"
                          value={newKeyData.name}
                          onChange={(e) => setNewKeyData(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Permissions</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {permissionOptions.map(perm => (
                            <label key={perm.value} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={newKeyData.permissions.includes(perm.value)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNewKeyData(prev => ({
                                      ...prev,
                                      permissions: [...prev.permissions, perm.value],
                                    }));
                                  } else {
                                    setNewKeyData(prev => ({
                                      ...prev,
                                      permissions: prev.permissions.filter(p => p !== perm.value),
                                    }));
                                  }
                                }}
                                className="rounded"
                              />
                              {perm.label}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Expires In</Label>
                        <Select
                          value={newKeyData.expiresIn}
                          onValueChange={(value) => setNewKeyData(prev => ({ ...prev, expiresIn: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30">30 days</SelectItem>
                            <SelectItem value="90">90 days</SelectItem>
                            <SelectItem value="180">180 days</SelectItem>
                            <SelectItem value="365">1 year</SelectItem>
                            <SelectItem value="never">Never</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={createApiKey} disabled={creating}>
                        {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Create Key
                      </Button>
                    </DialogFooter>
                  </>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        API Key Created
                      </DialogTitle>
                      <DialogDescription>
                        Copy your API key now. You won't be able to see it again.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <div className="p-4 bg-slate-100 rounded-lg font-mono text-sm break-all">
                        {newKeySecret}
                      </div>
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700">
                          Store this key securely. It will only be shown once.
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button 
                        onClick={() => copyToClipboard(newKeySecret, 'new')}
                        className="gap-2"
                      >
                        <Copy className="h-4 w-4" />
                        Copy Key
                      </Button>
                      <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                        Done
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="text-center py-12">
              <Key className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-900">No API Keys</h3>
              <p className="text-sm text-slate-500 mt-1">
                Create an API key to integrate with external systems
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className={cn(
                    'p-4 rounded-lg border transition-colors',
                    key.isActive 
                      ? 'bg-white border-slate-200' 
                      : 'bg-slate-50 border-slate-200 opacity-60'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{key.name}</h4>
                        {!key.isActive && (
                          <Badge variant="secondary" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                        {key.expiresAt && new Date(key.expiresAt) < new Date() && (
                          <Badge variant="destructive" className="text-xs">
                            Expired
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <code className="px-2 py-0.5 bg-slate-100 rounded text-xs">
                          {key.keyPreview}
                        </code>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          Created {formatDate(key.createdAt)}
                        </span>
                        {key.lastUsedAt && (
                          <span>Last used {formatTimeAgo(key.lastUsedAt)}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {key.permissions.map(perm => (
                          <Badge key={perm} variant="outline" className="text-xs">
                            {perm}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={key.isActive}
                        onCheckedChange={(checked) => toggleKeyStatus(key.id, checked)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setDeleteKeyId(key.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteKeyId} onOpenChange={() => setDeleteKeyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this API key? Any integrations using
              this key will stop working immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteKeyId && deleteApiKey(deleteKeyId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
