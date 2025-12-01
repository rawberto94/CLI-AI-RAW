'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  MessageSquare,
  Send,
  Sparkles,
  X,
  Minimize2,
  Maximize2,
  FileText,
  Search,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle2,
  Loader2,
  Bot,
  User,
  Lightbulb,
  BookOpen,
  Play,
  FileEdit,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: string[];
  suggestedActions?: Array<{
    label: string;
    action: string;
  }>;
  workflow?: {
    ready: boolean;
    contractId: string;
    contractName: string;
    action: string;
  };
}

interface AIChatbotProps {
  contractId?: string;
  context?: 'contracts' | 'templates' | 'deadlines' | 'global';
}

export function AIChatbot({ contractId, context = 'global' }: AIChatbotProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  // Default to real API mode for production - set to true only for testing
  const [useMockMode, setUseMockMode] = useState(false);
  const [isStartingWorkflow, setIsStartingWorkflow] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const contextualSuggestions: Record<string, string[]> = {
    global: [
      'I need to renew a contract',
      'What contracts expire in the next 30 days?',
      'Show me all high-risk contracts',
      'Start an approval workflow',
    ],
    contracts: [
      'Summarize this contract',
      'What are the key risks?',
      'Start the renewal process',
      'When does this expire?',
    ],
    templates: [
      'Show me NDA templates',
      'What clauses are high-risk?',
      'Create a new MSA template',
      'Compare template usage',
    ],
    deadlines: [
      'What deadlines are overdue?',
      'Show upcoming renewals',
      'Start renewal for expiring contracts',
      'Create deadline report',
    ],
  };

  useEffect(() => {
    if (messages.length === 0) {
      setSuggestions(contextualSuggestions[context] ?? []);
      // Send welcome message
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `Hi! I'm your AI assistant for Contract Lifecycle Management. I can help you with:

• **Search & Analyze** - Find contracts, summarize terms, identify risks
• **Renewals & Deadlines** - Track expirations, start renewal workflows
• **Approvals & Workflows** - Initiate approvals, check status, delegate tasks
• **Contract Generation** - Draft new contracts from templates
• **Reports & Insights** - Analytics, compliance checks, portfolio health

**Try saying:**
- "I need to renew contract X with supplier Y"
- "Start the approval flow for the Acme MSA"
- "What contracts expire in 30 days?"

How can I help you today?`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [context, messages.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (message?: string) => {
    const userMessage = message || input.trim();
    if (!userMessage || isLoading) return;

    const newUserMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Call AI API
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          contractId,
          context,
          conversationHistory: messages.slice(-10), // Last 10 messages for context
          useMock: useMockMode,
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        sources: data.sources,
        suggestedActions: data.suggestedActions,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Update suggestions based on response
      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      }
    } catch (error) {
      console.error('AI Chat error:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again or rephrase your question.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    handleSend(suggestion);
  };

  const handleActionClick = async (action: string) => {
    // Parse and execute suggested actions
    console.log('Executing action:', action);
    
    // Handle workflow actions
    if (action.startsWith('start-renewal:')) {
      const contractId = action.split(':')[1];
      setIsStartingWorkflow(true);
      
      try {
        // Start the renewal workflow
        const response = await fetch('/api/workflows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Contract Renewal',
            type: 'RENEWAL',
            description: 'Standard contract renewal approval workflow',
            steps: [
              { name: 'Legal Review', type: 'APPROVAL', assignedRole: 'legal', order: 0 },
              { name: 'Finance Review', type: 'APPROVAL', assignedRole: 'finance', order: 1 },
              { name: 'VP Approval', type: 'APPROVAL', assignedRole: 'vp', order: 2 },
            ],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          toast.success('Renewal workflow started!', {
            description: 'The approval process has been initiated.',
          });
          
          // Add confirmation message
          const confirmMessage: Message = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: `✅ **Renewal workflow started successfully!**

The approval workflow has been created and is now active. Here's what happens next:

1. **Legal Review** - Legal team will review the renewal terms
2. **Finance Review** - Finance will verify budget and pricing
3. **VP Approval** - Final sign-off from VP

You can track progress in the [Approvals Dashboard](/approvals).

Would you like me to notify the first approver or do anything else?`,
            timestamp: new Date(),
            suggestedActions: [
              { label: '📋 View in Approvals', action: 'navigate:/approvals' },
              { label: '📧 Notify Approvers', action: 'notify-approvers' },
            ],
          };
          setMessages((prev) => [...prev, confirmMessage]);
        } else {
          throw new Error('Failed to start workflow');
        }
      } catch (error) {
        console.error('Workflow error:', error);
        toast.error('Failed to start workflow');
        
        const errorMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `❌ I encountered an issue starting the workflow. Would you like to try again or navigate to the contracts page to start manually?`,
          timestamp: new Date(),
          suggestedActions: [
            { label: '🔄 Try Again', action: action },
            { label: '📋 Go to Contracts', action: 'navigate:/contracts' },
          ],
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsStartingWorkflow(false);
      }
      return;
    }

    if (action.startsWith('draft-renewal:')) {
      const contractId = action.split(':')[1];
      router.push(`/drafting?contractId=${contractId}&mode=renewal`);
      toast.info('Opening contract drafting...', {
        description: 'Preparing renewal contract template',
      });
      return;
    }

    if (action.startsWith('schedule-meeting:')) {
      const contractId = action.split(':')[1];
      toast.info('Opening calendar...', {
        description: 'Schedule a renewal discussion meeting',
      });
      // Could integrate with calendar API
      return;
    }

    if (action.startsWith('navigate:')) {
      const path = action.split(':')[1] ?? '/dashboard';
      router.push(path);
      return;
    }

    // Handle other common actions
    switch (action) {
      case 'search-contracts':
        router.push('/contracts');
        break;
      case 'view-dashboard':
        router.push('/dashboard');
        break;
      case 'view-expiring':
        router.push('/contracts?filter=expiring');
        break;
      case 'view-high-risk':
        router.push('/contracts?filter=high-risk');
        break;
      case 'create-contract':
        router.push('/drafting/new');
        break;
      case 'bulk-approve':
        router.push('/approvals?action=bulk');
        break;
      case 'review-urgent':
        router.push('/approvals?filter=urgent');
        break;
      default:
        console.log('Unknown action:', action);
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 z-50"
        size="icon"
      >
        <MessageSquare className="h-6 w-6" />
      </Button>
    );
  }

  if (isMinimized) {
    return (
      <Card className="fixed bottom-6 right-6 w-80 shadow-2xl z-50">
        <CardHeader className="pb-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <CardTitle className="text-sm">AI Assistant</CardTitle>
              <Badge className="bg-white/20 text-white border-0 text-xs">
                {messages.length - 1} messages
              </Badge>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(false)}
                className="h-7 w-7 p-0 text-white hover:bg-white/20"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-7 w-7 p-0 text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-[480px] h-[700px] shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <CardHeader className="pb-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">AI Assistant</CardTitle>
              <p className="text-xs text-white/80">
                {useMockMode ? 'Mock Mode' : 'Powered by GPT-4'}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMinimized(true)}
              className="h-8 w-8 p-0 text-white hover:bg-white/20"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 p-0 text-white hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Settings Row */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/20">
          <div className="flex items-center gap-2">
            {context !== 'global' && (
              <Badge className="bg-white/20 text-white border-0">
                {context.charAt(0).toUpperCase() + context.slice(1)} Context
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="mock-mode" className="text-xs text-white/90 cursor-pointer">
              Mock Mode
            </Label>
            <Switch
              id="mock-mode"
              checked={useMockMode}
              onCheckedChange={setUseMockMode}
              className="data-[state=checked]:bg-white/30"
            />
          </div>
        </div>
      </CardHeader>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div ref={scrollRef} className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'assistant' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-white" />
                </div>
              )}

              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-3',
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                )}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>

                {/* Sources */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-300/30">
                    <p className="text-xs font-medium mb-2 flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />
                      Sources:
                    </p>
                    <div className="space-y-1">
                      {message.sources.map((source, idx) => (
                        <button
                          key={idx}
                          className="text-xs text-blue-600 hover:underline block"
                          onClick={() => console.log('Navigate to:', source)}
                        >
                          • {source}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggested Actions */}
                {message.suggestedActions && message.suggestedActions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-300/30 space-y-2">
                    <p className="text-xs font-medium mb-2 flex items-center gap-1">
                      <Lightbulb className="h-3 w-3" />
                      Suggested Actions:
                    </p>
                    {message.suggestedActions.map((action, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        size="sm"
                        className="w-full text-xs justify-start h-8"
                        onClick={() => handleActionClick(action.action)}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}

                <p className="text-xs opacity-60 mt-2">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              {message.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
              )}
            </div>
          ))}

          {/* Loading */}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div className="bg-gray-100 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="text-sm text-gray-600">Thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Suggestions */}
      {suggestions.length > 0 && messages.length <= 1 && (
        <div className="px-4 py-2 border-t bg-gray-50 flex-shrink-0">
          <p className="text-xs font-medium text-gray-600 mb-2">Quick Questions:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 3).map((suggestion, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t bg-white flex-shrink-0">
        <div className="flex gap-2">
          <Input
            placeholder="Ask me anything about your contracts..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </Card>
  );
}
