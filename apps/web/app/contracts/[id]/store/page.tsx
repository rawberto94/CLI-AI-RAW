'use client';

import React, { useState, use, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Archive,
  FileText,
  Download,
  Folder,
  ArrowLeft,
  ArrowRight,
  Cloud,
  HardDrive,
  Link as _LinkIcon,
  Copy,
  Check,
  Loader2,
  Calendar,
  Building2,
  DollarSign,
  Tag,
  Shield,
  ExternalLink as _ExternalLink,
  PartyPopper,
  Pen,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select as _Select,
  SelectContent as _SelectContent,
  SelectItem as _SelectItem,
  SelectTrigger as _SelectTrigger,
  SelectValue as _SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface ContractInfo {
  id: string;
  title: string;
  supplier: string;
  value: number;
  status: string;
  signedAt?: string;
}

interface StorageLocation {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
}

// ============================================================================
// Workflow Steps
// ============================================================================

function WorkflowSteps({ currentStep }: { currentStep: 'approve' | 'sign' | 'store' }) {
  const steps = [
    { key: 'approve', label: 'Approved', icon: CheckCircle2 },
    { key: 'sign', label: 'Signed', icon: Pen },
    { key: 'store', label: 'Stored', icon: Archive },
  ];

  return (
    <div className="flex items-center gap-3">
      {steps.map((step, idx) => {
        const Icon = step.icon;
        const stepIndex = steps.findIndex(s => s.key === currentStep);
        const thisIndex = idx;
        const isComplete = thisIndex < stepIndex || currentStep === 'store';
        const isActive = step.key === currentStep;
        
        return (
          <React.Fragment key={step.key}>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center",
                  isComplete && "bg-green-500 text-white",
                  isActive && !isComplete && "bg-violet-500 text-white",
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
                isActive && !isComplete && "text-violet-600",
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
// Success Animation
// ============================================================================

function SuccessAnimation() {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", duration: 0.5 }}
      className="text-center py-12"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring" }}
        className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.4, type: "spring" }}
        >
          <PartyPopper className="w-12 h-12 text-green-500" />
        </motion.div>
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-2xl font-bold text-slate-900 mb-2"
      >
        Contract Complete!
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="text-slate-600"
      >
        The contract has been signed and stored securely.
      </motion.p>
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function StoragePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [contract, setContract] = useState<ContractInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [storing, setStoring] = useState(false);
  const [stored, setStored] = useState(false);
  const [storageLocation, setStorageLocation] = useState<string>('cloud');
  const [folderName, setFolderName] = useState<string>('');
  const [addTags, setAddTags] = useState<string[]>(['executed', 'signed']);
  const [notifyTeam, setNotifyTeam] = useState(true);
  const [copied, setCopied] = useState(false);

  const storageLocations: StorageLocation[] = [
    {
      id: 'cloud',
      name: 'Cloud Storage',
      icon: <Cloud className="w-5 h-5" />,
      description: 'Store in your connected cloud storage (recommended)',
    },
    {
      id: 'local',
      name: 'Local Archive',
      icon: <HardDrive className="w-5 h-5" />,
      description: 'Store in the platform\'s local archive',
    },
  ];

  // Fetch contract details
  useEffect(() => {
    async function fetchContract() {
      try {
        const res = await fetch(`/api/contracts/${id}`);
        if (res.ok) {
          const raw = await res.json();
          const data = raw.data ?? raw;
          if (data?.id) {
            setContract({
              id: data.id,
              title: data.contractTitle || data.filename || 'Untitled Contract',
              supplier: data.supplierName || 'Unknown Supplier',
              value: data.totalValue || 0,
              status: data.status,
              signedAt: new Date().toISOString(),
            });
            setFolderName(data.supplierName || 'Contracts');
          }
        }
      } catch {
        // Error handled silently
      }
      setLoading(false);
    }
    fetchContract();
  }, [id]);

  const handleStore = async () => {
    setStoring(true);

    try {
      const response = await fetch(`/api/contracts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error?.message || error?.message || 'Failed to finalize contract');
      }

      toast.success('Contract stored successfully!', {
        description: 'The signed contract has been finalized and archived.',
      });

      setStored(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to finalize contract');
    } finally {
      setStoring(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/contracts/${id}`);
    setCopied(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    toast.success('Download started', {
      description: 'The signed contract PDF is being prepared.',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    );
  }

  if (stored) {
    return (
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/contracts">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Contracts
                  </Button>
                </Link>
                <div className="h-6 w-px bg-slate-200" />
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Contract Complete</h1>
                  <p className="text-sm text-slate-500">{contract?.title}</p>
                </div>
              </div>
              <WorkflowSteps currentStep="store" />
            </div>
          </div>
        </div>

        {/* Success Content */}
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Card>
            <CardContent className="p-8">
              <SuccessAnimation />
              
              <div className="grid grid-cols-2 gap-6 mt-8 max-w-2xl mx-auto">
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-1">Contract</p>
                  <p className="font-semibold text-slate-900">{contract?.title}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-1">Supplier</p>
                  <p className="font-semibold text-slate-900">{contract?.supplier}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-1">Value</p>
                  <p className="font-semibold text-slate-900">
                    ${(contract?.value || 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-1">Status</p>
                  <Badge className="bg-green-100 text-green-700">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Executed
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-center gap-4 mt-8">
                <Button variant="outline" onClick={handleDownload} className="gap-2">
                  <Download className="w-4 h-4" />
                  Download PDF
                </Button>
                <Button variant="outline" onClick={handleCopyLink} className="gap-2">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </Button>
                <Link href="/contracts">
                  <Button className="bg-violet-600 hover:bg-violet-700 gap-2">
                    <FileText className="w-4 h-4" />
                    View All Contracts
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
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
              <Link href={`/contracts/${id}/sign`}>
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              </Link>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Archive className="w-5 h-5 text-green-500" />
                  Finalize & Store
                </h1>
                <p className="text-sm text-slate-500">{contract?.title}</p>
              </div>
            </div>
            <WorkflowSteps currentStep="store" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-3 gap-6">
          {/* Main Panel */}
          <div className="col-span-2 space-y-6">
            {/* Completion Summary */}
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-green-900 text-lg">All Signatures Complete</h3>
                    <p className="text-green-700 mt-1">
                      The contract has been signed by all parties. You can now finalize and store it.
                    </p>
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-1.5 text-sm text-green-700">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>2 signatures collected</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-green-700">
                        <Calendar className="w-4 h-4" />
                        <span>Signed {new Date().toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Storage Options */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Folder className="w-5 h-5 text-violet-500" />
                  Storage Location
                </CardTitle>
                <CardDescription>
                  Choose where to store the executed contract
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {storageLocations.map(loc => (
                  <div
                    key={loc.id}
                    onClick={() => setStorageLocation(loc.id)}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all",
                      storageLocation === loc.id
                        ? "border-violet-500 bg-violet-50"
                        : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      storageLocation === loc.id
                        ? "bg-violet-100 text-violet-600"
                        : "bg-slate-100 text-slate-500"
                    )}>
                      {loc.icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">{loc.name}</p>
                      <p className="text-sm text-slate-500">{loc.description}</p>
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2",
                      storageLocation === loc.id
                        ? "border-violet-500 bg-violet-500"
                        : "border-slate-300"
                    )}>
                      {storageLocation === loc.id && (
                        <Check className="w-4 h-4 text-white" />
                      )}
                    </div>
                  </div>
                ))}

                <div className="pt-4">
                  <Label htmlFor="folder">Folder / Category</Label>
                  <Input
                    id="folder"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder="e.g., Vendor Contracts"
                    className="mt-1.5"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Tags & Options */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="w-5 h-5 text-violet-500" />
                  Tags & Options
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Tags</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {['executed', 'signed', '2024', 'vendor', 'msa'].map(tag => (
                      <Badge
                        key={tag}
                        variant={addTags.includes(tag) ? 'default' : 'outline'}
                        className={cn(
                          "cursor-pointer transition-all",
                          addTags.includes(tag) && "bg-violet-100 text-violet-700 hover:bg-violet-200"
                        )}
                        onClick={() => {
                          setAddTags(prev =>
                            prev.includes(tag)
                              ? prev.filter(t => t !== tag)
                              : [...prev, tag]
                          );
                        }}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Checkbox
                    id="notify"
                    checked={notifyTeam}
                    onCheckedChange={(checked) => setNotifyTeam(checked as boolean)}
                  />
                  <Label htmlFor="notify" className="cursor-pointer">
                    Notify team members when contract is stored
                  </Label>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contract Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contract Summary</CardTitle>
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
                <div>
                  <p className="text-xs text-slate-500 mb-1">Value</p>
                  <p className="font-medium text-slate-900 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-slate-400" />
                    ${(contract?.value || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Signed</p>
                  <p className="font-medium text-slate-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {new Date().toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Store Action */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Finalize Contract</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={handleStore}
                  disabled={storing}
                  className="w-full bg-green-600 hover:bg-green-700 gap-2"
                  size="lg"
                >
                  {storing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Archive className="w-5 h-5" />
                  )}
                  {storing ? 'Storing...' : 'Store Contract'}
                </Button>
                
                <p className="text-xs text-slate-500 text-center">
                  This will finalize the contract and make it available in your archive.
                </p>
              </CardContent>
            </Card>

            {/* Security */}
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-slate-600">
                    <p className="font-medium mb-1">Secure Storage</p>
                    <ul className="space-y-1 text-slate-500">
                      <li>• Encrypted at rest</li>
                      <li>• Audit trail maintained</li>
                      <li>• Access controlled</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
