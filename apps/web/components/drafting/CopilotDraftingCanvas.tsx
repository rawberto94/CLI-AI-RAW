'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History, MessageSquare, Wand2, AlertTriangle,
  Lightbulb, Save, Eye, Edit3, Sparkles,
  GitBranch, Undo2, Redo2, Bold, Italic, Underline, List,
  Heading1, Heading2, Quote, X, Send, Clock, Zap, Shield, Scale,
  FileCheck, RefreshCw, Loader2, Brain, AlertCircle, Menu,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

interface CopilotSuggestion {
  id: string;
  type: 'clause_improvement' | 'risk_warning' | 'compliance' | 'auto_complete' | 'negotiation';
  triggerText: string;
  suggestedText: string;
  explanation: string;
  confidence: number;
  position: { startOffset: number; endOffset: number };
  source: {
    type: 'playbook' | 'clause_library' | 'ai' | 'historical';
    name?: string;
    clauseId?: string;
    confidence: number;
  };
  riskLevel?: 'critical' | 'high' | 'medium' | 'low';
  category?: string;
}

interface RiskHighlight {
  id: string;
  text: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  explanation: string;
  suggestedFix?: string;
  position: { startOffset: number; endOffset: number };
}

interface AutoCompletion {
  id: string;
  text: string;
  source: 'library' | 'historical' | 'ai';
  matchScore: number;
  clauseId?: string;
  riskLevel?: 'low' | 'medium' | 'high';
}

interface Comment {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  resolved: boolean;
  position: { paragraph: number; offset: number };
  replies: Array<{ id: string; author: string; content: string; timestamp: string }>;
}

interface Version {
  id: string;
  version: string;
  author: string;
  timestamp: string;
  changes: number;
  label?: string;
}

interface CopilotDraftingCanvasProps {
  contractId?: string;
  initialContent?: string;
  contractType?: string;
  playbookId?: string;
  templateId?: string;
  draftId?: string;
  isBlankDocument?: boolean;
  onSave?: (content: string) => Promise<void>;
  onLegalReview?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CopilotDraftingCanvas({
  contractId,
  initialContent = '',
  contractType = 'MSA',
  playbookId,
  templateId,
  draftId,
  isBlankDocument,
  onSave,
  onLegalReview,
}: CopilotDraftingCanvasProps) {
  const { data: session } = useSession();
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Content state
  const [content, setContent] = useState(initialContent);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedText, setSelectedText] = useState('');
  const debouncedContent = useDebounce(content, 500);

  // Copilot state
  const [suggestions, setSuggestions] = useState<CopilotSuggestion[]>([]);
  const [risks, setRisks] = useState<RiskHighlight[]>([]);
  const [autoCompletions, setAutoCompletions] = useState<AutoCompletion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  const [selectedCompletionIndex, setSelectedCompletionIndex] = useState(0);

  // UI state
  const [activeTab, setActiveTab] = useState<'copilot' | 'comments' | 'versions'>('copilot');
  const [isEditing, setIsEditing] = useState(true);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  // Comments & versions (would be fetched from API in production)
  const [comments, setComments] = useState<Comment[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [newComment, setNewComment] = useState('');

  // ============================================================================
  // COPILOT API CALLS
  // ============================================================================

  const fetchSuggestions = useCallback(async () => {
    if (!content || content.length < 50) return;

    setIsLoadingSuggestions(true);
    try {
      const response = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: content,
          cursorPosition,
          selectedText,
          contractType,
          playbookId,
          mode: 'realtime',
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const data = json.data || json;
        setSuggestions(data.suggestions || []);
        setRisks(data.risks || []);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      toast.error('Failed to fetch AI suggestions');
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [content, cursorPosition, selectedText, contractType, playbookId]);

  const fetchAutoCompletions = useCallback(async (text: string) => {
    if (!text || text.length < 10) {
      setAutoCompletions([]);
      setShowCompletionPopup(false);
      return;
    }

    try {
      const response = await fetch('/api/copilot/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          cursorPosition,
          contractType,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const data = json.data || json;
        setAutoCompletions(data.completions || []);
        setShowCompletionPopup(data.completions?.length > 0);
        setSelectedCompletionIndex(0);
      }
    } catch (error) {
      console.error('Failed to fetch completions:', error);
    }
  }, [cursorPosition, contractType]);

  const fetchRisks = useCallback(async () => {
    if (!content || content.length < 100) return;

    try {
      const response = await fetch('/api/copilot/risks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: content,
          contractType,
          playbook: playbookId ? { id: playbookId } : undefined,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const data = json.data || json;
        setRisks(data.risks || []);
      }
    } catch (error) {
      console.error('Failed to fetch risks:', error);
      toast.error('Failed to analyze risks');
    }
  }, [content, contractType, playbookId]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Fetch suggestions when content changes (debounced)
  useEffect(() => {
    if (debouncedContent.length > 100) {
      fetchSuggestions();
    }
  }, [debouncedContent, fetchSuggestions]);

  // Fetch risks periodically or on significant content changes
  useEffect(() => {
    const interval = setInterval(() => {
      if (content.length > 200) {
        fetchRisks();
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [content, fetchRisks]);

  // Track last saved content to avoid redundant auto-saves
  const lastSavedContentRef = useRef(initialContent);

  // Auto-save
  useEffect(() => {
    const autoSave = setInterval(async () => {
      if (content !== lastSavedContentRef.current && onSave) {
        setIsSaving(true);
        try {
          await onSave(content);
          lastSavedContentRef.current = content;
          setLastSaved(new Date());
        } catch (error) {
          console.error('Auto-save failed:', error);
          toast.error('Auto-save failed');
        } finally {
          setIsSaving(false);
        }
      }
    }, 60000); // Every minute

    return () => clearInterval(autoSave);
  }, [content, onSave]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  // Auto-completion debounce ref
  const completionTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    
    // Save undo state on meaningful edits (debounced)
    if (Math.abs(newContent.length - content.length) > 5) {
      setUndoStack(prev => [...prev.slice(-49), content]);
      setRedoStack([]);
    }
    
    setContent(newContent);
    setCursorPosition(e.target.selectionStart);

    // Get current line/clause for auto-completion (debounced)
    const lines = newContent.slice(0, e.target.selectionStart).split('\n');
    const currentLine = lines[lines.length - 1];
    
    if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
    if (currentLine.length > 20) {
      completionTimerRef.current = setTimeout(() => {
        fetchAutoCompletions(currentLine);
      }, 800);
    }
  }, [content, fetchAutoCompletions]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle auto-completion navigation
    if (showCompletionPopup && autoCompletions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCompletionIndex(i => Math.min(i + 1, autoCompletions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCompletionIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Tab' || e.key === 'Enter') {
        if (autoCompletions[selectedCompletionIndex]) {
          e.preventDefault();
          applyCompletion(autoCompletions[selectedCompletionIndex]);
        }
      } else if (e.key === 'Escape') {
        setShowCompletionPopup(false);
      }
    }
  }, [showCompletionPopup, autoCompletions, selectedCompletionIndex]);

  const applyCompletion = useCallback((completion: AutoCompletion) => {
    if (!editorRef.current) return;

    const textarea = editorRef.current;
    const start = textarea.selectionStart;
    
    // Find the start of the current clause/line
    const beforeCursor = content.slice(0, start);
    const lineStart = beforeCursor.lastIndexOf('\n') + 1;
    
    const newContent = content.slice(0, lineStart) + completion.text + content.slice(start);
    setContent(newContent);
    setShowCompletionPopup(false);

    // Move cursor to end of inserted text
    setTimeout(() => {
      if (editorRef.current) {
        const newPosition = lineStart + completion.text.length;
        editorRef.current.setSelectionRange(newPosition, newPosition);
        editorRef.current.focus();
      }
    }, 0);
  }, [content]);

  const applySuggestion = useCallback((suggestion: CopilotSuggestion) => {
    const newContent = 
      content.slice(0, suggestion.position.startOffset) +
      suggestion.suggestedText +
      content.slice(suggestion.position.endOffset);
    
    setContent(newContent);
    setSelectedSuggestion(null);
    
    // Remove applied suggestion from list
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
  }, [content]);

  const handleAIAssist = useCallback(async () => {
    if (!aiPrompt.trim()) return;

    setIsGenerating(true);
    try {
      const response = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: content,
          cursorPosition,
          selectedText,
          contractType,
          playbookId,
          mode: 'assist',
          prompt: aiPrompt,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const data = json.data || json;
        if (data.generatedText) {
          // Insert at cursor position
          const newContent = 
            content.slice(0, cursorPosition) +
            data.generatedText +
            content.slice(cursorPosition);
          setContent(newContent);
        }
        if (data.suggestions) {
          setSuggestions(prev => [...data.suggestions, ...prev]);
        }
      }
    } catch (error) {
      console.error('AI assist failed:', error);
      toast.error('AI generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
      setAiPrompt('');
      setShowAIPanel(false);
    }
  }, [aiPrompt, content, cursorPosition, selectedText, contractType, playbookId]);

  const handleSave = useCallback(async () => {
    if (!onSave) return;
    
    setIsSaving(true);
    try {
      await onSave(content);
      lastSavedContentRef.current = content;
      setLastSaved(new Date());
      toast.success('Document saved');
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('Save failed');
    } finally {
      setIsSaving(false);
    }
  }, [content, onSave]);

  // ============================================================================
  // FORMATTING HELPERS (Markdown-style)
  // ============================================================================

  const insertFormatting = useCallback((format: string) => {
    if (!editorRef.current) return;
    const textarea = editorRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end);
    
    // Save undo state
    setUndoStack(prev => [...prev.slice(-49), content]);
    setRedoStack([]);

    let newContent = content;
    let newCursorPos = start;

    switch (format) {
      case 'bold': {
        const wrapped = `**${selected || 'bold text'}**`;
        newContent = content.slice(0, start) + wrapped + content.slice(end);
        newCursorPos = selected ? start + wrapped.length : start + 2;
        break;
      }
      case 'italic': {
        const wrapped = `*${selected || 'italic text'}*`;
        newContent = content.slice(0, start) + wrapped + content.slice(end);
        newCursorPos = selected ? start + wrapped.length : start + 1;
        break;
      }
      case 'underline': {
        const wrapped = `__${selected || 'underlined text'}__`;
        newContent = content.slice(0, start) + wrapped + content.slice(end);
        newCursorPos = selected ? start + wrapped.length : start + 2;
        break;
      }
      case 'h1': {
        const lineStart = content.lastIndexOf('\n', start - 1) + 1;
        newContent = content.slice(0, lineStart) + '# ' + content.slice(lineStart);
        newCursorPos = start + 2;
        break;
      }
      case 'h2': {
        const lineStart = content.lastIndexOf('\n', start - 1) + 1;
        newContent = content.slice(0, lineStart) + '## ' + content.slice(lineStart);
        newCursorPos = start + 3;
        break;
      }
      case 'list': {
        const lineStart = content.lastIndexOf('\n', start - 1) + 1;
        newContent = content.slice(0, lineStart) + '- ' + content.slice(lineStart);
        newCursorPos = start + 2;
        break;
      }
      case 'quote': {
        const lineStart = content.lastIndexOf('\n', start - 1) + 1;
        newContent = content.slice(0, lineStart) + '> ' + content.slice(lineStart);
        newCursorPos = start + 2;
        break;
      }
    }

    setContent(newContent);
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.focus();
        editorRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  }, [content]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(r => [...r, content]);
    setUndoStack(u => u.slice(0, -1));
    setContent(prev);
  }, [undoStack, content]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(u => [...u, content]);
    setRedoStack(r => r.slice(0, -1));
    setContent(next);
  }, [redoStack, content]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const riskSummary = useMemo(() => {
    return {
      critical: risks.filter(r => r.riskLevel === 'critical').length,
      high: risks.filter(r => r.riskLevel === 'high').length,
      medium: risks.filter(r => r.riskLevel === 'medium').length,
      low: risks.filter(r => r.riskLevel === 'low').length,
    };
  }, [risks]);

  const getSuggestionIcon = (type: CopilotSuggestion['type']) => {
    switch (type) {
      case 'risk_warning': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'compliance': return <Shield className="h-4 w-4 text-violet-500" />;
      case 'clause_improvement': return <Sparkles className="h-4 w-4 text-violet-500" />;
      case 'auto_complete': return <Zap className="h-4 w-4 text-yellow-500" />;
      case 'negotiation': return <Scale className="h-4 w-4 text-green-500" />;
      default: return <Lightbulb className="h-4 w-4 text-gray-500 dark:text-slate-400" />;
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
      case 'high': return 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800';
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
      case 'low': return 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
      default: return 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-600';
    }
  };

  // ============================================================================
  // SIDEBAR CONTENT (shared between desktop and mobile)
  // ============================================================================

  const renderSidebarContent = () => (
    <>
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-slate-700" role="tablist" aria-label="Sidebar panels">
        {[
          { id: 'copilot', icon: Brain, label: 'Copilot', count: suggestions.length },
          { id: 'comments', icon: MessageSquare, label: 'Comments', count: comments.length },
          { id: 'versions', icon: History, label: 'History', count: null },
        ].map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'text-violet-600 dark:text-violet-400 border-violet-600 dark:border-violet-400'
                : 'text-gray-500 dark:text-slate-400 border-transparent hover:text-gray-700 dark:hover:text-slate-300'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.count !== null && tab.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.id ? 'bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-300' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
        {activeTab === 'copilot' && (
          <div id="panel-copilot" role="tabpanel" aria-labelledby="tab-copilot" className="space-y-4">
            {/* Risk Summary */}
            {risks.length > 0 && (
              <div className="p-3 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/50 dark:to-orange-950/50 rounded-lg border border-red-100 dark:border-red-800">
                <h4 className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-red-500" />
                  Risk Analysis
                </h4>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Critical', value: riskSummary.critical, color: 'text-red-600 dark:text-red-400' },
                    { label: 'High', value: riskSummary.high, color: 'text-orange-600 dark:text-orange-400' },
                    { label: 'Medium', value: riskSummary.medium, color: 'text-yellow-600 dark:text-yellow-400' },
                    { label: 'Low', value: riskSummary.low, color: 'text-green-600 dark:text-green-400' },
                  ].map((stat) => (
                    <div key={stat.label} className="text-center">
                      <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
                      <div className="text-xs text-gray-500 dark:text-slate-400">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-900 dark:text-slate-100">AI Suggestions</h4>
                <button
                  onClick={() => fetchSuggestions()}
                  aria-label="Refresh AI suggestions"
                  className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300"
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh
                </button>
              </div>

              {isLoadingSuggestions && suggestions.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                </div>
              ) : suggestions.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                  <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No suggestions yet</p>
                  <p className="text-xs mt-1">Keep typing to get AI recommendations</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {suggestions.map((suggestion) => (
                    <motion.div
                      key={suggestion.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      tabIndex={0}
                      role="button"
                      aria-expanded={selectedSuggestion === suggestion.id}
                      className={`p-3 rounded-lg border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500 ${
                        selectedSuggestion === suggestion.id
                          ? 'border-violet-300 dark:border-violet-600 bg-violet-50 dark:bg-violet-900/30'
                          : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                      }`}
                      onClick={() => setSelectedSuggestion(selectedSuggestion === suggestion.id ? null : suggestion.id)}
                      onKeyDown={(e) => e.key === 'Enter' && setSelectedSuggestion(selectedSuggestion === suggestion.id ? null : suggestion.id)}
                    >
                      <div className="flex items-start gap-2">
                        {getSuggestionIcon(suggestion.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{suggestion.explanation}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              suggestion.source.type === 'playbook' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' :
                              suggestion.source.type === 'clause_library' ? 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300' :
                              suggestion.source.type === 'historical' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' :
                              'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
                            }`}>
                              {suggestion.source.type}
                            </span>
                            {suggestion.riskLevel && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${getRiskColor(suggestion.riskLevel)}`}>
                                {suggestion.riskLevel}
                              </span>
                            )}
                          </div>

                          <AnimatePresence>
                            {selectedSuggestion === suggestion.id && (
                              <motion.div key="selected-suggestion"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-3 space-y-2"
                              >
                                <div className="p-2 bg-red-50 dark:bg-red-950/50 rounded text-xs text-red-700 dark:text-red-300 line-through">
                                  {suggestion.triggerText.length > 100 ? suggestion.triggerText.slice(0, 100) + '...' : suggestion.triggerText}
                                </div>
                                <div className="p-2 bg-green-50 dark:bg-green-950/50 rounded text-xs text-green-700 dark:text-green-300">
                                  {suggestion.suggestedText.length > 150 ? suggestion.suggestedText.slice(0, 150) + '...' : suggestion.suggestedText}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      applySuggestion(suggestion);
                                    }}
                                    className="flex-1 px-3 py-1.5 bg-violet-600 text-white text-xs rounded-lg hover:bg-violet-700 transition-colors"
                                  >
                                    Apply
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
                                      setSelectedSuggestion(null);
                                    }}
                                    className="flex-1 px-3 py-1.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                                  >
                                    Dismiss
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        <div className="text-xs text-gray-400 dark:text-slate-500">
                          {Math.round(suggestion.confidence * 100)}%
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Risks List */}
            {risks.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Detected Risks
                </h4>
                <div className="space-y-2">
                  {risks.slice(0, 5).map((risk) => (
                    <div
                      key={risk.id}
                      className={`p-2 rounded-lg border ${getRiskColor(risk.riskLevel)}`}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium">{risk.category}</p>
                          <p className="text-xs mt-0.5 opacity-80">{risk.explanation}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'comments' && (
          <div id="panel-comments" role="tabpanel" aria-labelledby="tab-comments" className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                aria-label="Add a comment"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button className="p-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors" aria-label="Submit comment">
                <Send className="h-4 w-4" />
              </button>
            </div>

            {comments.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No comments yet</p>
                <p className="text-xs mt-1 text-gray-400 dark:text-slate-500">Comments will appear here during review</p>
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <div className="flex items-start gap-2">
                    <div className="h-8 w-8 rounded-full bg-violet-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                      {comment.author.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-slate-100">{comment.author}</span>
                        <span className="text-xs text-gray-400 dark:text-slate-500">{comment.timestamp}</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-slate-300 mt-1">{comment.content}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'versions' && (
          <div id="panel-versions" role="tabpanel" aria-labelledby="tab-versions" className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900 dark:text-slate-100">Version History</h3>
              <button className="flex items-center gap-1 text-sm text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors" aria-label="Compare versions">
                <GitBranch className="h-4 w-4" />
                Compare
              </button>
            </div>
            {versions.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No versions yet</p>
                <p className="text-xs mt-1 text-gray-400 dark:text-slate-500">Save to create a version</p>
              </div>
            ) : (
              versions.map((version, index) => (
                <div
                  key={version.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    index === 0 ? 'border-violet-200 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/30' : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-slate-100">v{version.version}</span>
                        {version.label && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            version.label === 'Current' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
                          }`}>
                            {version.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{version.author}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{version.timestamp}</p>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-slate-400">{version.changes} changes</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Brain className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                <div>
                  <h1 className="font-semibold text-gray-900 dark:text-slate-100">AI Copilot Editor</h1>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{contractType} • Real-time AI assistance</p>
                </div>
              </div>
              <div className="h-6 w-px bg-gray-200 dark:bg-slate-600" />
              <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400">
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : lastSaved ? (
                  <>
                    <Clock className="h-4 w-4" />
                    <span>Saved {lastSaved.toLocaleTimeString()}</span>
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4" />
                    <span>Not saved yet</span>
                  </>
                )}
              </div>

              {/* Risk Summary Badge */}
              {(riskSummary.critical > 0 || riskSummary.high > 0) && (
                <>
                  <div className="h-6 w-px bg-gray-200 dark:bg-slate-600 hidden sm:block" />
                  <div className="flex items-center gap-2">
                    {riskSummary.critical > 0 && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-full text-xs font-medium">
                        <AlertCircle className="h-3 w-3" />
                        {riskSummary.critical} Critical
                      </span>
                    )}
                    {riskSummary.high > 0 && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 rounded-full text-xs font-medium">
                        <AlertTriangle className="h-3 w-3" />
                        {riskSummary.high} High
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Mobile Sidebar Toggle */}
              <button
                onClick={() => setShowMobileSidebar(true)}
                className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 text-sm text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors"
                aria-label="Open AI Copilot panel"
              >
                <Brain className="h-4 w-4" />
                <span className="hidden sm:inline">Copilot</span>
              </button>

              {/* Mode Toggle */}
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1" role="radiogroup" aria-label="Editor mode">
                <button
                  onClick={() => setIsEditing(true)}
                  role="radio"
                  aria-checked={isEditing}
                  aria-label="Switch to edit mode"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    isEditing ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm' : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100'
                  }`}
                >
                  <Edit3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Edit</span>
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  role="radio"
                  aria-checked={!isEditing}
                  aria-label="Switch to preview mode"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    !isEditing ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm' : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100'
                  }`}
                >
                  <Eye className="h-4 w-4" />
                  <span className="hidden sm:inline">Preview</span>
                </button>
              </div>

              <div className="h-6 w-px bg-gray-200 dark:bg-slate-600 hidden sm:block" />

              {/* Actions */}
              {onLegalReview && (
                <button
                  onClick={onLegalReview}
                  className="hidden sm:flex items-center gap-2 px-3 py-2 border border-violet-200 dark:border-violet-700 text-violet-700 dark:text-violet-300 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors"
                >
                  <FileCheck className="h-4 w-4" />
                  Legal Review
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            </div>
          </div>

          {/* Toolbar */}
          {isEditing && (
            <div className="mt-3 flex flex-wrap items-center gap-1 pb-2 border-b border-gray-100 dark:border-slate-700" role="toolbar" aria-label="Document formatting toolbar">
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 dark:bg-slate-700" role="group" aria-label="History controls">
                <button onClick={handleUndo} disabled={undoStack.length === 0} className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-30" title="Undo (Ctrl+Z)" aria-label="Undo last action">
                  <Undo2 className="h-4 w-4 text-gray-600 dark:text-slate-300" />
                </button>
                <button onClick={handleRedo} disabled={redoStack.length === 0} className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-30" title="Redo (Ctrl+Y)" aria-label="Redo last action">
                  <Redo2 className="h-4 w-4 text-gray-600 dark:text-slate-300" />
                </button>
              </div>
              <div className="h-5 w-px bg-gray-200 dark:bg-slate-600 mx-1" />
              <div className="flex items-center gap-1" role="group" aria-label="Text formatting">
                <button onClick={() => insertFormatting('bold')} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors" title="Bold (**text**)" aria-label="Bold text">
                  <Bold className="h-4 w-4 text-gray-600 dark:text-slate-300" />
                </button>
                <button onClick={() => insertFormatting('italic')} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors" title="Italic (*text*)" aria-label="Italic text">
                  <Italic className="h-4 w-4 text-gray-600 dark:text-slate-300" />
                </button>
                <button onClick={() => insertFormatting('underline')} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors" title="Underline (__text__)" aria-label="Underline text">
                  <Underline className="h-4 w-4 text-gray-600 dark:text-slate-300" />
                </button>
              </div>
              <div className="h-5 w-px bg-gray-200 dark:bg-slate-600 mx-1" />
              <div className="flex items-center gap-1" role="group" aria-label="Headings">
                <button onClick={() => insertFormatting('h1')} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors" title="Heading 1 (# )" aria-label="Insert heading level 1">
                  <Heading1 className="h-4 w-4 text-gray-600 dark:text-slate-300" />
                </button>
                <button onClick={() => insertFormatting('h2')} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors" title="Heading 2 (## )" aria-label="Insert heading level 2">
                  <Heading2 className="h-4 w-4 text-gray-600 dark:text-slate-300" />
                </button>
              </div>
              <div className="h-5 w-px bg-gray-200 dark:bg-slate-600 mx-1" />
              <div className="flex items-center gap-1" role="group" aria-label="Block elements">
                <button onClick={() => insertFormatting('list')} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors" title="List (- item)" aria-label="Insert list">
                  <List className="h-4 w-4 text-gray-600 dark:text-slate-300" />
                </button>
                <button onClick={() => insertFormatting('quote')} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors" title="Quote (> text)" aria-label="Insert quote">
                  <Quote className="h-4 w-4 text-gray-600 dark:text-slate-300" />
                </button>
              </div>
              <div className="flex-1" />
              
              {/* Copilot Status */}
              <div className="flex items-center gap-2 mr-2">
                {isLoadingSuggestions && (
                  <span className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="hidden sm:inline">Analyzing...</span>
                  </span>
                )}
                <span className="text-xs text-gray-500 dark:text-slate-400 hidden sm:inline">
                  {suggestions.length} suggestions
                </span>
              </div>

              <button
                onClick={() => setShowAIPanel(!showAIPanel)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg hover:from-violet-600 hover:to-purple-600 transition-colors text-sm"
              >
                <Wand2 className="h-4 w-4" />
                AI Assist
              </button>
            </div>
          )}

          {/* AI Assist button visible in preview mode */}
          {!isEditing && (
            <div className="mt-3 flex justify-end pb-2 border-b border-gray-100 dark:border-slate-700">
              <button
                onClick={() => setShowAIPanel(!showAIPanel)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg hover:from-violet-600 hover:to-purple-600 transition-colors text-sm"
              >
                <Wand2 className="h-4 w-4" />
                AI Assist
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex relative">
        {/* Editor */}
        <div className="flex-1 p-4 md:p-8">
          <div className="max-w-4xl mx-auto">
            {/* AI Panel */}
            <AnimatePresence>
              {showAIPanel && (
                <motion.div key="a-i-panel"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 overflow-hidden"
                >
                  <div className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/50 dark:to-purple-950/50 rounded-xl p-4 border border-violet-100 dark:border-violet-800">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                        <Brain className="h-5 w-5 text-violet-500 dark:text-violet-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-slate-100 mb-2">AI Copilot Assistant</h3>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAIAssist()}
                            placeholder="Ask AI to help... (e.g., 'Strengthen the liability clause', 'Add GDPR compliance language')"
                            aria-label="AI prompt input"
                            className="flex-1 px-4 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                          />
                          <button
                            onClick={handleAIAssist}
                            disabled={isGenerating || !aiPrompt.trim()}
                            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
                          >
                            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate'}
                          </button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {[
                            'Strengthen liability cap',
                            'Add GDPR clause',
                            'Improve termination terms',
                            'Add indemnification',
                            'Clarify IP ownership',
                            'Add force majeure',
                          ].map((suggestion) => (
                            <button
                              key={suggestion}
                              onClick={() => setAiPrompt(suggestion)}
                              className="px-3 py-1 text-sm bg-white dark:bg-slate-800 text-violet-700 dark:text-violet-300 rounded-full hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors border border-violet-200 dark:border-violet-700"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => setShowAIPanel(false)} className="p-1 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300" aria-label="Close AI panel">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Document Content */}
            <div className="relative">
              <div
                className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-4 md:p-8 min-h-[600px] md:min-h-[800px] ${
                  isEditing ? 'focus-within:ring-2 focus-within:ring-violet-500 focus-within:border-transparent' : ''
                }`}
              >
                {isEditing ? (
                  <textarea
                    ref={editorRef}
                    value={content}
                    onChange={handleContentChange}
                    onKeyDown={handleKeyDown}
                    onSelect={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      setCursorPosition(target.selectionStart);
                      if (target.selectionStart !== target.selectionEnd) {
                        setSelectedText(content.slice(target.selectionStart, target.selectionEnd));
                      } else {
                        setSelectedText('');
                      }
                    }}
                    className="w-full h-full min-h-[550px] md:min-h-[750px] resize-none focus:outline-none font-serif text-gray-900 dark:text-slate-100 dark:bg-slate-800 leading-relaxed text-base md:text-lg"
                    style={{ fontFamily: 'Georgia, serif' }}
                    placeholder="Start drafting your contract..."
                    aria-label="Contract document editor"
                  />
                ) : (
                  <div className="prose prose-lg dark:prose-invert max-w-none font-serif" style={{ fontFamily: 'Georgia, serif' }}>
                    {content.split('\n').map((line, index) => {
                      // Render Markdown-like syntax
                      if (line.startsWith('## ')) return <h2 key={index} className="text-xl font-bold mt-6 mb-3 text-gray-900 dark:text-slate-100">{line.slice(3)}</h2>;
                      if (line.startsWith('# ')) return <h1 key={index} className="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-slate-100">{line.slice(2)}</h1>;
                      if (line.startsWith('> ')) return <blockquote key={index} className="border-l-4 border-violet-300 dark:border-violet-600 pl-4 italic text-gray-600 dark:text-slate-400 my-3">{line.slice(2)}</blockquote>;
                      if (line.startsWith('- ')) return <li key={index} className="ml-6 list-disc text-gray-700 dark:text-slate-300">{line.slice(2)}</li>;
                      if (line.trim() === '') return <br key={index} />;
                      // Inline formatting
                      const rendered = line
                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.+?)\*/g, '<em>$1</em>')
                        .replace(/__(.+?)__/g, '<u>$1</u>');
                      return <p key={index} className="text-gray-700 dark:text-slate-300 my-2" dangerouslySetInnerHTML={{ __html: rendered }} />;
                    })}
                  </div>
                )}
              </div>

              {/* Auto-completion Popup */}
              <AnimatePresence>
                {showCompletionPopup && autoCompletions.length > 0 && (
                  <motion.div key="completion-popup"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute left-4 md:left-8 top-20 z-20 w-[calc(100%-2rem)] md:w-full max-w-[600px] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 overflow-hidden"
                    role="listbox"
                    aria-label="Auto-complete suggestions"
                  >
                    <div className="px-3 py-2 bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-slate-200">Auto-complete suggestions</span>
                      <span className="text-xs text-gray-400 dark:text-slate-500 ml-auto">Tab to accept</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {autoCompletions.map((completion, index) => (
                        <button
                          key={completion.id}
                          role="option"
                          aria-selected={index === selectedCompletionIndex}
                          onClick={() => applyCompletion(completion)}
                          className={`w-full px-4 py-3 text-left hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors border-b border-gray-100 dark:border-slate-700 last:border-0 ${
                            index === selectedCompletionIndex ? 'bg-violet-50 dark:bg-violet-900/30' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-1 px-1.5 py-0.5 rounded text-xs ${
                              completion.source === 'library' ? 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300' :
                              completion.source === 'historical' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' :
                              'bg-gray-100 dark:bg-slate-600 text-gray-700 dark:text-slate-300'
                            }`}>
                              {completion.source}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-gray-900 dark:text-slate-100 line-clamp-2">{completion.text}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-gray-500 dark:text-slate-400">
                                  {Math.round(completion.matchScore * 100)}% match
                                </span>
                                {completion.riskLevel && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${getRiskColor(completion.riskLevel)}`}>
                                    {completion.riskLevel} risk
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Copilot Panel (Desktop) */}
        <div className="hidden lg:block w-80 xl:w-96 bg-white dark:bg-slate-800 border-l border-gray-200 dark:border-slate-700 min-h-[calc(100vh-120px)]">
          {renderSidebarContent()}
        </div>

        {/* Mobile Sidebar Drawer */}
        <AnimatePresence>
          {showMobileSidebar && (
            <>
              <motion.div
                key="sidebar-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                onClick={() => setShowMobileSidebar(false)}
              />
              <motion.div
                key="sidebar-drawer"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed right-0 top-0 bottom-0 w-[85vw] max-w-[400px] bg-white dark:bg-slate-800 border-l border-gray-200 dark:border-slate-700 z-50 lg:hidden shadow-2xl"
              >
                <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-slate-700">
                  <h3 className="font-semibold text-gray-900 dark:text-slate-100">AI Copilot</h3>
                  <button
                    onClick={() => setShowMobileSidebar(false)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                    aria-label="Close sidebar"
                  >
                    <X className="h-5 w-5 text-gray-500 dark:text-slate-400" />
                  </button>
                </div>
                <div className="overflow-y-auto h-[calc(100vh-56px)]">
                  {renderSidebarContent()}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default CopilotDraftingCanvas;
