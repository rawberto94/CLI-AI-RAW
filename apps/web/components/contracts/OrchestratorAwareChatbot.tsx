/**
 * OrchestratorAwareChatbot
 * Chatbot with real-time orchestrator progress awareness
 */

'use client';

import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Bot,
  User,
  Send,
  Loader2,
  Sparkles,
  Activity,
  CheckCircle2,
  Clock,
  Zap,
  X,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOrchestratorChatbot } from '@/hooks/useOrchestratorChatbot';

interface OrchestratorAwareChatbotProps {
  contractId?: string;
  tenantId: string;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function OrchestratorAwareChatbot({
  contractId,
  tenantId,
  isOpen,
  onClose,
  className,
}: OrchestratorAwareChatbotProps) {
  const [input, setInput] = React.useState('');
  const [isMinimized, setIsMinimized] = React.useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
    orchestratorProgress,
    isConnected,
  } = useOrchestratorChatbot({
    contractId,
    tenantId,
    enabled: isOpen,
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const messageContent = input;
    setInput('');
    await sendMessage(messageContent);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className={cn(
        'fixed bottom-4 right-4 w-[400px] z-50 shadow-2xl',
        isMinimized && 'h-auto',
        className
      )}
    >
      <Card className="flex flex-col h-[600px] overflow-hidden border-2 border-violet-200">
        {/* Header */}
        <CardHeader className="bg-gradient-to-r from-violet-600 to-purple-600 text-white py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  AI Assistant
                </CardTitle>
                <div className="flex items-center gap-2 mt-0.5">
                  {contractId && (
                    <>
                      {isConnected ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0 px-1.5 bg-green-500/20 text-white border-white/30"
                        >
                          <Activity className="h-2.5 w-2.5 mr-1" />
                          Live
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0 px-1.5 bg-gray-500/20 text-white border-white/30"
                        >
                          Polling
                        </Badge>
                      )}
                      {orchestratorProgress && (
                        <span className="text-[10px] text-white/80">
                          {orchestratorProgress.artifacts.completed}/
                          {orchestratorProgress.artifacts.total} artifacts
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-white hover:bg-white/20"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                {isMinimized ? (
                  <Maximize2 className="h-4 w-4" />
                ) : (
                  <Minimize2 className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-white hover:bg-white/20"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Messages */}
        {!isMinimized && (
          <>
            <CardContent className="flex-1 p-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div ref={scrollRef} className="p-4 space-y-3">
                  {messages.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      <Bot className="h-12 w-12 mx-auto mb-3 text-violet-400" />
                      <p className="text-sm">
                        Hi! I can help with contract questions
                        {contractId && (
                          <span>
                            {' '}
                            and show you real-time processing status.
                          </span>
                        )}
                      </p>
                      {contractId && orchestratorProgress && (
                        <div className="mt-4 space-y-2">
                          <p className="text-xs font-medium">Try asking:</p>
                          <div className="flex flex-col gap-1 text-xs">
                            <button
                              onClick={() =>
                                sendMessage("What's the current status?")
                              }
                              className="px-3 py-1.5 bg-violet-50 hover:bg-violet-100 rounded-lg text-violet-700 transition-colors"
                            >
                              What&apos;s the current status?
                            </button>
                            <button
                              onClick={() =>
                                sendMessage('What artifacts are ready?')
                              }
                              className="px-3 py-1.5 bg-violet-50 hover:bg-violet-100 rounded-lg text-violet-700 transition-colors"
                            >
                              What artifacts are ready?
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <AnimatePresence initial={false}>
                    {messages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={cn(
                          'flex gap-3',
                          message.role === 'user' && 'flex-row-reverse'
                        )}
                      >
                        {/* Avatar */}
                        <div
                          className={cn(
                            'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                            message.role === 'user'
                              ? 'bg-violet-500'
                              : 'bg-slate-600'
                          )}
                        >
                          {message.role === 'user' ? (
                            <User className="h-4 w-4 text-white" />
                          ) : (
                            <Bot className="h-4 w-4 text-white" />
                          )}
                        </div>

                        {/* Message bubble */}
                        <div
                          className={cn(
                            'flex-1 rounded-2xl px-4 py-2.5 text-sm max-w-[85%]',
                            message.role === 'user'
                              ? 'bg-violet-500 text-white ml-auto'
                              : 'bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100'
                          )}
                        >
                          <div className="whitespace-pre-wrap break-words">
                            {message.content.split(/(\*\*.*?\*\*)/).map((part, i) => {
                              const boldMatch = part.match(/^\*\*(.*)\*\*$/);
                              return boldMatch ? (
                                <strong key={i}>{boldMatch[1]}</strong>
                              ) : (
                                <span key={i}>{part}</span>
                              );
                            })}
                          </div>
                          
                          {/* Orchestrator info badge */}
                          {message.orchestratorInfo && (
                            <div className="mt-2 pt-2 border-t border-gray-200 flex flex-wrap gap-1.5">
                              <Badge
                                variant="secondary"
                                className="text-[10px] py-0.5 px-1.5"
                              >
                                <Clock className="h-2.5 w-2.5 mr-1" />
                                {message.orchestratorInfo.status}
                              </Badge>
                              <Badge
                                variant="secondary"
                                className="text-[10px] py-0.5 px-1.5"
                              >
                                <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                                {message.orchestratorInfo.artifacts.completed}/
                                {message.orchestratorInfo.artifacts.total}
                              </Badge>
                            </div>
                          )}

                          <p className="text-[10px] mt-1.5 opacity-60">
                            {message.timestamp.toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Loading indicator */}
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-3"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-500 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                      <div className="bg-gray-100 rounded-2xl px-4 py-2.5">
                        <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
                      </div>
                    </motion.div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>

            {/* Input */}
            <div className="p-3 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
              <div className="flex gap-2">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything..."
                  className="min-h-[60px] max-h-[120px] resize-none text-sm"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="self-end bg-violet-600 hover:bg-violet-700"
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-[10px] text-gray-500">
                  <kbd className="px-1.5 py-0.5 bg-white rounded text-[10px]">
                    Enter
                  </kbd>{' '}
                  send •{' '}
                  <kbd className="px-1.5 py-0.5 bg-white rounded text-[10px]">
                    Shift+Enter
                  </kbd>{' '}
                  new line
                </p>
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearMessages}
                    className="h-6 text-[10px] px-2"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </Card>
    </motion.div>
  );
}
