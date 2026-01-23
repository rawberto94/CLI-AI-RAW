'use client'

/**
 * AI Contract Draft Assistant
 * 
 * A conversational AI interface for drafting contracts from natural language.
 * Users describe what they need, and AI generates a structured contract draft.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  Sparkles,
  Send,
  Bot,
  User,
  FileText,
  Loader2,
  Copy,
  Download,
  Edit3,
  CheckCircle2,
  ArrowLeft,
  Lightbulb,
  RefreshCw,
  Wand2,
  AlertCircle,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Save,
  ExternalLink,
  Clock,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { getTenantId } from '@/lib/tenant';
import { toast } from 'sonner'

// ============ TYPES ============

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  isLoading?: boolean
  contractDraft?: ContractDraft
}

interface ContractDraft {
  title: string
  type: string
  description: string
  parties: Array<{
    name: string
    role: string
  }>
  keyTerms: string[]
  suggestedClauses: Array<{
    title: string
    content: string
  }>
  fullText?: string
}

// ============ PROMPT SUGGESTIONS ============

const PROMPT_SUGGESTIONS = [
  {
    text: "Create an NDA between my company and a potential partner",
    icon: "🔒",
    category: "NDA"
  },
  {
    text: "Draft a software development contract for a mobile app",
    icon: "📱",
    category: "Development"
  },
  {
    text: "Write a consulting agreement for a 3-month project",
    icon: "💼",
    category: "Consulting"
  },
  {
    text: "Create an employment contract for a senior developer",
    icon: "👔",
    category: "Employment"
  },
  {
    text: "Generate a service level agreement for cloud hosting",
    icon: "☁️",
    category: "SLA"
  },
  {
    text: "Draft a partnership agreement for a joint venture",
    icon: "🤝",
    category: "Partnership"
  },
]

// ============ AI RESPONSE GENERATOR ============

async function generateAIResponse(
  userMessage: string,
  history: Message[]
): Promise<{ response: string; draft?: ContractDraft }> {
  // In production, this would call the actual AI API
  // For now, we simulate an AI response based on the prompt
  
  try {
    const response = await fetch('/api/ai/contract-draft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': getTenantId(),
      },
      body: JSON.stringify({
        prompt: userMessage,
        history: history.map(m => ({ role: m.role, content: m.content })),
      }),
    })
    
    if (!response.ok) {
      throw new Error('AI service unavailable')
    }
    
    const data = await response.json()
    return data
  } catch {
    // Fallback: Generate a mock response
    const draft = generateMockDraft(userMessage)
    return {
      response: `I've created a draft based on your request. Here's what I've prepared:\n\n**${draft.title}**\n\nThis ${draft.type} includes:\n${draft.keyTerms.map(t => `• ${t}`).join('\n')}\n\nI've also suggested some standard clauses that are typically included. You can review and edit the draft, then save it to your contracts.`,
      draft
    }
  }
}

function generateMockDraft(userMessage: string): ContractDraft {
  const lowerMessage = userMessage.toLowerCase()
  
  // Detect contract type from message
  let type = 'Service Agreement'
  let title = 'Service Agreement Draft'
  
  if (lowerMessage.includes('nda') || lowerMessage.includes('non-disclosure') || lowerMessage.includes('confidential')) {
    type = 'Non-Disclosure Agreement'
    title = 'Mutual Non-Disclosure Agreement'
  } else if (lowerMessage.includes('employment') || lowerMessage.includes('employee') || lowerMessage.includes('hire')) {
    type = 'Employment Agreement'
    title = 'Employment Contract'
  } else if (lowerMessage.includes('software') || lowerMessage.includes('development') || lowerMessage.includes('app')) {
    type = 'Software Development Agreement'
    title = 'Software Development Contract'
  } else if (lowerMessage.includes('consulting') || lowerMessage.includes('consultant')) {
    type = 'Consulting Agreement'
    title = 'Consulting Services Agreement'
  } else if (lowerMessage.includes('sla') || lowerMessage.includes('service level')) {
    type = 'Service Level Agreement'
    title = 'Service Level Agreement (SLA)'
  } else if (lowerMessage.includes('partnership') || lowerMessage.includes('joint venture')) {
    type = 'Partnership Agreement'
    title = 'Partnership Agreement'
  }
  
  return {
    title,
    type,
    description: `AI-generated ${type} draft based on your requirements.`,
    parties: [
      { name: 'Your Company', role: 'First Party' },
      { name: 'Other Party', role: 'Second Party' },
    ],
    keyTerms: [
      'Confidentiality obligations',
      'Term and termination',
      'Liability limitations',
      'Dispute resolution',
      'Governing law',
    ],
    suggestedClauses: [
      {
        title: 'Definitions',
        content: 'In this Agreement, the following terms shall have the meanings set forth below...'
      },
      {
        title: 'Scope',
        content: 'This Agreement governs the relationship between the Parties with respect to...'
      },
      {
        title: 'Confidentiality',
        content: 'Each Party agrees to maintain the confidentiality of all proprietary information...'
      },
      {
        title: 'Term & Termination',
        content: 'This Agreement shall commence on the Effective Date and continue for a period of...'
      },
      {
        title: 'Limitation of Liability',
        content: 'Neither Party shall be liable for any indirect, incidental, or consequential damages...'
      },
    ],
  }
}

// ============ MAIN COMPONENT ============

export function AIDraftAssistant() {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  
  // State
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "👋 Hello! I'm your AI Contract Draft Assistant. Tell me what kind of contract you need, and I'll help you create it.\n\nFor example, you can say:\n• \"Create an NDA between my company and a partner\"\n• \"Draft a software development contract\"\n• \"Write a consulting agreement\"\n\nWhat would you like to create today?",
      timestamp: new Date(),
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentDraft, setCurrentDraft] = useState<ContractDraft | null>(null)
  const [showDraftPanel, setShowDraftPanel] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])
  
  // Handlers
  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return
    
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }
    
    const loadingMessage: Message = {
      id: `loading-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    }
    
    setMessages(prev => [...prev, userMessage, loadingMessage])
    setInput('')
    setIsLoading(true)
    
    try {
      const { response, draft } = await generateAIResponse(input.trim(), messages)
      
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        contractDraft: draft,
      }
      
      setMessages(prev => prev.filter(m => !m.isLoading).concat(assistantMessage))
      
      if (draft) {
        setCurrentDraft(draft)
        setShowDraftPanel(true)
      }
    } catch {
      setMessages(prev => prev.filter(m => !m.isLoading).concat({
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      }))
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, messages])
  
  const handleSuggestionClick = useCallback((suggestion: string) => {
    setInput(suggestion)
    inputRef.current?.focus()
  }, [])
  
  const handleSaveDraft = useCallback(async () => {
    if (!currentDraft) return
    
    setIsSaving(true)
    
    try {
      const payload = {
        title: currentDraft.title,
        type: currentDraft.type.toUpperCase().replace(/\s+/g, '_'),
        description: currentDraft.description,
        status: 'DRAFT',
        parties: currentDraft.parties.map(p => ({
          name: p.name,
          role: p.role.toUpperCase().replace(/\s+/g, '_'),
        })),
        tags: ['ai-generated'],
        metadata: {
          aiGenerated: true,
          generatedAt: new Date().toISOString(),
          keyTerms: currentDraft.keyTerms,
          suggestedClauses: currentDraft.suggestedClauses,
        },
      }
      
      const response = await fetch('/api/contracts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': getTenantId(),
        },
        body: JSON.stringify(payload),
      })
      
      if (!response.ok) {
        throw new Error('Failed to save contract')
      }
      
      const result = await response.json()
      
      toast.success('Contract draft saved!', {
        description: 'Opening contract details...',
      })
      
      router.push(`/contracts/${result.id}`)
    } catch {
      toast.error('Failed to save draft', {
        description: 'Please try again',
      })
    } finally {
      setIsSaving(false)
    }
  }, [currentDraft, router])
  
  const handleCopyDraft = useCallback(() => {
    if (!currentDraft) return
    
    const text = [
      `# ${currentDraft.title}`,
      '',
      `**Type:** ${currentDraft.type}`,
      '',
      '## Parties',
      ...currentDraft.parties.map(p => `- ${p.name} (${p.role})`),
      '',
      '## Key Terms',
      ...currentDraft.keyTerms.map(t => `- ${t}`),
      '',
      '## Suggested Clauses',
      ...currentDraft.suggestedClauses.map(c => `### ${c.title}\n${c.content}`),
    ].join('\n')
    
    navigator.clipboard.writeText(text)
    toast.success('Draft copied to clipboard')
  }, [currentDraft])
  
  const handleRegenerateDraft = useCallback(() => {
    if (messages.length > 1) {
      const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
      if (lastUserMessage) {
        setInput(lastUserMessage.content)
        inputRef.current?.focus()
      }
    }
  }, [messages])
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/contracts')}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-slate-900">AI Draft Assistant</h1>
                  <p className="text-sm text-slate-500">
                    Describe your contract needs in plain language
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Bot className="h-3 w-3" />
                GPT-4o
              </Badge>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex gap-6 h-[calc(100vh-180px)]">
          {/* Chat Panel */}
          <div className={cn(
            "flex flex-col transition-all duration-300",
            showDraftPanel ? "w-1/2" : "w-full max-w-3xl mx-auto"
          )}>
            <Card className="flex-1 flex flex-col shadow-lg border-slate-200/60">
              {/* Messages */}
              <ScrollArea ref={scrollRef} className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex gap-3",
                        message.role === 'user' && "justify-end"
                      )}
                    >
                      {message.role === 'assistant' && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                      )}
                      
                      <div className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-3",
                        message.role === 'user' 
                          ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white"
                          : "bg-slate-100 text-slate-900"
                      )}>
                        {message.isLoading ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">Thinking...</span>
                          </div>
                        ) : (
                          <div className="prose prose-sm max-w-none">
                            <div className="whitespace-pre-wrap text-sm">
                              {message.content}
                            </div>
                          </div>
                        )}
                        
                        {message.contractDraft && (
                          <div className="mt-3 pt-3 border-t border-slate-200">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowDraftPanel(true)}
                              className="w-full bg-white gap-2"
                            >
                              <FileText className="h-4 w-4 text-indigo-500" />
                              View Draft
                              <ChevronRight className="h-4 w-4 ml-auto" />
                            </Button>
                          </div>
                        )}
                      </div>
                      
                      {message.role === 'user' && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                          <User className="h-4 w-4 text-slate-600" />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
              
              {/* Suggestions (only show if no messages yet) */}
              {messages.length === 1 && (
                <div className="p-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500 mb-3 flex items-center gap-1">
                    <Lightbulb className="h-3 w-3" />
                    Quick suggestions
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {PROMPT_SUGGESTIONS.slice(0, 4).map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion.text)}
                        className="text-left p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors group"
                      >
                        <span className="text-lg mr-2">{suggestion.icon}</span>
                        <span className="text-sm text-slate-700 group-hover:text-indigo-700">
                          {suggestion.text.slice(0, 40)}...
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Input */}
              <div className="p-4 border-t border-slate-100">
                <div className="flex gap-2">
                  <Textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    placeholder="Describe the contract you need..."
                    className="flex-1 min-h-[60px] max-h-[120px] resize-none"
                    disabled={isLoading}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 px-4"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-slate-400 mt-2 text-center">
                  Press Enter to send, Shift+Enter for new line
                </p>
              </div>
            </Card>
          </div>
          
          {/* Draft Panel */}
          <AnimatePresence>
            {showDraftPanel && currentDraft && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="w-1/2"
              >
                <Card className="h-full flex flex-col shadow-lg border-slate-200/60">
                  <CardHeader className="pb-3 flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-indigo-500" />
                        Contract Draft
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDraftPanel(false)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  
                  <ScrollArea className="flex-1 px-6">
                    <div className="space-y-6 pb-4">
                      {/* Title & Type */}
                      <div>
                        <h3 className="text-xl font-semibold text-slate-900">
                          {currentDraft.title}
                        </h3>
                        <Badge variant="secondary" className="mt-2">
                          {currentDraft.type}
                        </Badge>
                      </div>
                      
                      <Separator />
                      
                      {/* Parties */}
                      <div>
                        <h4 className="text-sm font-medium text-slate-700 mb-3">Parties</h4>
                        <div className="space-y-2">
                          {currentDraft.parties.map((party, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                            >
                              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                <User className="h-4 w-4 text-indigo-600" />
                              </div>
                              <div>
                                <p className="font-medium text-slate-900">{party.name}</p>
                                <p className="text-xs text-slate-500">{party.role}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Key Terms */}
                      <div>
                        <h4 className="text-sm font-medium text-slate-700 mb-3">Key Terms</h4>
                        <div className="flex flex-wrap gap-2">
                          {currentDraft.keyTerms.map((term, index) => (
                            <Badge key={index} variant="outline">
                              {term}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      {/* Suggested Clauses */}
                      <div>
                        <h4 className="text-sm font-medium text-slate-700 mb-3">Suggested Clauses</h4>
                        <div className="space-y-3">
                          {currentDraft.suggestedClauses.map((clause, index) => (
                            <div
                              key={index}
                              className="p-3 border border-slate-200 rounded-lg"
                            >
                              <h5 className="text-sm font-medium text-slate-900 mb-1">
                                {clause.title}
                              </h5>
                              <p className="text-sm text-slate-600 line-clamp-2">
                                {clause.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                  
                  {/* Actions */}
                  <div className="p-4 border-t border-slate-100 space-y-3 flex-shrink-0">
                    <div className="flex gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCopyDraft}
                              className="flex-1"
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Copy
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Copy draft as text</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleRegenerateDraft}
                              className="flex-1"
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Regenerate
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Generate a new version</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    
                    <Button
                      onClick={handleSaveDraft}
                      disabled={isSaving}
                      className="w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save & Open in Editor
                        </>
                      )}
                    </Button>
                    
                    <p className="text-xs text-center text-slate-500">
                      <Clock className="h-3 w-3 inline mr-1" />
                      Draft will be saved for further editing
                    </p>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export default AIDraftAssistant
