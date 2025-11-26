'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  FileSignature,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Mail,
  Download,
  RefreshCw,
  User,
  Calendar,
  Send,
  Eye,
  MoreVertical,
  MessageSquare,
  Bell,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface SignerStatus {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'pending' | 'sent' | 'viewed' | 'signed' | 'declined';
  order: number;
  sentAt?: string;
  viewedAt?: string;
  signedAt?: string;
  declinedAt?: string;
  declineReason?: string;
  ipAddress?: string;
}

interface SignatureWorkflow {
  id: string;
  contractId: string;
  contractName: string;
  provider: 'docusign' | 'adobe' | 'hellosign';
  status: 'draft' | 'sent' | 'in_progress' | 'completed' | 'cancelled' | 'expired';
  signers: SignerStatus[];
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  completedAt?: string;
  certificateUrl?: string;
  auditTrailUrl?: string;
  message?: string;
}

interface SignatureWorkflowTrackerProps {
  contractId: string;
  onRequestNew?: () => void;
}

export function SignatureWorkflowTracker({
  contractId,
  onRequestNew,
}: SignatureWorkflowTrackerProps) {
  const [workflows, setWorkflows] = useState<SignatureWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkflow, setSelectedWorkflow] = useState<SignatureWorkflow | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showReminderDialog, setShowReminderDialog] = useState(false);
  const [reminderMessage, setReminderMessage] = useState('');
  const [selectedSigner, setSelectedSigner] = useState<SignerStatus | null>(null);

  useEffect(() => {
    fetchWorkflows();
    const interval = setInterval(fetchWorkflows, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, [contractId]);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/contracts/${contractId}/signatures`);
      if (response.ok) {
        const data = await response.json();
        setWorkflows(data.workflows || mockWorkflows);
      } else {
        setWorkflows(mockWorkflows);
      }
    } catch (error) {
      console.error('Failed to fetch signature workflows:', error);
      setWorkflows(mockWorkflows);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelWorkflow = async (workflowId: string) => {
    if (!confirm('Are you sure you want to cancel this signature request?')) return;

    try {
      const response = await fetch(`/api/signatures/${workflowId}/cancel`, {
        method: 'POST',
      });

      if (response.ok) {
        fetchWorkflows();
      }
    } catch (error) {
      console.error('Failed to cancel workflow:', error);
    }
  };

  const handleSendReminder = async () => {
    if (!selectedSigner || !selectedWorkflow) return;

    try {
      const response = await fetch(`/api/signatures/${selectedWorkflow.id}/remind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signerId: selectedSigner.id,
          message: reminderMessage,
        }),
      });

      if (response.ok) {
        setShowReminderDialog(false);
        setReminderMessage('');
        setSelectedSigner(null);
      }
    } catch (error) {
      console.error('Failed to send reminder:', error);
    }
  };

  const handleDownloadCertificate = async (workflowId: string) => {
    try {
      window.open(`/api/signatures/${workflowId}/certificate`, '_blank');
    } catch (error) {
      console.error('Failed to download certificate:', error);
    }
  };

  const handleDownloadAuditTrail = async (workflowId: string) => {
    try {
      window.open(`/api/signatures/${workflowId}/audit-trail`, '_blank');
    } catch (error) {
      console.error('Failed to download audit trail:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      draft: {
        color: 'bg-gray-100 text-gray-700',
        icon: <Clock className="h-3 w-3 mr-1" />,
        label: 'Draft',
      },
      sent: {
        color: 'bg-blue-100 text-blue-700',
        icon: <Send className="h-3 w-3 mr-1" />,
        label: 'Sent',
      },
      in_progress: {
        color: 'bg-yellow-100 text-yellow-700',
        icon: <Clock className="h-3 w-3 mr-1" />,
        label: 'In Progress',
      },
      completed: {
        color: 'bg-green-100 text-green-700',
        icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
        label: 'Completed',
      },
      cancelled: {
        color: 'bg-red-100 text-red-700',
        icon: <XCircle className="h-3 w-3 mr-1" />,
        label: 'Cancelled',
      },
      expired: {
        color: 'bg-orange-100 text-orange-700',
        icon: <AlertCircle className="h-3 w-3 mr-1" />,
        label: 'Expired',
      },
    };

    const config = configs[status] ?? configs.draft!;
    return (
      <Badge className={config.color}>
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const getSignerStatusIcon = (status: string) => {
    switch (status) {
      case 'signed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'viewed':
        return <Eye className="h-5 w-5 text-blue-600" />;
      case 'sent':
        return <Mail className="h-5 w-5 text-yellow-600" />;
      case 'declined':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-gray-400" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const calculateProgress = (workflow: SignatureWorkflow) => {
    const total = workflow.signers.length;
    const signed = workflow.signers.filter((s) => s.status === 'signed').length;
    return (signed / total) * 100;
  };

  const getDaysUntilExpiry = (expiresAt: string) => {
    const days = Math.ceil(
      (new Date(expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return days;
  };

  const getProviderLogo = (provider: string) => {
    const logos: Record<string, string> = {
      docusign: '📝 DocuSign',
      adobe: '🔺 Adobe Sign',
      hellosign: '👋 HelloSign',
    };
    return logos[provider] || provider;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (workflows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <FileSignature className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Signature Requests</h3>
            <p className="text-gray-600 mb-6">
              This contract hasn't been sent for signature yet
            </p>
            {onRequestNew && (
              <Button
                onClick={onRequestNew}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                <FileSignature className="h-4 w-4 mr-2" />
                Request Signatures
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {workflows.map((workflow) => (
        <Card key={workflow.id} className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 pb-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <FileSignature className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg">Signature Request</CardTitle>
                  {getStatusBadge(workflow.status)}
                </div>
                <CardDescription>
                  Sent {new Date(workflow.createdAt).toLocaleDateString()} via{' '}
                  {getProviderLogo(workflow.provider)}
                </CardDescription>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => {
                    setSelectedWorkflow(workflow);
                    setShowDetailsDialog(true);
                  }}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </DropdownMenuItem>
                  {workflow.status === 'completed' && (
                    <>
                      <DropdownMenuItem onClick={() => handleDownloadCertificate(workflow.id)}>
                        <Download className="h-4 w-4 mr-2" />
                        Download Certificate
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownloadAuditTrail(workflow.id)}>
                        <Download className="h-4 w-4 mr-2" />
                        Download Audit Trail
                      </DropdownMenuItem>
                    </>
                  )}
                  {workflow.status === 'in_progress' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleCancelWorkflow(workflow.id)}
                        className="text-red-600"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Cancel Request
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Progress Bar */}
            {workflow.status === 'in_progress' && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Signing Progress</span>
                  <span className="text-sm font-medium text-gray-700">
                    {workflow.signers.filter((s) => s.status === 'signed').length} of{' '}
                    {workflow.signers.length} signed
                  </span>
                </div>
                <Progress value={calculateProgress(workflow)} className="h-2" />
              </div>
            )}

            {/* Expiry Warning */}
            {workflow.status === 'in_progress' && (
              <div className="mt-3">
                {(() => {
                  const days = getDaysUntilExpiry(workflow.expiresAt);
                  return days <= 3 ? (
                    <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 p-2 rounded">
                      <AlertCircle className="h-4 w-4" />
                      <span>Expires in {days} day{days !== 1 ? 's' : ''}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>Expires {new Date(workflow.expiresAt).toLocaleDateString()}</span>
                    </div>
                  );
                })()}
              </div>
            )}
          </CardHeader>

          <CardContent className="pt-6">
            {/* Signers List */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 mb-3">Signers ({workflow.signers.length})</h4>
              {workflow.signers.map((signer, index) => (
                <div
                  key={signer.id}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {/* Order Badge */}
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold text-sm">
                    {signer.order}
                  </div>

                  {/* Signer Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-gray-900">{signer.name}</p>
                      <Badge variant="outline" className="text-xs">
                        {signer.role}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{signer.email}</p>
                    {signer.signedAt && (
                      <p className="text-xs text-gray-500 mt-1">
                        Signed {new Date(signer.signedAt).toLocaleString()}
                      </p>
                    )}
                    {signer.declinedAt && signer.declineReason && (
                      <p className="text-xs text-red-600 mt-1">
                        Declined: {signer.declineReason}
                      </p>
                    )}
                  </div>

                  {/* Status Icon */}
                  <div className="flex items-center gap-3">
                    {getSignerStatusIcon(signer.status)}
                    
                    {/* Actions for pending signers */}
                    {signer.status !== 'signed' && workflow.status === 'in_progress' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedWorkflow(workflow);
                          setSelectedSigner(signer);
                          setShowReminderDialog(true);
                        }}
                      >
                        <Bell className="h-4 w-4 mr-2" />
                        Remind
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Message */}
            {workflow.message && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900 mb-1">Message to Signers</p>
                    <p className="text-sm text-blue-700">{workflow.message}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Completed Info */}
            {workflow.status === 'completed' && workflow.completedAt && (
              <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-900">All signatures collected</p>
                      <p className="text-sm text-green-700">
                        Completed {new Date(workflow.completedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadCertificate(workflow.id)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Certificate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadAuditTrail(workflow.id)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Audit Trail
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Signature Workflow Details</DialogTitle>
            <DialogDescription>
              Complete information about this signature request
            </DialogDescription>
          </DialogHeader>

          {selectedWorkflow && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Workflow ID:</span>{' '}
                  <span className="font-mono">{selectedWorkflow.id}</span>
                </div>
                <div>
                  <span className="text-gray-600">Provider:</span>{' '}
                  <span className="font-medium">{getProviderLogo(selectedWorkflow.provider)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Created:</span>{' '}
                  <span>{new Date(selectedWorkflow.createdAt).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-600">Expires:</span>{' '}
                  <span>{new Date(selectedWorkflow.expiresAt).toLocaleString()}</span>
                </div>
              </div>

              {selectedWorkflow.completedAt && (
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-900">
                    Completed: {new Date(selectedWorkflow.completedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reminder Dialog */}
      <Dialog open={showReminderDialog} onOpenChange={setShowReminderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Reminder</DialogTitle>
            <DialogDescription>
              Send a reminder to {selectedSigner?.name} ({selectedSigner?.email})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="reminder-message">Custom Message (Optional)</Label>
              <Textarea
                id="reminder-message"
                placeholder="Add a custom message to the reminder email..."
                value={reminderMessage}
                onChange={(e) => setReminderMessage(e.target.value)}
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowReminderDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendReminder}>
                <Send className="h-4 w-4 mr-2" />
                Send Reminder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Mock data for development
const mockWorkflows: SignatureWorkflow[] = [
  {
    id: 'sig-001',
    contractId: 'contract-001',
    contractName: 'Master Service Agreement',
    provider: 'docusign',
    status: 'in_progress',
    signers: [
      {
        id: 'signer-1',
        name: 'John Smith',
        email: 'john.smith@acmecorp.com',
        role: 'Client Signatory',
        status: 'signed',
        order: 1,
        sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        viewedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        signedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        ipAddress: '192.168.1.100',
      },
      {
        id: 'signer-2',
        name: 'Sarah Johnson',
        email: 'sarah.johnson@vendor.com',
        role: 'Vendor Representative',
        status: 'viewed',
        order: 2,
        sentAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        viewedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'signer-3',
        name: 'Michael Brown',
        email: 'michael.brown@legal.com',
        role: 'Witness',
        status: 'pending',
        order: 3,
      },
    ],
    createdBy: 'Alice Anderson',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    message: 'Please review and sign this Master Service Agreement at your earliest convenience.',
  },
];
