'use client';

import { useState, useEffect } from 'react';
import { unwrapApiResponseData } from '@/lib/api-fetch';
import { useSession } from 'next-auth/react';
import { useConfirm, confirmPresets } from '@/components/dialogs/ConfirmDialog';
import {
  Shield,
  Key,
  Smartphone,
  Globe,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw as _RefreshCw,
  Plus,
  Trash2,
  Download,
  Lock,
  Eye as _Eye,
  EyeOff as _EyeOff,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';

interface Session {
  id: string;
  userId: string;
  userEmail: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

interface MFAStatus {
  enabled: boolean;
  method: string | null;
  enrolledAt: string | null;
}

interface IPAllowlistEntry {
  id: string;
  ip: string;
  description: string;
  createdAt: string;
  createdBy: string;
}

interface SecuritySettings {
  mfaRequired: boolean;
  sessionTimeout: number;
  ipAllowlistEnabled: boolean;
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireNumbers: boolean;
    requireSymbols: boolean;
  };
}

export default function SecurityPage() {
  const { data: _session } = useSession();
  const confirm = useConfirm();
  const [_loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [mfaStatus, setMfaStatus] = useState<MFAStatus>({ enabled: false, method: null, enrolledAt: null });
  const [ipAllowlist, setIpAllowlist] = useState<IPAllowlistEntry[]>([]);
  const [settings, setSettings] = useState<SecuritySettings>({
    mfaRequired: false,
    sessionTimeout: 8,
    ipAllowlistEnabled: false,
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireNumbers: true,
      requireSymbols: false,
    },
  });

  // MFA Setup
  const [showMFASetup, setShowMFASetup] = useState(false);
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaQRCode, setMfaQRCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [setupPassword, setSetupPassword] = useState('');
  const [showDisableMFADialog, setShowDisableMFADialog] = useState(false);
  const [disableMFAToken, setDisableMFAToken] = useState('');
  const [disableMFAPassword, setDisableMFAPassword] = useState('');
  const [savingSecuritySettings, setSavingSecuritySettings] = useState(false);

  // IP Allowlist
  const [showAddIP, setShowAddIP] = useState(false);
  const [newIP, setNewIP] = useState({ ip: '', description: '' });

  const fetchSecurityData = async () => {
    try {
      setLoading(true);
      const [sessionsRes, mfaRes, ipRes, settingsRes] = await Promise.all([
        fetch('/api/admin/sessions'),
        fetch('/api/auth/mfa/status'),
        fetch('/api/admin/security/ip-allowlist'),
        fetch('/api/admin/security-settings'),
      ]);

      if (sessionsRes.ok) {
        const data = unwrapApiResponseData<{ sessions?: Session[] }>(await sessionsRes.json());
        setSessions(data.sessions || []);
      }

      if (mfaRes.ok) {
        const data = unwrapApiResponseData<{ mfaEnabled?: boolean }>(await mfaRes.json());
        setMfaStatus({
          enabled: Boolean(data.mfaEnabled),
          method: data.mfaEnabled ? 'TOTP' : null,
          enrolledAt: null,
        });
      }

      if (ipRes.ok) {
        const data = unwrapApiResponseData<{ enabled?: boolean; entries?: IPAllowlistEntry[] }>(await ipRes.json());
        setIpAllowlist(data.entries || []);
        setSettings(prev => ({ ...prev, ipAllowlistEnabled: Boolean(data.enabled) }));
      }

      if (settingsRes.ok) {
        const data = unwrapApiResponseData<{ settings?: SecuritySettings }>(await settingsRes.json());
        if (data.settings) {
          setSettings(prev => ({ ...prev, ...data.settings }));
        }
      }
    } catch (_error) {
      console.error('Failed to fetch security data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const handleStartMFASetup = async () => {
    if (!setupPassword.trim()) {
      toast.error('Enter your current password to start MFA setup');
      return;
    }

    try {
      const response = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup', password: setupPassword }),
      });

      if (!response.ok) throw new Error();

      const data = unwrapApiResponseData<{ secret: string; qrCodeUri: string }>(await response.json());
      setMfaSecret(data.secret);
      setMfaQRCode(data.qrCodeUri);
      setShowMFASetup(true);
    } catch {
      toast.error('Failed to start MFA setup');
    }
  };

  const handleVerifyMFA = async () => {
    if (verificationCode.length !== 6) {
      toast.error('Enter a 6-digit code');
      return;
    }

    setIsEnrolling(true);
    try {
      const response = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify-setup', token: verificationCode }),
      });

      if (!response.ok) throw new Error();

      toast.success('MFA enabled successfully');
      setShowMFASetup(false);
      setVerificationCode('');
      setSetupPassword('');
      fetchSecurityData();
    } catch {
      toast.error('Invalid verification code');
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleDisableMFA = async () => {
    setShowDisableMFADialog(true);
  };

  const submitDisableMFA = async () => {
    if (!disableMFAToken && !disableMFAPassword) {
      toast.error('Enter your current MFA code or password');
      return;
    }

    try {
      const response = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'disable',
          token: disableMFAToken || undefined,
          password: disableMFAPassword || undefined,
        }),
      });

      if (!response.ok) throw new Error();

      toast.success('MFA disabled');
      setShowDisableMFADialog(false);
      setDisableMFAToken('');
      setDisableMFAPassword('');
      fetchSecurityData();
    } catch {
      toast.error('Failed to disable MFA');
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error();

      toast.success('Session revoked');
      fetchSecurityData();
    } catch {
      toast.error('Failed to revoke session');
    }
  };

  const handleRevokeAllSessions = async () => {
    const ok = await confirm({
      title: 'Sign out all other users?',
      description: 'Every active session except yours will be terminated. Users will need to sign in again.',
      confirmText: 'Sign out all',
      variant: 'warning',
      destructive: true,
    });
    if (!ok) return;

    try {
      const response = await fetch('/api/admin/sessions', {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error();

      toast.success('All sessions revoked');
      fetchSecurityData();
    } catch {
      toast.error('Failed to revoke sessions');
    }
  };

  const handleAddIP = async () => {
    if (!newIP.ip) {
      toast.error('IP address is required');
      return;
    }

    try {
      const response = await fetch('/api/admin/security/ip-allowlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newIP),
      });

      if (!response.ok) throw new Error();

      toast.success('IP added to allowlist');
      setShowAddIP(false);
      setNewIP({ ip: '', description: '' });
      fetchSecurityData();
    } catch {
      toast.error('Failed to add IP');
    }
  };

  const handleRemoveIP = async (id: string) => {
    try {
      const response = await fetch('/api/admin/security/ip-allowlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: id }),
      });

      if (!response.ok) throw new Error();

      toast.success('IP removed from allowlist');
      fetchSecurityData();
    } catch {
      toast.error('Failed to remove IP');
    }
  };

  const handleExportAuditLogs = async () => {
    try {
      const response = await fetch('/api/admin/audit/export?format=csv');
      if (!response.ok) throw new Error();

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success('Audit logs exported');
    } catch {
      toast.error('Failed to export audit logs');
    }
  };

  const handleSaveSecuritySettings = async () => {
    setSavingSecuritySettings(true);
    try {
      const [settingsResponse, ipSettingsResponse] = await Promise.all([
        fetch('/api/admin/security-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings }),
        }),
        fetch('/api/admin/security/ip-allowlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'updateSettings', enabled: settings.ipAllowlistEnabled }),
        }),
      ]);

      if (!settingsResponse.ok || !ipSettingsResponse.ok) {
        throw new Error('Failed to save security settings');
      }

      const data = unwrapApiResponseData<{ settings?: SecuritySettings }>(await settingsResponse.json());
      if (data.settings) {
        setSettings(prev => ({ ...prev, ...data.settings, ipAllowlistEnabled: settings.ipAllowlistEnabled }));
      }
      toast.success('Security settings saved');
    } catch {
      toast.error('Failed to save security settings');
    } finally {
      setSavingSecuritySettings(false);
    }
  };

  const parseUserAgent = (ua: string) => {
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Unknown Browser';
  };

  return (
    <div className="max-w-[1600px] mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Security Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage authentication, sessions, and access controls
          </p>
        </div>
        <Button variant="outline" onClick={handleExportAuditLogs}>
          <Download className="h-4 w-4 mr-2" />
          Export Audit Logs
        </Button>
      </div>

      <Tabs defaultValue="mfa">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="mfa">
            <Smartphone className="h-4 w-4 mr-2" />
            MFA
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <Clock className="h-4 w-4 mr-2" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="ip-allowlist">
            <Globe className="h-4 w-4 mr-2" />
            IP Allowlist
          </TabsTrigger>
          <TabsTrigger value="policies">
            <Lock className="h-4 w-4 mr-2" />
            Policies
          </TabsTrigger>
        </TabsList>

        {/* MFA Tab */}
        <TabsContent value="mfa" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Your MFA Status
                </CardTitle>
                <CardDescription>
                  Two-factor authentication for your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {mfaStatus.enabled ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className="font-medium">
                      {mfaStatus.enabled ? 'MFA Enabled' : 'MFA Not Enabled'}
                    </span>
                  </div>
                  {mfaStatus.enabled && (
                    <Badge variant="secondary">{mfaStatus.method || 'TOTP'}</Badge>
                  )}
                </div>

                {mfaStatus.enrolledAt && (
                  <p className="text-sm text-muted-foreground">
                    Enrolled {formatDistanceToNow(new Date(mfaStatus.enrolledAt), { addSuffix: true })}
                  </p>
                )}

                {mfaStatus.enabled ? (
                  <Button variant="destructive" onClick={handleDisableMFA}>
                    Disable MFA
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="mfa-setup-password">Current Password</Label>
                      <Input
                        id="mfa-setup-password"
                        type="password"
                        value={setupPassword}
                        onChange={(e) => setSetupPassword(e.target.value)}
                        placeholder="Required to start MFA setup"
                      />
                    </div>
                    <Button onClick={handleStartMFASetup} disabled={!setupPassword.trim()}>
                      <Smartphone className="h-4 w-4 mr-2" />
                      Enable MFA
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Organization MFA Policy</CardTitle>
                <CardDescription>
                  Require MFA for all team members
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Require MFA</p>
                    <p className="text-sm text-muted-foreground">
                      Force all users to enable MFA
                    </p>
                  </div>
                  <Switch
                    checked={settings.mfaRequired}
                    onCheckedChange={(checked) =>
                      setSettings(prev => ({ ...prev, mfaRequired: checked }))
                    }
                  />
                </div>

                {settings.mfaRequired && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>MFA Required</AlertTitle>
                    <AlertDescription>
                      Users without MFA will be prompted to set it up on next login.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>

          {/* MFA Setup Dialog */}
          <Dialog open={showMFASetup} onOpenChange={setShowMFASetup}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
                <DialogDescription>
                  Add the manual key below to your authenticator app, then confirm with a 6-digit code.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {mfaQRCode && (
                  <Alert>
                    <AlertTitle>Authenticator Setup URI</AlertTitle>
                    <AlertDescription className="break-all font-mono text-xs">
                      {mfaQRCode}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label>Manual Entry Key</Label>
                  <div className="flex items-center gap-2">
                    <Input value={mfaSecret} readOnly className="font-mono text-sm" />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(mfaSecret);
                        toast.success('Copied to clipboard');
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Verification Code</Label>
                  <Input
                    placeholder="Enter 6-digit code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    className="text-center text-2xl tracking-widest"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowMFASetup(false)}>
                  Cancel
                </Button>
                <Button onClick={handleVerifyMFA} disabled={isEnrolling}>
                  {isEnrolling ? 'Verifying...' : 'Verify & Enable'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={showDisableMFADialog}
            onOpenChange={(open) => {
              setShowDisableMFADialog(open);
              if (!open) {
                setDisableMFAToken('');
                setDisableMFAPassword('');
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
                <DialogDescription>
                  Confirm this change with your current MFA code or your password.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Current MFA Code</Label>
                  <Input
                    placeholder="123456"
                    value={disableMFAToken}
                    onChange={(e) => setDisableMFAToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    className="text-center text-2xl tracking-widest"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Or Current Password</Label>
                  <Input
                    type="password"
                    value={disableMFAPassword}
                    onChange={(e) => setDisableMFAPassword(e.target.value)}
                    placeholder="Current password"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDisableMFADialog(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={submitDisableMFA}>
                  Disable MFA
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Active Sessions</CardTitle>
                  <CardDescription>
                    Manage active user sessions across your organization
                  </CardDescription>
                </div>
                <Button variant="destructive" onClick={handleRevokeAllSessions}>
                  Revoke All Sessions
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Browser</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map(s => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{s.userEmail}</p>
                          {s.isCurrent && (
                            <Badge variant="secondary" className="text-xs">Current</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{parseUserAgent(s.userAgent)}</TableCell>
                      <TableCell className="font-mono text-sm">{s.ipAddress}</TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(s.expiresAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevokeSession(s.id)}
                          disabled={s.isCurrent}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sessions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No active sessions
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* IP Allowlist Tab */}
        <TabsContent value="ip-allowlist" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>IP Allowlist</CardTitle>
                  <CardDescription>
                    Restrict access to specific IP addresses
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Enable</span>
                    <Switch
                      checked={settings.ipAllowlistEnabled}
                      onCheckedChange={(checked) =>
                        setSettings(prev => ({ ...prev, ipAllowlistEnabled: checked }))
                      }
                    />
                  </div>
                  <Dialog open={showAddIP} onOpenChange={setShowAddIP}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add IP
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add IP to Allowlist</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>IP Address or CIDR</Label>
                          <Input
                            placeholder="192.168.1.0/24 or 203.0.113.50"
                            value={newIP.ip}
                            onChange={(e) => setNewIP(prev => ({ ...prev, ip: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Input
                            placeholder="Office network"
                            value={newIP.description}
                            onChange={(e) => setNewIP(prev => ({ ...prev, description: e.target.value }))}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddIP(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleAddIP}>Add IP</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!settings.ipAllowlistEnabled && (
                <Alert className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>IP Allowlist Disabled</AlertTitle>
                  <AlertDescription>
                    Enable IP allowlist to restrict access to specific addresses.
                  </AlertDescription>
                </Alert>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead>Added By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ipAllowlist.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono">{entry.ip}</TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell>{entry.createdBy}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveIP(entry.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {ipAllowlist.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No IPs in allowlist
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Policies Tab */}
        <TabsContent value="policies" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Password Policy</CardTitle>
                <CardDescription>
                  Set requirements for user passwords
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Minimum Length</Label>
                  <Input
                    type="number"
                    min={6}
                    max={32}
                    value={settings.passwordPolicy.minLength}
                    onChange={(e) =>
                      setSettings(prev => ({
                        ...prev,
                        passwordPolicy: {
                          ...prev.passwordPolicy,
                          minLength: parseInt(e.target.value),
                        },
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Require uppercase letters</Label>
                  <Switch
                    checked={settings.passwordPolicy.requireUppercase}
                    onCheckedChange={(checked) =>
                      setSettings(prev => ({
                        ...prev,
                        passwordPolicy: { ...prev.passwordPolicy, requireUppercase: checked },
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Require numbers</Label>
                  <Switch
                    checked={settings.passwordPolicy.requireNumbers}
                    onCheckedChange={(checked) =>
                      setSettings(prev => ({
                        ...prev,
                        passwordPolicy: { ...prev.passwordPolicy, requireNumbers: checked },
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Require symbols</Label>
                  <Switch
                    checked={settings.passwordPolicy.requireSymbols}
                    onCheckedChange={(checked) =>
                      setSettings(prev => ({
                        ...prev,
                        passwordPolicy: { ...prev.passwordPolicy, requireSymbols: checked },
                      }))
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Session Settings</CardTitle>
                <CardDescription>
                  Configure session timeout and behavior
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Session Timeout (hours)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={720}
                    value={settings.sessionTimeout}
                    onChange={(e) =>
                      setSettings(prev => ({
                        ...prev,
                        sessionTimeout: parseInt(e.target.value),
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Users will be prompted to sign in again after this session duration
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end mt-6">
            <Button onClick={handleSaveSecuritySettings} disabled={savingSecuritySettings}>
              {savingSecuritySettings ? 'Saving...' : 'Save Security Settings'}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
