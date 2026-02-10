'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, FileText, Clock, User, Send, CheckCircle2,
  XCircle, Edit, ArrowRight, ArrowLeft, ChevronRight,
  GitCompare, History, AlertTriangle, Users, Plus, Loader2,
  RefreshCw, Eye,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface NegotiationRound {
  id: string;
  round: number;
  initiatedBy: string;
  status: 'pending' | 'accepted' | 'rejected' | 'countered';
  changes: { clause: string; original: string; proposed: string }[];
  message: string;
  createdAt: string;
}

interface NegotiationWorkflowProps {
  contractId: string;
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  pending: { color: 'text-amber-600', icon: Clock, label: 'Pending Review' },
  accepted: { color: 'text-green-600', icon: CheckCircle2, label: 'Accepted' },
  rejected: { color: 'text-red-600', icon: XCircle, label: 'Rejected' },
  countered: { color: 'text-violet-600', icon: GitCompare, label: 'Counter-Proposed' },
};

export default function NegotiationWorkflowClient({ contractId }: NegotiationWorkflowProps) {
  const [activeTab, setActiveTab] = useState('timeline');
  const [showProposalDialog, setShowProposalDialog] = useState(false);
  const [proposalMessage, setProposalMessage] = useState('');
  const [proposalChanges, setProposalChanges] = useState<{ clause: string; original: string; proposed: string }[]>([
    { clause: '', original: '', proposed: '' },
  ]);
  const queryClient = useQueryClient();

  const { data: contract } = useQuery({
    queryKey: ['contract-negotiate', contractId],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${contractId}/lifecycle`);
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      return json.data;
    },
  });

  // Negotiation rounds (mock initial data — in production these come from a dedicated API)
  const [rounds, setRounds] = useState<NegotiationRound[]>([
    {
      id: '1',
      round: 1,
      initiatedBy: 'Internal',
      status: 'countered',
      changes: [
        { clause: 'Payment Terms', original: 'Net 60', proposed: 'Net 30' },
        { clause: 'Liability Cap', original: '1x annual value', proposed: '2x annual value' },
      ],
      message: 'Proposing updated payment terms and liability cap based on our standard terms.',
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    },
    {
      id: '2',
      round: 2,
      initiatedBy: 'Counterparty',
      status: 'pending',
      changes: [
        { clause: 'Payment Terms', original: 'Net 30', proposed: 'Net 45' },
        { clause: 'Liability Cap', original: '2x annual value', proposed: '1.5x annual value' },
      ],
      message: 'We can meet halfway on payment terms. Proposing Net 45 as a compromise.',
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
  ]);

  const handleSubmitProposal = () => {
    const validChanges = proposalChanges.filter(c => c.clause && c.proposed);
    if (validChanges.length === 0) {
      toast.error('Add at least one clause change');
      return;
    }

    const newRound: NegotiationRound = {
      id: Date.now().toString(),
      round: rounds.length + 1,
      initiatedBy: 'Internal',
      status: 'pending',
      changes: validChanges,
      message: proposalMessage,
      createdAt: new Date().toISOString(),
    };

    setRounds(prev => [...prev, newRound]);
    setShowProposalDialog(false);
    setProposalMessage('');
    setProposalChanges([{ clause: '', original: '', proposed: '' }]);
    toast.success('Proposal submitted');
  };

  const handleAcceptRound = (roundId: string) => {
    setRounds(prev => prev.map(r => r.id === roundId ? { ...r, status: 'accepted' as const } : r));
    toast.success('Round accepted');
  };

  const handleRejectRound = (roundId: string) => {
    setRounds(prev => prev.map(r => r.id === roundId ? { ...r, status: 'rejected' as const } : r));
    toast.success('Round rejected');
  };

  const addChangeRow = () => {
    setProposalChanges(prev => [...prev, { clause: '', original: '', proposed: '' }]);
  };

  const updateChangeRow = (index: number, field: string, value: string) => {
    setProposalChanges(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  return (
    <DashboardLayout
      title="Contract Negotiation"
      description={contract?.title || `Contract ${contractId}`}
      actions={
        <div className="flex gap-2">
          <Link href={`/contracts/${contractId}`}>
            <Button size="sm" variant="outline">Back to Contract</Button>
          </Link>
          <Button size="sm" onClick={() => setShowProposalDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Proposal
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Rounds</p>
              <p className="text-2xl font-bold">{rounds.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold text-amber-600">{rounds.filter(r => r.status === 'pending').length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Accepted</p>
              <p className="text-2xl font-bold text-green-600">{rounds.filter(r => r.status === 'accepted').length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Changes</p>
              <p className="text-2xl font-bold text-violet-600">{rounds.reduce((s, r) => s + r.changes.length, 0)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Negotiation Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {rounds.length === 0 ? (
              <div className="py-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">No negotiation rounds yet</p>
                <Button size="sm" className="mt-3" onClick={() => setShowProposalDialog(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Start Negotiation
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {rounds.map((round, i) => {
                  const statusConfig = STATUS_CONFIG[round.status];
                  const StatusIcon = statusConfig.icon;
                  return (
                    <div key={round.id} className="relative">
                      {i < rounds.length - 1 && <div className="absolute left-5 top-12 bottom-0 w-px bg-border" />}
                      <div className="flex gap-4">
                        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2',
                          round.status === 'accepted' ? 'border-green-500 bg-green-50' :
                          round.status === 'rejected' ? 'border-red-500 bg-red-50' :
                          round.status === 'pending' ? 'border-amber-500 bg-amber-50' :
                          'border-violet-500 bg-violet-50'
                        )}>
                          <StatusIcon className={cn('h-4 w-4', statusConfig.color)} />
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">Round {round.round}</span>
                            <Badge variant="outline" className="text-[10px]">{round.initiatedBy}</Badge>
                            <Badge className={cn('text-[10px]', statusConfig.color, 'bg-transparent border')}>{statusConfig.label}</Badge>
                            <span className="text-xs text-muted-foreground ml-auto">{new Date(round.createdAt).toLocaleDateString()}</span>
                          </div>
                          {round.message && <p className="text-sm text-muted-foreground mb-2">{round.message}</p>}
                          <div className="space-y-1.5">
                            {round.changes.map((change, j) => (
                              <div key={j} className="flex items-center gap-2 text-xs bg-muted/50 rounded p-2">
                                <span className="font-medium">{change.clause}:</span>
                                <span className="text-red-600 line-through">{change.original}</span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <span className="text-green-600 font-medium">{change.proposed}</span>
                              </div>
                            ))}
                          </div>
                          {round.status === 'pending' && round.initiatedBy !== 'Internal' && (
                            <div className="flex gap-2 mt-3">
                              <Button size="sm" variant="outline" className="h-7 text-xs text-green-600" onClick={() => handleAcceptRound(round.id)}>
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Accept
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs text-red-600" onClick={() => handleRejectRound(round.id)}>
                                <XCircle className="h-3 w-3 mr-1" /> Reject
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowProposalDialog(true)}>
                                <GitCompare className="h-3 w-3 mr-1" /> Counter
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Proposal Dialog */}
      <Dialog open={showProposalDialog} onOpenChange={setShowProposalDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Proposal — Round {rounds.length + 1}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Message</Label>
              <Textarea value={proposalMessage} onChange={e => setProposalMessage(e.target.value)} placeholder="Describe the rationale for these changes..." rows={2} />
            </div>
            <Separator />
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Clause Changes</Label>
                <Button size="sm" variant="outline" onClick={addChangeRow} className="h-7 text-xs"><Plus className="h-3 w-3 mr-1" /> Add</Button>
              </div>
              <div className="space-y-2">
                {proposalChanges.map((change, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2">
                    <Input placeholder="Clause name" value={change.clause} onChange={e => updateChangeRow(i, 'clause', e.target.value)} className="text-xs h-8" />
                    <Input placeholder="Original text" value={change.original} onChange={e => updateChangeRow(i, 'original', e.target.value)} className="text-xs h-8" />
                    <Input placeholder="Proposed text" value={change.proposed} onChange={e => updateChangeRow(i, 'proposed', e.target.value)} className="text-xs h-8" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProposalDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmitProposal}><Send className="h-4 w-4 mr-2" /> Submit Proposal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
