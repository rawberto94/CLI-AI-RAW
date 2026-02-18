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
import { Progress } from '@/components/ui/progress';
import {
  PenLine, Send, Users, Clock, CheckCircle2, XCircle, AlertTriangle,
  Plus, Trash2, GripVertical, Eye, Download, RotateCcw, Settings,
  Mail, Shield, FileText, ArrowRight, ArrowDown, Edit, ExternalLink,
  ChevronDown, ChevronRight, Loader2, RefreshCw, Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface Signatory {
  id: string;
  name: string;
  email: string;
  role: 'signer' | 'approver' | 'cc' | 'witness';
  order: number;
  status: 'pending' | 'sent' | 'viewed' | 'signed' | 'declined' | 'voided';
  signedAt?: string;
  declineReason?: string;
  authMethod: 'email' | 'sms' | 'id_verification';
}

interface SignatureEnvelope {
  id: string;
  contractId: string;
  provider: 'docusign' | 'adobe_sign' | 'internal';
  status: 'draft' | 'sent' | 'in_progress' | 'completed' | 'declined' | 'voided' | 'expired';
  subject: string;
  message: string;
  signatories: Signatory[];
  expiresAt?: string;
  reminders: {
    enabled: boolean;
    frequencyDays: number;
    startAfterDays: number;
  };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface ESignatureWorkflowProps {
  contractId: string;
  contractTitle?: string;
  className?: string;
}

// ============================================================================
// Mock data for UI demonstration
// ============================================================================

function createBlankEnvelope(contractId: string): SignatureEnvelope {
  return {
    id: 'env_' + Date.now().toString(36),
    contractId,
    provider: 'docusign',
    status: 'draft',
    subject: '',
    message: '',
    signatories: [],
    reminders: { enabled: true, frequencyDays: 3, startAfterDays: 1 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: Edit },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-700', icon: Send },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700', icon: Clock },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-700', icon: XCircle },
  voided: { label: 'Voided', color: 'bg-gray-100 text-gray-500', icon: XCircle },
  expired: { label: 'Expired', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
};

const SIGNER_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-600' },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-700' },
  viewed: { label: 'Viewed', color: 'bg-amber-100 text-amber-700' },
  signed: { label: 'Signed', color: 'bg-green-100 text-green-700' },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-700' },
  voided: { label: 'Voided', color: 'bg-gray-100 text-gray-500' },
};

// ============================================================================
// Component
// ============================================================================

export default function ESignatureWorkflow({ contractId, contractTitle, className }: ESignatureWorkflowProps) {
  const [envelope, setEnvelope] = useState<SignatureEnvelope>(createBlankEnvelope(contractId));
  const [activeTab, setActiveTab] = useState('setup');
  const [sending, setSending] = useState(false);
  const [loadingEnvelope, setLoadingEnvelope] = useState(true);
  const [addSignerOpen, setAddSignerOpen] = useState(false);
  const [newSigner, setNewSigner] = useState<Partial<Signatory>>({ role: 'signer', authMethod: 'email' });

  // Load existing signature request for this contract on mount
  useEffect(() => {
    async function loadExistingEnvelope() {
      try {
        const res = await fetch(`/api/signatures?contractId=${contractId}&limit=1`);
        if (res.ok) {
          const data = await res.json();
          const items = data?.data?.items || [];
          if (items.length > 0) {
            const existing = items[0];
            setEnvelope(prev => ({
              ...prev,
              id: existing.id,
              status: existing.status || prev.status,
              subject: existing.subject || prev.subject,
              message: existing.message || prev.message,
              provider: existing.provider || prev.provider,
              signatories: (existing.signers || []).map((s: Record<string, unknown>, i: number) => ({
                id: (s.id as string) || `s_${i}`,
                name: s.name as string,
                email: s.email as string,
                role: (s.role as Signatory['role']) || 'signer',
                order: (s.order as number) || i + 1,
                status: (s.status as Signatory['status']) || 'pending',
                signedAt: s.signedAt as string | undefined,
                authMethod: (s.authMethod as Signatory['authMethod']) || 'email',
              })),
              createdAt: existing.createdAt || prev.createdAt,
              updatedAt: existing.updatedAt || prev.updatedAt,
            }));
            if (existing.status && existing.status !== 'draft') {
              setActiveTab('tracking');
            }
          }
        }
      } catch {
        // If fetch fails, start with a fresh draft envelope
      } finally {
        setLoadingEnvelope(false);
      }
    }
    loadExistingEnvelope();
  }, [contractId]);

  const completedCount = envelope.signatories.filter(s => s.status === 'signed').length;
  const totalSigners = envelope.signatories.filter(s => s.role === 'signer' || s.role === 'approver').length;
  const progress = totalSigners > 0 ? (completedCount / totalSigners) * 100 : 0;

  const addSignatory = () => {
    if (!newSigner.name || !newSigner.email) {
      toast.error('Name and email are required');
      return;
    }
    const signer: Signatory = {
      id: 's_' + Date.now().toString(36),
      name: newSigner.name,
      email: newSigner.email,
      role: (newSigner.role as Signatory['role']) || 'signer',
      order: envelope.signatories.length + 1,
      status: 'pending',
      authMethod: (newSigner.authMethod as Signatory['authMethod']) || 'email',
    };
    setEnvelope(prev => ({ ...prev, signatories: [...prev.signatories, signer] }));
    setNewSigner({ role: 'signer', authMethod: 'email' });
    setAddSignerOpen(false);
    toast.success(`Added ${signer.name}`);
  };

  const removeSignatory = (id: string) => {
    setEnvelope(prev => ({
      ...prev,
      signatories: prev.signatories.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i + 1 })),
    }));
  };

  const moveSignatory = (fromIdx: number, direction: 'up' | 'down') => {
    const toIdx = direction === 'up' ? fromIdx - 1 : fromIdx + 1;
    if (toIdx < 0 || toIdx >= envelope.signatories.length) return;
    const signers = [...envelope.signatories];
    [signers[fromIdx], signers[toIdx]] = [signers[toIdx], signers[fromIdx]];
    setEnvelope(prev => ({ ...prev, signatories: signers.map((s, i) => ({ ...s, order: i + 1 })) }));
  };

  const sendEnvelope = async () => {
    if (envelope.signatories.length === 0) {
      toast.error('Add at least one signatory');
      return;
    }
    if (!envelope.subject) {
      toast.error('Subject is required');
      return;
    }
    setSending(true);
    try {
      const response = await fetch('/api/signatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId,
          signers: envelope.signatories.map(s => ({
            name: s.name,
            email: s.email,
            role: s.role,
            order: s.order,
          })),
          message: envelope.message || envelope.subject,
          provider: envelope.provider === 'internal' ? 'manual' : envelope.provider,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to send signature request');
      }

      setEnvelope(prev => ({
        ...prev,
        id: data.data?.id || prev.id,
        status: 'sent',
        signatories: prev.signatories.map(s => s.role !== 'cc' ? { ...s, status: 'sent' } : s),
      }));
      setActiveTab('tracking');
      toast.success('Signature request sent successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send signature request');
    } finally {
      setSending(false);
    }
  };

  const voidEnvelope = async () => {
    if (!envelope.id) {
      toast.error('No active signature request to void');
      return;
    }
    try {
      const response = await fetch(`/api/signatures/${envelope.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to void envelope');
      }

      setEnvelope(prev => ({
        ...prev,
        status: 'voided',
        signatories: prev.signatories.map(s => ({ ...s, status: 'voided' })),
      }));
      toast.info('Envelope has been voided');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to void envelope');
    }
  };

  const resendToSigner = async (signerId: string) => {
    if (!envelope.id) {
      toast.error('No active signature request');
      return;
    }
    try {
      const response = await fetch(`/api/signatures/${envelope.id}/remind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signerId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send reminder');
      }

      toast.success('Reminder sent');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reminder');
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-100">
                <PenLine className="h-5 w-5 text-violet-700" />
              </div>
              <div>
                <CardTitle className="text-lg">E-Signature</CardTitle>
                <CardDescription>
                  {contractTitle ? `Collect signatures for "${contractTitle}"` : 'Manage signature workflow'}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(() => {
                const config = STATUS_CONFIG[envelope.status];
                const Icon = config.icon;
                return (
                  <Badge className={cn('gap-1', config.color)}>
                    <Icon className="h-3 w-3" /> {config.label}
                  </Badge>
                );
              })()}
              <Select
                value={envelope.provider}
                onValueChange={(v) => setEnvelope(prev => ({ ...prev, provider: v as SignatureEnvelope['provider'] }))}
              >
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="docusign">DocuSign</SelectItem>
                  <SelectItem value="adobe_sign">Adobe Sign</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {totalSigners > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Signing progress</span>
                <span className="font-medium">{completedCount}/{totalSigners}</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="setup" className="flex-1">
            <Settings className="h-3 w-3 mr-1" /> Setup
          </TabsTrigger>
          <TabsTrigger value="signers" className="flex-1">
            <Users className="h-3 w-3 mr-1" /> Signers ({envelope.signatories.length})
          </TabsTrigger>
          <TabsTrigger value="tracking" className="flex-1">
            <Eye className="h-3 w-3 mr-1" /> Tracking
          </TabsTrigger>
        </TabsList>

        {/* Setup Tab */}
        <TabsContent value="setup" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label htmlFor="envelope-subject">Email Subject</Label>
                <Input
                  id="envelope-subject"
                  value={envelope.subject}
                  onChange={(e) => setEnvelope(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Please sign: Contract Agreement"
                  disabled={envelope.status !== 'draft'}
                />
              </div>
              <div>
                <Label htmlFor="envelope-message">Message to Signers</Label>
                <Textarea
                  id="envelope-message"
                  value={envelope.message}
                  onChange={(e) => setEnvelope(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Please review and sign the attached contract..."
                  rows={3}
                  disabled={envelope.status !== 'draft'}
                />
              </div>

              <Separator />

              <div>
                <Label className="text-sm font-medium">Reminders</Label>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={envelope.reminders.enabled}
                      onCheckedChange={(v) => setEnvelope(prev => ({ ...prev, reminders: { ...prev.reminders, enabled: v } }))}
                      disabled={envelope.status !== 'draft'}
                    />
                    <span className="text-sm">Auto-remind</span>
                  </div>
                  {envelope.reminders.enabled && (
                    <>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Every</span>
                        <Input
                          type="number"
                          className="w-14 h-7 text-xs"
                          value={envelope.reminders.frequencyDays}
                          onChange={(e) => setEnvelope(prev => ({ ...prev, reminders: { ...prev.reminders, frequencyDays: parseInt(e.target.value) || 3 } }))}
                          min={1}
                          max={30}
                          disabled={envelope.status !== 'draft'}
                        />
                        <span className="text-xs text-muted-foreground">days</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Starting after</span>
                        <Input
                          type="number"
                          className="w-14 h-7 text-xs"
                          value={envelope.reminders.startAfterDays}
                          onChange={(e) => setEnvelope(prev => ({ ...prev, reminders: { ...prev.reminders, startAfterDays: parseInt(e.target.value) || 1 } }))}
                          min={0}
                          max={30}
                          disabled={envelope.status !== 'draft'}
                        />
                        <span className="text-xs text-muted-foreground">days</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-sm font-medium">Security</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="flex items-center gap-2 p-3 rounded-lg border">
                    <Shield className="h-4 w-4 text-green-600" />
                    <div>
                      <div className="text-xs font-medium">Certificate-based</div>
                      <div className="text-[10px] text-muted-foreground">Digital certificates for each signature</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg border">
                    <Mail className="h-4 w-4 text-blue-600" />
                    <div>
                      <div className="text-xs font-medium">Audit Trail</div>
                      <div className="text-[10px] text-muted-foreground">Full audit log of all actions</div>
                    </div>
                  </div>
                </div>
              </div>

              {envelope.status === 'draft' && (
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" size="sm" onClick={() => setActiveTab('signers')}>
                    <Users className="h-4 w-4 mr-2" /> Add Signers
                  </Button>
                  <Button
                    size="sm"
                    onClick={sendEnvelope}
                    disabled={sending || envelope.signatories.length === 0 || !envelope.subject}
                    className="bg-violet-600 hover:bg-violet-700"
                  >
                    {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Send for Signature
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Signers Tab */}
        <TabsContent value="signers" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Signatories</CardTitle>
                {envelope.status === 'draft' && (
                  <Button size="sm" variant="outline" onClick={() => setAddSignerOpen(true)}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {envelope.signatories.length === 0 ? (
                <div className="py-8 text-center">
                  <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No signatories added yet</p>
                  <Button size="sm" className="mt-3" onClick={() => setAddSignerOpen(true)}>
                    <Plus className="h-3 w-3 mr-1" /> Add first signer
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {envelope.signatories.map((signer, idx) => {
                    const statusConf = SIGNER_STATUS[signer.status];
                    return (
                      <div key={signer.id} className="flex items-center gap-3 p-3 rounded-lg border group">
                        <div className="flex flex-col items-center gap-0.5">
                          {envelope.status === 'draft' && (
                            <>
                              <button onClick={() => moveSignatory(idx, 'up')} disabled={idx === 0} className="p-0.5 hover:bg-muted rounded disabled:opacity-30">
                                <ChevronRight className="h-3 w-3 -rotate-90" />
                              </button>
                              <span className="text-[10px] text-muted-foreground font-mono">{signer.order}</span>
                              <button onClick={() => moveSignatory(idx, 'down')} disabled={idx === envelope.signatories.length - 1} className="p-0.5 hover:bg-muted rounded disabled:opacity-30">
                                <ChevronRight className="h-3 w-3 rotate-90" />
                              </button>
                            </>
                          )}
                          {envelope.status !== 'draft' && (
                            <span className="text-xs font-mono text-muted-foreground">{signer.order}</span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{signer.name}</span>
                            <Badge variant="outline" className="text-[10px] capitalize">{signer.role}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">{signer.email}</div>
                          {signer.signedAt && (
                            <div className="text-[10px] text-green-600 mt-0.5">
                              Signed {new Date(signer.signedAt).toLocaleString()}
                            </div>
                          )}
                          {signer.declineReason && (
                            <div className="text-[10px] text-red-600 mt-0.5">
                              Reason: {signer.declineReason}
                            </div>
                          )}
                        </div>

                        <Badge className={cn('text-[10px]', statusConf?.color)}>
                          {statusConf?.label || signer.status}
                        </Badge>

                        <div className="flex items-center gap-1">
                          {envelope.status !== 'draft' && signer.status !== 'signed' && signer.role !== 'cc' && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => resendToSigner(signer.id)} title="Send reminder">
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          )}
                          {envelope.status === 'draft' && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100" onClick={() => removeSignatory(signer.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {envelope.status === 'draft' && envelope.signatories.length > 0 && (
                <div className="mt-4 pt-4 border-t flex justify-end">
                  <Button
                    onClick={sendEnvelope}
                    disabled={sending || !envelope.subject}
                    className="bg-violet-600 hover:bg-violet-700"
                  >
                    {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Send for Signature
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tracking Tab */}
        <TabsContent value="tracking" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Signature Tracking</CardTitle>
                {(envelope.status === 'sent' || envelope.status === 'in_progress') && (
                  <Button size="sm" variant="destructive" onClick={voidEnvelope}>
                    <XCircle className="h-3 w-3 mr-1" /> Void
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {envelope.status === 'draft' ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Envelope hasn&apos;t been sent yet</p>
                  <p className="text-xs mt-1">Complete setup and send to start tracking</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Timeline */}
                  <div className="space-y-3">
                    {envelope.signatories.map((signer, idx) => {
                      const isCompleted = signer.status === 'signed';
                      const isCurrent = ['sent', 'viewed'].includes(signer.status);
                      const isDeclined = signer.status === 'declined';

                      return (
                        <div key={signer.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                              isCompleted && 'bg-green-100 text-green-700',
                              isCurrent && 'bg-blue-100 text-blue-700 ring-2 ring-blue-400/30',
                              isDeclined && 'bg-red-100 text-red-700',
                              !isCompleted && !isCurrent && !isDeclined && 'bg-gray-100 text-gray-400',
                            )}>
                              {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : isDeclined ? <XCircle className="h-4 w-4" /> : signer.order}
                            </div>
                            {idx < envelope.signatories.length - 1 && (
                              <div className={cn('w-0.5 flex-1 min-h-[20px]', isCompleted ? 'bg-green-300' : 'bg-gray-200')} />
                            )}
                          </div>
                          <div className="flex-1 pb-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-medium text-sm">{signer.name}</span>
                                <Badge variant="outline" className="ml-2 text-[10px] capitalize">{signer.role}</Badge>
                              </div>
                              <Badge className={cn('text-[10px]', SIGNER_STATUS[signer.status]?.color)}>
                                {SIGNER_STATUS[signer.status]?.label}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">{signer.email}</div>
                            {signer.signedAt && (
                              <div className="text-[10px] text-green-600 mt-1">
                                Signed on {new Date(signer.signedAt).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions */}
                  <Separator />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1">
                      <Download className="h-3 w-3" /> Download Certificate
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1">
                      <FileText className="h-3 w-3" /> Audit Trail
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1">
                      <ExternalLink className="h-3 w-3" /> View in {envelope.provider === 'docusign' ? 'DocuSign' : envelope.provider === 'adobe_sign' ? 'Adobe Sign' : 'Portal'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Signer Dialog */}
      <Dialog open={addSignerOpen} onOpenChange={setAddSignerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Signatory</DialogTitle>
            <DialogDescription>Add a person to the signing workflow</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="signer-name">Full Name</Label>
              <Input
                id="signer-name"
                value={newSigner.name || ''}
                onChange={(e) => setNewSigner(p => ({ ...p, name: e.target.value }))}
                placeholder="John Smith"
              />
            </div>
            <div>
              <Label htmlFor="signer-email">Email Address</Label>
              <Input
                id="signer-email"
                type="email"
                value={newSigner.email || ''}
                onChange={(e) => setNewSigner(p => ({ ...p, email: e.target.value }))}
                placeholder="john@company.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Role</Label>
                <Select value={newSigner.role || 'signer'} onValueChange={(v) => setNewSigner(p => ({ ...p, role: v }) as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="signer">Signer</SelectItem>
                    <SelectItem value="approver">Approver</SelectItem>
                    <SelectItem value="cc">CC (Copy)</SelectItem>
                    <SelectItem value="witness">Witness</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Authentication</Label>
                <Select value={newSigner.authMethod || 'email'} onValueChange={(v) => setNewSigner(p => ({ ...p, authMethod: v }) as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS Code</SelectItem>
                    <SelectItem value="id_verification">ID Verification</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSignerOpen(false)}>Cancel</Button>
            <Button onClick={addSignatory} disabled={!newSigner.name || !newSigner.email}>
              <Plus className="h-4 w-4 mr-2" /> Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
