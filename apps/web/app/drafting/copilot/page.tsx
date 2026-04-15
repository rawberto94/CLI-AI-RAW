'use client';

/**
 * AI Copilot Drafting Page
 * 
 * Premium AI-powered contract drafting with real-time assistance.
 * Features: auto-completion, risk detection, AI suggestions, clause library.
 * 
 * Query params:
 * - mode: 'blank' for new document
 * - template: template ID to use
 * - name: template name
 * - draft: existing draft ID to edit
 */

import React, { Suspense, useCallback, useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { PageBreadcrumb } from '@/components/navigation';
import { Sparkles, FileText, Edit3, RefreshCw, GitBranch, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import TemplateVariableForm from '@/components/drafting/TemplateVariableForm';
import {
  CopilotHandoffPayload,
  CopilotWorkflowContext,
  CopilotWorkflowSummaryItem,
  getCopilotHandoffStorageKey,
} from '@/lib/drafting/copilot-handoff';

interface DraftingPlaybookOption {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  contractTypes: string[];
}

interface DraftingSourceContract {
  id: string;
  title: string;
  supplier: string;
  client: string;
  value: number | null;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  rawText: string | null;
}

function formatWorkflowValue(value: number | null | undefined, currency: string | null | undefined): string | null {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  return `${currency || 'USD'} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function buildWorkflowSummaryItems(contract: DraftingSourceContract | null): CopilotWorkflowSummaryItem[] {
  const summaryItems: CopilotWorkflowSummaryItem[] = [];

  if (contract?.startDate || contract?.endDate) {
    summaryItems.push({
      label: 'Original term',
      value: `${contract.startDate ? new Date(contract.startDate).toLocaleDateString() : 'N/A'} to ${contract.endDate ? new Date(contract.endDate).toLocaleDateString() : 'N/A'}`,
    });
  }

  const formattedValue = formatWorkflowValue(contract?.value, contract?.currency);
  if (formattedValue) {
    summaryItems.push({
      label: 'Original value',
      value: formattedValue,
    });
  }

  return summaryItems;
}

function buildDefaultWorkflowContext(
  kind: 'renewal' | 'amendment',
  sourceContractId: string | null | undefined,
  sourceTitle: string | null | undefined,
  contract: DraftingSourceContract | null,
): CopilotWorkflowContext {
  return {
    kind,
    label: kind === 'renewal' ? 'Renewal studio' : 'Amendment studio',
    sourceTitle: sourceTitle || undefined,
    returnPath: kind === 'renewal' && sourceContractId ? `/contracts/${sourceContractId}/renew` : undefined,
    returnLabel: kind === 'renewal' ? 'Back to renewal workflow' : undefined,
    sourcePath: sourceContractId ? `/contracts/${sourceContractId}` : undefined,
    sourceLabel: 'Open source contract',
    summaryItems: buildWorkflowSummaryItems(contract),
  };
}

function mergeWorkflowContext(
  current: CopilotWorkflowContext | null,
  fallback: CopilotWorkflowContext,
): CopilotWorkflowContext {
  return {
    ...fallback,
    ...current,
    kind: fallback.kind,
    label: current?.label || fallback.label,
    sourceTitle: current?.sourceTitle || fallback.sourceTitle,
    returnPath: current?.returnPath || fallback.returnPath,
    returnLabel: current?.returnLabel || fallback.returnLabel,
    sourcePath: current?.sourcePath || fallback.sourcePath,
    sourceLabel: current?.sourceLabel || fallback.sourceLabel,
    notes: current?.notes || fallback.notes,
    summaryItems: current?.summaryItems?.length ? current.summaryItems : fallback.summaryItems,
  };
}

// Dynamic import to avoid SSR issues
const CopilotDraftingCanvas = dynamic(
  () => import('@/components/drafting/CopilotDraftingCanvas').then(mod => ({ default: mod.CopilotDraftingCanvas })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[calc(100vh-120px)] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="relative mx-auto mb-4">
            <div className="w-16 h-16 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
            <Sparkles className="w-6 h-6 text-violet-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-slate-600 font-medium">Loading AI Copilot...</p>
          <p className="text-sm text-slate-500 mt-1">Preparing intelligent drafting assistant</p>
        </motion.div>
      </div>
    ),
  }
);

export default function CopilotDraftPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mode = searchParams?.get('mode');
  const templateId = searchParams?.get('template');
  const templateName = searchParams?.get('name');
  const draftId = searchParams?.get('draft');
  const sourceContractId = searchParams?.get('from') || searchParams?.get('contractId');
  const handoffId = searchParams?.get('handoff');
  const requestedPlaybookId = searchParams?.get('playbook') || searchParams?.get('playbookId');
  
  // Track if we've created a draft already
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(draftId || null);
  const savedTitleRef = useRef<string | null>(null);
  const createdDraftLocallyRef = useRef(false);
  const [draftTitleSeed, setDraftTitleSeed] = useState<string | null>(null);

  // Template variable injection flow
  const [templateContent, setTemplateContent] = useState<string | null>(null);
  const [showVariableForm, setShowVariableForm] = useState(false);
  const [hydratedContent, setHydratedContent] = useState<string | null>(null);
  const [draftSourceTrailSeed, setDraftSourceTrailSeed] = useState<unknown>([]);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [isHydratingDraft, setIsHydratingDraft] = useState(Boolean(draftId));
  const [availablePlaybooks, setAvailablePlaybooks] = useState<DraftingPlaybookOption[]>([]);
  const [isLoadingPlaybooks, setIsLoadingPlaybooks] = useState(false);
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string | null>(requestedPlaybookId || null);
  const [workflowContext, setWorkflowContext] = useState<CopilotWorkflowContext | null>(null);

  // Source contract data for renewal/amendment flows
  const [sourceContract, setSourceContract] = useState<DraftingSourceContract | null>(null);

  const activeDraftId = draftId || currentDraftId;

  useEffect(() => {
    if (!handoffId || draftId || currentDraftId) return;

    try {
      const rawPayload = window.sessionStorage.getItem(getCopilotHandoffStorageKey(handoffId));
      if (!rawPayload) return;

      const payload = JSON.parse(rawPayload) as CopilotHandoffPayload;
      if (payload.content) {
        setHydratedContent(payload.content);
      }
      if (payload.title) {
        savedTitleRef.current = payload.title;
        setDraftTitleSeed(payload.title);
      }
      if (payload.workflow) {
        setWorkflowContext(payload.workflow);
      } else if (payload.sourceMode === 'renewal' || payload.sourceMode === 'amendment') {
        setWorkflowContext(buildDefaultWorkflowContext(payload.sourceMode, payload.sourceContractId, payload.title || null, null));
      }
    } catch (error) {
      console.error('Copilot handoff restore error:', error);
    }
  }, [handoffId, draftId, currentDraftId]);

  useEffect(() => {
    let cancelled = false;

    const fetchPlaybooks = async () => {
      setIsLoadingPlaybooks(true);
      try {
        const response = await fetch('/api/playbooks');
        if (!response.ok) {
          throw new Error('Failed to fetch playbooks');
        }

        const data = await response.json();
        const playbooks = data.data?.playbooks || data.playbooks || [];

        if (!cancelled) {
          setAvailablePlaybooks(playbooks);
        }
      } catch (error) {
        console.error('Playbook fetch error:', error);
        if (!cancelled) {
          toast.error('Could not load policy packs');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPlaybooks(false);
        }
      }
    };

    fetchPlaybooks();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (draftId) return;
    setSelectedPlaybookId(requestedPlaybookId || null);
  }, [draftId, requestedPlaybookId]);

  useEffect(() => {
    if (!draftId) {
      setIsHydratingDraft(false);
      return;
    }

    const isLocallyCreatedDraft = createdDraftLocallyRef.current && draftId === currentDraftId;
    if (isLocallyCreatedDraft) {
      setIsHydratingDraft(false);
      return;
    }

    let cancelled = false;

    const fetchDraft = async () => {
      setIsHydratingDraft(true);
      try {
        const response = await fetch(`/api/drafts/${draftId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch draft');
        }

        const data = await response.json();
        const draft = data.data?.draft;

        if (!cancelled && draft) {
          setCurrentDraftId(draft.id);
          savedTitleRef.current = draft.title || null;
          setDraftTitleSeed(draft.title || null);
          setHydratedContent(typeof draft.content === 'string' ? draft.content : null);
          setDraftSourceTrailSeed(Array.isArray(draft.clauses) ? draft.clauses : []);

          const persistedPlaybookId = typeof draft.playbookId === 'string' && draft.playbookId.trim().length > 0
            ? draft.playbookId
            : null;
          const effectivePlaybookId = requestedPlaybookId || persistedPlaybookId;

          setSelectedPlaybookId(effectivePlaybookId || null);

          const normalizedSourceType = typeof draft.sourceType === 'string' ? draft.sourceType.toUpperCase() : '';
          const hydratedSourceContract = draft.sourceContract
            ? {
                id: draft.sourceContract.id,
                title: draft.sourceContract.contractTitle || 'Untitled',
                supplier: draft.sourceContract.supplierName || '',
                client: draft.sourceContract.clientName || '',
                value: draft.sourceContract.totalValue ?? null,
                currency: draft.sourceContract.currency || 'USD',
                startDate: draft.sourceContract.startDate || null,
                endDate: draft.sourceContract.endDate || null,
                rawText: null,
              }
            : null;

          if (hydratedSourceContract) {
            setSourceContract(hydratedSourceContract);
          }

          if (normalizedSourceType === 'RENEWAL' || normalizedSourceType === 'AMENDMENT') {
            const kind = normalizedSourceType === 'RENEWAL' ? 'renewal' : 'amendment';
            const fallbackWorkflowContext = buildDefaultWorkflowContext(
              kind,
              draft.sourceContractId || hydratedSourceContract?.id || null,
              hydratedSourceContract?.title || null,
              hydratedSourceContract,
            );

            if (draft.playbook?.name) {
              fallbackWorkflowContext.summaryItems = [
                ...(fallbackWorkflowContext.summaryItems || []),
                { label: 'Policy pack', value: draft.playbook.name },
              ];
            }

            setWorkflowContext((current) => mergeWorkflowContext(current, fallbackWorkflowContext));
          } else if (!handoffId) {
            setWorkflowContext(null);
          }

          if (!requestedPlaybookId && persistedPlaybookId) {
            const url = new URL(window.location.href);
            url.searchParams.set('playbook', persistedPlaybookId);
            url.searchParams.delete('playbookId');
            router.replace(url.pathname + url.search);
          }
        }
      } catch (error) {
        console.error('Draft hydration error:', error);
        if (!cancelled) {
          toast.error('Could not load draft');
        }
      } finally {
        if (!cancelled) {
          setIsHydratingDraft(false);
        }
      }
    };

    fetchDraft();
    return () => {
      cancelled = true;
    };
  }, [draftId, currentDraftId, requestedPlaybookId, router, handoffId]);

  // Fetch source contract for renewal/amendment flows
  useEffect(() => {
    if (!sourceContractId || draftId || currentDraftId) return;
    if (mode !== 'renewal' && mode !== 'amendment') return;
    let cancelled = false;

    const fetchSourceContract = async () => {
      setIsLoadingTemplate(true);
      try {
        const res = await fetch(`/api/contracts/${sourceContractId}`);
        if (!res.ok) throw new Error('Failed to fetch source contract');
        const data = await res.json();
        const contract = data?.data;
        if (!cancelled && contract) {
          const sourceTitle = contract.contractTitle || contract.title || 'Untitled';
          const nextSourceContract = {
            id: contract.id,
            title: sourceTitle,
            supplier: contract.supplierName || '',
            client: contract.clientName || '',
            value: contract.totalValue,
            currency: contract.currency || 'USD',
            startDate: contract.startDate || contract.effectiveDate || null,
            endDate: contract.endDate || contract.expirationDate || null,
            rawText: contract.rawText || null,
          };
          setSourceContract(nextSourceContract);

          setWorkflowContext((current) => mergeWorkflowContext(
            current,
            buildDefaultWorkflowContext(mode === 'renewal' ? 'renewal' : 'amendment', sourceContractId, sourceTitle, nextSourceContract),
          ));

          // Build pre-populated content for the editor
          const label = mode === 'renewal' ? 'RENEWAL' : 'AMENDMENT';
          const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          const preContent = [
            `<h1>CONTRACT ${label}</h1>`,
            `<p><strong>Based on:</strong> ${contract.contractTitle || 'Original Contract'}</p>`,
            contract.supplierName ? `<p><strong>Supplier:</strong> ${contract.supplierName}</p>` : '',
            contract.clientName ? `<p><strong>Client:</strong> ${contract.clientName}</p>` : '',
            `<p><strong>Date:</strong> ${today}</p>`,
            `<p><strong>Original Contract Period:</strong> ${contract.startDate ? new Date(contract.startDate).toLocaleDateString() : 'N/A'} – ${contract.endDate || contract.expirationDate ? new Date(contract.endDate || contract.expirationDate).toLocaleDateString() : 'N/A'}</p>`,
            contract.totalValue ? `<p><strong>Original Value:</strong> ${contract.currency || 'USD'} ${Number(contract.totalValue).toLocaleString()}</p>` : '',
            '<hr>',
            mode === 'renewal'
              ? '<h2>Renewal Terms</h2><p>This renewal agreement extends the original contract under the following updated terms:</p><ul><li>Renewed period: [Start Date] – [End Date]</li><li>Updated pricing: [Details]</li><li>Modified clauses: [Details]</li></ul>'
              : '<h2>Amendment Details</h2><p>This amendment modifies the original contract as follows:</p><ul><li>Section modified: [Section]</li><li>Previous term: [Original Language]</li><li>Updated term: [New Language]</li><li>Effective date: [Date]</li></ul>',
            '<hr>',
            '<h2>Signatures</h2>',
            '<p>Authorized Representative (Party A): ________________________</p>',
            '<p>Authorized Representative (Party B): ________________________</p>',
          ].filter(Boolean).join('\n');

          if (!handoffId) {
            setDraftTitleSeed(mode === 'renewal' ? `Renewal - ${sourceTitle}` : `Amendment - ${sourceTitle}`);
            setHydratedContent(preContent);
          }
        }
      } catch (err) {
        console.error('Source contract fetch error:', err);
        toast.error('Could not load source contract');
      } finally {
        if (!cancelled) setIsLoadingTemplate(false);
      }
    };

    fetchSourceContract();
    return () => { cancelled = true; };
  }, [sourceContractId, mode, draftId, currentDraftId, handoffId]);

  // Fetch template content when templateId is present
  useEffect(() => {
    if (!templateId || draftId || currentDraftId) return;
    let cancelled = false;

    const fetchTemplate = async () => {
      setIsLoadingTemplate(true);
      try {
        const res = await fetch(`/api/templates/${templateId}`);
        if (!res.ok) throw new Error('Failed to fetch template');
        const data = await res.json();
        const content = data?.data?.template?.content || data?.template?.content || '';
        if (!cancelled && content) {
          setTemplateContent(content);
          if (templateName && !savedTitleRef.current) {
            setDraftTitleSeed(`Draft - ${decodeURIComponent(templateName)}`);
          }
          // Check if it has variables — show form if so
          const hasVars = /\{\{[^}]+\}\}/.test(content);
          if (hasVars) {
            setShowVariableForm(true);
          } else {
            // No variables, pass template content directly
            setHydratedContent(content);
          }
        }
      } catch (err) {
        console.error('Template fetch error:', err);
      } finally {
        if (!cancelled) setIsLoadingTemplate(false);
      }
    };

    fetchTemplate();
    return () => { cancelled = true; };
  }, [templateId, draftId, currentDraftId]);

  useEffect(() => {
    if (draftId || currentDraftId || savedTitleRef.current) return;
    if (mode === 'blank') {
      setDraftTitleSeed('Untitled Contract');
    }
  }, [mode, draftId, currentDraftId]);

  // Save handler - persists to database
  const handleSave = useCallback(async ({ content, title, clauses }: { content: string; title: string; clauses?: unknown[] }) => {
    try {
      const resolvedTitle = title.trim().length > 0
        ? title.trim()
        : savedTitleRef.current
        ? savedTitleRef.current
        : templateName
        ? `Draft - ${decodeURIComponent(templateName)}`
        : mode === 'renewal' && sourceContract
          ? `Renewal - ${sourceContract.title}`
          : mode === 'amendment' && sourceContract
            ? `Amendment - ${sourceContract.title}`
            : `Draft - ${new Date().toLocaleDateString()}`;

      savedTitleRef.current = resolvedTitle;
      setDraftTitleSeed(resolvedTitle);

      if (activeDraftId) {
        // Update existing draft
        const response = await fetch(`/api/drafts/${activeDraftId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: resolvedTitle,
            content,
            clauses,
            playbookId: selectedPlaybookId,
            updatedAt: new Date().toISOString(),
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to save draft');
        }
        
        toast.success('Draft saved');
      } else {
        // Create new draft
        const isRenewal = mode === 'renewal';
        const isAmendment = mode === 'amendment';
        const response = await fetch('/api/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: resolvedTitle,
            content,
            clauses,
            type: 'contract',
            status: 'DRAFT',
            sourceType: isRenewal ? 'RENEWAL' : isAmendment ? 'AMENDMENT' : templateId ? 'template' : 'blank',
            sourceTemplateId: templateId || undefined,
            playbookId: selectedPlaybookId || undefined,
            sourceContractId: sourceContractId || undefined,
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to create draft');
        }
        
        const data = await response.json();
        if (data.success && data.data?.draft?.id) {
          createdDraftLocallyRef.current = true;
          setCurrentDraftId(data.data.draft.id);
          savedTitleRef.current = resolvedTitle;
          setDraftTitleSeed(resolvedTitle);
          
          // Update URL to include draft ID
          const url = new URL(window.location.href);
          url.searchParams.delete('mode');
          url.searchParams.delete('template');
          url.searchParams.delete('name');
          url.searchParams.delete('from');
          url.searchParams.delete('contractId');
          url.searchParams.delete('handoff');
          url.searchParams.set('draft', data.data.draft.id);

          if (handoffId) {
            window.sessionStorage.removeItem(getCopilotHandoffStorageKey(handoffId));
          }

          router.replace(url.pathname + url.search);
          
          toast.success('Draft created');
        }
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save draft');
      throw error;
    }
  }, [activeDraftId, templateId, templateName, router, mode, sourceContract, sourceContractId, handoffId, selectedPlaybookId]);

  const handlePlaybookChange = useCallback(async (value: string) => {
    const nextPlaybookId = value === 'none' ? null : value;
    const previousPlaybookId = selectedPlaybookId;
    const url = new URL(window.location.href);

    setSelectedPlaybookId(nextPlaybookId);

    if (nextPlaybookId === null) {
      url.searchParams.delete('playbook');
      url.searchParams.delete('playbookId');
    } else {
      url.searchParams.set('playbook', nextPlaybookId);
      url.searchParams.delete('playbookId');
    }

    router.replace(url.pathname + url.search);

    if (!activeDraftId || nextPlaybookId === previousPlaybookId) {
      return;
    }

    try {
      const response = await fetch(`/api/drafts/${activeDraftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playbookId: nextPlaybookId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to persist playbook selection');
      }
    } catch (error) {
      console.error('Playbook persistence error:', error);
      setSelectedPlaybookId(previousPlaybookId);

      const revertUrl = new URL(window.location.href);
      if (previousPlaybookId) {
        revertUrl.searchParams.set('playbook', previousPlaybookId);
        revertUrl.searchParams.delete('playbookId');
      } else {
        revertUrl.searchParams.delete('playbook');
        revertUrl.searchParams.delete('playbookId');
      }
      router.replace(revertUrl.pathname + revertUrl.search);
      toast.error('Could not update policy pack');
    }
  }, [activeDraftId, router, selectedPlaybookId]);

  // Determine the context for the header
  const getHeaderInfo = () => {
    if (mode === 'renewal' || workflowContext?.kind === 'renewal') {
      return {
        title: workflowContext?.sourceTitle || sourceContract ? `Renewal Studio: ${workflowContext?.sourceTitle || sourceContract?.title}` : 'Renewal Studio',
        description: 'Structured renewal setup stays in the wizard. Use the studio here for deeper clause drafting, negotiation, and polish.',
        icon: RefreshCw,
      };
    }
    if (mode === 'amendment' || workflowContext?.kind === 'amendment') {
      return {
        title: workflowContext?.sourceTitle || sourceContract ? `Amendment Studio: ${workflowContext?.sourceTitle || sourceContract?.title}` : 'Amendment Studio',
        description: 'Use the shared drafting studio to rewrite amendment language with full AI assistance.',
        icon: GitBranch,
      };
    }
    if (activeDraftId) {
      return {
        title: 'Edit Draft',
        description: 'Continue working on your contract draft',
        icon: Edit3,
      };
    }
    if (templateId) {
      return {
        title: templateName ? `New: ${decodeURIComponent(templateName)}` : 'From Template',
        description: 'Create a new contract from template',
        icon: FileText,
      };
    }
    if (mode === 'blank') {
      return {
        title: 'New Contract',
        description: 'Start drafting a new contract from scratch',
        icon: Sparkles,
      };
    }
    return {
      title: 'AI Copilot Drafting',
      description: 'Intelligent contract drafting with real-time AI assistance',
      icon: Sparkles,
    };
  };

  const headerInfo = getHeaderInfo();
  const HeaderIcon = headerInfo.icon;
  const selectedPlaybook = availablePlaybooks.find((playbook) => playbook.id === selectedPlaybookId);
  const playbookSelectValue = selectedPlaybook ? selectedPlaybook.id : 'none';

  return (
    <div className="min-h-screen bg-[#f6f4ef]">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 px-6 py-3 backdrop-blur-xl">
        <div className="mx-auto max-w-[1600px]">
          <PageBreadcrumb />

          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                  <HeaderIcon className="h-4 w-4 flex-shrink-0" />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-semibold text-slate-950">
                    {headerInfo.title}
                  </h1>
                  <p className="text-sm text-slate-500">
                    {headerInfo.description}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <div className="hidden items-center gap-2 text-xs font-medium text-slate-500 sm:flex">
                <BookOpen className="h-3.5 w-3.5" />
                Standards
              </div>
              <Select value={playbookSelectValue} onValueChange={handlePlaybookChange}>
                <SelectTrigger className="h-8 min-w-[180px] rounded-full border-slate-200 bg-transparent text-xs shadow-none">
                  <SelectValue placeholder={isLoadingPlaybooks ? 'Loading...' : 'No policy pack'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No policy pack</SelectItem>
                  {availablePlaybooks.map((playbook) => (
                    <SelectItem key={playbook.id} value={playbook.id}>
                      {playbook.name}{playbook.isDefault ? ' (Default)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-full px-3 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                onClick={() => router.push('/playbooks')}
              >
                View packs
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Suspense fallback={null}>
        {/* Template Variable Form — shown when template has {{variables}} */}
        {showVariableForm && templateContent ? (
          <div className="max-w-2xl mx-auto py-12 px-6">
            <TemplateVariableForm
              templateContent={templateContent}
              templateName={templateName ? decodeURIComponent(templateName) : 'Template'}
              onComplete={(content, _variables) => {
                setHydratedContent(content);
                setShowVariableForm(false);
              }}
              onSkip={() => {
                setHydratedContent(templateContent);
                setShowVariableForm(false);
              }}
            />
          </div>
        ) : isLoadingTemplate || isHydratingDraft ? (
          <div className="min-h-[calc(100vh-120px)] flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="relative mx-auto mb-4">
                <div className="w-16 h-16 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
                <Sparkles className="w-6 h-6 text-violet-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="text-slate-600 font-medium">{isHydratingDraft ? 'Loading draft...' : 'Loading template...'}</p>
            </motion.div>
          </div>
        ) : (
          <CopilotDraftingCanvas 
            templateId={templateId || undefined}
            draftId={activeDraftId || undefined}
            isBlankDocument={mode === 'blank'}
            onSave={handleSave}
            initialContent={hydratedContent || undefined}
            initialTitle={draftTitleSeed || undefined}
            initialSourceTrail={draftSourceTrailSeed}
            playbookId={selectedPlaybookId || undefined}
            workflowContext={workflowContext || undefined}
          />
        )}
      </Suspense>
    </div>
  );
}
