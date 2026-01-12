'use client';

/**
 * Enhanced Chat Message Components
 * Rich message rendering with markdown, code blocks, tables, and interactive elements
 */

import React, { useState, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Copy, 
  Check, 
  ThumbsUp, 
  ThumbsDown, 
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Code,
  Table,
  Image as ImageIcon,
  Play,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  User,
  Bot,
  Volume2,
  Share2,
  Bookmark,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { QuickActions, QuickAction } from './QuickActions';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Types
export interface MessageAttachment {
  id: string;
  type: 'file' | 'image' | 'contract' | 'chart';
  name: string;
  url?: string;
  preview?: string;
  size?: number;
  metadata?: Record<string, any>;
}

export interface MessageSource {
  contractId: string;
  contractName: string;
  relevanceScore: number;
  snippet?: string;
  pageNumber?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error' | 'streaming';
  suggestions?: string[];
  quickActions?: QuickAction[];
  attachments?: MessageAttachment[];
  sources?: MessageSource[];
  feedback?: 'positive' | 'negative' | null;
  bookmarked?: boolean;
  isTyping?: boolean;
  metadata?: {
    confidence?: number;
    processingTime?: number;
    model?: string;
    tokens?: number;
    referenceResolutions?: Record<string, unknown>;
  };
}

interface MessageBubbleProps {
  message: ChatMessage;
  onCopy?: (content: string) => void;
  onFeedback?: (messageId: string, feedback: 'positive' | 'negative') => void;
  onRetry?: (messageId: string) => void;
  onSuggestionClick?: (suggestion: string) => void;
  onQuickAction?: (action: QuickAction) => void;
  onSourceClick?: (source: MessageSource) => void;
  onBookmark?: (messageId: string) => void;
  onShare?: (messageId: string) => void;
  onSpeak?: (content: string) => void;
  isLatest?: boolean;
  showAvatar?: boolean;
}

// Code block component
const CodeBlock = memo(({ code, language }: { code: string; language?: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden bg-slate-900 dark:bg-slate-950">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 dark:bg-slate-900 border-b border-slate-700">
        <span className="text-xs font-mono text-slate-400">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm">
        <code className="text-slate-300 font-mono">{code}</code>
      </pre>
    </div>
  );
});
CodeBlock.displayName = 'CodeBlock';

// Table component
const MessageTable = memo(({ data }: { data: string[][] }) => {
  if (!data || data.length === 0) return null;

  const headers = data[0] || [];
  const rows = data.slice(1);

  return (
    <div className="my-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800">
          <tr>
            {headers.map((header, i) => (
              <th
                key={i}
                className="px-4 py-2 text-left font-medium text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-slate-100 dark:border-slate-800 last:border-0"
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
MessageTable.displayName = 'MessageTable';

// Source reference component
const SourceReference = memo(({ 
  source, 
  onClick 
}: { 
  source: MessageSource; 
  onClick?: (source: MessageSource) => void;
}) => (
  <button
    onClick={() => onClick?.(source)}
    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-left"
  >
    <FileText className="h-4 w-4 text-indigo-500 flex-shrink-0" />
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
        {source.contractName}
      </p>
      {source.snippet && (
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
          {source.snippet}
        </p>
      )}
    </div>
    <div className="flex items-center gap-1 text-xs text-slate-400">
      <span>{Math.round(source.relevanceScore * 100)}%</span>
      <ExternalLink className="h-3 w-3" />
    </div>
  </button>
));
SourceReference.displayName = 'SourceReference';

// Attachment preview
const AttachmentPreview = memo(({ attachment }: { attachment: MessageAttachment }) => {
  const icons = {
    file: FileText,
    image: ImageIcon,
    contract: FileText,
    chart: Table,
  };
  const Icon = icons[attachment.type] || FileText;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800">
      <Icon className="h-4 w-4 text-slate-500" />
      <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
        {attachment.name}
      </span>
      {attachment.size && (
        <span className="text-xs text-slate-400">
          {(attachment.size / 1024).toFixed(1)}KB
        </span>
      )}
    </div>
  );
});
AttachmentPreview.displayName = 'AttachmentPreview';

// Parse markdown-like content
function parseMessageContent(content: string) {
  const parts: React.ReactNode[] = [];
  let currentIndex = 0;

  // Code block pattern
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > currentIndex) {
      parts.push(
        <span key={`text-${currentIndex}`}>
          {formatInlineMarkdown(content.slice(currentIndex, match.index))}
        </span>
      );
    }

    // Add code block
    parts.push(
      <CodeBlock
        key={`code-${match.index}`}
        code={match[2] || ''}
        language={match[1]}
      />
    );

    currentIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (currentIndex < content.length) {
    parts.push(
      <span key={`text-${currentIndex}`}>
        {formatInlineMarkdown(content.slice(currentIndex))}
      </span>
    );
  }

  return parts.length > 0 ? parts : formatInlineMarkdown(content);
}

// Format inline markdown
function formatInlineMarkdown(text: string): React.ReactNode {
  // Split by newlines and process each line
  return text.split('\n').map((line, i, arr) => {
    let processed: React.ReactNode = line;

    // Bold **text**
    processed = processPattern(processed, /\*\*(.*?)\*\*/g, (match, content) => (
      <strong key={match} className="font-semibold">{content}</strong>
    ));

    // Italic *text*
    processed = processPattern(processed, /(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, (match, content) => (
      <em key={match}>{content}</em>
    ));

    // Inline code `code`
    processed = processPattern(processed, /`([^`]+)`/g, (match, content) => (
      <code key={match} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-sm font-mono text-pink-600 dark:text-pink-400">
        {content}
      </code>
    ));

    // Links [text](url)
    processed = processPattern(processed, /\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => (
      <a
        key={match}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-indigo-600 dark:text-indigo-400 hover:underline"
      >
        {text}
      </a>
    ));

    // Bullet points
    if (line.trim().startsWith('• ') || line.trim().startsWith('- ')) {
      processed = (
        <span className="flex items-start gap-2">
          <span className="text-indigo-500 mt-1">•</span>
          <span>{line.trim().slice(2)}</span>
        </span>
      );
    }

    // Numbered lists
    const numberedMatch = line.trim().match(/^(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      processed = (
        <span className="flex items-start gap-2">
          <span className="text-indigo-500 font-medium min-w-[1.5rem]">{numberedMatch[1]}.</span>
          <span>{numberedMatch[2]}</span>
        </span>
      );
    }

    return (
      <React.Fragment key={i}>
        {processed}
        {i < arr.length - 1 && <br />}
      </React.Fragment>
    );
  });
}

// Process regex pattern and replace with React nodes
function processPattern(
  content: React.ReactNode,
  pattern: RegExp,
  replacer: (...args: string[]) => React.ReactNode
): React.ReactNode {
  if (typeof content !== 'string') return content;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  const regex = new RegExp(pattern.source, pattern.flags);
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    parts.push(replacer(match[0], ...match.slice(1)));
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : content;
}

// Main Message Bubble Component
export const MessageBubble = memo(({
  message,
  onCopy,
  onFeedback,
  onRetry,
  onSuggestionClick,
  onQuickAction,
  onSourceClick,
  onBookmark,
  onShare,
  onSpeak,
  isLatest = false,
  showAvatar = true,
}: MessageBubbleProps) => {
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isError = message.status === 'error';
  const isStreaming = message.status === 'streaming';

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    onCopy?.(message.content);
    setTimeout(() => setCopied(false), 2000);
  }, [message.content, onCopy]);

  const parsedContent = useMemo(
    () => parseMessageContent(message.content),
    [message.content]
  );

  const timeString = useMemo(() => {
    return message.timestamp.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }, [message.timestamp]);

  // System message styling
  if (isSystem) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-center my-4"
      >
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-400">
          <AlertCircle className="h-4 w-4" />
          <span>{message.content}</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex gap-3 group",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      {showAvatar && (
        <div className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser
            ? "bg-gradient-to-br from-blue-500 to-indigo-600"
            : "bg-gradient-to-br from-purple-500 to-pink-500"
        )}>
          {isUser ? (
            <User className="h-4 w-4 text-white" />
          ) : (
            <Sparkles className="h-4 w-4 text-white" />
          )}
        </div>
      )}

      {/* Message content */}
      <div className={cn(
        "flex flex-col max-w-[75%]",
        isUser ? "items-end" : "items-start"
      )}>
        {/* Bubble */}
        <div
          className={cn(
            "rounded-2xl px-4 py-3 relative",
            isUser
              ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-tr-sm"
              : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-tl-sm",
            isError && "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30",
            isStreaming && "animate-pulse"
          )}
        >
          {/* Content */}
          <div className={cn(
            "prose prose-sm max-w-none",
            isUser 
              ? "prose-invert" 
              : "dark:prose-invert prose-slate",
            "prose-p:my-1 prose-ul:my-2 prose-li:my-0.5"
          )}>
            {parsedContent}
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1" />
            )}
          </div>

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-3 space-y-2">
              {message.attachments.map((attachment) => (
                <AttachmentPreview key={attachment.id} attachment={attachment} />
              ))}
            </div>
          )}

          {/* Confidence indicator */}
          {!isUser && message.metadata?.confidence && (
            <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
              <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${message.metadata.confidence * 100}%` }}
                />
              </div>
              <span>{Math.round(message.metadata.confidence * 100)}% confident</span>
            </div>
          )}
        </div>

        {/* Suggestions */}
        {!isUser && message.suggestions && message.suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => onSuggestionClick?.(suggestion)}
                className="text-xs px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        {!isUser && message.quickActions && message.quickActions.length > 0 && (
          <QuickActions
            actions={message.quickActions}
            onAction={onQuickAction}
            onSendMessage={onSuggestionClick}
            size="sm"
            variant="inline"
          />
        )}

        {/* Sources */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-2 w-full">
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              <FileText className="h-3 w-3" />
              {message.sources.length} source{message.sources.length !== 1 ? 's' : ''}
              {showSources ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
            <AnimatePresence>
              {showSources && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 space-y-2 overflow-hidden"
                >
                  {message.sources.map((source) => (
                    <SourceReference
                      key={source.contractId}
                      source={source}
                      onClick={onSourceClick}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Actions row */}
        <div className={cn(
          "flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity",
          isUser ? "flex-row-reverse" : "flex-row"
        )}>
          {/* Timestamp */}
          <span className="text-xs text-slate-400 px-2">
            {timeString}
          </span>

          {/* Status indicator */}
          {message.status === 'sending' && (
            <Clock className="h-3 w-3 text-slate-400 animate-pulse" />
          )}
          {message.status === 'sent' && (
            <Check className="h-3 w-3 text-emerald-500" />
          )}
          {message.status === 'error' && (
            <button
              onClick={() => onRetry?.(message.id)}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
            >
              <RotateCcw className="h-3 w-3" />
              Retry
            </button>
          )}

          {/* Action buttons (for assistant messages) */}
          {!isUser && !isError && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={handleCopy}
                    >
                      {copied ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-6 w-6 p-0",
                        message.feedback === 'positive' && "text-emerald-500"
                      )}
                      onClick={() => onFeedback?.(message.id, 'positive')}
                    >
                      <ThumbsUp className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Good response</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-6 w-6 p-0",
                        message.feedback === 'negative' && "text-red-500"
                      )}
                      onClick={() => onFeedback?.(message.id, 'negative')}
                    >
                      <ThumbsDown className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Poor response</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* More actions dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onSpeak?.(message.content)}>
                    <Volume2 className="h-4 w-4 mr-2" />
                    Read aloud
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onBookmark?.(message.id)}>
                    <Bookmark className={cn("h-4 w-4 mr-2", message.bookmarked && "fill-current")} />
                    {message.bookmarked ? 'Unbookmark' : 'Bookmark'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onShare?.(message.id)}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onRetry?.(message.id)}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Regenerate
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
});
MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;
