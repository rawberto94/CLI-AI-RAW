'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XCircle, AlertTriangle, FileText, ArrowRight, ArrowLeft, CheckCircle2,
  Send, Calendar, Shield, User, Clock, Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TerminationWizardProps {
  contractId: string;
}

const STEPS = ['Reason', 'Review', 'Notifications', 'Confirm'];
const REASONS = [
  { value: 'mutual', label: 'Mutual Agreement', description: 'Both parties agree to terminate' },
  { value: 'breach', label: 'Breach of Contract', description: 'Counterparty violated terms' },
  { value: 'convenience', label: 'Termination for Convenience', description: 'Exercising contractual right to terminate' },
  { value: 'expiry', label: 'Natural Expiry', description: 'Contract reached end date' },
  { value: 'force_majeure', label: 'Force Majeure', description: 'Unforeseeable circumstances' },
  { value: 'non_renewal', label: 'Non-Renewal', description: 'Declining to renew at term end' },
];

export default function TerminationWizardClient({ contractId }: TerminationWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [notifyCounterparty, setNotifyCounterparty] = useState(true);
  const [notifyStakeholders, setNotifyStakeholders] = useState(true);
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [confirmed, setConfirmed] = useState(false);

  const { data: contract, isLoading } = useQuery({
    queryKey: ['contract-lifecycle', contractId],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${contractId}/lifecycle`);
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      return json.data;
    },
  });

  const terminateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/contracts/${contractId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'TERMINATED',
          reason,
          notes,
          effectiveDate,
          notifyCounterparty,
          notifyStakeholders,
        }),
      });
      if (!res.ok) throw new Error('Failed to terminate contract');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Contract terminated successfully');
      router.push(`/contracts/${contractId}`);
    },
    onError: () => toast.error('Failed to terminate contract'),
  });

  const canProceed = () => {
    if (step === 0) return !!reason;
    if (step === 3) return confirmed;
    return true;
  };

  const handleNext = () => {
    if (step === 3) {
      terminateMutation.mutate();
    } else {
      setStep(s => s + 1);
    }
  };

  const selectedReason = REASONS.find(r => r.value === reason);

  if (isLoading) {
    return (
      <DashboardLayout title="Terminate Contract" description="Contract termination wizard">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Terminate Contract"
      description={contract?.title || `Contract ${contractId}`}
      actions={
        <Link href={`/contracts/${contractId}`}>
          <Button variant="outline" size="sm">Cancel</Button>
        </Link>
      }
    >
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Progress Steps */}
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                i < step ? 'bg-green-500 text-white' : i === step ? 'bg-violet-600 text-white' : 'bg-muted text-muted-foreground'
              )}>
                {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span className={cn('text-sm hidden sm:inline', i === step ? 'font-medium' : 'text-muted-foreground')}>{s}</span>
              {i < STEPS.length - 1 && <div className={cn('w-8 lg:w-16 h-0.5 mx-1', i < step ? 'bg-green-500' : 'bg-muted')} />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            {/* Step 0: Reason */}
            {step === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Termination Reason</CardTitle>
                  <CardDescription>Select the reason for terminating this contract</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {REASONS.map(r => (
                    <div
                      key={r.value}
                      className={cn(
                        'flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors',
                        reason === r.value ? 'border-violet-300 bg-violet-50' : 'hover:bg-muted/50'
                      )}
                      onClick={() => setReason(r.value)}
                    >
                      <div className={cn('w-4 h-4 rounded-full border-2 mt-0.5 shrink-0', reason === r.value ? 'border-violet-600 bg-violet-600' : 'border-muted-foreground/30')} />
                      <div>
                        <p className="font-medium text-sm">{r.label}</p>
                        <p className="text-xs text-muted-foreground">{r.description}</p>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2">
                    <Label>Additional Notes</Label>
                    <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Provide details about the termination..." rows={3} className="mt-2" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 1: Review */}
            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Review Details</CardTitle>
                  <CardDescription>Confirm the termination details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-sm text-amber-800">This action cannot be easily reversed</p>
                        <p className="text-xs text-amber-700 mt-1">Terminating a contract will update its status and trigger notifications. Ensure all obligations have been reviewed.</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-sm text-muted-foreground">Contract</span>
                      <span className="text-sm font-medium">{contract?.title || contractId}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-sm text-muted-foreground">Reason</span>
                      <Badge variant="outline">{selectedReason?.label}</Badge>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-sm text-muted-foreground">Effective Date</span>
                      <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} className="text-sm border rounded px-2 py-1" />
                    </div>
                    {notes && (
                      <div className="py-2">
                        <span className="text-sm text-muted-foreground">Notes</span>
                        <p className="text-sm mt-1 bg-muted/50 rounded p-2">{notes}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Notifications */}
            {step === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>Notification Settings</CardTitle>
                  <CardDescription>Choose who should be notified</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-lg border">
                    <Checkbox checked={notifyCounterparty} onCheckedChange={v => setNotifyCounterparty(!!v)} id="notify-counterparty" />
                    <div>
                      <label htmlFor="notify-counterparty" className="font-medium text-sm cursor-pointer">Notify Counterparty</label>
                      <p className="text-xs text-muted-foreground">Send termination notice to the other party</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-lg border">
                    <Checkbox checked={notifyStakeholders} onCheckedChange={v => setNotifyStakeholders(!!v)} id="notify-stakeholders" />
                    <div>
                      <label htmlFor="notify-stakeholders" className="font-medium text-sm cursor-pointer">Notify Internal Stakeholders</label>
                      <p className="text-xs text-muted-foreground">Alert team members and approvers</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Confirm */}
            {step === 3 && (
              <Card className="border-red-200">
                <CardHeader>
                  <CardTitle className="text-red-600 flex items-center gap-2"><XCircle className="h-5 w-5" /> Final Confirmation</CardTitle>
                  <CardDescription>Review and confirm the termination</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2 text-sm">
                    <p><strong>Reason:</strong> {selectedReason?.label}</p>
                    <p><strong>Effective:</strong> {effectiveDate}</p>
                    <p><strong>Counterparty Notification:</strong> {notifyCounterparty ? 'Yes' : 'No'}</p>
                    <p><strong>Stakeholder Notification:</strong> {notifyStakeholders ? 'Yes' : 'No'}</p>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-lg border border-red-200 bg-red-50/50">
                    <Checkbox checked={confirmed} onCheckedChange={v => setConfirmed(!!v)} id="confirm-termination" />
                    <label htmlFor="confirm-termination" className="text-sm font-medium cursor-pointer">
                      I confirm that I want to terminate this contract and understand this action is final.
                    </label>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <Button onClick={handleNext} disabled={!canProceed() || terminateMutation.isPending} variant={step === 3 ? 'destructive' : 'default'}>
            {terminateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {step === 3 ? 'Terminate Contract' : 'Continue'}
            {step < 3 && <ArrowRight className="h-4 w-4 ml-2" />}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
