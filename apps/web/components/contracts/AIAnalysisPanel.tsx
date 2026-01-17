'use client';

/**
 * AI Analysis Panel
 * 
 * Interactive panel for custom AI analysis of contracts.
 * Supports:
 * - Pre-built analysis templates
 * - Custom questions
 * - Conversation history
 * - Multi-language support
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  MessageSquare, 
  Send, 
  Sparkles, 
  History, 
  ChevronDown, 
  ChevronRight,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
  FileText,
  Shield,
  DollarSign,
  Scale,
  Clock,
  Target,
  BookOpen,
  Gavel,
  Database,
  Activity,
  XCircle,
  RefreshCw,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  template?: string;
}

interface AnalysisResult {
  answer: string;
  keyPoints?: string[];
  confidence: number;
  sources?: string[];
  suggestedFollowUps?: string[];
  metadata: {
    model: string;
    processingTime: number;
    tokensUsed: number;
    anonymizationApplied: boolean;
  };
}

interface AnalysisTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

interface AIAnalysisPanelProps {
  contractId: string;
  contractName?: string;
  className?: string;
  onAnalysisComplete?: (result: AnalysisResult) => void;
}

// ============================================================================
// Template Configuration
// ============================================================================

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  'risk-assessment': <AlertTriangle className="h-4 w-4" />,
  'financial-analysis': <DollarSign className="h-4 w-4" />,
  'compliance-check': <Shield className="h-4 w-4" />,
  'obligation-extraction': <Target className="h-4 w-4" />,
  'term-comparison': <Scale className="h-4 w-4" />,
  'clause-explanation': <BookOpen className="h-4 w-4" />,
  'negotiation-points': <Gavel className="h-4 w-4" />,
  'summary': <FileText className="h-4 w-4" />,
  'key-dates': <Clock className="h-4 w-4" />,
  'liability-analysis': <AlertTriangle className="h-4 w-4" />,
  'termination-clauses': <XCircle className="h-4 w-4" />,
  'ip-rights': <Shield className="h-4 w-4" />,
  'data-protection': <Database className="h-4 w-4" />,
  'sla-requirements': <Activity className="h-4 w-4" />,
  'penalty-clauses': <AlertTriangle className="h-4 w-4" />,
  'custom': <MessageSquare className="h-4 w-4" />,
};

// Quick action templates (shown as buttons)
const QUICK_ACTIONS = [
  { id: 'summary', name: 'Executive Summary' },
  { id: 'risk-assessment', name: 'Risk Assessment' },
  { id: 'key-dates', name: 'Key Dates' },
  { id: 'obligation-extraction', name: 'Obligations' },
];

// ============================================================================
// Main Component
// ============================================================================

export function AIAnalysisPanel({
  contractId,
  contractName,
  className,
  onAnalysisComplete,
}: AIAnalysisPanelProps) {
  // State
  const [templates, setTemplates] = useState<AnalysisTemplate[]>([]);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [language, setLanguage] = useState<'en' | 'de' | 'fr' | 'it'>('en');
  const [currentResult, setCurrentResult] = useState<AnalysisResult | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load templates on mount
  useEffect(() => {
    async function loadTemplates() {
      try {
        const response = await fetch(`/api/contracts/${contractId}/analyze`);
        if (response.ok) {
          const data = await response.json();
          const templatesWithIcons = data.templates.map((t: { id: string; name: string; description: string }) => ({
            ...t,
            icon: TEMPLATE_ICONS[t.id] || <MessageSquare className="h-4 w-4" />,
          }));
          setTemplates(templatesWithIcons);
        }
      } catch {
        // Error loading templates - fail silently
      }
    }
    loadTemplates();
  }, [contractId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // Focus input after loading completes
  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleAnalysis = useCallback(async (
    prompt: string,
    template?: string
  ) => {
    if (!prompt.trim() && !template) return;

    setIsLoading(true);
    setError(null);

    // Add user message to conversation
    const userMessage: ConversationMessage = {
      role: 'user',
      content: prompt || `Run ${template} analysis`,
      timestamp: new Date(),
      template,
    };
    setConversation(prev => [...prev, userMessage]);
    setInputValue('');

    try {
      const response = await fetch(`/api/contracts/${contractId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          template: template || 'custom',
          conversationHistory: conversation,
          language,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      const data = await response.json();
      const result = data.analysis as AnalysisResult;
      setCurrentResult(result);

      // Add assistant message
      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: result.answer,
        timestamp: new Date(),
      };
      setConversation(prev => [...prev, assistantMessage]);

      onAnalysisComplete?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsLoading(false);
      setSelectedTemplate(null);
    }
  }, [contractId, conversation, language, onAnalysisComplete]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    handleAnalysis(inputValue, selectedTemplate || undefined);
  }, [inputValue, selectedTemplate, handleAnalysis]);

  const handleQuickAction = useCallback((templateId: string) => {
    handleAnalysis('', templateId);
  }, [handleAnalysis]);

  const handleSuggestedQuestion = useCallback((question: string) => {
    handleAnalysis(question);
  }, [handleAnalysis]);

  const handleCopy = useCallback(async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }, []);

  const handleClearConversation = useCallback(() => {
    setConversation([]);
    setCurrentResult(null);
  }, []);

  const handleExportConversation = useCallback(() => {
    const content = conversation
      .map(m => `${m.role === 'user' ? 'You' : 'AI'}: ${m.content}`)
      .join('\n\n---\n\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contract-analysis-${contractId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [conversation, contractId]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className={cn(
      "flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg border shadow-sm",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            AI Contract Analysis
          </h3>
          {contractName && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              — {contractName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as typeof language)}
            className="text-sm border rounded px-2 py-1 bg-white dark:bg-gray-800"
          >
            <option value="en">English</option>
            <option value="de">Deutsch</option>
            <option value="fr">Français</option>
            <option value="it">Italiano</option>
          </select>

          {/* Actions */}
          {conversation.length > 0 && (
            <>
              <button
                onClick={handleExportConversation}
                className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded"
                title="Export conversation"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={handleClearConversation}
                className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded"
                title="Clear conversation"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-gray-50 dark:bg-gray-800/50 overflow-x-auto">
        {QUICK_ACTIONS.map(action => (
          <button
            key={action.id}
            onClick={() => handleQuickAction(action.id)}
            disabled={isLoading}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full",
              "bg-white dark:bg-gray-700 border",
              "hover:bg-purple-50 hover:border-purple-300 dark:hover:bg-purple-900/20",
              "transition-colors whitespace-nowrap",
              isLoading && "opacity-50 cursor-not-allowed"
            )}
          >
            {TEMPLATE_ICONS[action.id]}
            <span>{action.name}</span>
          </button>
        ))}
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full",
            "bg-white dark:bg-gray-700 border",
            "hover:bg-gray-100 dark:hover:bg-gray-600",
            "transition-colors whitespace-nowrap"
          )}
        >
          More
          <ChevronDown className={cn(
            "h-3 w-3 transition-transform",
            showTemplates && "rotate-180"
          )} />
        </button>
      </div>

      {/* Templates Dropdown */}
      {showTemplates && (
        <div className="px-4 py-3 border-b bg-gray-50 dark:bg-gray-800/50">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {templates
              .filter(t => !QUICK_ACTIONS.some(q => q.id === t.id))
              .map(template => (
                <button
                  key={template.id}
                  onClick={() => {
                    handleQuickAction(template.id);
                    setShowTemplates(false);
                  }}
                  disabled={isLoading}
                  className={cn(
                    "flex items-center gap-2 p-2 text-left text-sm rounded",
                    "bg-white dark:bg-gray-700 border",
                    "hover:bg-purple-50 hover:border-purple-300",
                    "dark:hover:bg-purple-900/20",
                    "transition-colors",
                    isLoading && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {template.icon}
                  <div className="min-w-0">
                    <div className="font-medium truncate">{template.name}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {template.description}
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {conversation.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Sparkles className="h-12 w-12 text-purple-300 mb-4" />
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Ask anything about this contract
            </h4>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
              Use the quick actions above or type a custom question. 
              Your data is protected with anonymization.
            </p>
            <div className="flex flex-wrap justify-center gap-2 text-sm">
              {[
                'What are the main risks?',
                'When does this contract expire?',
                'What are our payment obligations?',
                'Summarize the termination rights',
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestedQuestion(suggestion)}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-full 
                           hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {conversation.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex gap-3",
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 
                                flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                )}
                <div className={cn(
                  "max-w-[80%] rounded-lg px-4 py-3",
                  message.role === 'user'
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                )}>
                  {message.template && (
                    <div className={cn(
                      "flex items-center gap-1 text-xs mb-2",
                      message.role === 'user' ? "text-purple-200" : "text-gray-500"
                    )}>
                      {TEMPLATE_ICONS[message.template]}
                      <span>
                        {templates.find(t => t.id === message.template)?.name || message.template}
                      </span>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap text-sm">
                    {message.content}
                  </div>
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => handleCopy(message.content, index)}
                        className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 
                                 flex items-center gap-1"
                      >
                        {copiedIndex === index ? (
                          <>
                            <Check className="h-3 w-3" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 
                                flex items-center justify-center text-white font-medium text-sm">
                    You
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 
                              flex items-center justify-center">
                  <Loader2 className="h-4 w-4 text-purple-600 dark:text-purple-400 animate-spin" />
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing contract...
                  </div>
                </div>
              </div>
            )}

            {/* Suggested follow-ups */}
            {currentResult?.suggestedFollowUps && 
             currentResult.suggestedFollowUps.length > 0 && 
             !isLoading && (
              <div className="pl-11">
                <div className="text-xs text-gray-500 mb-2">Suggested follow-ups:</div>
                <div className="flex flex-wrap gap-2">
                  {currentResult.suggestedFollowUps.map((question, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestedQuestion(question)}
                      className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded 
                               hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Ask a question about this contract..."
              disabled={isLoading}
              rows={1}
              className={cn(
                "w-full px-4 py-2 pr-10 border rounded-lg resize-none",
                "focus:outline-none focus:ring-2 focus:ring-purple-500",
                "bg-white dark:bg-gray-800",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
            {/* Template selector in input */}
            {selectedTemplate && (
              <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1 
                            px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 rounded text-xs">
                {TEMPLATE_ICONS[selectedTemplate]}
                <span>{templates.find(t => t.id === selectedTemplate)?.name}</span>
                <button
                  type="button"
                  onClick={() => setSelectedTemplate(null)}
                  className="ml-1 hover:text-red-500"
                >
                  ×
                </button>
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={isLoading || (!inputValue.trim() && !selectedTemplate)}
            className={cn(
              "px-4 py-2 rounded-lg flex items-center gap-2",
              "bg-purple-600 text-white",
              "hover:bg-purple-700",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors"
            )}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            Data protected with anonymization
          </div>
          <div>Press Enter to send, Shift+Enter for new line</div>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default AIAnalysisPanel;
