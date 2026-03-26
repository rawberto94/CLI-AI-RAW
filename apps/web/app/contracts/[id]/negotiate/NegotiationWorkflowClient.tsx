'use client';

import { useState, useRef, useCallback } from 'react';
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
import {
  MessageSquare, FileText, Clock, Send, CheckCircle2,
  XCircle, ArrowRight, Sparkles,
  GitCompare, Plus, Loader2, Shield,
  BookOpen, Lightbulb, Target, AlertTriangle,
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
  responseMessage?: string;
  createdAt: string;
  respondedAt?: string;
}

interface ClausePosition {
  clauseType: string;
  clauseText: string;
  assessment: 'favorable' | 'neutral' | 'unfavorable' | 'missing' | 'non_standard';
  marketStandard: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  explanation: string;
  suggestedRedline?: string;
  negotiationStrategy: string;
  priority: number;
  fallbackPosition?: string;
}

interface NegotiationPlaybook {
  overallPosition: string;
  overallStrategy: string;
  keyObjectives: string[];
  concessionOrder: string[];
  mustHaves: string[];
  niceToHaves: string[];
  dealBreakers: string[];
  clauses: ClausePosition[];
  openingMessage: string;
  estimatedNegotiationDifficulty: string;
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

const ASSESSMENT_COLORS: Record<string, string> = {
  favorable: 'text-green-700 bg-green-50 border-green-200',
  neutral: 'text-slate-700 bg-slate-50 border-slate-200',
  unfavorable: 'text-red-700 bg-red-50 border-red-200',
  missing: 'text-amber-700 bg-amber-50 border-amber-200',
  non_standard: 'text-violet-700 bg-violet-50 border-violet-200',
};

const RISK_COLORS: Record<string, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

async function fetchCsrfToken() {
  const res = await fetch('/api/csrf-token');
  const data = await res.json();
  return data.token as string;
}

export default function NegotiationWorkflowClient({ contractId }: NegotiationWorkflowProps) {
  const [activeTab, setActiveTab] = useState('timeline');
  const [showProposalDialog, setShowProposalDialog] = useState(false);
  const [proposalMessage, setProposalMessage] = useState('');
  const [proposalChanges, setProposalChanges] = useState<{ clause: string; original: string; proposed: string }[]>([
    { clause: '', original: '', proposed: '' },
  ]);
  const [adviceQuestion, setAdviceQuestion] = useState('');
  const [adviceResponse, setAdviceResponse] = useState('');
  const [isStreamingAdvice, setIsStreamingAdvice] = useState(false);
  const adviceAbortRef = useRef<AbortController | null>(null);
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

  // Fetch negotiation rounds from API
  const { data: roundsData, isLoading: roundsLoading } = useQuery({
    queryKey: ['negotiate-rounds', contractId],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${contractId}/negotiate/rounds`);
      if (!res.ok) return { rounds: [] };
      const json = await res.json();
      return json.data || { rounds: [] };
    },
  });
  const rounds: NegotiationRound[] = roundsData?.rounds || [];

  // Fetch existing playbook
  const { data: playbookData, isLoading: playbookLoading } = useQuery({
    queryKey: ['negotiate-playbook', contractId],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${contractId}/negotiate/playbook`);
      if (!res.ok) return null;
      const json = await res.json();
      return json.data;
    },
  });
  const playbook: NegotiationPlaybook | null = playbookData?.playbook || null;

  // Generate playbook mutation
  const generatePlaybook = useMutation({
    mutationFn: async (ourRole: string = 'auto') => {
      const csrfToken = await fetchCsrfToken();
      const res = await fetch(`/api/contracts/${contractId}/negotiate/playbook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ ourRole }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || 'Failed to generate playbook');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['negotiate-playbook', contractId] });
      toast.success('AI playbook generated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Submit round mutation
  const submitRound = useMutation({
    mutationFn: async (data: { message: string; changes: { clause: string; original: string; proposed: string }[] }) => {
      const csrfToken = await fetchCsrfToken();
      const res = await fetch(`/api/contracts/${contractId}/negotiate/rounds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || 'Failed to submit proposal');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['negotiate-rounds', contractId] });
      setShowProposalDialog(false);
      setProposalMessage('');
      setProposalChanges([{ clause: '', original: '', proposed: '' }]);
      toast.success('Proposal submitted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Update round status mutation
  const updateRound = useMutation({
    mutationFn: async (data: { roundId: string; status: 'accepted' | 'rejected' | 'countered'; responseMessage?: string }) => {
      const csrfToken = await fetchCsrfToken();
      const res = await fetch(`/api/contracts/${contractId}/negotiate/rounds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update round');
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['negotiate-rounds', contractId] });
      toast.success(`Round ${vars.status}`);
    },
    onError: () => toast.error('Failed to update round'),
  });

  const handleSubmitProposal = () => {
    const validChanges = proposalChanges.filter(c => c.clause && c.proposed);
    if (validChanges.length === 0) {
      toast.error('Add at least one clause change');
      return;
    }
    submitRound.mutate({ message: proposalMessage, changes: validChanges });
  };

  // Stream AI advice
  const handleAskAdvice = useCallback(async () => {
    if (!adviceQuestion.trim() || isStreamingAdvice) return;
    setIsStreamingAdvice(true);
    setAdviceResponse('');
    const controller = new AbortController();
    adviceAbortRef.current = controller;

    try {
      const csrfToken = await fetchCsrfToken();
      const res = await fetch(`/api/contracts/${contractId}/negotiate/advice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ question: adviceQuestion }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error('Failed to get advice');
      if (!res.body) throw new Error('No response stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'content') {
              setAdviceResponse(prev => prev + event.text);
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        toast.error(err.message);
      }
    } finally {
      setIsStreamingAdvice(false);
      adviceAbortRef.current = null;
    }
  }, [adviceQuestion, isStreamingAdvice, contractId]);

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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="timeline"><Clock className="h-3.5 w-3.5 mr-1.5" />Timeline</TabsTrigger>
            <TabsTrigger value="playbook"><BookOpen className="h-3.5 w-3.5 mr-1.5" />AI Playbook</TabsTrigger>
            <TabsTrigger value="advice"><Lightbulb className="h-3.5 w-3.5 mr-1.5" />AI Advice</TabsTrigger>
          </TabsList>

          {/* Timeline Tab */}
          <TabsContent value="timeline">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Negotiation Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                {roundsLoading ? (
                  <div className="py-12 text-center"><Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" /></div>
                ) : rounds.length === 0 ? (
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
                                  <div key={`${round.id}-change-${j}`} className="flex items-center gap-2 text-xs bg-muted/50 rounded p-2">
                                    <span className="font-medium">{change.clause}:</span>
                                    <span className="text-red-600 line-through">{change.original}</span>
                                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-green-600 font-medium">{change.proposed}</span>
                                  </div>
                                ))}
                              </div>
                              {round.status === 'pending' && (
                                <div className="flex gap-2 mt-3">
                                  <Button size="sm" variant="outline" className="h-7 text-xs text-green-600" disabled={updateRound.isPending} onClick={() => updateRound.mutate({ roundId: round.id, status: 'accepted' })}>
                                    <CheckCircle2 className="h-3 w-3 mr-1" /> Accept
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 text-xs text-red-600" disabled={updateRound.isPending} onClick={() => updateRound.mutate({ roundId: round.id, status: 'rejected' })}>
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
          </TabsContent>

          {/* AI Playbook Tab */}
          <TabsContent value="playbook">
            {playbookLoading ? (
              <div className="py-12 text-center"><Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" /></div>
            ) : !playbook ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground mb-1">No AI playbook generated yet</p>
                  <p className="text-xs text-muted-foreground mb-4">Generate a negotiation strategy with clause-by-clause analysis</p>
                  <Button size="sm" onClick={() => generatePlaybook.mutate('auto')} disabled={generatePlaybook.isPending}>
                    {generatePlaybook.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    Generate AI Playbook
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Strategy Overview */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Target className="h-4 w-4 text-violet-600" /> Strategy Overview
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge className={cn(
                          playbook.overallPosition === 'strong' ? 'bg-green-100 text-green-800' :
                          playbook.overallPosition === 'moderate' ? 'bg-amber-100 text-amber-800' :
                          'bg-red-100 text-red-800'
                        )}>
                          Position: {playbook.overallPosition}
                        </Badge>
                        <Badge variant="outline">{playbook.estimatedNegotiationDifficulty}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{playbook.overallStrategy}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                        <p className="text-xs font-medium text-green-800 mb-1.5">Must-Haves</p>
                        <ul className="space-y-1">{playbook.mustHaves?.map((item, i) => (
                          <li key={i} className="text-xs text-green-700">• {item}</li>
                        ))}</ul>
                      </div>
                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                        <p className="text-xs font-medium text-amber-800 mb-1.5">Nice-to-Haves</p>
                        <ul className="space-y-1">{playbook.niceToHaves?.map((item, i) => (
                          <li key={i} className="text-xs text-amber-700">• {item}</li>
                        ))}</ul>
                      </div>
                      <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                        <p className="text-xs font-medium text-red-800 mb-1.5">Deal Breakers</p>
                        <ul className="space-y-1">{playbook.dealBreakers?.map((item, i) => (
                          <li key={i} className="text-xs text-red-700">• {item}</li>
                        ))}</ul>
                      </div>
                    </div>
                    {playbook.openingMessage && (
                      <div className="p-3 rounded-lg bg-violet-50 border border-violet-200">
                        <p className="text-xs font-medium text-violet-800 mb-1">Suggested Opening Message</p>
                        <p className="text-xs text-violet-700">{playbook.openingMessage}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Clause Analysis */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4 text-violet-600" /> Clause Analysis ({playbook.clauses?.length || 0} clauses)
                      </CardTitle>
                      <Button size="sm" variant="outline" onClick={() => generatePlaybook.mutate('auto')} disabled={generatePlaybook.isPending}>
                        {generatePlaybook.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        <span className="ml-1.5">Regenerate</span>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {playbook.clauses?.sort((a, b) => a.priority - b.priority).map((clause, i) => (
                        <div key={i} className={cn('p-3 rounded-lg border', ASSESSMENT_COLORS[clause.assessment] || ASSESSMENT_COLORS.neutral)}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs font-semibold">{clause.clauseType}</span>
                            <Badge className={cn('text-[10px]', RISK_COLORS[clause.riskLevel])}>{clause.riskLevel}</Badge>
                            <Badge variant="outline" className="text-[10px]">{clause.assessment}</Badge>
                            <span className="text-[10px] text-muted-foreground ml-auto">Priority {clause.priority}/10</span>
                          </div>
                          <p className="text-xs mb-2">{clause.explanation}</p>
                          {clause.suggestedRedline && (
                            <div className="text-xs p-2 rounded bg-white/60 border border-dashed">
                              <span className="font-medium">Redline: </span>{clause.suggestedRedline}
                            </div>
                          )}
                          <p className="text-[11px] text-muted-foreground mt-1.5 italic">{clause.negotiationStrategy}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* AI Advice Tab */}
          <TabsContent value="advice">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-violet-600" /> AI Negotiation Advisor
                </CardTitle>
                <CardDescription>Ask questions about negotiation strategy, clause interpretation, or counterparty tactics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Textarea
                    value={adviceQuestion}
                    onChange={e => setAdviceQuestion(e.target.value)}
                    placeholder="e.g., How should I respond if they reject the liability cap?"
                    rows={2}
                    className="flex-1"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAskAdvice(); } }}
                  />
                  <Button
                    onClick={handleAskAdvice}
                    disabled={!adviceQuestion.trim() || isStreamingAdvice}
                    className="shrink-0 self-end"
                  >
                    {isStreamingAdvice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
                {adviceResponse && (
                  <div className="p-4 rounded-lg bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                      <span className="text-xs font-medium text-violet-800">AI Advice</span>
                      {isStreamingAdvice && <Loader2 className="h-3 w-3 animate-spin text-violet-500 ml-1" />}
                    </div>
                    <div className="text-sm text-slate-700 whitespace-pre-wrap">{adviceResponse}</div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {['What leverage points do we have?', 'How to handle a counterproposal?', 'What clauses should we concede first?'].map(q => (
                    <Button key={q} size="sm" variant="outline" className="text-xs h-7" onClick={() => { setAdviceQuestion(q); }}>
                      {q}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
                  <div key={`proposal-change-${i}`} className="grid grid-cols-3 gap-2">
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
            <Button onClick={handleSubmitProposal} disabled={submitRound.isPending}>
              {submitRound.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Submit Proposal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
