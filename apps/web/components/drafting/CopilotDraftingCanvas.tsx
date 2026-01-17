'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Users, History, MessageSquare, Wand2, CheckCircle2, AlertTriangle,
  Lightbulb, Save, Download, Share2, Eye, Edit3, ChevronDown, Sparkles,
  GitBranch, Undo2, Redo2, Bold, Italic, Underline, List, AlignLeft,
  AlignCenter, AlignRight, Link2, Image as ImageIcon, Table, Code,
  Heading1, Heading2, Quote, X, Send, Clock, Zap, Shield, Scale,
  FileCheck, RefreshCw, Loader2, Brain, Target, BookOpen, AlertCircle,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useDebounce } from '@/hooks/useDebounce';

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

interface Collaborator {
  id: string;
  name: string;
  avatar?: string;
  color: string;
  isActive: boolean;
  lastSeen: string;
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
  const [showCollaborators, setShowCollaborators] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);

  // Comments & versions (would be fetched from API in production)
  const [comments, setComments] = useState<Comment[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
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
          content,
          cursorPosition,
          selectedText,
          contractType,
          playbookId,
          mode: 'realtime',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
        setRisks(data.risks || []);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
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
        const data = await response.json();
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
          content,
          contractType,
          playbookId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setRisks(data.risks || []);
      }
    } catch (error) {
      console.error('Failed to fetch risks:', error);
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

  // Auto-save
  useEffect(() => {
    const autoSave = setInterval(async () => {
      if (content !== initialContent && onSave) {
        setIsSaving(true);
        try {
          await onSave(content);
          setLastSaved(new Date());
        } catch (error) {
          console.error('Auto-save failed:', error);
        } finally {
          setIsSaving(false);
        }
      }
    }, 60000); // Every minute

    return () => clearInterval(autoSave);
  }, [content, initialContent, onSave]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    setCursorPosition(e.target.selectionStart);

    // Get current line/clause for auto-completion
    const lines = newContent.slice(0, e.target.selectionStart).split('\n');
    const currentLine = lines[lines.length - 1];
    
    // Trigger auto-completion if typing a clause
    if (currentLine.length > 20 && currentLine.length % 10 === 0) {
      fetchAutoCompletions(currentLine);
    }
  }, [fetchAutoCompletions]);

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
          content,
          cursorPosition,
          selectedText,
          contractType,
          playbookId,
          mode: 'assist',
          prompt: aiPrompt,
        }),
      });

      if (response.ok) {
        const data = await response.json();
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
      setLastSaved(new Date());
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  }, [content, onSave]);

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
      case 'compliance': return <Shield className="h-4 w-4 text-blue-500" />;
      case 'clause_improvement': return <Sparkles className="h-4 w-4 text-purple-500" />;
      case 'auto_complete': return <Zap className="h-4 w-4 text-yellow-500" />;
      case 'negotiation': return <Scale className="h-4 w-4 text-green-500" />;
      default: return <Lightbulb className="h-4 w-4 text-gray-500 dark:text-slate-400" />;
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                <div>
                  <h1 className="font-semibold text-gray-900 dark:text-slate-100 dark:text-slate-100">AI Copilot Editor</h1>
                  <p className="text-xs text-gray-500 dark:text-slate-400 dark:text-slate-400">{contractType} • Real-time AI assistance</p>
                </div>
              </div>
              <div className="h-6 w-px bg-gray-200 dark:bg-slate-600" />
              <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400 dark:text-slate-400">
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
                  <div className="h-6 w-px bg-gray-200" />
                  <div className="flex items-center gap-2">
                    {riskSummary.critical > 0 && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                        <AlertCircle className="h-3 w-3" />
                        {riskSummary.critical} Critical
                      </span>
                    )}
                    {riskSummary.high > 0 && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                        <AlertTriangle className="h-3 w-3" />
                        {riskSummary.high} High
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Mode Toggle */}
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
                <button
                  onClick={() => setIsEditing(true)}
                  aria-label="Switch to edit mode"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    isEditing ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm' : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100'
                  }`}
                >
                  <Edit3 className="h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  aria-label="Switch to preview mode"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    !isEditing ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-slate-100 shadow-sm' : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100'
                  }`}
                >
                  <Eye className="h-4 w-4" />
                  Preview
                </button>
              </div>

              <div className="h-6 w-px bg-gray-200" />

              {/* Actions */}
              {onLegalReview && (
                <button
                  onClick={onLegalReview}
                  className="flex items-center gap-2 px-3 py-2 border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors"
                >
                  <FileCheck className="h-4 w-4" />
                  Legal Review
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
            </div>
          </div>

          {/* Toolbar */}
          {isEditing && (
            <div className="mt-3 flex items-center gap-1 pb-2 border-b border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 dark:bg-slate-700" role="group" aria-label="History controls">
                <button className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors" title="Undo" aria-label="Undo last action">
                  <Undo2 className="h-4 w-4 text-gray-600 dark:text-slate-400 dark:text-slate-300" />
                </button>
                <button className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors" title="Redo" aria-label="Redo last action">
                  <Redo2 className="h-4 w-4 text-gray-600 dark:text-slate-400 dark:text-slate-300" />
                </button>
              </div>
              <div className="h-5 w-px bg-gray-200 dark:bg-slate-600 mx-1" />
              <div className="flex items-center gap-1" role="group" aria-label="Text formatting">
                <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors" title="Bold" aria-label="Bold text">
                  <Bold className="h-4 w-4 text-gray-600 dark:text-slate-400 dark:text-slate-300" />
                </button>
                <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors" title="Italic" aria-label="Italic text">
                  <Italic className="h-4 w-4 text-gray-600 dark:text-slate-400 dark:text-slate-300" />
                </button>
                <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors" title="Underline" aria-label="Underline text">
                  <Underline className="h-4 w-4 text-gray-600 dark:text-slate-400 dark:text-slate-300" />
                </button>
              </div>
              <div className="h-5 w-px bg-gray-200 dark:bg-slate-600 mx-1" />
              <div className="flex items-center gap-1" role="group" aria-label="Headings">
                <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors" title="Heading 1" aria-label="Insert heading level 1">
                  <Heading1 className="h-4 w-4 text-gray-600 dark:text-slate-400 dark:text-slate-300" />
                </button>
                <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors" title="Heading 2" aria-label="Insert heading level 2">
                  <Heading2 className="h-4 w-4 text-gray-600 dark:text-slate-400 dark:text-slate-300" />
                </button>
              </div>
              <div className="h-5 w-px bg-gray-200 dark:bg-slate-600 mx-1" />
              <div className="flex items-center gap-1" role="group" aria-label="Block elements">
                <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors" title="List" aria-label="Insert list">
                  <List className="h-4 w-4 text-gray-600 dark:text-slate-400 dark:text-slate-300" />
                </button>
                <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors" title="Quote" aria-label="Insert quote">
                  <Quote className="h-4 w-4 text-gray-600 dark:text-slate-400 dark:text-slate-300" />
                </button>
              </div>
              <div className="flex-1" />
              
              {/* Copilot Status */}
              <div className="flex items-center gap-2 mr-2">
                {isLoadingSuggestions && (
                  <span className="flex items-center gap-1 text-xs text-purple-600">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Analyzing...
                  </span>
                )}
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  {suggestions.length} suggestions
                </span>
              </div>

              <button
                onClick={() => setShowAIPanel(!showAIPanel)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-colors text-sm"
              >
                <Wand2 className="h-4 w-4" />
                AI Assist
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex">
        {/* Editor */}
        <div className="flex-1 p-8">
          <div className="max-w-4xl mx-auto">
            {/* AI Panel */}
            <AnimatePresence>
              {showAIPanel && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 overflow-hidden"
                >
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/50 dark:to-blue-950/50 rounded-xl p-4 border border-purple-100 dark:border-purple-800">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                        <Brain className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-slate-100 dark:text-slate-100 mb-2">AI Copilot Assistant</h3>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAIAssist()}
                            placeholder="Ask AI to help... (e.g., 'Strengthen the liability clause', 'Add GDPR compliance language')"
                            aria-label="AI prompt input"
                            className="flex-1 px-4 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                          <button
                            onClick={handleAIAssist}
                            disabled={isGenerating || !aiPrompt.trim()}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
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
                              className="px-3 py-1 text-sm bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors border border-purple-200 dark:border-purple-700"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => setShowAIPanel(false)} className="p-1 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-300" aria-label="Close AI panel">
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
                className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-8 min-h-[800px] ${
                  isEditing ? 'focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent' : ''
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
                    className="w-full h-full min-h-[750px] resize-none focus:outline-none font-serif text-gray-900 dark:text-slate-100 dark:text-slate-100 dark:bg-slate-800 leading-relaxed"
                    style={{ fontFamily: 'Georgia, serif' }}
                    placeholder="Start drafting your contract..."
                    aria-label="Contract document editor"
                  />
                ) : (
                  <div className="prose prose-lg max-w-none font-serif" style={{ fontFamily: 'Georgia, serif' }}>
                    {content.split('\n').map((paragraph, index) => (
                      <p key={index} className={paragraph.startsWith('#') ? 'font-bold text-xl mt-6' : ''}>
                        {paragraph || <br />}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* Auto-completion Popup */}
              <AnimatePresence>
                {showCompletionPopup && autoCompletions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute left-8 top-20 z-20 w-full max-w-[600px] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 overflow-hidden"
                  >
                    <div className="px-3 py-2 bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-slate-300 dark:text-slate-200">Auto-complete suggestions</span>
                      <span className="text-xs text-gray-400 dark:text-slate-500 ml-auto">Tab to accept</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {autoCompletions.map((completion, index) => (
                        <button
                          key={completion.id}
                          onClick={() => applyCompletion(completion)}
                          aria-label={`Apply completion: ${completion.text.slice(0, 50)}...`}
                          className={`w-full px-4 py-3 text-left hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors border-b border-gray-100 dark:border-slate-700 last:border-0 ${
                            index === selectedCompletionIndex ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-1 px-1.5 py-0.5 rounded text-xs ${
                              completion.source === 'library' ? 'bg-purple-100 text-purple-700' :
                              completion.source === 'historical' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {completion.source}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-gray-900 dark:text-slate-100 dark:text-slate-100 line-clamp-2">{completion.text}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-gray-500 dark:text-slate-400 dark:text-slate-400">
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

        {/* Right Sidebar - Copilot Panel */}
        <div className="hidden lg:block w-80 xl:w-96 bg-white dark:bg-slate-800 border-l border-gray-200 dark:border-slate-700 min-h-[calc(100vh-120px)]">
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200 dark:border-slate-700">
            {[
              { id: 'copilot', icon: Brain, label: 'Copilot', count: suggestions.length },
              { id: 'comments', icon: MessageSquare, label: 'Comments', count: comments.length },
              { id: 'versions', icon: History, label: 'History', count: null },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'text-purple-600 border-purple-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.count !== null && tab.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'
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
              <div className="space-y-4">
                {/* Risk Summary */}
                {risks.length > 0 && (
                  <div className="p-3 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/50 dark:to-orange-950/50 rounded-lg border border-red-100 dark:border-red-800">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-slate-100 dark:text-slate-100 mb-2 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-red-500" />
                      Risk Analysis
                    </h4>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: 'Critical', value: riskSummary.critical, color: 'text-red-600' },
                        { label: 'High', value: riskSummary.high, color: 'text-orange-600' },
                        { label: 'Medium', value: riskSummary.medium, color: 'text-yellow-600' },
                        { label: 'Low', value: riskSummary.low, color: 'text-green-600' },
                      ].map((stat) => (
                        <div key={stat.label} className="text-center">
                          <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
                          <div className="text-xs text-gray-500 dark:text-slate-400 dark:text-slate-400">{stat.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestions List */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-slate-100 dark:text-slate-100">AI Suggestions</h4>
                    <button
                      onClick={() => fetchSuggestions()}
                      aria-label="Refresh AI suggestions"
                      className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Refresh
                    </button>
                  </div>

                  {isLoadingSuggestions && suggestions.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                    </div>
                  ) : suggestions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-slate-400 dark:text-slate-400">
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
                          className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                            selectedSuggestion === suggestion.id
                              ? 'border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/30'
                              : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                          }`}
                          onClick={() => setSelectedSuggestion(selectedSuggestion === suggestion.id ? null : suggestion.id)}
                        >
                          <div className="flex items-start gap-2">
                            {getSuggestionIcon(suggestion.type)}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-slate-100 dark:text-slate-100 truncate">{suggestion.explanation}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  suggestion.source.type === 'playbook' ? 'bg-green-100 text-green-700' :
                                  suggestion.source.type === 'clause_library' ? 'bg-purple-100 text-purple-700' :
                                  suggestion.source.type === 'historical' ? 'bg-blue-100 text-blue-700' :
                                  'bg-gray-100 text-gray-700'
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
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-3 space-y-2"
                                  >
                                    <div className="p-2 bg-red-50 dark:bg-red-950/50 rounded text-xs text-red-700 dark:text-red-300 line-through">
                                      {suggestion.triggerText.slice(0, 100)}...
                                    </div>
                                    <div className="p-2 bg-green-50 dark:bg-green-950/50 rounded text-xs text-green-700 dark:text-green-300">
                                      {suggestion.suggestedText.slice(0, 150)}...
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          applySuggestion(suggestion);
                                        }}
                                        className="flex-1 px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700"
                                      >
                                        Apply
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
                                          setSelectedSuggestion(null);
                                        }}
                                        className="flex-1 px-3 py-1.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 dark:text-slate-300 text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
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
                    <h4 className="text-sm font-medium text-gray-900 dark:text-slate-100 dark:text-slate-100 mb-3 flex items-center gap-2">
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
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    aria-label="Add a comment"
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700" aria-label="Submit comment">
                    <Send className="h-4 w-4" />
                  </button>
                </div>

                {comments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-slate-400 dark:text-slate-400">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No comments yet</p>
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="p-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                      <div className="flex items-start gap-2">
                        <div className="h-8 w-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-sm font-medium">
                          {comment.author.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-slate-100 dark:text-slate-100">{comment.author}</span>
                            <span className="text-xs text-gray-400 dark:text-slate-500">{comment.timestamp}</span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-slate-400 dark:text-slate-300 mt-1">{comment.content}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'versions' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-900 dark:text-slate-100 dark:text-slate-100">Version History</h3>
                  <button className="flex items-center gap-1 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300" aria-label="Compare versions">
                    <GitBranch className="h-4 w-4" />
                    Compare
                  </button>
                </div>
                {versions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-slate-400 dark:text-slate-400">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No versions yet</p>
                    <p className="text-xs mt-1">Save to create a version</p>
                  </div>
                ) : (
                  versions.map((version, index) => (
                    <div
                      key={version.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        index === 0 ? 'border-purple-200 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/30' : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-slate-100 dark:text-slate-100">v{version.version}</span>
                            {version.label && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                version.label === 'Current' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
                              }`}>
                                {version.label}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-slate-400 dark:text-slate-400 mt-0.5">{version.author}</p>
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{version.timestamp}</p>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-400 dark:text-slate-400">{version.changes} changes</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CopilotDraftingCanvas;
