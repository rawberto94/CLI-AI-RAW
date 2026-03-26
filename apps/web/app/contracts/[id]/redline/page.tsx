'use client';

import React, { useState, use, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RedlineEditor, type Change } from '@/components/contracts/RedlineEditor';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText as _FileText, Clock, Users, Shield, Download, Share2, MoreHorizontal, CheckCircle, Loader2 as _Loader2, Sparkles as _Sparkles, GitCompare, Edit3 } from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

export default function RedlinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [documentStatus, setDocumentStatus] = useState<'draft' | 'review' | 'approved'>('review');
  const [content, setContent] = useState<string>('');
  const [contractTitle, setContractTitle] = useState<string>('Contract - Redline');
  const [loading, setLoading] = useState(true);
  
  const currentUser = {
    id: 'current-user',
    name: 'You',
    avatar: undefined,
  };

  // Fetch contract content + saved redline state
  useEffect(() => {
    async function fetchContractContent() {
      try {
        // Try loading saved redline state first
        const redlineRes = await fetch(`/api/contracts/${id}/redline`);
        if (redlineRes.ok) {
          const { data } = await redlineRes.json();
          if (data.content && data.content.length > 100) {
            setContent(data.content);
            setContractTitle(data.contractTitle || 'Contract - Redline');
            if (data.documentStatus) setDocumentStatus(data.documentStatus as any);
            if (data.savedAt) setLastSaved(new Date(data.savedAt));
            setLoading(false);
            return;
          }
        }

        // Fall back to fetching raw contract text
        const response = await fetch(`/api/contracts/${id}`);
        if (response.ok) {
          const raw = await response.json();
          const data = raw.data ?? raw;
          if (data.id) {
            setContractTitle(data.contractTitle || data.filename || 'Contract - Redline');
            
            const rawText = data.rawText 
              || data.extractedData?.rawText 
              || data.extractedData?.overview?.summary
              || null;
            
            if (rawText && rawText.length > 100) {
              setContent(rawText);
            }
          }
        }
      } catch {
        toast.error('Failed to load contract content');
      } finally {
  }, [id]);

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async (content: string, changes: Change[]) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/contracts/${id}/redline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, changes, documentStatus }),
      });
      if (!res.ok) throw new Error('Save failed');
      const { data } = await res.json();
      setLastSaved(new Date());
      toast.success('Document saved', {
        description: `Version ${data.version} · ${data.pendingChanges} pending changes`,
      });
    } catch {
      toast.error('Failed to save redline changes');
    } finally {
      setIsSaving(false);
    }
  }, [id, documentStatus]);

  const handleExport = useCallback((type: 'redline' | 'clean' | 'pdf') => {
    toast.info(`Export as ${type.toUpperCase()} coming soon`, {
      description: 'This feature is under development.',
    });
  }, []);

  const handleFinalize = useCallback(async () => {
    setIsSaving(true);
    try {
      // Save with finalize flag — transitions contract status to ACTIVE
      const res = await fetch(`/api/contracts/${id}/redline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, changes: [], finalize: true }),
      });
      if (!res.ok) throw new Error('Finalize failed');
      setDocumentStatus('approved');
      toast.success('Document finalized', {
        description: 'All changes accepted — contract is now active.',
      });
    } catch {
      toast.error('Failed to finalize document');
    } finally {
      setIsSaving(false);
    }
  }, [id, content]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50/30 to-rose-50/20 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <div className="w-16 h-16 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" />
            <Edit3 className="w-6 h-6 text-red-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-slate-600 font-medium">Loading redline editor...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50/30 to-rose-50/20 flex flex-col">
      {/* Premium Header */}
      <div className="flex-none bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 shadow-xl">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <Link href={`/contracts/${id}`}>
                <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/20 gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Contract
                </Button>
              </Link>
              <div className="h-6 w-px bg-white/30" />
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                  <GitCompare className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white flex items-center gap-2">
                    {contractTitle}
                  </h1>
                  <div className="flex items-center gap-4 mt-0.5 text-sm text-white/80">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {lastSaved ? `Last saved ${formatTimeAgo(lastSaved)}` : 'Ready to edit'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Editing
                    </span>
                    <Badge 
                      className={
                        documentStatus === 'approved' 
                          ? 'bg-green-500/30 text-white border-green-300/30' 
                          : documentStatus === 'review' 
                          ? 'bg-amber-500/30 text-white border-amber-300/30' 
                          : 'bg-white/20 text-white border-white/30'
                      }
                    >
                      <Shield className="w-3 h-3 mr-1" />
                      {documentStatus === 'approved' ? 'Approved' : documentStatus === 'review' ? 'In Review' : 'Draft'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Quick Actions */}
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-white hover:bg-white/20 gap-2"
                onClick={() => handleExport('redline')}
              >
                <Download className="w-4 h-4" />
                Export
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-white hover:bg-white/20 gap-2"
                onClick={() => toast.success('Share dialog opened')}
              >
                <Share2 className="w-4 h-4" />
                Share
              </Button>

              {documentStatus !== 'approved' && (
                <Button 
                  size="sm" 
                  className="bg-white text-red-600 hover:bg-white/90 shadow-lg gap-2"
                  onClick={handleFinalize}
                >
                  <CheckCircle className="w-4 h-4" />
                  Finalize
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white/95 backdrop-blur-md border-slate-200/80 shadow-xl">
                  <DropdownMenuItem onClick={() => handleExport('clean')}>
                    Export clean copy
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('pdf')}>
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => window.print()}>
                    Print document
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.info('Opening document settings...')}>
                    Document settings
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Editor - Full Height */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-6"
      >
        <RedlineEditor
          documentId={id}
          initialContent={content}
          currentUser={currentUser}
          onSave={handleSave}
          className="h-[calc(100vh-180px)]"
        />
      </motion.div>
    </div>
  );
}

// Helper function to format time ago
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
