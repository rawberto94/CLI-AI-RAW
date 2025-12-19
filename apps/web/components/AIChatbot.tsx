'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  Mic,
  MicOff,
  Paperclip,
  Download,
  Trash2,
  Copy,
  RotateCcw,
  History,
  Settings,
  ChevronDown,
  Keyboard,
  Zap,
  Upload,
  RefreshCw,
  MoreVertical,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// Keyboard shortcuts
const KEYBOARD_SHORTCUTS = {
  openChat: { key: 'k', ctrl: true, description: 'Open/close chat' },
  newChat: { key: 'n', ctrl: true, shift: true, description: 'New conversation' },
  focus: { key: '/', ctrl: false, description: 'Focus input' },
};

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
  isStreaming?: boolean;
  feedback?: 'positive' | 'negative';
  attachments?: Array<{
    name: string;
    type: string;
    size: number;
  }>;
  contractPreviews?: Array<{
    id: string;
    title: string;
    supplier: string;
    value?: number;
    status: string;
    expiresIn?: number;
  }>;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  lastUpdated: Date;
}

interface AIChatbotProps {
  contractId?: string;
  context?: 'contracts' | 'templates' | 'deadlines' | 'global';
}

// Local storage keys
const STORAGE_KEYS = {
  sessions: 'ai-chat-sessions',
  currentSession: 'ai-chat-current-session',
  settings: 'ai-chat-settings',
};

export function AIChatbot({ contractId, context = 'global' }: AIChatbotProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isStartingWorkflow, setIsStartingWorkflow] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // New enhanced states
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const contextualSuggestions: Record<string, string[]> = {
    global: [
      'What needs my attention today?',
      'What contracts expire in the next 30 days?',
      'Show me a summary of all active contracts',
      'Find contracts with termination clauses',
      'Analyze spending by supplier',
      'Which contracts have auto-renewal enabled?',
    ],
    contracts: [
      'Summarize the key terms',
      'What are the main risks in this contract?',
      'Show me the rate card',
      'What are our obligations?',
      'When does this expire and what are renewal terms?',
      'Compare with similar contracts',
    ],
    templates: [
      'Show me NDA templates',
      'What clauses are typically high-risk?',
      'Create a new MSA template',
      'Compare template usage across contracts',
    ],
    deadlines: [
      'What contracts expire this month?',
      'Show auto-renewal contracts expiring soon',
      'Which high-value contracts need attention?',
      'Create a renewal timeline report',
    ],
  };

  useEffect(() => {
    if (messages.length === 0) {
      setSuggestions(contextualSuggestions[context] ?? []);
      // Send welcome message
      const welcomeContent = contractId 
        ? `Hi! I'm ConTigo AI - your intelligent contract assistant. I've loaded the details of this contract and can help you with:

• **Quick Analysis** - "Summarize the key terms" or "What are the risks?"
• **Deep Dive** - "Show me our obligations" or "What are the payment terms?"
• **Rate Cards** - "Show me the rate card" or "What are the hourly rates?"
• **Comparisons** - "How does this compare to similar contracts?"
• **Actions** - "Start renewal process" or "Flag for review"

What would you like to know about this contract?`
        : `Hi! I'm ConTigo AI - your intelligent contract assistant. I have access to your entire contract portfolio and can help you with:

• **🔍 Smart Search** - "Find contracts about liability limits" or "Which contracts mention SLA?"
• **📊 Analytics** - "Analyze spend by supplier" or "Show contract value distribution"
• **⚠️ Alerts** - "What needs my attention?" or "Show high-risk contracts"
• **📋 Lists** - "Show contracts expiring in 30 days" or "List all Accenture contracts"
• **🔄 Comparisons** - "Compare Deloitte vs Accenture contracts"
• **📄 Details** - "Tell me about the Microsoft MSA" or "Summarize the IBM contract"

**Quick Actions:**
- Ask "What needs attention today?" for urgent items
- Ask "Show dashboard overview" for portfolio health

How can I help you today?`;

      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: welcomeContent,
          timestamp: new Date(),
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, messages.length, contractId]);

  // Load chat sessions from localStorage
  useEffect(() => {
    try {
      const savedSessions = localStorage.getItem(STORAGE_KEYS.sessions);
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        setChatSessions(parsed.map((s: ChatSession) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          lastUpdated: new Date(s.lastUpdated),
          messages: s.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })),
        })));
      }
      const currentId = localStorage.getItem(STORAGE_KEYS.currentSession);
      if (currentId) setCurrentSessionId(currentId);
    } catch (e) {
      console.error('Failed to load chat sessions:', e);
    }
  }, []);

  // Save session when messages change
  useEffect(() => {
    if (messages.length > 1 && currentSessionId) {
      const session = chatSessions.find(s => s.id === currentSessionId);
      if (session) {
        const updated = {
          ...session,
          messages,
          lastUpdated: new Date(),
          title: messages[1]?.content?.slice(0, 50) || session.title,
        };
        const newSessions = chatSessions.map(s => 
          s.id === currentSessionId ? updated : s
        );
        setChatSessions(newSessions);
        try {
          localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(newSessions));
        } catch (e) {
          console.error('Failed to save session:', e);
        }
      }
    }
  }, [messages, currentSessionId, chatSessions]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K to open/close chat
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      // Ctrl/Cmd + Shift + N for new conversation
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        handleNewConversation();
      }
      // / to focus input when chat is open
      if (e.key === '/' && isOpen && !isMinimized && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isMinimized]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  // Create new conversation
  const handleNewConversation = useCallback(() => {
    const newSessionId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newSessionId,
      title: 'New conversation',
      messages: [],
      createdAt: new Date(),
      lastUpdated: new Date(),
    };
    setChatSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSessionId);
    setMessages([]);
    setSuggestions(contextualSuggestions[context] ?? []);
    toast.success('Started new conversation');
  }, [context, contextualSuggestions]);

  // Load a previous session
  const loadSession = useCallback((session: ChatSession) => {
    setMessages(session.messages);
    setCurrentSessionId(session.id);
    setShowHistory(false);
    toast.info(`Loaded: ${session.title.slice(0, 30)}...`);
  }, []);

  // Delete a session
  const deleteSession = useCallback((sessionId: string) => {
    setChatSessions(prev => prev.filter(s => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      setMessages([]);
      setCurrentSessionId(null);
    }
    try {
      const updated = chatSessions.filter(s => s.id !== sessionId);
      localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to delete session:', e);
    }
  }, [currentSessionId, chatSessions]);

  // Export conversation
  const exportConversation = useCallback(() => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      context,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
        sources: m.sources,
      })),
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Conversation exported');
  }, [messages, context]);

  // Copy message to clipboard
  const copyMessage = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard');
  }, []);

  // Provide feedback on message
  const handleFeedback = useCallback((messageId: string, feedback: 'positive' | 'negative') => {
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, feedback } : m
    ));
    // TODO: Send feedback to server for improvement
    toast.success(feedback === 'positive' ? 'Thanks for the feedback!' : 'We\'ll improve based on your feedback');
  }, []);

  // Voice input handling
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        // Send to transcription API
        try {
          toast.info('Transcribing...');
          const formData = new FormData();
          formData.append('audio', blob);
          
          const response = await fetch('/api/ai/transcribe', {
            method: 'POST',
            body: formData,
          });
          
          if (response.ok) {
            const { text } = await response.json();
            setInput(text);
            toast.success('Voice transcribed');
          } else {
            toast.error('Failed to transcribe');
          }
        } catch (err) {
          console.error('Transcription error:', err);
          toast.error('Transcription failed');
        }
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      toast.info('Recording... Click again to stop');
    } catch (err) {
      console.error('Microphone access error:', err);
      toast.error('Could not access microphone');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  // File attachment handling
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File too large (max 10MB)');
        return;
      }
      setAttachedFile(file);
      toast.success(`Attached: ${file.name}`);
    }
  }, []);

  const removeAttachment = useCallback(() => {
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // Cancel streaming response
  const cancelStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setIsLoading(false);
  }, []);

  // Send with streaming support
  const handleSend = async (message?: string) => {
    const userMessage = message || input.trim();
    if (!userMessage || isLoading) return;

    // Create session if needed
    if (!currentSessionId) {
      const newSessionId = `session-${Date.now()}`;
      const newSession: ChatSession = {
        id: newSessionId,
        title: userMessage.slice(0, 50),
        messages: [],
        createdAt: new Date(),
        lastUpdated: new Date(),
      };
      setChatSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newSessionId);
    }

    const attachmentInfo = attachedFile ? {
      name: attachedFile.name,
      type: attachedFile.type,
      size: attachedFile.size,
    } : undefined;

    const newUserMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
      attachments: attachmentInfo ? [attachmentInfo] : undefined,
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInput('');
    setAttachedFile(null);
    setIsLoading(true);
    setStreamingText('');

    // Try streaming first
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/ai/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          contractId,
          context: { type: context, attachmentInfo },
          conversationHistory: messages.slice(-10),
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Streaming not available');
      }

      setIsStreaming(true);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let sources: string[] = [];
      let suggestedActions: Array<{ label: string; action: string }> = [];
      let contractPreviews: Message['contractPreviews'] = [];

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  fullContent += data.content;
                  setStreamingText(fullContent);
                }
                if (data.sources) sources = data.sources;
                if (data.suggestedActions) suggestedActions = data.suggestedActions;
                if (data.contractPreviews) contractPreviews = data.contractPreviews;
                if (data.done) break;
              } catch (e) {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }
      }

      setIsStreaming(false);
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: fullContent,
        timestamp: new Date(),
        sources,
        suggestedActions,
        contractPreviews,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingText('');

    } catch (streamError: unknown) {
      // Fallback to non-streaming if streaming fails or is aborted
      if ((streamError as Error)?.name === 'AbortError') {
        setIsLoading(false);
        setIsStreaming(false);
        return;
      }

      console.log('Streaming failed, falling back to standard API');
      setIsStreaming(false);

      try {
        // Call AI API
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage,
            contractId,
            context,
            conversationHistory: messages.slice(-10),
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
          contractPreviews: data.contractPreviews,
        };

        setMessages((prev) => [...prev, assistantMessage]);

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
          suggestedActions: [
            { label: '🔄 Retry', action: 'retry' },
            { label: '📋 Browse Contracts', action: 'navigate:/contracts' },
          ],
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
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
      case 'retry':
        // Retry the last user message
        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
        if (lastUserMsg) {
          handleSend(lastUserMsg.content);
        }
        break;
      default:
        console.log('Unknown action:', action);
    }
  };

  if (!isOpen) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => setIsOpen(true)}
              className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 z-50 group"
              size="icon"
            >
              <MessageSquare className="h-6 w-6 group-hover:scale-110 transition-transform" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500"></span>
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>AI Assistant <kbd className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded text-xs">⌘K</kbd></p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
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
    <Card className="fixed bottom-6 right-6 w-[520px] h-[750px] shadow-2xl z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <CardHeader className="pb-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <Sparkles className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <CardTitle className="text-lg">AI Assistant</CardTitle>
              <p className="text-xs text-white/80">
                {isStreaming ? 'Typing...' : 'Powered by GPT-4'}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            {/* Options Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-white hover:bg-white/20"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleNewConversation}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  New conversation
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowHistory(true)}>
                  <History className="h-4 w-4 mr-2" />
                  Chat history
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportConversation}>
                  <Download className="h-4 w-4 mr-2" />
                  Export chat
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowShortcuts(true)}>
                  <Keyboard className="h-4 w-4 mr-2" />
                  Keyboard shortcuts
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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

        {/* Context Badge */}
        {context !== 'global' && (
          <div className="flex items-center mt-3 pt-3 border-t border-white/20">
            <Badge className="bg-white/20 text-white border-0">
              {context.charAt(0).toUpperCase() + context.slice(1)} Context
            </Badge>
            <span className="text-xs text-white/60 ml-2">AI has full access to your contract data</span>
          </div>
        )}
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

                <p className="text-xs opacity-60 mt-2 flex items-center justify-between">
                  <span>
                    {message.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {/* Message actions for assistant messages */}
                  {message.role === 'assistant' && message.id !== 'welcome' && (
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => copyMessage(message.content)}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title="Copy"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleFeedback(message.id, 'positive')}
                        className={cn(
                          "p-1 hover:bg-gray-200 rounded transition-colors",
                          message.feedback === 'positive' && "bg-green-100 text-green-600"
                        )}
                        title="Helpful"
                      >
                        <ThumbsUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleFeedback(message.id, 'negative')}
                        className={cn(
                          "p-1 hover:bg-gray-200 rounded transition-colors",
                          message.feedback === 'negative' && "bg-red-100 text-red-600"
                        )}
                        title="Not helpful"
                      >
                        <ThumbsDown className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </p>

                {/* Attachments display */}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-300/30">
                    <div className="flex items-center gap-2 text-xs">
                      <Paperclip className="h-3 w-3" />
                      {message.attachments.map((att, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {att.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contract preview cards */}
                {message.contractPreviews && message.contractPreviews.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-300/30 space-y-2">
                    <p className="text-xs font-medium mb-2 flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Related Contracts:
                    </p>
                    {message.contractPreviews.slice(0, 3).map((contract) => (
                      <button
                        key={contract.id}
                        onClick={() => router.push(`/contracts/${contract.id}`)}
                        className="w-full text-left p-2 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium truncate">{contract.title}</span>
                          <Badge 
                            variant={contract.status === 'ACTIVE' ? 'default' : 'secondary'} 
                            className="text-xs ml-2"
                          >
                            {contract.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          <span>{contract.supplier}</span>
                          {contract.value && <span>• ${contract.value.toLocaleString()}</span>}
                          {contract.expiresIn && (
                            <span className={cn(
                              contract.expiresIn < 30 ? 'text-red-500' : 'text-gray-500'
                            )}>
                              • Expires in {contract.expiresIn} days
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {message.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
              )}
            </div>
          ))}

          {/* Streaming response */}
          {isStreaming && streamingText && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-gray-100 text-gray-900">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{streamingText}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <button
                    onClick={cancelStreaming}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Stop
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Loading (non-streaming) */}
          {isLoading && !isStreaming && (
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
          <p className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
            <Zap className="h-3 w-3" />
            Quick Questions:
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 4).map((suggestion, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                className="text-xs h-7 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Attached file indicator */}
      {attachedFile && (
        <div className="px-4 py-2 bg-blue-50 border-t flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Paperclip className="h-4 w-4 text-blue-600" />
            <span className="truncate max-w-[300px]">{attachedFile.name}</span>
            <span className="text-xs text-gray-500">
              ({(attachedFile.size / 1024).toFixed(1)} KB)
            </span>
          </div>
          <button
            onClick={removeAttachment}
            className="p-1 hover:bg-blue-100 rounded"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      )}

      {/* Enhanced Input */}
      <div className="p-4 border-t bg-white flex-shrink-0">
        <div className="flex gap-2 items-end">
          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.doc,.docx,.txt,.json"
          />
          
          {/* Attachment button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0 flex-shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="h-4 w-4 text-gray-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Attach file</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Text input - now a textarea for multiline */}
          <Textarea
            ref={inputRef}
            placeholder="Ask me anything about your contracts..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isLoading}
            className="flex-1 min-h-[40px] max-h-[120px] resize-none"
            rows={1}
          />

          {/* Voice input button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-10 w-10 p-0 flex-shrink-0",
                    isRecording && "bg-red-100 text-red-600"
                  )}
                  onClick={isRecording ? stopRecording : startRecording}
                >
                  {isRecording ? (
                    <MicOff className="h-4 w-4 animate-pulse" />
                  ) : (
                    <Mic className="h-4 w-4 text-gray-500" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isRecording ? 'Stop recording' : 'Voice input'}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Send button */}
          <Button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="h-10 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-gray-500">
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">Enter</kbd> to send • 
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs ml-1">Shift+Enter</kbd> for new line
          </p>
          <p className="text-xs text-gray-400">
            {messages.length - 1} messages
          </p>
        </div>
      </div>

      {/* History Modal */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Chat History
            </DialogTitle>
            <DialogDescription>
              Your previous conversations
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {chatSessions.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No previous conversations
              </p>
            ) : (
              chatSessions.slice(0, 20).map((session) => (
                <div
                  key={session.id}
                  className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer group"
                  onClick={() => loadSession(session)}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">{session.title}</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded"
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {session.messages.length} messages • {new Date(session.lastUpdated).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Shortcuts Modal */}
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              Keyboard Shortcuts
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Open/close chat</span>
              <div className="flex gap-1">
                <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">⌘</kbd>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">K</kbd>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">New conversation</span>
              <div className="flex gap-1">
                <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">⌘</kbd>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">⇧</kbd>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">N</kbd>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Focus input</span>
              <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">/</kbd>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Close chat</span>
              <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Esc</kbd>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
