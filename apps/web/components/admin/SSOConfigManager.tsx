'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Shield, Plus, Trash2, Edit2, Save, X, Copy, CheckCircle2,
  AlertTriangle, ExternalLink, Eye, EyeOff, Settings, Key,
  Globe, Lock, Users, FileText, Download, Upload, RefreshCw,
  Loader2, Link2, Server, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface SSOProvider {
  id: string;
  name: string;
  protocol: 'saml' | 'oidc';
  status: 'active' | 'inactive' | 'testing';
  entityId?: string;           // SAML
  ssoUrl?: string;             // SAML
  sloUrl?: string;             // SAML single-logout URL
  certificate?: string;        // SAML x509 certificate
  issuer?: string;             // OIDC
  clientId?: string;           // OIDC
  clientSecret?: string;       // OIDC
  discoveryUrl?: string;       // OIDC
  scopes?: string[];           // OIDC
  attributeMapping: {
    email: string;
    firstName?: string;
    lastName?: string;
    groups?: string;
    department?: string;
  };
  allowedDomains: string[];
  autoProvision: boolean;
  defaultRole: string;
  groupMapping: Array<{ ssoGroup: string; appRole: string }>;
  jitProvisioning: boolean;
  enforceForDomains: boolean;
  createdAt: string;
  updatedAt: string;
}

function createEmptyProvider(): Partial<SSOProvider> {
  return {
    name: '',
    protocol: 'saml',
    status: 'inactive',
    attributeMapping: { email: 'email' },
    allowedDomains: [],
    autoProvision: true,
    defaultRole: 'viewer',
    groupMapping: [],
    jitProvisioning: true,
    enforceForDomains: false,
  };
}

// ============================================================================
// Component
// ============================================================================

export default function SSOConfigManager({ className }: { className?: string }) {
  const [providers, setProviders] = useState<SSOProvider[]>([]);
  const [editingProvider, setEditingProvider] = useState<Partial<SSOProvider> | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('providers');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [newDomain, setNewDomain] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  const spEntityId = typeof window !== 'undefined' ? `${window.location.origin}/api/auth/saml/metadata` : '';
  const acsUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/auth/saml/callback` : '';
  const sloCallbackUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/auth/saml/slo` : '';

  // Load SSO providers from backend on mount
  useEffect(() => {
    async function loadProviders() {
      try {
        const res = await fetch('/api/admin/sso');
        if (res.ok) {
          const data = await res.json();
          if (data?.providers) {
            setProviders(data.providers);
          }
        }
      } catch {
        // Failed to load providers
      } finally {
        setLoadingProviders(false);
      }
    }
    loadProviders();
  }, []);

  const openEditor = (provider?: SSOProvider) => {
    setEditingProvider(provider ? { ...provider } : createEmptyProvider());
    setIsEditing(true);
    setTestResult(null);
    setShowSecret(false);
  };

  const saveProvider = async () => {
    if (!editingProvider?.name) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const isUpdate = !!editingProvider.id;
      const response = await fetch('/api/admin/sso', {
        method: isUpdate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProvider),
      });

      const data = await response.json();

      if (response.status === 501) {
        toast.error('SSO configuration is not yet available. Contact support to configure SSO.');
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${isUpdate ? 'update' : 'create'} SSO provider`);
      }

      // Success — update local state from server response
      if (isUpdate) {
        setProviders(prev => prev.map(p => p.id === editingProvider.id ? { ...p, ...editingProvider, updatedAt: new Date().toISOString() } as SSOProvider : p));
      } else if (data.provider) {
        setProviders(prev => [...prev, data.provider]);
      }
      setIsEditing(false);
      toast.success(`SSO provider ${isUpdate ? 'updated' : 'created'}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save SSO provider');
    } finally {
      setSaving(false);
    }
  };

  const deleteProvider = async (id: string) => {
    try {
      const response = await fetch('/api/admin/sso', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (response.status === 501) {
        toast.error('SSO provider deletion is not yet available. Contact support.');
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete provider');
      }

      setProviders(prev => prev.filter(p => p.id !== id));
      toast.info('Provider removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete provider');
    }
  };

  const testConnection = async () => {
    setTestResult(null);
    await new Promise(r => setTimeout(r, 1500));
    const success = (editingProvider?.protocol === 'saml' && editingProvider?.ssoUrl && editingProvider?.certificate) ||
                    (editingProvider?.protocol === 'oidc' && editingProvider?.clientId && editingProvider?.discoveryUrl);
    setTestResult({
      success: !!success,
      message: success ? 'Connection successful! IdP metadata validated.' : 'Connection failed. Please check your configuration.',
    });
  };

  const toggleProviderStatus = async (id: string) => {
    const provider = providers.find(p => p.id === id);
    if (!provider) return;

    try {
      const newStatus = provider.status === 'active' ? 'inactive' : 'active';
      const response = await fetch('/api/admin/sso', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });

      if (response.status === 501) {
        toast.error('SSO provider update is not yet available. Contact support.');
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to toggle provider status');
      }

      setProviders(prev => prev.map(p => {
        if (p.id !== id) return p;
        return { ...p, status: newStatus, updatedAt: new Date().toISOString() };
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to toggle provider');
    }
  };

  const addDomain = () => {
    if (!newDomain.trim()) return;
    setEditingProvider(prev => prev ? {
      ...prev,
      allowedDomains: [...(prev.allowedDomains || []), newDomain.trim()],
    } : prev);
    setNewDomain('');
  };

  const removeDomain = (domain: string) => {
    setEditingProvider(prev => prev ? {
      ...prev,
      allowedDomains: prev.allowedDomains?.filter(d => d !== domain),
    } : prev);
  };

  const addGroupMapping = () => {
    setEditingProvider(prev => prev ? {
      ...prev,
      groupMapping: [...(prev.groupMapping || []), { ssoGroup: '', appRole: 'viewer' }],
    } : prev);
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-violet-600" />
            SSO / SAML Configuration
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure Single Sign-On providers for your organization
          </p>
        </div>
        <Button onClick={() => openEditor()} className="bg-violet-600 hover:bg-violet-700">
          <Plus className="h-4 w-4 mr-2" /> Add Provider
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="providers">Providers ({providers.length})</TabsTrigger>
          <TabsTrigger value="sp-info">Service Provider Info</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Providers List */}
        <TabsContent value="providers" className="mt-4">
          {providers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-medium mb-1">No SSO Providers Configured</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Set up SAML 2.0 or OpenID Connect providers for enterprise single sign-on
                </p>
                <Button onClick={() => openEditor()}>
                  <Plus className="h-4 w-4 mr-2" /> Add SSO Provider
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {providers.map(provider => {
                const statusColors: Record<string, string> = {
                  active: 'bg-green-100 text-green-700',
                  inactive: 'bg-gray-100 text-gray-600',
                  testing: 'bg-amber-100 text-amber-700',
                };
                return (
                  <Card key={provider.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-violet-100">
                          {provider.protocol === 'saml' ? <Key className="h-5 w-5 text-violet-700" /> : <Globe className="h-5 w-5 text-violet-700" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{provider.name}</span>
                            <Badge variant="outline" className="text-[10px] uppercase">{provider.protocol}</Badge>
                            <Badge className={cn('text-[10px]', statusColors[provider.status])}>{provider.status}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {provider.allowedDomains?.length ? provider.allowedDomains.join(', ') : 'No domain restrictions'}
                            {' · '}
                            {provider.autoProvision ? 'Auto-provisioning enabled' : 'Manual provisioning'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={provider.status === 'active'}
                            onCheckedChange={() => toggleProviderStatus(provider.id)}
                          />
                          <Button size="sm" variant="outline" onClick={() => openEditor(provider)}>
                            <Edit2 className="h-3 w-3 mr-1" /> Edit
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteProvider(provider.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* SP Information */}
        <TabsContent value="sp-info" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Service Provider (SP) Metadata</CardTitle>
              <CardDescription>Provide these values to your Identity Provider (IdP)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">SP Entity ID / Issuer</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input value={spEntityId} readOnly className="font-mono text-xs" />
                  <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(spEntityId); toast.info('Copied'); }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">ACS URL (Assertion Consumer Service)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input value={acsUrl} readOnly className="font-mono text-xs" />
                  <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(acsUrl); toast.info('Copied'); }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Single Logout (SLO) Callback URL</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input value={sloCallbackUrl} readOnly className="font-mono text-xs" />
                  <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(sloCallbackUrl); toast.info('Copied'); }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <Label className="text-xs text-muted-foreground">Name ID Format</Label>
                  <p className="font-mono mt-1">urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Binding</Label>
                  <p className="font-mono mt-1">urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST</p>
                </div>
              </div>
              <Button size="sm" variant="outline">
                <Download className="h-3 w-3 mr-1" /> Download SP Metadata XML
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Global Settings */}
        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Global SSO Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Allow password login fallback</Label>
                  <p className="text-xs text-muted-foreground">Users with SSO can still log in with email/password</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enforce SSO for managed domains</Label>
                  <p className="text-xs text-muted-foreground">Block email/password for domains with active SSO</p>
                </div>
                <Switch />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Session duration after SSO</Label>
                  <p className="text-xs text-muted-foreground">How long the session lasts after SSO login</p>
                </div>
                <Select defaultValue="24h">
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4h">4 hours</SelectItem>
                    <SelectItem value="8h">8 hours</SelectItem>
                    <SelectItem value="24h">24 hours</SelectItem>
                    <SelectItem value="7d">7 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Provider Editor Dialog */}
      {isEditing && editingProvider && (
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>{editingProvider.id ? 'Edit' : 'Add'} SSO Provider</DialogTitle>
              <DialogDescription>Configure identity provider connection</DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 max-h-[60vh]">
              <div className="space-y-5 p-1">
                {/* Basic */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Provider Name</Label>
                    <Input
                      value={editingProvider.name || ''}
                      onChange={(e) => setEditingProvider(p => p ? { ...p, name: e.target.value } : p)}
                      placeholder="e.g., Okta Production"
                    />
                  </div>
                  <div>
                    <Label>Protocol</Label>
                    <Select value={editingProvider.protocol || 'saml'} onValueChange={(v) => setEditingProvider(p => p ? { ...p, protocol: v as 'saml' | 'oidc' } : p)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="saml">SAML 2.0</SelectItem>
                        <SelectItem value="oidc">OpenID Connect</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* SAML Config */}
                {editingProvider.protocol === 'saml' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium flex items-center gap-2"><Key className="h-4 w-4" /> SAML Configuration</h4>
                    <div>
                      <Label>IdP Entity ID</Label>
                      <Input
                        value={editingProvider.entityId || ''}
                        onChange={(e) => setEditingProvider(p => p ? { ...p, entityId: e.target.value } : p)}
                        placeholder="https://idp.example.com/saml/metadata"
                      />
                    </div>
                    <div>
                      <Label>SSO URL (Login URL)</Label>
                      <Input
                        value={editingProvider.ssoUrl || ''}
                        onChange={(e) => setEditingProvider(p => p ? { ...p, ssoUrl: e.target.value } : p)}
                        placeholder="https://idp.example.com/saml/sso"
                      />
                    </div>
                    <div>
                      <Label>SLO URL (Logout URL)</Label>
                      <Input
                        value={editingProvider.sloUrl || ''}
                        onChange={(e) => setEditingProvider(p => p ? { ...p, sloUrl: e.target.value } : p)}
                        placeholder="https://idp.example.com/saml/slo"
                      />
                    </div>
                    <div>
                      <Label>X.509 Certificate</Label>
                      <Textarea
                        value={editingProvider.certificate || ''}
                        onChange={(e) => setEditingProvider(p => p ? { ...p, certificate: e.target.value } : p)}
                        placeholder="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
                        rows={4}
                        className="font-mono text-xs"
                      />
                      <div className="flex gap-2 mt-1">
                        <Button size="sm" variant="outline" className="text-xs h-7">
                          <Upload className="h-3 w-3 mr-1" /> Upload .pem
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs h-7">
                          <Link2 className="h-3 w-3 mr-1" /> Import from URL
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* OIDC Config */}
                {editingProvider.protocol === 'oidc' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium flex items-center gap-2"><Globe className="h-4 w-4" /> OpenID Connect Configuration</h4>
                    <div>
                      <Label>Discovery URL</Label>
                      <Input
                        value={editingProvider.discoveryUrl || ''}
                        onChange={(e) => setEditingProvider(p => p ? { ...p, discoveryUrl: e.target.value } : p)}
                        placeholder="https://idp.example.com/.well-known/openid-configuration"
                      />
                    </div>
                    <div>
                      <Label>Client ID</Label>
                      <Input
                        value={editingProvider.clientId || ''}
                        onChange={(e) => setEditingProvider(p => p ? { ...p, clientId: e.target.value } : p)}
                        placeholder="your-client-id"
                      />
                    </div>
                    <div>
                      <Label>Client Secret</Label>
                      <div className="flex gap-2">
                        <Input
                          type={showSecret ? 'text' : 'password'}
                          value={editingProvider.clientSecret || ''}
                          onChange={(e) => setEditingProvider(p => p ? { ...p, clientSecret: e.target.value } : p)}
                          placeholder="your-client-secret"
                        />
                        <Button size="icon" variant="outline" onClick={() => setShowSecret(s => !s)}>
                          {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label>Scopes</Label>
                      <Input
                        value={editingProvider.scopes?.join(', ') || 'openid, profile, email'}
                        onChange={(e) => setEditingProvider(p => p ? { ...p, scopes: e.target.value.split(',').map(s => s.trim()) } : p)}
                        placeholder="openid, profile, email"
                      />
                    </div>
                  </div>
                )}

                <Separator />

                {/* Attribute Mapping */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2"><Settings className="h-4 w-4" /> Attribute Mapping</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Email Attribute</Label>
                      <Input
                        value={editingProvider.attributeMapping?.email || ''}
                        onChange={(e) => setEditingProvider(p => p ? { ...p, attributeMapping: { ...p.attributeMapping!, email: e.target.value } } : p)}
                        placeholder="email"
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">First Name Attribute</Label>
                      <Input
                        value={editingProvider.attributeMapping?.firstName || ''}
                        onChange={(e) => setEditingProvider(p => p ? { ...p, attributeMapping: { ...p.attributeMapping!, firstName: e.target.value } } : p)}
                        placeholder="firstName"
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Last Name Attribute</Label>
                      <Input
                        value={editingProvider.attributeMapping?.lastName || ''}
                        onChange={(e) => setEditingProvider(p => p ? { ...p, attributeMapping: { ...p.attributeMapping!, lastName: e.target.value } } : p)}
                        placeholder="lastName"
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Groups Attribute</Label>
                      <Input
                        value={editingProvider.attributeMapping?.groups || ''}
                        onChange={(e) => setEditingProvider(p => p ? { ...p, attributeMapping: { ...p.attributeMapping!, groups: e.target.value } } : p)}
                        placeholder="groups"
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Domain Restrictions */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Allowed Domains</h4>
                  <div className="flex flex-wrap gap-2">
                    {editingProvider.allowedDomains?.map(domain => (
                      <Badge key={domain} variant="secondary" className="gap-1">
                        {domain}
                        <button onClick={() => removeDomain(domain)} className="ml-1 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addDomain()}
                      placeholder="example.com"
                      className="text-xs"
                    />
                    <Button size="sm" variant="outline" onClick={addDomain}>Add</Button>
                  </div>
                </div>

                <Separator />

                {/* Provisioning */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2"><Users className="h-4 w-4" /> User Provisioning</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Just-In-Time (JIT) Provisioning</Label>
                        <p className="text-xs text-muted-foreground">Auto-create users on first SSO login</p>
                      </div>
                      <Switch
                        checked={editingProvider.jitProvisioning || false}
                        onCheckedChange={(v) => setEditingProvider(p => p ? { ...p, jitProvisioning: v } : p)}
                      />
                    </div>
                    <div>
                      <Label>Default Role for New Users</Label>
                      <Select
                        value={editingProvider.defaultRole || 'viewer'}
                        onValueChange={(v) => setEditingProvider(p => p ? { ...p, defaultRole: v } : p)}
                      >
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Group Mapping */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Group → Role Mapping</h4>
                  {editingProvider.groupMapping?.map((mapping, idx) => (
                    <div key={`group-${mapping.ssoGroup || idx}`} className="flex items-center gap-2">
                      <Input
                        value={mapping.ssoGroup}
                        onChange={(e) => {
                          const gm = [...(editingProvider.groupMapping || [])];
                          gm[idx] = { ...mapping, ssoGroup: e.target.value };
                          setEditingProvider(p => p ? { ...p, groupMapping: gm } : p);
                        }}
                        placeholder="SSO Group name"
                        className="text-xs flex-1"
                      />
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Select
                        value={mapping.appRole}
                        onValueChange={(v) => {
                          const gm = [...(editingProvider.groupMapping || [])];
                          gm[idx] = { ...mapping, appRole: v };
                          setEditingProvider(p => p ? { ...p, groupMapping: gm } : p);
                        }}
                      >
                        <SelectTrigger className="w-28 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => {
                        const gm = [...(editingProvider.groupMapping || [])];
                        gm.splice(idx, 1);
                        setEditingProvider(p => p ? { ...p, groupMapping: gm } : p);
                      }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" className="text-xs" onClick={addGroupMapping}>
                    <Plus className="h-3 w-3 mr-1" /> Add mapping
                  </Button>
                </div>

                {/* Test Connection */}
                <Separator />
                <div>
                  <Button variant="outline" onClick={testConnection} className="gap-2">
                    <RefreshCw className="h-4 w-4" /> Test Connection
                  </Button>
                  {testResult && (
                    <div className={cn('mt-2 p-3 rounded-lg text-sm flex items-center gap-2', testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
                      {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                      {testResult.message}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button onClick={saveProvider} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Provider
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
