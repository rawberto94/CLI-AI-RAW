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
import { Sparkles, FileText, Edit3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import TemplateVariableForm from '@/components/drafting/TemplateVariableForm';

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
  
  // Track if we've created a draft already
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(draftId || null);
  const savedTitleRef = useRef<string | null>(null);

  // Template variable injection flow
  const [templateContent, setTemplateContent] = useState<string | null>(null);
  const [showVariableForm, setShowVariableForm] = useState(false);
  const [hydratedContent, setHydratedContent] = useState<string | null>(null);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);

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
        const title = savedTitleRef.current || templateName 
          ? `Draft - ${decodeURIComponent(templateName || 'New Contract')}`
          : `Draft - ${new Date().toLocaleDateString()}`;
        
        const response = await fetch('/api/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            content,
            type: 'contract',
            status: 'DRAFT',
            sourceType: templateId ? 'template' : 'blank',
            sourceTemplateId: templateId || undefined,
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
          url.searchParams.set('draft', data.data.draft.id);
          router.replace(url.pathname + url.search);
          
          toast.success('Draft created');
        }
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save draft');
      throw error;
    }
  }, [currentDraftId, templateId, templateName, router]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-pink-50/20">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 px-6 py-3 sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto">
          <PageBreadcrumb />
          <div className="flex items-center gap-3 mt-2">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-pink-500 rounded-xl shadow-lg">
              <HeaderIcon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">
                  {headerInfo.title}
                </h1>
                {headerInfo.badge && (
                  <Badge variant="secondary" className="bg-violet-100 text-violet-700 text-xs">
                    {headerInfo.badge}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-slate-600">
                {headerInfo.description}
              </p>
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
          />
        )}
      </Suspense>
    </div>
  );
}
