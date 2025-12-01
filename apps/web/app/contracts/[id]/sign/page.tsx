'use client';

import React, { useState, use, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  FileText,
  User,
  Mail,
  Send,
  Pen,
  Archive,
  ArrowLeft,
  ArrowRight,
  Eye,
  Plus,
  Trash2,
  Loader2,
  Building2,
  Calendar,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface Signer {
  id: string;
  name: string;
  email: string;
  role: 'signer' | 'approver' | 'viewer';
  order: number;
  status: 'pending' | 'sent' | 'viewed' | 'signed' | 'declined';
  signedAt?: string;
}

interface ContractInfo {
  id: string;
  title: string;
  supplier: string;
  value: number;
  status: string;
}

// ============================================================================
// Workflow Steps
// ============================================================================

function WorkflowSteps({ currentStep }: { currentStep: 'approve' | 'sign' | 'store' }) {
  const steps = [
    { key: 'approve', label: 'Approved', icon: CheckCircle2, complete: true },
    { key: 'sign', label: 'Signatures', icon: Pen, complete: currentStep === 'store' },
    { key: 'store', label: 'Stored', icon: Archive, complete: false },
  ];

  return (
    <div className="flex items-center gap-3">
      {steps.map((step, idx) => {
        const Icon = step.icon;
        const isActive = step.key === currentStep;
        const isComplete = step.complete;
        
        return (
          <React.Fragment key={step.key}>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center",
                  isComplete && "bg-green-500 text-white",
                  isActive && !isComplete && "bg-blue-500 text-white",
                  !isActive && !isComplete && "bg-slate-200 text-slate-400"
                )}
              >
                {isComplete ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              <span className={cn(
                "text-sm font-medium hidden sm:inline",
                isComplete && "text-green-600",
                isActive && !isComplete && "text-blue-600",
                !isActive && !isComplete && "text-slate-400"
              )}>
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <ArrowRight className={cn(
                "w-4 h-4",
                isComplete ? "text-green-400" : "text-slate-300"
              )} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ============================================================================
// Signer Card
// ============================================================================

interface SignerCardProps {
  signer: Signer;
  onRemove: () => void;
  onResend: () => void;
}

function SignerCard({ signer, onRemove, onResend }: SignerCardProps) {
  const statusConfig = {
    pending: { label: 'Pending', color: 'bg-slate-100 text-slate-600' },
    sent: { label: 'Invitation Sent', color: 'bg-blue-100 text-blue-700' },
    viewed: { label: 'Viewed', color: 'bg-amber-100 text-amber-700' },
    signed: { label: 'Signed', color: 'bg-green-100 text-green-700' },
    declined: { label: 'Declined', color: 'bg-red-100 text-red-700' },
  };

  const status = statusConfig[signer.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:shadow-md transition-all"
    >
      {/* Order number */}
      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">
        {signer.order}
      </div>

      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
        {signer.name.charAt(0)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900">{signer.name}</span>
          <Badge variant="outline" className="text-xs capitalize">
            {signer.role}
          </Badge>
        </div>
        <p className="text-sm text-slate-500 truncate">{signer.email}</p>
      </div>

      {/* Status */}
      <Badge className={status.color}>
        {signer.status === 'signed' && <Check className="w-3 h-3 mr-1" />}
        {status.label}
      </Badge>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {signer.status !== 'signed' && signer.status !== 'pending' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onResend}
            className="text-blue-600 hover:text-blue-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        )}
        {signer.status === 'pending' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function SignaturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [contract, setContract] = useState<ContractInfo | null>(null);
  const [signers, setSigners] = useState<Signer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showAddSigner, setShowAddSigner] = useState(false);
  const [newSigner, setNewSigner] = useState({ name: '', email: '', role: 'signer' });

  // Fetch contract details
  useEffect(() => {
    async function fetchContract() {
      try {
        const res = await fetch(`/api/contracts/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.contract) {
            setContract({
              id: data.contract.id,
              title: data.contract.contractTitle || data.contract.filename || 'Untitled Contract',
              supplier: data.contract.supplierName || 'Unknown Supplier',
              value: data.contract.totalValue || 0,
              status: data.contract.status,
            });
          }
        }
      } catch (error) {
        console.error('Error fetching contract:', error);
      }
      
      // Demo signers
      setSigners([
        {
          id: 's1',
          name: 'John Smith',
          email: 'john.smith@company.com',
          role: 'signer',
          order: 1,
          status: 'pending',
        },
        {
          id: 's2',
          name: 'Sarah Johnson',
          email: 'sarah.johnson@supplier.com',
          role: 'signer',
          order: 2,
          status: 'pending',
        },
      ]);
      
      setLoading(false);
    }
    fetchContract();
  }, [id]);

  const handleAddSigner = () => {
    if (!newSigner.name || !newSigner.email) {
      toast.error('Please fill in all fields');
      return;
    }

    const signer: Signer = {
      id: `s${Date.now()}`,
      name: newSigner.name,
      email: newSigner.email,
      role: newSigner.role as Signer['role'],
      order: signers.length + 1,
      status: 'pending',
    };

    setSigners(prev => [...prev, signer]);
    setNewSigner({ name: '', email: '', role: 'signer' });
    setShowAddSigner(false);
    toast.success('Signer added');
  };

  const handleRemoveSigner = (signerId: string) => {
    setSigners(prev => {
      const filtered = prev.filter(s => s.id !== signerId);
      return filtered.map((s, idx) => ({ ...s, order: idx + 1 }));
    });
    toast.success('Signer removed');
  };

  const handleResendInvite = (signerId: string) => {
    toast.success('Invitation resent');
  };

  const handleSendForSignature = async () => {
    if (signers.length === 0) {
      toast.error('Add at least one signer');
      return;
    }

    setSending(true);
    
    // Simulate sending
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update all signers to 'sent'
    setSigners(prev => prev.map(s => ({ ...s, status: 'sent' as const })));
    
    toast.success('Contract sent for signatures!', {
      description: `${signers.length} signer(s) have been notified.`,
    });
    
    setSending(false);
  };

  const handleCompleteSignatures = () => {
    // Navigate to storage/archive
    window.location.href = `/contracts/${id}?tab=finalize`;
  };

  const allSigned = signers.length > 0 && signers.every(s => s.status === 'signed');
  const anySent = signers.some(s => s.status !== 'pending');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link href={`/contracts/${id}`}>
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              </Link>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Pen className="w-5 h-5 text-blue-500" />
                  Collect Signatures
                </h1>
                <p className="text-sm text-slate-500">
                  {contract?.title || 'Contract'}
                </p>
              </div>
            </div>
            <WorkflowSteps currentStep="sign" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-3 gap-6">
          {/* Main Panel */}
          <div className="col-span-2 space-y-6">
            {/* Signers */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5 text-blue-500" />
                    Signers
                  </CardTitle>
                  <CardDescription>
                    Add people who need to sign this contract
                  </CardDescription>
                </div>
                {!anySent && (
                  <Button
                    onClick={() => setShowAddSigner(true)}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Signer
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {signers.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-lg">
                    <User className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No signers added yet</p>
                    <Button
                      onClick={() => setShowAddSigner(true)}
                      variant="link"
                      className="mt-2"
                    >
                      Add the first signer
                    </Button>
                  </div>
                ) : (
                  signers.map(signer => (
                    <SignerCard
                      key={signer.id}
                      signer={signer}
                      onRemove={() => handleRemoveSigner(signer.id)}
                      onResend={() => handleResendInvite(signer.id)}
                    />
                  ))
                )}
              </CardContent>
            </Card>

            {/* Document Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  Document Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-[8.5/11] bg-slate-100 rounded-lg flex items-center justify-center border-2 border-dashed border-slate-300">
                  <div className="text-center">
                    <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 mb-4">Document preview</p>
                    <Link href={`/contracts/${id}`}>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Eye className="w-4 h-4" />
                        View Full Document
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contract Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contract Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Title</p>
                  <p className="font-medium text-slate-900">{contract?.title}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Supplier</p>
                  <p className="font-medium text-slate-900 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    {contract?.supplier}
                  </p>
                </div>
                {contract?.value && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Value</p>
                    <p className="font-medium text-slate-900">
                      ${contract.value.toLocaleString()}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-500 mb-1">Status</p>
                  <Badge className="bg-amber-100 text-amber-700">
                    Pending Signatures
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!anySent ? (
                  <Button
                    onClick={handleSendForSignature}
                    disabled={signers.length === 0 || sending}
                    className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
                    size="lg"
                  >
                    {sending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                    Send for Signature
                  </Button>
                ) : allSigned ? (
                  <Button
                    onClick={handleCompleteSignatures}
                    className="w-full bg-green-600 hover:bg-green-700 gap-2"
                    size="lg"
                  >
                    <Archive className="w-5 h-5" />
                    Complete & Store
                  </Button>
                ) : (
                  <div className="text-center py-4">
                    <Clock className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                    <p className="text-sm text-slate-600">
                      Waiting for signatures...
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {signers.filter(s => s.status === 'signed').length}/{signers.length} signed
                    </p>
                  </div>
                )}

                <Link href={`/contracts/${id}`} className="block">
                  <Button variant="outline" className="w-full gap-2">
                    <Eye className="w-4 h-4" />
                    View Contract
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Help */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">What happens next?</p>
                    <ul className="space-y-1 text-blue-700">
                      <li>• Signers receive email invitations</li>
                      <li>• They review and sign the document</li>
                      <li>• Once all sign, contract is stored</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Add Signer Dialog */}
      <Dialog open={showAddSigner} onOpenChange={setShowAddSigner}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-500" />
              Add Signer
            </DialogTitle>
            <DialogDescription>
              Add a person who needs to sign this contract
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={newSigner.name}
                onChange={(e) => setNewSigner(prev => ({ ...prev, name: e.target.value }))}
                placeholder="John Smith"
              />
            </div>
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={newSigner.email}
                onChange={(e) => setNewSigner(prev => ({ ...prev, email: e.target.value }))}
                placeholder="john@example.com"
              />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select
                value={newSigner.role}
                onValueChange={(value) => setNewSigner(prev => ({ ...prev, role: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="signer">Signer</SelectItem>
                  <SelectItem value="approver">Approver</SelectItem>
                  <SelectItem value="viewer">Viewer (CC)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSigner(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSigner}>
              Add Signer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
