'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Send,
  X,
  Bot,
  User,
  Check,
  Loader2,
  Sparkles,
  FileText,
  ChevronRight,
  MessageSquare,
  RefreshCw,
  Square,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { sanitizeHtml } from '@/lib/security/sanitize';
import {
  useInteractiveDraft,
  type ChatMessage,
  type DraftingContext,
} from '@/hooks/useInteractiveDraft';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InteractiveDraftChatProps {
  onDraftCreated?: (draftId: string, editUrl: string) => void;
  onClose?: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUICK_START_OPTIONS = [
  { label: 'NDA', value: 'I need a Non-Disclosure Agreement', emoji: '🔒' },
  { label: 'MSA', value: 'I need a Master Service Agreement', emoji: '🤝' },
  { label: 'SOW', value: 'I need a Statement of Work', emoji: '📋' },
  { label: 'Employment', value: 'I need an Employment Agreement', emoji: '👔' },
  { label: 'Lease', value: 'I need a Lease Agreement', emoji: '🏢' },
  { label: 'Amendment', value: 'I need a Contract Amendment', emoji: '📝' },
];

const CONTEXT_FIELDS: Array<{
  key: keyof DraftingContext;
  label: string;
  format: (value: unknown) => string;
}> = [
  { key: 'contractType', label: 'Contract Type', format: (v) => String(v) },
  {
    key: 'parties',
    label: 'Parties',
    format: (v) => {
      const parties = v as Array<{ name: string; role: string }>;
      return parties.map((p) => `${p.name} (${p.role})`).join(', ');
    },
  },
  { key: 'jurisdiction', label: 'Jurisdiction', format: (v) => String(v) },
  {
    key: 'keyTerms',
    label: 'Key Terms',
    format: (v) => {
      const terms = v as Record<string, string>;
      return Object.entries(terms)
        .map(([k, val]) => `${k}: ${val}`)
        .join(', ');
    },
  },
  { key: 'tone', label: 'Tone', format: (v) => String(v) },
  {
    key: 'selectedClauses',
    label: 'Clauses',
    format: (v) => {
      const clauses = v as string[];
      return clauses.join(', ');
    },
  },
  { key: 'title', label: 'Title', format: (v) => String(v) },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function renderSimpleMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Bold — safe inline rendering
    const parts = line.split(/\*\*(.+?)\*\*/g);
    const renderLine = (raw: string) => (
      <>
        {raw.split(/\*\*(.+?)\*\*/g).map((part, j) =>
          j % 2 === 1 ? <strong key={j}>{part}</strong> : <React.Fragment key={j}>{part}</React.Fragment>
        )}
      </>
    );

    // Unordered list
    if (/^[-•]\s/.test(line)) {
      elements.push(
        <li key={i} className="ml-4 list-disc">
          {renderLine(line.replace(/^[-•]\s/, ''))}
        </li>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      elements.push(
        <li key={i} className="ml-4 list-decimal">
          {renderLine(line.replace(/^\d+\.\s/, ''))}
        </li>
      );
      continue;
    }

    // Empty line → spacing
    if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
      continue;
    }

    elements.push(
      <p key={i}>{renderLine(line)}</p>
    );
  }

  return <div className="space-y-1">{elements}</div>;
}

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------

function MessageBubble({
  message,
  isLastAssistant,
}: {
  message: ChatMessage;
  isLastAssistant: boolean;
}) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex gap-2.5 max-w-[85%] md:max-w-[75%]',
        isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm',
          isUser
            ? 'bg-violet-600 text-white'
            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Bubble */}
      <div className="flex flex-col gap-1">
        <div
          className={cn(
            'px-4 py-2.5 rounded-2xl shadow-sm text-sm leading-relaxed',
            isUser
              ? 'bg-violet-600 text-white rounded-tr-md'
              : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-tl-md'
          )}
        >
          {message.isStreaming && !message.content ? (
            <TypingIndicator />
          ) : (
            renderSimpleMarkdown(message.content)
          )}
        </div>

        {/* Context update badges */}
        {message.contextUpdates && message.contextUpdates.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1">
            {message.contextUpdates.map((update, idx) => (
              <Badge
                key={idx}
                variant="outline"
                className="text-[10px] py-0 h-5 gap-1"
              >
                <Check className="w-2.5 h-2.5 text-green-500" />
                {update.field}
              </Badge>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <span
          className={cn(
            'text-[10px] text-slate-400 px-1',
            isUser ? 'text-right' : 'text-left'
          )}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TypingIndicator
// ---------------------------------------------------------------------------

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-1 px-1">
      <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
      <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
      <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuickReplies
// ---------------------------------------------------------------------------

function QuickReplies({
  suggestions,
  onSelect,
  disabled,
}: {
  suggestions: Array<{ label: string; value: string }>;
  onSelect: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 px-1 scrollbar-thin">
      {suggestions.map((suggestion) => (
        <Button
          key={suggestion.value}
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onSelect(suggestion.value)}
          className="flex-shrink-0 rounded-full text-xs h-8 gap-1 hover:bg-violet-50 dark:hover:bg-violet-950/30 hover:border-violet-300"
        >
          <ChevronRight className="w-3 h-3" />
          {suggestion.label}
        </Button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContextSidebar
// ---------------------------------------------------------------------------

function ContextSidebar({
  context,
  readyToGenerate,
  isGenerating,
  onUpdateContext,
  onGenerateDraft,
}: {
  context: DraftingContext;
  readyToGenerate: boolean;
  isGenerating: boolean;
  onUpdateContext: (updates: Partial<DraftingContext>) => void;
  onGenerateDraft: () => void;
}) {
  const [editingField, setEditingField] = useState<keyof DraftingContext | null>(null);
  const [editValue, setEditValue] = useState('');

  const filledCount = useMemo(
    () => CONTEXT_FIELDS.filter((f) => {
      const val = context[f.key];
      if (val == null) return false;
      if (Array.isArray(val)) return val.length > 0;
      if (typeof val === 'object') return Object.keys(val).length > 0;
      return String(val).length > 0;
    }).length,
    [context]
  );

  const handleStartEdit = (field: keyof DraftingContext, currentValue: unknown) => {
    setEditingField(field);
    const cfg = CONTEXT_FIELDS.find((f) => f.key === field);
    setEditValue(currentValue ? (cfg?.format(currentValue) ?? String(currentValue)) : '');
  };

  const handleSaveEdit = () => {
    if (!editingField) return;
    // Simple string fields
    if (['contractType', 'jurisdiction', 'title'].includes(editingField)) {
      onUpdateContext({ [editingField]: editValue || undefined });
    } else if (editingField === 'tone') {
      const validTones = ['formal', 'standard', 'plain-english'];
      const normalized = editValue.toLowerCase().trim();
      if (validTones.includes(normalized)) {
        onUpdateContext({ tone: normalized as DraftingContext['tone'] });
      } else {
        toast.error('Tone must be: formal, standard, or plain-english');
        return;
      }
    }
    setEditingField(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveEdit();
    if (e.key === 'Escape') {
      setEditingField(null);
      setEditValue('');
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Extracted Context</CardTitle>
          <Badge variant="secondary" className="text-[10px]">
            {filledCount}/{CONTEXT_FIELDS.length}
          </Badge>
        </div>
        <Progress
          value={(filledCount / CONTEXT_FIELDS.length) * 100}
          variant={filledCount === CONTEXT_FIELDS.length ? 'success' : 'default'}
          className="h-1.5 mt-2"
        />
      </CardHeader>

      <Separator />

      <CardContent className="flex-1 overflow-auto p-3 space-y-2">
        {CONTEXT_FIELDS.map((field) => {
          const value = context[field.key];
          const hasValue =
            value != null &&
            (Array.isArray(value) ? value.length > 0 :
              typeof value === 'object' ? Object.keys(value as object).length > 0 :
                String(value).length > 0);
          const isEditing = editingField === field.key;

          return (
            <div
              key={field.key}
              className={cn(
                'rounded-lg p-2.5 transition-colors text-sm',
                hasValue
                  ? 'bg-green-50/50 dark:bg-green-950/20 border border-green-200/50 dark:border-green-800/30'
                  : 'bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/30'
              )}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                {hasValue ? (
                  <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                ) : (
                  <div className="w-3 h-3 rounded-full border border-slate-300 dark:border-slate-600 flex-shrink-0" />
                )}
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {field.label}
                </span>
              </div>

              {isEditing ? (
                <div className="flex gap-1 mt-1">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleSaveEdit}
                    className="h-7 text-xs"
                    autoFocus
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleStartEdit(field.key, value)}
                  className="block w-full text-left pl-[18px]"
                >
                  {hasValue ? (
                    <span className="text-xs text-slate-700 dark:text-slate-200">
                      {field.format(value)}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                      Not set yet
                    </span>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </CardContent>

      {readyToGenerate && (
        <div className="p-3 border-t border-slate-200 dark:border-slate-700">
          <Button
            variant="gradient"
            className="w-full gap-2"
            onClick={onGenerateDraft}
            disabled={isGenerating}
            loading={isGenerating}
            loadingText="Generating..."
          >
            <Sparkles className="w-4 h-4" />
            Generate Draft
          </Button>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// GenerationProgress
// ---------------------------------------------------------------------------

function GenerationProgress({
  progress,
  steps,
}: {
  progress: number;
  steps: Array<{ step: number; name: string; status: string; durationMs?: number }>;
}) {
  const statusIcon: Record<string, React.ReactNode> = {
    pending: (
      <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600" />
    ),
    running: <Loader2 className="w-5 h-5 animate-spin text-violet-500" />,
    completed: <Check className="w-5 h-5 text-green-500" />,
    failed: <AlertCircle className="w-5 h-5 text-red-500" />,
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mx-auto shadow-lg shadow-violet-500/25">
          <Sparkles className="w-8 h-8 text-white animate-pulse" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Generating Your Contract
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          This usually takes 15–30 seconds
        </p>
      </div>

      <div className="w-full max-w-sm space-y-2">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="w-full max-w-sm space-y-1.5">
        {steps.map((step) => (
          <div
            key={step.step}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
              step.status === 'running' &&
                'bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800',
              step.status === 'completed' && 'bg-green-50/50 dark:bg-green-950/20',
              step.status === 'failed' && 'bg-red-50/50 dark:bg-red-950/20'
            )}
          >
            {statusIcon[step.status] ?? statusIcon.pending}
            <span
              className={cn(
                'flex-1 text-sm',
                step.status === 'pending'
                  ? 'text-slate-400'
                  : 'text-slate-700 dark:text-slate-200 font-medium'
              )}
            >
              {step.name}
            </span>
            {step.status === 'completed' && step.durationMs != null && (
              <span className="text-[10px] text-slate-400">
                {formatDuration(step.durationMs)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GenerationComplete
// ---------------------------------------------------------------------------

function GenerationComplete({
  result,
  onOpenEditor,
  onReset,
}: {
  result: { draftId: string; title: string; editUrl: string };
  onOpenEditor: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 space-y-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/25">
          <Check className="w-10 h-10 text-white" />
        </div>
        {/* Decorative sparkles */}
        <Sparkles className="w-5 h-5 text-amber-400 absolute -top-1 -right-1 animate-pulse" />
        <Sparkles className="w-4 h-4 text-violet-400 absolute -bottom-1 -left-2 animate-pulse [animation-delay:300ms]" />
      </div>

      <div className="text-center space-y-1.5">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Draft Created!
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
          <strong>{result.title}</strong> is ready for review and editing.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
        <Button
          variant="gradient"
          className="flex-1 gap-2"
          onClick={onOpenEditor}
        >
          <FileText className="w-4 h-4" />
          Open in Editor
        </Button>
        <Button
          variant="outline"
          className="flex-1 gap-2"
          onClick={onReset}
        >
          <RefreshCw className="w-4 h-4" />
          Start New
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WelcomeState
// ---------------------------------------------------------------------------

function WelcomeState({
  onSelect,
  disabled,
}: {
  onSelect: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-5">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
        <MessageSquare className="w-7 h-7 text-white" />
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          👋 Hi! I&apos;m your contract drafting assistant.
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
          Tell me what kind of contract you need and I&apos;ll help you draft it.
          I&apos;ll ask a few questions to understand your requirements.
        </p>
      </div>

      <div className="space-y-2 w-full max-w-md">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          Quick start
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {QUICK_START_OPTIONS.map((opt) => (
            <Button
              key={opt.label}
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => onSelect(opt.value)}
              className="gap-1.5 justify-start h-9"
            >
              <span>{opt.emoji}</span>
              {opt.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InteractiveDraftChat (main component)
// ---------------------------------------------------------------------------

export function InteractiveDraftChat({
  onDraftCreated,
  onClose,
  className,
}: InteractiveDraftChatProps) {
  const {
    messages,
    context,
    isStreaming,
    isGenerating,
    readyToGenerate,
    generationResult,
    error,
    generationProgress,
    generationSteps,
    sendMessage,
    generateDraft,
    updateContext,
    reset,
    abort,
  } = useInteractiveDraft();

  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Show error as toast
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  // Notify parent on draft creation
  useEffect(() => {
    if (generationResult && onDraftCreated) {
      onDraftCreated(generationResult.draftId, generationResult.editUrl);
    }
  }, [generationResult, onDraftCreated]);

  const handleSend = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isStreaming) return;
    setInputValue('');
    await sendMessage(trimmed);
  }, [inputValue, isStreaming, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleQuickReply = useCallback(
    async (value: string) => {
      if (isStreaming) return;
      await sendMessage(value);
    },
    [isStreaming, sendMessage]
  );

  const handleOpenEditor = useCallback(() => {
    if (generationResult) {
      if (onDraftCreated) {
        onDraftCreated(generationResult.draftId, generationResult.editUrl);
      } else {
        window.location.href = generationResult.editUrl;
      }
    }
  }, [generationResult, onDraftCreated]);

  // Find the last assistant message with suggestions
  const lastAssistantWithSuggestions = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (
        messages[i].role === 'assistant' &&
        messages[i].suggestions &&
        messages[i].suggestions!.length > 0
      ) {
        return messages[i].id;
      }
    }
    return null;
  }, [messages]);

  const showWelcome = messages.length === 0 && !isGenerating && !generationResult;
  const showGenProgress = isGenerating && !generationResult;
  const showGenComplete = !!generationResult;
  const showChat = !showGenProgress && !showGenComplete;

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-lg',
        className
      )}
    >
      {/* ----------------------------------------------------------------- */}
      {/* Header                                                            */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-violet-50 to-fuchsia-50 dark:from-violet-950/30 dark:to-fuchsia-950/30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Contract Drafting Assistant
            </h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {isStreaming
                ? 'Thinking...'
                : isGenerating
                  ? 'Generating draft...'
                  : 'Ready to help'}
            </p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Body: Chat + Sidebar                                              */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Chat area */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {showGenProgress && (
            <GenerationProgress
              progress={generationProgress}
              steps={generationSteps}
            />
          )}

          {showGenComplete && generationResult && (
            <GenerationComplete
              result={generationResult}
              onOpenEditor={handleOpenEditor}
              onReset={reset}
            />
          )}

          {showChat && (
            <>
              {/* Messages */}
              <ScrollArea
                ref={scrollRef}
                className="flex-1 min-h-0 px-4 py-4 bg-slate-50/50 dark:bg-slate-950/30"
                role="log"
                aria-label="Contract drafting conversation"
                aria-live="polite"
              >
                {showWelcome ? (
                  <WelcomeState
                    onSelect={handleQuickReply}
                    disabled={isStreaming}
                  />
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <React.Fragment key={msg.id}>
                        <MessageBubble
                          message={msg}
                          isLastAssistant={msg.id === lastAssistantWithSuggestions}
                        />
                        {msg.id === lastAssistantWithSuggestions &&
                          msg.suggestions &&
                          msg.suggestions.length > 0 && (
                            <div className="ml-10">
                              <QuickReplies
                                suggestions={msg.suggestions}
                                onSelect={handleQuickReply}
                                disabled={isStreaming}
                              />
                            </div>
                          )}
                      </React.Fragment>
                    ))}

                    {/* Streaming indicator for new message */}
                    {isStreaming &&
                      messages.length > 0 &&
                      !messages[messages.length - 1].isStreaming && (
                        <div className="flex gap-2.5 mr-auto max-w-[75%]">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                            <Bot className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                          </div>
                          <div className="px-4 py-2.5 rounded-2xl rounded-tl-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                            <TypingIndicator />
                          </div>
                        </div>
                      )}

                    {/* Generate Draft CTA in chat */}
                    {readyToGenerate && !isGenerating && (
                      <div className="flex justify-center py-4">
                        <Button
                          variant="gradient"
                          size="lg"
                          className="gap-2 shadow-lg shadow-violet-500/25"
                          onClick={generateDraft}
                        >
                          <Sparkles className="w-4 h-4" />
                          Generate Draft
                        </Button>
                      </div>
                    )}

                    {/* Error banner */}
                    {error && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {error}
                      </div>
                    )}

                    {/* Scroll anchor */}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Input */}
              <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe your contract needs..."
                    disabled={isStreaming || isGenerating}
                    aria-label="Contract drafting message"
                    className="flex-1"
                  />
                  {isStreaming ? (
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={abort}
                      aria-label="Stop generating"
                      title="Stop generating"
                    >
                      <Square className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="icon"
                      onClick={handleSend}
                      disabled={!inputValue.trim() || isGenerating}
                      aria-label="Send message"
                      title={isGenerating ? 'Generating draft...' : 'Send message'}
                    >
                      {isGenerating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sidebar — hidden on mobile when generating */}
        {showChat && (
          <>
            {/* Desktop sidebar */}
            <div className="hidden md:flex md:w-72 lg:w-80 border-l border-slate-200 dark:border-slate-700">
              <ContextSidebar
                context={context}
                readyToGenerate={readyToGenerate}
                isGenerating={isGenerating}
                onUpdateContext={updateContext}
                onGenerateDraft={generateDraft}
              />
            </div>

            {/* Mobile bottom sheet */}
            <MobileContextSheet
              context={context}
              readyToGenerate={readyToGenerate}
              isGenerating={isGenerating}
              onUpdateContext={updateContext}
              onGenerateDraft={generateDraft}
              filledCount={
                CONTEXT_FIELDS.filter((f) => {
                  const val = context[f.key];
                  if (val == null) return false;
                  if (Array.isArray(val)) return val.length > 0;
                  if (typeof val === 'object') return Object.keys(val).length > 0;
                  return String(val).length > 0;
                }).length
              }
            />
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MobileContextSheet (collapsible bottom panel for mobile)
// ---------------------------------------------------------------------------

function MobileContextSheet({
  context,
  readyToGenerate,
  isGenerating,
  onUpdateContext,
  onGenerateDraft,
  filledCount,
}: {
  context: DraftingContext;
  readyToGenerate: boolean;
  isGenerating: boolean;
  onUpdateContext: (updates: Partial<DraftingContext>) => void;
  onGenerateDraft: () => void;
  filledCount: number;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="md:hidden border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-violet-500" />
          <span className="font-medium text-slate-700 dark:text-slate-200">
            Context
          </span>
          <Badge variant="secondary" className="text-[10px] h-5">
            {filledCount}/{CONTEXT_FIELDS.length}
          </Badge>
        </div>
        <ChevronRight
          className={cn(
            'w-4 h-4 text-slate-400 transition-transform duration-200',
            expanded && 'rotate-90'
          )}
        />
      </button>

      {expanded && (
        <div className="max-h-64 overflow-auto border-t border-slate-100 dark:border-slate-800">
          <ContextSidebar
            context={context}
            readyToGenerate={readyToGenerate}
            isGenerating={isGenerating}
            onUpdateContext={onUpdateContext}
            onGenerateDraft={onGenerateDraft}
          />
        </div>
      )}
    </div>
  );
}

export default InteractiveDraftChat;
