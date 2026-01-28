'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Send,
  MessageSquare,
  AlertTriangle,
  Shield,
  DollarSign,
  Scale,
  Loader2,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  RefreshCw,
  Lightbulb,
  BookOpen,
  Target,
  History,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

export interface ContractContext {
  id: string;
  name: string;
  supplierName?: string;
  contractType?: string;
  totalValue?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
  extractedText?: string;
  clauses?: ClauseInfo[];
  metadata?: Record<string, unknown>;
}

interface ClauseInfo {
  type: string;
  text: string;
  section?: string;
  pageNumber?: number;
}

interface QueryTemplate {
  id: string;
  label: string;
  icon: React.ElementType;
  query: string;
  category: 'risk' | 'financial' | 'legal' | 'compliance' | 'general';
  description: string;
}

interface AnalysisResponse {
  answer: string;
  confidence: number;
  sources: SourceReference[];
  suggestions?: string[];
  relatedQueries?: string[];
}

interface SourceReference {
  section?: string;
  pageNumber?: number;
  excerpt: string;
  relevance: number;
}

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: SourceReference[];
  isLoading?: boolean;
}

// ============================================================================
// Query Templates - Common contract questions
// ============================================================================

const QUERY_TEMPLATES: QueryTemplate[] = [
  {
    id: 'termination',
    label: 'Termination Clauses',
    icon: AlertTriangle,
    query: 'What are the termination clauses and conditions? Can either party terminate early? What are the notice periods?',
    category: 'legal',
    description: 'Understand how and when this contract can be ended',
  },
  {
    id: 'liability',
    label: 'Liability & Indemnity',
    icon: Shield,
    query: 'What are the liability caps, limitations, and indemnification provisions? Who bears what risks?',
    category: 'risk',
    description: 'Analyze liability exposure and risk allocation',
  },
  {
    id: 'payment',
    label: 'Payment Terms',
    icon: DollarSign,
    query: 'What are the payment terms, schedule, and conditions? Are there any late payment penalties or discounts?',
    category: 'financial',
    description: 'Review payment obligations and timeline',
  },
  {
    id: 'renewal',
    label: 'Renewal & Extension',
    icon: RefreshCw,
    query: 'What are the renewal options? Is there auto-renewal? What are the notice requirements for renewal or non-renewal?',
    category: 'general',
    description: 'Understand contract continuation options',
  },
  {
    id: 'confidentiality',
    label: 'Confidentiality',
    icon: BookOpen,
    query: 'What are the confidentiality and non-disclosure obligations? How long do they last? What information is covered?',
    category: 'compliance',
    description: 'Review data protection requirements',
  },
  {
    id: 'obligations',
    label: 'Key Obligations',
    icon: Target,
    query: 'What are the key obligations and deliverables for each party? What are the performance standards or SLAs?',
    category: 'general',
    description: 'Identify main commitments and responsibilities',
  },
  {
    id: 'risk_summary',
    label: 'Risk Assessment',
    icon: AlertTriangle,
    query: 'What are the main risks in this contract? Identify any unusual or concerning clauses that need attention.',
    category: 'risk',
    description: 'Get an overall risk analysis',
  },
  {
    id: 'compliance',
    label: 'Compliance Requirements',
    icon: Scale,
    query: 'What regulatory compliance, audit rights, and reporting requirements are specified?',
    category: 'compliance',
    description: 'Review compliance obligations',
  },
];

const CATEGORY_COLORS = {
  risk: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  financial: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  legal: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  compliance: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  general: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
};

// ============================================================================
// Sub-Components
// ============================================================================

const QueryButton: React.FC<{
  template: QueryTemplate;
  onClick: () => void;
  disabled?: boolean;
}> = ({ template, onClick, disabled }) => {
  const Icon = template.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className={cn(
            'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
            'bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700',
            'hover:border-indigo-400 hover:bg-purple-50 hover:shadow-md hover:shadow-purple-500/10 dark:hover:border-purple-500 dark:hover:bg-purple-900/20',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'group active:scale-[0.98]'
          )}
        >
          <div className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
            'bg-slate-100 dark:bg-slate-700/50',
            'group-hover:bg-purple-100 dark:group-hover:bg-purple-900/40'
          )}>
            <Icon className="w-4 h-4 text-slate-500 group-hover:text-purple-600 dark:group-hover:text-indigo-400 transition-colors" />
          </div>
          <div className="flex-1 text-left">
            <span className="text-slate-700 dark:text-slate-200 group-hover:text-purple-700 dark:group-hover:text-indigo-300 transition-colors">
              {template.label}
            </span>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-indigo-400 -rotate-90 transition-all group-hover:translate-x-0.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p className="text-sm">{template.description}</p>
      </TooltipContent>
    </Tooltip>
  );
};

const SourceCard: React.FC<{ source: SourceReference; index: number }> = ({ source, index }) => {
  const confidenceColor = source.relevance >= 0.8 
    ? 'bg-green-500' 
    : source.relevance >= 0.6 
    ? 'bg-amber-500' 
    : 'bg-slate-400';
  
  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="text-xs p-3 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-850 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-purple-600 transition-colors group"
    >
      <div className="flex items-center gap-2 mb-2">
        {source.section && (
          <Badge variant="secondary" className="text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-indigo-300">
            {source.section}
          </Badge>
        )}
        {source.pageNumber && (
          <Badge variant="outline" className="text-xs">
            Page {source.pageNumber}
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <div className={cn("w-2 h-2 rounded-full", confidenceColor)} />
          <span className="text-slate-500 font-medium">{Math.round(source.relevance * 100)}% match</span>
        </div>
      </div>
      <p className="text-slate-600 dark:text-slate-400 leading-relaxed italic">
        &ldquo;{source.excerpt}&rdquo;
      </p>
    </motion.div>
  );
};

const MessageBubble: React.FC<{
  message: ConversationMessage;
  onCopy: (text: string) => void;
  confidence?: number;
}> = ({ message, onCopy, confidence }) => {
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const handleCopy = () => {
    onCopy(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isUser = message.role === 'user';
  
  // Confidence badge color
  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.85) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    if (conf >= 0.7) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}
    >
      {/* Avatar for assistant */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-sm">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
      )}
      
      <div
        className={cn(
          'max-w-[85%] rounded-2xl shadow-sm',
          isUser
            ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white px-4 py-3'
            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-3 border border-slate-200 dark:border-slate-700'
        )}
      >
        {message.isLoading ? (
          <div className="flex items-center gap-3 py-1">
            <div className="flex gap-1">
              <motion.div 
                className="w-2 h-2 rounded-full bg-purple-400"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 0.8, delay: 0 }}
              />
              <motion.div 
                className="w-2 h-2 rounded-full bg-purple-400"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }}
              />
              <motion.div 
                className="w-2 h-2 rounded-full bg-purple-400"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }}
              />
            </div>
            <span className="text-sm text-slate-500">Analyzing contract...</span>
          </div>
        ) : (
          <>
            {/* Confidence badge for assistant messages */}
            {!isUser && confidence !== undefined && (
              <div className="flex items-center gap-2 mb-2">
                <Badge className={cn("text-xs", getConfidenceColor(confidence))}>
                  {Math.round(confidence * 100)}% confidence
                </Badge>
              </div>
            )}
            
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
            
            {/* Sources */}
            {message.sources && message.sources.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button 
                  onClick={() => setShowSources(!showSources)}
                  className="flex items-center gap-2 text-xs font-medium text-purple-600 dark:text-indigo-400 hover:text-purple-700 dark:hover:text-indigo-300 transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  {showSources ? 'Hide' : 'Show'} {message.sources.length} source{message.sources.length > 1 ? 's' : ''}
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showSources && "rotate-180")} />
                </button>
                
                <AnimatePresence>
                  {showSources && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2 space-y-2"
                    >
                      {message.sources.slice(0, 3).map((source, idx) => (
                        <SourceCard key={idx} source={source} index={idx} />
                      ))}
                      {message.sources.length > 3 && (
                        <p className="text-xs text-slate-500 text-center py-1">
                          +{message.sources.length - 3} more sources
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Action buttons for assistant messages */}
            {!isUser && (
              <div className="mt-3 pt-2 flex items-center gap-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  onClick={handleCopy}
                  className="text-xs text-slate-400 hover:text-purple-600 dark:hover:text-indigo-400 flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-green-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Avatar for user */}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">You</span>
        </div>
      )}
    </motion.div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

interface ContractAIAnalystProps {
  contract: ContractContext;
  defaultExpanded?: boolean;
  className?: string;
  onAnalysisComplete?: (response: AnalysisResponse) => void;
}

export function ContractAIAnalyst({
  contract,
  defaultExpanded = false,
  className,
  onAnalysisComplete,
}: ContractAIAnalystProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [showTemplates, setShowTemplates] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  const handleSubmit = useCallback(async (queryText: string) => {
    if (!queryText.trim() || isLoading) return;

    const userMessage: ConversationMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: queryText.trim(),
      timestamp: new Date(),
    };

    const loadingMessage: ConversationMessage = {
      id: `loading-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setQuery('');
    setIsLoading(true);
    setShowTemplates(false);

    try {
      const response = await fetch('/api/ai/contract-analyst', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: contract.id,
          query: queryText.trim(),
          context: {
            name: contract.name,
            supplier: contract.supplierName,
            type: contract.contractType,
            value: contract.totalValue,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze contract');
      }

      const data: AnalysisResponse = await response.json();

      // Replace loading message with actual response
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isLoading);
        return [
          ...filtered,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant' as const,
            content: data.answer,
            timestamp: new Date(),
            sources: data.sources,
          },
        ];
      });

      onAnalysisComplete?.(data);
    } catch (error) {
      console.error('Analysis error:', error);
      
      // Replace loading with error message
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isLoading);
        return [
          ...filtered,
          {
            id: `error-${Date.now()}`,
            role: 'assistant' as const,
            content: 'I apologize, but I encountered an error analyzing this contract. Please try again or rephrase your question.',
            timestamp: new Date(),
          },
        ];
      });

      toast.error('Failed to analyze contract');
    } finally {
      setIsLoading(false);
    }
  }, [contract, isLoading, onAnalysisComplete]);

  const handleTemplateClick = (template: QueryTemplate) => {
    handleSubmit(template.query);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleClearHistory = () => {
    setMessages([]);
    setShowTemplates(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(query);
    }
  };

  const filteredTemplates = selectedCategory
    ? QUERY_TEMPLATES.filter(t => t.category === selectedCategory)
    : QUERY_TEMPLATES;

  const categories = ['risk', 'financial', 'legal', 'compliance', 'general'] as const;

  // Minimized view
  if (!isExpanded) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn('', className)}
      >
        <Card 
          className="border-indigo-200 dark:border-indigo-800 bg-gradient-to-r from-purple-50 via-purple-50 to-pink-50 dark:from-purple-950/50 dark:via-purple-950/50 dark:to-pink-950/50 cursor-pointer hover:shadow-lg hover:border-indigo-300 dark:hover:border-purple-600 transition-all duration-300 group"
          onClick={() => setIsExpanded(true)}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/25 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-lg">AI Contract Analyst</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Ask questions about this contract
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Preview of capabilities */}
                <div className="hidden sm:flex items-center gap-2">
                  <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Risk
                  </Badge>
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">
                    <DollarSign className="w-3 h-3 mr-1" />
                    Financial
                  </Badge>
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs">
                    <Scale className="w-3 h-3 mr-1" />
                    Legal
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" className="group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30">
                  <ChevronDown className="w-4 h-4 group-hover:text-purple-600 dark:group-hover:text-indigo-400" />
                </Button>
              </div>
            </div>
            {/* Quick hint */}
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
              Click to explore termination clauses, payment terms, risks, and more
            </p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Expanded view
  const content = (
    <Card className={cn(
      'border-indigo-200 dark:border-indigo-800 overflow-hidden shadow-xl shadow-purple-500/10',
      isFullscreen && 'fixed inset-4 z-50 m-0 shadow-2xl'
    )}>
      <CardHeader className="bg-gradient-to-r from-purple-600 via-purple-600 to-purple-600 text-white py-5 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
        </div>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shadow-lg shadow-black/10">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                AI Contract Analyst
                <Badge className="bg-white/20 text-white text-[10px] font-normal">Beta</Badge>
              </CardTitle>
              <p className="text-sm text-indigo-100/80 truncate max-w-[250px]">
                {contract.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearHistory}
                    className="text-white/70 hover:text-white hover:bg-white/15 rounded-lg"
                  >
                    <History className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Clear conversation</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="text-white/70 hover:text-white hover:bg-white/15 rounded-lg"
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(false)}
                  className="text-white/70 hover:text-white hover:bg-white/15 rounded-lg"
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Minimize</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <TooltipProvider>
          {/* Quick Query Templates */}
          <AnimatePresence>
            {showTemplates && messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-5 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800/50"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Quick Questions
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Click any to get started
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    {categories.map(cat => {
                      const isSelected = selectedCategory === cat;
                      return (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(isSelected ? null : cat)}
                          className={cn(
                            'px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-all duration-200',
                            isSelected
                              ? CATEGORY_COLORS[cat]
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:scale-105'
                          )}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredTemplates.map((template, index) => (
                    <motion.div
                      key={template.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <QueryButton
                        template={template}
                        onClick={() => handleTemplateClick(template)}
                        disabled={isLoading}
                      />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Conversation Area */}
          <ScrollArea 
            ref={scrollRef}
            className={cn(
              'p-4',
              isFullscreen ? 'h-[calc(100vh-280px)]' : 'h-[340px]'
            )}
          >
            <div className="space-y-4">
              {messages.length === 0 && !showTemplates && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center h-[280px] text-center"
                >
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-100 to-purple-100 dark:from-purple-900/30 dark:to-purple-900/30 flex items-center justify-center mb-4 shadow-lg shadow-purple-500/10">
                    <MessageSquare className="w-10 h-10 text-purple-500 dark:text-indigo-400" />
                  </div>
                  <h4 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-2">
                    Your AI Contract Expert
                  </h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
                    Ask anything about {contractContext.name || 'this contract'} - from risks to payment terms to compliance requirements.
                  </p>
                  <div className="flex items-center gap-2 mt-4 text-xs text-slate-400">
                    <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                      Enter
                    </kbd>
                    <span>to send</span>
                    <span className="mx-1">•</span>
                    <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                      Shift + Enter
                    </kbd>
                    <span>for new line</span>
                  </div>
                </motion.div>
              )}
              {messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <MessageBubble
                    message={message}
                    onCopy={handleCopy}
                  />
                </motion.div>
              ))}
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-gradient-to-t from-slate-50 to-white dark:from-slate-900 dark:to-slate-800/50">
            <div className="flex items-end gap-3">
              <div className="flex-1 relative group">
                <Textarea
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about risks, terms, clauses, or any contract detail..."
                  className="min-h-[52px] max-h-[140px] pr-12 resize-none rounded-xl border-slate-300 dark:border-slate-600 focus:border-indigo-400 focus:ring-indigo-400/20 dark:focus:border-purple-500 transition-all shadow-sm"
                  rows={1}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {query.length > 0 && (
                    <span className={cn(
                      "text-xs mr-1 transition-colors",
                      query.length > 450 ? "text-amber-500" : "text-slate-400"
                    )}>
                      {query.length}/500
                    </span>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setShowTemplates(!showTemplates)}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          showTemplates
                            ? "text-purple-600 bg-purple-100 dark:bg-purple-900/30"
                            : "text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                        )}
                      >
                        <Lightbulb className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {showTemplates ? 'Hide suggestions' : 'Show suggested questions'}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => handleSubmit(query)}
                    disabled={!query.trim() || isLoading}
                    className="h-[52px] w-[52px] p-0 rounded-xl bg-gradient-to-br from-purple-600 to-purple-600 hover:from-purple-700 hover:to-purple-700 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isLoading ? 'Analyzing...' : 'Send message'}
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-mono">↵</kbd>
                <span>send</span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-mono">⇧↵</kbd>
                <span>new line</span>
              </p>
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Clear chat
                </button>
              )}
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('', className)}
    >
      {isFullscreen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsFullscreen(false)}
        />
      )}
      {content}
    </motion.div>
  );
}

export default ContractAIAnalyst;
