'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Shield,
  Smartphone,
  Key,
  Copy,
  Check,
  AlertTriangle,
  RefreshCcw,
  Lock,
  Unlock,
  QrCode,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';

interface MFAStatus {
  enabled: boolean;
  backupCodesRemaining?: number;
  lastVerified?: string;
}

interface MFASetupData {
  secret: string;
  qrCodeUri: string;
  backupCodes: string[];
}

export function MFASettings() {
  const [status, setStatus] = useState<MFAStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupData, setSetupData] = useState<MFASetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/mfa');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch MFA status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const initSetup = async () => {
    try {
      setIsSettingUp(true);
      const response = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup' }),
      });

      if (!response.ok) {
        throw new Error('Failed to initialize MFA setup');
      }

      const data = await response.json();
      setSetupData(data);
      setShowSetupDialog(true);
    } catch (err) {
      toast.error('Failed to start MFA setup');
    } finally {
      setIsSettingUp(false);
    }
  };

  const verifySetup = async () => {
    if (verificationCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    try {
      setIsVerifying(true);
      const response = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify-setup', code: verificationCode }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Verification failed');
      }

      toast.success('Two-factor authentication enabled!');
      setShowSetupDialog(false);
      setShowBackupCodes(true);
      setVerificationCode('');
      fetchStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const disableMFA = async () => {
    try {
      setIsDisabling(true);
      const response = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable', password: disablePassword }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to disable MFA');
      }

      toast.success('Two-factor authentication disabled');
      setShowDisableDialog(false);
      setDisablePassword('');
      fetchStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to disable MFA');
    } finally {
      setIsDisabling(false);
    }
  };

  const regenerateBackupCodes = async () => {
    try {
      const response = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate-backup-codes' }),
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate backup codes');
      }

      const data = await response.json();
      setNewBackupCodes(data.backupCodes);
      setShowBackupCodes(true);
      fetchStatus();
      toast.success('New backup codes generated');
    } catch (err) {
      toast.error('Failed to regenerate backup codes');
    }
  };

  const copyBackupCodes = (codes: string[]) => {
    navigator.clipboard.writeText(codes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Backup codes copied to clipboard');
  };

  const downloadBackupCodes = (codes: string[]) => {
    const content = `Contigo Platform - Two-Factor Authentication Backup Codes
==========================================================

Keep these codes safe! Each code can only be used once.

${codes.map((code, i) => `${i + 1}. ${code}`).join('\n')}

Generated: ${new Date().toISOString()}

If you lose access to your authenticator app, use one of these codes to sign in.
Store these codes in a secure location.`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contigo-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Backup codes downloaded');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-10 bg-muted rounded w-32" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account using an authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${status?.enabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
                {status?.enabled ? (
                  <Lock className="h-5 w-5 text-green-600 dark:text-green-400" />
                ) : (
                  <Unlock className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="font-medium">
                  {status?.enabled ? 'Two-factor is enabled' : 'Two-factor is not enabled'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {status?.enabled
                    ? 'Your account is protected with 2FA'
                    : 'Protect your account with a second verification step'}
                </p>
              </div>
            </div>
            <Badge variant={status?.enabled ? 'default' : 'secondary'}>
              {status?.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>

          {status?.enabled && (
            <>
              <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                <Key className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Backup Codes</p>
                  <p className="text-sm text-muted-foreground">
                    {status.backupCodesRemaining} codes remaining
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={regenerateBackupCodes}>
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
              </div>

              {status.backupCodesRemaining !== undefined && status.backupCodesRemaining <= 2 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    You&apos;re running low on backup codes. Generate new ones to ensure you can always access your account.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          <div className="flex gap-2 pt-2">
            {status?.enabled ? (
              <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
                <DialogTrigger asChild>
                  <Button variant="destructive">
                    <Unlock className="h-4 w-4 mr-2" />
                    Disable 2FA
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
                    <DialogDescription>
                      This will make your account less secure. Enter your password to confirm.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Disabling 2FA will make your account more vulnerable to unauthorized access.
                      </AlertDescription>
                    </Alert>
                    <div className="space-y-2">
                      <Label htmlFor="password">Confirm Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={disablePassword}
                        onChange={(e) => setDisablePassword(e.target.value)}
                        placeholder="Enter your password"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowDisableDialog(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={disableMFA}
                      disabled={isDisabling || !disablePassword}
                    >
                      {isDisabling ? (
                        <>
                          <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                          Disabling...
                        </>
                      ) : (
                        'Disable 2FA'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : (
              <Button onClick={initSetup} disabled={isSettingUp}>
                {isSettingUp ? (
                  <>
                    <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <Smartphone className="h-4 w-4 mr-2" />
                    Set Up 2FA
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Setup Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </DialogDescription>
          </DialogHeader>
          
          {setupData && (
            <div className="space-y-6 py-4">
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <QRCodeSVG value={setupData.qrCodeUri} size={200} />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Can&apos;t scan? Enter this code manually:
                </Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 text-sm bg-muted rounded font-mono break-all">
                    {setupData.secret}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(setupData.secret);
                      toast.success('Code copied');
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="verifyCode">Enter the 6-digit code from your app</Label>
                <Input
                  id="verifyCode"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="text-center text-2xl tracking-widest font-mono"
                  maxLength={6}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetupDialog(false)}>
              Cancel
            </Button>
            <Button onClick={verifySetup} disabled={isVerifying || verificationCode.length !== 6}>
              {isVerifying ? (
                <>
                  <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Verify & Enable
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backup Codes Dialog */}
      <Dialog open={showBackupCodes} onOpenChange={setShowBackupCodes}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Backup Codes
            </DialogTitle>
            <DialogDescription>
              Save these backup codes in a secure location. Each code can only be used once.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                These codes will only be shown once. Make sure to save them now!
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg font-mono text-sm">
              {(newBackupCodes || setupData?.backupCodes || []).map((code, i) => (
                <div key={i} className="p-2 bg-background rounded text-center">
                  {code}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => copyBackupCodes(newBackupCodes || setupData?.backupCodes || [])}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => downloadBackupCodes(newBackupCodes || setupData?.backupCodes || [])}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => {
              setShowBackupCodes(false);
              setNewBackupCodes(null);
              setSetupData(null);
            }}>
              I&apos;ve Saved My Codes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default MFASettings;
