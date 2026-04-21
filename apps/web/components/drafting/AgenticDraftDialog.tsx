/**
 * AgenticDraftDialog
 *
 * A modal dialog that drives the 6-step agentic contract drafting pipeline
 * with real-time SSE step progress. Users enter a prompt or select a contract
 * type, and watch each step complete in real-time before navigating to the editor.
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, FileSearch, BookOpen, Wand2, Shield, Save,
  Loader2, CheckCircle2, SkipForward, AlertCircle,
  ArrowRight, Sparkles, X, ShieldCheck, AlertTriangle,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useAgenticDraft, type AgenticDraftRequest, type AgentStep } from '@/hooks/useAgenticDraft';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Step icons and descriptions
// ---------------------------------------------------------------------------

const STEP_CONFIG = [
  { icon: Brain, label: 'Detecting Intent', description: 'Analyzing your request...', color: 'text-violet-500' },
  { icon: FileSearch, label: 'Selecting Template', description: 'Finding the best template...', color: 'text-blue-500' },
  { icon: BookOpen, label: 'Recommending Clauses', description: 'Selecting relevant clauses...', color: 'text-emerald-500' },
  { icon: Wand2, label: 'Generating Content', description: 'Creating your contract...', color: 'text-amber-500' },
  { icon: Shield, label: 'Analyzing Risks', description: 'Checking for legal risks...', color: 'text-red-500' },
  { icon: Save, label: 'Saving Draft', description: 'Persisting your draft...', color: 'text-cyan-500' },
];

const CONTRACT_TYPES = [
  { value: 'NDA', label: 'Non-Disclosure Agreement', emoji: '🔒' },
  { value: 'MSA', label: 'Master Service Agreement', emoji: '🤝' },
  { value: 'SOW', label: 'Statement of Work', emoji: '📋' },
  { value: 'SLA', label: 'Service Level Agreement', emoji: '⚡' },
];

// ---------------------------------------------------------------------------
// Step progress item
// ---------------------------------------------------------------------------

function StepItem({ step, config }: { step: AgentStep; config: typeof STEP_CONFIG[0] }) {
  const Icon = config.icon;
  const statusIcon = {
    pending: <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />,
    running: <Loader2 className="w-5 h-5 animate-spin text-blue-500" />,
    completed: <CheckCircle2 className="w-5 h-5 text-green-500" />,
    skipped: <SkipForward className="w-5 h-5 text-gray-400" />,
    failed: <AlertCircle className="w-5 h-5 text-red-500" />,
  };

  return (
    <motion.div
      initial={{ opacity: 0.5 }}
      animate={{
        opacity: step.status === 'pending' ? 0.5 : 1,
        scale: step.status === 'running' ? 1.02 : 1,
      }}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
        step.status === 'running'
          ? 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800'
          : step.status === 'completed'
          ? 'bg-green-50/50 dark:bg-green-950/20'
          : step.status === 'failed'
          ? 'bg-red-50/50 dark:bg-red-950/20'
          : ''
      }`}
    >
      {statusIcon[step.status]}
      <Icon className={`w-4 h-4 ${step.status === 'running' ? config.color : 'text-gray-500 dark:text-gray-400'}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {step.name}
        </div>
        {step.status === 'running' && (
          <div className="text-xs text-gray-500 dark:text-gray-400">{config.description}</div>
        )}
        {step.status === 'completed' && step.durationMs && (
          <div className="text-xs text-gray-400">{step.durationMs}ms</div>
        )}
        {step.status === 'completed' && step.result && (
          <StepResultSummary step={step} />
        )}
      </div>
    </motion.div>
  );
}

function StepResultSummary({ step }: { step: AgentStep }) {
  const r = step.result || {};
  switch (step.step) {
    case 1:
      return <div className="text-xs text-gray-500">Type: {String(r.contractType || '')}{r.method ? ` (${r.method})` : ''}</div>;
    case 2:
      return <div className="text-xs text-gray-500">{r.templateName ? `Template: ${r.templateName}` : 'No template — generating from scratch'}</div>;
    case 3:
      return (
        <div className="text-xs text-gray-500">
          {Number(r.clauseCount || 0)} clauses selected
          {r.playbook && typeof r.playbook === 'object' && (r.playbook as { name?: string }).name
            ? ` • Policy pack: ${(r.playbook as { name: string }).name}`
            : ''}
        </div>
      );
    case 4:
      return <div className="text-xs text-gray-500">{Number(r.contentLength || 0).toLocaleString()} characters generated</div>;
    case 5:
      return <div className="text-xs text-gray-500">{Number(r.riskCount || 0)} risks identified</div>;
    case 6:
      return <div className="text-xs text-green-600 font-medium">Draft saved ✓</div>;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------

interface AgenticDraftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPrompt?: string;
}

export function AgenticDraftDialog({ open, onOpenChange, initialPrompt }: AgenticDraftDialogProps) {
  const router = useRouter();
  const { isRunning, steps, progress, result, error, riskWarning, generate, abort, reset } = useAgenticDraft();

  // Form state
  const [mode, setMode] = useState<'prompt' | 'type'>('prompt');
  const [prompt, setPrompt] = useState(initialPrompt || '');
  const [selectedType, setSelectedType] = useState('');
  const [tone, setTone] = useState<'formal' | 'standard' | 'plain-english'>('formal');
  const [jurisdiction, setJurisdiction] = useState('United States');

  // Playbooks (policy packs)
  type PlaybookSummary = {
    id: string;
    name: string;
    description?: string | null;
    isDefault?: boolean;
    contractTypes?: string[];
  };
  const [playbooks, setPlaybooks] = useState<PlaybookSummary[]>([]);
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string>('');
  const [playbooksLoaded, setPlaybooksLoaded] = useState(false);

  // Load playbooks when the dialog first opens
  useEffect(() => {
    if (!open || playbooksLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/playbooks', { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        // API wraps payload as { success, data: { playbooks: [...] }, meta }
        const payload = data?.data ?? data;
        const list: PlaybookSummary[] = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.playbooks)
          ? payload.playbooks
          : [];
        setPlaybooks(list);
        const def = list.find(p => p.isDefault);
        if (def) setSelectedPlaybookId(def.id);
        setPlaybooksLoaded(true);
      } catch {
        // Silent — selector will show empty-state, generation still works without a policy pack.
        setPlaybooksLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, playbooksLoaded]);

  // Sync initialPrompt when dialog opens
  useEffect(() => {
    if (open && initialPrompt) {
      setPrompt(initialPrompt);
    }
  }, [open, initialPrompt]);

  const handleGenerate = useCallback(async () => {
    const request: AgenticDraftRequest = {
      tone,
      jurisdiction,
    };
    if (selectedPlaybookId) {
      request.playbookId = selectedPlaybookId;
    }

    if (mode === 'prompt' && prompt.trim()) {
      request.prompt = prompt.trim();
    } else if (mode === 'type' && selectedType) {
      request.contractType = selectedType;
    } else {
      toast.error('Please enter a description or select a contract type');
      return;
    }

    const draftResult = await generate(request);
    if (draftResult) {
      toast.success(`Draft "${draftResult.title}" created successfully`);
    }
  }, [mode, prompt, selectedType, tone, jurisdiction, generate]);

  const handleOpenDraft = useCallback(() => {
    if (result?.editUrl) {
      onOpenChange(false);
      router.push(result.editUrl);
    }
  }, [result, router, onOpenChange]);

  const handleClose = useCallback(() => {
    if (isRunning) {
      abort();
    }
    reset();
    setPrompt('');
    setSelectedType('');
    onOpenChange(false);
  }, [isRunning, abort, reset, onOpenChange]);

  const showForm = !isRunning && !result && !error;
  const showProgress = isRunning;
  const showResult = !!result;
  const showError = !!error && !isRunning && !result;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" />
            {showForm && 'Generate Contract with AI'}
            {showProgress && 'Creating Your Contract...'}
            {showResult && 'Contract Draft Ready'}
            {showError && 'Generation Failed'}
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {/* ───── Input Form ───── */}
          {showForm && (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Mode Toggle */}
              <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <button
                  onClick={() => setMode('prompt')}
                  className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${
                    mode === 'prompt'
                      ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  }`}
                >
                  Describe It
                </button>
                <button
                  onClick={() => setMode('type')}
                  className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${
                    mode === 'type'
                      ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  }`}
                >
                  Select Type
                </button>
              </div>

              {mode === 'prompt' ? (
                <div>
                  <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="Describe the contract you need, e.g. 'Create an NDA between Acme Corp and Widget Inc for sharing proprietary software data...'"
                    className="w-full h-24 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm resize-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    autoFocus
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    AI will detect the contract type, find the best template, and recommend clauses.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {CONTRACT_TYPES.map(ct => (
                    <button
                      key={ct.value}
                      onClick={() => setSelectedType(ct.value)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        selectedType === ct.value
                          ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 ring-1 ring-violet-500'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <span className="text-lg">{ct.emoji}</span>
                      <div className="text-sm font-medium mt-1">{ct.value}</div>
                      <div className="text-xs text-gray-500">{ct.label}</div>
                    </button>
                  ))}
                </div>
              )}

              {/* Tone & Jurisdiction */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Tone</label>
                  <select
                    value={tone}
                    onChange={e => setTone(e.target.value as typeof tone)}
                    className="w-full mt-1 px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                  >
                    <option value="formal">Formal</option>
                    <option value="standard">Standard</option>
                    <option value="plain-english">Plain English</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Jurisdiction</label>
                  <select
                    value={jurisdiction}
                    onChange={e => setJurisdiction(e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                  >
                    <option value="United States">United States</option>
                    <option value="State of California">California</option>
                    <option value="State of New York">New York</option>
                    <option value="State of Delaware">Delaware</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="European Union">European Union</option>
                    <option value="Switzerland">Switzerland</option>
                  </select>
                </div>
              </div>

              {/* Policy pack (playbook) selector */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  Company Policy Pack
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                {playbooks.length > 0 ? (
                  <select
                    value={selectedPlaybookId}
                    onChange={e => setSelectedPlaybookId(e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                  >
                    <option value="">— No policy pack (use defaults) —</option>
                    {playbooks.map(pb => (
                      <option key={pb.id} value={pb.id}>
                        {pb.name}
                        {pb.isDefault ? ' (default)' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="mt-1 px-3 py-2 rounded border border-dashed border-gray-200 dark:border-gray-700 text-xs text-gray-400">
                    {playbooksLoaded
                      ? 'No policy packs yet. Create one under Playbooks to enforce your preferred clauses.'
                      : 'Loading policy packs…'}
                  </div>
                )}
                {selectedPlaybookId && (
                  <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                    Draft will follow your selected policy pack's preferred clauses.
                  </p>
                )}
              </div>

              <button
                onClick={handleGenerate}
                disabled={mode === 'prompt' ? !prompt.trim() : !selectedType}
                className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium text-sm hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Generate Contract
              </button>
            </motion.div>
          )}

          {/* ───── Step Progress ───── */}
          {showProgress && (
            <motion.div
              key="progress"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {/* Non-fatal risk warning banner (emitted during Risk Analysis) */}
              {riskWarning && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-amber-900 dark:text-amber-200">
                      {riskWarning.message || 'Risks detected'}
                    </div>
                    <div className="text-[11px] text-amber-700 dark:text-amber-300">
                      The draft will still be saved — review the flagged items in the editor.
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Progress bar */}
              <div className="relative h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Steps */}
              <div className="space-y-1.5">
                {steps.map((step, i) => (
                  <StepItem key={step.step} step={step} config={STEP_CONFIG[i]} />
                ))}
              </div>

              <button
                onClick={abort}
                className="w-full py-2 px-4 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </motion.div>
          )}

          {/* ───── Success Result ───── */}
          {showResult && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <div className="text-center py-4">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {result.title}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {result.contractType} • {result.contentLength.toLocaleString()} characters
                  {result.templateUsed && ` • Template: ${result.templateUsed.name}`}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="py-2 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                  <div className="text-lg font-semibold text-emerald-600">{result.clausesIncorporated}</div>
                  <div className="text-xs text-gray-500">Clauses</div>
                </div>
                <div className="py-2 px-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                  <div className="text-lg font-semibold text-amber-600">{result.risksIdentified}</div>
                  <div className="text-xs text-gray-500">Risks</div>
                </div>
                <div className="py-2 px-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                  <div className="text-lg font-semibold text-blue-600">{result.totalDurationMs ? (result.totalDurationMs / 1000).toFixed(1) : '0'}s</div>
                  <div className="text-xs text-gray-500">Duration</div>
                </div>
              </div>

              {riskWarning && (riskWarning.critical > 0 || riskWarning.high > 0) && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-amber-900 dark:text-amber-200">
                    {riskWarning.message} — review in the editor before finalising.
                  </div>
                </div>
              )}

              {/* Steps summary */}
              <div className="space-y-1">
                {steps.map((step, i) => (
                  <StepItem key={step.step} step={step} config={STEP_CONFIG[i]} />
                ))}
              </div>

              <button
                onClick={handleOpenDraft}
                className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium text-sm hover:from-violet-700 hover:to-indigo-700 flex items-center justify-center gap-2"
              >
                Open in Editor
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* ───── Error State ───── */}
          {showError && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="text-center py-4">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Generation Failed
                </h3>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                  {error}
                </p>
              </div>

              {/* Show step progress for debugging */}
              <div className="space-y-1">
                {steps.filter(s => s.status !== 'pending').map((step, i) => (
                  <StepItem key={step.step} step={step} config={STEP_CONFIG[steps.indexOf(step)]} />
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { reset(); }}
                  className="flex-1 py-2 px-4 rounded-lg border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Try Again
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 py-2 px-4 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

export default AgenticDraftDialog;
