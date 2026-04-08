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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import TemplateVariableForm from '@/components/drafting/TemplateVariableForm';
import { CopilotHandoffPayload, getCopilotHandoffStorageKey } from '@/lib/drafting/copilot-handoff';

interface DraftingPlaybookOption {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  contractTypes: string[];
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
  const playbookId = searchParams?.get('playbook') || searchParams?.get('playbookId');
  
  // Track if we've created a draft already
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(draftId || null);
  const savedTitleRef = useRef<string | null>(null);

  // Template variable injection flow
  const [templateContent, setTemplateContent] = useState<string | null>(null);
  const [showVariableForm, setShowVariableForm] = useState(false);
  const [hydratedContent, setHydratedContent] = useState<string | null>(null);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [availablePlaybooks, setAvailablePlaybooks] = useState<DraftingPlaybookOption[]>([]);
  const [isLoadingPlaybooks, setIsLoadingPlaybooks] = useState(false);

  // Source contract data for renewal/amendment flows
  const [sourceContract, setSourceContract] = useState<{
    id: string;
    title: string;
    supplier: string;
    client: string;
    value: number | null;
    currency: string;
    startDate: string | null;
    endDate: string | null;
    rawText: string | null;
  } | null>(null);

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
          setSourceContract({
            id: contract.id,
            title: contract.contractTitle || contract.title || 'Untitled',
            supplier: contract.supplierName || '',
            client: contract.clientName || '',
            value: contract.totalValue,
            currency: contract.currency || 'USD',
            startDate: contract.startDate || contract.effectiveDate || null,
            endDate: contract.endDate || contract.expirationDate || null,
            rawText: contract.rawText || null,
          });

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

  // Save handler - persists to database
  const handleSave = useCallback(async (content: string) => {
    try {
      if (currentDraftId) {
        // Update existing draft
        const response = await fetch(`/api/drafts/${currentDraftId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
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
        const title = savedTitleRef.current
          ? savedTitleRef.current
          : templateName
          ? `Draft - ${decodeURIComponent(templateName)}`
          : isRenewal && sourceContract
            ? `Renewal - ${sourceContract.title}`
            : isAmendment && sourceContract
              ? `Amendment - ${sourceContract.title}`
              : `Draft - ${new Date().toLocaleDateString()}`;
        
        const response = await fetch('/api/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            content,
            type: 'contract',
            status: 'DRAFT',
            sourceType: isRenewal ? 'RENEWAL' : isAmendment ? 'AMENDMENT' : templateId ? 'template' : 'blank',
            sourceTemplateId: templateId || undefined,
            sourceContractId: sourceContractId || undefined,
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to create draft');
        }
        
        const data = await response.json();
        if (data.success && data.data?.draft?.id) {
          setCurrentDraftId(data.data.draft.id);
          savedTitleRef.current = title;
          
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
  }, [currentDraftId, templateId, templateName, router, mode, sourceContract, sourceContractId, handoffId]);

  const handlePlaybookChange = useCallback((value: string) => {
    const url = new URL(window.location.href);

    if (value === 'none') {
      url.searchParams.delete('playbook');
      url.searchParams.delete('playbookId');
    } else {
      url.searchParams.set('playbook', value);
      url.searchParams.delete('playbookId');
    }

    router.replace(url.pathname + url.search);
  }, [router]);

  // Determine the context for the header
  const getHeaderInfo = () => {
    if (draftId || currentDraftId) {
      return {
        title: 'Edit Draft',
        description: 'Continue working on your contract draft',
        icon: Edit3,
        badge: 'Editing',
      };
    }
    if (mode === 'renewal') {
      return {
        title: sourceContract ? `Renewal: ${sourceContract.title}` : 'Contract Renewal',
        description: 'Create a renewal based on an existing contract',
        icon: RefreshCw,
        badge: 'Renewal',
      };
    }
    if (mode === 'amendment') {
      return {
        title: sourceContract ? `Amendment: ${sourceContract.title}` : 'Contract Amendment',
        description: 'Create an amendment to modify an existing contract',
        icon: GitBranch,
        badge: 'Amendment',
      };
    }
    if (templateId) {
      return {
        title: templateName ? `New: ${decodeURIComponent(templateName)}` : 'From Template',
        description: 'Create a new contract from template',
        icon: FileText,
        badge: 'Template',
      };
    }
    if (mode === 'blank') {
      return {
        title: 'New Contract',
        description: 'Start drafting a new contract from scratch',
        icon: Sparkles,
        badge: 'Blank',
      };
    }
    return {
      title: 'AI Copilot Drafting',
      description: 'Intelligent contract drafting with real-time AI assistance',
      icon: Sparkles,
      badge: null,
    };
  };

  const headerInfo = getHeaderInfo();
  const HeaderIcon = headerInfo.icon;
  const selectedPlaybook = availablePlaybooks.find((playbook) => playbook.id === playbookId);
  const playbookSelectValue = selectedPlaybook ? selectedPlaybook.id : 'none';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-pink-50/20">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 px-6 py-2.5 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto">
          <PageBreadcrumb />

          {/* Compact title row */}
          <div className="flex items-center justify-between gap-4 mt-1.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <HeaderIcon className="h-4 w-4 text-violet-600 flex-shrink-0" />
              <h1 className="text-base font-semibold text-slate-900 truncate">
                {headerInfo.title}
              </h1>
              {headerInfo.badge && (
                <Badge variant="secondary" className="bg-violet-100 text-violet-700 text-[11px] px-2 py-0 leading-5 flex-shrink-0">
                  {headerInfo.badge}
                </Badge>
              )}
              {draftId || currentDraftId ? (
                <span className="text-xs text-slate-400 hidden sm:inline flex-shrink-0">DRAFT</span>
              ) : null}
            </div>

            {/* Policy pack inline */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <BookOpen className="h-3.5 w-3.5 text-slate-400 hidden md:block" />
              <Select value={playbookSelectValue} onValueChange={handlePlaybookChange}>
                <SelectTrigger className="h-8 w-auto min-w-[160px] max-w-[220px] bg-white text-xs border-slate-200">
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
              <Button variant="outline" size="sm" className="h-8 text-xs hidden md:inline-flex" onClick={() => router.push('/playbooks')}>
                Manage Packs
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
        ) : isLoadingTemplate ? (
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
              <p className="text-slate-600 font-medium">Loading template...</p>
            </motion.div>
          </div>
        ) : (
          <CopilotDraftingCanvas 
            templateId={templateId || undefined}
            draftId={currentDraftId || draftId || undefined}
            isBlankDocument={mode === 'blank'}
            onSave={handleSave}
            initialContent={hydratedContent || undefined}
            playbookId={playbookId || undefined}
          />
        )}
      </Suspense>
    </div>
  );
}
