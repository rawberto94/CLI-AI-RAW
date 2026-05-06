/**
 * RFx Detail Page — HITL Workflow
 *
 * /contigo-labs/rfx/[id]
 *
 * Full lifecycle management for a single RFx event:
 * - Requirements editor (user + AI-generated, editable)
 * - Vendor management panel
 * - Bid collection & comparison matrix
 * - AI evaluation & scoring
 * - Award decision with justification
 * - Negotiation workspace
 *
 * Every critical action requires human confirmation (HITL).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useConfirm } from '@/components/dialogs/ConfirmDialog';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Edit3,
  FileText,
  Loader2,
  Plus,
  Send,
  Shield,
  Sparkles,
  Star,
  Trophy,
  Users,
  X,
  BarChart3,
  Layers,
  Target,
  AlertTriangle,
  MessageSquare,
  Trash2,
  Save,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

interface RFxRequirement {
  title: string;
  description?: string;
  category: string;
  priority: string;
  source: 'user' | 'ai';
}

interface EvaluationCriterion {
  name: string;
  description?: string;
  weight: number;
  scoringMethod: string;
}

interface VendorResponse {
  vendorName: string;
  commercialResponse?: {
    totalPrice: number;
    breakdown?: Record<string, number>;
    paymentTerms?: string;
  };
  strengths?: string[];
  weaknesses?: string[];
  submittedAt?: string;
  scores?: Record<string, number>;
  totalScore?: number;
}

interface WorkflowStage {
  key: string;
  label: string;
  icon: string;
  status: 'completed' | 'current' | 'pending';
}

interface VendorProfile {
  name: string;
  contractCount: number;
  avgValue: number;
  latestContract?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function RFxDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [event, setEvent] = useState<any>(null);
  const [workflow, setWorkflow] = useState<WorkflowStage[]>([]);
  const [vendorProfiles, setVendorProfiles] = useState<VendorProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'requirements' | 'vendors' | 'bids' | 'evaluation' | 'negotiate'>('requirements');
  const [editingReqs, setEditingReqs] = useState(false);

  // Bid entry form
  const [newBid, setNewBid] = useState({ vendorName: '', totalPrice: '', strengths: '', weaknesses: '' });

  // Negotiation form
  const [negoForm, setNegoForm] = useState({ vendorName: '', currentBid: '', targetPrice: '' });
  const [negoResult, setNegoResult] = useState<any>(null);

  // Evaluation result
  const [evalResult, setEvalResult] = useState<any>(null);

  // AI suggestion state
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  // ── Fetch RFx event ────────────────────────────────────────────────────
  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch(`/api/rfx/${id}`);
      if (res.status === 503) {
        toast.error('RFx module is currently disabled');
        router.push('/contigo-labs');
        return;
      }
      const data = await res.json();
      if (data.data?.event) {
        setEvent(data.data.event);
        setWorkflow(data.data.workflow || []);
        setVendorProfiles(data.data.vendorProfiles || []);
      } else {
        toast.error('RFx event not found');
        router.push('/contigo-labs');
      }
    } catch {
      toast.error('Failed to load RFx event');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { fetchEvent(); }, [fetchEvent]);

  // ── PATCH helper ───────────────────────────────────────────────────────
  const patchEvent = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/rfx/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.data?.event) {
        setEvent(data.data.event);
        return data.data;
      } else {
        toast.error(data.error?.message || 'Update failed');
        return null;
      }
    } catch {
      toast.error('Network error');
      return null;
    } finally {
      setSaving(false);
    }
  };

  // ── Actions ────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    const result = await patchEvent({ action: 'publish' });
    if (result) {
      toast.success('RFx published! Vendors can now submit bids.');
      fetchEvent();
    }
  };

  const handleAddBid = async () => {
    if (!newBid.vendorName || !newBid.totalPrice) return toast.error('Vendor name and price are required');
    const result = await patchEvent({
      action: 'add_bid',
      vendorName: newBid.vendorName,
      bid: {
        commercialResponse: { totalPrice: parseFloat(newBid.totalPrice) },
        strengths: newBid.strengths ? newBid.strengths.split(',').map(s => s.trim()) : [],
        weaknesses: newBid.weaknesses ? newBid.weaknesses.split(',').map(s => s.trim()) : [],
      },
    });
    if (result) {
      toast.success(`Bid from ${newBid.vendorName} recorded`);
      setNewBid({ vendorName: '', totalPrice: '', strengths: '', weaknesses: '' });
      fetchEvent();
    }
  };

  const handleEvaluate = async () => {
    const result = await patchEvent({ action: 'evaluate' });
    if (result) {
      setEvalResult(result.evaluation);
      toast.success('AI evaluation complete');
      setActiveTab('evaluation');
      fetchEvent();
    }
  };

  const handleAward = async (winner: string) => {
    const result = await patchEvent({ action: 'award', winner });
    if (result) {
      toast.success(`Award to ${winner} confirmed`);
      fetchEvent();
    }
  };

  const handleNegotiate = async () => {
    if (!negoForm.vendorName || !negoForm.currentBid || !negoForm.targetPrice) {
      return toast.error('All negotiation fields are required');
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/rfx/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'negotiate',
          vendorName: negoForm.vendorName,
          currentBid: parseFloat(negoForm.currentBid),
          targetPrice: parseFloat(negoForm.targetPrice),
        }),
      });
      const data = await res.json();
      if (data.data?.strategy) {
        setNegoResult(data.data.strategy);
        toast.success('Negotiation strategy generated');
      }
    } catch {
      toast.error('Failed to generate strategy');
    } finally {
      setSaving(false);
    }
  };

  const handleAiEnhance = async () => {
    setAiLoading(true);
    try {
      const res = await fetch(`/api/rfx/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai_enhance_requirements' }),
      });
      const data = await res.json();
      setAiSuggestions(data.data?.suggestions || []);
      if (data.data?.suggestions?.length > 0) {
        toast.success(`AI suggests ${data.data.suggestions.length} additional requirements`);
      } else {
        toast.info('AI has no additional suggestions — your requirements look comprehensive');
      }
    } catch {
      toast.error('AI enhancement failed');
    } finally {
      setAiLoading(false);
    }
  };

  const acceptAiSuggestion = async (suggestion: any) => {
    const currentReqs = (event.requirements || []) as RFxRequirement[];
    const newReqs = [...currentReqs, { ...suggestion, source: 'ai' as const }];
    const result = await patchEvent({ action: 'update_requirements', requirements: newReqs });
    if (result) {
      setAiSuggestions(prev => prev.filter(s => s.title !== suggestion.title));
      toast.success(`Added: ${suggestion.title}`);
    }
  };

  const removeRequirement = async (idx: number) => {
    const currentReqs = (event.requirements || []) as RFxRequirement[];
    const newReqs = currentReqs.filter((_, i) => i !== idx);
    await patchEvent({ action: 'update_requirements', requirements: newReqs });
  };

  const handleCancel = async () => {
    const ok = await confirm({
      title: 'Cancel this RFx?',
      description: 'Vendors will be notified and the event will be closed. This cannot be undone.',
      confirmText: 'Cancel RFx',
      cancelText: 'Keep open',
      variant: 'warning',
      destructive: true,
    });
    if (!ok) return;
    await patchEvent({ action: 'cancel', reason: 'Cancelled by user' });
    toast.success('RFx cancelled');
    fetchEvent();
  };

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-lg font-medium">Loading RFx event...</span>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">RFx Not Found</h2>
          <Button onClick={() => router.push('/contigo-labs')}>Back to Labs</Button>
        </div>
      </div>
    );
  }

  const requirements = (event.requirements || []) as RFxRequirement[];
  const criteria = (event.evaluationCriteria || []) as EvaluationCriterion[];
  const responses = (event.responses || []) as VendorResponse[];
  const userReqs = requirements.filter(r => r.source === 'user');
  const aiReqs = requirements.filter(r => r.source === 'ai');

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push('/contigo-labs')} className="h-9 w-9">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-slate-900">{event.title}</h1>
                  <Badge variant="secondary" className="font-bold">{event.type}</Badge>
                  <Badge
                    className={cn(
                      'font-bold capitalize',
                      event.status === 'draft' && 'bg-slate-100 text-slate-700',
                      event.status === 'published' && 'bg-blue-100 text-blue-700',
                      event.status === 'open' && 'bg-emerald-100 text-emerald-700',
                      event.status === 'closed' && 'bg-amber-100 text-amber-700',
                      event.status === 'awarded' && 'bg-violet-100 text-violet-700',
                      event.status === 'cancelled' && 'bg-red-100 text-red-700',
                    )}
                  >
                    {event.status}
                  </Badge>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">
                  {event.description?.slice(0, 100)}{event.description?.length > 100 ? '...' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {event.status === 'draft' && (
                <Button onClick={handlePublish} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Send className="w-4 h-4 mr-2" />
                  Publish
                </Button>
              )}
              {(event.status === 'open' || event.status === 'published') && responses.length >= 2 && (
                <Button onClick={handleEvaluate} disabled={saving} className="bg-violet-600 hover:bg-violet-700 text-white">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Evaluate Bids
                </Button>
              )}
              {event.status !== 'cancelled' && event.status !== 'awarded' && (
                <Button variant="outline" onClick={handleCancel} disabled={saving} className="text-red-600 border-red-200 hover:bg-red-50">
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              )}
            </div>
          </div>

          {/* Workflow progress */}
          <div className="flex items-center gap-2 mt-4">
            {workflow.map((stage, idx) => (
              <div key={stage.key} className="flex items-center gap-2">
                <div className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors',
                  stage.status === 'completed' && 'bg-emerald-100 text-emerald-700',
                  stage.status === 'current' && 'bg-violet-100 text-violet-700 ring-2 ring-violet-300',
                  stage.status === 'pending' && 'bg-slate-100 text-slate-400',
                )}>
                  {stage.status === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                  {stage.label}
                </div>
                {idx < workflow.length - 1 && <div className="w-6 h-px bg-slate-300" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="max-w-[1600px] mx-auto px-6 py-4">
        <div className="grid grid-cols-5 gap-4">
          <StatCard label="Requirements" value={requirements.length} sub={`${userReqs.length} user + ${aiReqs.length} AI`} />
          <StatCard label="Vendors" value={event.invitedVendors?.length || 0} sub="invited" />
          <StatCard label="Bids" value={responses.length} sub="received" />
          <StatCard label="Est. Value" value={event.estimatedValue ? `$${(event.estimatedValue / 1000).toFixed(0)}K` : '—'} sub={event.currency || 'USD'} />
          <StatCard label="Deadline" value={event.responseDeadline ? new Date(event.responseDeadline).toLocaleDateString() : '—'} sub="response due" />
        </div>
      </div>

      {/* Tab navigation */}
      <div className="max-w-[1600px] mx-auto px-6">
        <div className="flex gap-1 border-b border-slate-200 mb-6">
          {[
            { key: 'requirements', label: 'Requirements', icon: FileText, count: requirements.length },
            { key: 'vendors', label: 'Vendors & Bids', icon: Users, count: responses.length },
            { key: 'evaluation', label: 'Evaluation', icon: BarChart3 },
            { key: 'negotiate', label: 'Negotiate', icon: MessageSquare },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors',
                activeTab === tab.key
                  ? 'border-violet-600 text-violet-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1 text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Requirements Tab ─────────────────────────────────────────── */}
        {activeTab === 'requirements' && (
          <div className="space-y-6 pb-12">
            {/* AI Enhancement */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Requirements ({requirements.length})</h2>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleAiEnhance} disabled={aiLoading} className="text-violet-600 border-violet-200 hover:bg-violet-50">
                  {aiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  AI Suggest More
                </Button>
              </div>
            </div>

            {/* AI Suggestions */}
            {aiSuggestions.length > 0 && (
              <Card className="border-violet-200 bg-violet-50/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold text-violet-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> AI Suggestions ({aiSuggestions.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {aiSuggestions.map((s, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-white border border-violet-200 rounded-lg">
                      <div className="flex-1">
                        <span className="text-sm font-medium text-slate-900">{s.title}</span>
                        <p className="text-xs text-slate-600 mt-0.5">{s.description}</p>
                        {s.rationale && <p className="text-xs text-violet-600 mt-1 italic">{s.rationale}</p>}
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">{s.category}</Badge>
                      <Button size="sm" className="shrink-0 bg-violet-600 hover:bg-violet-700 text-white h-7 text-xs" onClick={() => acceptAiSuggestion(s)}>
                        <Check className="w-3 h-3 mr-1" /> Accept
                      </Button>
                      <Button size="sm" variant="ghost" className="shrink-0 h-7 text-xs text-slate-400" onClick={() => setAiSuggestions(prev => prev.filter((_, i) => i !== idx))}>
                        Dismiss
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* User Requirements */}
            {userReqs.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Your Requirements ({userReqs.length})
                </h3>
                {userReqs.map((req, idx) => {
                  const globalIdx = requirements.indexOf(req);
                  return (
                    <ReqCard key={idx} req={req} onRemove={() => removeRequirement(globalIdx)} editable={event.status === 'draft'} />
                  );
                })}
              </div>
            )}

            {/* AI Requirements */}
            {aiReqs.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> AI-Generated Requirements ({aiReqs.length})
                </h3>
                {aiReqs.map((req, idx) => {
                  const globalIdx = requirements.indexOf(req);
                  return (
                    <ReqCard key={idx} req={req} onRemove={() => removeRequirement(globalIdx)} editable={event.status === 'draft'} isAi />
                  );
                })}
              </div>
            )}

            {/* Evaluation Criteria */}
            {criteria.length > 0 && (
              <div className="space-y-2 mt-8">
                <h3 className="text-sm font-bold text-slate-700">Evaluation Criteria</h3>
                <div className="grid grid-cols-2 gap-3">
                  {criteria.map((c, idx) => (
                    <div key={idx} className="p-3 bg-white border border-slate-200 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-900">{c.name}</span>
                        <span className="text-xs font-bold text-violet-600">{Math.round(c.weight * 100)}%</span>
                      </div>
                      <p className="text-xs text-slate-500">{c.description}</p>
                      <Badge variant="outline" className="text-[10px] mt-1">{c.scoringMethod}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Vendors & Bids Tab ───────────────────────────────────────── */}
        {activeTab === 'vendors' && (
          <div className="space-y-6 pb-12">
            {/* Invited Vendors */}
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-3">Invited Vendors ({event.invitedVendors?.length || 0})</h2>
              <div className="grid grid-cols-2 gap-3">
                {(event.invitedVendors || []).map((vendor: string, idx: number) => {
                  const profile = vendorProfiles.find(v => v.name === vendor);
                  const hasBid = responses.some(r => r.vendorName === vendor);
                  return (
                    <div key={idx} className="p-4 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-600">
                          {vendor.charAt(0)}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900">{vendor}</span>
                          {profile && (
                            <p className="text-xs text-slate-500">
                              {profile.contractCount} contracts, avg ${(profile.avgValue / 1000).toFixed(0)}K
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge className={hasBid ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                        {hasBid ? 'Bid Received' : 'Pending'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Add Bid Form */}
            {event.status !== 'awarded' && event.status !== 'cancelled' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold">Record Vendor Bid</CardTitle>
                  <CardDescription className="text-xs">Enter a vendor&apos;s bid details manually</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700">Vendor Name</label>
                      <Input
                        value={newBid.vendorName}
                        onChange={e => setNewBid({ ...newBid, vendorName: e.target.value })}
                        placeholder="e.g., TechCorp Solutions"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700">Total Price ($)</label>
                      <Input
                        type="number"
                        value={newBid.totalPrice}
                        onChange={e => setNewBid({ ...newBid, totalPrice: e.target.value })}
                        placeholder="250000"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700">Strengths (comma-separated)</label>
                      <Input
                        value={newBid.strengths}
                        onChange={e => setNewBid({ ...newBid, strengths: e.target.value })}
                        placeholder="Fast delivery, experienced team"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700">Weaknesses (comma-separated)</label>
                      <Input
                        value={newBid.weaknesses}
                        onChange={e => setNewBid({ ...newBid, weaknesses: e.target.value })}
                        placeholder="Higher price, limited references"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <Button onClick={handleAddBid} disabled={saving || !newBid.vendorName || !newBid.totalPrice}>
                    <Plus className="w-4 h-4 mr-2" />
                    Record Bid
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Existing Bids */}
            {responses.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-3">Received Bids ({responses.length})</h3>
                <div className="space-y-2">
                  {responses.map((r, idx) => (
                    <div key={idx} className="p-4 bg-white border border-slate-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-slate-900">{r.vendorName}</span>
                        <span className="text-lg font-bold text-emerald-700">
                          ${r.commercialResponse?.totalPrice?.toLocaleString() || '—'}
                        </span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {r.strengths?.map((s, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] text-emerald-700 border-emerald-200">{s}</Badge>
                        ))}
                        {r.weaknesses?.map((w, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] text-red-600 border-red-200">{w}</Badge>
                        ))}
                      </div>
                      {r.totalScore !== undefined && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs font-bold text-violet-700">Score: {r.totalScore.toFixed(2)}</span>
                          {r.scores && Object.entries(r.scores).map(([k, v]) => (
                            <span key={k} className="text-[10px] text-slate-500">{k}: {(v as number).toFixed(1)}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Evaluation Tab ───────────────────────────────────────────── */}
        {activeTab === 'evaluation' && (
          <div className="space-y-6 pb-12">
            {evalResult || event.status === 'closed' || event.status === 'awarded' ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900">Bid Evaluation</h2>
                  {event.status === 'closed' && evalResult?.recommendation?.winner && (
                    <Button
                      onClick={() => handleAward(evalResult.recommendation.winner)}
                      disabled={saving}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Trophy className="w-4 h-4 mr-2" />
                      Award to {evalResult.recommendation.winner}
                    </Button>
                  )}
                </div>

                {/* Recommendation card */}
                {(evalResult?.recommendation || event.winner) && (
                  <Card className="border-emerald-200 bg-emerald-50/30">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3 mb-3">
                        <Trophy className="w-6 h-6 text-emerald-600" />
                        <div>
                          <p className="font-bold text-emerald-900">
                            {event.winner ? `Awarded to: ${event.winner}` : `Recommended: ${evalResult?.recommendation?.winner}`}
                          </p>
                          <p className="text-sm text-emerald-700">
                            Confidence: {((evalResult?.recommendation?.confidence || 0) * 100).toFixed(0)}%
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-slate-700">{evalResult?.recommendation?.justification || event.awardJustification}</p>
                      {evalResult?.recommendation?.risks?.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-bold text-amber-700 mb-1">Risks:</p>
                          <ul className="text-xs text-amber-600 list-disc list-inside">
                            {evalResult.recommendation.risks.map((r: string, i: number) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Rankings */}
                {evalResult?.rankings && (
                  <div>
                    <h3 className="text-sm font-bold text-slate-700 mb-3">Rankings</h3>
                    <div className="space-y-2">
                      {evalResult.rankings.map((r: any, idx: number) => (
                        <div key={idx} className={cn(
                          'flex items-center justify-between p-4 bg-white border rounded-lg',
                          idx === 0 && 'border-emerald-300 bg-emerald-50/30',
                        )}>
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm',
                              idx === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600',
                            )}>
                              #{r.rank}
                            </span>
                            <span className="font-semibold text-slate-900">{r.vendor}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-bold text-violet-700">{r.score.toFixed(2)} pts</span>
                            {event.status === 'closed' && idx !== 0 && (
                              <Button size="sm" variant="outline" onClick={() => handleAward(r.vendor)} className="h-7 text-xs">
                                Award
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Price analysis */}
                {evalResult?.priceAnalysis && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-bold">Price Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-slate-500">Lowest</p>
                          <p className="font-bold text-emerald-700">{evalResult.priceAnalysis.lowest}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Highest</p>
                          <p className="font-bold text-red-600">{evalResult.priceAnalysis.highest}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Average</p>
                          <p className="font-bold text-slate-900">${evalResult.priceAnalysis.average?.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Spread</p>
                          <p className="font-bold text-slate-900">${evalResult.priceAnalysis.spread?.toLocaleString()}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <div className="text-center py-16">
                <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-900 mb-2">No Evaluation Yet</h3>
                <p className="text-sm text-slate-500 mb-4">
                  {responses.length < 2
                    ? `Need at least 2 bids to evaluate (have ${responses.length}). Go to the Vendors & Bids tab to record bids.`
                    : 'Ready to evaluate! Click the button below to let AI score and rank all bids.'}
                </p>
                {responses.length >= 2 && (
                  <Button onClick={handleEvaluate} disabled={saving} className="bg-violet-600 hover:bg-violet-700 text-white">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Run AI Evaluation
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Negotiate Tab ────────────────────────────────────────────── */}
        {activeTab === 'negotiate' && (
          <div className="space-y-6 pb-12">
            <h2 className="text-lg font-bold text-slate-900">Negotiation Workspace</h2>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold">Generate Negotiation Strategy</CardTitle>
                <CardDescription className="text-xs">AI will analyze the situation and provide leverage points, counteroffers, and a walk-away price.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Vendor Name</label>
                    <Input
                      value={negoForm.vendorName}
                      onChange={e => setNegoForm({ ...negoForm, vendorName: e.target.value })}
                      placeholder="Vendor name"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Current Bid ($)</label>
                    <Input
                      type="number"
                      value={negoForm.currentBid}
                      onChange={e => setNegoForm({ ...negoForm, currentBid: e.target.value })}
                      placeholder="300000"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700">Target Price ($)</label>
                    <Input
                      type="number"
                      value={negoForm.targetPrice}
                      onChange={e => setNegoForm({ ...negoForm, targetPrice: e.target.value })}
                      placeholder="250000"
                      className="mt-1"
                    />
                  </div>
                </div>
                <Button onClick={handleNegotiate} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  Generate Strategy
                </Button>
              </CardContent>
            </Card>

            {/* Strategy result */}
            {negoResult && (
              <Card className="border-blue-200 bg-blue-50/30">
                <CardHeader>
                  <CardTitle className="text-sm font-bold text-blue-900">
                    <MessageSquare className="w-4 h-4 inline mr-2" />
                    Negotiation Strategy for {negoForm.vendorName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-slate-700 mb-1">Opening Position</p>
                    <p className="text-sm text-slate-700">{negoResult.openingPosition}</p>
                  </div>
                  {negoResult.keyLevers?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-700 mb-1">Key Levers</p>
                      <ul className="text-sm text-slate-700 list-disc list-inside space-y-0.5">
                        {negoResult.keyLevers.map((l: string, i: number) => (
                          <li key={i}>{l}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-bold text-slate-700 mb-1">Concession Strategy</p>
                    <p className="text-sm text-slate-700">{negoResult.concessionStrategy}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-white rounded-lg border border-blue-200">
                      <p className="text-xs text-slate-500">Walk-Away Price</p>
                      <p className="text-lg font-bold text-red-600">${negoResult.walkAwayPrice?.toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-blue-200">
                      <p className="text-xs text-slate-500">Est. Savings</p>
                      <p className="text-lg font-bold text-emerald-700">${negoResult.estimatedSavings?.toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-blue-200">
                      <p className="text-xs text-slate-500">Timeline</p>
                      <p className="text-sm font-bold text-slate-700">{negoResult.suggestedTimeline}</p>
                    </div>
                  </div>
                  {negoResult.counterOffers?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-700 mb-1">Counter-Offers</p>
                      <div className="space-y-2">
                        {negoResult.counterOffers.map((co: any, i: number) => (
                          <div key={i} className="flex items-center gap-3 p-2 bg-white border border-blue-200 rounded-lg">
                            <span className="font-bold text-sm text-blue-700">${co.amount?.toLocaleString()}</span>
                            <span className="text-xs text-slate-600">{co.justification}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function StatCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className="text-xl font-bold text-slate-900 mt-1">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

function ReqCard({
  req,
  onRemove,
  editable = false,
  isAi = false,
}: {
  req: RFxRequirement;
  onRemove: () => void;
  editable?: boolean;
  isAi?: boolean;
}) {
  return (
    <div className={cn(
      'flex items-start gap-3 p-3 border rounded-lg',
      isAi ? 'bg-violet-50/30 border-violet-200' : 'bg-white border-slate-200',
    )}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-900">{req.title}</span>
        </div>
        {req.description && <p className="text-xs text-slate-500 mt-0.5">{req.description}</p>}
      </div>
      <Badge variant="outline" className="text-[10px] shrink-0">{req.category}</Badge>
      <Badge variant="outline" className={cn('text-[10px] shrink-0', req.priority === 'must-have' && 'border-red-300 text-red-700', req.priority === 'should-have' && 'border-blue-300 text-blue-700', req.priority === 'nice-to-have' && 'border-slate-300 text-slate-500')}>
        {req.priority}
      </Badge>
      <Badge variant="outline" className={cn('text-[10px] shrink-0', isAi ? 'border-violet-300 text-violet-700' : 'border-slate-300 text-slate-600')}>
        {req.source === 'ai' ? 'AI' : 'User'}
      </Badge>
      {editable && (
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-slate-400 hover:text-red-500" onClick={onRemove}>
          <X className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}
