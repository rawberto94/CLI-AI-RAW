'use client';

/**
 * Enhanced Chat Input
 * Rich input with attachments, voice, suggestions, and smart features
 */

import React, { useState, useRef, useCallback, useEffect, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Mic,
  MicOff,
  Paperclip,
  X,
  Image as ImageIcon,
  FileText,
  Sparkles,
  Command,
  AtSign,
  Hash,
  Smile,
  ChevronUp,
  Loader2,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Attachment {
  id: string;
  file: File;
  preview?: string;
  uploading?: boolean;
  error?: string;
}

interface QuickCommand {
  id: string;
  trigger: string;
  label: string;
  description: string;
  icon: React.ElementType;
  action?: () => void;
}

const QUICK_COMMANDS: QuickCommand[] = [
  { id: 'summarize', trigger: '/summarize', label: 'Summarize', description: 'Get a summary of contracts', icon: FileText },
  { id: 'compare', trigger: '/compare', label: 'Compare', description: 'Compare two contracts', icon: Zap },
  { id: 'analyze', trigger: '/analyze', label: 'Analyze', description: 'Deep analysis of a contract', icon: Sparkles },
  { id: 'search', trigger: '/search', label: 'Search', description: 'Search across all contracts', icon: Hash },
  { id: 'help', trigger: '/help', label: 'Help', description: 'Show available commands', icon: Command },
];

interface EnhancedChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string, attachments?: Attachment[]) => void;
  onVoiceInput?: (transcript: string) => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  maxLength?: number;
  suggestions?: string[];
  onSuggestionClick?: (suggestion: string) => void;
  showQuickCommands?: boolean;
  contractContext?: { id: string; name: string };
}

export const EnhancedChatInput = forwardRef<HTMLTextAreaElement, EnhancedChatInputProps>(({
  value,
  onChange,
  onSend,
  onVoiceInput,
  placeholder = "Ask me anything about your contracts...",
  disabled = false,
  isLoading = false,
  maxLength = 4000,
  suggestions = [],
  onSuggestionClick,
  showQuickCommands = true,
  contractContext,
}, ref) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState<QuickCommand[]>([]);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Combine ref
  const combinedRef = useCallback((node: HTMLTextAreaElement) => {
    textareaRef.current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  }, [ref]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognitionAPI();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0]?.transcript ?? '')
          .join('');
        onChange(transcript);
        onVoiceInput?.(transcript);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current.onerror = () => {
        setIsRecording(false);
      };
    }
  }, [onChange, onVoiceInput]);

  // Handle command detection
  useEffect(() => {
    if (showQuickCommands && value.startsWith('/')) {
      const command = value.toLowerCase();
      const filtered = QUICK_COMMANDS.filter(
        (cmd) => cmd.trigger.toLowerCase().includes(command) || cmd.label.toLowerCase().includes(command.slice(1))
      );
      setFilteredCommands(filtered);
      setShowCommands(filtered.length > 0);
      setSelectedCommandIndex(0);
    } else {
      setShowCommands(false);
    }
  }, [value, showQuickCommands]);

  // Handle send
  const handleSend = useCallback(() => {
    if (!value.trim() && attachments.length === 0) return;
    if (isLoading || disabled) return;

    onSend(value.trim(), attachments);
    setAttachments([]);
  }, [value, attachments, isLoading, disabled, onSend]);

  // Handle key down
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Command navigation
    if (showCommands) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCommandIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCommandIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = filteredCommands[selectedCommandIndex];
        if (selected) {
          onChange(selected.trigger + ' ');
          setShowCommands(false);
        }
        return;
      }
      if (e.key === 'Escape') {
        setShowCommands(false);
        return;
      }
    }

    // Send on Enter (without shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [showCommands, filteredCommands, selectedCommandIndex, onChange, handleSend]);

  // Handle file select
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newAttachments: Attachment[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = '';
  }, []);

  // Remove attachment
  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const attachment = prev.find((a) => a.id === id);
      if (attachment?.preview) {
        URL.revokeObjectURL(attachment.preview);
      }
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  // Toggle voice recording
  const toggleRecording = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  }, [isRecording]);

  // Select command
  const selectCommand = useCallback((command: QuickCommand) => {
    onChange(command.trigger + ' ');
    setShowCommands(false);
    textareaRef.current?.focus();
    command.action?.();
  }, [onChange]);

  return (
    <div className="relative">
      {/* Quick commands dropdown */}
      <AnimatePresence>
        {showCommands && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-10"
          >
            <div className="p-2">
              <p className="text-xs text-slate-500 px-2 mb-2">Quick Commands</p>
              {filteredCommands.map((command, index) => (
                <button
                  key={command.id}
                  onClick={() => selectCommand(command)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                    index === selectedCommandIndex
                      ? "bg-indigo-50 dark:bg-indigo-900/30"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                >
                  <command.icon className="h-4 w-4 text-indigo-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {command.label}
                    </p>
                    <p className="text-xs text-slate-500">{command.description}</p>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {command.trigger}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Suggestions */}
      {suggestions.length > 0 && isFocused && !value && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-full left-0 right-0 mb-2"
        >
          <div className="flex flex-wrap gap-2 p-2">
            {suggestions.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => onSuggestionClick?.(suggestion)}
                className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-300"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Contract context indicator */}
      {contractContext && (
        <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
          <FileText className="h-4 w-4 text-indigo-500" />
          <span>Context: <span className="font-medium text-slate-700 dark:text-slate-300">{contractContext.name}</span></span>
        </div>
      )}

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="relative flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg"
            >
              {attachment.preview ? (
                <img
                  src={attachment.preview}
                  alt={attachment.file.name}
                  className="h-8 w-8 object-cover rounded"
                />
              ) : (
                <FileText className="h-4 w-4 text-slate-500" />
              )}
              <span className="text-sm text-slate-700 dark:text-slate-300 max-w-[150px] truncate">
                {attachment.file.name}
              </span>
              <button
                onClick={() => removeAttachment(attachment.id)}
                className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
              >
                <X className="h-3 w-3 text-slate-500" />
              </button>
              {attachment.uploading && (
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Main input area */}
      <div className={cn(
        "flex items-end gap-2 p-3 rounded-xl border transition-all",
        isFocused
          ? "border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 shadow-lg shadow-indigo-500/10"
          : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50",
        isRecording && "border-red-300 dark:border-red-700 shadow-red-500/10"
      )}>
        {/* Attachment button */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
          onChange={handleFileSelect}
          className="hidden"
        />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 flex-shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Attach file</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Textarea */}
        <div className="flex-1 relative">
          <textarea
            ref={combinedRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            maxLength={maxLength}
            rows={1}
            className={cn(
              "w-full resize-none bg-transparent outline-none text-slate-900 dark:text-white placeholder:text-slate-400",
              "text-sm leading-relaxed",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          />
          
          {/* Character count */}
          {value.length > maxLength * 0.8 && (
            <div className={cn(
              "absolute right-0 -top-5 text-xs",
              value.length > maxLength * 0.95 ? "text-red-500" : "text-slate-400"
            )}>
              {value.length}/{maxLength}
            </div>
          )}
        </div>

        {/* Voice input button */}
        {recognitionRef.current && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 w-8 p-0 flex-shrink-0",
                    isRecording && "text-red-500 animate-pulse"
                  )}
                  onClick={toggleRecording}
                  disabled={disabled}
                >
                  {isRecording ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isRecording ? 'Stop recording' : 'Voice input'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Send button */}
        <Button
          size="sm"
          className={cn(
            "h-8 gap-1.5 flex-shrink-0 transition-all",
            (value.trim() || attachments.length > 0) && !isLoading
              ? "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
              : ""
          )}
          onClick={handleSend}
          disabled={(!value.trim() && attachments.length === 0) || isLoading || disabled}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Send</span>
            </>
          )}
        </Button>
      </div>

      {/* Keyboard hint */}
      <div className="flex items-center justify-between mt-2 px-1 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px]">Enter</kbd>
            to send
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px]">Shift+Enter</kbd>
            for new line
          </span>
        </div>
        {showQuickCommands && (
          <span className="flex items-center gap-1">
            Type <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px]">/</kbd>
            for commands
          </span>
        )}
      </div>
    </div>
  );
});

EnhancedChatInput.displayName = 'EnhancedChatInput';

export default EnhancedChatInput;
