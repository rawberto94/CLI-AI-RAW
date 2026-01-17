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

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { PageBreadcrumb } from '@/components/navigation';
import { Sparkles, FileText, Edit3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
            <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
            <Sparkles className="w-6 h-6 text-purple-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
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
  const mode = searchParams?.get('mode');
  const templateId = searchParams?.get('template');
  const templateName = searchParams?.get('name');
  const draftId = searchParams?.get('draft');

  // Determine the context for the header
  const getHeaderInfo = () => {
    if (draftId) {
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
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg">
              <HeaderIcon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {headerInfo.title}
                </h1>
                {headerInfo.badge && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-xs">
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
        <CopilotDraftingCanvas 
          templateId={templateId || undefined}
          draftId={draftId || undefined}
          isBlankDocument={mode === 'blank'}
        />
      </Suspense>
    </div>
  );
}
