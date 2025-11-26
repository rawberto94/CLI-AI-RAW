'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useDataMode } from '@/contexts/DataModeContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  MessageCircle,
  Send,
  Sparkles,
  X,
  Minimize2,
  Maximize2,
  Loader2,
  Bot,
  User
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  suggestions?: string[]
}

interface ChatAssistantProps {
  contractId?: string
  context?: string
}

export function ChatAssistant({ contractId, context }: ChatAssistantProps) {
  const { dataMode, isRealData } = useDataMode()
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Welcome message
      setMessages([{
        id: '1',
        role: 'assistant',
        content: `Hi! I'm your AI contract assistant. I can help you with:\n\n• Analyzing contract terms\n• Finding specific clauses\n• Identifying risks and opportunities\n• Comparing rates\n• Answering questions about your contracts\n\nWhat would you like to know?`,
        timestamp: new Date(),
        suggestions: [
          'What are the key terms?',
          'Show me potential savings',
          'When does this contract expire?',
          'Compare rates with market'
        ]
      }])
    }
  }, [isOpen])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      let response: Message

      if (isRealData) {
        // Call real AI API
        const apiResponse = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-data-mode': dataMode
          },
          body: JSON.stringify({
            message: input,
            contractId,
            context,
            history: messages
          })
        })

        const data = await apiResponse.json()
        response = {
          id: Date.now().toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          suggestions: data.suggestions
        }
      } else {
        // Mock/AI response
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        const mockResponses = [
          {
            content: `Based on the contract analysis, I found:\n\n• Total contract value: $1.2M\n• Contract term: 24 months\n• Renewal notice: 90 days\n• Payment terms: Net 30\n\nThe contract appears to be in good standing with no immediate concerns.`,
            suggestions: ['Show me the rate cards', 'Any cost savings?', 'Compare with similar contracts']
          },
          {
            content: `I've identified potential savings opportunities:\n\n• Rate optimization: $180K (15%)\n• Volume discounts: $45K (3.75%)\n• Term extension benefits: $30K (2.5%)\n\nTotal potential savings: $255K over the contract term.`,
            suggestions: ['How can I achieve these savings?', 'Show detailed breakdown', 'Export this analysis']
          },
          {
            content: `The contract expires on December 31, 2025. Key dates:\n\n• Renewal notice due: October 2, 2025 (90 days prior)\n• Final payment: December 15, 2025\n• Auto-renewal: Yes, unless notice given\n\nI recommend starting renewal discussions in Q3 2025.`,
            suggestions: ['Set renewal reminder', 'Compare renewal options', 'Draft renewal terms']
          }
        ]

        const randomResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)]!
        response = {
          id: Date.now().toString(),
          role: 'assistant',
          content: randomResponse.content,
          timestamp: new Date(),
          suggestions: randomResponse.suggestions
        }
      }

      setMessages(prev => [...prev, response])
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion)
  }

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    )
  }

  return (
    <Card
      className={cn(
        'fixed bottom-6 right-6 z-50 shadow-2xl transition-all',
        isMinimized ? 'w-80 h-16' : 'w-96 h-[600px]'
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="p-1.5 bg-purple-100 rounded-full">
            <Sparkles className="h-4 w-4 text-purple-600" />
          </div>
          AI Assistant
          <Badge variant="secondary" className="text-xs">
            {dataMode}
          </Badge>
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
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
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      {!isMinimized && (
        <>
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 h-[calc(600px-140px)]">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex gap-3',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <div className="p-2 bg-purple-100 rounded-full h-fit">
                    <Bot className="h-4 w-4 text-purple-600" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[80%] rounded-lg p-3 text-sm',
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.suggestions && message.suggestions.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs opacity-75">Suggested questions:</p>
                      {message.suggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="block w-full text-left text-xs p-2 bg-white/50 hover:bg-white/75 rounded transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="p-2 bg-blue-100 rounded-full h-fit">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="p-2 bg-purple-100 rounded-full h-fit">
                  <Bot className="h-4 w-4 text-purple-600" />
                </div>
                <div className="bg-gray-100 rounded-lg p-3">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </CardContent>

          <div className="p-4 border-t">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                sendMessage()
              }}
              className="flex gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </>
      )}
    </Card>
  )
}

// Auto-generated default export
export default ChatAssistant;
